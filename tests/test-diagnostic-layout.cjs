const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const diagnostics = path.join(root, 'diagnostics');
const pages = fs.readdirSync(diagnostics).filter(name => name.endsWith('.html'));
assert.equal(pages.length, 29);
assert.equal(fs.readdirSync(root).filter(name => name.endsWith('-probe.html')).length, 0);
for (const name of pages) {
  const html = fs.readFileSync(path.join(diagnostics, name), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|data:|#)/.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    // Built locally by npm; deliberately not committed.
    if (clean === '../vendor/pngjs.js') continue;
    const target = clean.startsWith('/') ? path.join(root, clean) : path.resolve(diagnostics, clean);
    assert.ok(fs.existsSync(target), `${name}: missing ${ref}`);
  }
  for (const [, attrs, code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(attrs)) new vm.Script(code, {filename: name});
  }
}
const main = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(!main.includes('diagnostics/'));
console.log('Diagnostic layout: 29 pages, resource references and inline syntax: PASS');
