/* utils.js — helpers de DOM, formato y accesibilidad */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/* Anuncia un mensaje a tecnologías de asistencia (aria-live). */
export function announce(message) {
  const region = document.getElementById('announcer');
  if (!region) return;
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 30);
}

/* Confirmación accesible mediante modal. Devuelve Promise<boolean>. */
export function confirmDialog({ title = 'Confirmar', message = '', okText = 'Aceptar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="btn-row">
          <button type="button" class="btn" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${escapeHtml(okText)}</button>
        </div>
      </div>`;
    const done = (val) => { backdrop.remove(); resolve(val); };
    backdrop.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok') done(true);
      else if (act === 'cancel' || e.target === backdrop) done(false);
    });
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(false);
    });
    document.body.appendChild(backdrop);
    const okBtn = backdrop.querySelector('[data-act="ok"]');
    okBtn.focus();
  });
}

/* Descarga un objeto como archivo JSON. */
export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      out += Array.isArray(v) ? v.join('') : String(v ?? '');
    }
  });
  return out;
}
