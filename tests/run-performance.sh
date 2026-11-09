#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_TEMP_BUILD=$(mktemp -d)
trap 'rm -rf "$SYX_TEMP_BUILD"' EXIT HUP INT TERM
"$SYX_JAVA_BIN/javac" --release 17 -d "$SYX_TEMP_BUILD" \
 src/syx/browser/SafeBuffers.java src/syx/browser/BrowserBridge.java src/org/lwjgl/opengl/GL15.java \
 tests/performance/syx/browser/SafeBuffersBaseline.java \
 tests/performance/syx/browser/SafeBuffersParityProbe.java \
 tests/performance/syx/browser/BufferPerformanceProbe.java \
 tests/performance/syx/browser/BufferUploadPerformanceProbe.java \
 tests/performance/org/lwjgl/opengl/GL15Baseline.java
"$SYX_JAVA_BIN/java" -cp "$SYX_TEMP_BUILD" syx.browser.SafeBuffersParityProbe
node tests/test-buffer-upload-range.cjs
node tests/test-performance-diagnostics.cjs
node tests/test-performance-environment.cjs
sh tests/test-stencil-cache.sh
"$SYX_JAVA_BIN/jar" cf performance-probes.jar -C "$SYX_TEMP_BUILD" .
