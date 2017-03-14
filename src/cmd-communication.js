/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var Queue = require('ruff-async').Queue;

var RESPONSE_TIMEOUT = 10 * 1000;

var AT = Buffer.from('AT');
var CRLF = Buffer.from('\r\n');

var AT_RES = new RegExp(/AT(.*?)\r/);
var SEND_INDICATOR = new RegExp(/\r\r\n>\s/);
var RES = new RegExp(/(\r\n.+)+\r\n/g);

var State = {
  idle: 0,
  waitingResponse: 1
};

function CmdCommunication(port, dispatcher) {
  EventEmitter.call(this);
  this._cs = State.idle;

  this._writingDataLen = 0;
  this._writingDataCacheLen = 0;

  this._port = port;
  this._cmdQueue = new Queue(this._processCmd);
  this._pendingData = new Buffer(0);

  this._dispatcher = dispatcher;
  this._dispatcher.on('cmd', this._parseData.bind(this));
};

util.inherits(CmdCommunication, EventEmitter);

CmdCommunication.prototype._parseData = function (data) {
  // when client is sending data, sim800c will echo it back, so accumulate the data length to the total length
  if (this._writingDataLen) {
    this._writingDataCacheLen += data.length;
    if (this._writingDataCacheLen >= this._writingDataLen) {
      this._writingDataLen = 0;
      this._writingDataCacheLen = 0;
      this.emit('responseDone', null);
    }
    return;
  }
  // when in IDLE mode, this cmd communication should not receive data
  if (this._cs === State.idle) {
    // console.log('GPRS receive data when IDLE : ' + data);
    return;
  }

  this._pendingData = Buffer.concat([this._pendingData, data]);
  if (this._cs === State.waitingResponse) {
    var res = basicParseResponseWithData(this._pendingData);
    if (res.valid) {
      this._consume(res.index[0] + res.index[1]);
      // console.log('---------------------------------');
      // console.log('res cmd: ' + res.ackCmd);
      // console.log('res data: ' + res.data);
      if (res.data[0] === '>') {
        var tmp = res.ackCmd.match(/(\d),(\d+)/);
        // get writing data length from 'AT+CIPSEND=INDEX,LENGTH'
        this._writingDataLen = Number(tmp[2]);
        this.emit('wait4Data' + tmp[1]);
      } else {
        this.emit("responseDone", null, res);
      }
    }
  }
};

/* parse cmd response into the following object:
 * {
 *  valid: true | false,
 *  ackCmd: the cmd that this response relates to,
 *  index: the begin and end index of a certain response
 *  data: parsed response data
 * }
 */
function basicParseResponseWithData(rawData) {
  var res = {valid: false};
  var rawDataStr = rawData.toString();

  var atResMatch = rawDataStr.match(AT_RES);
  var sendIndicatroMatch = rawDataStr.match(SEND_INDICATOR);
  // the cmd is 'AT+CIPSEND=INDEX,LENGTH'
  if (atResMatch && sendIndicatroMatch) {
    res.valid = true;
    res.ackCmd = atResMatch[1];
    res.index = [0, rawData.length];
    res.data = ['>'];
    return res;
  }
  // match multiple lines of the response
  var resMatch = rawDataStr.match(RES);
  if (resMatch) {
    var lastMatch = Buffer.from(resMatch[resMatch.length - 1]);
    var lastMatchEndIndex = rawData.indexOf(lastMatch) + lastMatch.length;
    if (lastMatchEndIndex !== rawData.length) {
      return res;
    }
    res.valid = true;
    if (atResMatch) {
      res.ackCmd = atResMatch[1];
    }
    res.data = [];
    // slice out the head and tail '\r\n' characters
    resMatch.forEach(function (match) {
      res.data.push(match.slice(2, match.length - 2));
    });
    res.index = [rawData.indexOf(AT), lastMatchEndIndex];
  }
  return res;
};

CmdCommunication.prototype.sendRawData = function (data, callback) {
  this._port.write(data, function (error) {
    if (error) {
      callback && callback(error);
      return;
    }
    callback && callback.apply(undefined, arguments);
  });
};

CmdCommunication.prototype.pushCmd = function (cmd, callback) {
  if (cmd) {
    this._cmdQueue.push(this, [cmd], callback);
  }
};

CmdCommunication.prototype._processCmd = function (cmdData, callback) {
  if (this._cs !== State.idle) return;

  this._getResponse(invokeCallbackOnce);

  this._port.write(cmdData, function (error) {
    if (error) {
      invokeCallbackOnce(error);
      return;
    }
  });

  var callbackInvoked = false;

  function invokeCallbackOnce() {
    if (!callbackInvoked) {
      callbackInvoked = true;
      callback && callback.apply(undefined, arguments);
    }
  }
};

// it will wait for cmd response or timeout in RESPONSE_TIMEOUT
CmdCommunication.prototype._getResponse = function (callback) {
  this._cs = State.waitingResponse;
  var that = this;

  var timerHandle = setTimeout(function () {
    responseDoneCleanup(new Error('GPRS Command Response Timeout'));
  }, RESPONSE_TIMEOUT);

  this.on('responseDone', responseDoneCleanup);

  function responseDoneCleanup(error, response) {
    clearTimeout(timerHandle);
    that.removeListener('responseDone', responseDoneCleanup);
    that._cs = State.idle;
    callback(error, response ? response.data : null);
  };

};

CmdCommunication.prototype._consume = function (length) {
  this._pendingData = this._pendingData.slice(length);
};

module.exports = CmdCommunication;