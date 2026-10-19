const test = require('node:test');
const assert = require('node:assert');
const { isEven } = require('../src/even.js');

test('even', () => assert.strictEqual(isEven(4), true));
test('odd', () => assert.strictEqual(isEven(3), false));
test('non-integer', () => assert.strictEqual(isEven(2.5), false));
