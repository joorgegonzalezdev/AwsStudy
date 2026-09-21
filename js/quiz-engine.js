/* quiz-engine.js — selección de preguntas, intentos, sesión compartida
   para Quiz Rápido y Simulacro de examen. */

import { getContent, getQuestion } from './content-loader.js';
import * as state from './state.js';
import { shuffle, uid, escapeHtml, formatTime, announce, confirmDialog } from './utils.js';
import { computeSummary, setsEqual } from './scoring.js';
import { navigate, setActiveNav } from './router.js';

const EXAM_WEIGHTS = { 1: 24, 2: 30, 3: 34, 4: 12 };
const EXAM_SIZE = 65;
const EXAM_SECONDS = 90 * 60;

let timerInterval = null;
let engineReady = false;

/* ---------- Selección ---------- */

function recentSeenIds(n) {
  const attempts = state.listAttempts().slice(0, n);
  const ids = new Set();
  attempts.forEach((a) => (a.questionOrder || []).forEach((id) => ids.add(id)));
  return ids;
}

function poolFor(mode, { domains = [], tasks = [] } = {}) {
  const c = getContent();
  let pool = c.questions.filter((q) => q.status === 'verified');
  if (mode === 'exam') pool = pool.filter((q) => q.type !== 'truefalse');
  if (domains.length) pool = pool.filter((q) => domains.includes(String(q.domain)));
  if (tasks.length) pool = pool.filter(q => tasks.includes(q.taskStatement));
  return pool;
}

function stratifiedCounts(pool, weights, size) {
  const groups = new Map();
  pool.forEach((q) => {
    const k = String(q.domain);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(q);
  });
  const keys = [...groups.keys()];
  const totalWeight = keys.reduce((acc, k) => acc + (weights[k] || 0), 0) || 1;
  const raw = keys.map((k) => ({
    key: k,
    available: groups.get(k).length,
    exact: ((weights[k] || 0) / totalWeight) * size,
  }));
  const counts = {};
  let assigned = 0;
  raw.forEach((r) => {
    counts[r.key] = Math.min(r.available, Math.floor(r.exact));
    assigned += counts[r.key];
  });
  // mayor resto, respetando disponibilidad
  const rest = raw.map((r) => ({ ...r, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  const totalAvail = raw.reduce((a, r) => a + r.available, 0);
  while (assigned < size && assigned < totalAvail && raw.length) {
    const r = rest[i % rest.length];
    if (counts[r.key] < r.available) { counts[r.key] += 1; assigned += 1; }
    i++;
    if (i > size * 4) break;
  }
  return { groups, counts };
}

function sampleWithCap(list, n, cap, recent) {
  const head = list.filter((q) => !recent.has(q.id));
  const tail = list.filter((q) => recent.has(q.id));
  const ordered = shuffle(head).concat(tail);
  const picked = [];
  const usedSub = new Map();
  const rest = [];
  for (const q of ordered) {
    if (picked.length >= n) { rest.push(q); continue; }
    const key = `${q.domain}|${q.subtopic || ''}`;
    const used = usedSub.get(key) || 0;
    if (used < cap) { usedSub.set(key, used + 1); picked.push(q); }
    else rest.push(q);
  }
  // rellenar ignorando el tope si faltan (pools pequeños)
  for (const q of rest) {
    if (picked.length >= n) break;
    picked.push(q);
  }
  return picked;
}

export function selectQuestions({ mode, domains = [], tasks = [], size }) {
  const pool = poolFor(mode, { domains, tasks });
  const recent = recentSeenIds(2);
  if (mode === 'exam') {
    const target = Math.min(EXAM_SIZE, pool.length);
    const { groups, counts } = stratifiedCounts(pool, EXAM_WEIGHTS, target);
    let picked = [];
    for (const [k, list] of groups) {
      picked = picked.concat(sampleWithCap(list, counts[k] || 0, 2, recent));
    }
    if (picked.length < target) {
      const chosen = new Set(picked.map((q) => q.id));
      for (const q of shuffle(pool)) {
        if (picked.length >= target) break;
        if (!chosen.has(q.id)) picked.push(q);
      }
    }
    return shuffle(picked);
  }
  // quiz / study: sin estratificación por peso; muestreo con tope por subtema
  const capped = mode === 'quiz' ? 2 : Infinity;
  const n = size || pool.length;
  return sampleWithCap(pool, n, capped, recent);
}

/* ---------- Intentos ---------- */

export function createAttempt({ mode, config = {}, explicitIds = null }) {
  let questions;
  if (explicitIds) {
    questions = explicitIds.map(getQuestion).filter(Boolean).filter((q) => q.status !== 'retired');
  } else {
    questions = selectQuestions({ mode, ...config });
  }
  const optionOrder = {};
  questions.forEach((q) => { optionOrder[q.id] = shuffle(q.options.map((o) => o.id)); });
  const attempt = {
    id: uid('att'),
    mode,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'in_progress',
    config,
    questionOrder: questions.map((q) => q.id),
    optionOrder,
    answers: {},
    currentIndex: 0,
    resultSummary: null,
  };
  state.saveAttempt(attempt);
  state.setCurrentAttempt(attempt.id);
  return attempt;
}

export function getAttempt(id) {
  return state.getAttempt(id);
}

/* ---------- Sesión (quiz / exam) ---------- */

export function startQuizSession(attemptId, { label } = {}) {
  const attempt = state.getAttempt(attemptId);
  if (!attempt) return;
  renderQuizQuestion(attempt, { label });
  startTimer(attempt);
}

function isMulti(q) {
  return q.type === 'multiple' && q.correctAnswerIds.length > 1;
}

function questionChips(q) {
  return `
    <div class="chips">
      <span class="chip">Dominio ${q.domain}</span>
      <span class="chip">Tarea ${q.taskStatement}</span>
      ${q.topic ? `<span class="chip">${escapeHtml(q.topic)}</span>` : ''}
      <span class="chip">${q.difficulty === 'challenging' ? 'Desafiante' : q.difficulty === 'intermediate' ? 'Intermedio' : 'Básico'}</span>
    </div>`;
}

function renderQuizQuestion(attempt, { label } = {}) {
  const idx = attempt.currentIndex;
  const qid = attempt.questionOrder[idx];
  const q = getQuestion(qid);
  if (!q) return;
  const total = attempt.questionOrder.length;
  const ans = attempt.answers[qid] || { selectedIds: [], flagged: false };
  const selected = ans.selectedIds || [];
  const multi = isMulti(q);
  const orderedIds = attempt.optionOrder[qid] || q.options.map((o) => o.id);
  const optionsHtml = orderedIds.map((oid) => {
    const opt = q.options.find((o) => o.id === oid);
    const inputType = multi ? 'checkbox' : 'radio';
    return `
      <label class="option ${selected.includes(oid) ? 'selected' : ''}">
        <input type="${inputType}" name="q-${qid}" value="${oid}" data-action="quiz-select" ${selected.includes(oid) ? 'checked' : ''}>
        <span>${escapeHtml(opt.text)}</span>
      </label>`;
  }).join('');

  const isExam = attempt.mode === 'exam';
  const outlet = document.getElementById('outlet');
  const answeredCount = attempt.questionOrder.filter((id) => (attempt.answers[id]?.selectedIds || []).length > 0).length;

  outlet.innerHTML = `
    <div class="quiz-header">
      <span class="badge ${isExam ? 'info' : 'neutral'}">${escapeHtml(label || (isExam ? 'Simulacro de examen (no oficial)' : 'Quiz rápido'))}</span>
      <span class="muted">Pregunta ${idx + 1} de ${total}</span>
      <span class="spacer"></span>
      <span class="timer" id="timer-display" data-remaining="${attempt.config.timerSeconds || 0}">--:--</span>
    </div>
    <div class="progress-track" role="progressbar" aria-valuenow="${Math.round(((idx + 1) / total) * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del quiz">
      <div class="progress-fill" style="width:${Math.round(((idx + 1) / total) * 100)}%"></div>
    </div>
    <div class="quiz-layout mt">
      <div>
        <div class="card">
          ${questionChips(q)}
          <p class="q-text">${escapeHtml(q.question)}</p>
          <p class="q-instruction">${escapeHtml(q.selectionInstruction || 'Elige UNA respuesta.')}</p>
          <div id="options">${optionsHtml}</div>
          <div class="btn-row mt">
            <button type="button" class="btn" data-action="quiz-prev" ${idx === 0 ? 'disabled' : ''}>◀ Anterior</button>
            <button type="button" class="btn" data-action="quiz-next" ${idx === total - 1 ? 'disabled' : ''}>Siguiente ▶</button>
            <span class="spacer" style="flex:1"></span>
            <button type="button" class="btn small ${ans.flagged ? 'toggled' : ''}" data-action="quiz-flag" aria-pressed="${!!ans.flagged}">⚑ Marcar para revisar</button>
            <button type="button" class="btn small ${state.getQuestionState(qid)?.bookmarked ? 'toggled' : ''}" data-action="quiz-bookmark" aria-pressed="${!!state.getQuestionState(qid)?.bookmarked}">☆ Guardar</button>
          </div>
        </div>
      </div>
      <div class="quiz-side">
        ${isExam ? `
        <div class="card">
          <h3>Navegador de preguntas</h3>
          <div class="navigator" role="group" aria-label="Navegador de preguntas">
            ${attempt.questionOrder.map((id, i) => {
              const a = attempt.answers[id];
              const n = (a?.selectedIds || []).length;
              return `<button type="button" data-action="quiz-goto" data-idx="${i}" class="${n > 0 ? 'answered' : ''} ${a?.flagged ? 'flagged' : ''} ${i === idx ? 'current' : ''}" aria-label="Pregunta ${i + 1}${n > 0 ? ', respondida' : ''}${a?.flagged ? ', marcada' : ''}">${i + 1}</button>`;
            }).join('')}
          </div>
          <p class="legend"><span>■ respondida</span><span>⚑ marcada</span><span>□ sin responder</span></p>
        </div>` : ''}
        <div class="card">
          <h3>Resumen</h3>
          <p class="small muted">Respondidas: <b>${answeredCount}</b> de ${total}</p>
          <button type="button" class="btn primary" data-action="quiz-submit">Terminar y ver resultados</button>
          <p class="small muted mt">Tus respuestas se guardan automáticamente. Puedes cerrar y continuar después desde el inicio.</p>
        </div>
      </div>
    </div>`;
}

function startTimer(attempt) {
  stopTimer();
  if (!attempt.config.timerSeconds) return;
  const deadline = new Date(attempt.startedAt).getTime() + attempt.config.timerSeconds * 1000;
  const isExam = attempt.mode === 'exam';
  timerInterval = window.setInterval(() => {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const remaining = Math.floor((deadline - Date.now()) / 1000);
    el.textContent = formatTime(Math.max(0, remaining));
    if (remaining <= 0) {
      el.classList.add('expired');
      if (isExam) {
        stopTimer();
        announce('Tiempo agotado. El examen se entrega automáticamente.');
        finishQuizAttempt(state.getCurrentAttemptId(), { auto: true });
      } else if (!el.dataset.warned) {
        el.dataset.warned = '1';
        announce('Tiempo agotado. El cronómetro es solo referencial; puedes continuar.');
      }
    }
  }, 500);
}

export function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

async function finishQuizAttempt(attemptId, { auto = false } = {}) {
  const attempt = state.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress') return;
  if (!auto) {
    const unanswered = attempt.questionOrder.filter((id) => !(attempt.answers[id]?.selectedIds || []).length);
    let ok = true;
    if (unanswered.length > 0) {
      ok = await confirmDialog({
        title: 'Terminar el intento',
        message: `Tienes ${unanswered.length} pregunta(s) sin responder. Las preguntas sin responder cuentan como incorrectas. ¿Terminar ahora?`,
        okText: 'Terminar',
      });
    }
    if (!ok) return;
  }
  finishAttempt(attemptId);
}

/* Registra, puntúa y navega a resultados. También usado por study-mode. */
export function finishAttempt(attemptId) {
  const attempt = state.getAttempt(attemptId);
  if (!attempt || attempt.status === 'completed') return null;
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
  const summary = computeSummary(attempt);
  state.update((s) => {
    const a = s.attempts[attemptId];
    a.status = 'completed';
    a.finishedAt = new Date().toISOString();
    a.resultSummary = summary;
    a.durationSeconds = elapsed;
    s.stats.totalTimeSeconds += elapsed;
  });
  // registrar resultados por pregunta (maestría, historial)
  attempt.questionOrder.forEach((qid) => {
    const q = getQuestion(qid);
    const ans = attempt.answers[qid];
    if (q && ans && (ans.selectedIds || []).length > 0) {
      state.recordAnswer(qid, { isCorrect: setsEqual(ans.selectedIds, q.correctAnswerIds) });
    }
  });
  if (state.getCurrentAttemptId() === attemptId) state.setCurrentAttempt(null);
  stopTimer();
  navigate(`/results/${attemptId}`);
  return summary;
}

/* ---------- Delegación de eventos (registrada una vez) ---------- */

export function initQuizEngine() {
  if (engineReady) return;
  engineReady = true;

  document.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-action="quiz-select"]');
    if (!input) return;
    const attemptId = state.getCurrentAttemptId();
    const attempt = state.getAttempt(attemptId);
    if (!attempt || attempt.status !== 'in_progress') return;
    const qid = attempt.questionOrder[attempt.currentIndex];
    const q = getQuestion(qid);
    if (!q) return;
    const multi = isMulti(q);
    let selected = Array.from(document.querySelectorAll(`input[name="q-${qid}"]:checked`)).map((i) => i.value);
    if (!multi) selected = selected.slice(-1);
    attempt.answers[qid] = { ...(attempt.answers[qid] || {}), selectedIds: selected, flagged: attempt.answers[qid]?.flagged || false };
    state.saveAttempt(attempt);
    // actualizar clase visual sin re-render completo
    document.querySelectorAll(`#options .option`).forEach((label) => {
      const val = label.querySelector('input')?.value;
      label.classList.toggle('selected', selected.includes(val));
    });
    if (!multi) renderQuizQuestion(state.getAttempt(attemptId), {});
  });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action^="quiz-"]');
    if (!btn) return;
    const attemptId = state.getCurrentAttemptId();
    const attempt = state.getAttempt(attemptId);
    const action = btn.dataset.action;
    if (!attempt || attempt.status !== 'in_progress') return;
    const qid = attempt.questionOrder[attempt.currentIndex];

    switch (action) {
      case 'quiz-prev':
        attempt.currentIndex = Math.max(0, attempt.currentIndex - 1);
        state.saveAttempt(attempt);
        renderQuizQuestion(attempt, {});
        break;
      case 'quiz-next': {
        attempt.currentIndex = Math.min(attempt.questionOrder.length - 1, attempt.currentIndex + 1);
        state.saveAttempt(attempt);
        renderQuizQuestion(attempt, {});
        break;
      }
      case 'quiz-goto':
        attempt.currentIndex = Number(btn.dataset.idx) || 0;
        state.saveAttempt(attempt);
        renderQuizQuestion(attempt, {});
        break;
      case 'quiz-flag': {
        attempt.answers[qid] = { selectedIds: attempt.answers[qid]?.selectedIds || [], flagged: !attempt.answers[qid]?.flagged };
        state.saveAttempt(attempt);
        renderQuizQuestion(attempt, {});
        break;
      }
      case 'quiz-bookmark': {
        state.toggleBookmark(qid);
        renderQuizQuestion(state.getAttempt(attemptId), {});
        break;
      }
      case 'quiz-submit':
        await finishQuizAttempt(attemptId);
        break;
      default:
        break;
    }
  });
}
