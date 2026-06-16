import { applyAction, createNewGame, isGameOver, scoreGame } from './game.js';
import { buildDashboardModel } from './ui.js';

const STORAGE_KEY = 'blood-and-bridle-save-v1';

let game = loadGame();

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
  return `
    <div class="bar bar--${tone}" aria-label="${value} out of 100">
      <span style="width: ${Math.max(0, Math.min(100, value))}%"></span>
    </div>
  `;
}

function renderMetric(metric) {
  return `
    <article class="metric">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
    </article>
  `;
}

function renderHorse(horse, selectedHorseId) {
  const selected = horse.id === selectedHorseId ? 'card--selected' : '';
  return `
    <button class="card horse-card ${selected}" data-select-horse="${escapeHtml(horse.id)}">
      <span class="eyebrow">${escapeHtml(horse.role)}</span>
      <strong>${escapeHtml(horse.name)}</strong>
      <small>${escapeHtml(horse.bloodline)}</small>
      <p>${escapeHtml(horse.temperament)}</p>
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

function renderAction(action, selectedHorseId, selectedStaffId) {
  const disabled = (action.requiresHorse && !selectedHorseId) || (action.requiresStaff && !selectedStaffId);
  return `
    <button class="action ${action.danger ? 'action--danger' : ''}" data-action="${escapeHtml(action.type)}" ${disabled ? 'disabled' : ''}>
      ${escapeHtml(action.label)}
    </button>
  `;
}

function currentSelection() {
  const selectedHorse = document.querySelector('[name="horse-select"]')?.value ?? game.horses[0]?.id ?? '';
  const selectedStaff = document.querySelector('[name="staff-select"]')?.value ?? game.staff[0]?.id ?? '';
  return { selectedHorse, selectedStaff };
}

function render() {
  const selectedHorseId = game.horses[0]?.id ?? '';
  const selectedStaffId = game.staff[0]?.id ?? '';
  const model = buildDashboardModel(game);
  const over = isGameOver(game);

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Neo-Western ranch management prototype</p>
          <h1>${escapeHtml(model.title)}</h1>
          <p class="subtitle">${escapeHtml(model.subtitle)}</p>
        </div>
        <button class="reset" data-reset>New ranch</button>
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

      <section class="layout">
        <div class="panel panel--wide">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">The herd</p>
              <h2>Horses are the ranch</h2>
            </div>
            <select name="horse-select" aria-label="Selected horse">
              ${model.horses.map((horse) => `<option value="${escapeHtml(horse.id)}">${escapeHtml(horse.name)}</option>`).join('')}
            </select>
          </div>
          <div class="horse-grid">
            ${model.horses.map((horse) => renderHorse(horse, selectedHorseId)).join('')}
          </div>
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
            ${model.actions.map((action) => renderAction(action, selectedHorseId, selectedStaffId)).join('')}
          </div>
          <p class="hint">Each action advances one day. The MVP ends after day 30, bankruptcy, or a dead legacy.</p>
        </aside>
      </section>

      <section class="layout layout--lower">
        <article class="panel">
          <p class="eyebrow">People</p>
          <h2>Staff loyalty</h2>
          <ul>${model.staff.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
        </article>
        <article class="panel">
          <p class="eyebrow">Land</p>
          <h2>Parcels</h2>
          <ul>${model.parcels.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
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
    saveGame();
    render();
  });

  document.querySelectorAll('[data-select-horse]').forEach((card) => {
    card.addEventListener('click', () => {
      const select = document.querySelector('[name="horse-select"]');
      select.value = card.dataset.selectHorse;
      document.querySelectorAll('.horse-card').forEach((candidate) => candidate.classList.remove('card--selected'));
      card.classList.add('card--selected');
    });
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const { selectedHorse, selectedStaff } = currentSelection();
      const type = button.dataset.action;
      const action = { type };
      if (['train', 'vetCare', 'sellHorse', 'enterShow'].includes(type)) action.horseId = selectedHorse;
      if (type === 'train') action.staffId = selectedStaff;

      try {
        game = applyAction(game, action);
        saveGame();
        render();
      } catch (error) {
        game = { ...game, log: [`Could not act: ${error.message}`, ...game.log].slice(0, 12) };
        render();
      }
    });
  });
}

render();
