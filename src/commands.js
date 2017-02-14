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
  };

  commands.powerOn = function (cb) {
    if (isPowerOn) return;
    this._powerToggle(cb);
  };

  commands.powerOff = function (cb) {
    if (!isPowerOn) return;
    this._powerToggle(cb);
  };

  commands.writeRaw = function (cmdStr, cb) {
    if (cmdStr.slice(0, 2) !== ('AT')) {
      cmdStr = 'AT' + cmdStr;
    }
    var cmd = Buffer.from(cmdStr + '\r');
    communication.pushCmd(cmd, function (error, result) {
      if (error) {
        console.log(error);
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands._cmd2do = function (cmdType, cmdStr, removeCmdHeader, cb) {
    var cmd;
    switch(cmdType) {
      case "read":
        cmd = generateReadCmd(cmdStr);
        break;
      case "write":
        cmd = generateWriteCmd(cmdStr);
        break;
      case "test":
        cmd = generateTestCmd(cmdStr);
        break;
      case "exec":
        cmd = generateExecutionCmd(cmdStr);
        break;
    }
    communication.pushCmd(cmd, function (error, result) {
      if (error) {
        console.log(error);
        cb && cb(error);
      }
      if (result[result.length - 1] !== 'OK') {
        error = new Error('response ends with error');
        cb && cb(error);
      } else {
        var resValue;
        if (removeCmdHeader) {
          var regexp = new RegExp(cmdStr.slice(1) + ': (.*)');
          resValue = result[0].match(regexp)[1];
        }
        cb && cb(null, resValue || result[0]);
      }
    });
  };

  commands.getSignalStrength = function (cb) {
    this._cmd2do('exec', '+CSQ', true, function (error, result) {
      if (error) {
        cb && cb(eeror);
      }
      var tmp = result.split(',');
      cb && cb(null, {
        "rssi": tmp[0],
        "ber": tmp[1]
      });
    });
  };

  commands.getNetStatus = function (cb) {
    this._cmd2do('read', '+CGATT', true, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result === '1');
    });
  };

  // TODO: match the API spec
  commands.getCellInfo = function (cb) {
    this._cmd2do('read', '+CREG', true, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      var tmp = result.split(',');
      cb && cb(null, {
        "n": tmp[0],
        "stat": tmp[1] === '1'
      });
    })
  };

  commands.getSimInfo = function (cb) {
    var that = this;
    this._cmd2do('exec', '+CCID', false, function (error, iccid) {
      if (error) {
        cb && cb(error);
      }
      that._cmd2do('exec', '+CIMI', false, function(error, imsi) {
        if(error) {
          cb && cb(error);
        }
        cb && cb(null, iccid, imsi);
      });
    });
  };

  commands.init = function (cb) {

  };

  commands.testAT = function (cb) {
    var cmdTestAT = generateExecutionCmd('');
    communication.pushCmd(cmdTestAT, function (error, result) {
      if (error) {
        console.log(error);
        return;
      }
      cb && cb(undefined, result);
    });
  };

  return commands;
};

function generateTestCmd(cmd) {
  return Buffer.from('AT' + cmd + '=?\r');
};

function generateReadCmd(cmd) {
  return Buffer.from('AT' + cmd + '?\r');
};

function generateWriteCmd(cmd, value) {
  return Buffer.from('AT' + cmd + '=' + value + '\r');
};

function generateExecutionCmd(cmd) {
  return Buffer.from('AT' + cmd + '\r');
};

module.exports = createCommands;