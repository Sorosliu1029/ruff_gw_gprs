/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var Queue = require('ruff-async').Queue;
var ReadStreaming = require('./read-streaming');

var AT = Buffer.from('AT');

var State = {
  idle: 0,
  waitingResponse: 1
};

function Communication(port) {
  EventEmitter.call(this);
  this._cs = State.idle;
  this._port = port;
  this._cmdQueue = new Queue(this._processCmd);
  this._pendingData = new Buffer(0);

  this._readStream = new ReadStreaming(port);
  this._readStream.on('data', this._parseData.bind(this));
  this._readStream.on('error', function () {
    throw new Error('UART is crashed');
  });
  this._readStream.start();
}

util.inherits(Communication, EventEmitter);

Communication.prototype.sendRawData = function (data, callback) {
  this._port.write(data, function (error) {
    if (error) {
      callback && callback(error);
      return;
    }
    callback && callback.apply(undefined, arguments);
  });
};

Communication.prototype.pushCmd = function (cmd, callback) {
  if (cmd) {
    this._cmdQueue.push(this, [cmd], callback);
  }
};

Communication.prototype._processCmd = function (cmdData, callback) {
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

Communication.prototype._getResponse = function (callback) {
  this._cs = State.waitingResponse;
  var that = this;

  this.on('responseDone', responseDoneCleanup);

  function responseDoneCleanup(error, response) {
    that.removeListener('responseDone', responseDoneCleanup);
    that._cs = State.idle;
    that._pendingData = new Buffer(0);
    callback(error, response.data);
  };
};

Communication.prototype._consume = function (length) {
  this._pendingData = this._pendingData.slice(length);
};

// parse raw data from UART receiver
Communication.prototype._parseData = function (data) {
  if (this._cs === State.idle) {
    this._pendingData = new Buffer(0);
    return;
  }
  this._pendingData = Buffer.concat([this._pendingData, data]);
  var error = null;
  if (this._cs === State.waitingResponse) {
    var res = basicParseResponseWithData(this._pendingData);
    if (res.valid) {
      this._consume(res.index[0] + res.index[1]);
      console.log('---------------------------------');
      console.log('res index: ' + res.index[0] + ' ' + res.index[1]);
      console.log('res cmd: ' + res.ackCmd);
      console.log('res data: ' + res.data);
      if (this._pendingData.length !== 0) {
        error = new Error('cache data cannot be consumed completely.')
      }
      this.emit("responseDone", error, res);
    }
  }
};

function basicParseResponseWithData(rawData) {
  var res = {};
  res.valid = false;
  var rawDataStr = rawData.toString();
  console.log(rawDataStr);
  var atReg = new RegExp(/AT(.*?)\r/);
  var resReg = new RegExp(/(\r\n.*\r\n)/g);
  var atMatch = rawDataStr.match(atReg);
  var resMatch = rawDataStr.match(resReg);
  if (atMatch && resMatch) {
    res.valid = true;
    res.ackCmd = atMatch[1];
    res.data = [];
    resMatch.forEach(function (match) {
      res.data.push(match.slice(2, match.length-2));
    })
    var lastMatch = Buffer.from(resMatch[resMatch.length - 1]);
    res.index = [rawData.indexOf(AT), rawData.indexOf(lastMatch) + lastMatch.length];
  }
  return res;
};

module.exports = Communication;