/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');

function ClientCommunication(port, dispatcher) {
  EventEmitter.call(this);

  this._clientsCache = [];
  for (var i = 0; i < 6; i++) {
    this._clientsCache.push({
      "recvLength": 0,
      "cache": new Buffer(0)
    });
  }

  this._port = port;
  this._dispatcher = dispatcher;
  this._dispatcher.on('recv', this._parseRecv.bind(this));

  this._clientRelatedCache = new Buffer(0);
  this._dispatcher.on('clientRelated', this._parseClientRelated.bind(this));
};

util.inherits(ClientCommunication, EventEmitter);

ClientCommunication.prototype._parseRecv = function (data) {
  var splitIndex = data.indexOf(Buffer.from(':'));
  if (splitIndex === -1) return;
  var recvHead = data.slice(0, splitIndex);
  var recvBody = data.slice(splitIndex + 1);

  var tmp = recvHead.toString().match(/(\d+)/g);
  var index = Number(tmp[0]);
  var length = Number(tmp[1]);
  this._clientsCache[index].recvLength = length;
  this._clientsCache[index].cache = Buffer.concat([this._clientsCache[index].cache, recvBody]);
  if (this._clientsCache[index].cache.length === length) {
    this.emit('msg' + index, {
      "length": length,
      "bodyBuffer": Buffer.from(this._clientsCache[index].cache)
    });
  } else {
    // TODO: concat more data to meet 'receive length'
    console.log('msgHead length: ' + length +' not equal to msgBody length: ' + this._clientsCache[index].cache.length);
  }
};

ClientCommunication.prototype._parseClientRelated = function (data) {
  this._clientRelatedCache = Buffer.concat([this._clientRelatedCache, data]);
  var cacheStr = this._clientRelatedCache.toString().trim();
  if (cacheStr) {
    var tmp = cacheStr.split(',');
    this.emit('client' + tmp[0].trim(), tmp[1].trim());
  }
};

module.exports = ClientCommunication;