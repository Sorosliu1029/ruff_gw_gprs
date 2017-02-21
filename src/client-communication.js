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

  this._clientsCache = [];
  for (var i = 0; i < 6; i++) {
    this._clientsCache.push({
      "recvLength": 0,
      "cache": new Buffer(0)
    });
  }

  this._allConnections = [];
  for (var i = 0; i < MAX_CONNECTION_NUM; i++) {
    this._allConnections.push(false);
  }

  this._currentReceiver = null;
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
  this._allConnections[index] = false;
};

ClientCommunication.prototype.setConnectionUsed = function (index) {
  this._allConnections[index] = true;
};

ClientCommunication.prototype._parseRecv = function (data) {
  console.log('recv chunk: ' + data);
  if (this._currentReceiver === null) {
    this._currentReceiverCache = Buffer.concat([this._currentReceiverCache, data]);
    var headerMatch = this._currentReceiverCache.toString().match(HEADER);
    if (headerMatch) {
      var index = Number(headerMatch[1]);
      this._currentReceiver = index;
      var length = Number(headerMatch[2]);
      this._clientsCache[index].recvLength = length;
      this._clientsCache[index].cache = this._currentReceiverCache.slice(this._currentReceiverCache.indexOf(Buffer.from(':')) + 3);
      this._currentReceiverCache = new Buffer(0);
    }
  } else {
    this._clientsCache[index].cache = Buffer.concat([this._clientsCache[index].cache, data]);
  }

  if (this._clientsCache[index].cache.length === length) {
    this.emit('msg' + index, {
      "length": length,
      "bodyBuffer": Buffer.from(this._clientsCache[index].cache)
    });
    this._clientsCache[index].cache = new Buffer(0);
    this._dispatcher.switchMode();
  } else {
    // console.log('msgHead length: ' + length + ' not equal to msgBody length: ' + this._clientsCache[index].cache.length);
    // console.log('msg body: >');
    // console.log(this._clientsCache[index].cache);
  }
};

ClientCommunication.prototype._parseClientRelated = function (dataArray) {
  this.emit('client' + dataArray[0], dataArray[1]);
};

module.exports = ClientCommunication;