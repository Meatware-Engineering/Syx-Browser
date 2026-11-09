// Stopped voices must be retired even if the audio context never dispatches ended.
// Effect voices are removed only by source.onended. dispose()/stopAll() stop sources but never
// retire them, so a context that never dispatches ended (suspended before the first gesture, or a
// background tab) keeps every voice ever played. setListener then repositions them every frame,
// across resets, forever.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const panners = [];
function param() {
  let value = 0;
  const p = {writes: 0};
  Object.defineProperty(p, 'value', {get: () => value, set: next => { value = next; p.writes++; }});
  return p;
}
function node(kind) {
  const n = {kind, gain: param(), pan: param(), connect() {}, disconnect() {}};
  if (kind === 'panner') panners.push(n);
  return n;
}
class AudioContext {
  constructor() { this.state = 'suspended'; this.destination = {}; }   // never renders: no ended events
  createGain() { return node('gain'); }
  createStereoPanner() { return node('panner'); }
  createMediaElementSource() { return node('media'); }
  createBufferSource() {
    return {buffer: null, playbackRate: param(), connect() {}, disconnect() {}, start() {}, stop() {}};
  }
  decodeAudioData() { return Promise.resolve({duration: 1}); }
  resume() { return Promise.resolve(); }
}
const context = vm.createContext({
  AudioContext, Blob, Uint8Array,
  URL: {createObjectURL: () => 'blob:review', revokeObjectURL() {}},
  canvas: {width: 1280, height: 720},
  document: {hidden: false, hasFocus: () => true, addEventListener() {}},
  window: {addEventListener() {}},
  console: {warn() {}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
const natives = {};
vm.runInContext('installAudioNatives', context)(natives);
const api = name => natives['Java_syx_browser_BrowserAudio_' + name];

(async () => {
  const id = await api('load')(null, 'effect', new Uint8Array([1]), 3);
  assert.ok(id > 0);
  for (let i = 0; i < 3; i++) assert.equal(await api('playEffect')(null, id, 0.5, 1, true, 100 * i, 100), true);
  assert.equal(panners.length, 3);

  await api('dispose')();                       // game reset; sources stopped, ended never dispatched
  for (const panner of panners) panner.pan.writes = 0;
  await api('setListener')(null, 640, 360);     // the per-frame listener update

  const staleWrites = panners.reduce((sum, panner) => sum + panner.pan.writes, 0);
  assert.equal(staleWrites, 0,
    `dispose() left ${panners.length} stopped effect voices registered; setListener still writes ${staleWrites} stale AudioParams`);
  console.log('Effect voice registry cleared by dispose: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
