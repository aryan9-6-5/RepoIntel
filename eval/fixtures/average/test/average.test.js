const test = require('node:test');
const assert = require('node:assert');
const { average } = require('../src/average.js');

test('mean of 2,4,6 is 4', () => assert.strictEqual(average([2, 4, 6]), 4));
test('empty list is 0', () => assert.strictEqual(average([]), 0));
