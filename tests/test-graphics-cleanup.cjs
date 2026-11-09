const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const uniformWrites = [];
const context = vm.createContext({
  document: {
    createElement: () => ({getContext: () => ({
      createVertexArray: () => ({}), createProgram: () => ({}),
      bindVertexArray() {}, useProgram() {}, uniform1f(_location, value) { uniformWrites.push(value); }
    }), remove() {}}),
    querySelector: () => ({appendChild() {}})
  }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../bridge.js'), 'utf8'), context);

(async () => {
  await vm.runInContext(`(async () => {
    await natives.Java_syx_browser_BrowserBridge_createContext(null, 4, 4);
    const vao = await natives.Java_org_lwjgl_opengl_GL30_glGenVertexArrays();
    const program = await natives.Java_org_lwjgl_opengl_GL20_glCreateProgram();
    await natives.Java_org_lwjgl_opengl_GL30_glBindVertexArray(null, vao);
    await natives.Java_org_lwjgl_opengl_GL20_glUseProgram(null, program);
    object(program).syxPointSize = {};
    await natives.Java_org_lwjgl_opengl_GL11_glPointSize(null, 7);
  })()`, context);
  assert.equal(vm.runInContext('objects.size', context), 2);
  assert.equal(uniformWrites.at(-1), 7);
  await vm.runInContext('natives.Java_syx_browser_BrowserBridge_destroyContext()', context);
  assert.equal(vm.runInContext('objects.size', context), 0);
  assert.equal(vm.runInContext('currentVertexArray', context), undefined);
  assert.equal(vm.runInContext('currentProgram', context), undefined);
  await vm.runInContext('natives.Java_syx_browser_BrowserBridge_destroyContext()', context);
  await vm.runInContext('natives.Java_syx_browser_BrowserBridge_createContext(null, 4, 4)', context);
  assert.equal(await vm.runInContext('natives.Java_org_lwjgl_opengl_GL30_glGenVertexArrays()', context), 1);
  await vm.runInContext(`(async () => {
    const program = await natives.Java_org_lwjgl_opengl_GL20_glCreateProgram();
    object(program).syxPointSize = {};
    await natives.Java_org_lwjgl_opengl_GL20_glUseProgram(null, program);
  })()`, context);
  assert.equal(uniformWrites.at(-1), 1, 'a new context must initialize point size to 1');
  console.log('Graphics context cleanup and point-size default: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
