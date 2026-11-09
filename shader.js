function webglSource(source) {
  let result = source.replace(/^\s*#version\s+330\s+core/, '#version 300 es\nprecision highp float;\nprecision highp int;');
  result = result.replace(/(\buniform\s+(?:float|vec3)\s+\w+)\s*=\s*[^;]+;/g, '$1;');
  const rectangles = [...source.matchAll(/\bsampler2DRect\s+(\w+)/g)].map(match => match[1]);
  if (rectangles.length) {
    result = result.replace(/\bsampler2DRect\b/g, 'sampler2D');
    for (const name of rectangles) {
      result = result.replace(new RegExp(`\\btexture\\s*\\(\\s*${name}\\s*,`, 'g'), `textureRect(${name},`);
    }
    result = result.replace('precision highp int;', 'precision highp int;\nvec4 textureRect(sampler2D tex, vec2 pixel) { return texture(tex, pixel / vec2(textureSize(tex, 0))); }');
  }
  result = result.replace(/(\.[xyzwrgba]\s*(?:==|!=|<=|>=|<|>)\s*)(\d+)(?=\s*[)])/g, '$1$2.0');
  result = result.replace(/(\bvD\s*\)\s*<=\s*)0(?=\s*\))/g, '$10.0');
  result = result.replace(/(\bscreen\s*\/\s*)2(?=\s*;)/g, '$12.0');
  result = result.replace(/(texCoord_i\.[xy]\s*-\s*)int\((texCoord_i\.[xy])\)/g, '$1float(int($2))');
  for (const match of source.matchAll(/\bin\s+uvec([234])\s+(\w+)\s*;/g)) {
    const [, size, name] = match;
    result = result.replace(new RegExp(`(=\\s*)${name}(\\s*;)`, 'g'), `$1vec${size}(${name})$2`);
  }
  return result;
}

function uniformInitializers(source) {
  return [...source.matchAll(/\buniform\s+(float|vec3)\s+(\w+)\s*=\s*([^;]+);/g)].map(([, type, name, initial]) => {
    const values = type === 'float' ? [initial] : (initial.match(/^vec3\s*\(([^)]+)\)$/) || [])[1]?.split(',');
    if (!values || values.length !== (type === 'float' ? 1 : 3) || values.some(value => !Number.isFinite(Number(value.trim())))) {
      throw new Error(`Unsupported uniform initializer: ${name}`);
    }
    return {type, name, values: values.map(Number)};
  });
}

function pointSizeSource(source) {
  const result = source.replace(/\bvoid\s+main\s*\(\s*\)\s*\{/, 'uniform float syx_point_size;\nvoid main() { gl_PointSize = syx_point_size;');
  if (result === source) throw new Error('Vertex shader has no main function');
  return result;
}

function expandPointGeometry(vertex, geometry) {
  if (!/layout\s*\(\s*points\s*\)\s*in\s*;/.test(geometry) || (geometry.match(/EmitVertex\s*\(\s*\)\s*;/g) || []).length !== 4) {
    throw new Error('Unsupported geometry shader: expected four vertices for each point');
  }
  let base = vertex.replace(/\bout\s+(\w+)\s+(\w+)\s*;/g, '$1 $2;')
    .replace(/\bvoid\s+main\s*\(\s*\)/, 'void syx_vertex_main()');
  let stage = geometry.replace(/^\s*#version[^\n]*\n/, '')
    .replace(/layout\s*\([^)]*\)\s*(?:in|out)\s*;/g, '')
    .replace(/\bin\s+\w+\s+\w+\s*\[\s*\]\s*;/g, '')
    .replace(/\bgl_in\s*\[\s*0\s*\]\.gl_Position/g, 'syx_original_position')
    .replace(/\b(g\w+)\s*\[\s*0\s*\]/g, '$1')
    .replace(/\bvoid\s+main\s*\(\s*\)\s*\{/, 'void main() { syx_vertex_main(); vec4 syx_original_position = gl_Position;')
    .replace(/\bEndPrimitive\s*\(\s*\)\s*;/g, '');
  let index = 0;
  stage = stage.replace(/\bEmitVertex\s*\(\s*\)\s*;/g, () => `if (gl_VertexID == ${index++}) return;`);
  return webglSource(base + '\n' + stage);
}
if (typeof module !== 'undefined') module.exports = { webglSource, expandPointGeometry, uniformInitializers, pointSizeSource };
