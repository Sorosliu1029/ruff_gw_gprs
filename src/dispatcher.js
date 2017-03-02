/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var ReadStreaming = require('./read-streaming');

var POWER_ON_READY = new RegExp(/(Call|SMS)\sReady\r\n/);
var CONNECTION_RELATED = new RegExp(/(\d),\s(SEND OK|SEND FAIL|CONNECT OK|CONNECT FAIL|ALREADY CONNECT|CLOSED)\r\n/);
var RECV = new RegExp(/\+R/);
var CRLF = Buffer.from('\r\n');

var MODE = {
  CMD: 0,
  DATA: 1
};


/*
 * Dispatcher is used to gather all data from UART port,
 * and distribute gathered data to CmdCommunication or ClientCommunication.
 * Dispatcher has two modes: 1. CMD mode, 2. DATA mode.
 */
function Dispatcher(port) {
  EventEmitter.call(this);
  this._port = port;

  this._mode = MODE.CMD;

  this._readStream = new ReadStreaming(port);
  this._readStream.on('data', this.dispatch.bind(this));
  this.on('data', this.dispatch.bind(this));
  this._readStream.on('error', function () {
    // throw new Error('UART is crashed');
    console.log('UART is crashed');
  });
  this._readStream.start();
};

util.inherits(Dispatcher, EventEmitter);

Dispatcher.prototype.switchMode = function () {
  this._mode = this._mode === MODE.CMD ? MODE.DATA : MODE.CMD;
}

Dispatcher.prototype.dispatch = function (data) {
  // console.log('dispatcher data str:<' + data + '>');
  var dataStr = data.toString();
  var powerOnReadyMatch = dataStr.match(POWER_ON_READY);
  if (powerOnReadyMatch) {
    if (powerOnReadyMatch[1] === 'SMS') {
      this.emit('powerOnReady');
    }
    return;
  }
  var connectionRelatedMatch = dataStr.match(CONNECTION_RELATED);
  if (connectionRelatedMatch) {
    this.emit('clientRelated', connectionRelatedMatch.slice(1));
    var beginIndex = dataStr.indexOf(connectionRelatedMatch[1]);
    if (data.slice(beginIndex-4, beginIndex).equals(Buffer.from('\r\n\r\n'))) {
      beginIndex -= 2;
    }
    var endIndex = dataStr.indexOf(connectionRelatedMatch[2]) + connectionRelatedMatch[2].length + 2;
    data = Buffer.concat([data.slice(0, beginIndex), data.slice(endIndex, data.length)]);
    if (data.toString().trim()) {
      this.dispatch(data);
    }
  } else if (this._mode === MODE.DATA) {
    this.emit('recv', data);
  } else {
    dataStr = data.toString();
    var recvMatch = dataStr.match(RECV);
    var recvIndex;
    if (recvMatch) {
      recvIndex = dataStr.indexOf(recvMatch);
      var recvData = data.slice(recvIndex);
      this.switchMode();
      this.emit('recv', recvData);
      data = data.slice(0, recvIndex > 1 ? recvIndex - 2 : 0);
    }
    if (data.length) {
      this.emit('cmd', data);
    }
  }
};

module.exports = Dispatcher;