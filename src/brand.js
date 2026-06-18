// The player's ranch brand.
//
// Sheridan-true: wordmark and brand are unified. The chosen brand
// travels everywhere — header, ledger cover, bills of sale, horse
// portrait hip stamps (UI-only), dynasty export cover, title card.
//
// The canonical Blood & Bridle brand is Brand B: a B with a horizontal
// bar below, burned into weathered wood. It has an `imagePath` so the
// game renders the actual artwork rather than a Unicode glyph. The
// remaining BRAND_SET entries stay as a curated picker — cattle-trade
// tradition lets a ranch carry any symbol they please — but they render
// as text glyphs (the .ranch-brand--glyph fallback).
//
// Phase 14 — brand surfaces. The Codex-generated images at
// /assets/brand/surfaces/* show the brand in context: burned into
// the gate, stamped on the hay barn, painted on the truck door, etc.
// These render wherever the player encounters the brand in the world:
// the title-card backdrop, the ranch-profile modal, the dynasty
// export letterhead, and the heir-arrival scene.

export const BRAND_SET = [
  { id: 'bar-b',     symbol: 'B\u0304',  label: 'B bar',     hint: 'Blood & Bridle, branded. The canonical mark: B with a bar, burned into wood.', imagePath: '/assets/brand/canonical.png' },
  { id: 'y-bar',     symbol: 'Y\u0304',  label: 'Y bar',     hint: 'The classic. A capital Y with a bar above.' },
  { id: 'bar-y',     symbol: '\u0304Y',  label: 'Bar Y',     hint: 'Reversed. The bar leads, the Y follows.' },
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

export const DEFAULT_BRAND_ID = 'bar-b';

// Phase 14 — brand surfaces. The Codex-generated close-ups of the
// brand burned/stamped/painted onto real ranch objects. Used by
// renderBrandSurface() to put the brand "in the world" wherever
// it shows up. Each surface has a context (where it's used in the
// game) and an image path.
export const BRAND_SURFACES = Object.freeze({
  // ── Title-card / opening backdrop (high visibility) ────────────
  titleCardDay:   { imagePath: '/assets/brand/surfaces/gate_brand.png',         label: 'The gate, day',           context: 'title-card' },
  titleCardNight: { imagePath: '/assets/brand/surfaces/gate_brand_night.png',   label: 'The gate, night',         context: 'title-card' },
  // ── Working ranch surfaces (mid-zoom) ─────────────────────────
  hayBarnDay:     { imagePath: '/assets/brand/surfaces/hay_barn_brand.png',     label: 'The hay barn',            context: 'ranch-profile' },
  hayBarnEvening: { imagePath: '/assets/brand/surfaces/hay_barn_brand_evening.png', label: 'The hay barn, evening', context: 'ranch-profile' },
  heiferBefore:   { imagePath: '/assets/brand/surfaces/heifer_brand.png',       label: 'Heifer, before the iron', context: 'branding' },
  heiferAfter:    { imagePath: '/assets/brand/surfaces/heifer_brand_done.png',  label: 'Heifer, branded',          context: 'branding' },
  // ── Personal surfaces (close-up) ──────────────────────────────
  jacket:         { imagePath: '/assets/brand/surfaces/jacket_brand.png',       label: 'The rancher\'s jacket',   context: 'letterhead' },
  salve:          { imagePath: '/assets/brand/surfaces/salve_brand.png',        label: 'The liniment tin',        context: 'letterhead' },
  truckStill:     { imagePath: '/assets/brand/surfaces/truck_brand.png',        label: 'The truck door',           context: 'title-card' },
  truckMoving:    { imagePath: '/assets/brand/surfaces/truck_brand_moving.png', label: 'The truck, road-dusted',   context: 'title-card' },
});

// Phase 14 — brand scenes. Wide compositions that include the
// brand in the world. Used as backdrops for the ranch-profile modal
// and the heir-arrival scene.
export const BRAND_SCENES = Object.freeze({
  gate:        { imagePath: '/assets/scenes/brand/gate_scene.png',     label: 'At the gate' },
  brandingDay: { imagePath: '/assets/scenes/brand/branding_scene.png', label: 'Branding day' },
  loss:        { imagePath: '/assets/scenes/brand/brand_loss.png',     label: 'Brand loss' },
});

// Resolve a brand by id with a fallback to the default.
export function brandById(id) {
  return BRAND_SET.find((b) => b.id === id) ?? brandById(DEFAULT_BRAND_ID);
}

// Render the player's brand as an inline stamp. Used in headers,
// bills of sale, the dynasty export, and the Ranch Profile modal.
//
// Brands with an `imagePath` render as <img> (the artwork itself).
// All other brands render as text glyphs (Unicode + combining mark),
// which still travel through save/load with no asset dependency.
export function renderBrandGlyph(brandId, extraClass = '') {
  const brand = brandById(brandId);
  if (brand.imagePath) {
    return `<span class="ranch-brand ranch-brand--${brand.id} ranch-brand--image ${extraClass}" data-brand="${brand.id}" aria-label="${brand.label}"><img class="ranch-brand-image" src="${brand.imagePath}" alt="${brand.label}" /></span>`;
  }
  return `<span class="ranch-brand ranch-brand--${brand.id} ranch-brand--glyph ${extraClass}" data-brand="${brand.id}" aria-label="${brand.label}">${brand.symbol}</span>`;
}

// Phase 14 — render a brand surface (the brand burned into a real
// object). Used in the title-card backdrop, the ranch-profile
// hero image, the dynasty export, and the heir-arrival scene.
//
// @param {string} surfaceKey - key in BRAND_SURFACES
// @param {object} [opts]
// @param {string} [opts.className] - additional CSS class
// @param {string} [opts.fit] - 'cover' (default) or 'contain'
// @returns {string} HTML string for an <img> (or empty string if surface missing)
export function renderBrandSurface(surfaceKey, opts = {}) {
  const surface = BRAND_SURFACES[surfaceKey];
  if (!surface) return '';
  const cls = `brand-surface brand-surface--${surface.context} ${opts.className ?? ''}`;
  return `<img class="${escapeAttr(cls)}" src="${escapeAttr(surface.imagePath)}" alt="${escapeAttr(surface.label)}" data-brand-surface="${escapeAttr(surfaceKey)}" />`;
}

// Phase 14 — render a brand scene (wide composition). Used as a
// backdrop image for modals that include the brand in context.
export function renderBrandScene(sceneKey, opts = {}) {
  const scene = BRAND_SCENES[sceneKey];
  if (!scene) return '';
  const cls = `brand-scene brand-scene--${sceneKey} ${opts.className ?? ''}`;
  return `<img class="${escapeAttr(cls)}" src="${escapeAttr(scene.imagePath)}" alt="${escapeAttr(scene.label)}" data-brand-scene="${escapeAttr(sceneKey)}" />`;
}

// Phase 14 — pick a title-card backdrop. The player sees this every
// time the title card renders. Day surfaces for daytime, night for
// after dusk. Used by app.js to set the hero-backdrop CSS image.
export function pickTitleCardSurface({ isNight = false } = {}) {
  return isNight ? BRAND_SURFACES.titleCardNight : BRAND_SURFACES.titleCardDay;
}

// Build the Ranch Profile modal panel HTML. Used both at save creation
// (new game) and from a settings button during play.
//
// Phase 14 — the modal now opens with the hay-barn brand surface
// visible above the form, so the player sees the brand "in the world"
// before they pick a different one. The surface gives the choice
// texture — what they're picking is the thing that gets burned into
// the hay barn door.
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

  // Phase 14 — surface hero: the hay-barn surface, with the truck
  // surface as the fallback. Both show the brand in the world.
  const surfaceHtml = renderBrandSurface('hayBarnDay', { className: 'ranch-profile-hero-surface' })
    || renderBrandSurface('truckStill', { className: 'ranch-profile-hero-surface' });

  const brandOptions = BRAND_SET.map((b) => {
    const inner = b.imagePath
      ? `<img class="brand-option-image" src="${b.imagePath}" alt="${b.label}" />`
      : `<span class="brand-option-glyph">${b.symbol}</span>`;
    return `<button type="button" class="brand-option ${b.id === game.ranchBrand ? 'brand-option--selected' : ''}" data-brand-id="${b.id}" title="${b.hint}">
      ${inner}
      <small>${b.label}</small>
    </button>`;
  }).join('');

  return `
    <form class="ranch-profile" data-form="ranch-profile">
      ${surfaceHtml}
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
//
// Phase 14 — includes the jacket surface (the rancher's jacket with
// the brand) below the brand mark. The jacket is the most personal
// surface — the brand a person wears, not the brand on a building.
export function renderLetterhead(game) {
  const brand = brandById(game.ranchBrand);
  const ranchName = game.ranchName?.trim() || 'Unbranded';
  const ownerName = game.ownerName?.trim();
  const year = 1; // year 1 — could be computed from day
  const founded = game.foundedDay
    ? `Est. day ${game.foundedDay}`
    : 'Est. day 1';

  const brandMark = brand.imagePath
    ? `<img class="letterhead-brand-image" src="${brand.imagePath}" alt="${brand.label}" />`
    : `<div class="letterhead-brand ranch-brand--${brand.id}">${brand.symbol}</div>`;

  // Phase 14 — jacket surface sits beside the text, showing the
  // brand as the rancher wears it. Falls back to salve surface (the
  // liniment tin with the brand stamped on the lid).
  const jacketSurface = renderBrandSurface('jacket', { className: 'letterhead-jacket' })
    || renderBrandSurface('salve', { className: 'letterhead-jacket' });

  return `
    <div class="letterhead" data-brand="${brand.id}">
      ${brandMark}
      <div class="letterhead-text">
        <h3 class="letterhead-name">${escapeHtml(ranchName)}</h3>
        ${ownerName ? `<p class="letterhead-owner">${escapeHtml(ownerName)} · ${escapeHtml(game.ownerPronouns || '')}</p>` : ''}
        <p class="letterhead-meta">${escapeHtml(founded)} · Year ${year}</p>
      </div>
      ${jacketSurface}
    </div>
  `;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}