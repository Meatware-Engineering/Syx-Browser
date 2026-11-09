#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
java_bin=/opt/homebrew/opt/openjdk@21/bin
test_build=$(mktemp -d "${TMPDIR:-/tmp}/syx-window-input.XXXXXXXX")
trap 'rm -rf "$test_build"' EXIT HUP INT TERM
"$java_bin/javac" --release 17 -cp overrides.jar -d "$test_build" \
 tests/graphics/syx/browser/BrowserBridge.java src/org/lwjgl/opengl/GL11.java src/org/lwjgl/glfw/GLFW.java tests/graphics/WindowInputResetProbe.java
"$java_bin/java" -cp "$test_build:overrides.jar" WindowInputResetProbe
