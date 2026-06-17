// Personal monologues.
//
// McCarthy: the earned code is the unspoken one. The horse has a
// soul. The horse speaks in fragments, not full sentences.
//
// These monologues are 2-3 line first-person fragments in the horse's
// voice. McCarthy economy. No quotation marks. Capital-letter voice.
//
// The monologue is shaped by:
// - The horse's life stage (foals are wide-eyed, retirees are quiet)
// - The horse's mood (calm, intense, proud)
// - The horse's role and temperament
// - The horse's bond with the player (low bond = guarded, high bond = honest)
// - Whether the horse is the legendary one (gets the picturebook line)

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Stage fragments. The horse's voice changes as it ages.
const STAGE_VOICES = {
  foal: [
    'Everything is too big. The barn door is the size of a cliff.',
    'I do not know what a hand is yet. The hand is warm. That is enough.',
    'She comes to the fence every morning. I think I know her smell.',
  ],
  weanling: [
    'I learned to walk on four legs without thinking about it. Now I have to learn everything else.',
    'The mare is not here anymore. They say she is in the pasture behind the house.',
    'I am taller than the other foals. I do not know what to do with that yet.',
  ],
  yearling: [
    'The work is light. I learn the shape of it without the weight.',
    'I have not been to a show yet. I have not been anywhere.',
  ],
  two_year_old: [
    'The work gets harder. I am not sure if I am ready or if I am about to find out.',
    'The hand on the lead rope is the same one. That is how I know where I am.',
  ],
  campaigner: [
    'I know the arena. The dirt has a smell. The gate has a sound.',
    'They have put me in the ring four times. I have won two. I remember both.',
    'The hardest part is not the run. The hardest part is the quiet in the stall before.',
  ],
  retiree: [
    'I do not run anymore. The pasture is enough.',
    'I can hear the new foals at night. They sound like I did.',
    'The hand still comes. The hand does not ask anything of me anymore. That is the gift.',
  ],
};

// Mood fragments. The way the horse talks about its life shifts with
// how it feels right now.
const MOOD_FRAGMENTS = {
  calm: [
    'The work is the work. I do not mind it.',
    'I am not afraid of the gate. The gate is a place I have been.',
    'They are easy with me. I am easy with them.',
  ],
  intense: [
    'I do not trust the hand today. The hand is the same. I am not.',
    'The arena smells wrong. Something is coming. I do not know what.',
    'I want to run. There is nowhere to run. That is the trouble.',
  ],
  proud: [
    'The last run was clean. The hand knew what I was going to do before I did.',
    'I have been working. The work is showing.',
    'They brought me to the front of the barn. They put a ribbon on the stall. I do not know what for, but I know what it means.',
  ],
};

// Bond-dependent closing fragments. Low bond: guarded. High bond: honest.
const BOND_FRAGMENTS_LOW = [
  'I do not know whose hand that is yet.',
  'I am watching. I have not decided.',
  'They are new. I have seen them before. I am not sure what to do with that.',
];

const BOND_FRAGMENTS_HIGH = [
  'The hand is the hand. There is only one. I know it the way I know my own name.',
  'I would let them put a halter on me in the dark.',
  'I am theirs the way the barn is theirs. I have decided.',
];

// Legendary horses get the picturebook line.
const LEGENDARY_VOICES = [
  'They brought me off the high country in a stock trailer. I kicked the sidewall in twice. They came back anyway. That is how I know what kind of hand this is.',
  'I have been ridden by seven people. Six of them did not survive the second turn. The seventh one did. That is the one I kept.',
  'There is a foal in the lower pasture who watches me. I do not know what she sees. I know what I would tell her if she could hear me.',
];

function pickFrom(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// Build a 2-3 sentence personal monologue for a horse.
//
// Lines are picked from three pools (stage, mood, bond) and assembled
// in McCarthy cadence: stage fragment, mood fragment, bond close.
// Legendary horses get a picturebook lead instead.
export function personalMonologue(horse, rng = Math.random) {
  if (!horse) return '';
  const lines = [];

  if (horse.legendary) {
    lines.push(pickFrom(LEGENDARY_VOICES, rng));
  } else {
    const stage = horse.stageId ?? horse.lifeStageId ?? 'campaigner';
    const stageFragment = pickFrom(STAGE_VOICES[stage] ?? STAGE_VOICES.campaigner, rng);
    lines.push(stageFragment);
  }

  const mood = horse.mood ?? 'calm';
  const moodFragment = pickFrom(MOOD_FRAGMENTS[mood] ?? MOOD_FRAGMENTS.calm, rng);
  lines.push(moodFragment);

  const bond = horse.bond ?? 0;
  const bondFragment = pickFrom(bond >= 50 ? BOND_FRAGMENTS_HIGH : BOND_FRAGMENTS_LOW, rng);
  lines.push(bondFragment);

  return lines.join(' ');
}

// Render the monologue as a section in the horse detail modal.
// McCarthy style: no quotation marks, italic Cormorant body, small
// eyebrow that reads "THE HORSE" in Rye caps.
export function renderMonologue(horse) {
  if (!horse) return '';
  const text = personalMonologue(horse);
  return `
    <section class="bill-section monologue">
      <h3 class="eyebrow">The horse</h3>
      <p class="monologue-text">${escapeHtml(text)}</p>
    </section>
  `;
}