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
var SMS_INDICATOR = new RegExp(/\+CMTI\:\s"SM",\d+/);
var RECV = '+R';
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
    throw new Error('UART is crashed');
  });
  this._readStream.start();
};

util.inherits(Dispatcher, EventEmitter);

Dispatcher.prototype.switchMode = function () {
  this._mode = this._mode === MODE.CMD ? MODE.DATA : MODE.CMD;
}

Dispatcher.prototype.dispatch = function (data) {
  var dataStr = data.toString();
  // console.log('dispatcher: ' + dataStr);

  // it will receive 'Call Ready', 'SMS Ready' after power on
  var powerOnReadyMatch = dataStr.match(POWER_ON_READY);
  if (powerOnReadyMatch) {
    if (powerOnReadyMatch[1] === 'SMS') {
      this.emit('powerOnReady');
    }
    return;
  }

  var smsIndicatorMatch = dataStr.match(SMS_INDICATOR);
  if (smsIndicatorMatch) {
    this.emit('error', new Error('receive SMS'));
    return;
  }

  // it will receive like '0, CONNECT OK', '1, SEND OK' from UART port at any time
  var connectionRelatedMatch = dataStr.match(CONNECTION_RELATED);
  if (connectionRelatedMatch) {
    this.emit('clientRelated', connectionRelatedMatch.slice(1));
    var beginIndex = dataStr.indexOf(connectionRelatedMatch[0]);
    // there might be multi empty lines, so only leave one line
    if (data.slice(beginIndex - 4, beginIndex).equals(Buffer.from('\r\n\r\n'))) {
      beginIndex -= 2;
    }
    var endIndex = beginIndex + connectionRelatedMatch[0].length;
    // cut client related data out, then dispatch remaining data
    var remain = Buffer.concat([Buffer.from(data.slice(0, beginIndex)), Buffer.from(data.slice(endIndex, data.length))]);
    if (remain.toString().trim()) {
      this.dispatch(remain);
    }
  } 
  // when in DATA mode, dispatch data to client communication directly
  else if (this._mode === MODE.DATA) {
    this.emit('recv', data);
  }
  /* first check if data is a 'RECEIVE' header,  
   * if so, dispatch received data to client communication,
   * then dispatch remaining data to cmd communication
   */
  else {
    var recvIndex = dataStr.indexOf(RECV);
    if (recvIndex !== -1) {
      // enter DATA mode
      this.switchMode();
      this.emit('recv', data.slice(recvIndex));
      data = data.slice(0, recvIndex > 1 ? recvIndex - 2 : 0);
    }
    if (data.length) {
      this.emit('cmd', data);
    }
  }
};

module.exports = Dispatcher;