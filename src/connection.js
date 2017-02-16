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
  this._clientCommunication.on('msg' + this._index, function(msgObj) {
    that.emit('data', msgObj.bodyBuffer);
  });
  this._clientCommunication.on('client' + this._index, function(event) {
    console.log('client' + that._index + ' event: ' + event);
    switch(event) {
      case 'ALREADY CONNECT':
      case 'CONNECT OK':
        that.emit('connect');
        break;
      default:
        that.emit('error');
        break;
    }
  });
};

util.inherits(Connection, EventEmitter);

Connection.prototype.write = function(data) {
  var writeBuf = generateWriteBuffer(this._index, data);
  console.log('write buf: ' + writeBuf.toString());
  this._cmdCommunication.pushCmd(writeBuf, function(error, result) {
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