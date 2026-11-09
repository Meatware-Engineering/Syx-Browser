#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
GAME_JAR="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
# Normal game classes are built separately; probes are opt-in development tools.
sh build.sh
rm -rf probe-build
mkdir -p probe-build
find tests/probes -name '*.java' -print | xargs "$JAVA_HOME/bin/javac" --release 17 -cp "overrides.jar:$GAME_JAR" -d probe-build
"$JAVA_HOME/bin/jar" cf probes.jar -C probe-build .
