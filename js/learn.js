/* learn.js — sección principal "Aprender":
   ruta por dominio/tarea → lección → comprobación de conocimientos (3-5
   preguntas) → explicaciones → siguiente lección recomendada. */

import { getContent, getDomain, getLesson, getQuestion } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, announce, pct } from './utils.js';
import { t } from './i18n.js';
import {
  getLessonDisplayStatus, orderedLessons, lessonRelatedQuestions,
  getRecommendations, renderRecommendations,
} from './recommend.js';
import { navigate } from './router.js';

const STATUS_KEY = {
  notStarted: 'learn.status.notStarted',
  inProgress: 'learn.status.inProgress',
  checkPending: 'learn.status.checkPending',
  needsReview: 'learn.status.needsReview',
  completed: 'learn.status.completed',
  mastered: 'learn.status.mastered',
};
const STATUS_BADGE = {
  notStarted: 'neutral', inProgress: 'info', checkPending: 'warn',
  needsReview: 'warn', completed: 'ok', mastered: 'ok',
};

let selectedDomain = '';
let reader = null; // estado del lector: { lessonId, mode, qIndex, checkIds, answers }

function statusBadge(lessonId) {
  const st = getLessonDisplayStatus(lessonId);
  return `<span class="badge ${STATUS_BADGE[st]}">${escapeHtml(t(STATUS_KEY[st]))}</span>`;
}

function actionLabel(st) {
  if (st === 'notStarted') return t('learn.startLesson');
  if (st === 'inProgress' || st === 'checkPending') return t('learn.resumeLesson');
  return t('learn.reviewLesson');
}

/* ---------- Ruta de aprendizaje ---------- */

export function renderLearnHome() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const lessons = orderedLessons().filter((l) => !selectedDomain || String(l.domainId) === selectedDomain);

  outlet.innerHTML = `
    <h1>${escapeHtml(t('learn.title'))}</h1>
    <p class="muted">${escapeHtml(t('learn.intro'))}</p>
    <div class="card">
      <h3>${escapeHtml(t('recommend.title'))}</h3>
      <div id="rec-strip"></div>
    </div>
    <div class="field">
      <label for="learn-domain">${escapeHtml(t('study.domain'))}</label>
      <select id="learn-domain">
        <option value="">${escapeHtml(t('learn.allDomains'))}</option>
        ${c.domains.map((d) => `<option value="${d.id}" ${String(d.id) === selectedDomain ? 'selected' : ''}>D${d.id} · ${escapeHtml(d.name)} (${d.weight}%)</option>`).join('')}
      </select>
    </div>
    <h2>${escapeHtml(t('learn.path'))}</h2>
    ${c.domains
      .filter((d) => !selectedDomain || String(d.id) === selectedDomain)
      .map((d) => `
      <div class="card">
        <h3>D${d.id} · ${escapeHtml(d.name)} <span class="badge neutral">${d.weight}%</span></h3>
        ${d.tasks.map((tk) => {
          const ls = lessons.filter((l) => (l.taskStatements || []).includes(tk.id));
          if (!ls.length) return '';
          return `
            <div class="mt">
              <b>${escapeHtml(tk.id)} · ${escapeHtml(tk.title)}</b>
              ${ls.map((l) => `
                <div class="rec-item" data-lesson="${l.id}">
                  ${statusBadge(l.id)}
                  <span class="rec-text">📖 <a href="#/lesson/${l.id}">${escapeHtml(l.title)}</a>
                  <span class="muted small">· ${escapeHtml(t('lesson.readingTime', { n: l.estimatedMinutes }))}</span></span>
                  <a class="btn small" href="#/lesson/${l.id}">${escapeHtml(actionLabel(getLessonDisplayStatus(l.id)))}</a>
                </div>`).join('')}
            </div>`;
        }).join('')}
      </div>`).join('')}`;

  renderRecommendations(document.getElementById('rec-strip'), 3);
  outlet.querySelector('#learn-domain').addEventListener('change', (e) => {
    selectedDomain = e.target.value;
    renderLearnHome();
  });
}

/* ---------- Lector de lección ---------- */

export function renderLessonReader(lessonId) {
  const lesson = getLesson(lessonId);
  const outlet = document.getElementById('outlet');
  if (!lesson) {
    outlet.innerHTML = `<div class="card"><p>${escapeHtml(t('lesson.notFound'))}</p><a class="btn primary" href="#/learn">${escapeHtml(t('learn.backToPath'))}</a></div>`;
    return;
  }
  if (!reader || reader.lessonId !== lessonId) {
    reader = { lessonId, mode: 'read', qIndex: 0, checkIds: buildCheckIds(lesson), answers: {} };
  }
  state.touchLesson(lessonId);

  if (reader.mode === 'check') return renderCheckQuestion(lesson);
  if (reader.mode === 'results') return renderCheckResults(lesson);
  return renderReadPhase(lesson);
}

function buildCheckIds(lesson) {
  const ids = [...new Set(lesson.knowledgeCheckQuestionIds || [])].map(getQuestion).filter(Boolean).map((q) => q.id);
  if (ids.length < 3) {
    lessonRelatedQuestions(lesson).forEach((q) => { if (!ids.includes(q.id)) ids.push(q.id); });
  }
  return ids.slice(0, 5);
}

function renderReadPhase(lesson) {
  const outlet = document.getElementById('outlet');
  const c = getContent();
  const s = state.getSettings();
  const status = getLessonDisplayStatus(lesson.id);
  const relatedCount = lessonRelatedQuestions(lesson).length;
  const prereqPending = (lesson.prerequisites || [])
    .map((pid) => ({ pre: c.lessonsById.get(pid), st: getLessonDisplayStatus(pid) }))
    .filter((x) => x.pre && x.st !== 'completed' && x.st !== 'mastered');

  outlet.innerHTML = `
    <p><a href="#/learn">${escapeHtml(t('learn.backToPath'))}</a></p>
    <div class="card lesson-body">
      <h1>${escapeHtml(lesson.title)}</h1>
      <div class="chips">
        ${(lesson.taskStatements || []).map((tk) => `<span class="chip">${escapeHtml(t('common.task'))} ${tk}</span>`).join('')}
        <span class="chip">${escapeHtml(t('lesson.readingTime', { n: lesson.estimatedMinutes }))}</span>
        ${statusBadge(lesson.id)}
      </div>
      ${prereqPending.length ? `<div class="notice mt">${escapeHtml(t('learn.prereqPending', { title: prereqPending[0].pre.title }))}</div>` : ''}
      ${lesson.learningObjective ? `
        <p class="mt"><b>${escapeHtml(t('learn.objective'))}:</b> ${escapeHtml(lesson.learningObjective)}</p>` : ''}
      <p><b>${escapeHtml(lesson.summary)}</b></p>
      ${(lesson.explanation || '').split('\n\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      <h3>${escapeHtml(t('lesson.whyExam'))}</h3>
      <p>${escapeHtml(lesson.examRelevance)}</p>
      ${lesson.examClues?.length ? `
        <h3>${escapeHtml(t('learn.examClues'))}</h3>
        <div class="chips">${lesson.examClues.map((cl) => `<span class="chip">🔑 ${escapeHtml(cl)}</span>`).join('')}</div>` : ''}
      <h3>${escapeHtml(t('lesson.example'))}</h3>
      <p>${escapeHtml(lesson.awsExample)}</p>
      <h3>${escapeHtml(t('lesson.keyTerms'))}</h3>
      <div class="lesson-terms">
        ${(lesson.keyTerms || []).map((tk) => `<div class="term">· <b>${escapeHtml(tk.term)}</b>: ${escapeHtml(tk.definition)}</div>`).join('')}
      </div>
      <h3>${escapeHtml(t('lesson.confusions'))}</h3>
      ${(lesson.commonConfusions || []).map((cc) => `<div class="confusion"><b>${escapeHtml(cc.withWhat)}:</b> ${escapeHtml(cc.difference)}</div>`).join('')}
      ${(lesson.comparisons || []).map((cmp) => `
        <h3>${escapeHtml(cmp.title)}</h3>
        <table class="table">
          <thead><tr>${Object.keys(cmp.rows[0]).map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
          <tbody>${cmp.rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`).join('')}
      <h3>${escapeHtml(t('lesson.sources'))}</h3>
      <ul>${(lesson.sources || []).map((src) => `<li><a href="${src.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.title)}</a></li>`).join('')}</ul>
      <p class="small muted">${escapeHtml(t('lesson.lastReview', { date: lesson.lastReviewedAt }))} · ${escapeHtml(t('lesson.examGuide', { v: lesson.examGuideVersion }))}</p>
      <p class="small muted">${escapeHtml(t('learn.markVisitedNote'))}</p>
    </div>

    <div class="card" id="check-section">
      <h2>${escapeHtml(t('learn.knowledgeCheck'))}</h2>
      <p class="muted">${escapeHtml(t('learn.checkIntro', { n: reader.checkIds.length, pct: s.checkThreshold }))}</p>
      <p class="small muted">${escapeHtml(t('lesson.associated', { n: relatedCount }))}</p>
      <button type="button" class="btn primary" id="start-check">${escapeHtml(status === 'checkPending' ? t('learn.retryCheck') : t('learn.startCheck'))}</button>
    </div>`;

  outlet.querySelector('#start-check').addEventListener('click', () => {
    reader.mode = 'check';
    reader.qIndex = 0;
    reader.answers = {};
    renderLessonReader(lesson.id);
  });
}

/* ---------- Comprobación de conocimientos ---------- */

function renderCheckQuestion(lesson) {
  const outlet = document.getElementById('outlet');
  const total = reader.checkIds.length;
  const qid = reader.checkIds[reader.qIndex];
  const q = getQuestion(qid);
  if (!q) { reader.qIndex += 1; nextOrFinish(lesson); return; }
  const ans = reader.answers[qid] || { selectedIds: [], revealed: false };
  const multi = q.type === 'multiple' && q.correctAnswerIds.length > 1;

  const optionsHtml = q.options.map((o) => {
    const isCorrectOpt = q.correctAnswerIds.includes(o.id);
    const isSelected = (ans.selectedIds || []).includes(o.id);
    let cls = 'option';
    if (ans.revealed) {
      if (isCorrectOpt) cls += ' correct';
      else if (isSelected) cls += ' incorrect';
    } else if (isSelected) cls += ' selected';
    const exp = ans.revealed
      ? `<span class="opt-exp">${q.correctAnswerIds.includes(o.id) ? '✔ ' : '✘ '}${escapeHtml(q.optionExplanations?.[o.id] || '')}</span>`
      : '';
    return `
      <button type="button" class="${cls}" data-oid="${o.id}" ${ans.revealed ? 'disabled' : ''} aria-pressed="${isSelected}">
        <span>${escapeHtml(o.text)}</span>${exp}
      </button>`;
  }).join('');

  outlet.innerHTML = `
    <div class="quiz-header">
      <span class="badge info">${escapeHtml(t('learn.knowledgeCheck'))}</span>
      <span class="muted">${escapeHtml(t('common.question'))} ${reader.qIndex + 1} ${escapeHtml(t('common.of'))} ${total}</span>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="btn small" id="check-exit">${escapeHtml(t('common.exit'))}</button>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.round((reader.qIndex / total) * 100)}%"></div></div>
    <div class="card mt">
      <p class="q-text">${escapeHtml(q.question)}</p>
      <p class="q-instruction">${escapeHtml(q.selectionInstruction || t('common.chooseOne'))}</p>
      <div id="check-options">${optionsHtml}</div>
      ${!ans.revealed ? `
        <div class="btn-row mt">
          <button type="button" class="btn primary" id="check-answer" ${(ans.selectedIds || []).length === 0 ? 'disabled' : ''}>${escapeHtml(t('study.check'))}</button>
        </div>` : `
        <div class="feedback ${ans.isCorrect ? 'correct' : 'incorrect'}" role="status">
          <div class="fb-title">${ans.isCorrect ? escapeHtml(t('study.correctTitle')) : escapeHtml(t('study.incorrectTitle'))}</div>
          <div class="fb-body">
            ${!ans.isCorrect ? `<p><b>${escapeHtml(t('common.correctAnswer'))}</b> ${escapeHtml(q.correctAnswerIds.map((oid) => q.options.find((o) => o.id === oid)?.text).join(' · '))}</p>` : ''}
            <p>${escapeHtml(q.explanation)}</p>
          </div>
        </div>
        <div class="btn-row mt">
          <button type="button" class="btn primary" id="check-continue">${reader.qIndex + 1 >= total ? escapeHtml(t('study.seeSummary')) : escapeHtml(t('common.continue'))}</button>
        </div>`}
    </div>`;

  outlet.querySelector('#check-exit').addEventListener('click', () => {
    reader.mode = 'read';
    renderLessonReader(lesson.id);
  });

  outlet.querySelectorAll('#check-options [data-oid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (ans.revealed) return;
      const oid = btn.dataset.oid;
      let sel = ans.selectedIds || [];
      sel = multi ? (sel.includes(oid) ? sel.filter((x) => x !== oid) : sel.concat(oid)) : [oid];
      ans.selectedIds = sel;
      reader.answers[qid] = ans;
      renderCheckQuestion(lesson);
    });
  });

  outlet.querySelector('#check-answer')?.addEventListener('click', () => {
    const sel = ans.selectedIds || [];
    if (!sel.length) return;
    ans.isCorrect = q.correctAnswerIds.length === sel.length && q.correctAnswerIds.every((id) => sel.includes(id));
    ans.revealed = true;
    reader.answers[qid] = ans;
    state.recordAnswer(qid, { isCorrect: ans.isCorrect });
    renderCheckQuestion(lesson);
    announce(ans.isCorrect ? t('notify.correct') : t('notify.incorrect'));
  });

  outlet.querySelector('#check-continue')?.addEventListener('click', () => {
    nextOrFinish(lesson);
  });
}

function nextOrFinish(lesson) {
  if (reader.qIndex + 1 < reader.checkIds.length) {
    reader.qIndex += 1;
    renderCheckQuestion(lesson);
    return;
  }
  /* Resultados: registrar la comprobación */
  const answered = Object.entries(reader.answers).filter(([, a]) => a.revealed);
  const correct = answered.filter(([, a]) => a.isCorrect).length;
  const scorePct = pct(correct, reader.checkIds.length);
  const passed = scorePct >= state.getSettings().checkThreshold;
  state.recordLessonCheck(lesson.id, { pct: scorePct, passed });
  reader.mode = 'results';
  reader.result = { correct, total: reader.checkIds.length, scorePct, passed };
  renderLessonReader(lesson.id);
  announce(passed ? t('learn.checkPassed') : t('learn.checkFailed'));
}

function renderCheckResults(lesson) {
  const outlet = document.getElementById('outlet');
  const r = reader.result;
  const nextRec = getRecommendations(6).find((rc) => rc.lessonId && rc.lessonId !== lesson.id);

  outlet.innerHTML = `
    <div class="card score-hero">
      <h1>${escapeHtml(r.passed ? t('learn.checkPassed') : t('learn.checkFailed', { pct: state.getSettings().checkThreshold }))}</h1>
      <div class="big">${escapeHtml(t('learn.checkScore', { n: r.correct, total: r.total, pct: r.scorePct }))}</div>
      ${!r.passed ? `<p class="muted">${escapeHtml(t('learn.checkReviewNote'))}</p>` : ''}
      ${statusBadge(lesson.id)}
      <div class="btn-row" style="justify-content:center">
        <button type="button" class="btn" id="retry-check">${escapeHtml(t('learn.retryCheck'))}</button>
        <button type="button" class="btn" id="reread">${escapeHtml(t('learn.reviewLesson'))}</button>
        <a class="btn primary" href="#/learn">${escapeHtml(t('learn.backToPath'))}</a>
      </div>
    </div>
    ${nextRec ? `
    <div class="card">
      <h3>${escapeHtml(t('learn.nextLesson'))}</h3>
      <div class="rec-item">
        <span aria-hidden="true">${nextRec.icon}</span>
        <span class="rec-text">${nextRec.text}</span>
        <a class="btn small primary" href="${nextRec.route}">${escapeHtml(t('recommend.open'))}</a>
      </div>
    </div>` : ''}
    <div class="card">
      <div class="btn-row">
        <a class="btn" href="#/library">${escapeHtml(t('library.title'))}</a>
        <a class="btn" href="#/progress">${escapeHtml(t('study.viewProgress'))}</a>
      </div>
    </div>`;

  outlet.querySelector('#retry-check').addEventListener('click', () => {
    reader.mode = 'check';
    reader.qIndex = 0;
    reader.answers = {};
    renderLessonReader(lesson.id);
  });
  outlet.querySelector('#reread').addEventListener('click', () => {
    reader.mode = 'read';
    renderLessonReader(lesson.id);
    window.scrollTo(0, 0);
  });
}
