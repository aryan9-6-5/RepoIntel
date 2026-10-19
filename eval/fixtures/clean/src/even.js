// True when n is an even integer.
function isEven(n) {
  return Number.isInteger(n) && n % 2 === 0;
}

module.exports = { isEven };
