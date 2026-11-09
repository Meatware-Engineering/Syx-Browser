#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SYX_JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin
SYX_GAME_JAR="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
SYX_WAIT_BUILD=$(mktemp -d)
trap 'rm -rf "$SYX_WAIT_BUILD"' EXIT HUP INT TERM
mkdir "$SYX_WAIT_BUILD/classes" "$SYX_WAIT_BUILD/patcher"
"$SYX_JAVA_BIN/javac" --release 17 -cp "$SYX_GAME_JAR" -d "$SYX_WAIT_BUILD/classes" tests/performance/init/BrowserWaitPerformanceMain.java
"$SYX_JAVA_BIN/javac" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -d "$SYX_WAIT_BUILD/patcher" tests/performance/CoreWaitPatcher.java
"$SYX_JAVA_BIN/java" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -cp "$SYX_WAIT_BUILD/patcher" CoreWaitPatcher "$SYX_GAME_JAR" "$SYX_WAIT_BUILD/classes"
"$SYX_JAVA_BIN/jar" cf core-wait-probes.jar -C "$SYX_WAIT_BUILD/classes" .
