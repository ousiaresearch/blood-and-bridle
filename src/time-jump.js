// Time-jump card — the 1883 / 1923 style device.
//
// Sheridan: a hard cut to black. White centered serif text fades in.
// Three lines, descending size: year range, location, season. No
// animation, no music sting, no logo. Pure text-on-black. Holds 3-5
// seconds, then hard cuts to the new scene.
//
// In Blood & Bridle, this fires on every season boundary. The
// location is the player's ranch name (or "Montana" by default).
// The year is the in-game year. The season is the new season.
//
// The card is rendered into the DOM, fades in over 800ms, holds for
// 2.5s, fades out over 800ms, then removes itself. The render()
// caller is responsible for the hard cut before the new season loads.
//
// Usage:
//   import { fireTimeJumpCard } from './time-jump.js';
//   fireTimeJumpCard({ year: 2, location: 'Hat Creek', season: 'Winter' });

const FADE_IN_MS = 800;
const HOLD_MS = 2500;
const FADE_OUT_MS = 800;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Render the card HTML. The container is fixed full-screen with the
// pure black background and the white text centered.
function renderCard({ year, location, season }) {
  return `
    <div class="time-jump" role="status" aria-live="polite">
      <div class="time-jump-inner">
        <p class="time-jump-line time-jump-line--year">Year ${escapeHtml(String(year))}</p>
        <p class="time-jump-line time-jump-line--location">${escapeHtml(location)}</p>
        <p class="time-jump-line time-jump-line--season">${escapeHtml(season)}</p>
      </div>
    </div>
  `;
}

// Fire the card. Returns a Promise that resolves when the card has
// faded out. The card is appended to document.body and removed on
// completion.
export function fireTimeJumpCard({ year, location, season }) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve();
    const wrap = document.createElement('div');
    wrap.innerHTML = renderCard({ year, location, season });
    const card = wrap.firstElementChild;
    if (!card) return resolve();
    document.body.appendChild(card);
    // Force reflow so the transition fires on insert.
    void card.offsetHeight;
    card.classList.add('time-jump--visible');

    setTimeout(() => {
      card.classList.remove('time-jump--visible');
      card.classList.add('time-jump--fading');
      setTimeout(() => {
        card.remove();
        resolve();
      }, FADE_OUT_MS);
    }, HOLD_MS);
  });
}

// Default location if the ranch has not set one. Sheridan films in
// Montana; the default is a quiet homage.
export function defaultLocation(game) {
  if (game?.ranchName?.trim()) return game.ranchName.trim();
  return 'Montana';
}

// Convenience: fire the card for a season boundary, given the post-
// boundary game state. Reads year/location/season from game.
export function fireSeasonCard(game) {
  const year = Math.floor(((game?.day ?? 1) - 1) / 120) + 1;
  const seasonIndex = Math.floor(((game?.day ?? 1) - 1) % 120 / 30);
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  return fireTimeJumpCard({
    year,
    location: defaultLocation(game),
    season: seasons[seasonIndex] ?? 'Spring',
  });
}