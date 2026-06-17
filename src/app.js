import { applyAction, createNewGame, isGameOver, scoreGame, buyAvailableParcel } from './game.js';
import { buildDashboardModel } from './ui.js';
import { buildLineageModel } from './lineage.js';
import { runAuction } from './auction.js';
import { checkEnding } from './endings.js';
import { AVAILABLE_PARCELS } from './map.js';
import { UPGRADES, getUpgradeLabel, canAffordUpgrade } from './upgrades.js';
import { getCurrentTutorialStep, TUTORIAL_STEPS } from './tutorial.js';
import { createAudioEngine } from './audio.js';
import { applyAmbientForGame, chooseAmbientPreset } from './ambient.js';
import { getSeason, getYear, getDayOfSeason } from './seasons.js';
import {
  serializeGame,
  deserializeGame,
  parseJsonExport,
  buildShareLink,
  parseShareLink,
  suggestFilename,
} from './dynasty.js';
import { silhouetteFor, ribbonFor } from './silhouettes.js';
import { preloadPortraits, renderPortrait, getPortraitForHorse, startIdleAnimation } from './portraits.js';
import { soundtrack, playForSeason, playForMood, setSoundtrackMuted, setSoundtrackVolume, stopSoundtrack } from './soundtrack.js';
import { showModal, closeModal } from './modal.js';
import { renderHorseDetail } from './horse-detail.js';
import { buildMemorial, renderMemorial, renderMemorialHall } from './memorial.js';
import { renderCodex } from './codex.js';
import { renderBrandGlyph, renderRanchProfile, renderLetterhead, brandById } from './brand.js';
import { isLegendaryRidden, findLegendary, renderLegendaryBlock } from './legendary.js';
import { fireSeasonCard } from './time-jump.js';
import { renderPasture } from './pasture.js';
import { personalMonologue } from './monologue.js';
import { renderAuthenticityBanner } from './authenticity.js';
const STORAGE_KEY = 'blood-and-bridle-save-v2';

// One audio engine for the whole session. AudioContext is created lazily on
// the first user gesture (browser policy).
const audio = createAudioEngine();
let audioAmbientEnabled = false;

let game = loadGame();
let ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false };

// Preload portraits on startup
preloadPortraits().catch(() => {});
// Start the rest-idle animation cycle after portraits are preloaded.
// This is a no-op if /assets/horses/animations/index.js isn't generated yet.
startIdleAnimation().catch(() => {});

// Initialize soundtrack on first user gesture (handled by audio.resume in playForOutcome)
let soundtrackInitialized = false;

let lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null, season: null };
let pendingShareSnapshot = (() => {
  try {
    return typeof location !== 'undefined' ? parseShareLink(location.hash) : null;
  } catch {
    return null;
  }
})();

const root = document.querySelector('#app');

function loadGame() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : createNewGame();
  } catch {
    return createNewGame();
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bar(value, tone = 'neutral') {
  return `<div class="bar bar--${tone}"><span style="width: ${Math.max(0, Math.min(100, value))}%"></span></div>`;
}

function renderMetric(metric) {
  const flash = metric._flash ? ` ${metric._flash}` : '';
  return `
    <article class="metric${flash}">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
    </article>
  `;
}

function stageClass(stageId) {
  return `life-stage life-stage--${stageId ?? 'dead'}`;
}

function openHorseDetail(horse) {
  const html = renderHorseDetail(horse, game) + renderLegendaryBlock(horse, game);
  showModal(html, { title: horse.name });
}

// Open the Ranch Profile modal. The form is rendered by brand.js.
// Submission and brand selection are wired via event delegation on the
// body (one-shot per modal open).
function openRanchProfile() {
  const html = renderRanchProfile(game);
  showModal(html, { title: 'Ranch profile' });

  // The modal is now in the DOM. Wire the brand picker.
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  const opts = overlay.querySelectorAll('.brand-option');
  const hintEl = overlay.querySelector('.brand-hint');

  opts.forEach((opt) => {
    opt.addEventListener('click', () => {
      opts.forEach((o) => o.classList.remove('brand-option--selected'));
      opt.classList.add('brand-option--selected');
      const id = opt.getAttribute('data-brand-id');
      const brand = brandById(id);
      if (hintEl && brand) hintEl.textContent = brand.hint;
    });
  });

  // Wire the form submission. Read the form fields, dispatch the action.
  const form = overlay.querySelector('[data-form="ranch-profile"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const selectedBrand = overlay.querySelector('.brand-option--selected')?.getAttribute('data-brand-id') ?? game.ranchBrand;
    game = applyAction(game, {
      type: 'updateRanchProfile',
      profile: {
        ownerName: (fd.get('ownerName') ?? '').toString().trim(),
        ownerPronouns: (fd.get('ownerPronouns') ?? '').toString().trim(),
        ranchName: (fd.get('ranchName') ?? '').toString().trim(),
        ranchBrand: selectedBrand,
      },
    });
    audio.resume();
    audio.play('stamp');
    saveGame();
    closeModal();
    render();
  });

  // Cancel button.
  overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    audio.play('click');
    closeModal();
  });
}

// Open the Codex of the Code. Pure render — no form, no submission.
function openCodex() {
  const html = renderCodex(game);
  showModal(html, { title: 'Codex of the Code' });
}

function renderHorse(horse, selectedHorseId) {
  const selected = horse.id === selectedHorseId ? 'card--selected' : '';
  const silhouette = silhouetteFor(horse.stageId);
  const ribbon = ribbonFor(horse.temperament);
  const portraitHtml = renderPortrait(horse);
  return `
    <button class="card horse-card ${selected}" data-select-horse="${escapeHtml(horse.id)}" style="--silhouette: url('${silhouette}')">
      <span class="bloodline-ribbon bloodline-ribbon--${ribbon}">${escapeHtml(horse.role)}</span>
      <strong>${escapeHtml(horse.name)}</strong>
      <small>${escapeHtml(horse.bloodline)}</small>
      ${portraitHtml}
      <span class="horse-silhouette" aria-hidden="true"></span>
      <p>${escapeHtml(horse.temperament)}</p>
      <span class="${stageClass(horse.stageId)}">${escapeHtml(horse.stage)} · age ${horse.age} · ${horse.sex}</span>
      <dl class="horse-stats">
        <div><dt>Training</dt><dd>${horse.training}</dd></div>
        <div><dt>Bond</dt><dd>${horse.bond}</dd></div>
        <div><dt>Health</dt><dd>${horse.health}</dd></div>
        <div><dt>Stress</dt><dd>${horse.stress}</dd></div>
      </dl>
      ${bar(horse.training, 'gold')}
      ${bar(horse.bond, 'green')}
      <span class="value">${escapeHtml(horse.value)}${horse.injured ? ' · Injured' : ''}</span>
    </button>
  `;
}

function renderLineagePanel() {
  const model = buildLineageModel(game, ui.selectedHorse);
  if (!model) return '<p class="hint">Pick a horse to see their lineage.</p>';
  return `
    <div class="lineage">
      <div class="lineage-block lineage-block--self">
        <p class="eyebrow">Selected</p>
        <div class="lineage-row">
          ${renderPortrait(model.horse, { size: 'md' })}
          <div>
            <strong>${escapeHtml(model.horse.name)}</strong>
            <small>age ${model.horse.age} · ${escapeHtml(model.horse.role)}</small>
          </div>
        </div>
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Parents</p>
        ${model.parents.length === 0 ? '<p class="hint">No recorded parents.</p>' :
          model.parents.map((p) => `
            <div class="lineage-row lineage-row--link">
              ${renderPortrait(p, { size: 'sm' })}
              <button class="lineage-link" data-select-horse="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>
            </div>
          `).join('')}
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Offspring</p>
        ${model.offspring.length === 0 ? '<p class="hint">No offspring yet.</p>' :
          model.offspring.map((o) => `
            <div class="lineage-row lineage-row--link">
              ${renderPortrait(o, { size: 'sm' })}
              <button class="lineage-link" data-select-horse="${escapeHtml(o.id)}">${escapeHtml(o.name)} · age ${o.age}</button>
            </div>
          `).join('')}
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Traits</p>
        <small>${escapeHtml(model.horse.traitsLine ?? '')}</small>
      </div>
    </div>
  `;
}

function renderLastShowResult(result) {
  const tone = result.result === 'champion' ? 'verdict--good' : result.result === 'also-ran' ? 'verdict--over' : '';
  // Find the horse object so we can render its portrait. Fall back to
  // name-only if the horse has left the herd (e.g. died, sold).
  const horse = game.horses.find((h) => h.id === result.horseId || h.name === result.horseName);
  const portrait = horse ? renderPortrait(horse, { size: 'md' }) : '';
  return `
    <div class="verdict ${tone}" style="margin-top: 14px;">
      ${portrait}
      <div class="verdict-body">
        <strong>${escapeHtml(result.horseName)} · #${result.playerPlace}</strong>
        <span>${escapeHtml(result.show.title)} · score ${result.playerScore} · payout $${result.payout.toLocaleString()}</span>
      </div>
    </div>
  `;
}

function renderTutorialCard() {
  const step = getCurrentTutorialStep(game);
  if (!step) return '';
  const completed = game.tutorial?.completedSteps ?? [];
  const stepIndex = TUTORIAL_STEPS.findIndex((s) => s.id === step.id);
  const total = TUTORIAL_STEPS.length;
  const progress = `${Math.min(completed.length, total)}/${total} steps complete`;
  return `
    <section class="tutorial">
      <div class="tutorial-head">
        <p class="eyebrow">Tutorial · day ${step.day} · ${progress}</p>
        <button class="tutorial-skip" data-dismiss-tutorial>Skip tutorial</button>
      </div>
      <h2>${escapeHtml(step.title)}</h2>
      <p>${escapeHtml(step.body)}</p>
      <p class="hint">${escapeHtml(step.hint)}</p>
      <ol class="tutorial-track">
        ${TUTORIAL_STEPS.map((s, i) => `
          <li class="tutorial-step ${completed.includes(s.id) ? 'tutorial-step--done' : ''} ${s.id === step.id ? 'tutorial-step--current' : ''}">
            <span class="tutorial-step-num">${i + 1}</span>
            <span>${escapeHtml(s.title)}</span>
          </li>
        `).join('')}
      </ol>
    </section>
  `;
}

function renderShareCard() {
  if (!ui.showShareCard) return '';
  const top = [...(game.horses ?? [])]
    .sort((a, b) => (b.training ?? 0) - (a.training ?? 0))
    .slice(0, 3);
  const recentLog = (game.log ?? []).slice(0, 3);
  const heroScore = scoreGame(game);
  return `
    <section class="share-card">
      <div class="share-card-head">
        <p class="eyebrow">Share card</p>
        <small>Designed to screenshot. Press <strong>Export</strong> for the full save file.</small>
      </div>
      <div class="share-card-body">
        <h3>Blood &amp; Bridle</h3>
        <p class="share-card-meta">Year ${getYear(game)} ${getSeason(game)} · Day ${getDayOfSeason(game)}/30 · ${game.horses.length} horses · Score ${heroScore.toLocaleString()}</p>
        <div class="share-card-stats">
          <div><span>Cash</span><strong>$${game.cash.toLocaleString()}</strong></div>
          <div><span>Legacy</span><strong>${game.legacy}</strong></div>
          <div><span>Reputation</span><strong>${game.reputation}</strong></div>
          <div><span>Dev Pressure</span><strong>${game.developerPressure}</strong></div>
        </div>
        ${top.length > 0 ? `
          <p class="share-card-section-label">Top horses</p>
          <ul class="share-card-horses">
            ${top.map((h) => `<li><strong>${escapeHtml(h.name)}</strong> · ${escapeHtml(h.role)} · training ${h.training} · $${(h.value ?? 0).toLocaleString()}</li>`).join('')}
          </ul>
        ` : ''}
        ${recentLog.length > 0 ? `
          <p class="share-card-section-label">Recent</p>
          <ol class="share-card-log">
            ${recentLog.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ol>
        ` : ''}
      </div>
    </section>
  `;
}

function renderShareBanner() {
  if (!pendingShareSnapshot) return '';
  const snap = pendingShareSnapshot;
  return `
    <section class="share-banner">
      <div>
        <p class="eyebrow">A shared dynasty</p>
        <strong>Year ${snap.year} ${escapeHtml(snap.season)} · Day ${snap.day}</strong>
        <small>${snap.horseCount} horses · score ${snap.score.toLocaleString()}${snap.topHorses.length > 0 ? ` · top: ${snap.topHorses.map((n) => escapeHtml(n)).join(', ')}` : ''}</small>
      </div>
      <div class="share-banner-actions">
        <button class="action" data-import-shared>Start new game inspired by this</button>
        <button class="action action--danger" data-dismiss-shared>Dismiss</button>
      </div>
    </section>
  `;
}

// Map event id to the NPC whose leitmotif should play when the event
// surfaces. The player learns to dread the Reyes motif, recognize
// Mae's fiddle, hear Elena's piano — Morricone-style.
const EVENT_NPC_MAP = {
  'dev-second-offer':      'dev-coleman',
  'cordell-trade-offer':    'ranch-cordell',
  'banker-warning':         'banker-ortega',
  'vet-second-opinion':     'dr-voss',
  'sister-asks':            'sister-elena',
  'callahan-purchases-buyer':'rival-callahan',
};

function renderPendingEvent(model) {
  if (!model.pendingEvent) return '';
  const event = model.pendingEvent;
  // Fire the NPC motif the first time this event surfaces.
  const npcId = EVENT_NPC_MAP[event.id];
  if (npcId) audio.playMotif(npcId);
  return `
    <section class="event-modal" data-event-id="${escapeHtml(event.id)}">
      <h2>${escapeHtml(event.title)}</h2>
      <p>${escapeHtml(event.body)}</p>
      <div class="actions">
        ${event.options.map((opt, i) => `<button class="action" data-resolve-event="${i}">${escapeHtml(opt.label)}</button>`).join('')}
      </div>
    </section>
  `;
}

function renderMemorialBanner() {
  // Show the most recent memorial (the last entry in the array) as a
  // compact banner on the dashboard. Older ones are visible on the
  // Memorial Hall in the ending screen.
  const memorials = game.memorials ?? [];
  if (memorials.length === 0) return '';
  const latest = memorials[memorials.length - 1];
  return `<section class="memorial-banner-section">${renderMemorial(latest, { compact: true })}</section>`;
}

function renderMemorialHallJSX(memorials) {
  if (!memorials || memorials.length === 0) return '';
  return renderMemorialHall(memorials);
}

function renderEnding(model) {
  if (!model.ending) return '';
  const finalScore = scoreGame(game);
  const top = [...(game.horses ?? [])]
    .sort((a, b) => (b.training ?? 0) - (a.training ?? 0))
    .slice(0, 3);
  return `
    <section class="event-modal event-modal--ending">
      <p class="eyebrow">A legacy ends</p>
      <h2 class="wordmark ending-title">${escapeHtml(model.ending.label)}</h2>
      <p>${escapeHtml(model.ending.body)}</p>
      <div class="ending-stats">
        <div><span>Year</span><strong>${getYear(game)}</strong></div>
        <div><span>Horses</span><strong>${game.horses.length}</strong></div>
        <div><span>Score</span><strong>${finalScore.toLocaleString()}</strong></div>
        <div><span>Cash</span><strong>$${game.cash.toLocaleString()}</strong></div>
      </div>
      ${top.length > 0 ? `
        <p class="ending-horses-label">Top horses</p>
        <ul class="ending-horses">
          ${top.map((h) => `
            <li class="ending-horse">
              ${renderPortrait(h, { size: 'lg' })}
              <div class="ending-horse-body">
                <strong>${escapeHtml(h.name)}</strong>
                <span>${escapeHtml(h.role)} · training ${h.training} · $${(h.value ?? 0).toLocaleString()}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      ` : ''}
      ${renderMemorialHallJSX(game.memorials)}
      <div class="ending-actions">
        <button class="action" data-share-link>Share your ending</button>
        <button class="action" data-reset>Start a new legacy</button>
      </div>
    </section>
  `;
}

function renderBreedingPanel() {
  if (game.pendingBreeding) {
    // Look up the parents in the current herd to show their portraits.
    // If they've left the herd (sold, died), fall back to name-only.
    const sire = game.horses.find((h) => h.id === game.pendingBreeding.sireId);
    const dam = game.horses.find((h) => h.id === game.pendingBreeding.damId);
    return `
      <section class="panel">
        <p class="eyebrow">Pending breeding</p>
        <div class="breed-pending">
          ${sire ? renderPortrait(sire, { size: 'lg' }) : '<div class="horse-portrait horse-portrait--lg"></div>'}
          <span class="breed-x">×</span>
          ${dam ? renderPortrait(dam, { size: 'lg' }) : '<div class="horse-portrait horse-portrait--lg"></div>'}
        </div>
        <h2>${escapeHtml(game.pendingBreeding.sireName)} × ${escapeHtml(game.pendingBreeding.damName)}</h2>
        <p class="hint">Foal due in ${Math.max(0, game.pendingBreeding.dueDay - game.day)} in-game days.</p>
      </section>
    `;
  }
  return `
    <section class="panel">
      <p class="eyebrow">Breeding</p>
      <h2>Pick a stallion and a mare</h2>
      <div class="breed-grid">
        <label>
          Stallion
          <select name="breed-sire">
            ${game.horses.filter((h) => h.sex === 'male' && h.age >= 4 && h.age <= 12).map((h) => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)} · age ${h.age}</option>`).join('')}
          </select>
        </label>
        <span class="breed-x">×</span>
        <label>
          Mare
          <select name="breed-dam">
            ${game.horses.filter((h) => h.sex === 'female' && h.age >= 4 && h.age <= 12).map((h) => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)} · age ${h.age}</option>`).join('')}
          </select>
        </label>
      </div>
      <button class="action" data-breed>Queue breeding</button>
      <p class="hint">11 in-game days until the foal arrives.</p>
    </section>
  `;
}

function renderAuctionPreview() {
  const horse = game.horses.find((h) => h.id === ui.selectedHorse);
  if (!horse) return '';
  const result = runAuction(horse);
  return `
    <section class="panel">
      <p class="eyebrow">Auction preview for ${escapeHtml(horse.name)}</p>
      <div class="auction-head">
        ${renderPortrait(horse, { size: 'lg' })}
        <div class="auction-body">
          <strong>${escapeHtml(horse.name)}</strong>
          <small>${escapeHtml(horse.role)} · age ${horse.age} · ${escapeHtml(horse.bloodline)}</small>
          <small>Training ${horse.training} · bond ${horse.bond} · $${(horse.value ?? 0).toLocaleString()}</small>
        </div>
      </div>
      <ul>
        ${result.allBids.map((b) => `<li><strong>${escapeHtml(b.name)}</strong> · $${b.offer.toLocaleString()}${b === result.topBid ? ' · top bid' : ''}</li>`).join('')}
      </ul>
      <button class="action action--danger" data-list-auction>List ${escapeHtml(horse.name)} at auction</button>
    </section>
  `;
}

function renderParcelMarket(model) {
  if (!model.availableParcels.length) return '';
  return `
    <section class="panel">
      <p class="eyebrow">Land market</p>
      <h2>Parcels for sale</h2>
      <ul>
        ${model.availableParcels.map((p) => `<li><strong>${escapeHtml(p.name)}</strong> · $${p.price.toLocaleString()} · ${escapeHtml(p.threat)} <button class="action" data-buy-parcel="${escapeHtml(p.id)}">Buy</button></li>`).join('')}
      </ul>
    </section>
  `;
}

function renderRanchUpgrades() {
  const upgrades = ['arena', 'vet_clinic', 'breeding_shed', 'hay_barn'];
  return `
    <section class="panel">
      <p class="eyebrow">Ranch</p>
      <h2>Build & upgrade</h2>
      <ul class="upgrades">
        ${upgrades.map((id) => {
          const upgrade = UPGRADES[id];
          const level = game.ranchUpgrades?.[id] ?? 0;
          const label = getUpgradeLabel(id, level);
          const atMax = level >= 3;
          const check = canAffordUpgrade(game, id);
          return `
            <li>
              <strong>${escapeHtml(upgrade.label)}</strong>
              <small>${escapeHtml(label)} · level ${level}/3</small>
              <p>${escapeHtml(upgrade.description)}</p>
              ${atMax
                ? '<span class="hint">Maxed out.</span>'
                : `<button class="action" data-upgrade="${escapeHtml(id)}" ${check.ok ? '' : 'disabled'}>${check.ok ? `Upgrade ($${check.cost ?? ''})` : check.reason}</button>`}
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `;
}

function renderContracts() {
  const contracts = game.contracts ?? [];
  if (contracts.length === 0) {
    return `
      <section class="panel">
        <p class="eyebrow">Contracts</p>
        <h2>None active</h2>
        <p class="hint">Buyers and boarders will approach at each season boundary. Check back in 30 in-game days.</p>
      </section>
    `;
  }
  return `
    <section class="panel">
      <p class="eyebrow">Contracts</p>
      <h2>Open offers & active commitments</h2>
      <ul>
        ${contracts.map((c) => `
          <li>
            <strong>${escapeHtml(c.template)}</strong> · ${c.status === 'pending' ? 'offer' : `${c.daysRemaining} days left`}
            <small>${c.type === 'board' ? `$${c.monthlyFee.toLocaleString()}/mo for ${c.duration} days · total $${c.totalValue.toLocaleString()}` : `Lock ${c.lockDays} days · $${c.price.toLocaleString()} on completion · ${escapeHtml(c.horseName)}`}</small>
            ${c.status === 'pending' ? `<button class="action" data-accept-contract="${escapeHtml(c.id)}">Accept</button> <button class="action action--danger" data-decline-contract="${escapeHtml(c.id)}">Decline</button>` : '<span class="hint">Active</span>'}
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function render() {
  const model = buildDashboardModel(game);
  const over = isGameOver(game);
  const finalEnding = checkEnding(game);

  // Compute deltas vs. previous render so we can attach flash classes.
  // Cash/legacy/reputation/dev-pressure all go up/down. Day ticks up.
  const previousCash = lastRendered.cash;
  const previousDay = lastRendered.day;
  const previousTutorial = lastRendered.tutorial ?? { dismissed: false, completedSteps: [] };
  const metricClass = (metric) => {
    if (metric.label === 'Day') {
      if (previousDay != null && metric.value !== `${previousDay}/30`) return 'is-tick';
      return '';
    }
    if (metric.label === 'Cash') {
      if (previousCash != null) {
        const numeric = Number(String(metric.value).replace(/[^0-9-]/g, ''));
        if (Number.isFinite(numeric) && numeric > previousCash) return 'is-up';
        if (Number.isFinite(numeric) && numeric < previousCash) return 'is-down';
      }
      return '';
    }
    return '';
  };

  // New log entry = the first item in the log wasn't there last render
  const previousLogTop = lastRendered.logTop;
  const newLogTop = previousLogTop != null && model.log[0] !== previousLogTop;
  // New horse = an id we didn't have last render
  const previousHorseIds = new Set(lastRendered.horseIds ?? []);
  const newHorseIds = new Set();
  for (const h of model.horses) if (!previousHorseIds.has(h.id)) newHorseIds.add(h.id);
  // Newly completed tutorial step
  const previousCompleted = new Set(previousTutorial.completedSteps ?? []);
  const newlyCompleted = model.tutorial?.completedSteps?.find((id) => !previousCompleted.has(id));

  // Trigger ambient (cheap) — no-op if disabled or muted
  if (audioAmbientEnabled && !audio.isMuted()) {
    const preset = chooseAmbientPreset(game, { season: getSeason(game) });
    if (lastRendered.ambientPreset !== preset) {
      audio.ambient(preset);
      lastRendered.ambientPreset = preset;
    }
  }

  // Thunder: layered under any active disaster log line. Subtle.
  const topLog = game.log?.[0] ?? '';
  if (/drought|blizzard|flood|disease|fire|strangles|lightning/i.test(topLog)) {
    audio.resume();
    audio.play('thunder');
  }

  // Rooster: fires on the first day of a new season (calendar turning).
  const dayOfSeason = ((game.day - 1) % 30) + 1;
  if (dayOfSeason === 1 && lastRendered.dayOfSeason !== 1) {
    audio.resume();
    audio.play('rooster');
  }
  lastRendered.dayOfSeason = dayOfSeason;

  // Time-jump card: fire on season boundary, the 1883 / 1923 device.
  // Detect by comparing the previous season to the current one. Only
  // fires after the first render (lastRendered.seasonIndex is non-null).
  const tjcCurrentSeason = getSeason(game);
  const tjcCurrentIndex = ['Spring', 'Summer', 'Fall', 'Winter'].indexOf(tjcCurrentSeason);
  const tjcPreviousIndex = lastRendered.seasonIndex;
  if (tjcPreviousIndex !== null && tjcCurrentIndex !== tjcPreviousIndex) {
    // Play the gate-creak sound effect (procedural noise) and fire the card.
    audio.resume();
    audio.play('gateCreak');
    // Also play the bowed-cello stinger — the time-jump theme.
    audio.play('celloStinger');
    fireSeasonCard(game);
  }
  lastRendered.seasonIndex = tjcCurrentIndex;

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div class="hero-brand-block">
          <div class="hero-brand-mark">${renderBrandGlyph(game.ranchBrand, 'hero-brand-glyph')}</div>
          <div class="hero-brand-text">
            <p class="eyebrow">Neo-Western ranch management · Year ${model.year} ${model.season} · Day ${model.dayOfSeason}/${model.daysPerSeason}</p>
            <h1 class="wordmark">${escapeHtml(game.ranchName || 'Unbranded')}</h1>
            <p class="subtitle">${escapeHtml(model.subtitle)} · ${escapeHtml(model.crisisTitle)}${game.ownerName ? ' · ' + escapeHtml(game.ownerName) : ''}</p>
          </div>
        </div>
        <div class="hero-actions">
          <button class="reset" data-ranch-profile title="Set the ranch name and the brand">Ranch</button>
          <button class="reset" data-codex title="The earned code of the West">Codex</button>
          <button class="audio-toggle ${audio.isMuted() ? 'is-muted' : ''}" data-audio-toggle title="Click to cycle: Sound off → Sound on → Sound + Ambient">${audio.isMuted() ? 'Sound off' : (audioAmbientEnabled ? 'Sound + Amb' : 'Sound on')}</button>
          <button class="reset" data-toggle-share-card>${ui.showShareCard ? 'Hide card' : 'Share card'}</button>
          <button class="reset" data-share-link>Share link</button>
          <button class="reset" data-export-dynasty>Export</button>
          <button class="reset" data-import-dynasty>Import</button>
          <button class="reset" data-reset>New legacy</button>
        </div>
      </section>

      <section class="crisis">
        <div>
          <p class="eyebrow">Active crisis</p>
          <h2>${escapeHtml(model.crisisTitle)}</h2>
          <p>${escapeHtml(model.crisisDescription)}</p>
        </div>
        <aside>
          <span>Ranch score</span>
          <strong>${scoreGame(game).toLocaleString()}</strong>
        </aside>
      </section>

      <section class="metrics">
        ${model.metrics.map((m) => {
          const cls = metricClass(m);
          return renderMetric({ ...m, _flash: cls });
        }).join('')}
      </section>

      ${renderShareBanner()}
      ${renderTutorialCard()}
      ${renderShareCard()}
      ${renderMemorialBanner()}
      ${renderAuthenticityBanner(game)}

      <section class="verdict ${over ? 'verdict--over is-ending' : ''}">
        <strong>${over ? 'Scenario ended' : 'Ranch read'}</strong>
        <span>${escapeHtml(model.verdict)}</span>
      </section>

      ${renderPendingEvent(model)}
      ${finalEnding ? renderEnding(model) : ''}

      <section class="layout">
        <div class="panel panel--wide">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">The herd</p>
              <h2>Horses are the ranch</h2>
            </div>
            <select name="horse-select" aria-label="Selected horse">
              ${model.horses.map((horse) => `<option value="${escapeHtml(horse.id)}">${escapeHtml(horse.name)} · age ${horse.age}</option>`).join('')}
            </select>
          </div>
          <div class="horse-grid">
            ${renderPasture(model.horses, ui.selectedHorse)}
          </div>
          ${renderLineagePanel()}
        </div>

        <aside class="panel control-panel">
          <p class="eyebrow">Daily decision</p>
          <h2>Choose the cost</h2>
          <label>
            Handler
            <select name="staff-select">
              ${game.staff.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`).join('')}
            </select>
          </label>
          <div class="actions">
            ${model.actions.map((action) => `
              <button class="action ${action.danger ? 'action--danger' : ''}" data-action="${escapeHtml(action.type)}" ${action.requiresHorse && !ui.selectedHorse ? 'disabled' : ''} ${action.requiresStaff && !ui.selectedStaff ? 'disabled' : ''}>
                ${escapeHtml(action.label)}
              </button>
            `).join('')}
          </div>
          <p class="hint">Each action advances one in-game day. The ranch has five years to prove itself.</p>
        </aside>
      </section>

      <section class="layout layout--lower">
        ${renderBreedingPanel()}
        ${renderAuctionPreview()}
        <article class="panel">
          <p class="eyebrow">Show circuit</p>
          <h2>What's ahead</h2>
          ${model.showCalendar.length === 0
            ? '<p class="hint">No more shows on the calendar.</p>'
            : `<ul>${model.showCalendar.map((s) => `<li><strong>${escapeHtml(s.title)}</strong> · ${escapeHtml(s.categoryLabel)} · ${escapeHtml(s.prestigeLabel)} · ${s.status === 'today' ? '<strong>TODAY</strong>' : `in ${s.daysUntil} day${s.daysUntil === 1 ? '' : 's'}`} · $${s.entryFee} entry / $${s.prizePool.toLocaleString()} purse</li>`).join('')}</ul>`}
          ${model.lastShowResult ? renderLastShowResult(model.lastShowResult) : ''}
        </article>
      </section>

      <section class="layout layout--lower">
        <article class="panel">
          <p class="eyebrow">Land</p>
          <h2>Parcels & market</h2>
          <ul>${model.parcels.map((line) => `<li>${escapeHtml(line.line)}</li>`).join('')}</ul>
          ${renderParcelMarket(model)}
        </article>
        ${renderRanchUpgrades()}
        ${renderContracts()}
        <article class="panel">
          <p class="eyebrow">People</p>
          <h2>Staff & NPCs</h2>
          <ul>${model.staff.map((s) => `<li>${escapeHtml(s.line)}</li>`).join('')}</ul>
          <ul>${model.npcs.map((n) => `<li>${escapeHtml(n.line)}</li>`).join('')}</ul>
        </article>
        <article class="panel">
          <p class="eyebrow">Region</p>
          <h2>Rival ranches</h2>
          <ul>${model.rivals.map((r) => `<li>${escapeHtml(r.line)}</li>`).join('')}</ul>
        </article>
        <article class="panel log-panel">
          <p class="eyebrow">Ledger</p>
          <h2>Recent events</h2>
          <div class="ledger-log">
            <ol>
              ${model.log.map((line, i) => {
                // Day label: Y1 Spring D14, etc. We have a rough day-back
                // approximation: i=0 is today, i=1 is yesterday, etc.
                const dayLabel = `D${Math.max(1, model.dayOfSeason - i)}`;
                const fresh = (i === 0 && newLogTop) ? ' class="is-new"' : '';
                return `<li${fresh}><span class="ledger-day">${escapeHtml(dayLabel)}</span><span class="ledger-line">${escapeHtml(line)}</span></li>`;
              }).join('')}
            </ol>
          </div>
        </article>
      </section>
    </main>
  `;

  // Side-effects after DOM is in place:
  // - pulse the action button that was just clicked
  // - chime if a tutorial step just completed
  // - mark the firing button briefly
  if (ui.lastFiredActionType) {
    const btn = document.querySelector(`[data-action="${ui.lastFiredActionType}"]`);
    if (btn) {
      btn.classList.add('is-firing');
      setTimeout(() => btn.classList.remove('is-firing'), 380);
    }
    ui.lastFiredActionType = null;
  }
  if (newlyCompleted) audio.play('stepDone');
  // Show result sound: triggered when a new showResult appears
  if (model.lastShowResult && lastRendered.lastShowResultId !== model.lastShowResult.id) {
    if (model.lastShowResult.result === 'champion') audio.play('champion');
    else if (model.lastShowResult.result === 'also-ran') audio.play('alsoRan');
    lastRendered.lastShowResultId = model.lastShowResult.id;
  }

  // Soundtrack: play season track when season changes
  const currentSeason = getSeason(game);
  if (soundtrackInitialized && lastRendered.season !== currentSeason) {
    playForSeason(currentSeason).catch(() => {});
    // Season transition: gate creak as the calendar turns. Late enough in
    // the season cycle that it doesn't fire on first render.
    if (lastRendered.season && lastRendered.season !== currentSeason) {
      audio.play('gateCreak');
    }
    lastRendered.season = currentSeason;
  }

  bindEvents();

  // Tint the page atmosphere by season — visual reinforcement of the
  // soundtrack swap. Spring = pollen haze, summer = warm gold, autumn =
  // amber dust, winter = cold blue. Each is a subtle radial wash so
  // the cards still read clearly.
  // Sepia mode unlocks at legacy ≥ 75 — the 1883 / 1923 visual identity.
  const sepiaMode = (game.legacy ?? 0) >= 75;
  const bodyClasses = [`season-${currentSeason}`];
  if (sepiaMode) bodyClasses.push('sepia-mode');
  const bodyClassString = bodyClasses.join(' ');
  if (document.body.className !== bodyClassString) {
    document.body.className = bodyClassString;
  }

  // Update the snapshot for the next render
  lastRendered = {
    cash: Number(String(model.metrics.find((m) => m.label === 'Cash')?.value ?? '').replace(/[^0-9-]/g, '')) || previousCash,
    day: model.dayOfSeason,
    tutorial: model.tutorial ?? { dismissed: false, completedSteps: [] },
    horseIds: model.horses.map((h) => h.id),
    logTop: model.log[0],
    season: currentSeason,
  };
}

function playForOutcome(prevGame, nextGame, actionType) {
  // Resume AudioContext on the first user gesture
  audio.resume();
  audio.play('click');

  // Initialize soundtrack on first user gesture
  if (!soundtrackInitialized) {
    soundtrackInitialized = true;
    soundtrack.init().catch(() => {});
    // Play initial season track
    playForSeason(getSeason(nextGame)).catch(() => {});
  }

  // Cash delta
  const prevCash = prevGame?.cash ?? 0;
  const nextCash = nextGame?.cash ?? 0;
  if (nextCash > prevCash) audio.play('cashUp');
  else if (nextCash < prevCash) audio.play('cashDown');

  // Day tick
  if (prevGame && nextGame && (nextGame.day ?? 0) > (prevGame.day ?? 0)) {
    audio.play('tick');
  }

  // Special actions

  if (actionType === 'listAtAuction' || actionType === 'sellHorse') audio.play('sale');
  if (actionType === 'enterShow') {
    audio.play('showEnter');
    // Hoofbeats layer on top of the chord — a slow canter building anticipation.
    setTimeout(() => audio.play('hoofbeat'), 80);
  }
  if (actionType === 'acceptContract' || actionType === 'signWithDeveloper') audio.play('confirm');
  if (actionType === 'dismissTutorial') audio.play('stepDone');

  // Champion bell on the show verdict when the horse took first.
  if (actionType === 'enterShow' && nextGame?.lastShowResult?.playerPlace === 1) {
    setTimeout(() => audio.play('bell'), 600);
  }

  // Memorial tone when a horse was lost in the year tick. Detect via herd
  // size: if a horse we knew is now gone, mourn. (The death/retirement
  // log entry was pushed in tickYear.)
  const prevHerd = prevGame?.horses?.length ?? 0;
  const nextHerd = nextGame?.horses?.length ?? 0;
  if (prevHerd > nextHerd) {
    setTimeout(() => audio.play('memorial'), 200);
  }

  // Soundtrack mood triggers
  if (actionType === 'enterShow') playForMood('show').catch(() => {});
  if (actionType === 'signWithDeveloper') playForMood('crisis').catch(() => {});
}

function bindEvents() {
  // Open the Ranch Profile modal.
  document.querySelector('[data-ranch-profile]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    openRanchProfile();
  });

  // Open the Codex of the Code.
  document.querySelector('[data-codex]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    openCodex();
  });

  document.querySelector('[data-reset]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    game = createNewGame();
    ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false };
    lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null, season: null };
    soundtrackInitialized = false;
    stopSoundtrack();
    saveGame();
    render();
  });

  document.querySelector('[data-audio-toggle]')?.addEventListener('click', () => {
    audio.resume();
    // Cycle: off → on+sfx → on+sfx+amb → off
    if (audio.isMuted()) {
      audio.setMuted(false);
      audioAmbientEnabled = false;
      audio.ambient('off');
      setSoundtrackMuted(false); // soundtrack follows main mute
    } else if (!audioAmbientEnabled) {
      audioAmbientEnabled = true;
      const preset = chooseAmbientPreset(game, { season: getSeason(game) });
      audio.ambient(preset);
      lastRendered.ambientPreset = preset;
    } else {
      audioAmbientEnabled = false;
      audio.ambient('off');
    }
    audio.play('click');
    render();
  });

  document.querySelectorAll('[data-select-horse]').forEach((card) => {
    card.addEventListener('click', () => {
      ui.selectedHorse = card.dataset.selectHorse;
      audio.play('click');
      const select = document.querySelector('[name="horse-select"]');
      if (select) select.value = ui.selectedHorse;
      document.querySelectorAll('.horse-card').forEach((c) => c.classList.remove('card--selected'));
      card.classList.add('card--selected');
      render();
    });
    // Double-click opens the deep detail modal.
    card.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const horse = game.horses.find((h) => h.id === card.dataset.selectHorse);
      if (horse) {
        openHorseDetail(horse);
        audio.play('stepDone');
      }
    });
  });

  // Single-click on a lineage link inside a modal swaps to that horse's detail.
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('[data-detail-horse]');
    if (link) {
      e.preventDefault();
      const horse = game.horses.find((h) => h.id === link.dataset.detailHorse);
      if (horse) {
        openHorseDetail(horse);
      }
    }
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.action;
      const action = { type };
      if (['train', 'vetCare', 'sellHorse', 'enterShow', 'listAtAuction'].includes(type)) action.horseId = ui.selectedHorse;
      if (type === 'train') action.staffId = ui.selectedStaff;
      if (type === 'breed') {
        const sire = document.querySelector('[name="breed-sire"]')?.value;
        const dam = document.querySelector('[name="breed-dam"]')?.value;
        if (!sire || !dam) return;
        action.sireId = sire;
        action.damId = dam;
      }
      try {
        const before = game;
        game = applyAction(game, action);
        ui.lastFiredActionType = type;
        playForOutcome(before, game, type);
        saveGame();
        render();
      } catch (error) {
        audio.play('error');
        game = { ...game, log: [`Could not act: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-resolve-event]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        const before = game;
        game = applyAction(game, { type: 'resolveEvent', optionIndex: Number(button.dataset.resolveEvent) });
        playForOutcome(before, game, 'resolveEvent');
        saveGame();
        render();
      } catch (error) {
        audio.play('error');
        game = { ...game, log: [`Could not resolve event: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-buy-parcel]').forEach((button) => {
    button.addEventListener('click', () => {
      const parcel = AVAILABLE_PARCELS.find((p) => p.id === button.dataset.buyParcel);
      if (!parcel) return;
      try {
        const before = game;
        game = buyAvailableParcel(game, parcel);
        playForOutcome(before, game, 'buyParcel');
        saveGame();
        render();
      } catch (error) {
        audio.play('error');
        game = { ...game, log: [`Could not buy parcel: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'upgrade', upgradeId: button.dataset.upgrade });
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not upgrade: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-accept-contract]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'acceptContract', contractId: button.dataset.acceptContract });
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not accept: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-decline-contract]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'declineContract', contractId: button.dataset.declineContract });
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not decline: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-list-auction]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'listAtAuction', horseId: ui.selectedHorse });
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not list: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelector('[name="horse-select"]')?.addEventListener('change', (e) => {
    ui.selectedHorse = e.target.value;
    render();
  });
  document.querySelector('[name="staff-select"]')?.addEventListener('change', (e) => {
    ui.selectedStaff = e.target.value;
  });

  document.querySelectorAll('[data-dismiss-tutorial]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'dismissTutorial' });
        saveGame();
        render();
      } catch (error) {
        // non-fatal: tutorial dismiss is a UI affordance, not gameplay
        console.warn('Could not dismiss tutorial:', error);
      }
    });
  });

  document.querySelector('[data-toggle-share-card]')?.addEventListener('click', () => {
    audio.play('click');
    ui.showShareCard = !ui.showShareCard;
    render();
  });

  document.querySelector('[data-export-dynasty]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    try {
      const out = serializeGame(game);
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestFilename(game);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      game = { ...game, log: [`Exported dynasty as ${a.download}.`, ...(game.log ?? [])].slice(0, 20) };
      saveGame();
      render();
    } catch (error) {
      audio.play('error');
      game = { ...game, log: [`Could not export: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
      render();
    }
  });

  document.querySelector('[data-import-dynasty]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { cleanup(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          const result = parseJsonExport(text);
          if (!result.ok) throw new Error(result.error);
          game = result.game;
          ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false };
          lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null };
          saveGame();
          audio.play('confirm');
          game = { ...game, log: [`Imported dynasty from ${file.name}.`, ...(game.log ?? [])].slice(0, 20) };
          render();
        } catch (error) {
          audio.play('error');
          game = { ...game, log: [`Could not import: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
          render();
        } finally {
          cleanup();
        }
      };
      reader.onerror = () => { audio.play('error'); cleanup(); };
      reader.readAsText(file);
      function cleanup() { try { document.body.removeChild(input); } catch {} }
    });
    input.click();
  });

  document.querySelector('[data-share-link]')?.addEventListener('click', async () => {
    audio.resume();
    audio.play('click');
    try {
      const url = buildShareLink(game, window.location.origin + window.location.pathname);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        game = { ...game, log: [`Share link copied to clipboard.`, ...(game.log ?? [])].slice(0, 20) };
        audio.play('confirm');
      } else {
        // Fallback: select-and-copy via a temporary textarea
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        game = { ...game, log: [`Share link copied.`, ...(game.log ?? [])].slice(0, 20) };
        audio.play('confirm');
      }
      saveGame();
      render();
    } catch (error) {
      audio.play('error');
      game = { ...game, log: [`Could not share: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
      render();
    }
  });

  document.querySelector('[data-import-shared]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    // "Start new game inspired by this" — start a new game with the same
    // starting bonus adjusted, and clear the hash so the banner goes away.
    const snap = pendingShareSnapshot;
    if (snap) {
      game = createNewGame();
      const bonus = Math.min(2000, Math.max(0, Math.floor(snap.score / 200)));
      game = { ...game, cash: game.cash + bonus };
      game = { ...game, log: [`Started a new legacy inspired by year ${snap.year} ${snap.season} (${snap.horseCount} horses, score ${snap.score.toLocaleString()}). Bonus: $${bonus.toLocaleString()}.`, ...(game.log ?? [])].slice(0, 20) };
    }
    ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false };
    lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null };
    try { history.replaceState(null, '', window.location.pathname); } catch {}
    pendingShareSnapshot = null;
    saveGame();
    audio.play('confirm');
    render();
  });

  document.querySelector('[data-dismiss-shared]')?.addEventListener('click', () => {
    audio.play('click');
    try { history.replaceState(null, '', window.location.pathname); } catch {}
    pendingShareSnapshot = null;
    render();
  });
}

render();
