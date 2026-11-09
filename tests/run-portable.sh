#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for test in tests/*.cjs; do
  node "$test"
done
node test-shader.cjs
python3 tests/test-server.py
