#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_STENCIL_BUILD=$(mktemp -d)
trap 'rm -rf "$SYX_STENCIL_BUILD"' EXIT HUP INT TERM
python3 - "$SYX_STENCIL_BUILD" <<'PY'
from pathlib import Path
import sys
text=Path('src/org/lwjgl/opengl/GL11.java').read_text()
for name,params,counter in [('setStencilOp','int fail, int depthFail, int pass','testOpCalls')]:
 old=f'private static native void {name}({params});'
 assert text.count(old)==1
 text=text.replace(old,f'private static void {name}({params}) {{ {counter}++; if(testFailNext){{testFailNext=false;throw new IllegalStateException("synthetic boundary failure");}} }}')
text=text.replace('public final class GL11 {','public final class GL11 { static int testOpCalls; static boolean testFailNext;')
Path(sys.argv[1],'GL11.java').write_text(text)
PY
"$SYX_JAVA_BIN/javac" --release 17 -cp overrides.jar -d "$SYX_STENCIL_BUILD" "$SYX_STENCIL_BUILD/GL11.java" tests/graphics/syx/browser/BrowserBridge.java src/org/lwjgl/glfw/GLFW.java tests/graphics/StencilCacheProbe.java
"$SYX_JAVA_BIN/java" -cp "$SYX_STENCIL_BUILD:overrides.jar" org.lwjgl.opengl.StencilCacheProbe
mkdir "$SYX_STENCIL_BUILD/probe"
"$SYX_JAVA_BIN/javac" --release 17 -cp overrides.jar -d "$SYX_STENCIL_BUILD/probe" src/org/lwjgl/opengl/GL11.java src/org/lwjgl/glfw/GLFW.java tests/performance/syx/browser/StencilCacheWebGLProbe.java
"$SYX_JAVA_BIN/jar" cf stencil-cache-probes.jar -C "$SYX_STENCIL_BUILD/probe" .
