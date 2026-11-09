#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
ROOT=$(pwd)
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/syx-backup-test.XXXXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
"$JAVA_HOME/bin/javac" -cp "$ROOT/overrides.jar" -d "$TMP_DIR" "$ROOT/tests/SaveArchiveLimitProbe.java"
"$JAVA_HOME/bin/java" -cp "$TMP_DIR:$ROOT/overrides.jar" SaveArchiveLimitProbe "$TMP_DIR"
