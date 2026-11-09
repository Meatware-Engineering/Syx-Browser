const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'language.js'), 'utf8');
function properties(value, fails = false) {
  const localStorage = { getItem() { if (fails) throw Error('blocked'); return value; } };
  return Array.from(vm.runInNewContext(source + '\nbrowserLanguageProperties()', { localStorage }));
}
assert.deepEqual(properties(null), []);
assert.deepEqual(properties('ru'), ['syx.browser.language=ru']);
assert.deepEqual(properties('en'), ['syx.browser.language=']);
assert.deepEqual(properties('invalid'), []);
assert.deepEqual(properties(null, true), []);
console.log('Language preference tests: PASS');
