#!/usr/bin/env node
// Loads MINIMAX_API_KEY from the user's shell rc, then runs a delegated
// script with the key in env. Avoids leaking the key into agent-visible
// output by never printing it -- we only confirm presence + length.
//
// Usage: node scripts/run-with-key.mjs <script-to-run> [args...]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const targetScript = process.argv[2];
if (!targetScript) {
  console.error('Usage: node scripts/run-with-key.mjs <script> [args...]');
  process.exit(2);
}

const candidates = [
  path.join(os.homedir(), '.zshrc'),
  path.join(os.homedir(), '.bashrc'),
  path.join(os.homedir(), '.zshenv'),
];

let keyLine = null;
for (const f of candidates) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  const m = content.match(/^export\s+MINIMAX_API_KEY=(.+)$/m);
  if (m) { keyLine = m[1]; break; }
}

if (!keyLine) {
  console.error('MINIMAX_API_KEY not found in any shell rc');
  process.exit(1);
}

// Strip the surrounding quotes from the value
const key = keyLine.replace(/^["']|["']$/g, '');

if (key.length < 20) {
  console.error(`MINIMAX_API_KEY looks too short (${key.length} chars), aborting`);
  process.exit(1);
}

console.log(`[run-with-key] MINIMAX_API_KEY found (${key.length} chars), launching ${targetScript}`);

const result = spawnSync('node', [targetScript, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, MINIMAX_API_KEY: key },
  shell: false,
});

process.exit(result.status ?? 1);
