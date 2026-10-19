const { elapsed } = require('./clock');

const MAX_IDLE = 300; // five minutes, in seconds

function isExpired(lastActiveMs, nowMs) {
  return elapsed(lastActiveMs, nowMs) > MAX_IDLE * 1000;
}

module.exports = { isExpired };
