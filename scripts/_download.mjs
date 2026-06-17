#!/usr/bin/env node
// One-off: download a specific character's image and save to assets/horses/<id>.png.
// Usage: node scripts/_download.mjs <character_id> <output_id>

import fs from 'fs';
import path from 'path';

const TOKEN = process.env.PIXELLAB_API_KEY;
if (!TOKEN) { console.error('PIXELLAB_API_KEY not set'); process.exit(1); }

const characterId = process.argv[2];
const outputId = process.argv[3];
if (!characterId || !outputId) { console.error('Usage: _download.mjs <character_id> <output_id>'); process.exit(1); }

const r = await fetch('https://api.pixellab.ai/mcp', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_character', arguments: { character_id: characterId, include_preview: true } } })
});
const text = await r.text();
const dataLine = text.split('\n').find(l => l.startsWith('data: '));
const data = JSON.parse(dataLine.slice(6));
const content = data.result.content;
const img = content.find(c => c.type === 'image');
if (!img) { console.error('No image in response'); process.exit(1); }
const buf = Buffer.from(img.data, 'base64');
const outPath = path.resolve('assets/horses', `${outputId}.png`);
fs.writeFileSync(outPath, buf);
console.log(`Saved ${outPath}: ${buf.length} bytes`);
