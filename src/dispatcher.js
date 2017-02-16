/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var ReadStreaming = require('./read-streaming');

var RECV = Buffer.from('+RECEIVE');

var MODE = {
  CMD: 0,
  DATA: 1
};

function Dispatcher(port) {
  EventEmitter.call(this);
  this._port = port;

  this._mode = MODE.CMD;

  this._readStream = new ReadStreaming(port);
  this._readStream.on('data', this.dispatch.bind(this));
  this._readStream.on('error', function () {
    throw new Error('UART is crashed');
  });
  this._readStream.start();
};

util.inherits(Dispatcher, EventEmitter);

Dispatcher.prototype.switchMode = function () {
  this._mode = this._mode === MODE.CMD ? MODE.DATA : MODE.CMD;
}

Dispatcher.prototype.dispatch = function (data) {
  console.log('dispatcher ' + data);
  if (this._mode === MODE.DATA) {
    this.emit('recv', data);
  } else if (data.slice(0, RECV.length).equals(RECV)) {
    this.switchMode();
    this.emit('recv', data);
  } else {
    this.emit('cmd', data);
  }
};

module.exports = Dispatcher;

