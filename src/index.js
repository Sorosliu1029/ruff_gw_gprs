/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var driver = require('ruff-driver');
var Communication = require('./communication');
var createCommands = require('./commands');

module.exports = driver({

    attach: function (inputs, context) {
        this._uart = inputs['uart'];
        this._communication = new Communication(this._uart);
        this._commands = createCommands(this._communication);
        var that = this;
        this._communication.on('ready', function () {
            that.emit('ready');
        });
        this._communication.on('end', function () {
            that.emit('end');
        })
        Object.keys(this._commands).forEach(function (key) {
            that[key] = that._commands[key].bind(that._commands);
        });
    },

    exports: {

    }
});