# Optional browser diagnostics

These standalone pages are development tools, not part of the normal game launch.
Start the local server from the repository root, then open a page under
`http://127.0.0.1:8765/diagnostics/`. Do not run game/save probes alongside an active
game or use irreplaceable saves. Some tests start the game or touch browser storage.

- Audio, input, framebuffer, shader and buffer pages isolate adapter behavior.
- `audio-loop-minimal.html` and `raw-audio-loop-probe.html` isolate browser audio.
- `http-range-probe.html` tests the local server using synthetic data.
- Java probes (`audio-java`, `graphics-cleanup`, `read-pixel`, `save-test`) require
  `sh tests/build-probes.sh`; this creates a separate ignored `probes.jar`.
- Performance probes use the build scripts under `tests/`. Their JAR files are
  local build outputs and are not distributed.
- `runtime-4.3-probe.html`, `runtime-5.0-probe.html` and
  `runtime-comparison-saves.html` deliberately require an isolated
  `http://127.0.0.1:8766` origin. They are experiments, not alternative default
  launchers. `server.py` uses port 8765 and does not start that isolated server.

The diagnostics load runtime JavaScript from the repository root. Run them through
the local HTTP server, not `file://`. Game-dependent tests require a purchased game.
