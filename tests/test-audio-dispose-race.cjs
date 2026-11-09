const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const media = [], urls = new Set(), decoding = [];
let connected = 0;
class Audio {
  constructor() { this.paused = true; this.duration = 1; media.push(this); }
  addEventListener(name, callback) { this[name] = callback; }
  load() {}
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
}
const node = () => ({ gain: { value: 0 }, connect() {}, disconnect() {} });
class AudioContext {
  createGain() { return node(); }
  createMediaElementSource() { connected++; return node(); }
  decodeAudioData() { return new Promise(resolve => decoding.push(resolve)); }
}
const context = vm.createContext({ Audio, AudioContext, Blob, Uint8Array,
  URL: { createObjectURL() { const u = 'blob:' + media.length; urls.add(u); return u; }, revokeObjectURL(u) { urls.delete(u); } },
  document: { addEventListener() {} }, window: { addEventListener() {} }, console: { warn() {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
const natives = {};
vm.runInContext('installAudioNatives', context)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
(async () => {
  const loading = api('load')(null, 'stream.wav', new Uint8Array([1]), 2);
  let settled = false;
  loading.then(() => { settled = true; });
  await api('dispose')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, true, 'dispose must unblock a metadata load even if no media event arrives');
  media[0].loadedmetadata();
  assert.equal(await loading, 0, 'dispose must cancel an outstanding metadata load');
  assert.equal(connected, 0, 'a disposed load must not connect a media source');
  assert.equal(urls.size, 0, 'a disposed load must release its object URL');
  assert.equal(media[0].src, '', 'a disposed load must release the media resource');
  const effect = api('load')(null, 'effect.wav', new Uint8Array([1]), 3);
  await api('dispose')();
  decoding.shift()({duration: 1});
  assert.equal(await effect, 0, 'dispose must cancel an outstanding decode');
  const fresh = api('load')(null, 'fresh.wav', new Uint8Array([1]), 2);
  media[1].loadedmetadata();
  assert.ok(await fresh, 'the adapter must remain usable after dispose');
  await api('dispose')();
  assert.equal(urls.size, 0);
  console.log('Audio disposal during metadata and decode: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
