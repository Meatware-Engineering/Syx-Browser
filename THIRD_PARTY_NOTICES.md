# Third-party components and game ownership

## Songs of Syx

Songs of Syx and its assets belong to Gamatron AB and their respective rights
holders. A purchased copy must be installed locally. No original game JAR,
asset files, saves, decompiled dumps or generated patched game classes are
included in this source repository. Screenshots, where present, illustrate the
adapter running the game and do not transfer rights to the depicted artwork.

## CheerpJ

The pages load CheerpJ 4.3 (and separate experimental comparison pages may load
5.0) from Leaning Technologies' CDN. It is not bundled or relicensed by this
project. Its vendor's terms apply: https://cheerpj.com/.

## PNG support

PNG decoding uses pngjs, built locally with Browserify. The generated
`vendor/pngjs.js` is deliberately excluded from this repository because the
previous development bundle contained additional transitive dependencies whose
complete version-specific license inventory was not retained. Install from npm
and retain the licenses of all resolved dependencies for any redistributed bundle.
The pngjs MIT notice is retained in `vendor/pngjs-LICENSE`.

## Java compatibility APIs

The `org.lwjgl` package tree implements the subset of the LWJGL API used by this
adapter. Package names describe the compatibility boundary; this repository does
not ship the full LWJGL runtime. The `snake2d` classes are browser-specific
replacement adapters. Game-dependent patches are generated only on the user's
machine and must not be uploaded with releases.
