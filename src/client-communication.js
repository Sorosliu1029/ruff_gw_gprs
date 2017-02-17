/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');

var MAX_CONNECTION_NUM = 4;
MAX_CONNECTION_NUM = Math.min(5, MAX_CONNECTION_NUM);

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

  this._port = port;
  this._dispatcher = dispatcher;
  this._dispatcher.on('recv', this._parseRecv.bind(this));

  // this._clientRelatedCache = new Buffer(0);
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
  var splitIndex = data.indexOf(Buffer.from(':'));
  if (splitIndex === -1) return;
  var recvHead = data.slice(0, splitIndex);
  var recvBody = data.slice(splitIndex + 3);

  var tmp = recvHead.toString().match(/(\d+)/g);
  var index = Number(tmp[0]);
  var length = Number(tmp[1]);
  console.log('recv length: ', length);
  this._clientsCache[index].recvLength = length;
  this._clientsCache[index].cache = Buffer.concat([this._clientsCache[index].cache, recvBody]);
  if (this._clientsCache[index].cache.length === length) {
    this.emit('msg' + index, {
      "length": length,
      "bodyBuffer": Buffer.from(this._clientsCache[index].cache)
    });
    console.log('msg emitted');
    this._dispatcher.switchMode();
  } else {
    // TODO: concat more data to meet 'receive length'
    console.log('msgHead length: ' + length + ' not equal to msgBody length: ' + this._clientsCache[index].cache.length);
    console.log('msg body: >');
    console.log(this._clientsCache[index].cache);
  }
};

ClientCommunication.prototype._parseClientRelated = function (dataArray) {
  // this._clientRelatedCache = Buffer.concat([this._clientRelatedCache, data]);
  this.emit('client' + dataArray[0], dataArray[1]);
};

module.exports = ClientCommunication;