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
  this._maxDataLength = null;
  this._writeBufferCache = [];

  var that = this;
  this._clientCommunication.on('msg' + this._index, function (msgBuffer) {
    that.emit('data', msgBuffer);
  });

  this._clientCommunication.on('client' + this._index, function (event) {
    // console.log('client' + that._index + ' event: ' + event);
    switch (event) {
      case 'ALREADY CONNECT':
      case 'CONNECT OK':
        // that._maxDataLength = 1000;
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
  // start connection immediately after creating this connection
  this._ipStart(this._index, this._host, this._port, function (error, result) {
    if (error) {
      that.emit('error', error);
    }
  });
};

util.inherits(Connection, EventEmitter);

Connection.prototype._ipStart = function (index, host, port, cb) {
  var cmd = Buffer.from('AT+CIPSTART="' + index + '","TCP","' + host + '","' + port + '"\r');
  this._cmdCommunication.pushCmd(cmd, function (error, result) {
    if (error) {
      cb && cb(error);
    } else if (result[0] !== 'OK') {
      error = new Error('IP start error');
      cb && cb(error);
    } else {
      cb && cb(null, result[0]);
    }
  });
};

// query the max data length this connection could send now
Connection.prototype._queryMaxDataLength = function (index, cb) {
  var cmd = Buffer.from('AT+CIPSEND?\r');
  this._cmdCommunication.pushCmd(cmd, function (error, result) {
    if (error) {
      cb && cb(error);
    } else if (result[1] !== 'OK') {
      error = new Error('Query max data length error');
      cb && cb(error);
    } else {
      var maxLength = result[0].split('\r\n')[index].match(/\+CIPSEND\:\s(\d),(\d+)/)[2];
      cb && cb(null, Number(maxLength));
    }
  });
};

Connection.prototype.getMaxDataLength = function () {
  return this._maxDataLength;
};

Connection.prototype.write = function (data) {
  data = Buffer.from(data);
  var len = data.length;
  // if (len > this._maxDataLength) {
  //   this.emit('error', new Error('Write data exceeds max data length: ' + this._maxDataLength));
  //   return;
  // }

  var that = this;
  this._writeBufferCache.push(data);
  this._cmdCommunication.once('wait4Data' + this._index, function () {
    that._cmdCommunication.sendRawData(that._writeBufferCache.shift(), function (error) {
      if (error) {
        that._cmdCommunication.emit('responseDone', error);
      }
    });
  });

  var sendCmd = generateSendCmd(this._index, len);
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

function generateSendCmd(index, len) {
  return Buffer.from('AT+CIPSEND=' + index + ',' + len + '\r');
};

function generateDestroyCmd(index) {
  return Buffer.from('AT+CIPCLOSE=' + index + '\r');
};

module.exports = Connection;