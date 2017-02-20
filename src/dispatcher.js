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
var RECV = Buffer.from('+RECEIVE');
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
  console.log('dispatcher data str:<' + data + '>');
  // console.log('dispatcher buffer:');
  // console.log(data);
  // if (data.equals(CRLF)) {
  //   return;
  // }
  var powerOnReadyMatch = data.toString().match(POWER_ON_READY);
  if (powerOnReadyMatch) {
    if (powerOnReadyMatch[1] === 'SMS') {
      this.emit('powerOnReady');
    }
    return;
  }
  var connectionRelatedMatch = data.toString().match(CONNECTION_RELATED);
  if (connectionRelatedMatch) {
    this.emit('clientRelated', connectionRelatedMatch.slice(1));
  }
  else if (this._mode === MODE.DATA) {
    this.emit('recv', data);
  } else if (data.slice(0, RECV.length).equals(RECV)) {
    this.switchMode();
    this.emit('recv', data);
  } else {
    this.emit('cmd', data);
  }
};

module.exports = Dispatcher;

