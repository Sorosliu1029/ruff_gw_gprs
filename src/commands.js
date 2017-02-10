/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';
var generateCmd = require('./command_generator');

function createCommands(communication) {
  var commands = Object.create(null);

  commands.testAT = function (cb) {
    var cmdBuffer = generateCmd('AT');

    communication.pushCmd({
      requestData: cmdBuffer,
      responseTimeout: 1000,
      parseResponse: basicParseResponseWithData.bind(undefined)
    }, function (error, result) {
      if (error) {
        console.log(error);
        return;
      }
      cb && cb(undefined, result);
    });
  };

  return commands;
}

// rawData is directly from UART receiver
function basicParseResponseWithData(rawData) {
  var res = rawData.toString('ascii');
  console.log(res);
  // TODO 
  return res;
}

module.exports = createCommands;