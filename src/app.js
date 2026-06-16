import { applyAction, createNewGame, isGameOver, scoreGame, buyAvailableParcel } from './game.js';
import { buildDashboardModel } from './ui.js';
import { buildLineageModel } from './lineage.js';
import { runAuction } from './auction.js';
import { checkEnding } from './endings.js';
import { AVAILABLE_PARCELS } from './map.js';

const STORAGE_KEY = 'blood-and-bridle-save-v2';

let game = loadGame();
let ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch' };

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
  return `
    <article class="metric">
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

function render() {
  const model = buildDashboardModel(game);
  const over = isGameOver(game);
  const finalEnding = checkEnding(game);

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Neo-Western ranch management · Year ${model.year} ${model.season} · Day ${model.dayOfSeason}/${model.daysPerSeason}</p>
          <h1>${escapeHtml(model.title)}</h1>
          <p class="subtitle">${escapeHtml(model.subtitle)} · ${escapeHtml(model.crisisTitle)}</p>
        </div>
        <button class="reset" data-reset>New legacy</button>
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
        ${model.metrics.map(renderMetric).join('')}
      </section>

      <section class="verdict ${over ? 'verdict--over' : ''}">
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
            ${model.horses.map((horse) => renderHorse(horse, ui.selectedHorse)).join('')}
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
          <p class="eyebrow">Land</p>
          <h2>Parcels & market</h2>
          <ul>${model.parcels.map((line) => `<li>${escapeHtml(line.line)}</li>`).join('')}</ul>
          ${renderParcelMarket(model)}
        </article>
      </section>

      <section class="layout layout--lower">
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
          <ol>${model.log.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>
        </article>
      </section>
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector('[data-reset]')?.addEventListener('click', () => {
    game = createNewGame();
    ui = { selectedHorse: game.horses[0]?.id, selectedStaff: game.staff[0]?.id, breedSire: null, breedDam: null, view: 'ranch' };
    saveGame();
    render();
  });

  document.querySelectorAll('[data-select-horse]').forEach((card) => {
    card.addEventListener('click', () => {
      ui.selectedHorse = card.dataset.selectHorse;
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
        game = applyAction(game, action);
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not act: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
        render();
      }
    });
  });

  document.querySelectorAll('[data-resolve-event]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        game = applyAction(game, { type: 'resolveEvent', optionIndex: Number(button.dataset.resolveEvent) });
        saveGame();
        render();
      } catch (error) {
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
        game = buyAvailableParcel(game, parcel);
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not buy parcel: ${error.message}`, ...(game.log ?? [])].slice(0, 20) };
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
}

render();
