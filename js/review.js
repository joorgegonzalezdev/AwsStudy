/* review.js — repaso de errores (con maestría: 3 aciertos en días distintos)
   y marcadores/preguntas difíciles con notas. */

import { getContent, getQuestion, getDomain } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, shuffle } from './utils.js';
import { createAttempt } from './quiz-engine.js';
import { navigate } from './router.js';

/* ---------- Repaso de errores ---------- */

export function renderReview() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const s = state.getState();

  const failed = Object.entries(s.questionStates)
    .filter(([, qs]) => qs.incorrectCount > 0)
    .map(([qid]) => getQuestion(qid))
    .filter(Boolean);
  const mastered = failed.filter((q) => s.questionStates[q.id]?.mastery === 'mastered');
  const pending = failed.filter((q) => s.questionStates[q.id]?.mastery !== 'mastered');

  outlet.innerHTML = `
    <h1>Repasar errores</h1>
    <p class="muted">Las preguntas que fallaste vuelven aquí hasta dominarlas: se retiran del repaso activo tras <b>3 aciertos en días distintos</b> (el historial completo se conserva).</p>
    <div class="grid grid-2">
      <div class="card">
        <h3>Pendientes de repaso</h3>
        <div class="big" style="font-size:2rem;font-weight:800">${pending.length}</div>
      </div>
      <div class="card">
        <h3>Dominadas</h3>
        <div class="big" style="font-size:2rem;font-weight:800">${mastered.length}</div>
        <p class="small muted">Siguen en tu historial.</p>
      </div>
    </div>
    <div class="card">
      <div class="btn-row">
        <button type="button" class="btn primary" id="review-practice" ${pending.length === 0 ? 'disabled' : ''}>Practicar con las ${pending.length} pendientes</button>
        <button type="button" class="btn" id="review-practice-10" ${pending.length === 0 ? 'disabled' : ''}>Sesión rápida de 10</button>
      </div>
      ${pending.length === 0 ? '<p class="small muted mt">No tienes errores pendientes. ¡Buen trabajo! Errar preguntas nuevas los añadirá aquí.</p>' : ''}
    </div>
    ${pending.length ? `
    <div class="card">
      <h2>Preguntas pendientes</h2>
      <table class="table">
        <thead><tr><th>Pregunta</th><th>Dominio</th><th>Fallos</th><th>Último resultado</th></tr></thead>
        <tbody>
          ${pending.map((q) => {
            const qs = s.questionStates[q.id];
            return `<tr>
              <td>${escapeHtml(q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question)}</td>
              <td>D${q.domain}</td>
              <td>${qs.incorrectCount}</td>
              <td>${qs.lastResult === 'correct' ? '<span class="badge ok">Acertada</span>' : '<span class="badge bad">Fallada</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}`;

  const start = (n) => {
    const ids = shuffle(pending.map((q) => q.id)).slice(0, n || pending.length);
    if (!ids.length) return;
    createAttempt({ mode: 'review', explicitIds: ids, config: { timerSeconds: 0, label: 'Repaso' } });
    navigate('/study/session');
  };
  outlet.querySelector('#review-practice')?.addEventListener('click', () => start(0));
  outlet.querySelector('#review-practice-10')?.addEventListener('click', () => start(10));
}

/* ---------- Marcadores ---------- */

export function renderBookmarks() {
  const outlet = document.getElementById('outlet');
  const s = state.getState();
  const bookmarked = Object.entries(s.questionStates)
    .filter(([, qs]) => qs.bookmarked)
    .map(([qid]) => ({ q: getQuestion(qid), qs: s.questionStates[qid] }))
    .filter((x) => x.q);

  outlet.innerHTML = `
    <h1>Marcadores y preguntas difíciles</h1>
    ${bookmarked.length === 0 ? `
      <div class="card"><p class="muted">Aún no has guardado preguntas. Usa el botón ☆ durante el estudio para guardarlas aquí.</p></div>` : `
      ${bookmarked.map(({ q, qs }) => `
        <div class="card" data-qid="${q.id}">
          <div class="chips">
            <span class="chip">D${q.domain} · Tarea ${q.taskStatement}</span>
            ${qs.difficult ? '<span class="badge warn">⚑ Difícil</span>' : ''}
          </div>
          <p class="q-text">${escapeHtml(q.question)}</p>
          <details>
            <summary>Ver respuesta y explicación</summary>
            <p><b>Correcta:</b> ${escapeHtml(q.correctAnswerIds.map((oid) => q.options.find((o) => o.id === oid)?.text).join(' · '))}</p>
            <p class="small">${escapeHtml(q.explanation)}</p>
          </details>
          <div class="field mt">
            <label for="note-${q.id}">Nota personal</label>
            <textarea id="note-${q.id}" rows="2" style="width:100%;font:inherit;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)" placeholder="Escribe un recordatorio…">${escapeHtml(qs.note || '')}</textarea>
          </div>
          <div class="btn-row">
            <button type="button" class="btn small primary" data-save-note="${q.id}">Guardar nota</button>
            <button type="button" class="btn small danger" data-remove-bookmark="${q.id}">Quitar marcador</button>
            ${qs.difficult ? `<button type="button" class="btn small" data-unset-difficult="${q.id}">Quitar marca de difícil</button>` : ''}
          </div>
        </div>`).join('')}`}`;

  outlet.querySelectorAll('[data-save-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.saveNote;
      state.setNote(qid, document.getElementById(`note-${qid}`).value);
      btn.textContent = '✔ Nota guardada';
      window.setTimeout(() => { btn.textContent = 'Guardar nota'; }, 1500);
    });
  });
  outlet.querySelectorAll('[data-remove-bookmark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.toggleBookmark(btn.dataset.removeBookmark);
      renderBookmarks();
    });
  });
  outlet.querySelectorAll('[data-unset-difficult]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.toggleDifficult(btn.dataset.unsetDifficult);
      renderBookmarks();
    });
  });
}
