const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const active = new Set();
let next = 0;
const media = [];
class Audio {
  constructor() { media.push(this); }
  addEventListener(name, callback) { this[name] = callback; }
  load() { if (this.src) this.error(); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}
class AudioContext {
  createGain() { return {gain: {value: 0}, connect() {}}; }
}
const context = vm.createContext({
  Audio, AudioContext, Blob, Uint8Array,
  URL: {createObjectURL: () => { const url = `blob:test-${++next}`; active.add(url); return url; },
    revokeObjectURL: url => active.delete(url)},
  document: {addEventListener() {}}, window: {addEventListener() {}},
  console: {warn() {}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
const natives = {};
vm.runInContext('installAudioNatives', context)(natives);
(async () => {
  for (let i = 0; i < 3; i++) {
    assert.equal(await natives.Java_syx_browser_BrowserAudio_load(null, 'broken', new Uint8Array([1]), 1), 0);
    assert.equal(active.size, 0, 'failed stream load must release its temporary URL');
    assert.equal(media[i].src, '', 'failed stream load must release its media resource');
    assert.equal(media[i].paused, true);
  }
  console.log('Failed audio load cleanup: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
