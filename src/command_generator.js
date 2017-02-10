/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

function generateCmd(cmd) {
  return Buffer.from(cmd + '\r');
}

module.exports = generateCmd;