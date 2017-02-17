/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');

function Connection(cmdCommunication, clientCommunication, index, host, port) {
  EventEmitter.call(this);
  this._cmdCommunication = cmdCommunication;
  this._clientCommunication = clientCommunication;
  this._index = index;
  this._host = host;
  this._port = port;
  var that = this;
  this._clientCommunication.on('msg' + this._index, function (msgObj) {
    that.emit('data', msgObj.bodyBuffer);
  });
  this._clientCommunication.on('client' + this._index, function (event) {
    console.log('client' + that._index + ' event: ' + event);
    switch (event) {
      case 'ALREADY CONNECT':
      case 'CONNECT OK':
        that.emit('connect');
        break;
      case 'SEND OK':
        break;
      default:
        that.emit('error', event);
        break;
    }
  });
  this.ipStart(this._index, this._host, this._port, function(error, result) {
    if (error) {
      that.emit('error', error);
    }
    console.log('connection ip start result: ' + result);
  });
};

util.inherits(Connection, EventEmitter);

Connection.prototype.ipStart = function (index, host, port, cb) {
  var cmd = Buffer.from('AT+CIPSTART="' + index + '","TCP","' + host + '","' + port + '"\r');
  this._cmdCommunication.pushCmd(cmd, function (error, result) {
    if (error) {
      console.log(error);
      cb && cb(error);
    }
    if (!result[0].match(/OK/)) {
      error = new Error('response ends with error');
      cb && cb(error);
    } else {
      cb && cb(null, result);
    }
  });
};

Connection.prototype.write = function (data) {
  var writeBuf = generateWriteBuffer(this._index, data);
  console.log('write buf: ' + writeBuf.toString());
  this._cmdCommunication.pushCmd(writeBuf, function (error, result) {
    console.log('send result: ' + result);
  });
};

function generateSendCmd(index) {
  return Buffer.from('AT+CIPSEND=' + index + '\r');
};

function generateWriteBuffer(index, data) {
  return Buffer.concat([Buffer.from('AT+CIPSEND=' + index + '\r\n' + data.toString()), Buffer.from([0x1a])]);
};

module.exports = Connection;