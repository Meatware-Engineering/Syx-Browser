const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pending = [];
class Audio {
  constructor() { this.paused = true; this.duration = 1; }
  addEventListener(name, callback) { this[name] = callback; }
  load() { if (this.src) this.loadedmetadata(); }
  play() { return new Promise((resolve, reject) => pending.push({resolve, reject})); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
}
const node = () => ({gain: {value: 0}, connect() {}, disconnect() {}});
class AudioContext {
  createGain() { return node(); }
  createMediaElementSource() { return node(); }
}
const context = vm.createContext({Audio, AudioContext, Blob, Uint8Array,
  URL: {createObjectURL: () => 'blob:test', revokeObjectURL() {}},
  document: {addEventListener() {}}, window: {addEventListener() {}},
  console: {warn() {}}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
const natives = {};
const audio = vm.runInContext('installAudioNatives', context)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
const blocked = () => Object.assign(new Error('blocked'), {name: 'NotAllowedError'});
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const id = await api('load')(null, 'music', new Uint8Array([1]), 1);
  let play = api('playStream')(null, id, true);
  pending.shift().reject(blocked());
  assert.equal(await play, true);
  await tick();
  audio.resume();
  pending.shift().reject(blocked());
  await tick();
  audio.resume();
  assert.equal(pending.length, 1, 'a rejected gesture must leave the sound eligible for another gesture');
  pending.shift().resolve();
  await tick();
  play = api('playStream')(null, id, true);
  const delayed = pending.shift();
  await api('stopStream')(null, id);
  delayed.reject(blocked());
  assert.equal(await play, true);
  await tick();
  audio.resume();
  assert.equal(pending.length, 0, 'a late rejection must not revive a stopped sound');
  for (const stop of ['stopAll', 'dispose']) {
    const nextId = await api('load')(null, stop, new Uint8Array([1]), 1);
    play = api('playStream')(null, nextId, true);
    const interrupted = pending.shift();
    await api(stop)();
    interrupted.reject(blocked());
    assert.equal(await play, true);
  await tick();
    audio.resume();
    assert.equal(pending.length, 0, `${stop} must cancel pending playback`);
  }
  console.log('Audio retry and cancellation: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
