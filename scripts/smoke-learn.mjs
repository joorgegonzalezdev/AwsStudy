/* scripts/smoke-learn.mjs — prueba del sistema de aprendizaje:
   estados de lección y motor de recomendaciones. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
globalThis.window = { setTimeout, addEventListener() {}, scrollTo() {} };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
globalThis.fetch = async (url) => {
  const p = join(root, url.replace(/^\/+/, ''));
  return { ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) };
};

const { loadContent } = await import('../js/content-loader.js');
await loadContent('es');
const { touchLesson, recordAnswer, recordLessonCheck, getState } = await import('../js/state.js');
const { getLessonDisplayStatus, getRecommendations, lessonStatusCounts } = await import('../js/recommend.js');
const { getQuestion } = await import('../js/content-loader.js');

let errors = 0;
const check = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); errors++; } else console.log('  ✓ ' + msg); };

/* 1. Lección sin abrir */
check(getLessonDisplayStatus('L-1.1') === 'notStarted', 'L-1.1 sin empezar al inicio');

/* 2. Abrir la lección NO la domina */
touchLesson('L-1.1');
check(getLessonDisplayStatus('L-1.1') === 'inProgress', 'abrir -> inProgress (no dominada)');

/* 3. Comprobación superada al 100% */
recordLessonCheck('L-1.1', { pct: 100, passed: true });
check(getLessonDisplayStatus('L-1.1') === 'completed', 'comprobación superada -> completed');

/* 4. Comprobación fallida -> checkPending */
touchLesson('L-1.2');
recordLessonCheck('L-1.2', { pct: 50, passed: false });
check(getLessonDisplayStatus('L-1.2') === 'checkPending', 'comprobación fallida -> checkPending');

/* 5. Errores después de la comprobación -> needsReview */
touchLesson('L-1.3');
recordLessonCheck('L-1.3', { pct: 100, passed: true });
const q13 = getQuestion('D1-T1.3-001');
recordAnswer('D1-T1.3-001', { isCorrect: false });
recordAnswer('D1-T1.3-001', { isCorrect: false });
check(getLessonDisplayStatus('L-1.3') === 'needsReview', 'fallo posterior -> needsReview');

/* 6. Maestría: 3 días distintos en TODAS las preguntas relacionadas de L-1.1 */
const related = ['D1-T1.1-001', 'D1-T1.1-002', 'D1-T1.1-003', 'D1-T1.1-004', 'D1-T1.1-005'];
for (const qid of related) {
  for (const day of ['2026-09-01', '2026-09-22', '2026-09-23']) {
    const s = getState();
    s.questionStates[qid] = s.questionStates[qid] || {
      seenCount: 0, correctCount: 0, incorrectCount: 0, consecutiveCorrect: 0,
      separateCorrectDates: [], mastery: 'none', lastResult: null, lastAttemptAt: null,
      bookmarked: false, difficult: false, note: '', hintUsedCount: 0,
    };
    const qs = s.questionStates[qid];
    if (!qs.separateCorrectDates.includes(day)) qs.separateCorrectDates.push(day);
    qs.mastery = qs.separateCorrectDates.length >= 3 ? 'mastered' : 'learning';
  }
}
check(getLessonDisplayStatus('L-1.1') === 'mastered', '3 días distintos -> mastered (no por abrirla)');

/* 7. Recomendaciones */
const recs = getRecommendations(8);
console.log('Recomendaciones:', recs.map((r) => r.type + ':' + (r.lessonId || r.comparisonId || '')).join(', '));
check(recs.some((r) => r.type === 'nextLesson' && r.lessonId === 'L-1.2'), 'siguiente lección recomendada = L-1.2');
check(recs.some((r) => r.type === 'topicErrors'), 'detecta errores repetidos por tema');
const recTypes = new Set(recs.map((r) => r.type));
check(recTypes.size === recs.length, 'sin recomendaciones duplicadas');

/* 8. Confusión de servicios -> comparación */
const att = getState().attempts;
const fakeAttempt = {
  id: 'att-test', mode: 'quiz', createdAt: new Date().toISOString(), startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(), status: 'completed', config: {},
  questionOrder: [], optionOrder: {}, answers: {},
  resultSummary: { total: 4, correct: 0, incorrect: 4, unanswered: 0, percentage: 0, byDomain: {}, byTask: {}, byTopic: {}, byService: { 'amazon-cloudwatch': { correct: 0, incorrect: 2, total: 2 }, 'aws-cloudtrail': { correct: 0, incorrect: 2, total: 2 } }, weakTopics: [] },
};
getState().attempts['att-test'] = fakeAttempt;
const recs2 = getRecommendations(8);
check(recs2.some((r) => r.type === 'comparison' && r.comparisonId === 'cmp-cloudwatch-cloudtrail-config'),
  'confusión CloudWatch/CloudTrail -> guía de comparación');

/* 9. Persistencia */
const saved = JSON.parse(localStorage.getItem('ruta-clf-c02:v1'));
check(saved.lessonStates['L-1.1']?.checksPassed === true, 'estado de lección persistido');

console.log(errors === 0 ? '✅ Smoke de aprendizaje completado.' : `❌ ${errors} fallo(s)`);
process.exit(errors ? 1 : 0);
