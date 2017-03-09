/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var driver = require('ruff-driver');
var Dispatcher = require('./dispatcher');
var CmdCommunication = require('./cmd-communication');
var ClientCommunication = require('./client-communication');
var createCommands = require('./commands');

module.exports = driver({

    attach: function (inputs, context) {
        this._uart = inputs['uart'];
        this._dispatcher = new Dispatcher(this._uart);
        this._cmdCommunication = new CmdCommunication(this._uart, this._dispatcher);
        this._clientCommunication = new ClientCommunication(this._uart, this._dispatcher);
        this._commands = createCommands(this._dispatcher, this._cmdCommunication, this._clientCommunication);

        var that = this;
        Object.keys(this._commands).forEach(function (key) {
            that[key] = that._commands[key].bind(that._commands);
        });
        
        this._cmdCommunication.on('ready', function () {
            that.emit('ready');
        });
        this._cmdCommunication.on('end', function () {
            that.emit('end');
        });
        this._cmdCommunication.on('up', function(localIP) {
            that.emit('up', localIP);
        });
        this._cmdCommunication.on('down', function () {
            that.emit('down');
        });
        this._cmdCommunication.on('error', function (error) {
            that.emit('error', error);
        });
        this._dispatcher.on('error', function(error) {
            that.emit('error', error);
        });
    }
});