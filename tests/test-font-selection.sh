#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
ROOT=$(pwd)
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
GAME_JAR="$HOME/Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources/SongsOfSyx.jar"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/syx-font-test.XXXXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
mkdir -p "$TMP_DIR/present/base" "$TMP_DIR/absent"
python3 - "$TMP_DIR/present/base/locale.zip" <<'PY'
from sys import argv
from zipfile import ZipFile
with ZipFile(argv[1], 'w') as z:
    z.writestr('chars/eastern/', '')
PY
"$JAVA_HOME/bin/javac" -cp "$ROOT/overrides.jar:$GAME_JAR" -d "$TMP_DIR" "$ROOT/tests/FontProbe.java"
(cd "$TMP_DIR/present" && "$JAVA_HOME/bin/java" -cp "$TMP_DIR:$ROOT/overrides.jar:$GAME_JAR" FontProbe true)
(cd "$TMP_DIR/absent" && "$JAVA_HOME/bin/java" -cp "$TMP_DIR:$ROOT/overrides.jar:$GAME_JAR" FontProbe false)
