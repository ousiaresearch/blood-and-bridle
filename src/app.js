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
const STORAGE_KEY = 'blood-and-bridle-save-v2';

// One audio engine for the whole session. AudioContext is created lazily on
// the first user gesture (browser policy).
const audio = createAudioEngine();
let audioAmbientEnabled = false;
let lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null };

let game = loadGame();
let ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null };

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

function renderHorse(horse, selectedHorseId) {
  const selected = horse.id === selectedHorseId ? 'card--selected' : '';
  return `
    <button class="card horse-card ${selected}" data-select-horse="${escapeHtml(horse.id)}">
      <span class="eyebrow">${escapeHtml(horse.role)}</span>
      <strong>${escapeHtml(horse.name)}</strong>
      <small>${escapeHtml(horse.bloodline)}</small>
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
        <strong>${escapeHtml(model.horse.name)}</strong>
        <small>age ${model.horse.age} · ${escapeHtml(model.horse.role)}</small>
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Parents</p>
        ${model.parents.length === 0 ? '<p class="hint">No recorded parents.</p>' :
          model.parents.map((p) => `<button class="lineage-link" data-select-horse="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`).join('')}
      </div>
      <div class="lineage-block">
        <p class="eyebrow">Offspring</p>
        ${model.offspring.length === 0 ? '<p class="hint">No offspring yet.</p>' :
          model.offspring.map((o) => `<button class="lineage-link" data-select-horse="${escapeHtml(o.id)}">${escapeHtml(o.name)} · age ${o.age}</button>`).join('')}
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
  return `
    <div class="verdict ${tone}" style="margin-top: 14px;">
      <strong>${escapeHtml(result.horseName)} · #${result.playerPlace}</strong>
      <span>${escapeHtml(result.show.title)} · score ${result.playerScore} · payout $${result.payout.toLocaleString()}</span>
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

function renderPendingEvent(model) {
  if (!model.pendingEvent) return '';
  const event = model.pendingEvent;
  return `
    <section class="event-modal">
      <h2>${escapeHtml(event.title)}</h2>
      <p>${escapeHtml(event.body)}</p>
      <div class="actions">
        ${event.options.map((opt, i) => `<button class="action" data-resolve-event="${i}">${escapeHtml(opt.label)}</button>`).join('')}
      </div>
    </section>
  `;
}

function renderEnding(model) {
  if (!model.ending) return '';
  return `
    <section class="event-modal event-modal--ending">
      <p class="eyebrow">Ending</p>
      <h2>${escapeHtml(model.ending.label)}</h2>
      <p>${escapeHtml(model.ending.body)}</p>
      <p>Final score: <strong>${scoreGame(game).toLocaleString()}</strong></p>
      <button class="action" data-reset>Start a new legacy</button>
    </section>
  `;
}

function renderBreedingPanel() {
  if (game.pendingBreeding) {
    return `
      <section class="panel">
        <p class="eyebrow">Pending breeding</p>
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

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Neo-Western ranch management · Year ${model.year} ${model.season} · Day ${model.dayOfSeason}/${model.daysPerSeason}</p>
          <h1>${escapeHtml(model.title)}</h1>
          <p class="subtitle">${escapeHtml(model.subtitle)} · ${escapeHtml(model.crisisTitle)}</p>
        </div>
        <div class="hero-actions">
          <button class="audio-toggle ${audio.isMuted() ? 'is-muted' : ''}" data-audio-toggle title="Click to cycle: Sound off → Sound on → Sound + Ambient">${audio.isMuted() ? 'Sound off' : (audioAmbientEnabled ? 'Sound + Amb' : 'Sound on')}</button>
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

      ${renderTutorialCard()}

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
            ${model.horses.map((horse) => {
              const isNew = newHorseIds.has(horse.id) ? ' is-new' : '';
              return renderHorse(horse, ui.selectedHorse).replace('class="card horse-card', `class="card horse-card${isNew}`);
            }).join('')}
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
          <ol>${model.log.map((line, i) => {
            const fresh = (i === 0 && newLogTop) ? ' class="is-new"' : '';
            return `<li${fresh}>${escapeHtml(line)}</li>`;
          }).join('')}</ol>
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

  bindEvents();

  // Update the snapshot for the next render
  lastRendered = {
    cash: Number(String(model.metrics.find((m) => m.label === 'Cash')?.value ?? '').replace(/[^0-9-]/g, '')) || previousCash,
    day: model.dayOfSeason,
    tutorial: model.tutorial ?? { dismissed: false, completedSteps: [] },
    horseIds: model.horses.map((h) => h.id),
    logTop: model.log[0],
  };
}

function playForOutcome(prevGame, nextGame, actionType) {
  // Resume AudioContext on the first user gesture
  audio.resume();
  audio.play('click');

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
  if (actionType === 'enterShow') audio.play('showEnter');
  if (actionType === 'acceptContract' || actionType === 'signWithDeveloper') audio.play('confirm');
  if (actionType === 'dismissTutorial') audio.play('stepDone');

  // Show result sound on the next render — handled there
}

function bindEvents() {
  document.querySelector('[data-reset]')?.addEventListener('click', () => {
    audio.resume();
    audio.play('click');
    game = createNewGame();
    ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch', lastFiredActionType: null };
    lastRendered = { cash: null, day: null, tutorial: { dismissed: false, completedSteps: [] }, lastShowResultId: null, ambientPreset: null };
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
}

render();
