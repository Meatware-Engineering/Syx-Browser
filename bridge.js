let canvas;
let gl;
let resizeHandler;
let nextObject = 1;
let objects = new Map();
let currentVertexArray;
let currentProgram;
let pointSize = 1;
let cursorX = 0, cursorY = 0, liveCursorX = 0, liveCursorY = 0;
let inputCleanup;
let inputEvents = [];
let mouseEvents = [], inputPoll = 0, mouseDue = 0;
const vertexComponentBytes = {5120:1, 5121:1, 5122:2, 5123:2, 5124:4, 5125:4, 5126:4, 5131:2};
function textureTarget(target) { return target === 34037 ? gl.TEXTURE_2D : target; }
function pixelData(data, format, type) {
  if (data && type === gl.UNSIGNED_BYTE) data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (format === 32993) {
    format = gl.RGBA;
    if (data) {
      data = data.slice();
      for (let i = 0; i + 3 < data.length; i += 4) [data[i], data[i + 2]] = [data[i + 2], data[i]];
    }
  }
  return {data, format};
}
function object(id) {
  const value = objects.get(id);
  if (!value) throw new Error(`Unknown WebGL object ${id}`);
  return value;
}
function remember(value) {
  if (!value) return 0;
  const id = nextObject++;
  objects.set(id, value);
  return id;
}

// A deleted current program keeps valid locations until it is unbound.
function releaseUniformLocations(programObject) {
  for (const id of programObject.syxLocationIds || []) objects.delete(id);
  programObject.syxLocationIds?.clear();
}

const natives = {
  async Java_syx_browser_BrowserBridge_createContext(_lib, width, height) {
    canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.width = width;
    canvas.height = height;
    gl = canvas.getContext('webgl2', {antialias: false, alpha: false});
    if (!gl) return false;
    currentVertexArray = undefined;
    currentProgram = undefined;
    pointSize = 1;
    objects = new Map();
    nextObject = 1;
    document.querySelector('#display').appendChild(canvas);
    return true;
  },
  async Java_syx_browser_BrowserBridge_destroyContext() {
    inputCleanup?.();
    inputCleanup = undefined;
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = undefined;
    canvas?.remove();
    canvas = undefined;
    objects.clear();
    currentVertexArray = undefined;
    currentProgram = undefined;
    gl = undefined;
  },
  async Java_syx_browser_BrowserBridge_getString(_lib, name) {
    if (!gl) throw new Error('WebGL context is not initialized');
    return String(gl.getParameter(name));
  },
  async Java_syx_browser_BrowserBridge_displayWidth() { return window.innerWidth; },
  async Java_syx_browser_BrowserBridge_displayHeight() { return window.innerHeight; },
  async Java_syx_browser_BrowserBridge_focusCanvas() { canvas?.focus(); },
  async Java_syx_browser_BrowserBridge_cursorX() { return cursorX; },
  async Java_syx_browser_BrowserBridge_cursorY() { return cursorY; },
  // The game already limits frame rate; yield without waiting for an extra display refresh.
  async Java_syx_browser_BrowserBridge_pollEvents() { await new Promise(resolve => setTimeout(resolve, 0)); },
  async Java_syx_browser_BrowserBridge_drainInput() {
    inputPoll++;
    let end = inputEvents.length, characters = 0, keyPressed = false;
    for (let i = 0; i < inputEvents.length; i += 4) {
      if (inputEvents[i] === 2 && ++characters > 128) { end = i; break; }
      if (inputEvents[i] === 1) {
        const modifier = inputEvents[i + 1] >= 340 && inputEvents[i + 1] <= 347;
        // Text widgets read modifier state after the callbacks have run.
        if (modifier && inputEvents[i + 2] === 0 && keyPressed) { end = i; break; }
        if (!modifier && inputEvents[i + 2] !== 0) keyPressed = true;
      }
    }
    const events = inputEvents.splice(0, end);
    // The game samples mouse position and held state once per poll.
    if (mouseEvents.length && mouseDue <= inputPoll) {
      const mouse = mouseEvents.shift(); cursorX = mouse.x; cursorY = mouse.y; events.push(...mouse.event);
      mouseDue = mouseEvents.length ? inputPoll + 1 : 0;
    } else if (!mouseEvents.length) { cursorX = liveCursorX; cursorY = liveCursorY; }
    return Int32Array.from(events);
  },
  async Java_syx_browser_BrowserBridge_setCursorVisible(_lib, visible) { canvas.style.cursor = visible ? 'default' : 'none'; },
  async Java_syx_browser_BrowserBridge_installInputHandler(lib) {
    inputEvents = []; mouseEvents = []; inputPoll = 0; mouseDue = 0;
    inputCleanup?.();
    const target = canvas;
    const pressedKeys = new Set(), pressedButtons = new Set();
    const send = (method, ...args) => {
      const event = [({keyEvent:1, charEvent:2, mouseEvent:3, scrollEvent:4})[method], args[0] || 0, args[1] || 0, args[2] || 0];
      // Preserve modifier state until earlier mouse transitions have been observed.
      if (method === 'mouseEvent' || (method === 'keyEvent' && args[0] >= 340 && args[0] <= 347 && mouseEvents.length)) {
        if (!mouseEvents.length) mouseDue = inputPoll + 2;
        mouseEvents.push({event, x: liveCursorX, y: liveCursorY});
      } else inputEvents.push(...event);
    };
    const keyCode = event => {
      if (/^Key[A-Z]$/.test(event.code)) return event.code.charCodeAt(3);
      if (/^Digit[0-9]$/.test(event.code)) return event.code.charCodeAt(5);
      if (/^Numpad[0-9]$/.test(event.code)) return 320 + Number(event.code.slice(6));
      const keys = {Space:32, Escape:256, Enter:257, Tab:258, Backspace:259, Insert:260, Delete:261, ArrowRight:262, ArrowLeft:263, ArrowDown:264, ArrowUp:265, PageUp:266, PageDown:267, Home:268, End:269, CapsLock:280, ScrollLock:281, NumLock:282, PrintScreen:283, Pause:284, NumpadDecimal:330, NumpadDivide:331, NumpadMultiply:332, NumpadSubtract:333, NumpadAdd:334, NumpadEnter:335, NumpadEqual:336, ShiftLeft:340, ControlLeft:341, AltLeft:342, MetaLeft:343, ShiftRight:344, ControlRight:345, AltRight:346, MetaRight:347, ContextMenu:348, Minus:45, Equal:61, Comma:44, Period:46, Slash:47, Semicolon:59, Quote:39, BracketLeft:91, BracketRight:93, Backslash:92, Backquote:96};
      if (/^F([1-9]|1[0-9]|2[0-5])$/.test(event.code)) return 289 + Number(event.code.slice(1));
      return keys[event.code] ?? -1;
    };
    const mods = e => (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    const move = e => { const r = target.getBoundingClientRect(); liveCursorX = (e.clientX - r.left) * target.width / r.width; liveCursorY = (e.clientY - r.top) * target.height / r.height; if (!mouseEvents.length) { cursorX = liveCursorX; cursorY = liveCursorY; } };
    const text = value => { for (let i = 0; i < value.length; i++) send('charEvent', value.charCodeAt(i)); };
    const down = e => { const key = keyCode(e); if (key >= 0) { pressedKeys.add(key); send('keyEvent', key, e.repeat ? 2 : 1, mods(e)); } if (!e.isComposing && !e.metaKey && ((!e.ctrlKey && !e.altKey) || e.getModifierState('AltGraph')) && [...e.key].length === 1) text(e.key); if (!((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyV')) e.preventDefault(); };
    const up = e => { const key = keyCode(e); if (pressedKeys.delete(key)) send('keyEvent', key, 0, mods(e)); e.preventDefault(); };
    const button = e => e.button === 1 ? 2 : e.button === 2 ? 1 : e.button;
    const mouseDown = e => { move(e); target.focus(); const value = button(e); pressedButtons.add(value); send('mouseEvent', value, 1, mods(e)); e.preventDefault(); };
    const mouseUp = e => { const value = button(e); if (pressedButtons.delete(value)) { move(e); send('mouseEvent', value, 0, mods(e)); e.preventDefault(); } };
    const release = () => {
      for (const key of pressedKeys) send('keyEvent', key, 0, 0);
      for (const value of pressedButtons) send('mouseEvent', value, 0, 0);
      pressedKeys.clear(); pressedButtons.clear();
    };
    const visibility = () => { if (document.hidden) release(); };
    document.addEventListener('visibilitychange', visibility);
    const wheel = e => { send('scrollEvent', -Math.sign(e.deltaX), -Math.sign(e.deltaY)); e.preventDefault(); };
    const paste = e => { if (e.clipboardData) { text(e.clipboardData.getData('text/plain')); e.preventDefault(); } };
    const context = e => e.preventDefault();
    target.addEventListener('keydown', down); target.addEventListener('keyup', up);
    target.addEventListener('mousemove', move); target.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp); target.addEventListener('wheel', wheel, {passive: false});
    target.addEventListener('contextmenu', context); target.addEventListener('paste', paste); target.addEventListener('blur', release); window.addEventListener('blur', release);
    inputCleanup = () => { release(); document.removeEventListener('visibilitychange', visibility); target?.removeEventListener('keydown', down); target?.removeEventListener('keyup', up); target?.removeEventListener('mousemove', move); target?.removeEventListener('mousedown', mouseDown); window.removeEventListener('mouseup', mouseUp); target?.removeEventListener('wheel', wheel); target?.removeEventListener('contextmenu', context); target?.removeEventListener('paste', paste); target?.removeEventListener('blur', release); window.removeEventListener('blur', release); };
  },
  async Java_syx_browser_BrowserBridge_installResizeHandler() {
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      inputEvents.push(5, canvas.width, canvas.height, 0);
    };
    window.addEventListener('resize', resizeHandler);
  },
  async Java_org_lwjgl_opengl_GL11_glGetError() { return gl.getError(); },
  async Java_org_lwjgl_glfw_GLFW_glfwSwapBuffers() { gl.flush(); },
  async Java_org_lwjgl_glfw_GLFW_glfwGetWindowAttrib(_lib, _window, attribute) { return attribute === 131073 && document.hasFocus() ? 1 : 0; },
  async Java_org_lwjgl_opengl_GL11_glGetInteger(_lib, name) { return Number(gl.getParameter(name) ?? 0); },
  async Java_org_lwjgl_opengl_GL11_getIntegerAt(_lib, name, index) { return Number(gl.getParameter(name)[index]); },
  async Java_org_lwjgl_opengl_GL11_glClearColor(_lib, r, g, b, a) { gl.clearColor(r, g, b, a); },
  async Java_org_lwjgl_opengl_GL11_glEnable(_lib, capability) { gl.enable(capability); },
  async Java_org_lwjgl_opengl_GL11_glDisable(_lib, capability) { gl.disable(capability); },
  async Java_org_lwjgl_opengl_GL11_glDepthFunc(_lib, value) { gl.depthFunc(value); },
  async Java_org_lwjgl_opengl_GL11_glColorMask(_lib, r, g, b, a) { gl.colorMask(r, g, b, a); },
  async Java_org_lwjgl_opengl_GL11_glStencilFunc(_lib, func, ref, mask) { gl.stencilFunc(func, ref, mask); },
  async Java_org_lwjgl_opengl_GL11_glStencilOp(_lib, fail, depthFail, pass) { gl.stencilOp(fail, depthFail, pass); },
  async Java_org_lwjgl_opengl_GL11_setStencilOp(_lib, fail, depthFail, pass) { gl.stencilOp(fail, depthFail, pass); },
  async Java_org_lwjgl_opengl_GL11_glPointSize(_lib, size) {
    pointSize = size;
    if (currentProgram?.syxPointSize) gl.uniform1f(currentProgram.syxPointSize, size);
  },
  async Java_org_lwjgl_opengl_GL11_glDepthMask(_lib, enabled) { gl.depthMask(enabled); },
  async Java_org_lwjgl_opengl_GL11_glClearStencil(_lib, value) { gl.clearStencil(value); },
  async Java_org_lwjgl_opengl_GL11_glClearDepth(_lib, value) { gl.clearDepth(value); },
  async Java_org_lwjgl_opengl_GL11_glBlendFunc(_lib, source, destination) { gl.blendFunc(source, destination); },
  async Java_org_lwjgl_opengl_GL11_glViewport(_lib, x, y, width, height) { gl.viewport(x, y, width, height); },
  async Java_org_lwjgl_opengl_GL11_glReadBuffer(_lib, buffer) { gl.readBuffer(buffer); },
  async Java_org_lwjgl_opengl_GL11_readPixels(_lib, x, y, width, height, format, type) {
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, format, type, data);
    return new Int8Array(data.buffer);
  },
  async Java_org_lwjgl_opengl_GL30_glBindFramebuffer(_lib, target, framebuffer) { gl.bindFramebuffer(target, framebuffer ? object(framebuffer) : null); },
  async Java_org_lwjgl_opengl_GL30_glGetFramebufferAttachmentParameteri(_lib, target, attachment, name) {
    if (attachment === 1024) attachment = gl.BACK;
    return Number(gl.getFramebufferAttachmentParameter(target, attachment, name));
  },
  async Java_org_lwjgl_opengl_GL30_glGenVertexArrays() {
    const vao = gl.createVertexArray();
    vao.syxAttributes = new Map();
    return remember(vao);
  },
  async Java_org_lwjgl_opengl_GL30_glBindVertexArray(_lib, id) {
    currentVertexArray = id ? object(id) : null;
    gl.bindVertexArray(currentVertexArray);
  },
  async Java_org_lwjgl_opengl_GL30_glDeleteVertexArrays(_lib, id) { if (id) { gl.deleteVertexArray(object(id)); objects.delete(id); } },
  async Java_org_lwjgl_opengl_GL30_glGenFramebuffers() {
    const framebuffer = gl.createFramebuffer();
    framebuffer.syxAttachments = new Map();
    return remember(framebuffer);
  },
  async Java_org_lwjgl_opengl_GL30_glGenRenderbuffers() { return remember(gl.createRenderbuffer()); },
  async Java_org_lwjgl_opengl_GL30_glBindRenderbuffer(_lib, target, id) { gl.bindRenderbuffer(target, id ? object(id) : null); },
  async Java_org_lwjgl_opengl_GL30_glBlitFramebuffer(_lib, sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, mask, filter) { gl.blitFramebuffer(sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, mask, filter); },
  async Java_org_lwjgl_opengl_GL30_glRenderbufferStorage(_lib, target, format, width, height) { gl.renderbufferStorage(target, format, width, height); },
  async Java_org_lwjgl_opengl_GL30_glFramebufferTexture2D(_lib, target, attachment, textureTargetValue, texture, level) {
    const framebuffer = gl.getParameter(target === gl.READ_FRAMEBUFFER ? gl.READ_FRAMEBUFFER_BINDING : gl.DRAW_FRAMEBUFFER_BINDING);
    const entry = {texture: texture ? object(texture) : null, target: textureTarget(textureTargetValue), level};
    framebuffer.syxAttachments.set(attachment, entry);
    gl.framebufferTexture2D(target, attachment, entry.target, entry.texture, level);
  },
  async Java_org_lwjgl_opengl_GL30_glFramebufferRenderbuffer(_lib, target, attachment, renderTarget, renderbuffer) {
    const framebuffer = gl.getParameter(target === gl.READ_FRAMEBUFFER ? gl.READ_FRAMEBUFFER_BINDING : gl.DRAW_FRAMEBUFFER_BINDING);
    const entry = {renderbuffer: renderbuffer ? object(renderbuffer) : null, target: renderTarget};
    if (framebuffer) framebuffer.syxAttachments.set(attachment, entry);
    gl.framebufferRenderbuffer(target, attachment, renderTarget, entry.renderbuffer);
  },
  async Java_org_lwjgl_opengl_GL30_glCheckFramebufferStatus(_lib, target) { return gl.checkFramebufferStatus(target); },
  async Java_org_lwjgl_opengl_GL30_glDeleteFramebuffers(_lib, id) { if (id) { gl.deleteFramebuffer(object(id)); objects.delete(id); } },
  async Java_org_lwjgl_opengl_GL30_glDeleteRenderbuffers(_lib, id) { if (id) { gl.deleteRenderbuffer(object(id)); objects.delete(id); } },
  async Java_org_lwjgl_opengl_GL30_glVertexAttribIPointer(_lib, index, size, type, stride, pointer) {
    pointer = Number(pointer);
    currentVertexArray.syxAttributes.set(index, {size, type, stride, pointer, integer: true, buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING)});
    gl.vertexAttribIPointer(index, size, type, stride, pointer);
  },
  async Java_org_lwjgl_opengl_GL15_glGenBuffers() { return remember(gl.createBuffer()); },
  async Java_org_lwjgl_opengl_GL15_glBindBuffer(_lib, target, id) { gl.bindBuffer(target, id ? object(id) : null); },
  async Java_org_lwjgl_opengl_GL15_glDeleteBuffers(_lib, id) { if (id) { gl.deleteBuffer(object(id)); objects.delete(id); } },
  async Java_org_lwjgl_opengl_GL15_bufferDataByteRange(_lib, target, data, start, length, usage) { gl.bufferData(target, data.subarray(start, start + length), usage); },
  async Java_org_lwjgl_opengl_GL15_bufferSubDataByteRange(_lib, target, offset, data, start, length) { gl.bufferSubData(target, Number(offset), data.subarray(start, start + length)); },
  async Java_org_lwjgl_opengl_GL15_bufferDataBytes(_lib, target, data, usage) { gl.bufferData(target, data, usage); },
  async Java_org_lwjgl_opengl_GL15_bufferDataInts(_lib, target, data, usage) { gl.bufferData(target, data, usage); },
  async Java_org_lwjgl_opengl_GL15_bufferSubDataBytes(_lib, target, offset, data) { gl.bufferSubData(target, Number(offset), data); },
  async Java_org_lwjgl_opengl_GL13_glActiveTexture(_lib, texture) { gl.activeTexture(texture); },
  async Java_org_lwjgl_opengl_GL11_glGenTextures() { return remember(gl.createTexture()); },
  async Java_org_lwjgl_opengl_GL11_glBindTexture(_lib, target, id) { gl.bindTexture(textureTarget(target), id ? object(id) : null); },
  async Java_org_lwjgl_opengl_GL11_glDeleteTextures(_lib, id) { if (id) { gl.deleteTexture(object(id)); objects.delete(id); } },
  async Java_org_lwjgl_opengl_GL11_glTexParameterf(_lib, target, name, value) { gl.texParameterf(textureTarget(target), name, value); },
  async Java_org_lwjgl_opengl_GL11_glTexParameteri(_lib, target, name, value) { gl.texParameteri(textureTarget(target), name, value); },
  async Java_org_lwjgl_opengl_GL11_texImage2D(_lib, target, level, internal, width, height, border, format, type, data) {
    ({data, format} = pixelData(data, format, type));
    gl.texImage2D(textureTarget(target), level, internal, width, height, border, format, type, data);
  },
  async Java_org_lwjgl_opengl_GL11_texSubImage2D(_lib, target, level, x, y, width, height, format, type, data) {
    ({data, format} = pixelData(data, format, type));
    gl.texSubImage2D(textureTarget(target), level, x, y, width, height, format, type, data);
  },
  async Java_org_lwjgl_opengl_GL11_glClear(_lib, mask) { gl.clear(mask); },
  async Java_org_lwjgl_stb_STBImage_decodeImage(_lib, encoded) {
    try {
      if (encoded[0] === -119 && encoded[1] === 80 && encoded[2] === 78 && encoded[3] === 71) {
        const BufferType = new png.PNG({width: 1, height: 1}).data.constructor;
        const decoded = png.PNG.sync.read(BufferType.from(encoded));
        const bytes = new Uint8Array(decoded.data.length + 8);
        const header = new DataView(bytes.buffer);
        header.setUint32(0, decoded.width); header.setUint32(4, decoded.height);
        bytes.set(decoded.data, 8);
        return new Int8Array(bytes.buffer);
      }
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength)]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
      const imageCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = imageCanvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const bytes = new Uint8Array(pixels.length + 8);
      const header = new DataView(bytes.buffer);
      header.setUint32(0, bitmap.width); header.setUint32(4, bitmap.height);
      bytes.set(pixels, 8);
      bitmap.close();
      return new Int8Array(bytes.buffer);
    } catch (error) {
      console.error('Image decode failed', error);
      return null;
    }
  },
  async Java_org_lwjgl_stb_STBImageWrite_encodeImage(_lib, pixels, width, height, stride, jpeg, quality) {
    try {
      const rowBytes = width * 4;
      stride ||= rowBytes;
      if (stride < rowBytes || pixels.length < stride * (height - 1) + rowBytes) throw new Error('Invalid image buffer');
      const source = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      const data = new Uint8Array(rowBytes * height);
      for (let y = 0; y < height; y++) data.set(source.subarray(y * stride, y * stride + rowBytes), y * rowBytes);
      if (!jpeg) {
        const output = png.PNG.sync.write({width, height, data});
        return new Int8Array(output.buffer, output.byteOffset, output.byteLength);
      }
      const imageCanvas = new OffscreenCanvas(width, height);
      imageCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
      const blob = await imageCanvas.convertToBlob({type: jpeg ? 'image/jpeg' : 'image/png', quality: quality / 100});
      return new Int8Array(await blob.arrayBuffer());
    } catch (error) {
      console.error('Image encode failed', error);
      return null;
    }
  },
  async Java_org_lwjgl_opengl_GL20_glCreateProgram() { return remember(gl.createProgram()); },
  async Java_org_lwjgl_opengl_GL20_glCreateShader(_lib, type) {
    return remember({type, handle: type === 36313 ? null : gl.createShader(type), source: ''});
  },
  async Java_org_lwjgl_opengl_GL20_shaderSource(_lib, shader, source) {
    const record = object(shader);
    record.source = source;
    if (record.handle) gl.shaderSource(record.handle, record.type === gl.VERTEX_SHADER ? pointSizeSource(webglSource(source)) : webglSource(source));
  },
  async Java_org_lwjgl_opengl_GL20_glCompileShader(_lib, shader) {
    const record = object(shader);
    if (record.handle) gl.compileShader(record.handle);
  },
  async Java_org_lwjgl_opengl_GL20_glGetShaderi(_lib, shader, name) {
    const record = object(shader);
    if (!record.handle) return name === gl.COMPILE_STATUS ? 1 : 0;
    if (name === gl.INFO_LOG_LENGTH) return (gl.getShaderInfoLog(record.handle) || '').length + 1;
    return Number(gl.getShaderParameter(record.handle, name));
  },
  async Java_org_lwjgl_opengl_GL20_glGetShaderInfoLog(_lib, shader) {
    const record = object(shader);
    return record.handle ? gl.getShaderInfoLog(record.handle) || '' : '';
  },
  async Java_org_lwjgl_opengl_GL20_glAttachShader(_lib, program, shader) {
    const programObject = object(program);
    const record = object(shader);
    (programObject.syxShaders ??= []).push(record);
    if (record.handle) gl.attachShader(programObject, record.handle);
  },
  async Java_org_lwjgl_opengl_GL20_glDetachShader(_lib, program, shader) {
    const programObject = object(program), record = object(shader);
    if (record.handle) gl.detachShader(programObject, record.handle);
    programObject.syxShaders = programObject.syxShaders.filter(item => item !== record);
  },
  async Java_org_lwjgl_opengl_GL20_glDeleteShader(_lib, id) { const record = object(id); if (record.handle) gl.deleteShader(record.handle); objects.delete(id); },
  async Java_org_lwjgl_opengl_GL20_glDeleteProgram(_lib, id) {
    const programObject = object(id);
    gl.deleteProgram(programObject);
    objects.delete(id);
    if (currentProgram === programObject) programObject.syxDeletePending = true;
    else releaseUniformLocations(programObject);
  },
  async Java_org_lwjgl_opengl_GL20_glLinkProgram(_lib, program) {
    const programObject = object(program);
    const geometry = programObject.syxShaders.find(shader => shader.type === 36313);
    if (geometry) {
      const vertex = programObject.syxShaders.find(shader => shader.type === gl.VERTEX_SHADER);
      if (!vertex) throw new Error('Geometry shader has no vertex shader');
      gl.shaderSource(vertex.handle, expandPointGeometry(vertex.source, geometry.source));
      gl.compileShader(vertex.handle);
      if (!gl.getShaderParameter(vertex.handle, gl.COMPILE_STATUS)) {
        throw new Error(`Expanded vertex shader failed: ${gl.getShaderInfoLog(vertex.handle)}`);
      }
      programObject.syxPointGeometry = true;
    }
    gl.linkProgram(programObject);
    if (!gl.getProgramParameter(programObject, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(programObject));
    } else {
      programObject.syxPointSize = gl.getUniformLocation(programObject, 'syx_point_size');
      gl.useProgram(programObject);
      try {
        if (programObject.syxPointSize) gl.uniform1f(programObject.syxPointSize, pointSize);
        for (const shader of programObject.syxShaders) {
          for (const initial of uniformInitializers(shader.source)) {
            const location = gl.getUniformLocation(programObject, initial.name);
            if (location && initial.type === 'float') gl.uniform1f(location, initial.values[0]);
            if (location && initial.type === 'vec3') gl.uniform3f(location, ...initial.values);
          }
        }
      } finally {
        gl.useProgram(currentProgram || null);
      }
    }
  },
  async Java_org_lwjgl_opengl_GL20_glGetProgrami(_lib, program, name) { return Number(gl.getProgramParameter(object(program), name)); },
  async Java_org_lwjgl_opengl_GL20_glUseProgram(_lib, program) {
    const previous = currentProgram;
    currentProgram = program ? object(program) : null;
    gl.useProgram(currentProgram);
    if (previous && previous !== currentProgram && previous.syxDeletePending) releaseUniformLocations(previous);
    if (currentProgram?.syxPointSize) gl.uniform1f(currentProgram.syxPointSize, pointSize);
  },
  async Java_org_lwjgl_opengl_GL20_getUniformLocation(_lib, program, name) {
    const programObject = object(program);
    const location = gl.getUniformLocation(programObject, name);
    if (!location) return -1;
    const id = remember(location);
    (programObject.syxLocationIds ??= new Set()).add(id);
    return id;
  },
  async Java_org_lwjgl_opengl_GL20_glUniform1i(_lib, location, value) { if (location !== -1) gl.uniform1i(object(location), value); },
  async Java_org_lwjgl_opengl_GL20_glUniform1f(_lib, location, value) { if (location !== -1) gl.uniform1f(object(location), value); },
  async Java_org_lwjgl_opengl_GL20_glUniform2f(_lib, location, x, y) { if (location !== -1) gl.uniform2f(object(location), x, y); },
  async Java_org_lwjgl_opengl_GL20_glUniform3f(_lib, location, x, y, z) { if (location !== -1) gl.uniform3f(object(location), x, y, z); },
  async Java_org_lwjgl_opengl_GL20_glVertexAttribPointer(_lib, index, size, type, normalized, stride, pointer) {
    pointer = Number(pointer);
    currentVertexArray.syxAttributes.set(index, {size, type, normalized, stride, pointer, integer: false, buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING)});
    gl.vertexAttribPointer(index, size, type, normalized, stride, pointer);
  },
  async Java_org_lwjgl_opengl_GL20_glEnableVertexAttribArray(_lib, index) { gl.enableVertexAttribArray(index); },
  async Java_org_lwjgl_opengl_GL20_glDisableVertexAttribArray(_lib, index) { gl.disableVertexAttribArray(index); },
  async Java_org_lwjgl_opengl_GL20_drawBuffers(_lib, buffers) {
    const framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (!framebuffer) return gl.drawBuffers(Array.from(buffers));
    for (let i = 0; i < 3; i++) {
      const entry = framebuffer.syxAttachments.get(buffers[i]);
      if (entry?.renderbuffer) gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, entry.target, entry.renderbuffer);
      else gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, entry?.texture || null, entry?.level || 0);
    }
    framebuffer.syxDrawBuffers = Array.from(buffers);
    gl.drawBuffers(Array.from(buffers, (_, index) => gl.COLOR_ATTACHMENT0 + index));
  },
  async Java_org_lwjgl_opengl_GL20_glDrawElements(_lib, mode, count, type, offset) {
    offset = Number(offset);
    if (mode !== gl.POINTS || !currentProgram?.syxPointGeometry) return gl.drawElements(mode, count, type, offset);
    if (type !== gl.UNSIGNED_INT || offset % 4) throw new Error('Unsupported point index format');
    // shortcut: point expansion assumes sequential Uint32 indices; read the EBO if other orders are needed.
    const previousBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const start = offset / 4;
    for (const [index, attr] of currentVertexArray.syxAttributes) {
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
      // A zero GL stride means tightly packed; 2:10:10:10 attributes occupy one 32-bit word.
      const stride = attr.stride || ((attr.type === 33640 || attr.type === 36255) ? 4 : attr.size * vertexComponentBytes[attr.type]);
      if (attr.integer) gl.vertexAttribIPointer(index, attr.size, attr.type, attr.stride, attr.pointer + start * stride);
      else gl.vertexAttribPointer(index, attr.size, attr.type, attr.normalized, attr.stride, attr.pointer + start * stride);
      gl.vertexAttribDivisor(index, 1);
    }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    for (const [index, attr] of currentVertexArray.syxAttributes) {
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
      if (attr.integer) gl.vertexAttribIPointer(index, attr.size, attr.type, attr.stride, attr.pointer);
      else gl.vertexAttribPointer(index, attr.size, attr.type, attr.normalized, attr.stride, attr.pointer);
      gl.vertexAttribDivisor(index, 0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer);
  },
};
