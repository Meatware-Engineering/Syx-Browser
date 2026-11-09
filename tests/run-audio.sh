#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node --check audio.js
for test in tests/test-audio-*.cjs; do
    node "$test"
done
