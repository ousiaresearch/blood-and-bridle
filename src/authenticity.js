// Costco Cowgirl authenticity detector.
//
// AQHA rule: the "Cowboy" division requires 90+ days of full-time
// ranch employment to compete. In current 2024-2026 culture: a real
// rancher reads Beth Dutton as cringe and Kayce as the only correct
// look. A "Costco cowgirl" is someone who has the gear without the
// labor — Stetson + pearl-snap + boots, no fence line ever memorized.
//
// In Blood & Bridle, this detector measures the player's labor-to-
// cash ratio. If cash is high but labor is low, the game surfaces
// quiet NPC judgment — not punishment, but the world noticing.
//
// The detector is pure: takes game state, returns an authenticity
// score 0..100, plus per-NPC notes for any NPC who would comment.
//
// Authenticity score:
// - 100 = labor-rich, low cash (real rancher, broke)
// - 0 = gear-rich, no labor (Costco cowgirl)
// - 50 = balanced (most players land here)

const LABOR_KEYWORDS = [
  'worked',
  'trained',
  'treated',
  'rotated',
  'advanced',
  'preventive',
  'Mae',
  'Eli',
  'Voss',
  'sold',
  'foaled',
  'bred',
  'Champion',
  'won',
  'placed',
  'arena',
  'pasture',
  'preventive care',
  'hay deal',
];

// Default comments from each NPC, applied in the right situation.
const NPC_COMMENTS = {
  'mae': [
    'You have not asked me to train a horse in a season. The dust is settling in the arena.',
    'I have not seen you in the ring. The ring has not seen you either.',
  ],
  'eli': [
    'You have not asked me about the hay. The hay is still here. So am I.',
    'I know every fence line on this place. I do not know what you know.',
  ],
  'ranch-cordell': [
    'I watched you drive past the south fence without slowing down. The south fence is the one that needs slowing down for.',
  ],
  'dr-voss': [
    'I have not walked your herd this season. The herd would like to be walked.',
  ],
  'dev-coleman': [
    'You have the look of someone who has not been thrown yet. You have the cash of someone who has not earned it.',
  ],
  'banker-ortega': [
    'Your account is healthy. The hands do not match.',
  ],
  'sister-elena': [
    'I came out to help. You have not needed me yet. That is fine. That is also the problem.',
  ],
};

export function detectAuthenticity(game) {
  if (!game) return { score: 50, observations: [], npcNotes: [] };

  // Count labor mentions in the log.
  const log = game.log ?? [];
  const laborMentions = log.filter((line) =>
    LABOR_KEYWORDS.some((kw) => line.toLowerCase().includes(kw.toLowerCase()))
  ).length;

  // Cash ratio: cash / (labor days * 200 + 1). High cash + low labor = low authenticity.
  const cash = game.cash ?? 0;
  const labor = Math.max(1, laborMentions);
  // Logarithmic scale: each $10k with no labor is a ding.
  const cashPenalty = Math.max(0, Math.log10(cash / 1000) - 1); // $10k = 0, $100k = 1, $1M = 2
  // Labor bonus: each labor log line is +5, capped at 50.
  const laborBonus = Math.min(50, labor * 5);
  const score = Math.max(0, Math.min(100, Math.round(50 - cashPenalty * 15 + laborBonus)));

  // Determine which NPCs would comment.
  const observations = [];
  const npcNotes = [];
  if (score < 60 && cash > 25000) {
    observations.push(`Cash on hand: $${cash.toLocaleString()}. Labor logged: ${labor} entries.`);
    // Pick the 1-2 most-relevant NPCs based on game state.
    if (labor < 5) {
      npcNotes.push({ npcId: 'eli', line: NPC_COMMENTS.eli[0] });
      npcNotes.push({ npcId: 'mae', line: NPC_COMMENTS.mae[Math.floor(Math.random() * NPC_COMMENTS.mae.length)] });
    }
    if (cash > 50000) {
      npcNotes.push({ npcId: 'banker-ortega', line: NPC_COMMENTS['banker-ortega'][0] });
      npcNotes.push({ npcId: 'dev-coleman', line: NPC_COMMENTS['dev-coleman'][0] });
    }
    if (game.legacy > 50 && labor < 10) {
      npcNotes.push({ npcId: 'sister-elena', line: NPC_COMMENTS['sister-elena'][0] });
    }
  }

  return { score, observations, npcNotes, laborMentions: labor };
}

// Pure render: a banner that surfaces the authenticity report. Only
// shows when the score is below 70 and cash is significant. Sits on
// the dashboard above the verdict.
export function renderAuthenticityBanner(game) {
  const result = detectAuthenticity(game);
  if (result.score >= 70 || (game.cash ?? 0) < 25000) return '';
  const label = result.score < 35 ? 'Costco cowgirl' : result.score < 55 ? 'Tourist in pearl snaps' : 'Working through it';
  const npcCommentsHtml = result.npcNotes.length > 0
    ? `<ul class="authenticity-comments">${result.npcNotes.map((n) => `<li><span class="authenticity-npc">${escapeHtml(n.npcId)}:</span> <em>${escapeHtml(n.line)}</em></li>`).join('')}</ul>`
    : '';
  return `
    <section class="authenticity-banner">
      <p class="eyebrow">Authenticity read</p>
      <h3>${escapeHtml(label)}</h3>
      <p class="authenticity-detail">${escapeHtml(result.observations.join(' '))}</p>
      ${npcCommentsHtml}
    </section>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}