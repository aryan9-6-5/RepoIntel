const { applyDiscount } = require('./pricing');

function total(price, ratePercent) {
  return applyDiscount(ratePercent, price);
}

module.exports = { total };
