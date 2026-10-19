const test = require('node:test');
const assert = require('node:assert');
const { nextAfter } = require('../src/pick.js');

test('next after b is c', () => assert.strictEqual(nextAfter(['a', 'b', 'c', 'd'], 'b'), 'c'));
