# Syx Browser · Beta

An **unofficial, experimental browser compatibility layer for Songs of Syx**.
Java game code runs in the browser through CheerpJ; the adapter maps the game's
LWJGL calls to WebGL 2 and Web Audio. This is not desktop video streaming.

**A purchased, locally installed copy of the game is required.**
[Buy Songs of Syx on Steam](https://store.steampowered.com/app/1162750/Songs_of_Syx/).
No game JAR, graphics, music, saves or patched game binaries are distributed here.
This project is not affiliated with or endorsed by Gamatron AB or Leaning Technologies.

## Beta status

The development build has launched the game, created worlds and settlements, and
saved/reloaded games in a browser. Mouse selection, zoom, basic construction and
short battle tests have been exercised. These are limited checks, **not a claim
that every mechanic or a long campaign works**.

Known limitations:

- The current launch/build scripts target the macOS Steam installation and
  Homebrew OpenJDK 21 on Apple Silicon. Windows and Linux setup is not provided.
- Patches depend on game bytecode and may reject or break with another version.
- Audio has worked in Chromium in testing by the project owner. Safari audio
  can hang in its media subsystem; `?audio=off` is a Safari workaround for a
  completely silent run (no audio graph is created), not a universal requirement.
- Long frames and stutters remain, especially at high simulation speed.
  Avoid treating maximum speed as stable.
- Browser saves are separate from Steam saves. Clearing site data, changing
  browsers or using private browsing can lose them. Back up frequently and do
  not use this beta for irreplaceable campaigns.
- CheerpJ is loaded from its vendor's CDN; internet access is required.

## Preview

![Songs of Syx 0.71.44 main menu running in Safari](docs/screenshots/main-menu.png)

Captured locally in Safari on 9 November 2026 with audio disabled. Game artwork
belongs to its respective owners. This capture verifies startup to the main menu,
not a complete gameplay regression run.

## Requirements

- Purchased Songs of Syx, installed through Steam at its default macOS location.
- Python 3, Node.js/npm, and Homebrew OpenJDK 21.
- A browser with WebGL 2 support.
- Internet access for the Java runtime and initial npm dependencies.

CheerpJ has its own license and usage conditions. Review the
[official CheerpJ information](https://cheerpj.com/) before use, especially for
commercial use or redistribution. This repository does not grant rights to it
or to the game.

## Run locally

Clone this repository, then from its directory:

```sh
npm install --ignore-scripts
npm run build:vendor
sh build.sh
python3 server.py
```

Open **http://127.0.0.1:8765/**. Audio may require a user gesture.
For Safari audio problems, use **http://127.0.0.1:8765/?audio=off** as a silent
workaround. The first runtime load and world generation can take several minutes.

`build.sh` reads your installed game JAR and creates `overrides.jar` locally.
The original game is not modified. **Do not distribute this generated JAR**:
it includes locally patched game classes. All JARs, class files, game files,
working dumps and archives are excluded from Git.

The Python server binds only to `127.0.0.1`. Keep it local; do not expose it,
tunnel it publicly or publish its game-file routes. Stop it with Ctrl+C when done.
If port 8765 is occupied, stop the previous instance before running another build.

The existing PNG browser bundle is intentionally not committed. `build:vendor`
builds it from pngjs 7.0.0 with Browserify 17.0.1. Direct versions are pinned;
transitive versions are not yet locked. The npm dependency installation and vendor
rebuild should be verified on a fresh machine before calling this a reproducible release.

## Saves and language

- `http://127.0.0.1:8765/saves.html`: export/import browser saves and import a
  compatible `.save` from your own desktop installation. Save and close the game
  tab first. Existing names are not overwritten.
- `http://127.0.0.1:8765/language.html`: choose an available game language, then
  reload the game. The translated files and fonts come from your local game.
- Export is limited to 10,000 files and 512 MiB. Web Locks coordinate game/save
  access where supported; otherwise close competing tabs yourself.

## Development checks

Portable checks require Node.js and Python, but no game assets:

```sh
sh tests/run-portable.sh
```

They cover audio lifecycle, input, rendering adapters, buffer uploads, language,
and HTTP range behavior using synthetic fixtures. This is not an end-to-end game
certification. Additional Java tests live in `tests/`; standalone browser
experiments live in [`diagnostics/`](diagnostics/README.md) and are not loaded by
the game. Several Java scripts use the same macOS JDK/game paths.

`?audio=pcm` and `?directMusic=1` are diagnostic audio modes, not stability fixes.
The runtime comparison pages are experiments; the normal entry point uses CheerpJ 4.3.

## Latest local verification

On 9 November 2026, the portable Node/Python checks passed, the Java adapter build
completed against the installed game, and Safari reached the 0.71.44 main menu.
The screenshot used the existing local PNG bundle. A clean npm install and rebuilt
vendor bundle have **not** been verified because package-registry access was unavailable.

## Contents

- `src/`: browser bridge and Java API adapters.
- `ByteBufferPatcher.java`: local bytecode compatibility patcher.
- `bridge.js`, `shader.js`, `audio.js`: WebGL/Web Audio implementations.
- `server.py`: loopback-only local file server.
- `saves.html`, `language.html`: browser data utilities.
- `tests/`: regression checks, Java probes, and fixtures.
- `diagnostics/`: optional browser experiments, separate from the normal launch.

See [third-party notes](THIRD_PARTY_NOTICES.md). The project source is published
for inspection; no blanket license for game code or third-party runtimes is implied.
