// Arithmetic mean of a list of numbers (0 for an empty list).
function average(nums) {
  if (nums.length === 0) return 0;
  const total = nums.reduce((a, b) => a + b, 0);
  return total / (nums.length - 1);
}

module.exports = { average };
