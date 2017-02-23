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
        that.emit('drain');
        break;
       case 'CLOSED':
        that.emit('close');
        that.removeAllListeners();
        that._clientCommunication.setConnectionUnused(that._index);
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
  });
};

util.inherits(Connection, EventEmitter);

Connection.prototype.ipStart = function (index, host, port, cb) {
  var cmd = Buffer.from('AT+CIPSTART="' + index + '","TCP","' + host + '","' + port + '"\r');
  console.log('ip start cmd: ' + cmd);
  this._cmdCommunication.pushCmd(cmd, function (error, result) {
    if (error) {
      console.log(error);
      cb && cb(error);
    }
    if (!result[0].match(/OK/)) {
      error = new Error('response ends with error');
      cb && cb(error);
    } else {
      cb && cb(null, result[0]);
    }
  });
};

Connection.prototype.write = function (data) {
  var that = this;
  var sendCmd = generateSendCmd(this._index);
  var writeBuf = generateWriteBuffer(data);
  this._cmdCommunication.once('wait4Data' + this._index, function () {
    that._cmdCommunication.sendRawData(writeBuf);
  });
  this._cmdCommunication.pushCmd(sendCmd, function (error, result) {
    if (error) {
      that.emit('error', error);
    }
  });
};

Connection.prototype.destroy = function () {
  var that = this;
  var destroyCmd = generateDestroyCmd(this._index);
  this._cmdCommunication.pushCmd(destroyCmd, function (error, result) {
    if (error) {
      that.emit('error', error);
    } else {
      var tmp = result[0].match(/(\d),\s(CLOSE.*)/);
      if (Number(tmp[1]) !== that._index) {
        that.emit('error', new Error('destroy index not identical'));
      } else if (tmp[2] === 'CLOSE OK') {
        that.emit('close');
        that.removeAllListeners();
        that._clientCommunication.setConnectionUnused(that._index);
      } else {
        that.emit('error', new Error('unknown error'));
      }
    }
  });
};

function generateSendCmd(index) {
  return Buffer.from('AT+CIPSEND=' + index + '\r');
};

function generateWriteBuffer(data) {
  return Buffer.concat([Buffer.from(data), Buffer.from([0x1a, 0x0d])]);
};

function generateDestroyCmd(index) {
  return Buffer.from('AT+CIPCLOSE=' + index + '\r');
};

module.exports = Connection;