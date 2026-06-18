// Blood & Bridle — the voices of the hands.
//
// The five hands each have a *voice*: how they talk, what they notice,
// what they argue for and against at the kitchen table. When a scene
// fires (src/scenes.js), it picks speakers from this file and reads
// their lines out. The voice is independent of the hand's current
// morale — morale gates *whether* they speak, not *how*.
//
// Voice shape:
//   - voice: 'blunt' | 'quiet' | 'physical' | 'ledger' | 'clinical'
//   - cadence: short phrases they reach for
//   - stance: opinion map for the topics that come up at the table.
//     'for' = argues for this, 'against' = argues against,
//     'mixed' = sees both sides, 'silent' = doesn't speak to this.
//   - moraleGates: { speaksBelow, advocatesAbove } — a hand whose
//     morale is below `speaksBelow` says nothing; above
//     `advocatesAbove` they push their stance strongly.
//
// Sheridan: the voice is what makes the bunkhouse a room. Mae's
// blunter than Eli. Eli won't say "I quit" out loud — he'll just
// be quieter. Reyes talks about horses, not people. Elena quotes
// the ledger. Voss gives you numbers with his feelings attached.

export const HAND_VOICES = Object.freeze({
  mae: {
    id: 'mae',
    name: 'Mae Calder',
    role: 'Head trainer',
    voice: 'blunt',
    cadence: 'Short declarative. Cuts to the horse.',
    openers: [
      "Here's the thing about that.",
      "I'm just going to say it.",
      "Let me tell you what I see.",
      "You asked, so I'll tell you.",
    ],
    closers: [
      "That's all I got.",
      "I'm done talking about it.",
      "You do what you want.",
      "Just don't ask me after.",
    ],
    stance: {
      farrier: 'for',          // believes in doing it right
      wages: 'mixed',           // knows the hands need paid, knows the ranch is short
      vetCare: 'for',           // a horse in pain ends careers
      skipTraining: 'against',  // her job is the training
      sellHorse: 'mixed',       // has favorites
      buyLand: 'for',           // the more land, the more horse
      developerDeal: 'against', // this is a working ranch
      newHand: 'mixed',         // she's been the new hand
    },
    moraleGates: { speaksBelow: 30, advocatesAbove: 70 },
    portraitBase: '/assets/people/hands/mae',
  },
  eli: {
    id: 'eli',
    name: 'Eli Rusk',
    role: 'Ranch hand',
    voice: 'quiet',
    cadence: 'Long pauses. Indirect. Says what he means by what he doesn\'t say.',
    openers: [
      "Well.",
      "I don't know.",
      "You probably already thought of this.",
      "Just so you know.",
    ],
    closers: [
      "Either way.",
      "It's your place.",
      "I just work here.",
      "I'll do what you say.",
    ],
    stance: {
      farrier: 'mixed',
      wages: 'for',             // he knows what it's like to wait
      vetCare: 'mixed',
      skipTraining: 'silent',
      sellHorse: 'mixed',
      buyLand: 'mixed',
      developerDeal: 'against', // grew up on this stretch
      newHand: 'for',           // was the new hand once
    },
    moraleGates: { speaksBelow: 40, advocatesAbove: 80 },
    portraitBase: '/assets/people/hands/eli',
  },
  reyes: {
    id: 'reyes',
    name: 'Reyes Two Horses',
    role: 'Stallion handler',
    voice: 'physical',
    cadence: 'Present tense. Talks about horses, not people. The stallion did this, the mare did that.',
    openers: [
      "Watched him this morning.",
      "The gray mare — ",
      "Yesterday in the pen — ",
      "I'll tell you what the bay did.",
    ],
    closers: [
      "That's what the horse thinks.",
      "Up to you.",
      "I'm back to the stallion.",
      "He doesn't lie.",
    ],
    stance: {
      farrier: 'mixed',
      wages: 'silent',
      vetCare: 'for',           // a stallion with bad feet is no stallion
      skipTraining: 'against',
      sellHorse: 'mixed',       // sees the horse's side
      buyLand: 'mixed',
      developerDeal: 'silent',
      newHand: 'mixed',
    },
    moraleGates: { speaksBelow: 35, advocatesAbove: 75 },
    portraitBase: '/assets/people/hands/reyes',
  },
  elena: {
    id: 'elena',
    name: 'Elena Marsh',
    role: 'Bookkeeper',
    voice: 'ledger',
    cadence: 'Quotes the books. Numbers with a beat. Dry.',
    openers: [
      "The spreadsheet says — ",
      "Looking at the last quarter — ",
      "If you want my pencil — ",
      "I'm just the bookkeeper, but — ",
    ],
    closers: [
      "Numbers don't have feelings.",
      "I just work the column.",
      "Your call.",
      "It's in the book either way.",
    ],
    stance: {
      farrier: 'for',           // cheap relative to a sick horse
      wages: 'for',             // predictable, contractual
      vetCare: 'mixed',         // expensive but documented
      skipTraining: 'against',  // unrecouped investment
      sellHorse: 'for',         // liquidity math
      buyLand: 'against',       // debt service nightmare
      developerDeal: 'mixed',   // big number, complicated number
      newHand: 'for',           // wage is line item, not mood
    },
    moraleGates: { speaksBelow: 25, advocatesAbove: 80 },
    portraitBase: '/assets/people/hands/elena',
  },
  'cordell-voss': {
    id: 'cordell-voss',
    name: 'Dr. Cordell Voss',
    role: 'Veterinarian',
    voice: 'clinical',
    cadence: 'Diagnostic. Calm. Says the prognosis out loud.',
    openers: [
      "Clinically — ",
      "I've seen this before.",
      "I'll tell you straight.",
      "Three things, in order.",
    ],
    closers: [
      "That's the case.",
      "Your decision.",
      "I'll do what I can.",
      "Time is the variable.",
    ],
    stance: {
      farrier: 'for',
      wages: 'silent',
      vetCare: 'for',           // his whole reason for being here
      skipTraining: 'silent',
      sellHorse: 'mixed',
      buyLand: 'silent',
      developerDeal: 'silent',
      newHand: 'silent',
    },
    moraleGates: { speaksBelow: 30, advocatesAbove: 70 },
    portraitBase: '/assets/people/hands/cordell-voss',
  },
});

// Map hand id → voice record.
export function voiceForHand(handId) {
  return HAND_VOICES[handId] ?? null;
}

// Will this hand speak in this scene at this morale?
export function shouldSpeak(handId, morale) {
  const v = voiceForHand(handId);
  if (!v) return false;
  return morale >= v.moraleGates.speaksBelow;
}

// Will this hand advocate (push their stance hard) at this morale?
export function shouldAdvocate(handId, morale) {
  const v = voiceForHand(handId);
  if (!v) return false;
  return morale >= v.moraleGates.advocatesAbove;
}

// Render a hand's line at the kitchen table. Returns null if the hand
// is silent. Combines opener + (topic-specific line) + closer based on
// whether they're advocating, neutral, or reluctant.
//
// `topic` is one of the keys in voice.stance (e.g. 'farrier').
// `topicLines` is a { neutral, advocating, reluctant } map of lines for
// this specific scene/topic. Falls back to a generic if not provided.
export function renderHandLine(handId, topic, opts = {}) {
  const v = voiceForHand(handId);
  if (!v) return null;
  const morale = opts.morale ?? 60;
  if (!shouldSpeak(handId, morale)) return null;

  const stance = v.stance[topic] ?? 'silent';
  if (stance === 'silent') return null;

  const advocate = shouldAdvocate(handId, morale);
  const mood = advocate ? 'advocating' : 'neutral';

  // Pick a topic line, falling back to stance-driven defaults.
  const topicLines = opts.topicLines ?? {};
  let line = topicLines[mood] ?? topicLines.neutral ?? null;

  if (!line) {
    // Generic fallback — keeps the kitchen table moving even if the
    // scene-specific line wasn't authored yet.
    const stanceMap = {
      for: `I'm for it.`,
      against: `I'm against it.`,
      mixed: `I see both sides.`,
      silent: null,
    };
    line = stanceMap[stance];
    if (!line) return null;
  }

  // Compose: opener + line + closer. Don't always use all three —
  // cadence varies. The scene can override by passing `composition`.
  const composition = opts.composition ?? 'singleton';
  if (composition === 'singleton') return line;
  if (composition === 'open-and-line') {
    const opener = pick(v.openers);
    return `${opener} ${line}`;
  }
  if (composition === 'line-and-close') {
    const closer = pick(v.closers);
    return `${line} ${closer}`;
  }
  if (composition === 'full') {
    const opener = pick(v.openers);
    const closer = pick(v.closers);
    return `${opener} ${line} ${closer}`;
  }
  return line;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}