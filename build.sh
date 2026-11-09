#!/bin/sh
set -eu
cd "$(dirname "$0")"
JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
rm -rf build
mkdir -p build
GAME_JAR="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
find src -name '*.java' -print | xargs "$JAVA_HOME/bin/javac" --release 17 -cp "$GAME_JAR" -d build
mkdir -p trace-build
"$JAVA_HOME/bin/javac" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -d trace-build ByteBufferPatcher.java
"$JAVA_HOME/bin/java" --add-exports java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED -cp trace-build ByteBufferPatcher "$GAME_JAR" build
"$JAVA_HOME/bin/jar" cf overrides.jar -C build .
