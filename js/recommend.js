/* recommend.js — motor de recomendaciones por reglas + estados derivados
   de las lecciones. Reglas (en orden de prioridad):
   1. Requisito previo sin completar de una lección en curso.
   2. Errores repetidos en el tema de una lección.
   3. Confusión entre servicios cubiertos por una guía de comparación.
   4. Lecciones marcadas "para repasar".
   5. Siguiente lección incompleta de la ruta.
   6. Precisión de dominio por debajo del umbral.
   7. Repaso de errores pendientes. */

import { getContent, getQuestion } from './content-loader.js';
import * as state from './state.js';
import { pct } from './utils.js';
import { t } from './i18n.js';

/* ---------- Helpers de lecciones ---------- */

export function orderedLessons() {
  const c = getContent();
  return c.lessons.slice().sort((a, b) => {
    if (a.domainId !== b.domainId) return a.domainId - b.domainId;
    const ta = a.taskStatements?.[0] || '';
    const tb = b.taskStatements?.[0] || '';
    if (ta !== tb) return ta.localeCompare(tb, undefined, { numeric: true });
    return a.id.localeCompare(b.id);
  });
}

export function lessonRelatedQuestions(lesson) {
  const c = getContent();
  const ids = new Set(lesson.knowledgeCheckQuestionIds || []);
  const related = c.questions.filter((q) => q.lessonId === lesson.id);
  related.forEach((q) => ids.add(q.id));
  return [...ids].map(getQuestion).filter(Boolean);
}

/* Estado derivado — nunca se marca como dominada por solo abrirla. */
export function getLessonDisplayStatus(lessonId) {
  const lesson = getContent().lessonsById.get(lessonId);
  if (!lesson) return 'notStarted';
  const s = state.getSettings();
  const ls = state.getLessonState(lessonId);
  if (!ls?.startedAt) return 'notStarted';

  const passed = ls.checksPassed && ls.lastCheckPct != null && ls.lastCheckPct >= s.checkThreshold;
  if (!passed) return ls.checkAttempts > 0 ? 'checkPending' : 'inProgress';

  const related = lessonRelatedQuestions(lesson);
  const stale = ls.lastCheckAt &&
    (Date.now() - Date.parse(ls.lastCheckAt)) > s.reviewDays * 24 * 60 * 60 * 1000;
  const missedAfter = related.some((q) => {
    const qs = state.getQuestionState(q.id);
    return qs?.lastResult === 'incorrect' && (!ls.lastCheckAt || qs.lastAttemptAt >= ls.lastCheckAt);
  });
  if (missedAfter || stale) return 'needsReview';

  const mastered = related.length > 0 && related.every((q) => state.getQuestionState(q.id)?.mastery === 'mastered');
  return mastered ? 'mastered' : 'completed';
}

export function lessonStatusCounts() {
  const counts = { notStarted: 0, inProgress: 0, checkPending: 0, needsReview: 0, completed: 0, mastered: 0 };
  orderedLessons().forEach((l) => { counts[getLessonDisplayStatus(l.id)] += 1; });
  return counts;
}

/* ---------- Motor de recomendaciones ---------- */

function serviceIncorrectCounts() {
  const map = {};
  state.listAttempts().forEach((a) => {
    Object.entries(a.resultSummary?.byService || {}).forEach(([sv, v]) => {
      map[sv] = (map[sv] || 0) + (v.incorrect || 0);
    });
  });
  return map;
}

function domainAccuracy() {
  const agg = {};
  state.listAttempts().forEach((a) => {
    Object.entries(a.resultSummary?.byDomain || {}).forEach(([d, v]) => {
      if (!agg[d]) agg[d] = { correct: 0, total: 0 };
      agg[d].correct += v.correct;
      agg[d].total += v.total;
    });
  });
  return agg;
}

function pendingMistakeCount() {
  const s = state.getState();
  return Object.values(s.questionStates)
    .filter((qs) => qs.incorrectCount > 0 && qs.mastery !== 'mastered').length;
}

export function getRecommendations(limit = 4) {
  const c = getContent();
  const s = state.getSettings();
  const recs = [];
  const seenLessons = new Set();
  const push = (rec) => {
    const key = rec.lessonId || rec.comparisonId || rec.type;
    if (seenLessons.has(key)) return;
    if (rec.lessonId) seenLessons.add(rec.lessonId);
    recs.push(rec);
  };

  /* 1. Requisitos previos de lecciones en curso */
  orderedLessons().forEach((l) => {
    const status = getLessonDisplayStatus(l.id);
    if (status !== 'inProgress' && status !== 'checkPending') return;
    (l.prerequisites || []).forEach((pid) => {
      const pre = c.lessonsById.get(pid);
      if (!pre) return;
      const preStatus = getLessonDisplayStatus(pid);
      if (preStatus !== 'completed' && preStatus !== 'mastered') {
        push({
          type: 'prereq', icon: '🧩', lessonId: pid,
          text: t('recommend.prereq', { title: pre.title }), route: `#/lesson/${pid}`,
        });
      }
    });
  });

  /* 2. Errores repetidos por tema → lección */
  const topicToLesson = new Map();
  c.questions.forEach((q) => {
    if (q.lessonId && q.topic && !topicToLesson.has(q.topic)) topicToLesson.set(q.topic, q.lessonId);
  });
  Object.entries(state.getState().questionStates).forEach(([qid, qs]) => {
    if (qs.incorrectCount < 2 || qs.mastery === 'mastered' || qs.lastResult !== 'incorrect') return;
    const q = getQuestion(qid);
    if (!q?.topic || !topicToLesson.has(q.topic)) return;
    const lessonId = topicToLesson.get(q.topic);
    const lesson = c.lessonsById.get(lessonId);
    if (!lesson) return;
    push({
      type: 'topicErrors', icon: '🎯', lessonId,
      text: t('recommend.topicErrors', { topic: q.topic }), route: `#/lesson/${lessonId}`,
    });
  });

  /* 3. Confusión de servicios → guía de comparación */
  const incorrectByService = serviceIncorrectCounts();
  c.comparisons.forEach((cmp) => {
    const confused = (cmp.services || []).filter((sv) => (incorrectByService[sv] || 0) > 0);
    if (confused.length >= 2) {
      const nameOf = (id) => c.servicesById.get(id)?.name || id;
      push({
        type: 'comparison', icon: '⚖️', comparisonId: cmp.id,
        text: t('recommend.comparison', { a: nameOf(confused[0]), b: nameOf(confused[1]) }),
        route: `#/comparison/${cmp.id}`,
      });
    }
  });

  /* 4. Lecciones para repasar */
  orderedLessons().forEach((l) => {
    if (getLessonDisplayStatus(l.id) === 'needsReview') {
      push({
        type: 'reviewLesson', icon: '🔁', lessonId: l.id,
        text: t('recommend.reviewLesson', { title: l.title }), route: `#/lesson/${l.id}`,
      });
    }
  });

  /* 5. Siguiente lección de la ruta */
  const next = orderedLessons().find((l) => ['notStarted', 'inProgress', 'checkPending'].includes(getLessonDisplayStatus(l.id)));
  if (next) {
    push({
      type: 'nextLesson', icon: '🎓', lessonId: next.id,
      text: t('recommend.nextLesson', { title: next.title }), route: `#/lesson/${next.id}`,
    });
  }

  /* 6. Precisión de dominio baja */
  Object.entries(domainAccuracy())
    .filter(([, v]) => v.total >= 3 && pct(v.correct, v.total) < s.domainThreshold)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .forEach(([d, v]) => {
      push({
        type: 'domainReview', icon: '📉', domainId: Number(d),
        text: t('recommend.domainReview', { d, pct: pct(v.correct, v.total) }),
        route: `#/domain/${d}`,
      });
    });

  /* 7. Errores pendientes */
  const mistakes = pendingMistakeCount();
  if (mistakes > 0) {
    push({ type: 'mistakeReview', icon: '🔁', text: t('recommend.mistakeReview', { n: mistakes }), route: '#/review' });
  }

  return recs.slice(0, limit);
}

/* Renderiza la tira de recomendaciones (usada en inicio, aprender y panel). */
export function renderRecommendations(container, limit = 4) {
  const recs = getRecommendations(limit);
  if (!recs.length) {
    container.innerHTML = `<p class="muted">${t('recommend.empty')}</p>`;
    return;
  }
  container.innerHTML = recs.map((r) => `
    <div class="rec-item">
      <span aria-hidden="true">${r.icon}</span>
      <span class="rec-text">${r.text}</span>
      <a class="btn small" href="${r.route}">${t('recommend.open')}</a>
    </div>`).join('');
}
