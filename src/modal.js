// Modal infrastructure. A single visible modal at a time. Closes on:
// - Escape key
// - Click outside the panel (on the overlay)
// - Click on .modal-close button
//
// Returns focus to the trigger element on close. Pauses background scrolling.
// Accessibility: ARIA dialog pattern with aria-modal + labelledby, focus
// trap inside the panel, keyboard-reachable controls.

let activeModal = null;
let prevActiveElement = null;
let prevBodyOverflow = '';

function trapFocus(e) {
  if (!activeModal) return;
  const panel = activeModal.querySelector('.modal-panel');
  if (!panel) return;
  const focusables = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function onKeydown(e) {
  if (!activeModal) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  } else {
    trapFocus(e);
  }
}

function onOverlayClick(e) {
  if (!activeModal) return;
  // Only close when the click is on the overlay itself, not bubbled from panel.
  if (e.target === activeModal) closeModal();
}

/**
 * Show a modal. Replaces any existing modal. Returns a close() function.
 *
 * @param {string} panelHTML - the inner panel HTML (rendered into .modal-panel).
 *                             The wrapper is created here; supply the inner
 *                             content. The first <h2>/[data-modal-title]
 *                             element will become the aria-labelledby target.
 * @param {object} [opts]
 * @param {string} [opts.title] - if no heading exists in the panelHTML, this
 *                                becomes the heading and aria-label.
 * @returns {{ close: () => void }}
 */
export function showModal(panelHTML, opts = {}) {
  // If a modal is already open, close it cleanly first.
  if (activeModal) closeModal();

  prevActiveElement = document.activeElement;
  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.addEventListener('click', onOverlayClick);

  const panel = document.createElement('div');
  panel.className = 'modal-panel';

  // Inject a heading if opts.title is set and the content doesn't already
  // have one. Helps screen readers and gives the modal a visible title.
  let bodyHTML = panelHTML;
  if (opts.title && !/<h[1-6]\b/i.test(panelHTML) && !panelHTML.includes('data-modal-title')) {
    bodyHTML = `<h2 class="modal-title" data-modal-title>${escapeHtml(opts.title)}</h2>${bodyHTML}`;
  }

  panel.innerHTML = `
    <button class="modal-close" aria-label="Close">×</button>
    ${bodyHTML}
  `;

  // Wire close button
  const closeBtn = panel.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  activeModal = overlay;

  // Find the heading for aria-labelledby
  const heading = panel.querySelector('h1, h2, h3, [data-modal-title]');
  if (heading) {
    if (!heading.id) heading.id = `modal-title-${Date.now()}`;
    overlay.setAttribute('aria-labelledby', heading.id);
  }

  // Focus the close button (or the panel as a fallback)
  const focusTarget = closeBtn ?? panel;
  requestAnimationFrame(() => focusTarget.focus());

  document.addEventListener('keydown', onKeydown);

  return { close: closeModal };
}

export function closeModal() {
  if (!activeModal) return;
  document.removeEventListener('keydown', onKeydown);
  activeModal.removeEventListener('click', onOverlayClick);
  activeModal.remove();
  activeModal = null;
  document.body.style.overflow = prevBodyOverflow;
  if (prevActiveElement && typeof prevActiveElement.focus === 'function') {
    try { prevActiveElement.focus(); } catch { /* element may be gone */ }
  }
}

export function isModalOpen() {
  return activeModal !== null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}