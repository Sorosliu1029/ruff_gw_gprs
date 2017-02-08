/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var driver = require('ruff-driver');
var Communication = require('./communication');

module.exports = driver({

    attach: function (inputs, context) {
        this._uart = inputs['uart'];
        this._communication = new Communication(this._uart);
    },

    exports: {
        write: function () {
            this._communication.sendRawData.apply(this._communication, arguments);
        }
    }
});