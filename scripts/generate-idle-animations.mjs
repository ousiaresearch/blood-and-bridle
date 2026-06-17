#!/usr/bin/env node
/**
 * generate-idle-animations.mjs
 *
 * Generates 2-frame idle animations for each breed via the PixelLab MCP
 * animate_character tool. Reads BREED_POOL from src/horse.js, creates
 * one "reference" character per breed, animates it with template
 * 'rest-idle' (a subtle breathing/head-tilt), and saves the frames as
 * assets/horses/animations/<prefix>_idle_<n>.png.
 *
 * These animations are then loaded by src/portraits.js and cycled on
 * each horse portrait every ~700ms, giving every horse card a subtle
 * "alive" feel without being distracting.
 *
 * Usage:
 *   node scripts/generate-idle-animations.mjs
 *   node scripts/generate-idle-animations.mjs --resume
 *
 * Cost: 6 generations (one per breed) + 6 animations. Same Tier 1
 * pricing as the static portraits.
 *
 * State:
 *   .idle-state.json  (gitignored) — per-breed character_id, animation_id, frames
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BREED_POOL } from '../src/horse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'assets', 'horses', 'animations');
const STATE_PATH = path.resolve(__dirname, '.idle-state.json');
const INDEX_PATH = path.resolve(ROOT, 'assets', 'horses', 'animations', 'index.js');

const PIXELLAB_API_KEY = process.env.PIXELLAB_API_KEY;
if (!PIXELLAB_API_KEY) {
  console.error('PIXELLAB_API_KEY not set. Source the env first.');
  process.exit(1);
}

const FLAGS = new Set(process.argv.slice(2));
const RESUME = FLAGS.has('--resume');
const DRY_RUN = FLAGS.has('--dry-run');

const ENDPOINT = 'https://api.pixellab.ai/mcp';
const POLL_INTERVAL_MS = 30_000;
const POLL_TIMEOUT_MS = 20 * 60_000;
const CREATE_DELAY_MS = 45_000;

// ---------- API plumbing (duplicated from generate-pixel-portraits.mjs
//            to keep scripts independent per user preference) ----------

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
  if (!dataLine) throw new Error(`No SSE data line (HTTP ${res.status}): ${bodyText.slice(0, 200)}`);
  const data = JSON.parse(dataLine.slice(6));
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  const content = data.result?.content;
  if (!content || !content[0]) throw new Error(`Empty content (HTTP ${res.status})`);

  let textPayload = null;
  let image = null;
  for (const item of content) {
    if (item.type === 'text' && item.text) textPayload = item.text;
    else if (item.type === 'image' && item.data) image = item;
  }
  let parsed = {};
  if (textPayload) {
    try { parsed = JSON.parse(textPayload); }
    catch { parsed = parseYamlish(textPayload); }
  }
  if (image) parsed._image = image;
  return { ok: !data.result.isError, data: parsed, rawText: textPayload };
}

function parseYamlish(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      val = Number(val);
    }
    out[key] = val;
  }
  return out;
}

function logStep(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ---------- State ----------

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }

// ---------- Frame download ----------

async function downloadImage(item, outPath) {
  if (item.data) {
    // Base64 in data field
    const buf = Buffer.from(item.data, 'base64');
    fs.writeFileSync(outPath, buf);
    return buf.length;
  }
  if (item.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`Asset fetch HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return buf.length;
  }
  throw new Error('No data or url in image item');
}

// ---------- Animation pipeline ----------

async function createReferenceCharacter(breed) {
  // A neutral, breed-specific reference pose. Used only for animation
  // frames — the static portrait system uses its own per-spec characters.
  const description = `${breed.label} (${breed.coat}), ${breed.build}. Standing at rest in a quiet pasture, head slightly lowered, weight on three legs, one hind hoof resting. The natural idle pose.`;
  const result = await callTool('create_character', {
    description,
    view: 'side',
    template: 'horse',
    body_type: 'quadruped',
  });
  if (!result.ok) throw new Error(`create_character failed: ${JSON.stringify(result.data)}`);
  return result.data.id;
}

async function pollUntilDone(characterId) {
  const start = Date.now();
  let lastStatus = '';
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const r = await callTool('get_character', { character_id: characterId, include_preview: true });
    if (r.ok && typeof r.data === 'object') {
      const status = r.data.status || 'unknown';
      if (status !== lastStatus) { logStep(`  status: ${status}`); lastStatus = status; }
      if (status === 'completed') return r.data;
      if (status === 'failed' || status === 'error') {
        throw new Error(`character failed: ${JSON.stringify(r.data)}`);
      }
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function animateReference(characterId) {
  // Start a rest-idle animation. PixelLab generates 8 directions × 9 frames
  // (~2-4 min). We only need the south view to match the static portraits.
  const result = await callTool('animate_character', {
    character_id: characterId,
    template_animation_id: 'rest-idle',
  });
  if (!result.ok) throw new Error(`animate_character failed: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function generateForBreed(breed, state) {
  if (RESUME && state[breed.id]?.frames?.length) {
    logStep(`  resuming with ${state[breed.id].frames.length} existing frames`);
    // Return a marker so the main loop skips the download step.
    return state[breed.id].frames.map(p => ({ existing: true, path: p }));
  }

  let characterId = state[breed.id]?.character_id;
  if (!characterId) {
    logStep(`  creating reference character`);
    const r = await createReferenceCharacter(breed);
    characterId = r;
    state[breed.id] = { character_id: characterId };
    saveState(state);
  } else {
    logStep(`  reusing character ${characterId}`);
  }

  logStep(`  polling for character completion`);
  await pollUntilDone(characterId);

  if (!state[breed.id].animation_started) {
    logStep(`  starting rest-idle animation`);
    await animateReference(characterId);
    state[breed.id].animation_started = true;
    saveState(state);
  }

  logStep(`  polling for rest-idle frames`);
  const frameUrls = await pollForAnimationFrames(characterId);
  state[breed.id].frame_urls = frameUrls;
  saveState(state);

  // Download frames to disk
  const savedFrames = [];
  for (let i = 0; i < frameUrls.length; i++) {
    const url = frameUrls[i];
    const outPath = path.join(OUTPUT_DIR, `${breed.prefix}_idle_${i}.png`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Frame fetch HTTP ${r.status} for ${url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    savedFrames.push(outPath);
    logStep(`  saved ${breed.prefix}_idle_${i}.png (${buf.length} bytes)`);
  }
  state[breed.id].frames = savedFrames;
  state[breed.id].status = 'completed';
  saveState(state);
  return savedFrames;
}

async function pollForAnimationFrames(characterId) {
  // Poll get_character until the rest-idle (south, Nf) block has frame URLs.
  // We use the raw text (not yamlish) to preserve the multi-line structure.
  const start = Date.now();
  let lastFrameCount = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const r = await callTool('get_character', { character_id: characterId, include_preview: false });
    if (r.ok && r.rawText) {
      const urls = extractSouthFrameUrls(r.rawText);
      if (urls.length > 0 && urls.length !== lastFrameCount) {
        logStep(`  found ${urls.length} south frames`);
        lastFrameCount = urls.length;
      }
      if (urls.length > 0) return urls;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`animation frames did not appear within ${POLL_TIMEOUT_MS / 1000}s`);
}

function extractSouthFrameUrls(rawText) {
  // Find the rest-idle (south, Nf) block by URL — more robust than
  // trying to match the multi-line text structure.
  // Strategy: find each rest-idle animation block, extract its frame URLs,
  // and return the one whose URLs contain "/south/".
  const blocks = rawText.split(/\n(?=\s+rest-idle\b|\s+download:|\s+available_animations:)/);
  for (const block of blocks) {
    if (!/rest-idle \(south,/.test(block)) continue;
    const urls = block.match(/https:\/\/[^\s,]+/g) || [];
    const southUrls = urls.filter(u => u.includes('/south/'));
    if (southUrls.length > 0) {
      // Sort by trailing frame number for stable ordering
      southUrls.sort((a, b) => {
        const na = parseInt(a.match(/(\d+)\.png$/)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/(\d+)\.png$/)?.[1] ?? '0', 10);
        return na - nb;
      });
      return southUrls;
    }
  }
  return [];
}

function writeAnimationIndex(allFrames) {
  // Map: { breedPrefix: [frame1Path, frame2Path, ...] }
  // Merge in-memory results with on-disk frames so a failed run doesn't
  // wipe out progress from a previous successful run.
  const map = {};
  for (const [prefix, frames] of Object.entries(allFrames)) {
    map[prefix] = frames.map((_, i) => `/assets/horses/animations/${prefix}_idle_${i}.png`);
  }
  // Sweep OUTPUT_DIR for any *_idle_*.png files not already in the map.
  if (fs.existsSync(OUTPUT_DIR)) {
    const onDisk = fs.readdirSync(OUTPUT_DIR);
    for (const file of onDisk) {
      const match = file.match(/^([a-z]+)_idle_(\d+)\.png$/);
      if (!match) continue;
      const prefix = match[1];
      const idx = parseInt(match[2], 10);
      if (!map[prefix]) map[prefix] = [];
      if (!map[prefix][idx]) map[prefix][idx] = `/assets/horses/animations/${file}`;
    }
    // Compact any sparse arrays (drop nulls) so cycling is smooth.
    for (const prefix of Object.keys(map)) {
      map[prefix] = map[prefix].filter(Boolean);
    }
  }
  const banner = '// AUTO-GENERATED by scripts/generate-idle-animations.mjs. Do not edit by hand.\n';
  const body = `
export const IDLE_ANIMATIONS = ${JSON.stringify(map, null, 2)};
`;
  fs.writeFileSync(INDEX_PATH, banner + body);
  logStep(`Wrote animation index with ${Object.keys(map).length} breeds`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const state = loadState();
  const allFrames = {};

  if (DRY_RUN) {
    console.log(`Would generate idle animations for ${BREED_POOL.length} breeds:`);
    for (const b of BREED_POOL) console.log(`  - ${b.id} (${b.prefix})`);
    return;
  }

  logStep(`Generating idle animations for ${BREED_POOL.length} breeds`);

  for (let i = 0; i < BREED_POOL.length; i++) {
    const breed = BREED_POOL[i];
    logStep(`--- ${breed.id} (${breed.prefix}) ---`);
    try {
      // Always wait between creates. After the very first breed, also wait.
      if (i > 0) {
        logStep(`  waiting ${CREATE_DELAY_MS / 1000}s before next create (gentler retry)`);
        await new Promise(r => setTimeout(r, CREATE_DELAY_MS));
      }
      const frames = await generateForBreed(breed, state);
      // Save any frames we got
      const savedFrames = [];
      if (Array.isArray(frames)) {
        for (let f = 0; f < frames.length; f++) {
          const frame = frames[f];
          const outPath = path.join(OUTPUT_DIR, `${breed.prefix}_idle_${f}.png`);
          if (frame.existing) {
            // Resumed from disk — verify it still exists, then record the path.
            if (fs.existsSync(frame.path)) savedFrames.push(frame.path);
          } else if (frame.data || frame.url) {
            const bytes = await downloadImage(frame, outPath);
            logStep(`  saved ${breed.prefix}_idle_${f}.png (${bytes} bytes)`);
            savedFrames.push(outPath);
          }
        }
      }
      if (savedFrames.length > 0) {
        allFrames[breed.prefix] = savedFrames;
        state[breed.id].frames = savedFrames;
        saveState(state);
      } else {
        logStep(`  no frame data extracted — check get_animation response shape`);
      }
    } catch (err) {
      logStep(`  ERROR: ${err.message}`);
      state[breed.id] = { ...(state[breed.id] || {}), error: err.message };
      saveState(state);
    }
  }

  writeAnimationIndex(allFrames);
  logStep('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
