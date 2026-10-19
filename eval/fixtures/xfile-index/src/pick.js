const { positionOf } = require('./lookup');

function nextAfter(list, item) {
  const i = positionOf(list, item);
  return list[i + 1];
}

module.exports = { nextAfter };
