# Cloudflare Pages

This is a pure static site deployed to [Cloudflare Pages](https://pages.cloudflare.com/).

## Deploy

Two paths — pick one:

**1. GitHub integration (recommended for ongoing work)**

Connect the repo at `ousiaresearch/blood-and-bridle` via the Cloudflare dashboard
("Workers & Pages" → "Create application" → "Pages" → "Connect to Git"). Use:

- Framework preset: `None`
- Build command: *(blank)*
- Build output directory: `/`

Cloudflare will deploy on every push to `main`.

**2. Direct CLI deploy**

```bash
wrangler login                                       # one-time, OAuth
wrangler pages deploy . --project-name blood-and-bridle
```

## Configuration

- `wrangler.toml` — project name + Pages output dir
- `_headers` — cache control and security headers
- No build step. `index.html` is served verbatim; `src/*.js` loads as ES modules.

## Asset notes

- ~399 MB of static assets (90 horse portraits, 18 soundtrack tracks, rival + heir portraits, brand surfaces, scene compositions)
- All assets live under `assets/`; the game references them via relative paths
- Codex-generated portraits are stored at full 1024×1024 source resolution; the
  game downsamples at draw time via CSS