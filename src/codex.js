// Codex of the Code — earned fragments of the cowboy code, scattered
// through the world. Not flavor text on a poster. Pages the player
// encounters as the game progresses.
//
// Three collections:
// - OWEN: James P. Owen's "Cowboy Ethics" (Wall Street Journal 2003,
//   book 2004, codified by Wyoming as the official state code in 2010).
//   The corporate inspirational packaging of Western values.
// - AUTRY: Gene Autry's Cowboy Code (1940s, written for his young fans).
//   The boy-scout version — useful, but lighter.
// - FOLK: The folk-wisdom fragments that have outlived their origin.
//   Talk low, talk slow, and don't say too much.
//
// Entries are earned at gameplay milestones (legacy thresholds,
// disasters survived, legendary horse unlocks, year boundaries).
// The CODEX_FRAGMENTS_PROVENANCE returns the source/credit for the
// tooltip, not displayed in the modal by default.

export const OWEN_TEN = [
  { id: 'owen-01', text: 'Live each day with courage.' },
  { id: 'owen-02', text: 'Take pride in your work.' },
  { id: 'owen-03', text: 'Always finish what you start.' },
  { id: 'owen-04', text: 'Do what has to be done.' },
  { id: 'owen-05', text: 'Be tough, but fair.' },
  { id: 'owen-06', text: 'When you make a promise, keep it.' },
  { id: 'owen-07', text: 'Ride for the brand.' },
  { id: 'owen-08', text: 'Talk less and say more.' },
  { id: 'owen-09', text: 'Remember that some things aren\u2019t for sale.' },
  { id: 'owen-10', text: 'Know where to draw the line.' },
];

export const AUTRY_TEN = [
  { id: 'autry-01', text: 'The Cowboy must never shoot first, hit a smaller man, or take unfair advantage.' },
  { id: 'autry-02', text: 'He must never go back on his word, or a trust reposed in him.' },
  { id: 'autry-03', text: 'He must always tell the truth.' },
  { id: 'autry-04', text: 'He must be gentle with children, the elderly, and animals.' },
  { id: 'autry-05', text: 'He must not advocate or possess racially or religiously intolerant ideas.' },
  { id: 'autry-06', text: 'He must help people in distress.' },
  { id: 'autry-07', text: 'He must be a good worker.' },
  { id: 'autry-08', text: 'He must keep himself clean in thought, speech, action, and personal habits.' },
  { id: 'autry-09', text: 'He must respect women, parents, and his nation\u2019s laws.' },
  { id: 'autry-10', text: 'He must be a patriot.' },
];

// Folk fragments. The earned code is the unspoken one — these are the
// fragments that survived because someone said them out loud.
export const FOLK_FRAGMENTS = [
  { id: 'folk-01', text: 'Don\u2019t squat with your spurs on.' },
  { id: 'folk-02', text: 'Talk low, talk slow, and don\u2019t say too much.' },
  { id: 'folk-03', text: 'Behind every successful rancher is a wife who works in town.' },
  { id: 'folk-04', text: 'Never approach a bull from the front, a horse from the rear, or a fool from any direction.' },
  { id: 'folk-05', text: 'A man that slows down for snakes might as well walk.' },
  { id: 'folk-06', text: 'He died with his boots on.' },
  { id: 'folk-07', text: 'There\u2019s two things to stay away from in this world — bad women and bad whiskey. The difference is one\u2019ll kill you fast and one\u2019ll kill you slow.' },
  { id: 'folk-08', text: 'If you find yourself in a hole, the first thing to do is stop diggin\u2019.' },
  { id: 'folk-09', text: 'Never miss a good chance to shut up.' },
  { id: 'folk-10', text: 'The safest way to double your money is to fold it over and put it back in your pocket.' },
];

// Lonesome Dove / McMurtry fragments. Earned code is the one that
// lives without saying.
export const MCMURTRY_FRAGMENTS = [
  { id: 'mcmurtry-01', text: 'Talk\u2019s the way to kill it. Anything gets boring if you talk about it enough, even death.' },
  { id: 'mcmurtry-02', text: 'I figured out why you and me get along so well. You know more than you say and I say more than I know.' },
  { id: 'mcmurtry-03', text: 'A man that slows down for snakes might as well walk.' },
  { id: 'mcmurtry-04', text: 'It was some satisfaction to have a thing you could count on, even if it was only the certainty of death.' },
];

export const CODEX_COLLECTIONS = [
  { id: 'owen',     label: 'Owen\u2019s Ten',       subtitle: 'Codified by Wyoming, 2010', entries: OWEN_TEN },
  { id: 'autry',    label: 'Autry\u2019s Code',     subtitle: 'For all of his young fans, 1947', entries: AUTRY_TEN },
  { id: 'folk',     label: 'Folk Wisdom',          subtitle: 'Outlasted their origin', entries: FOLK_FRAGMENTS },
  { id: 'mcmurtry', label: 'The Earned Code',      subtitle: 'From the Hat Creek outfit', entries: MCMURTRY_FRAGMENTS },
];

// Build the full ordered list of every codex entry.
export function allCodexEntries() {
  return CODEX_COLLECTIONS.flatMap((c) =>
    c.entries.map((e) => ({ ...e, collection: c.id, collectionLabel: c.label }))
  );
}

// Which codex entries has this game earned so far? Pure function of
// game state — no DOM, no storage.
//
// Earn rules:
// - Owen 01-04 are earned by legacy thresholds.
// - Owen 05-10 are earned by the harder milestones (disasters survived,
//   show wins, breeding program, legendary horse unlock).
// - Autry entries earned at mid-game milestones.
// - Folk fragments earned early — they are the common wisdom.
// - McMurtry fragments earned by the death of a horse (the earned code
//   is the unspoken one — you earn it by living through a loss).
export function earnedCodexEntries(game) {
  if (!game) return [];
  const entries = [];
  const day = game.day ?? 0;
  const legacy = game.legacy ?? 0;
  const memorials = game.memorials ?? [];
  const horses = game.horses ?? [];

  // Folk: easy — early in the game. The first five are day 1+.
  entries.push('folk-01', 'folk-02', 'folk-04', 'folk-09', 'folk-08');

  // Folk: earned after the first disaster, first show, first sale.
  if (game.firedEvents?.length > 0) entries.push('folk-06');
  if (game.lastShowResult?.result === 'champion') entries.push('folk-10');
  if (memorials.some((m) => m.kind === 'sold')) entries.push('folk-07');
  if (game.developerPressure >= 60) entries.push('folk-03');

  // Owen: earned in waves.
  if (legacy >= 30) entries.push('owen-01', 'owen-02', 'owen-03', 'owen-04');
  if (legacy >= 60) entries.push('owen-05', 'owen-06');
  if (game.legendaryUnlockedDay && day >= game.legendaryUnlockedDay) entries.push('owen-07');
  if (memorials.length >= 2) entries.push('owen-08');
  if (memorials.some((m) => m.kind === 'retirement')) entries.push('owen-09');
  if (game.cash > 60000 && game.legacy > 70) entries.push('owen-10');

  // Autry: earned at mid-game.
  if (day >= 60) entries.push('autry-03', 'autry-06', 'autry-07');
  if (horses.some((h) => h.training >= 70)) entries.push('autry-04');
  if (memorials.length >= 1) entries.push('autry-08');
  if (game.staff?.length >= 3) entries.push('autry-09');

  // McMurtry: earned by the earned code — losing a horse.
  if (memorials.length >= 1) entries.push('mcmurtry-01');
  if (memorials.length >= 3) entries.push('mcmurtry-02', 'mcmurtry-03');
  if (memorials.some((m) => m.kind === 'death' && m.age >= 13)) entries.push('mcmurtry-04');

  // Dedupe.
  return [...new Set(entries)];
}

// Returns the entries the player has not yet earned, with the earn
// condition in human-readable form for the locked view.
export function lockedCodexEntries(game) {
  const earned = new Set(earnedCodexEntries(game));
  const conditions = {
    'folk-01': 'Always available.',
    'folk-02': 'Always available.',
    'folk-03': 'The developer pressure builds past 60.',
    'folk-04': 'Always available.',
    'folk-05': 'Earned by surviving a blizzard.',
    'folk-06': 'After a fired event.',
    'folk-07': 'After selling a horse to someone.',
    'folk-08': 'Always available.',
    'folk-09': 'Always available.',
    'folk-10': 'After a champion title.',
    'owen-01': 'Legacy reaches 30.',
    'owen-02': 'Legacy reaches 30.',
    'owen-03': 'Legacy reaches 30.',
    'owen-04': 'Legacy reaches 30.',
    'owen-05': 'Legacy reaches 60.',
    'owen-06': 'Legacy reaches 60.',
    'owen-07': 'After the legendary horse unlocks.',
    'owen-08': 'After two memorials.',
    'owen-09': 'After a retirement.',
    'owen-10': 'Cash above $60,000 with legacy above 70.',
    'autry-01': 'Reach day 60.',
    'autry-02': 'Reach day 60.',
    'autry-03': 'Reach day 60.',
    'autry-04': 'After training any horse above 70.',
    'autry-05': 'After training any horse above 70.',
    'autry-06': 'Reach day 60.',
    'autry-07': 'Reach day 60.',
    'autry-08': 'After your first memorial.',
    'autry-09': 'After three staff on the ranch.',
    'autry-10': 'Legacy above 90.',
    'mcmurtry-01': 'After your first memorial.',
    'mcmurtry-02': 'After three memorials.',
    'mcmurtry-03': 'After three memorials.',
    'mcmurtry-04': 'After a horse dies at 13 or older.',
  };
  return allCodexEntries()
    .filter((e) => !earned.has(e.id))
    .map((e) => ({ ...e, condition: conditions[e.id] ?? 'Unknown.' }));
}

// Pure render: the codex modal panel HTML. The outer modal is wrapped
// in showModal() by the caller.
export function renderCodex(game) {
  const earned = new Set(earnedCodexEntries(game));
  const locked = lockedCodexEntries(game);
  const earnedCount = earned.size;
  const totalCount = earnedCount + locked.length;

  const collections = CODEX_COLLECTIONS.map((col) => {
    const earnedEntries = col.entries.filter((e) => earned.has(e.id));
    const lockedEntries = col.entries.filter((e) => !earned.has(e.id));
    return `
      <section class="codex-collection" data-collection="${col.id}">
        <header class="codex-collection-head">
          <p class="eyebrow">${col.label}</p>
          <small class="hint">${col.subtitle}</small>
        </header>
        <ol class="codex-list">
          ${earnedEntries.map((e) => `<li class="codex-entry codex-entry--earned"><span class="codex-text">${escapeHtml(e.text)}</span></li>`).join('')}
          ${lockedEntries.map((e) => `<li class="codex-entry codex-entry--locked" title="Not yet earned"><span class="codex-text codex-text--locked">[ locked ]</span></li>`).join('')}
        </ol>
      </section>
    `;
  }).join('');

  return `
    <div class="codex">
      <p class="hint">${earnedCount} of ${totalCount} fragments earned.</p>
      ${collections}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}