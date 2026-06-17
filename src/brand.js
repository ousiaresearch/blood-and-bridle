// The player's ranch brand.
//
// Sheridan: wordmark and brand are unified. The Yellowstone Y with the
// macron above is both the show title AND the cattle brand. For
// Blood & Bridle, the player picks one symbol at save creation. The
// symbol is stamped everywhere: header, ledger cover, bills of sale,
// horse portrait hip stamps (UI-only), and the dynasty export cover.
//
// The brand set is a curated list of livestock-friendly glyphs. They
// are renderable in any font that supports the Unicode range or as a
// CSS-stamped character. We use real Unicode glyphs so the brand
// travels through save/load without asset dependencies.

export const BRAND_SET = [
  { id: 'y-bar',     symbol: 'Y\u0304',  label: 'Y bar',     hint: 'The classic. A capital Y with a bar above.' },
  { id: 'bar-y',     symbol: '\u0304Y',  label: 'Bar Y',     hint: 'Reversed. The bar leads, the Y follows.' },
  { id: 'bar-b',     symbol: 'B\u0304',  label: 'B bar',     hint: 'Blood & Bridle, branded.' },
  { id: 'two-bars',  symbol: '=\u0304',  label: 'Twin bar',  hint: 'Two bars stacked. The fence line.' },
  { id: 'inverted-v',symbol: '\u2227',  label: 'Inverted V',hint: 'The pitchfork brand. Working ranch.' },
  { id: 'bar-seven', symbol: '7\u0304',  label: 'Bar seven', hint: 'Lucky. The seven brand.' },
  { id: 'cross',     symbol: '\u271D',   label: 'Cross',     hint: 'The Iron Cross. Penitente country.' },
  { id: 'diamond',   symbol: '\u25C6',   label: 'Diamond',   hint: 'The Diamond brand. Cattle trade.' },
  { id: 'star',      symbol: '\u2605',   label: 'Star',      hint: 'Five-point. Sheriff country.' },
  { id: 'spur',      symbol: '\u235F',   label: 'Spur',      hint: 'The rowel. Earned not bought.' },
  { id: 'crown',     symbol: '\u265B',   label: 'Crown',     hint: 'The Crown brand. Old money.' },
  { id: 'wing',      symbol: '\u269D',   label: 'Wing',      hint: 'The Wing. Remington country.' },
];

export const DEFAULT_BRAND_ID = 'y-bar';

// Resolve a brand by id with a fallback to the default.
export function brandById(id) {
  return BRAND_SET.find((b) => b.id === id) ?? brandById(DEFAULT_BRAND_ID);
}

// Render the player's brand as an inline stamp. Used in headers,
// bills of sale, the dynasty export, and the Ranch Profile modal.
//
// The macron above Y renders in most browsers via the combining
// character. For fonts that lack combining mark support, the
// --brand-fallback is used (CSS handles the visual).
export function renderBrandGlyph(brandId, extraClass = '') {
  const brand = brandById(brandId);
  return `<span class="ranch-brand ranch-brand--${brand.id} ${extraClass}" data-brand="${brand.id}" aria-label="${brand.label}">${brand.symbol}</span>`;
}

// Build the Ranch Profile modal panel HTML. Used both at save creation
// (new game) and from a settings button during play.
//
// Calls back to the caller via the [data-action] attributes:
// - data-action="save-profile" with hidden form fields
// - data-action="cancel"
// The caller (app.js) wires these to dispatch updateRanchProfile().
export function renderRanchProfile(game) {
  const brand = brandById(game.ranchBrand);
  const ownerName = game.ownerName ?? '';
  const ownerPronouns = game.ownerPronouns ?? '';
  const ranchName = game.ranchName ?? '';

  const brandOptions = BRAND_SET.map((b) =>
    `<button type="button" class="brand-option ${b.id === game.ranchBrand ? 'brand-option--selected' : ''}" data-brand-id="${b.id}" title="${b.hint}">
      <span class="brand-option-glyph">${b.symbol}</span>
      <small>${b.label}</small>
    </button>`
  ).join('');

  return `
    <form class="ranch-profile" data-form="ranch-profile">
      <p class="hint">Stamped in iron at the gate. Visible to every hand, every buyer, every horse.</p>

      <label class="ranch-profile-field">
        <span class="eyebrow">Owner name</span>
        <input type="text" name="ownerName" value="${escapeAttr(ownerName)}" placeholder="Your name" maxlength="48" autocomplete="off" />
      </label>

      <label class="ranch-profile-field">
        <span class="eyebrow">Pronouns</span>
        <input type="text" name="ownerPronouns" value="${escapeAttr(ownerPronouns)}" placeholder="he/him · she/her · they/them" maxlength="32" autocomplete="off" />
      </label>

      <label class="ranch-profile-field">
        <span class="eyebrow">Ranch name</span>
        <input type="text" name="ranchName" value="${escapeAttr(ranchName)}" placeholder="e.g. Hat Creek, Cedar Draw, Cold River" maxlength="48" autocomplete="off" />
      </label>

      <fieldset class="ranch-profile-field">
        <legend class="eyebrow">Brand</legend>
        <div class="brand-picker" role="radiogroup" aria-label="Ranch brand">
          ${brandOptions}
        </div>
        <p class="hint brand-hint">${brand.hint}</p>
      </fieldset>

      <div class="ranch-profile-actions">
        <button type="button" class="action" data-action="cancel">Cancel</button>
        <button type="submit" class="action action--primary">Stamp it</button>
      </div>
    </form>
  `;
}

// Pure render: a "letterhead" block — used at the top of the dynasty
// export, the Memorial Hall cover, and the death/retirement telegram.
// Renders the ranch name + brand + founding year.
export function renderLetterhead(game) {
  const brand = brandById(game.ranchBrand);
  const ranchName = game.ranchName?.trim() || 'Unbranded';
  const ownerName = game.ownerName?.trim();
  const year = 1; // year 1 — could be computed from day
  const founded = game.foundedDay
    ? `Est. day ${game.foundedDay}`
    : 'Est. day 1';

  return `
    <div class="letterhead" data-brand="${brand.id}">
      <div class="letterhead-brand ranch-brand--${brand.id}">${brand.symbol}</div>
      <div class="letterhead-text">
        <h3 class="letterhead-name">${escapeHtml(ranchName)}</h3>
        ${ownerName ? `<p class="letterhead-owner">${escapeHtml(ownerName)} · ${escapeHtml(game.ownerPronouns || '')}</p>` : ''}
        <p class="letterhead-meta">${escapeHtml(founded)} · Year ${year}</p>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}