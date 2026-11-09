#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
java_bin=/opt/homebrew/opt/openjdk@21/bin
test_build=$(mktemp -d "${TMPDIR:-/tmp}/syx-archive-integrity.XXXXXXXX")
trap 'rm -rf "$test_build"' EXIT HUP INT TERM
mkdir -p "$test_build/files" "$test_build/src/syx/browser"
# JVM fixture seam only: CheerpJ's /files temporary root maps to this test's directory.
python3 - "$test_build/src/syx/browser/SaveArchive.java" <<'PY'
from pathlib import Path
import sys
source=Path('src/syx/browser/SaveArchive.java').read_text()
assert source.count('Path.of("/files")')==2
Path(sys.argv[1]).write_text(source.replace('Path.of("/files")','Path.of(System.getProperty("syx.test.files"))'))
PY
"$java_bin/javac" --release 17 -d "$test_build" "$test_build/src/syx/browser/SaveArchive.java" tests/SaveArchiveIntegrityProbe.java
"$java_bin/java" -Dsyx.test.files="$test_build/files" -cp "$test_build" SaveArchiveIntegrityProbe "$test_build"
