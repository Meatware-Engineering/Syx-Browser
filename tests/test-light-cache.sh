#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
java_bin=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
"$java_bin/javac" --release 17 -d "$test_dir" tests/settlement/thing/pointlight/*.java src/syx/browser/LightCache.java tests/LightCacheTest.java
"$java_bin/java" -cp "$test_dir" LightCacheTest
