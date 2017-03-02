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
var TERMINATOR = Buffer.from([0x1a, 0x0d]);
var CRLF = Buffer.from('\r\n');

var State = {
  idle: 0,
  waitingResponse: 1
};

var NOECHO = false;

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
  if (this._writingDataLen) {
    this._writingDataCacheLen += data.length;
    if (this._writingDataCacheLen >= this._writingDataLen) {
      this._writingDataLen = 0;
      this._writingDataCacheLen = 0;
      this.emit('responseDone', null);
    }
    return;
  }
  if (this._cs === State.idle) {
    console.log('receive data when IDLE! : ', data.length);
    return;
  }
  this._pendingData = Buffer.concat([this._pendingData, data]);

  if (this._cs === State.waitingResponse) {
    var res = basicParseResponseWithData(this._pendingData);
    if (res.valid) {
      this._consume(res.index[0] + res.index[1]);
      console.log('---------------------------------');
      console.log('res cmd: ' + res.ackCmd);
      console.log('res data: ' + res.data);
      if (res.data[0] === '>') {
        var tmp = res.ackCmd.match(/(\d),(\d+)/);
        this._writingDataLen = Number(tmp[2]);
        this.emit('wait4Data' + tmp[1]);
      } else {
        this.emit("responseDone", null, res);
      }
    }
  }
};

function basicParseResponseWithData(rawData) {
  var res = {};
  res.valid = false;
  var rawDataStr = rawData.toString();
  console.log(rawDataStr);
  var atReg = new RegExp(/AT(.*?)\r/);
  var atMatch = rawDataStr.match(atReg);
  var sendIndicatorReg = new RegExp(/\r\r\n>\s/);
  var sendIndicatroMatch = rawDataStr.match(sendIndicatorReg);
  if ((NOECHO || atMatch) && sendIndicatroMatch) {
    res.valid = true;
    res.ackCmd = NOECHO ? 'NOECHO' : atMatch[1];
    res.index = [0, rawData.length];
    res.data = ['>'];
    return res;
  }
  var resReg = new RegExp(/(\r\n.+)+\r\n/g);
  var resMatch = rawDataStr.match(resReg);
  if (resMatch) {
    var lastMatch = Buffer.from(resMatch[resMatch.length - 1]);
    var lastMatchEndIndex = rawData.indexOf(lastMatch) + lastMatch.length;
    if (lastMatchEndIndex !== rawData.length) {
      return res;
    }
    res.valid = true;
    if (atMatch) {
      res.ackCmd = NOECHO ? 'NOECHO' : atMatch[1];
    }
    res.data = [];
    resMatch.forEach(function (match) {
      res.data.push(match.slice(2, match.length - 2));
    });
    res.index = [NOECHO ? 0 : rawData.indexOf(AT), lastMatchEndIndex];
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

CmdCommunication.prototype._getResponse = function (callback) {
  this._cs = State.waitingResponse;
  var that = this;

  var timerHandle = setTimeout(function () {
    responseDoneCleanup(new Error('Response Timeout'));
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