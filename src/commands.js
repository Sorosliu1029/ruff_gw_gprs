/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var gpio = require('gpio');
var series = require('ruff-async').series;
var Connection = require('./connection');

var isPowerOn = false;

function createCommands(dispatcher, cmdCommunication, clientCommunication) {
  var commands = Object.create(null);

  commands.writeRaw = function (cmdStr, cb) {
    console.log('cmd str: ' + cmdStr);
    var cmd = Buffer.from(cmdStr + '\r');
    cmdCommunication.pushCmd(cmd, function (error, result) {
      if (error) {
        console.log(error);
        cb && cb(error);
        return;
      }
      cb && cb(null, result);
    });
  };

  commands._cmd2do = function (cmdType, cmdArray, removeCmdHeader, checkStatus, statusIndex, cb) {
    var cmd;
    var cmdStr = cmdArray[0];
    var writeValue = cmdArray.slice(1).join(',');
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
    cmdCommunication.pushCmd(cmd, function (error, result) {
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

  commands.powerOn = function () {
    if (isPowerOn) return;

    var that = this;
    $('#PWR_GPRS').setDirection(gpio.Direction.out);
    $('#PWR_GPRS').write(gpio.Level.low, function (error1) {
      setTimeout(function () {
        $('#PWR_GPRS').write(gpio.Level.high, function (error2) {
          setTimeout(function () {
            that.writeRaw('AT', function (error, result) {
              if (error) {
                console.log(error);
                return;
              }
              if (result[0] === 'OK') {
                dispatcher.on('powerOnReady', function () {
                  isPowerOn = !isPowerOn;
                  series([
                    function (next) {
                      that.setMultiConn(1, function (error, result) {
                        next(error, result);
                      });
                    },
                    function (next) {
                      that.setNetworkRegistration(2, function (error, result) {
                        next(error, result);
                      });
                    }
                  ], function (error, values) {
                    if (error) {
                      console.log(error);
                      return;
                    }
                    if (values[0] === 'OK' && values[1] === 'OK') {
                      cmdCommunication.emit('ready');
                      isPowerOn = !isPowerOn;
                    }
                  });
                });
              }
            });
          }, 4000);
        });
        // 1s (a little more) to power gprs up / down
      }, 1100);
    });
  };

  commands.powerOff = function () {
    if (!isPowerOn) return;
    this._cmd2do('write', ['+CPOWD', '1'], false, false, null, function (error, result) {
      if (error) {
        console.log(error);
        return;
      }
      if (result[0] === 'NORMAL POWER DOWN') {
        cmdCommunication.emit('end');
        isPowerOn = !isPowerOn;
      }
    });
  };

  commands.getSignalStrength = function (cb) {
    this._cmd2do('exec', ['+CSQ'], true, true, -1, function (error, result) {
      if (error) {
        cb && cb(eeror);
        return;
      }
      var tmp = result.split(',');
      cb && cb(null, tmp[0]);
    });
  };

  commands.getNetStatus = function (cb) {
    this._cmd2do('read', ['+CGATT'], true, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result === '1');
    });
  };

  commands.getCellInfo = function (cb) {
    this._cmd2do('read', ['+CREG'], true, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      var tmp = result.split(',');
      cb && cb(null, tmp[2], tmp[3]);
    });
  };

  commands.getSimInfo = function (cb) {
    var that = this;
    series([
      function (next) {
        that._cmd2do('exec', ['+CCID'], false, true, -1, function (error, result) {
          next(error, result[0]);
        });
      },
      function (next) {
        that._cmd2do('exec', ['+CIMI'], false, true, -1, function (error, result) {
          next(error, result[0]);
        });
      }
    ], function (error, values) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, values[0], values[1]);
    });
  };

  // value = 0 to disable multi ip connection
  // value = 1 to enable multi ip connection
  commands.setMultiConn = function (value, cb) {
    this._cmd2do('write', ['+CIPMUX', value], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.setNetworkRegistration = function (value, cb) {
    this._cmd2do('write', ['+CREG', value], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  // value = 0 to detach gprs service
  // value = 1 to attach gprs service
  commands.setGprsAttach = function (value, cb) {
    this._cmd2do('write', ['+CGATT', value], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.setApn = function (apn, user, passwd, cb) {
    var writeValue = '"' + apn + '","' + user + '","' + passwd + '"';
    this._cmd2do('write', ['+CSTT', writeValue], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.bringUpConnection = function (cb) {
    this._cmd2do('exec', ['+CIICR'], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.getIP = function (cb) {
    this._cmd2do('exec', ['+CIFSR'], false, false, null, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.init = function (apn) {
    var that = this;
    series([
      function (next) {
        that.setGprsAttach(1, function (error, result) {
          next(error, result);
        });
      },
      function (next) {
        that.setApn(apn, '', '', function(error, result) {
          next(error, result);
        });
      },
      function (next) {
        that.bringUpConnection(function (error, result) {
          next(error, result);
        });
      },
      function (next) {
        that.getIP(function (error, result) {
          next(error, result);
        });
      }
    ], function (error, values) {
      if (error) {
        cmdCommunication.emit('error', error);
        return;
      }
      console.log('network init values: ' + values);
      cmdCommunication.emit('up', values[values.length-1]);
    });
  };

  commands.shutIp = function (cb) {
    this._cmd2do('exec', ['+CIPSHUT'], false, true, -1, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      cb && cb(null, result[0]);
    });
  };

  commands.deInit = function () {
    this.shutIp(function (error, result) {
      if (error) {
        cmdCommunication.emit('error', error);
        return;
      }
      if (result === 'SHUT OK') {
        cmdCommunication.emit('down');
      }
    });
  };

  commands.getConnections = function (cb) {
    this._cmd2do('exec', ['+CIPSTATUS'], false, true, 0, function (error, result) {
      if (error) {
        cb && cb(error);
        return;
      }
      var code = result[0];
      var ipState = result[1];
      console.log('ip state: ' + ipState);
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

  commands.createConnection = function (host, port) {
    var conn;
    var unusedConnectionIndex = clientCommunication.getUnusedConnections();
    console.log('unused connection index: ' + unusedConnectionIndex);
    if (unusedConnectionIndex !== -1) {
      conn = new Connection(cmdCommunication, clientCommunication, unusedConnectionIndex, host, port);
      clientCommunication.setConnectionUsed(unusedConnectionIndex);
      return conn;
    } else {
      cmdCommunication.emit('error', new Error('no unused connection left'));
    }
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