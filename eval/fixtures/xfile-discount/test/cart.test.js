const test = require('node:test');
const assert = require('node:assert');
const { total } = require('../src/cart.js');

test('10% off 200 is 180', () => assert.strictEqual(total(200, 10), 180));
