#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for test in tests/*.cjs; do
  node "$test"
done
python3 tests/test-server.py
