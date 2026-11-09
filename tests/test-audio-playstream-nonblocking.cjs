// Safari can leave HTMLMediaElement.play() pending for many seconds after audio is already audible.
// A native call must never wait on it: playStream accepts the request immediately, isPlaying stays
// authoritative, and blocked/cancelled attempts remain retryable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = process.env.AUDIO_JS || path.join(__dirname, '../audio.js');
const pending = [];
let playCalls = 0;

class Audio {
  constructor() { this.paused = true; this.ended = false; this.duration = 2; this.currentTime = 0; this.volume = 1; this.src = ''; this.handlers = {}; this.pauseCount = 0; }
  addEventListener(name, callback) { (this.handlers[name] = this.handlers[name] || []).push(callback); }
  removeEventListener() {}
  load() { if (this.src) setImmediate(() => this.fire('loadedmetadata')); }
  play() {
    playCalls++;
    const media = this;
    // Deliberately never settled until the test says so, and paused stays true until then.
    const pauseCount = media.pauseCount;
    return new Promise((resolve, reject) => pending.push({
      // A pause() issued after play() wins, as in a real element: the late resolution is a no-op.
      resolve: () => { if (media.pauseCount === pauseCount) { media.paused = false; media.ended = false; } resolve(); },
      reject: error => { if (media.pauseCount === pauseCount) media.paused = true; reject(error); }
    }));
  }
  pause() { this.pauseCount++; this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  fire(name) { for (const callback of [...(this.handlers[name] || [])]) callback(); }
}
const node = () => ({gain: {value: 1}, pan: {value: 0}, connect() {}, disconnect() {}});
class AudioContext {
  constructor() { this.state = 'running'; this.destination = {}; }
  createGain() { return node(); }
  createMediaElementSource() { return node(); }
  createStereoPanner() { return node(); }
  createBufferSource() { return {buffer: null, playbackRate: {value: 1}, connect() {}, disconnect() {}, start() {}, stop() {}}; }
  decodeAudioData() { return Promise.resolve({duration: 1}); }
  resume() { return Promise.resolve(); }
}
const context = vm.createContext({
  Audio, AudioContext, Blob, Uint8Array,
  URL: {createObjectURL: () => 'blob:nonblocking', revokeObjectURL() {}},
  canvas: {width: 1280, height: 720},
  document: {hidden: false, hasFocus: () => true, addEventListener() {}},
  window: {addEventListener() {}},
  console: {warn() {}}
});
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context);
const natives = {};
const audio = vm.runInContext('installAudioNatives', context)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
const blocked = () => Object.assign(new Error('blocked'), {name: 'NotAllowedError'});
const tick = () => new Promise(resolve => setImmediate(resolve));

// Resolve/reject a native call, failing instead of hanging if it awaits media.play().
async function fast(label, promise, budget = 150) {
  const result = await Promise.race([
    Promise.resolve(promise).then(value => ({value}), error => ({error})),
    new Promise(resolve => setTimeout(() => resolve({timeout: true}), budget))
  ]);
  assert.ok(!result.timeout, `${label} must not await HTMLMediaElement.play() (Safari can leave it pending)`);
  if (result.error) throw result.error;
  return result.value;
}

(async () => {
  // 1. Unresolved play(): the native call returns at once, and reports the request as accepted.
  const id = await api('load')(null, 'stalled', new Uint8Array([1]), 1);
  assert.ok(id > 0);
  const started = Date.now();
  assert.equal(await fast('playStream with unresolved play()', api('playStream')(null, id, true)), true);
  assert.ok(Date.now() - started < 150);
  assert.equal(playCalls, 1, 'one media.play() attempt is issued');
  assert.equal(await fast('isPlaying', api('isPlaying')(null, id)), false, 'isPlaying reports actual state, not the request');

  // 2. Repeated requests while the first play() is still pending must not stack play() calls.
  assert.equal(await fast('duplicate playStream', api('playStream')(null, id, true)), true);
  assert.equal(playCalls, 1, 'a pending attempt is deduplicated');

  // 3. When Safari finally settles play(), the sound is reported playing.
  pending.shift().resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, id), true);

  // 4. Stop while pending: the native call still returns, and a late resolution cannot revive it.
  const stopped = await api('load')(null, 'stopped', new Uint8Array([2]), 1);
  assert.equal(await fast('playStream before stop', api('playStream')(null, stopped, true)), true);
  const late = pending.shift();
  await api('stopStream')(null, stopped);
  late.resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, stopped), false, 'late play() resolution must not resurrect a stopped sound');

  // 5. A stopped sound stays retryable: the next request issues a fresh play() attempt.
  const before = playCalls;
  assert.equal(await fast('retry after stop', api('playStream')(null, stopped, true)), true);
  assert.equal(playCalls, before + 1, 'a cancelled attempt must not latch playPromise');
  pending.shift().resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, stopped), true);

  // 6. Autoplay denial is retried by the next gesture without blocking the native call.
  const retried = await api('load')(null, 'blocked', new Uint8Array([3]), 1);
  assert.equal(await fast('playStream blocked', api('playStream')(null, retried, true)), true);
  pending.shift().reject(blocked());
  await tick();
  assert.equal(await api('isPlaying')(null, retried), false);
  audio.resume();
  assert.equal(pending.length, 1, 'gesture resume must retry the denied sound');
  pending.shift().resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, retried), true);

  // 7. Reset while play() is pending: no throw, no zombie playback, adapter still usable.
  const doomed = await api('load')(null, 'doomed', new Uint8Array([4]), 1);
  assert.equal(await fast('playStream before dispose', api('playStream')(null, doomed, true)), true);
  const zombie = pending.shift();
  await api('dispose')();
  zombie.resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, doomed), false);
  const afterReset = await api('load')(null, 'after-reset', new Uint8Array([5]), 1);
  assert.ok(afterReset > 0, 'adapter must stay usable after a reset');
  assert.equal(await fast('playStream after reset', api('playStream')(null, afterReset, true)), true);
  pending.shift().resolve();
  await tick();
  assert.equal(await api('isPlaying')(null, afterReset), true);

  console.log('Nonblocking playStream with unresolved play(): PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
