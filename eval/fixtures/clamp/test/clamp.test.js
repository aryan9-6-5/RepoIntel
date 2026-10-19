const test = require('node:test');
const assert = require('node:assert');
const { clamp } = require('../src/clamp.js');

test('below min returns min', () => assert.strictEqual(clamp(-5, 0, 10), 0));
test('above max returns max', () => assert.strictEqual(clamp(15, 0, 10), 10));
test('inside range unchanged', () => assert.strictEqual(clamp(5, 0, 10), 5));
