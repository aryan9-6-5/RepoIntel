const test = require('node:test');
const assert = require('node:assert');
const { sumRange } = require('../src/sum.js');

test('sums 1..4 inclusive', () => assert.strictEqual(sumRange(1, 4), 10));
test('single value', () => assert.strictEqual(sumRange(5, 5), 5));
