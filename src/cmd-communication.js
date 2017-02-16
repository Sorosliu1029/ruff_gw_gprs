/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var Queue = require('ruff-async').Queue;

var AT = Buffer.from('AT');

var State = {
  idle: 0,
  waitingResponse: 1
};

function CmdCommunication(port, dispatcher) {
  EventEmitter.call(this);
  this._cs = State.idle;
  this._ignoreEcho = false;
  this._port = port;
  this._cmdQueue = new Queue(this._processCmd);
  this._pendingData = new Buffer(0);

  this._dispatcher = dispatcher;
  this._dispatcher.on('cmd', this._parseData.bind(this));
};

util.inherits(CmdCommunication, EventEmitter);

CmdCommunication.prototype._parseData = function (data) {
  if (this._ignoreEcho === true) {
    var sendResultReg = new RegExp(/(\d),\sSEND\s(OK|FAIL)/);
    var sendResultMatch = data.toString().match(sendResultReg);
    if(sendResultMatch) {
      var clientIndex = Number(sendResultMatch[1]);
      var sendResult = sendResultMatch[2];
      this._ignoreEcho = false;
      console.log('send result index: ' + clientIndex + ' result: ' + sendResult);
    }
    return;
  }
  if (this._cs === State.idle) {
    console.log('receive data when IDLE! : ', data.toString());
    // when in idle state, it means 'data' isn't for cmd, so dispatch it to client communication
    this._dispatcher.emit('clientRelated', data);
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
      if (res.type === 'enterIgnore') {
        this._ignoreEcho = true;
      }
      this.emit("responseDone", null, res);
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
  if (atMatch && sendIndicatroMatch) {
    res.valid = true;
    res.type = "enterIgnore";
    res.ackCmd = atMatch[1];
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
      res.ackCmd = atMatch[1];
    }
    res.data = [];
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

CmdCommunication.prototype._getResponse = function (callback) {
  this._cs = State.waitingResponse;
  var that = this;

  this.on('responseDone', responseDoneCleanup);

  function responseDoneCleanup(error, response) {
    that.removeListener('responseDone', responseDoneCleanup);
    that._cs = State.idle;
    callback(error, response.data);
  };
};

CmdCommunication.prototype._consume = function (length) {
  this._pendingData = this._pendingData.slice(length);
};

module.exports = CmdCommunication;