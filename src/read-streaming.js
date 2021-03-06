/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var util = require('util');
var EventEmitter = require('events');

function ReadStreaming(obj) {
  EventEmitter.call(this);
  this._read = obj.read.bind(obj);
}

util.inherits(ReadStreaming, EventEmitter);

ReadStreaming.prototype.start = function () {
  var that = this;

  setImmediate(readNext);

  function readNext() {
    that._read(function (err, data) {
      if (err) {
        that.emit('error', err);
      } else {
        that.emit('data', data);
      }
    });
  }
};

module.exports = ReadStreaming;