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

  // this._clientsCache = [];
  // for (var i = 0; i < 6; i++) {
  //   this._clientsCache.push({
  //     "recvLength": 0,
  //     "cache": new Buffer(0)
  //   });
  // }


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
  // TODO: try to destruct older connection 
  // this._allConnections[index] = undefined;
  delete this._allConnections[index];
};

ClientCommunication.prototype.setConnectionUsed = function (index, connection) {
  this._allConnections[index] = connection;
};

ClientCommunication.prototype._emitRecv = function (index, data) {
  console.log('emit index: ' + index + ' data length: ' + data.length + ' receiver length: ' + this._currentReceiverLength);
  if (data.length === 2) {
    console.log(data);
    // this._dispatcher.switchMode();
    // this._currentReceiver = null;
    // this._currentReceiverLength = 0;
    // return;
  }
  if (data.length >= this._currentReceiverLength) {
    this.emit('msg' + index, data.slice(0, this._currentReceiverLength));
    this._dispatcher.switchMode();
    this._currentReceiver = null;
    var remain = data.slice(this._currentReceiverLength);
    this._currentReceiverLength = 0;
    if (remain.length) {
      this._dispatcher.emit('data', remain);
    }
  } else {
    this.emit('msg' + index, data);
    this._currentReceiverLength -= data.length;
  }
}

ClientCommunication.prototype._parseRecv = function (data) {
  // console.log('recv chunk: <' + data + '>');
  console.log('recv chunk length: ' + data.length);
  var index;
  var length;
  if (this._currentReceiver === null) {
    this._currentReceiverCache = Buffer.concat([this._currentReceiverCache, data]);
    var headerMatch = this._currentReceiverCache.toString().match(HEADER);
    if (headerMatch) {
      index = Number(headerMatch[1]);
      this._currentReceiver = index;
      length = Number(headerMatch[2]);
      this._currentReceiverLength = length;

      data = this._currentReceiverCache.slice(this._currentReceiverCache.indexOf(Buffer.from(':')) + 3)
      // console.log('remove head data: <' + data + '>');
      this._emitRecv(index, data);
      this._currentReceiverCache = new Buffer(0);
    } else {
      return;
    }
  } else {
    index = this._currentReceiver;
    this._emitRecv(index, data);
  }

  // length = this._clientsCache[index].recvLength;
  // console.log('cache length: ' + this._clientsCache[index].cache.length + ' receive length: ' + length);
  // if (this._clientsCache[index].cache.length >= length) {
  //   this.emit('msg' + index, {
  //     "length": length,
  //     "bodyBuffer": this._clientsCache[index].cache.slice(0, length)
  //   });
  //   this._dispatcher.switchMode();
  //   this._currentReceiver = null;
  //   var remain = this._clientsCache[index].cache.slice(length);
  //   this._clientsCache[index].cache = new Buffer(0);
  //   if (remain.length) {
  //     this._dispatcher.emit('data', remain);
  //   }
  // } else {
  //   console.log('msgHead length: ' + length + ' not equal to msgBody length: ' + this._clientsCache[index].cache.length);
  //   console.log('msg body: >');
  //   console.log(this._clientsCache[index].cache);
  // }
};

ClientCommunication.prototype._parseClientRelated = function (dataArray) {
  this.emit('client' + dataArray[0], dataArray[1]);
};

module.exports = ClientCommunication;