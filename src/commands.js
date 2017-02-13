/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var gpio = require('gpio');

var isPowerOn = false;

function createCommands(communication) {
  var commands = Object.create(null);

  commands._powerToggle = function (cb) {
    $('#PWR_GPRS').setDirection(gpio.Direction.out);
    $('#PWR_GPRS').write(gpio.Level.low, function (error1) {
      setTimeout(function () {
        $('#PWR_GPRS').write(gpio.Level.high, function (error2) {
          // wait for a short time to make power stable
          isPowerOn = !isPowerOn;
          setTimeout(function () {
            communication.emit(isPowerOn ? 'ready' : 'end');
            cb && cb(error2 || error1);
          }, 2500);
        });
        // 1s (a little more) to power gprs up / down
      }, 1100);
    });
  }

  commands.powerOn = function (cb) {
    if (isPowerOn) return;
    this._powerToggle(cb);
  };

  commands.powerOff = function (cb) {
    if (!isPowerOn) return;
    this._powerToggle(cb);
  };

  commands.init = function (cb) {
    var cmdGetServiceStatus = generateCmd('+CGATT?');
    communication.pushCmd(cmdGetServiceStatus, function (error, result) {
      if (error) {
        console.log(error);
        return;
      }
      if (result[result.length - 1] !== 'OK') {
        error = new Error('response ends with error');
        cb && cb(error);
      } else if (result[result.length - 1] === 'OK') {
        cb && cb(undefined, result);
      }
    });
  }

  commands.testAT = function (cb) {
    var cmdTestAT = generateCmd('');
    communication.pushCmd(cmdBuffer, function (error, result) {
      if (error) {
        console.log(error);
        return;
      }
      cb && cb(undefined, result);
    });
  };

  return commands;
}

function generateCmd(cmd) {
  return Buffer.from('AT' + cmd + '\r');
}

module.exports = createCommands;