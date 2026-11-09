#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
java_bin=/opt/homebrew/opt/openjdk@21/bin
game_jar="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
test_build=$(mktemp -d "${TMPDIR:-/tmp}/syx-effect-retry.XXXXXXXX")
trap 'rm -rf "$test_build"' EXIT HUP INT TERM
"$java_bin/javac" --release 17 -cp "$game_jar" -d "$test_build" \
    tests/audio/syx/browser/BrowserAudio.java \
    src/snake2d/SoundCoreDummy.java \
    tests/audio/snake2d/EffectLoadRetryProbe.java
"$java_bin/java" -cp "$test_build:$game_jar" snake2d.EffectLoadRetryProbe
