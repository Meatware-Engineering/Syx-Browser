// Independent short-loop conversion race regressions against the production adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const audios = [], sources = [], inputs = [], contexts = [];
let clock = 0, mediaDuration = 2, decodeDuration = 2, delayDecode = false, decodeCalls = 0, revoked = 0;
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
  constructor() { this.state = 'running'; this.destination = {}; contexts.push(this); }
  get currentTime() { return clock; }
  createGain() { const n = makeNode('gain'); return n; }
  createMediaElementSource() { const n = makeNode('input'); inputs.push(n); return n; }
  createStereoPanner() { return makeNode('panner'); }
  createBufferSource() {
    const n = {...makeNode('source'), buffer: null, loop: false, onended: null, playbackRate: {value: 1},
      start(...args) { this.started = args; }, stop() { this.stopped = true; }};
    sources.push(n); return n;
  }
  decodeAudioData() {
    decodeCalls++;
    if (delayDecode) return new Promise((resolve, reject) => deferred.push({resolve, reject}));
    return Promise.resolve({duration: decodeDuration});
  }
  resume() { return Promise.resolve(); }
}
const ctx = vm.createContext({
  Audio, AudioContext, Blob, Uint8Array, canvas: {width: 1280, height: 720},
  URL: {createObjectURL: () => 'blob:race-' + (++revoked), revokeObjectURL() {}},
  document: {hidden: false, hasFocus: () => true, addEventListener() {}},
  window: {addEventListener() {}},
  console: {warn() {}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), ctx);
const natives = {};
vm.runInContext('installAudioNatives', ctx)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];
const tick = () => new Promise(resolve => setImmediate(resolve));
const loadStream = name => api('load')(null, name, new Uint8Array([1, 2]), 2);

const watchdog=setTimeout(()=>{console.error('Short-loop conversion race timed out');process.exitCode=1;},2000);
(async () => {
  // 1. Conversion while the native stream is already playing keeps the position and graph bus.
  const playing = await loadStream('playing.wav');
  await api('setStreamGain')(null, playing, 0.4);
  delayDecode = true;
  const conversion = api('setStreamLoop')(null, playing, true);
  await tick();
  assert.equal(deferred.length, 1);
  assert.equal(await api('playStream')(null, playing, true), true, 'native playback is accepted while decoding');
  clock = 1.25; audios.at(-1).currentTime = 1.25;
  deferred.shift().resolve({duration: 2});
  await conversion; await tick();
  assert.equal(audios.at(-1).src, '', 'successful conversion detaches the media element');
  assert.equal(inputs.at(-1).disconnected, true, 'conversion disconnects the media element source');
  assert.equal(sources.length, 1, 'exactly one buffer source takes over');
  assert.deepEqual(sources[0].started, [0, 1.25], 'buffer resumes at the media position');
  assert.equal(sources[0].target.gain.value, 0.4, 'reused gain bus keeps the stream gain');
  assert.ok(Math.abs(await api('progress')(null, playing) - 0.625) < 1e-9);

  // 2. Turning loop off during the decode aborts conversion; media stays intact and retry works.
  delayDecode = true;
  const aborting = await loadStream('abort.wav');
  const pending = api('setStreamLoop')(null, aborting, true);
  await tick();
  await api('setStreamLoop')(null, aborting, false);
  deferred.shift().resolve({duration: 2});
  await pending; await tick();
  assert.notEqual(audios.at(-1).src, '', 'aborted conversion must keep the media element');
  assert.equal(sources.filter(s => s.started).length, 1, 'aborted conversion must not create a source');
  assert.equal(await api('playStream')(null, aborting, true), true, 'media path remains playable');
  assert.equal(audios.at(-1).paused, false);
  await api('stopStream')(null, aborting);
  delayDecode = false;
  await api('setStreamLoop')(null, aborting, true);
  await tick();
  assert.equal(audios.at(-1).src, '', 'a later loop request converts normally');
  assert.equal(await api('playStream')(null, aborting, true), true);
  assert.equal(sources.filter(s => s.started).length, 2, 'buffered record uses the buffer path');

  // 3. stopAll during the decode must not let a buffered source start on its own.
  delayDecode = true;
  const stopped = await loadStream('stopall.wav');
  const stopping = api('setStreamLoop')(null, stopped, true);
  await tick();
  await api('stopAll')();
  deferred.shift().resolve({duration: 2});
  await stopping; await tick();
  assert.equal(sources.filter(s => s.started).length, 2, 'stopAll during conversion must not start audio');
  assert.equal(await api('isPlaying')(null, stopped), false);
  assert.equal(await api('playStream')(null, stopped, true), true, 'the converted record is still playable');
  assert.equal(sources.filter(s => s.started).length, 3);
  assert.deepEqual(sources.at(-1).started, [0, 0]);

  // 4. Loop-off after many wrapped cycles rebases at the current cycle position.
  delayDecode = false;
  clock = 0;
  const rebase = await loadStream('rebase.wav');
  await api('setStreamLoop')(null, rebase, true);
  await tick();
  await api('playStream')(null, rebase, true);
  clock = 5.5;                                  // two 2 s loops plus 1.5 s
  assert.ok(Math.abs(await api('progress')(null, rebase) - 0.75) < 1e-9, 'wrapped progress before toggle');
  await api('setStreamLoop')(null, rebase, false);
  assert.ok(Math.abs(await api('progress')(null, rebase) - 0.75) < 1e-9, 'loop-off must keep the wrapped position, not clamp to the end');
  clock = 5.75;
  assert.ok(Math.abs(await api('progress')(null, rebase) - 0.875) < 1e-9, 'non-loop playback continues from the rebased position');

  // 5. Context suspension must preserve logical playback, as it does for media streams.
  const long = await api('load')(null, 'long.wav', new Uint8Array([1]), 2);
  await api('playStream')(null, long, true);
  assert.equal(await api('isPlaying')(null, long), true, 'media path reports playing');
  contexts[0].state = 'suspended';
  assert.equal(await api('isPlaying')(null, rebase), true, 'suspended context must not make a buffered source appear ended');
  assert.equal(await api('isPlaying')(null, long), true, 'media path still reports playing while the context is suspended');
  contexts[0].state = 'running';
  assert.equal(await api('isPlaying')(null, rebase), true, 'buffered path recovers when the context runs again');

  console.log('Short-loop conversion races (position, loop-off rebase, abort, stopAll during decode): PASS');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(()=>clearTimeout(watchdog));
