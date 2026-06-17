# Generated Assets

This directory holds assets that are generated at build time, not committed
to the repo. The two pipelines are:

## Horse portraits

`scripts/generate-portraits.mjs` reads `scripts/portraits-manifest.json` and
generates 15 horse portraits via FAL gpt-image-2 (1024×1024, high quality,
painterly Western realism). Output: `assets/horses/<id>.png` + `index.js`.

```bash
FAL_KEY=... node scripts/generate-portraits.mjs
```

The game uses these via a lazy dynamic import of `/assets/horses/index.js`.
If the manifest is missing or the import fails, the game falls back to
CSS silhouette art.

## Soundtrack

`scripts/generate-soundtrack.mjs` reads `scripts/soundtrack-manifest.json` and
generates 8 music loops (one per season + show/crisis/legacy/ending) via the
MiniMax music-2.6 API. Output: `assets/soundtrack/<id>.mp3` + `index.js`.

The API key lives in `~/.zshrc` and is **not exported into the shell
environment** by default (Hermes redacts it). Use the helper:

```bash
node scripts/run-with-key.mjs scripts/generate-soundtrack.mjs
```

The game uses these via a lazy dynamic import of
`/assets/soundtrack/index.js`. If the manifest is missing or the import
fails, the game runs silent.

## Dev server URL mapping

`npm start` runs `python3 -m http.server 4173` from the project root. The
game fetches assets from absolute paths (`/assets/...`) which resolve to
files in this directory.
