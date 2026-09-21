/* state.js — almacén central del estado del alumno con pub/sub.
   TODAS las mutaciones pasan por aquí; storage.js solo persiste. */

import * as storage from './storage.js';
import { todayISO } from './utils.js';

let state = storage.loadState();
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (e) { console.error(e); }
  });
}

export function update(mutator) {
  const result = mutator(state);
  storage.saveState(state);
  notify();
  return result;
}

/* ---------- Preferencias ---------- */
export function getSettings() {
  return state.settings;
}

export function updateSettings(patch) {
  update((s) => { Object.assign(s.settings, patch); });
}

export function applyPreferences() {
  const { theme, reducedMotion } = state.settings;
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  if (reducedMotion) root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
}

/* ---------- Estado por pregunta ---------- */
export function getQuestionState(qid) {
  return state.questionStates[qid] || null;
}

function emptyQuestionState() {
  return {
    seenCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveCorrect: 0,
    separateCorrectDates: [],
    mastery: 'none',           // none | learning | mastered
    lastResult: null,          // 'correct' | 'incorrect'
    lastAttemptAt: null,
    bookmarked: false,
    difficult: false,
    note: '',
    hintUsedCount: 0,
  };
}

/* Registra el resultado de responder una pregunta.
   Maestría: 3 aciertos correctos en DÍAS distintos. */
export function recordAnswer(qid, { isCorrect }) {
  update((s) => {
    const qs = s.questionStates[qid] || emptyQuestionState();
    qs.seenCount += 1;
    const today = todayISO();
    if (isCorrect) {
      qs.correctCount += 1;
      qs.consecutiveCorrect += 1;
      if (!qs.separateCorrectDates.includes(today)) qs.separateCorrectDates.push(today);
    } else {
      qs.incorrectCount += 1;
      qs.consecutiveCorrect = 0;
    }
    qs.lastResult = isCorrect ? 'correct' : 'incorrect';
    qs.lastAttemptAt = new Date().toISOString();
    qs.mastery = qs.separateCorrectDates.length >= 3 ? 'mastered' : (qs.seenCount > 0 ? 'learning' : 'none');
    s.questionStates[qid] = qs;
    s.stats.totalAnswered += 1;
    if (isCorrect) s.stats.totalCorrect += 1;
    s.stats.lastStudiedAt = qs.lastAttemptAt;
  });
}

export function recordHintUsed(qid) {
  update((s) => {
    const qs = s.questionStates[qid] || emptyQuestionState();
    qs.hintUsedCount += 1;
    s.questionStates[qid] = qs;
    s.stats.hintUses += 1;
  });
}

export function toggleBookmark(qid) {
  update((s) => {
    const qs = s.questionStates[qid] || emptyQuestionState();
    qs.bookmarked = !qs.bookmarked;
    s.questionStates[qid] = qs;
    return qs.bookmarked;
  });
}

export function toggleDifficult(qid) {
  update((s) => {
    const qs = s.questionStates[qid] || emptyQuestionState();
    qs.difficult = !qs.difficult;
    s.questionStates[qid] = qs;
    return qs.difficult;
  });
}

export function setNote(qid, note) {
  update((s) => {
    const qs = s.questionStates[qid] || emptyQuestionState();
    qs.note = String(note || '').slice(0, 2000);
    s.questionStates[qid] = qs;
  });
}

/* ---------- Estado por lección (sistema de aprendizaje) ---------- */

function emptyLessonState() {
  return {
    startedAt: null,
    lastVisitAt: null,
    checkAttempts: 0,
    lastCheckAt: null,
    lastCheckPct: null,
    checksPassed: false,
  };
}

export function getLessonState(lessonId) {
  return state.lessonStates[lessonId] || null;
}

/* Marca la lección como iniciada/visitada. Abrir NO equivale a dominar. */
export function touchLesson(lessonId) {
  update((s) => {
    const ls = s.lessonStates[lessonId] || emptyLessonState();
    const now = new Date().toISOString();
    if (!ls.startedAt) ls.startedAt = now;
    ls.lastVisitAt = now;
    s.lessonStates[lessonId] = ls;
  });
}

export function recordLessonCheck(lessonId, { pct, passed }) {
  update((s) => {
    const ls = s.lessonStates[lessonId] || emptyLessonState();
    ls.checkAttempts += 1;
    ls.lastCheckAt = new Date().toISOString();
    ls.lastCheckPct = pct;
    if (passed) ls.checksPassed = true;
    s.lessonStates[lessonId] = ls;
  });
}

/* ---------- Intentos ---------- */
export function saveAttempt(attempt) {
  update((s) => { s.attempts[attempt.id] = attempt; });
}

export function getAttempt(id) {
  return state.attempts[id] || null;
}

export function setCurrentAttempt(id) {
  update((s) => { s.session.currentAttemptId = id; });
}

export function getCurrentAttemptId() {
  return state.session.currentAttemptId;
}

export function listAttempts() {
  return Object.values(state.attempts)
    .filter((a) => a.status === 'completed')
    .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
}

export function findUnfinishedAttempt() {
  const id = state.session.currentAttemptId;
  if (!id) return null;
  const a = state.attempts[id];
  if (a && a.status === 'in_progress') return a;
  return null;
}

/* ---------- Datos exportables ---------- */
export function exportData() {
  return JSON.parse(JSON.stringify(state));
}

export function importData(json) {
  const imported = storage.importState(json);
  state = imported;
  storage.saveState(state);
  applyPreferences();
  notify();
}

export function clearAllData() {
  storage.clearAll();
  state = storage.loadState();
  applyPreferences();
  notify();
}
