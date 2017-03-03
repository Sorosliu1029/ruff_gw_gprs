/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');

var MAX_CONNECTION_NUM = 4;
MAX_CONNECTION_NUM = Math.min(5, MAX_CONNECTION_NUM);
var HEADER = new RegExp(/\+RECEIVE,(\d+),(\d+)\:\r\n/);

function ClientCommunication(port, dispatcher) {
  EventEmitter.call(this);

  this._allConnections = [];
  for (var i = 0; i < MAX_CONNECTION_NUM; i++) {
    this._allConnections.push(undefined);
  }

  this._currentReceiver = null;
  this._currentReceiverLength = 0;
  this._currentReceiverCache = new Buffer(0);

  this._port = port;
  this._dispatcher = dispatcher;
  this._dispatcher.on('recv', this._parseRecv.bind(this));
  this._dispatcher.on('clientRelated', this._parseClientRelated.bind(this));
};

util.inherits(ClientCommunication, EventEmitter);

ClientCommunication.prototype.getUnusedConnections = function () {
  for (var i = 0; i < MAX_CONNECTION_NUM; i++) {
    if (!this._allConnections[i]) {
      return i;
    }
  }
  return -1;
};

ClientCommunication.prototype.setConnectionUnused = function (index) {
  delete this._allConnections[index];
};

ClientCommunication.prototype.setConnectionUsed = function (index, connection) {
  this._allConnections[index] = connection;
};

ClientCommunication.prototype._emitRecv = function (index, data) {
  console.log('emit index: ' + index + ' data length: ' + data.length + ' receiver length: ' + this._currentReceiverLength);
  if (data.length < this._currentReceiverLength) {
    this.emit('msg' + index, data);
    this._currentReceiverLength -= data.length;
  } else {
    this.emit('msg' + index, Buffer.from(data.slice(0, this._currentReceiverLength)));
    this._dispatcher.switchMode();
    this._currentReceiver = null;
    var remain = Buffer.from(data.slice(this._currentReceiverLength));
    this._currentReceiverLength = 0;
    if (remain.length) {
      this._dispatcher.emit('data', remain);
    }
  }
};

ClientCommunication.prototype._parseRecv = function (data) {
  if (this._currentReceiver === null) {
    this._currentReceiverCache = Buffer.concat([this._currentReceiverCache, data]);
    var headerMatch = this._currentReceiverCache.toString().match(HEADER);
    if (headerMatch) {
      this._currentReceiver = Number(headerMatch[1]);
      this._currentReceiverLength = Number(headerMatch[2]);

      data = this._currentReceiverCache.slice(this._currentReceiverCache.indexOf(Buffer.from(':')) + 3)
      this._emitRecv(this._currentReceiver, Buffer.from(data));
      this._currentReceiverCache = new Buffer(0);
    } else {
      return;
    }
  } else {
    this._emitRecv(this._currentReceiver, data);
  }
};

ClientCommunication.prototype._parseClientRelated = function (dataArray) {
  this.emit('client' + dataArray[0], dataArray[1]);
};

module.exports = ClientCommunication;