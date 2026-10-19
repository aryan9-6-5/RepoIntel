const test = require('node:test');
const assert = require('node:assert');
const { greet } = require('../src/greet.js');

test('known user', () => assert.strictEqual(greet([{ id: 1, name: 'Ann' }], 1), 'Hello Ann'));
test('unknown user gets guest greeting', () => assert.strictEqual(greet([], 2), 'Hello guest'));
