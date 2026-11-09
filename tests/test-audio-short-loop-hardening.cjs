// Independent regressions for the bounded hardening in audio-short-loops.js:
//  - source.start() throwing must leave the record retryable (not "playing" forever)
//  - a saved offset at/after the buffer end must restart at 0 (HTMLMediaElement.play() parity)
//  - setStreamLoop() must not make a native call wait for a pending decode
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const audios = [], sources = [];
let clock = 0, mediaDuration = 2, decodeDuration = 2, delayDecode = false, failNextStart = false;
const deferred = [];
const param = () => ({value: 1});
function makeNode(kind) {
  return {kind, gain: param(), pan: param(), connect(target) { this.target = target; }, disconnect() { this.disconnected = true; }};
}
class Audio {
  constructor() {
    this.paused = true; this.ended = false; this.currentTime = 0; this.duration = mediaDuration;
    this.volume = 1; this.src = ''; this.handlers = {}; audios.push(this);
  }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  removeEventListener() {}
  load() { if (this.src) setImmediate(() => this.handlers.loadedmetadata && this.handlers.loadedmetadata()); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}
class AudioContext {
  constructor() { this.state = 'running'; this.destination = {}; }
  get currentTime() { return clock; }
  createGain() { return makeNode('gain'); }
  createMediaElementSource() { return makeNode('input'); }
  createStereoPanner() { return makeNode('panner'); }
  createBufferSource() {
    const n = {...makeNode('source'), buffer: null, loop: false, onended: null, playbackRate: {value: 1},
      start(...args) {
        if (failNextStart) { failNextStart = false; throw new RangeError('start refused'); }
        this.started = args;
      },
      stop() { this.stopped = true; }};
    sources.push(n); return n;
  }
  decodeAudioData() {
    if (delayDecode) return new Promise((resolve, reject) => deferred.push({resolve, reject}));
    return Promise.resolve({duration: decodeDuration});
  }
  resume() { return Promise.resolve(); }
}
const ctx = vm.createContext({
  Audio, AudioContext, Blob, Uint8Array, canvas: {width: 1280, height: 720},
  URL: {createObjectURL: () => 'blob:hardening', revokeObjectURL() {}},
  document: {hidden: false, hasFocus: () => true, addEventListener() {}},
  window: {addEventListener() {}},
  console: {warn() {}}
});
vm.runInContext(fs.readFileSync(process.env.AUDIO_JS || path.join(__dirname, '../audio.js'), 'utf8'), ctx);
const natives = {};
vm.runInContext('installAudioNatives', ctx)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
const tick = () => new Promise(resolve => setImmediate(resolve));
const loadStream = name => api('load')(null, name, new Uint8Array([1, 2]), 2);

// Keep an active timer while waiting so a blocking native cannot silently let the process exit.
async function fast(label, promise, budget = 150) {
  const result = await Promise.race([
    Promise.resolve(promise).then(value => ({value}), error => ({error})),
    new Promise(resolve => setTimeout(() => resolve({timeout: true}), budget))
  ]);
  assert.ok(!result.timeout, `${label} must return without waiting for decodeAudioData`);
  if (result.error) throw result.error;
  return result.value;
}

const watchdog=setTimeout(()=>{console.error('Short-loop hardening timed out');process.exitCode=1;},2000);
(async () => {
  // 1. start() throwing: play reports false, isPlaying is false, and a later play retries.
  const thrown = await loadStream('start-throw.wav');
  await api('setStreamLoop')(null, thrown, true);
  await tick();
  failNextStart = true;
  assert.equal(await api('playStream')(null, thrown, true), false, 'a refused start must not be reported as playing');
  assert.equal(await api('isPlaying')(null, thrown), false, 'a refused start must not leave the record wedged');
  const attempted = sources.length;
  assert.equal(await api('playStream')(null, thrown, true), true, 'the next play must retry');
  assert.equal(sources.length, attempted + 1, 'retry creates a fresh source');
  assert.deepEqual(sources.at(-1).started, [0, 0]);
  assert.equal(await api('isPlaying')(null, thrown), true);
  await api('stopStream')(null, thrown);

  // 2. A saved offset at the buffer end restarts at 0, like media play() after ended.
  const ended = await loadStream('offset-end.wav');
  await api('setStreamLoop')(null, ended, true);
  await tick();
  await api('playStream')(null, ended, true);
  await api('setStreamLoop')(null, ended, false);
  clock = 2.5;                                  // past the 2 s buffer, ended not yet dispatched
  await api('stopStream')(null, ended);
  const before = sources.length;
  assert.equal(await api('playStream')(null, ended, false), true);
  assert.equal(sources.length, before + 1);
  assert.deepEqual(sources.at(-1).started, [0, 0], 'offset at/after length must clamp to 0');
  assert.equal(await api('progress')(null, ended), 0);
  await api('stopStream')(null, ended);

  // 3. Pending decode: setStreamLoop returns promptly, keeps media playable, then converts.
  delayDecode = true;
  const pending = await loadStream('pending.wav');
  await fast('setStreamLoop with pending decode', api('setStreamLoop')(null, pending, true));
  assert.equal(deferred.length, 1, 'decode is still pending after the native call returned');
  assert.notEqual(audios.at(-1).src, '', 'media playback stays available during promotion');
  assert.equal(await api('playStream')(null, pending, true), true, 'play during promotion uses the media path');
  clock = 0.5; audios.at(-1).currentTime = 0.5;
  deferred.shift().resolve({duration: 2});
  await tick();
  assert.equal(audios.at(-1).src, '', 'conversion completes after the decode resolves');
  assert.equal(await api('isPlaying')(null, pending), true, 'conversion takes over the accepted playback');
  assert.ok(Math.abs(await api('progress')(null, pending) - 0.25) < 1e-9, 'conversion keeps the media position');

  console.log('Short-loop hardening (start throw, end offset, nonblocking promotion): PASS');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(()=>clearTimeout(watchdog));
