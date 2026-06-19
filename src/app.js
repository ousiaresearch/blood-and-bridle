import { applyAction, createNewGame, isGameOver, scoreGame, buyAvailableParcel, recommendAction } from './game.js';
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
import { preloadPortraits, preloadCodex, renderPortrait, getPortraitForHorse, startIdleAnimation } from './portraits.js';
import { soundtrack, playForSeason, playForMood, setSoundtrackMuted, setSoundtrackVolume, stopSoundtrack } from './soundtrack.js';
import { openKitchenTable } from './kitchen-table.js';
import { sceneForTrigger } from './scenes.js';
import { adjustCorners, recomputeOverallReputation } from './reputation.js';
import { showModal, closeModal } from './modal.js';
import { renderHorseDetail } from './horse-detail.js';
import { buildMemorial, renderMemorial, renderMemorialHall } from './memorial.js';
import { renderCodex } from './codex.js';
import { renderBrandGlyph, renderRanchProfile, renderLetterhead, brandById, renderBrandSurface, renderBrandScene, pickTitleCardSurface } from './brand.js';
import { renderRivalPortrait, renderHeirPortrait } from './rival-portraits.js';
import { isLegendaryRidden, findLegendary, renderLegendaryBlock } from './legendary.js';
import { fireSeasonCard } from './time-jump.js';
import { SHERIDAN_INTRO } from './blood-family.js';
import { renderPasture } from './pasture.js';
import { personalMonologue } from './monologue.js';
import { renderAuthenticityBanner } from './authenticity.js';
const STORAGE_KEY = 'blood-and-bridle-save-v2';

// One audio engine for the whole session. AudioContext is created lazily on
// the first user gesture (browser policy).
const audio = createAudioEngine();
let audioAmbientEnabled = false;

let game = loadGame();
let ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false, moreSheetOpen: false, auctionShowAll: false, installPromptReady: false, installBannerDismissed: false, isOffline: !navigator.onLine, showAllActions: false, tutorialDismissed: false };

// Preload portraits on startup
preloadPortraits().catch(() => {});
// Start the rest-idle animation cycle after portraits are preloaded.
// This is a no-op if /assets/horses/animations/index.js isn't generated yet.
startIdleAnimation().catch(() => {});

// Phase 15 — register service worker for PWA offline support. Skip in
// dev / non-secure contexts where SWs don't work.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Phase 15 — PWA install prompt + offline indicator.
// We capture the deferred BeforeInstallPromptEvent so we can show a
// custom banner instead of the browser default. We also track online/
// offline status and surface it in the header.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  ui.installPromptReady = true;
  render();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  ui.installPromptReady = false;
  ui.installBannerDismissed = true;
  render();
});
window.addEventListener('online', () => {
  ui.isOffline = false;
  render();
});
window.addEventListener('offline', () => {
  ui.isOffline = true;
  render();
});

// Initialize soundtrack on first user gesture (handled by audio.resume in playForOutcome)
let soundtrackInitialized = false;

let lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null, season: null };
let sheridanIntroShown = false;
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

function renderSheridanIntro() {
  if (sheridanIntroShown) return '';
  const lines = SHERIDAN_INTRO.lines
    .map((l) => `<p class="sheridan-intro-line">${escapeHtml(l)}</p>`)
    .join('');
  return `<aside class="sheridan-intro" role="note" aria-label="The dispersal">${lines}</aside>`;
}

// Phase 15 — mobile bottom-nav. Replaces the cramped top-right button row at
// <=720px. Surface is always rendered (so handlers always wire correctly);
// CSS hides it on desktop and the hero-actions row on mobile.
function renderBottomNav() {
  // P6: brand-iron icons. Hand-forged glyphs that match the burnt-iron
  // aesthetic of the brand-B logo (no clean SaaS line icons). Each uses
  // the same 1.7 stroke / square caps language.
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  return `
    <nav class="bottom-nav" aria-label="Primary actions">
      <button class="bottom-nav-btn" data-ranch-profile aria-label="Ranch profile">
        <svg class="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19 V11 L12 5 L20 11 V19 H14 V14 H10 V19 Z" ${stroke}/>
          <path d="M7 11 V19 M17 11 V19" ${stroke} stroke-width="1.2"/>
        </svg>
        <span>Ranch</span>
      </button>
      <button class="bottom-nav-btn" data-codex aria-label="Codex of the Code">
        <svg class="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4 H17 A3 3 0 0 1 20 7 V20 L17 18 H4 Z" ${stroke}/>
          <path d="M7 9 H15 M7 12 H13 M7 15 H11" ${stroke} stroke-width="1.2"/>
        </svg>
        <span>Codex</span>
      </button>
      <button class="bottom-nav-btn" data-kitchen-table aria-label="Kitchen table">
        <svg class="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9 H20 V11 H4 Z" ${stroke}/>
          <path d="M5 11 V18 M19 11 V18" ${stroke}/>
          <path d="M8 14 H16" ${stroke} stroke-width="1.2"/>
          <path d="M9 5 L11 9 M15 5 L13 9" ${stroke} stroke-width="1.2"/>
        </svg>
        <span>Kitchen</span>
      </button>
      <button class="bottom-nav-btn" data-audio-toggle aria-label="Toggle sound">
        <svg class="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9 H9 L13 5 V19 L9 15 H5 Z" ${stroke}/>
          <path d="M16 9 Q18 12 16 15" ${stroke}/>
          <path d="M18 6 Q22 12 18 18" ${stroke}/>
        </svg>
        <span>${audio.isMuted() ? 'Muted' : 'Sound'}</span>
      </button>
      <button class="bottom-nav-btn" data-more-sheet aria-label="More actions" aria-haspopup="true">
        <svg class="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5 V19 M5 12 H19" ${stroke}/>
          <circle cx="12" cy="12" r="2.2" fill="currentColor"/>
        </svg>
        <span>More</span>
      </button>
    </nav>
  `;
}

// Secondary actions panel — slides up from bottom-nav on tap. Houses the
// share/export/import/new-legacy/sound-cycle buttons that don't fit in 5.
function renderMoreSheet() {
  const open = ui.moreSheetOpen;
  return `
    <div class="more-sheet-backdrop ${open ? 'is-open' : ''}" data-more-sheet-close aria-hidden="${!open}"></div>
    <aside class="more-sheet ${open ? 'is-open' : ''}" role="dialog" aria-label="More actions" aria-modal="false">
      <div class="more-sheet-handle" aria-hidden="true"></div>
      <button class="more-sheet-btn" data-toggle-share-card>
        <span class="more-sheet-btn-label">${ui.showShareCard ? 'Hide share card' : 'Share card'}</span>
      </button>
      <button class="more-sheet-btn" data-share-link>
        <span class="more-sheet-btn-label">Copy share link</span>
      </button>
      <button class="more-sheet-btn" data-export-dynasty>
        <span class="more-sheet-btn-label">Export dynasty</span>
      </button>
      <button class="more-sheet-btn" data-import-dynasty>
        <span class="more-sheet-btn-label">Import dynasty</span>
      </button>
      <button class="more-sheet-btn more-sheet-btn--danger" data-reset>
        <span class="more-sheet-btn-label">Start a new legacy</span>
      </button>
    </aside>
  `;
}

// Phase 15 — PWA install banner. Shows when the browser fires
// beforeinstallprompt and the player hasn't dismissed it. Tapping
// Install triggers the saved prompt; tapping Later dismisses it for
// the session.
function renderInstallBanner() {
  if (!ui.installPromptReady || ui.installBannerDismissed) return '';
  return `
    <aside class="install-banner" role="region" aria-label="Install Blood & Bridle">
      <div class="install-banner-text">
        <strong>Install on your phone</strong>
        <small>Play offline. Add to your home screen.</small>
      </div>
      <div class="install-banner-actions">
        <button class="install-banner-btn install-banner-btn--primary" data-install-app>Install</button>
        <button class="install-banner-btn" data-dismiss-install>Not now</button>
      </div>
    </aside>
  `;
}

// Phase 15 — offline indicator. Surfaces when navigator.onLine is false.
// Positioned at the top of the page so the player knows their actions
// won't persist (until the connection returns).
function renderOfflineIndicator() {
  if (!ui.isOffline) return '';
  return `
    <div class="offline-indicator" role="status">
      <span class="offline-dot" aria-hidden="true"></span>
      Offline · progress saves locally; sync when you reconnect
    </div>
  `;
}

// P3: action button inline icon — small SVG glyph by category. Returns
// the inner SVG markup (without an outer wrapper). All glyphs use the
// brand-B line language: 1.6 stroke, square caps, no fills.
// P1: metric flash class — hoisted to module scope so renderMetricsTiered
// can call it. Takes the previous cash/day snapshots as args so we don't
// depend on closure over lastRendered.
function computeMetricClass(metric, previousCash, previousDay) {
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
}

function actionIcon(type) {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  switch (type) {
    case 'train':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M5 8 L12 4 L19 8 V18 H5 Z" ${stroke}/><path d="M9 12 H15 M9 15 H13" ${stroke}/></svg>`;
    case 'enterShow':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><circle cx="12" cy="9" r="5" ${stroke}/><path d="M8 13 L6 21 M16 13 L18 21 M9 9 L12 6 L15 9" ${stroke}/></svg>`;
    case 'breed':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M4 12 C 6 7 10 7 12 12 C 14 17 18 17 20 12" ${stroke}/><circle cx="4" cy="12" r="2" ${stroke}/><circle cx="20" cy="12" r="2" ${stroke}/></svg>`;
    case 'upgrade':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M3 21 H21 M5 21 V11 L12 6 L19 11 V21 M9 21 V14 H15 V21" ${stroke}/></svg>`;
    case 'rotatePasture':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M4 18 Q9 6 14 12 Q19 18 21 14" ${stroke}/><path d="M21 14 V10 M21 14 H17" ${stroke}/></svg>`;
    case 'takeBoarders':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><rect x="4" y="6" width="16" height="14" rx="1" ${stroke}/><path d="M4 10 H20 M9 6 V20 M15 6 V20" ${stroke}/></svg>`;
    case 'vetCare':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><circle cx="12" cy="12" r="8" ${stroke}/><path d="M12 8 V16 M8 12 H16" ${stroke}/></svg>`;
    case 'refuseDeveloper':
    case 'signWithDeveloper':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><rect x="4" y="4" width="16" height="16" rx="1" ${stroke}/><path d="M8 9 H16 M8 13 H14 M8 17 H12" ${stroke}/></svg>`;
    case 'sellHorse':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M5 8 H17 L21 12 L17 16 H5 Z" ${stroke}/><circle cx="8" cy="20" r="2" ${stroke}/><circle cx="16" cy="20" r="2" ${stroke}/></svg>`;
    case 'listAtAuction':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M5 7 L19 7 L19 18 L5 18 Z" ${stroke}/><path d="M5 11 H19 M9 7 V18" ${stroke}/></svg>`;
    case 'maeAdvancedTraining':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M5 18 L12 6 L19 18" ${stroke}/><path d="M8 14 H16" ${stroke}/><circle cx="12" cy="6" r="1.4" fill="currentColor"/></svg>`;
    case 'vossPreventiveCare':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><rect x="4" y="9" width="16" height="11" rx="1.5" ${stroke}/><path d="M8 9 V6 A4 4 0 0 1 16 6 V9" ${stroke}/><path d="M12 13 V16" ${stroke}/></svg>`;
    case 'eliFindHayDeal':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M5 14 L7 12 L9 14 L11 12 L13 14 L15 12 L17 14 L19 12" ${stroke}/><path d="M4 20 H20" ${stroke}/></svg>`;
    case 'breedInfo':
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><circle cx="12" cy="12" r="8" ${stroke}/><path d="M12 8 V16 M8 12 H16" ${stroke}/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><circle cx="12" cy="12" r="6" ${stroke}/></svg>`;
  }
}

function renderMetric(metric) {
  const flash = metric._flash ? ` ${metric._flash}` : '';
  const tier = metric.tier ? ` metric--${metric.tier}` : '';
  return `
    <article class="metric${flash}${tier}">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
    </article>
  `;
}

// P1: Split metrics into primary (always visible as chips) and secondary
// (behind a disclosure). Reclaims ~600px of vertical space on mobile while
// keeping every stat reachable. previousCash/previousDay are passed in for
// the flash-class computation.
function renderMetricsTiered(model, previousCash, previousDay) {
  const primary = model.metrics.filter((m) => m.tier === 'primary');
  const secondary = model.metrics.filter((m) => m.tier === 'secondary');
  return `
    <section class="metrics metrics--tiered">
      <div class="metrics-primary">
        ${primary.map((m) => {
          const cls = computeMetricClass(m, previousCash, previousDay);
          return renderMetric({ ...m, _flash: cls });
        }).join('')}
      </div>
      ${secondary.length > 0 ? `
        <details class="metrics-disclosure">
          <summary>
            <span>More stats</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" class="chevron"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </summary>
          <div class="metrics-secondary">
            ${secondary.map((m) => {
              const cls = computeMetricClass(m, previousCash, previousDay);
              return renderMetric({ ...m, _flash: cls });
            }).join('')}
          </div>
        </details>
      ` : ''}
    </section>
  `;
}

function stageClass(stageId) {
  return `life-stage life-stage--${stageId ?? 'dead'}`;
}

async function openHorseDetail(horse) {
  // Just-in-time preload: if the codex module isn't loaded yet (e.g. the
  // player opened a modal before preloadPortraits() resolved), fetch it
  // now so the modal's big cinematic portrait paints immediately.
  preloadCodex().catch(() => {});
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

// Open a kitchen table scene by trigger. Used by the demo button and,
// in future, by the action pipeline when moral choices fire. The
// applyEffect callback translates scene choice effects (cash, country,
// crew, moralRisk, etc.) into game-state mutations through the
// existing applyAction reducer.
function openKitchenSceneFor(trigger, override = {}) {
  const scene = sceneForTrigger(trigger);
  if (!scene) return;
  openKitchenTable(scene, game, (effects, sceneId, choiceId) => {
    applyKitchenChoice(effects, sceneId, choiceId, override);
  }, { audio });
}

// Translate a kitchen-table choice's effects into game-state mutations.
// Most effects mutate the game directly because the kitchen table IS
// the kitchen table — a critical scene where the player has chosen.
// The exceptions:
//   - moralRisk → routed through applyAction('skipObligation') so the
//     existing moral-consequence queue continues to work as designed.
//   - gameOver → routed through applyAction('endGame') if/when that
//     action exists, otherwise mutates the flag directly.
// Other effects land directly on game state. The dashboard re-render
// at the end picks them up.
function applyKitchenChoice(effects, sceneId, choiceId, override = {}) {
  const notes = [];
  // Cash: direct mutation. The ledger entry is written by the next
  // daily-tick's addIncome/addExpense call (or skipped if we don't
  // want a ledger entry for kitchen-table choices — small choices).
  if (typeof effects.cash === 'number' && effects.cash !== 0) {
    game.cash += effects.cash;
    notes.push(`cash ${effects.cash > 0 ? '+' : ''}$${effects.cash.toLocaleString()}`);
  }
  // Reputation corners.
  const cornerEffect = {};
  for (const k of ['country', 'horsemen', 'bank', 'crew']) {
    if (typeof effects[k] === 'number' && effects[k] !== 0) cornerEffect[k] = effects[k];
  }
  if (Object.keys(cornerEffect).length > 0) {
    const newCorners = adjustCorners(game.reputationCorners, cornerEffect);
    game.reputationCorners = newCorners;
    game.reputation = recomputeOverallReputation(newCorners);
    for (const [k, v] of Object.entries(cornerEffect)) {
      notes.push(`${k} ${v > 0 ? '+' : ''}${v}`);
    }
  }
  // Moral-risk queue: hand the choice to the existing moral skip flow
  // so consequences fire on the next season tick as designed.
  if (effects.moralRisk) {
    applyAction(game, { type: 'skipObligation', category: effects.moralRisk, horseId: override.horseId ?? null });
    notes.push(`moral risk: ${effects.moralRisk}`);
  }
  // Day-worker gone: remove from dayWorkers list immediately.
  if (effects.dayWorkerGone) {
    const before = (game.dayWorkers ?? []).length;
    game.dayWorkers = (game.dayWorkers ?? []).filter((w) => w.id !== effects.dayWorkerGone);
    if (game.dayWorkers.length < before) notes.push(`day-worker gone: ${effects.dayWorkerGone}`);
  }
  // Hire a hand: bump the day-worker to a full hand.
  if (effects.hireHand) {
    const dw = (game.dayWorkers ?? []).find((w) => w.id === effects.hireHand);
    if (dw) {
      const newHand = {
        ...dw,
        status: 'working',
        hoursPerWeek: 40,
        wage: effects.wageCostPerSeason ?? 1600,
        morale: 65,
        hoursThisWeek: 0,
        injury: null,
      };
      game.hands = [...(game.hands ?? []), newHand];
      game.dayWorkers = game.dayWorkers.filter((w) => w.id !== effects.hireHand);
      notes.push(`hired ${dw.name}`);
    }
  }
  // Parcel changes.
  if (effects.gainParcel && game.parcels) {
    game.parcels = game.parcels.map((p) => p.id === effects.gainParcel ? { ...p, currentOwner: 'player' } : p);
    notes.push(`gained parcel: ${effects.gainParcel}`);
  }
  if (effects.loseParcel && game.parcels) {
    game.parcels = game.parcels.map((p) => p.id === effects.loseParcel ? { ...p, currentOwner: 'developer' } : p);
    notes.push(`lost parcel: ${effects.loseParcel}`);
  }
  // Loan: cash already covered above. Track debt for future repayment.
  if (typeof effects.loanDebt === 'number') {
    game.loans = [...(game.loans ?? []), { amount: effects.loanDebt, takenDay: game.day, sceneId }];
    notes.push(`loan +$${effects.loanDebt.toLocaleString()}`);
  }
  // End-of-season continuation / sell-out.
  if (effects.gameOver === 'sellout') {
    game.soldOut = true;
    notes.push('sold out');
  }
  // Heir transition — runs the applyAction('transitionToHeir')
  // reducer, then fires the heir-kitchen-table scene so the new
  // owner sits down with the hands. If we've already had an heir
  // transition, fire heir-departure instead (chain of generations).
  if (effects.transitionToHeir) {
    applyAction(game, { type: 'transitionToHeir' });
    notes.push('transitioned to the heir');
    // Re-open the heir kitchen-table scene so the player sees the
    // heir across the table from them. The scene shows the heir's
    // portrait (rendered via the heir scene's special header).
    const generationCount = game.generationCount ?? 1;
    const nextSceneId = generationCount >= 2 ? 'heir-departure' : 'heir-kitchen-table';
    const nextScene = sceneForTrigger(`event:${nextSceneId === 'heir-departure' ? 'heirDeparture' : 'heirKitchenTable'}`);
    if (nextScene) {
      // Slight defer so the modal close animation lands first.
      setTimeout(() => openKitchenTable(nextScene, game, (eff, sid, cid) => {
        applyKitchenChoice(eff, sid, cid, override);
      }, { audio }), 50);
    }
  }
  // Log it.
  if (notes.length > 0 && Array.isArray(game.log)) {
    game.log = [`[kitchen table] ${sceneId} → ${choiceId}: ${notes.join(', ')}`, ...game.log];
  }
  // Re-render the dashboard.
  render();
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

// Phase 15 Sheridan lift — render the recommended-action card. Pulls the
// top recommendation out of the action list and shows it as the day's first
// thing the player sees. The remaining actions live behind a disclosure.
function renderRecommendedAction(actions, game) {
  const recType = recommendAction(game);
  if (!recType) return '';
  const rec = actions.find((a) => a.type === recType);
  if (!rec) return '';
  // Build a one-line reason tied to game state.
  let reason = '';
  switch (recType) {
    case 'train':
      reason = `Mae can put points on ${getSelectedHorseName()}.`;
      break;
    case 'enterShow':
      reason = 'Show the world what this horse can do.';
      break;
    case 'breed':
      reason = 'Build tomorrow\'s champion today.';
      break;
    case 'takeBoarders':
      reason = 'Cash is short. Take outside boarders to refill the till.';
      break;
    case 'rotatePasture':
      reason = 'Your pasture is tired. Rotate before it costs you.';
      break;
    default:
      reason = rec.label;
  }
  return `
    <div class="recommended-card">
      <div class="recommended-card-meta">
        <span class="recommended-tag">Recommended</span>
        <span class="recommended-reason">${escapeHtml(reason)}</span>
      </div>
      <button class="recommended-cta" data-action="${escapeHtml(rec.type)}" ${rec.requiresHorse && !ui.selectedHorse ? 'disabled' : ''} ${rec.requiresStaff && !ui.selectedStaff ? 'disabled' : ''}>
        <span>${escapeHtml(rec.label)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H19 M13 6 L19 12 L13 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;
}

function getSelectedHorseName() {
  const h = game.horses.find((x) => x.id === ui.selectedHorse);
  return h ? h.name : 'your horse';
}

function renderLineagePanel() {
  const model = buildLineageModel(game, ui.selectedHorse);
  if (!model) return '<p class="hint">Pick a horse to see their lineage.</p>';
  const horse = model.horse;
  // Phase 15 — empty states get useful microcopy instead of "no data" blanks.
  // The placeholder text telegraphs the next thing the player can do.
  const parentsEmpty = model.parents.length === 0;
  const offspringEmpty = model.offspring.length === 0;
  const traitsEmpty = !horse.traitsLine || horse.traitsLine.trim() === '';
  // Suggested next action depends on the horse's life stage:
  const isYoung = horse.age <= 2;
  const isCampaigner = horse.role?.toLowerCase().includes('campaigner') || horse.role?.toLowerCase().includes('show');
  const traitsHint = isYoung
    ? 'Foals inherit a mix of traits from sire and dam. Queue a breeding to make this horse a parent.'
    : isCampaigner
      ? 'Traits shape what this horse can win. Train and show to bring them forward.'
      : 'Traits are baked in at birth — they reveal themselves as the horse matures.';
  const parentsHint = 'Founded on the ranch — no recorded ancestry.';
  const offspringHint = isCampaigner
    ? 'Match this horse with a complementary stallion or mare to start a line.'
    : 'No foals on the ground yet. Time and the right pairing will change that.';
  return `
    <div class="lineage">
      <div class="lineage-block lineage-block--self">
        <p class="eyebrow">Selected</p>
        <div class="selected-horse-card">
          <div class="selected-horse-portrait">
            ${renderPortrait(horse, { size: 'xl', className: 'selected-horse-portrait-img' })}
          </div>
          <div class="selected-horse-meta">
            <strong>${escapeHtml(horse.name)}</strong>
            <small>age ${horse.age} · ${escapeHtml(horse.role)}</small>
          </div>
        </div>
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Parents</p>
        ${parentsEmpty
          ? `<div class="lineage-empty-card">
              <svg class="lineage-empty-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M24 8 L24 40 M16 16 L32 16 M14 30 L34 30" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
                <circle cx="24" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="16" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
                <circle cx="32" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
              </svg>
              <div>
                <strong>Founded on the ranch</strong>
                <p>${escapeHtml(parentsHint)}</p>
              </div>
            </div>`
          : model.parents.map((p) => `
            <div class="lineage-row lineage-row--link">
              ${renderPortrait(p, { size: 'sm' })}
              <button class="lineage-link" data-select-horse="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>
            </div>
          `).join('')}
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Offspring</p>
        ${offspringEmpty
          ? `<div class="lineage-empty-card">
              <svg class="lineage-empty-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M8 38 Q12 30 16 36 Q20 28 24 34 Q28 26 32 32 Q36 28 40 34" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
                <circle cx="24" cy="20" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/>
                <path d="M20 20 L20 28 L28 28 L28 20" fill="none" stroke="currentColor" stroke-width="1.4"/>
              </svg>
              <div>
                <strong>${isCampaigner ? 'Line begins with you' : 'No foals yet'}</strong>
                <p>${escapeHtml(offspringHint)}</p>
              </div>
            </div>`
          : model.offspring.map((o) => `
            <div class="lineage-row lineage-row--link">
              ${renderPortrait(o, { size: 'sm' })}
              <button class="lineage-link" data-select-horse="${escapeHtml(o.id)}">${escapeHtml(o.name)} · age ${o.age}</button>
            </div>
          `).join('')}
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Traits</p>
        ${traitsEmpty
          ? `<div class="lineage-empty-card">
              <svg class="lineage-empty-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M24 6 L24 42 M14 16 Q24 24 34 16 M14 32 Q24 24 34 32" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>
                <circle cx="24" cy="24" r="2" fill="currentColor"/>
              </svg>
              <div>
                <strong>${isYoung ? 'Trait unknown' : 'Reading the horse'}</strong>
                <p>${escapeHtml(traitsHint)}</p>
              </div>
            </div>`
          : `<small>${escapeHtml(horse.traitsLine)}</small>`}
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
  // P4: once a player has dismissed (or completed) the tutorial, shrink to
  // a single inline progress bar instead of the full 5-step checklist.
  const dismissed = ui.tutorialDismissed || completed.length > 0;
  if (dismissed) {
    return `
      <details class="tutorial tutorial--compact">
        <summary>
          <span class="tutorial-progress-label">Tutorial · ${progress}</span>
          <span class="tutorial-progress-bar" aria-hidden="true">
            ${TUTORIAL_STEPS.map((s) => `<span class="tutorial-progress-pip ${completed.includes(s.id) ? 'is-done' : ''}"></span>`).join('')}
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="chevron"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </summary>
        <div class="tutorial-body">
          <h2>${escapeHtml(step.title)}</h2>
          <p>${escapeHtml(step.body)}</p>
          <p class="hint">${escapeHtml(step.hint)}</p>
        </div>
      </details>
    `;
  }
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
  if (!ui.showShareCard) {
    // P5: collapsed preview tile. Shows what the share card looks like at
    // a glance without taking the full canvas, so users know what they're
    // building toward when they tap "Share card".
    const heroScore = scoreGame(game);
    const horseCount = game.horses?.length ?? 0;
    return `
      <section class="share-card-preview" data-toggle-share-card role="button" tabindex="0" aria-label="Open share card">
        <div class="share-card-preview-mock">
          <div class="share-card-preview-strip">
            <strong class="share-card-preview-title">Blood & Bridle</strong>
            <span class="share-card-preview-meta">Year ${getYear(game)} ${getSeason(game)} · ${horseCount} horses · ${heroScore.toLocaleString()} pts</span>
          </div>
          <div class="share-card-preview-stats">
            <div><span>Cash</span><strong>$${game.cash.toLocaleString()}</strong></div>
            <div><span>Legacy</span><strong>${game.legacy}</strong></div>
            <div><span>Rep</span><strong>${game.reputation}</strong></div>
          </div>
        </div>
        <div class="share-card-preview-cta">
          <span>Open share card</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H19 M13 6 L19 12 L13 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </section>
    `;
  }
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
  const allBids = result.allBids;
  // On mobile, only show top 3 with a "Show all bidders" toggle. Desktop
  // shows all bidders inline.
  const initialCount = 3;
  const showAll = ui.auctionShowAll ?? false;
  const visibleBids = showAll ? allBids : allBids.slice(0, initialCount);
  const hiddenCount = allBids.length - visibleBids.length;
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
      <ul class="auction-bidders">
        ${visibleBids.map((b) => {
          // Phase 12 — rival bidders get a Codex portrait. The mood
          // tells the player who wants the horse most (neutral=curious,
          // concerned=losing, arguing=won-and-now-haggling).
          // Phase 15 — portrait size bumped to 'md' so faces are readable
          // on mobile without a tap.
          const portraitHtml = b.portraitId
            ? renderRivalPortrait(b.portraitId, { size: 'md', context: 'auction' })
            : '';
          return `<li class="auction-bidder ${b === result.topBid ? 'auction-bidder--top' : ''}">
            ${portraitHtml}
            <span class="auction-bidder-info">
              <strong>${escapeHtml(b.name)}</strong>
              <span class="auction-bidder-offer">$${b.offer.toLocaleString()}${b === result.topBid ? ' · top bid' : ''}</span>
            </span>
          </li>`;
        }).join('')}
      </ul>
      ${hiddenCount > 0 ? `<button class="auction-toggle" data-toggle-auction>${showAll ? 'Hide' : 'Show all'} ${allBids.length} bidders</button>` : ''}
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
  // metricClass is now a module-level helper (computeMetricClass) so it
  // can be called from renderMetricsTiered too.
  const previousCash = lastRendered.cash;
  const previousDay = lastRendered.day;
  const previousTutorial = lastRendered.tutorial ?? { dismissed: false, completedSteps: [] };

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

  // Phase 10 — the Sheridan intro. First-person, voiced. Plays once on
  // first render, then the flag flips. The bowed-cello memorial tone
  // plays at low volume when the intro is on screen.
  if (!sheridanIntroShown) {
    sheridanIntroShown = true;
    audio.resume();
    audio.play('celloStinger');
    setTimeout(() => render(), SHERIDAN_INTRO.durationMs);
  }

  root.innerHTML = `
    ${renderSheridanIntro()}
    <main class="shell">
      <section class="hero hero--title-card">
        <div class="hero-backdrop" aria-hidden="true" style="background-image: url('${escapeHtml(pickTitleCardSurface({ isNight: false }).imagePath)}')"></div>
        <div class="hero-brand-block">
          <div class="hero-brand-mark">${renderBrandGlyph(game.ranchBrand, 'hero-brand-glyph')}</div>
          <div class="hero-brand-text">
            <p class="eyebrow">Neo-Western ranch management · Year ${model.year} ${model.season} · Day ${model.dayOfSeason}/${model.daysPerSeason}</p>
            <h1 class="wordmark">${escapeHtml(game.ranchName || 'Unbranded')}</h1>
            <p class="subtitle">${escapeHtml(model.subtitle)} · ${escapeHtml(model.crisisTitle)}${game.ownerName ? ' · ' + escapeHtml(game.ownerName) : ''}</p>
          </div>
        </div>
        <div class="hero-actions desktop-only">
          <button class="reset" data-ranch-profile title="Set the ranch name and the brand">Ranch</button>
          <button class="reset" data-codex title="The earned code of the West">Codex</button>
          <button class="reset" data-kitchen-table title="The hands at the kitchen table">Kitchen</button>
          <button class="audio-toggle ${audio.isMuted() ? 'is-muted' : ''}" data-audio-toggle title="Click to cycle: Sound off → Sound on → Sound + Ambient">${audio.isMuted() ? 'Sound off' : (audioAmbientEnabled ? 'Sound + Amb' : 'Sound on')}</button>
          <button class="reset" data-toggle-share-card>${ui.showShareCard ? 'Hide card' : 'Share card'}</button>
          <button class="reset" data-share-link>Share link</button>
          <button class="reset" data-export-dynasty>Export</button>
          <button class="reset" data-import-dynasty>Import</button>
          <button class="reset" data-reset>New legacy</button>
        </div>
        <div class="hero-actions-mobile mobile-only" aria-label="Quick actions">
          <button class="audio-toggle-mini ${audio.isMuted() ? 'is-muted' : ''}" data-audio-toggle aria-label="Toggle sound">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9 H9 L13 5 V19 L9 15 H5 Z M16 8 Q19 12 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </button>
          <button class="reset-mini" data-toggle-share-card aria-label="${ui.showShareCard ? 'Hide share card' : 'Show share card'}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 10 H20 M9 6 V19" stroke="currentColor" stroke-width="1.4"/></svg>
          </button>
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
        ${renderMetricsTiered(model, previousCash, previousDay)}
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
          <h2>${recommendAction(game) ? 'What now?' : 'Choose the cost'}</h2>
          ${renderRecommendedAction(model.actions, game)}
          <label class="staff-select-label">
            Handler
            <select name="staff-select">
              ${game.staff.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`).join('')}
            </select>
          </label>
          <details class="actions-disclosure" ${ui.showAllActions ? 'open' : ''}>
            <summary>
              <span>${ui.showAllActions ? 'Hide' : 'Show all'} ${model.actions.length} actions</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" class="chevron"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </summary>
            <div class="actions">
              ${(() => {
                // Phase 15 — render actions in priority groups with a
                // divider before the high-stakes cluster.
                const html = [];
                let lastWeight = null;
                const recommended = recommendAction(game);
                for (const action of model.actions) {
                  if (lastWeight === 'management' && action.weight === 'high-stakes') {
                    html.push('<hr class="actions-divider" aria-hidden="true" />');
                  }
                  const cls = ['action'];
                  if (action.weight) cls.push(`action--${action.weight}`);
                  if (action.danger) cls.push('action--danger');
                  if (action.weight === 'info') cls.push('action--info');
                  if (action.type === recommended) cls.push('action--recommended');
                  html.push(`
                    <button class="${cls.join(' ')}" data-action="${escapeHtml(action.type)}" ${action.requiresHorse && !ui.selectedHorse ? 'disabled' : ''} ${action.requiresStaff && !ui.selectedStaff ? 'disabled' : ''}>
                      <span class="action-icon" aria-hidden="true">${actionIcon(action.type)}</span>
                      <span class="action-label">${escapeHtml(action.label)}</span>
                      ${action.type === recommended ? '<span class="action-tag">RECOMMENDED</span>' : ''}
                    </button>
                  `);
                  lastWeight = action.weight;
                }
                return html.join('');
              })()}
            </div>
          </details>

          <div class="kitchen-shortcuts">
            <p class="eyebrow">Moral moments <span class="hint">— at the kitchen table</span></p>
            <div class="actions">
              ${game.horses.length > 0 ? `<button class="action action--danger" data-kitchen-skip="farrier" title="${game.cash < game.horses.length * 90 ? 'You can\'t afford the farrier this season.' : 'Bring it up at the kitchen table.'}">Skip the farrier</button>` : ''}
              ${game.hands.some((h) => h.status === 'working' && !h.perCall) ? `<button class="action action--danger" data-kitchen-skip="wages">Delay hand wages</button>` : ''}
              ${game.day % 90 === 0 ? `<button class="action action--danger" data-kitchen-skip="property_tax">Skip the property tax</button>` : ''}
              ${game.horses.some((h) => h.health <= 40) ? `<button class="action action--danger" data-kitchen-skip="veterinary">Skip the vet</button>` : ''}
            </div>
          </div>

          <p class="hint">Each action advances one in-game day. The ranch has five years to prove itself.</p>
        </aside>
      </section>

      <section class="layout layout--lower">
        ${renderBreedingPanel()}
        ${renderAuctionPreview()}
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">Show circuit</p>
            <h2>What's ahead</h2>
          </summary>
          <article class="panel">
            ${model.showCalendar.length === 0
              ? '<p class="hint">No more shows on the calendar.</p>'
              : `<ul>${model.showCalendar.map((s) => `<li><strong>${escapeHtml(s.title)}</strong> · ${escapeHtml(s.categoryLabel)} · ${escapeHtml(s.prestigeLabel)} · ${s.status === 'today' ? '<strong>TODAY</strong>' : `in ${s.daysUntil} day${s.daysUntil === 1 ? '' : 's'}`} · $${s.entryFee} entry / $${s.prizePool.toLocaleString()} purse</li>`).join('')}</ul>`}
            ${model.lastShowResult ? renderLastShowResult(model.lastShowResult) : ''}
          </article>
        </details>
      </section>

      <section class="layout layout--lower">
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">Land</p>
            <h2>Parcels & market</h2>
          </summary>
          <article class="panel">
            <ul>${model.parcels.map((line) => `<li>${escapeHtml(line.line)}</li>`).join('')}</ul>
            ${renderParcelMarket(model)}
          </article>
        </details>
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">Ranch</p>
            <h2>Upgrades</h2>
          </summary>
          ${renderRanchUpgrades()}
        </details>
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">Contracts</p>
            <h2>Boards & sales</h2>
          </summary>
          ${renderContracts()}
        </details>
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">People</p>
            <h2>Staff & NPCs</h2>
          </summary>
          <article class="panel">
            <ul>${model.staff.map((s) => `<li>${escapeHtml(s.line)}</li>`).join('')}</ul>
            <ul>${model.npcs.map((n) => `<li>${escapeHtml(n.line)}</li>`).join('')}</ul>
          </article>
        </details>
        <details class="lower-panel" open>
          <summary>
            <p class="eyebrow">Region</p>
            <h2>Rival ranches</h2>
          </summary>
          <article class="panel">
            <ul class="rivals-list">
              ${model.rivals.map((r) => {
                // Phase 12 — rival portraits surface here so the player
                // sees the family faces they compete against.
                const portraitHtml = r.portraitId
                  ? renderRivalPortrait(r.portraitId, { size: 'sm', context: 'community', name: r.name })
                  : '';
                return `<li class="rivals-list-item">
                  ${portraitHtml}
                  <span class="rivals-list-info">${escapeHtml(r.line)}</span>
                </li>`;
              }).join('')}
            </ul>
            <h3>Neighbors</h3>
            <ul class="community-list">
              ${model.community.available.map((m) => {
                const portraitHtml = m.portraitId
                  ? renderRivalPortrait(m.portraitId, { size: 'sm', context: 'community', name: m.name })
                  : '';
                return `<li class="community-list-item">
                  ${portraitHtml}
                  <span class="community-list-info">
                    <strong>${escapeHtml(m.name)}</strong>
                  <small>${escapeHtml(m.role)}${m.family ? ' · family' : ''}</small>
                </span>
              </li>`;
            }).join('')}
            ${model.community.departed.length > 0 ? `<li class="community-list-item community-list-item--departed">
              <span class="community-list-info">
                <em>${model.community.departed.length} neighbor${model.community.departed.length === 1 ? '' : 's'} gone since the country corner dropped.</em>
              </span>
            </li>` : ''}
          </ul>
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

    ${renderBottomNav()}
    ${renderMoreSheet()}
    ${renderInstallBanner()}
    ${renderOfflineIndicator()}
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
  // Open the Ranch Profile modal. (Phase 15 — querySelectorAll so the
  // bottom-nav button on mobile AND the hero-actions button on desktop
  // both wire correctly.)
  for (const btn of document.querySelectorAll('[data-ranch-profile]')) {
    btn.addEventListener('click', () => {
      audio.resume();
      audio.play('click');
      openRanchProfile();
    });
  }

  // Open the Codex of the Code.
  for (const btn of document.querySelectorAll('[data-codex]')) {
    btn.addEventListener('click', () => {
      audio.resume();
      audio.play('click');
      openCodex();
    });
  }

  // Open the kitchen table scene.
  for (const btn of document.querySelectorAll('[data-kitchen-table]')) {
    btn.addEventListener('click', () => {
      audio.resume();
      audio.play('click');
      openKitchenSceneFor('moral:farrier');
    });
  }

  // Moral-skip buttons in the action panel. Each opens the kitchen
  // table scene for the matching trigger; the player's choice lands
  // effects via applyKitchenChoice (which routes moralRisk through
  // the existing skipObligation reducer).
  for (const btn of document.querySelectorAll('[data-kitchen-skip]')) {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-kitchen-skip');
      audio.resume();
      audio.play('click');
      openKitchenSceneFor(`moral:${category}`);
    });
  }

  for (const btn of document.querySelectorAll('[data-reset]')) {
    btn.addEventListener('click', () => {
      audio.resume();
      audio.play('click');
      game = createNewGame();
      ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false, moreSheetOpen: false, auctionShowAll: false, installPromptReady: false, installBannerDismissed: false, isOffline: !navigator.onLine };
          lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null, season: null };
      soundtrackInitialized = false;
      stopSoundtrack();
      saveGame();
      render();
    });
  }

  for (const btn of document.querySelectorAll('[data-audio-toggle]')) {
    btn.addEventListener('click', () => {
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
  }

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
      ui.tutorialDismissed = true; // P4: shrink to compact progress bar
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

  for (const btn of document.querySelectorAll('[data-toggle-share-card]')) {
    btn.addEventListener('click', () => {
      audio.play('click');
      ui.showShareCard = !ui.showShareCard;
      render();
    });
  }

  for (const btn of document.querySelectorAll('[data-export-dynasty]')) {
    btn.addEventListener('click', () => {
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
  }

  for (const btn of document.querySelectorAll('[data-import-dynasty]')) {
    btn.addEventListener('click', () => {
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
            ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false, moreSheetOpen: false, auctionShowAll: false, installPromptReady: false, installBannerDismissed: false, isOffline: !navigator.onLine };
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
  }

  for (const btn of document.querySelectorAll('[data-share-link]')) {
    btn.addEventListener('click', async () => {
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
  }

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
    ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null, showShareCard: false, moreSheetOpen: false, auctionShowAll: false, installPromptReady: false, installBannerDismissed: false, isOffline: !navigator.onLine };
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

  // Phase 15 — bottom-nav "More" sheet. Toggle open on tap of the
  // bottom-nav More button, close on backdrop tap, and close before any
  // sheet-btn fires its underlying action (capture-phase, so the close
  // runs before the inner data-attr handler triggers a render).
  for (const btn of document.querySelectorAll('[data-more-sheet]')) {
    btn.addEventListener('click', () => {
      audio.resume();
      audio.play('click');
      ui.moreSheetOpen = !ui.moreSheetOpen;
      render();
    });
  }
  for (const el of document.querySelectorAll('[data-more-sheet-close]')) {
    el.addEventListener('click', () => {
      if (ui.moreSheetOpen) {
        ui.moreSheetOpen = false;
        render();
      }
    });
  }
  // Phase 15 — PWA install flow.
  for (const btn of document.querySelectorAll('[data-install-app]')) {
    btn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      ui.installPromptReady = false;
      ui.installBannerDismissed = true;
      render();
    });
  }
  for (const btn of document.querySelectorAll('[data-dismiss-install]')) {
    btn.addEventListener('click', () => {
      ui.installBannerDismissed = true;
      render();
    });
  }

  // Phase 15 — auction preview "show all bidders" toggle.
  for (const btn of document.querySelectorAll('[data-toggle-auction]')) {
    btn.addEventListener('click', () => {
      ui.auctionShowAll = !ui.auctionShowAll;
      render();
    });
  }

  // Phase 15 Sheridan lift — actions disclosure. The native <details> open
  // event fires when the user expands, so we mirror it into ui state and
  // re-render so any conditional UI updates.
  for (const det of document.querySelectorAll('.actions-disclosure')) {
    det.addEventListener('toggle', () => {
      const isOpen = det.hasAttribute('open');
      if (ui.showAllActions !== isOpen) {
        ui.showAllActions = isOpen;
        // No render here — the native element already updated visually.
      }
    });
  }

  // Capture-phase: any click on a sheet button should close the sheet
  // first so the action's subsequent render() reflects the closed state.
  for (const sheet of document.querySelectorAll('.more-sheet')) {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('.more-sheet-btn')) {
        ui.moreSheetOpen = false;
      }
    }, true);
  }
}

render();
