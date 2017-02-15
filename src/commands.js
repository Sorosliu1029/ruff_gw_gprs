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

  commands._cmd2do = function (cmdType, cmdArray, removeCmdHeader, checkStatus, statusIndex, cb) {
    var cmd;
    var cmdStr = cmdArray[0];
    var writeValue = cmdArray[1];
    switch (cmdType) {
      case "read":
        cmd = generateReadCmd(cmdStr);
        break;
      case "write":
        cmd = generateWriteCmd(cmdStr, writeValue);
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
      statusIndex = statusIndex === -1 ? result.length - 1 : 0;
      if (!checkStatus) {
        cb && cb(null, result);
      } else if (!result[statusIndex].match(/OK/)) {
        error = new Error('response ends with error');
        cb && cb(error, result);
      } else {
        var resValue;
        if (removeCmdHeader) {
          var regexp = new RegExp(cmdStr.slice(1) + ': (.+)');
          resValue = result[0].match(regexp)[1];
          console.log('resValue: ', resValue);
        }
        cb && cb(null, resValue || result);
      }
    });
  };

  commands.getSignalStrength = function (cb) {
    this._cmd2do('exec', ['+CSQ'], true, true, -1, function (error, result) {
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
    this._cmd2do('read', ['+CGATT'], true, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result === '1');
    });
  };

  // TODO: match the API spec
  commands.getCellInfo = function (cb) {
    this._cmd2do('read', ['+CREG'], true, true, -1, function (error, result) {
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
    this._cmd2do('exec', ['+CCID'], false, true, -1, function (error, iccid) {
      if (error) {
        cb && cb(error);
      }
      that._cmd2do('exec', ['+CIMI'], false, true, -1, function (error, imsi) {
        if (error) {
          cb && cb(error);
        }
        cb && cb(null, iccid, imsi);
      });
    });
  };

  // value = 0 to detach gprs service
  // value = 1 to attach gprs service
  commands.setGprsAttach = function (value, cb) {
    this._cmd2do('write', ['+CGATT', value], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  // value = 0 to disable multi ip connection
  // value = 1 to enable multi ip connection
  commands.setMultiConn = function (value, cb) {
    this._cmd2do('write', ['+CIPMUX', value], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands.setApn = function (apn, user, passwd, cb) {
    var writeValue = '"' + apn + '","' + user + '","' + passwd + '"';
    this._cmd2do('write', ['+CSTT', writeValue], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands.bringUpConn = function (cb) {
    this._cmd2do('exec', ['+CIICR'], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands.init = function (cb) {
    var that = this;
    this.setGprsAttach(1, function (error, result) {
      if (error || result[0] !== 'OK') {
        console.log('set gprs attach result: |', result);
        cb && cb(error ? error : new Error('set GPRS attach error'));
      }
      that.setMultiConn(1, function (error, result) {
        if (error || result[0] !== 'OK') {
          cb && cb(error ? error : new Error('set multi connection error'));
        }
        that.setApn('CMNET', '', '', function (error, result) {
          if (error || result[0] !== 'OK') {
            cb && cb(error ? error : new Error('set APN error'));
          }
          that.bringUpConn(function (error, result) {
            if (error || result[0] !== 'OK') {
              cb && cb(error ? error : new Error('bring up connection error'));
            }
            that.getIP(function (error, result) {
              if (error) {
                cb && cb(error);
              }
              communication.emit('up');
              cb && cb(null, result);
            });
          });
        });
      });
    });
  };

  commands.shutIp = function (cb) {
    this._cmd2do('exec', ['+CIPSHUT'], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      communication.emit('down');
      cb && cb(null, result);
    });
  };

  commands.deInit = function (cb) {
    this.shutIp(function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands.getIP = function (cb) {
    this._cmd2do('exec', ['+CIFSR'], false, false, null, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      cb && cb(null, result);
    });
  };

  commands.getConnections = function (cb) {
    this._cmd2do('exec', ['+CIPSTATUS'], false, true, 0, function (error, result) {
      if (error) {
        cb && cb(error);
      }
      var code = result[0];
      var ipState = result[1];
      var connections = [];
      result[2].split('\r\n').filter(function (conn) {
        // last splited result would be ''
        return !!conn;
      }).forEach(function (conn) {
        var connArray = conn.split(',');
        var connObj = new Object(null);
        connObj.id = Number(connArray[0].slice(2));
        connObj.ip = connArray[3].replace('"', '');
        connObj.port = connArray[4].replace('"', '');
        connObj.status = connArray[5].replace('"', '');
        connections.push(connObj);
      });
      cb && cb(null, connections);
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