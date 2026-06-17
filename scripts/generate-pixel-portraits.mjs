#!/usr/bin/env node
/**
 * generate-pixel-portraits.mjs
 *
 * Generates pixel-art horse portraits via the PixelLab MCP REST API
 * (https://www.pixellab.ai/). Reads scripts/portraits-manifest.json
 * (15 specs: 5 life stages x 3 moods), creates a character for each
 * with view=side, template=horse, body_type=quadruped, polls for
 * completion, and downloads the asset into assets/horses/<id>.png.
 * Writes assets/horses/index.js with the URL map.
 *
 * Usage:
 *   node scripts/generate-pixel-portraits.mjs           # generate all
 *   node scripts/generate-pixel-portraits.mjs --resume  # skip already-done
 *   node scripts/generate-pixel-portraits.mjs --ids foal_calm,yearling_intense
 *
 * Flags:
 *   --resume               skip ids that already have a .png in assets/horses/
 *   --ids a,b,c            only generate these manifest ids
 *   --dry-run              don't create; just print the plan
 *
 * State:
 *   .pixellab-state.json  (gitignored) — character_id and status per id
 *
 * Cost: 1 generation per character in 'standard' mode. 15 portraits = 15
 * generations out of a 2000-generation Tier 1 subscription.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.resolve(ROOT, 'scripts', 'portraits-manifest.json');
const OUTPUT_DIR = path.resolve(ROOT, 'assets', 'horses');
const STATE_PATH = path.resolve(__dirname, '.pixellab-state.json');

const PIXELLAB_API_KEY = process.env.PIXELLAB_API_KEY;
if (!PIXELLAB_API_KEY) {
  console.error('PIXELLAB_API_KEY not set. Source the env first.');
  process.exit(1);
}

const FLAGS = new Set(process.argv.slice(2));
const RESUME = FLAGS.has('--resume');
const DRY_RUN = FLAGS.has('--dry-run');
const IDS_FLAG = process.argv.find(a => a.startsWith('--ids='));
const ONLY_IDS = IDS_FLAG
  ? new Set(IDS_FLAG.slice(6).split(',').map(s => s.trim()).filter(Boolean))
  : null;

const ENDPOINT = 'https://api.pixellab.ai/mcp';
const POLL_INTERVAL_MS = 30_000;     // 30s between polls
const POLL_TIMEOUT_MS = 20 * 60_000; // 20 min per character
const CREATE_DELAY_MS = 15_000;     // 15s between create calls (avoids heavy-load rejections)
const RETRY_DELAY_MS = 60_000;      // 1 min before retrying a failed create

// Maps the file-id prefix back to the canonical breed id. Used by
// writeIndex() to recover breed/lifeStage/mood from a filename like
// "qh_foal_calm.png". Keep in sync with BREED_POOL in src/horse.js.
const BREED_PREFIX_TO_ID = {
  qh: 'quarter_horse',
  appy: 'appaloosa',
  paint: 'paint_horse',
  arab: 'arabian',
  tb: 'thoroughbred',
  andy: 'andalusian',
};

// ---------- API plumbing ----------

async function callTool(name, args) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + PIXELLAB_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const bodyText = await res.text();
  const dataLine = bodyText.split('\n').find(l => l.startsWith('data: '));
  if (!dataLine) {
    throw new Error(`No SSE data line (HTTP ${res.status}): ${bodyText.slice(0, 200)}`);
  }
  const data = JSON.parse(dataLine.slice(6));
  if (data.error) {
    throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  }
  const content = data.result?.content;
  if (!content || !content[0]) {
    throw new Error(`Empty content (HTTP ${res.status})`);
  }
  // MCP returns content as an array — usually [{type:'text', text:'...'}]
  // for status, and [{type:'text',...},{type:'image',data:'<base64>',...}]
  // for completed characters. We scan all items and merge what we find.
  let textPayload = null;
  let image = null;
  for (const item of content) {
    if (item.type === 'text' && item.text) {
      textPayload = item.text;
    } else if (item.type === 'image' && item.data) {
      image = item;
    }
  }
  // Always keep the text (for status / metadata) — and surface image if present.
  let parsed = {};
  if (textPayload) {
    try {
      parsed = JSON.parse(textPayload);
    } catch {
      parsed = parseYamlish(textPayload);
    }
  }
  if (image) {
    parsed._image = image;
  }
  return { ok: !data.result.isError, data: parsed };
}

function logStep(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

/**
 * Parse the YAML-like "key: value" format that the PixelLab MCP text
 * content uses. Values may be quoted strings, bare strings, or numbers.
 * Multi-line strings are not supported (not needed for our payloads).
 */
function parseYamlish(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      val = Number(val);
    }
    out[key] = val;
  }
  return out;
}

// ---------- State ----------

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function hasAsset(id) {
  return fs.existsSync(path.join(OUTPUT_DIR, `${id}.png`));
}

// ---------- Pipeline ----------

async function createCharacter(spec) {
  const args = {
    description: spec.description,
    view: 'side',                  // PixelLab horse side-view
    template: 'horse',             // required for quadruped preset
    body_type: 'quadruped',
  };
  // The manifest may carry size, but PixelLab uses a fixed 48x48 for templates
  // and lets the size be overridden only via custom mode. Drop size to standard.
  const result = await callTool('create_character', args);
  if (!result.ok) {
    throw new Error(`create_character failed: ${JSON.stringify(result.data)}`);
  }
  const id = result.data.id;
  if (!id) throw new Error(`No id returned: ${JSON.stringify(result.data)}`);
  return id;
}

async function pollUntilDone(characterId) {
  const start = Date.now();
  let lastStatus = '';
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const result = await callTool('get_character', {
      character_id: characterId,
      include_preview: true,
    });
    if (!result.ok) {
      // Sometimes errors are transient; keep polling briefly.
      logStep(`  poll error: ${JSON.stringify(result.data).slice(0, 120)}`);
    } else if (typeof result.data === 'object') {
      const status = result.data.status || 'unknown';
      if (status !== lastStatus) {
        logStep(`  status: ${status}`);
        lastStatus = status;
      }
      if (status === 'completed') {
        return result.data;
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(`generation failed: ${JSON.stringify(result.data)}`);
      }
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function downloadAsset(characterId, outPath) {
  // Prefer the preview image returned with the character; fall back to a
  // separate fetch if needed.
  const result = await callTool('get_character', {
    character_id: characterId,
    include_preview: true,
  });
  if (!result.ok) throw new Error(`get_character failed: ${JSON.stringify(result.data)}`);

  // Preview may be a URL (fetch as bytes) or a base64 image content item.
  const d = result.data;
  if (d.preview_url || d.image_url || d.url) {
    const url = d.preview_url || d.image_url || d.url;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Asset fetch HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return buf.length;
  }
  if (d._image && d._image.data) {
    const buf = Buffer.from(d._image.data, 'base64');
    fs.writeFileSync(outPath, buf);
    return buf.length;
  }
  // Some flows return a hex-encoded string under different keys.
  for (const k of ['image_hex', 'image', 'data']) {
    if (typeof d[k] === 'string' && /^[0-9a-fA-F]+$/.test(d[k])) {
      const buf = Buffer.from(d[k], 'hex');
      fs.writeFileSync(outPath, buf);
      return buf.length;
    }
  }
  throw new Error(`No asset payload found in response: ${JSON.stringify(d).slice(0, 200)}`);
}

function writeIndex() {
  // Collect all successfully generated entries, sorted by id for stability.
  const entries = [];
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  const state = loadState();
  for (const file of files) {
    const id = file.replace(/\.png$/, '');
    const s = state[id];
    if (!s) continue;
    // Recover breed / lifeStage / mood from the id (qh_foal_calm).
    const parts = id.split('_');
    // parts: [prefix, lifeStage, mood] — find breed by prefix.
    const prefix = parts[0];
    const lifeStage = parts[1];
    const mood = parts.slice(2).join('_');
    // Reverse-lookup breed by prefix.
    const breed = (BREED_PREFIX_TO_ID && BREED_PREFIX_TO_ID[prefix]) || prefix;
    entries.push({ id, breed, lifeStage, mood, path: `/assets/horses/${id}.png` });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  // Write the new module shape: PORTRAITS array + getPortraitUrl function.
  // The lookup indexes and fallback chain are written in JS so they
  // rebuild at import time — no build step needed.
  const banner = '// AUTO-GENERATED by scripts/generate-pixel-portraits.mjs. Do not edit by hand.\n';
  const header = `
// Structured portrait lookup. Each entry has { id, breed, lifeStage, mood, path }.
// getPortraitUrl(horse) does a four-tier lookup:
//   1. exact: breed + lifeStage + mood
//   2. breed + lifeStage + 'calm' (any-mood fallback)
//   3. breed + lifeStage (any-mood fallback)
//   4. any lifeStage + mood (any-breed fallback, for breeds we haven't drawn)
// Each tier falls through to the next. Returns null only if literally nothing
// matches — in which case src/portraits.js renders the CSS silhouette.

const FALLBACK_LIFE_STAGE = 'campaigner';
const FALLBACK_BREED = 'quarter_horse';

export const PORTRAITS = ${JSON.stringify(entries, null, 2)};

const byKey = new Map();           // "breed|lifeStage|mood" -> path
const byBreedStage = new Map();    // "breed|lifeStage" -> [path, ...]
const byLifeStageMood = new Map(); // "lifeStage|mood" -> [path, ...]
const byLifeStage = new Map();     // "lifeStage" -> [path, ...]
const all = [];                    // [path, ...]

for (const p of PORTRAITS) {
  if (!p || !p.path) continue;
  byKey.set(\`\${p.breed}|\${p.lifeStage}|\${p.mood}\`, p.path);
  pushInto(byBreedStage, \`\${p.breed}|\${p.lifeStage}\`, p.path);
  pushInto(byLifeStageMood, \`\${p.lifeStage}|\${p.mood}\`, p.path);
  pushInto(byLifeStage, p.lifeStage, p.path);
  all.push(p.path);
}

function pushInto(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

export function getPortraitUrl(horse) {
  if (!horse) return null;
  const breed = horse.breed || FALLBACK_BREED;
  const stage = horse.lifeStageId || horse.stageId || FALLBACK_LIFE_STAGE;
  const mood = horse.mood || 'calm';

  return (
    byKey.get(\`\${breed}|\${stage}|\${mood}\`) ||
    byKey.get(\`\${breed}|\${stage}|calm\`) ||
    pick(byBreedStage.get(\`\${breed}|\${stage}\`)) ||
    pick(byLifeStageMood.get(\`\${stage}|\${mood}\`)) ||
    pick(byLifeStage.get(stage)) ||
    pick(all)
  );
}

function pick(arr) {
  return arr && arr.length ? arr[0] : null;
}
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.js'), banner + header);
  logStep(`Wrote index.js with ${entries.length} entries`);
}

// ---------- Main ----------

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const state = loadState();

  const queue = manifest.filter(spec => {
    if (ONLY_IDS && !ONLY_IDS.has(spec.id)) return false;
    if (RESUME && hasAsset(spec.id)) return false;
    return true;
  });

  if (DRY_RUN) {
    console.log(`Would generate ${queue.length} of ${manifest.length} characters:`);
    for (const s of queue) console.log(`  - ${s.id} (${s.lifeStage}/${s.mood})`);
    return;
  }

  logStep(`Generating ${queue.length} characters (resume=${RESUME})`);

  for (const spec of queue) {
    logStep(`--- ${spec.id} (${spec.lifeStage}/${spec.mood}) ---`);
    try {
      let characterId = state[spec.id]?.character_id;
      if (!characterId) {
        // Stagger create calls so PixelLab doesn't rate-limit us.
        if (Object.keys(state).length > 0) {
          logStep(`  waiting ${CREATE_DELAY_MS / 1000}s before create...`);
          await new Promise(r => setTimeout(r, CREATE_DELAY_MS));
        }
        characterId = await createCharacter(spec);
        state[spec.id] = { character_id: characterId, status: 'creating' };
        saveState(state);
        logStep(`  created: ${characterId}`);
      } else {
        logStep(`  reusing: ${characterId}`);
      }

      const final = await pollUntilDone(characterId);
      state[spec.id].status = 'completed';
      state[spec.id].completed_at = Date.now();
      saveState(state);

      const outPath = path.join(OUTPUT_DIR, `${spec.id}.png`);
      const bytes = await downloadAsset(characterId, outPath);
      logStep(`  saved ${spec.id}.png (${bytes} bytes)`);
    } catch (err) {
      const msg = err.message || String(err);
      const isHeavyLoad = /heavy load|rate.?limit|too many/i.test(msg);
      if (isHeavyLoad && !state[spec.id]?.error_count) {
        logStep(`  rate-limited, will retry once after ${RETRY_DELAY_MS / 1000}s`);
        state[spec.id] = { error: msg, error_count: 1, heavy_load: true };
        saveState(state);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        // Recurse: re-attempt this spec by removing the error_count gate
        state[spec.id].error_count = 0;
        // Simple retry: re-create and try again
        const newId = await createCharacter(spec);
        state[spec.id] = { character_id: newId, status: 'creating', retry: true };
        saveState(state);
        logStep(`  retried: ${newId}`);
        const final2 = await pollUntilDone(newId);
        state[spec.id].status = 'completed';
        state[spec.id].completed_at = Date.now();
        saveState(state);
        const outPath2 = path.join(OUTPUT_DIR, `${spec.id}.png`);
        const bytes2 = await downloadAsset(newId, outPath2);
        logStep(`  saved ${spec.id}.png (${bytes2} bytes)`);
      } else {
        logStep(`  ERROR: ${msg}`);
        state[spec.id] = { ...(state[spec.id] || {}), error: msg };
        saveState(state);
      }
    }
  }

  writeIndex();
  logStep('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
