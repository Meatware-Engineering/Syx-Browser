// dispose() is a game reset, not a teardown: in-flight loads must be cancelled cleanly while the
// AudioContext, gesture listeners and adapter stay usable for the next session.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const activeUrls = new Set();
let urlSeq = 0;
let contexts = 0;
let closedContexts = 0;
let removedListeners = 0;
let autoMetadata = false;
const audios = [];
const decodeRequests = [];

const node = kind => ({kind, gain: {value: 1}, pan: {value: 0}, connect() {}, disconnect() {}});
class BufferSource {
  constructor() { this.buffer = null; this.playbackRate = {value: 1}; this.onended = null; this.started = false; }
  connect() {}
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class AudioContext {
  constructor() { contexts++; this.state = 'running'; this.destination = {}; }
  createGain() { return node('gain'); }
  createStereoPanner() { return node('panner'); }
  createMediaElementSource() { return node('media'); }
  createBufferSource() { return new BufferSource(); }
  decodeAudioData() { return new Promise(resolve => decodeRequests.push(resolve)); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { closedContexts++; this.state = 'closed'; return Promise.resolve(); }
}
class Audio {
  constructor() { this.paused = true; this.ended = false; this.duration = 2; this.src = ''; this.handlers = {}; audios.push(this); }
  addEventListener(name, callback) { (this.handlers[name] = this.handlers[name] || []).push(callback); }
  removeEventListener(name, callback) {
    if (this.handlers[name]) this.handlers[name] = this.handlers[name].filter(item => item !== callback);
  }
  load() { if (autoMetadata && this.src) setImmediate(() => this.fire('loadedmetadata')); }
  play() { this.paused = false; this.ended = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  fire(name) { for (const callback of [...(this.handlers[name] || [])]) callback(); }
}
const document = {
  hidden: false, visibilityState: 'visible', hasFocus: () => true,
  addEventListener() {}, removeEventListener() { removedListeners++; }
};
const window = { addEventListener() {}, removeEventListener() { removedListeners++; } };
const context = vm.createContext({
  Audio, AudioContext, Blob, Uint8Array,
  URL: {
    createObjectURL() { const url = `blob:lifecycle-${++urlSeq}`; activeUrls.add(url); return url; },
    revokeObjectURL(url) { activeUrls.delete(url); }
  },
  // The game page provides this global; the adapter's position() reads it.
  canvas: {width: 1280, height: 720},
  document, window, console: {warn() {}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
const natives = {};
const audio = vm.runInContext('installAudioNatives', context)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  // 1. Reset while a stream is still waiting for metadata. The late event must not resurrect it.
  const pendingMeta = api('load')(null, 'late-metadata', new Uint8Array([1, 2]), 1);
  await tick();
  assert.equal(audios.length, 1, 'stream load should have created a media element');
  const lateMedia = audios[0];
  assert.equal(activeUrls.size, 1);

  await api('dispose')();
  assert.equal(closedContexts, 0, 'reset must keep the AudioContext for reuse');
  assert.equal(removedListeners, 0, 'reset must keep gesture/focus listeners registered');

  autoMetadata = true;
  lateMedia.fire('loadedmetadata');
  assert.equal(await pendingMeta, 0, 'metadata arriving after reset must not produce a sound id');
  assert.equal(activeUrls.size, 0, 'cancelled stream load must release its blob URL');
  assert.equal(lateMedia.src, '', 'cancelled stream load must detach its media element');
  assert.equal(await api('isPlaying')(null, 1), false);

  // 2. The adapter is still usable through the same context after the reset.
  const afterReset = await api('load')(null, 'after-reset', new Uint8Array([3]), 1);
  assert.ok(afterReset > 0, 'load after reset must succeed');
  assert.equal(contexts, 1, 'reset must reuse the existing AudioContext');
  assert.equal(await api('playStream')(null, afterReset, true), true);
  assert.equal(await api('isPlaying')(null, afterReset), true);

  // 3. Reset while an effect decode is pending; the stale buffer must not be cached or registered.
  const pendingDecode = api('load')(null, 'late-decode', new Uint8Array([4]), 3);
  await tick();
  assert.equal(decodeRequests.length, 1);
  await api('dispose')();
  assert.equal(closedContexts, 0);
  const staleResolve = decodeRequests.shift();
  staleResolve({duration: 1.5, name: 'stale'});
  assert.equal(await pendingDecode, 0, 'decode finishing after reset must not produce a sound id');

  // 4. Effects still load, decode and play after the reset (fresh decode, not the stale buffer).
  const effectLoad = api('load')(null, 'late-decode', new Uint8Array([4]), 3);
  await tick();
  assert.equal(decodeRequests.length, 1, 'reset must not leave a half-decoded entry in the cache');
  decodeRequests.shift()({duration: 1.5, name: 'fresh'});
  const effectId = await effectLoad;
  assert.ok(effectId > 0, 'effect load after reset must succeed');
  assert.equal(await api('playEffect')(null, effectId, 0.5, 1, true, 10, 10), true, 'spatial effect must play after reset');
  assert.equal(await api('length')(null, effectId), 1.5);

  // 5. A second reset with nothing loaded is harmless.
  await api('dispose')();
  await api('dispose')();
  assert.equal(closedContexts, 0);
  assert.equal(removedListeners, 0);

  console.log('Audio reset during pending load/decode: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
