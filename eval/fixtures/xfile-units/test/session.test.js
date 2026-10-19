const test = require('node:test');
const assert = require('node:assert');
const { isExpired } = require('../src/session.js');

test('expired after 6 minutes idle', () => assert.strictEqual(isExpired(0, 6 * 60 * 1000), true));
test('not expired after 1 minute idle', () => assert.strictEqual(isExpired(0, 60 * 1000), false));
