'use strict';

var driver = require('ruff-driver');

module.exports = driver({

    attach: function (inputs, context) {
        this._uart = inputs['uart'];
        this._initUart();
        this.on('uartData', function(rawData) {
            console.log('uart raw data: ', rawData);
        })
    },

    exports: {
        _initUart: function () {
            var that = this;

            function readNext() {
                that._uart.read(function (err, data) {
                    if (err) {
                        console.log('read error');
                        return;
                    }
                    that.emit('uartData', data.toString('ascii'));
                    process.nextTick(readNext);
                });
            }
            readNext();
        },

        _writeRawCmd: function (cmd) {
            this._uart.write(cmd, function(err) {
                if (err) {
                    console.log('uart write error: ', err);
                }
                console.log('uart write data succeed');
            });
        }
    }

});