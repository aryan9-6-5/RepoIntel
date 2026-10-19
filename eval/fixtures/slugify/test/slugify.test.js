const test = require('node:test');
const assert = require('node:assert');
const { slugify } = require('../src/slugify.js');

test('basic', () => assert.strictEqual(slugify('Hello World'), 'hello-world'));
test('strips trailing punctuation', () => assert.strictEqual(slugify('Hello World!'), 'hello-world'));
