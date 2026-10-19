// Price after a percentage discount. ratePercent is 0-100.
function applyDiscount(price, ratePercent) {
  return price * (1 - ratePercent / 100);
}

module.exports = { applyDiscount };
