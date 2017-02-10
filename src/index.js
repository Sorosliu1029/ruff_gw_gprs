/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var driver = require('ruff-driver');
var gpio = require('gpio');
var Communication = require('./communication');
var createCommands = require('./commands');

module.exports = driver({

    attach: function (inputs, context) {
        this._uart = inputs['uart'];
        this._communication = new Communication(this._uart);
        this._commands = createCommands(this._communication);
        var that = this;
        Object.keys(this._commands).forEach(function (key) {
            that[key] = that._commands[key].bind(that._commands);
        })
    },

    exports: {
        write: function () {
            this._communication.sendRawData.apply(this._communication, arguments);
        },
        powerUp: function (cb) {
            $('#PWR_GPRS').setDirection(gpio.Direction.out);
            $('#PWR_GPRS').write(gpio.Level.low, function () {
                setTimeout(function () {
                    $('#PWR_GPRS').write(gpio.Level.high, function () {
                        cb && cb();
                    });
                }, 1100);
            });
        }

    }
});