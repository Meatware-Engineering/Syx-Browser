#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_GAME_JAR="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
SYX_CORE_BUILD=$(mktemp -d)
trap 'rm -rf "$SYX_CORE_BUILD"' EXIT HUP INT TERM
"$SYX_JAVA_BIN/javac" --release 17 -cp "$SYX_GAME_JAR" -d "$SYX_CORE_BUILD" tests/performance/init/BrowserPerformanceMain.java
"$SYX_JAVA_BIN/jar" cf core-performance-probes.jar -C "$SYX_CORE_BUILD" .
