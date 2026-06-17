#!/usr/bin/env node
/**
 * build-manifest.mjs
 *
 * Generates scripts/portraits-manifest.json — 90 entries (6 breeds ×
 * 5 life stages × 3 moods) with breed-specific descriptions.
 *
 * The descriptions are the visual prompt given to PixelLab. Each one
 * names the breed, the coat, the build, the life stage, and the mood —
 * enough specificity that the artist can draw a recognizable individual
 * of the breed without spelling out every anatomical detail.
 *
 * Reads breed profiles from src/horse.js. Stage and mood templates are
 * inline below. To add a breed or a stage, edit the pool/template and
 * re-run; the manifest is fully derived.
 *
 * Usage:
 *   node scripts/build-manifest.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BREED_POOL } from '../src/horse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, 'scripts', 'portraits-manifest.json');

const STAGES = ['foal', 'yearling', 'prospect', 'campaigner', 'retiree'];
const MOODS = ['calm', 'intense', 'proud'];

// ----- Stage templates -----
// A short noun phrase that places the horse in its life stage. The breed
// label and mood follow.
const STAGE_NOUN = {
  foal:      'A newborn foal, wobbly legs and oversized head, the world still a question',
  yearling:  'A gangly yearling, half-grown, long legs not yet filled in',
  prospect:  'A 2-year-old prospect, almost full size, ready for light work',
  campaigner:'A seasoned campaigner, in their prime, in steady work',
  retiree:   'A retired veteran, grey around the muzzle, slower but wise',
};

// ----- Mood templates -----
// The emotional read of the portrait. A single short sentence that closes
// the description. We avoid "the eye is calm" etc — the PixelLab renderer
// works better with concrete posture cues.
const MOOD_CODA = {
  calm:     'Soft eye, head lowered, one hind hoof resting. The pasture is enough.',
  intense:  'Ears pricked forward, nostrils flared, one front hoof pawing the dust. Coiled and ready.',
  proud:    'Head high, neck arched, tail carried like a banner. Past the camera, past the rider, past the years.',
};

// ----- Breed profile coda -----
// Per-breed visual signature appended to the description so PixelLab draws
// a recognizable individual, not a generic horse.
// No trailing period — the joiner adds it.
const BREED_CODA = {
  quarter_horse:  'The compact, heavy-muscled build of the working cutting horse. Bay, sorrel, or palomino coat, kind eye, broad chest, the horse that made the West',
  appaloosa:      'The colorful Northwest stock horse. Spotted blanket over the rump, white sclera showing in the eye, mottled skin around the muzzle. Chestnut base coat with the Appaloosa pattern',
  paint_horse:    'Tobiano patches of dark and white crossing the back, dark legs, bald face. The pinto stock horse, Quarter Horse build underneath the color',
  arabian:        'The refined desert breed. Dished face, large dark eyes, arched neck, high-carried tail, fine bone. Grey or chestnut coat, the oldest refined breed',
  thoroughbred:   'The long-legged runner. Deep chest, lean muscle, tall frame, often white socks and a star. Bay or chestnut, the athlete of the show string',
  andalusian:     'The baroque war horse. Convex profile, powerful hindquarters, thick neck, broad chest, thick flowing mane and tail. Predominantly grey, dappled. The original blood of the bridle',
};

// ----- Compose -----

function describe(breed, stage, mood) {
  // The structure is: [Stage noun]. [Breed coda]. [Mood coda].
  // Order matters — PixelLab reads the prompt sequentially and locks in
  // the early phrases as the strongest visual cues.
  return [
    STAGE_NOUN[stage],
    BREED_CODA[breed.id],
    MOOD_CODA[mood],
  ].join('. ');
}

function main() {
  const manifest = [];
  for (const breed of BREED_POOL) {
    for (const stage of STAGES) {
      for (const mood of MOODS) {
        const id = `${breed.prefix}_${stage}_${mood}`;
        manifest.push({
          id,
          breed: breed.id,
          lifeStage: stage,
          mood,
          description: describe(breed, stage, mood),
          view: 'side',
          size: 64,
        });
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${manifest.length} entries to ${path.relative(ROOT, OUT)}`);
  // Show a couple of samples for the log.
  for (const sample of [manifest[0], manifest[45], manifest[89]]) {
    console.log(`\n[${sample.id}]`);
    console.log(`  ${sample.description}`);
  }
}

main();
