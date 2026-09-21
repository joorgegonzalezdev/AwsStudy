/* study-mode.js — modo Estudio: sin límite de tiempo, retroalimentación
   inmediata, pistas registradas (no puntuadas), marcadores y conceptos clave.
   También se usa para el modo Repaso (quiz solo con preguntas falladas). */

import { getContent, getDomain, getLesson, getQuestion } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, announce } from './utils.js';
import { t } from './i18n.js';
import { createAttempt } from './quiz-engine.js';
import { computeSummary } from './scoring.js';
import { navigate } from './router.js';

/* ---------- Configurador ---------- */

export function renderStudyConfig() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <h1>${escapeHtml(t('study.title'))}</h1>
    <p class="muted">${escapeHtml(t('study.intro'))}</p>
    <div class="card">
      <div class="field">
        <label for="study-domain">${escapeHtml(t('study.domain'))}</label>
        <select id="study-domain">
          <option value="">${escapeHtml(t('study.allDomains'))}</option>
          ${c.domains.map((d) => `<option value="${d.id}">D${d.id} · ${escapeHtml(d.name)} (${d.weight}%)</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="study-task">${escapeHtml(t('study.task'))}</label>
        <select id="study-task"><option value="">${escapeHtml(t('study.anyTask'))}</option></select>
      </div>
      <div class="field">
        <label for="study-size">${escapeHtml(t('study.size'))}</label>
        <select id="study-size">
          <option value="10">${escapeHtml(t('study.sizeN', { n: 10 }))}</option>
          <option value="20">${escapeHtml(t('study.sizeN', { n: 20 }))}</option>
          <option value="30">${escapeHtml(t('study.sizeN', { n: 30 }))}</option>
          <option value="0">${escapeHtml(t('study.sizeAll'))}</option>
        </select>
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary" id="study-start">${escapeHtml(t('study.start'))}</button>
        <a class="btn ghost" href="#/">${escapeHtml(t('common.cancel'))}</a>
      </div>
      <p class="small muted" id="study-count"></p>
    </div>`;

  const domainSel = outlet.querySelector('#study-domain');
  const taskSel = outlet.querySelector('#study-task');
  const countEl = outlet.querySelector('#study-count');

  function updateTasks() {
    const d = Number(domainSel.value);
    taskSel.innerHTML = `<option value="">${escapeHtml(t('study.anyTask'))}</option>` + (
      d ? (getDomain(d)?.tasks || []).map((tk) => `<option value="${tk.id}">${tk.id} · ${escapeHtml(tk.title)}</option>`).join('') : ''
    );
    updateCount();
  }
  function updateCount() {
    const d = domainSel.value;
    const tk = taskSel.value;
    let pool = c.questions.filter((q) => q.status === 'verified');
    if (d) pool = pool.filter((q) => String(q.domain) === d);
    if (tk) pool = pool.filter((q) => q.taskStatement === tk);
    countEl.textContent = t('study.available', { n: pool.length });
  }
  domainSel.addEventListener('change', updateTasks);
  taskSel.addEventListener('change', updateCount);
  updateTasks();

  outlet.querySelector('#study-start').addEventListener('click', () => {
    const domains = domainSel.value ? [domainSel.value] : [];
    const tasks = taskSel.value ? [taskSel.value] : [];
    const size = Number(outlet.querySelector('#study-size').value) || 0;
    createAttempt({
      mode: 'study',
      config: { domains, tasks, size, timerSeconds: 0 },
    });
    navigate('/study/session');
  });
}

/* ---------- Sesión interactiva ---------- */

export function startStudySession(attemptId) {
  const attempt = state.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress') {
    renderStudyConfig();
    return;
  }
  renderStudyQuestion(attempt);
}

function renderStudyQuestion(attempt) {
  const idx = attempt.currentIndex;
  const total = attempt.questionOrder.length;
  const outlet = document.getElementById('outlet');

  if (idx >= total) { renderStudySummary(attempt); return; }
  const qid = attempt.questionOrder[idx];
  const q = getQuestion(qid);
  if (!q) { attempt.questionOrder.splice(idx, 1); state.saveAttempt(attempt); renderStudyQuestion(attempt); return; }

  const ans = attempt.answers[qid] || { selectedIds: [], revealed: false, hintShown: false };
  const multi = q.type === 'multiple' && q.correctAnswerIds.length > 1;
  const orderedIds = attempt.optionOrder[qid] || q.options.map((o) => o.id);
  const qs = state.getQuestionState(qid);
  const lesson = getLesson(q.lessonId);

  const optionsHtml = orderedIds.map((oid) => {
    const opt = q.options.find((o) => o.id === oid);
    const isCorrectOpt = q.correctAnswerIds.includes(oid);
    const isSelected = (ans.selectedIds || []).includes(oid);
    let cls = 'option';
    if (ans.revealed) {
      if (isCorrectOpt) cls += ' correct';
      else if (isSelected) cls += ' incorrect';
    } else if (isSelected) cls += ' selected';
    const exp = ans.revealed
      ? `<span class="opt-exp">${q.correctAnswerIds.includes(oid) ? '✔ ' : '✘ '}${escapeHtml(q.optionExplanations?.[oid] || '')}</span>`
      : '';
    return `
      <button type="button" class="${cls}" data-oid="${oid}" data-opt="1" aria-pressed="${isSelected}" ${ans.revealed ? 'disabled' : ''}>
        <span>${escapeHtml(opt.text)}</span>${exp}
      </button>`;
  }).join('');

  outlet.innerHTML = `
    <div class="quiz-header">
      <span class="badge ${attempt.mode === 'review' ? 'warn' : 'info'}">${escapeHtml(t(`mode.${attempt.mode}`))}</span>
      <span class="muted">${escapeHtml(t('common.question'))} ${idx + 1} ${escapeHtml(t('common.of'))} ${total}</span>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="btn small" data-study="exit">${escapeHtml(t('common.exit'))}</button>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.round((idx / total) * 100)}%"></div></div>
    <div class="card mt">
      <div class="chips">
        <span class="chip">${escapeHtml(t('common.domain'))} ${q.domain}</span>
        <span class="chip">${escapeHtml(t('common.task'))} ${q.taskStatement}</span>
        ${q.topic ? `<span class="chip">${escapeHtml(q.topic)}</span>` : ''}
        <span class="chip">${escapeHtml(t(`difficulty.${q.difficulty}`))}</span>
      </div>
      <p class="q-text">${escapeHtml(q.question)}</p>
      <p class="q-instruction">${escapeHtml(q.selectionInstruction || t('common.chooseOne'))}</p>
      <div id="study-options">${optionsHtml}</div>
      ${!ans.revealed && q.hint ? `
        <div id="hint-zone" class="mt">
          ${ans.hintShown
            ? `<div class="notice info">💡 ${escapeHtml(q.hint)}</div>`
            : `<button type="button" class="btn ghost" id="show-hint">${escapeHtml(t('study.hint'))}</button>`}
        </div>` : ''}
      ${!ans.revealed ? `
        <div class="btn-row mt">
          <button type="button" class="btn primary" id="check-btn" ${(ans.selectedIds || []).length === 0 ? 'disabled' : ''}>${escapeHtml(t('study.check'))}</button>
          <button type="button" class="btn ghost" id="skip-btn">${escapeHtml(t('study.skip'))}</button>
        </div>` : ''}
      <div id="feedback-zone"></div>
      ${ans.revealed ? renderFeedback(attempt, q, ans, lesson) : ''}
    </div>`;

  bindStudyEvents(attempt, q, ans, multi);
  if (ans.revealed) {
    announce(ans.isCorrect ? t('notify.correct') : t('notify.incorrect'));
  }
}

function renderFeedback(attempt, q, ans, lesson) {
  return `
    <div class="feedback ${ans.isCorrect ? 'correct' : 'incorrect'}" role="status">
      <div class="fb-title">${ans.isCorrect ? escapeHtml(t('study.correctTitle')) : escapeHtml(t('study.incorrectTitle'))}</div>
      <div class="fb-body">
        ${!ans.isCorrect ? `<p><b>${escapeHtml(t('common.correctAnswer'))}</b> ${escapeHtml(q.correctAnswerIds.map((oid) => q.options.find((o) => o.id === oid)?.text).join(' · '))}</p>` : ''}
        <p>${escapeHtml(q.explanation)}</p>
        ${q.concepts?.length ? `<div class="chips">${q.concepts.map((cc) => `<span class="chip">${escapeHtml(t('common.concept'))} ${escapeHtml(cc)}</span>`).join('')}</div>` : ''}
        ${lesson ? `<p class="mt"><a href="#/library/lesson/${lesson.id}">${escapeHtml(t('common.relatedLesson'))} ${escapeHtml(lesson.title)}</a></p>` : ''}
        ${(q.officialSources || []).length ? `<p class="small">${escapeHtml(t('common.source'))} ${q.officialSources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>`).join(' · ')}</p>` : ''}
      </div>
    </div>
    <div class="btn-row mt">
      <button type="button" class="btn small ${state.getQuestionState(q.id)?.difficult ? 'toggled' : ''}" data-study="difficult">${escapeHtml(t('common.markDifficult'))}</button>
      <button type="button" class="btn small ${state.getQuestionState(q.id)?.bookmarked ? 'toggled' : ''}" data-study="bookmark">${escapeHtml(t('common.bookmark'))}</button>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="btn primary" id="continue-btn">${attempt.currentIndex + 1 >= attempt.questionOrder.length ? escapeHtml(t('study.seeSummary')) : escapeHtml(t('common.continue'))}</button>
    </div>`;
}

function bindStudyEvents(attempt, q, ans, multi) {
  const outlet = document.getElementById('outlet');

  outlet.querySelectorAll('[data-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (ans.revealed) return;
      const oid = btn.dataset.oid;
      let sel = ans.selectedIds || [];
      if (multi) {
        sel = sel.includes(oid) ? sel.filter((x) => x !== oid) : sel.concat(oid);
      } else {
        sel = [oid];
      }
      ans.selectedIds = sel;
      attempt.answers[q.id] = ans;
      state.saveAttempt(attempt);
      renderStudyQuestion(state.getAttempt(attempt.id));
    });
  });

  outlet.querySelector('#show-hint')?.addEventListener('click', () => {
    ans.hintShown = true;
    attempt.answers[q.id] = ans;
    state.saveAttempt(attempt);
    state.recordHintUsed(q.id);
    renderStudyQuestion(state.getAttempt(attempt.id));
  });

  outlet.querySelector('#check-btn')?.addEventListener('click', () => {
    const sel = ans.selectedIds || [];
    if (!sel.length) return;
    const correct = q.correctAnswerIds.length === sel.length && q.correctAnswerIds.every((id) => sel.includes(id));
    ans.revealed = true;
    ans.isCorrect = correct;
    attempt.answers[q.id] = ans;
    state.saveAttempt(attempt);
    renderStudyQuestion(state.getAttempt(attempt.id));
  });

  outlet.querySelector('#skip-btn')?.addEventListener('click', () => {
    advance(attempt, true);
  });

  outlet.querySelector('#continue-btn')?.addEventListener('click', () => {
    advance(attempt, false);
  });

  outlet.querySelector('[data-study="bookmark"]')?.addEventListener('click', () => {
    state.toggleBookmark(q.id);
    renderStudyQuestion(state.getAttempt(attempt.id));
  });

  outlet.querySelector('[data-study="difficult"]')?.addEventListener('click', () => {
    state.toggleDifficult(q.id);
    renderStudyQuestion(state.getAttempt(attempt.id));
  });

  outlet.querySelector('[data-study="exit"]')?.addEventListener('click', () => {
    navigate('/');
  });
}

function advance(attempt, skipped) {
  const qid = attempt.questionOrder[attempt.currentIndex];
  const ans = attempt.answers[qid];
  if (!skipped && ans?.revealed) {
    state.recordAnswer(qid, { isCorrect: !!ans.isCorrect });
  }
  if (attempt.currentIndex + 1 >= attempt.questionOrder.length) {
    finishStudyAttempt(attempt);
    return;
  }
  attempt.currentIndex += 1;
  state.saveAttempt(attempt);
  renderStudyQuestion(state.getAttempt(attempt.id));
}

function finishStudyAttempt(attempt) {
  const summary = computeSummary(attempt);
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
  state.update((s) => {
    const a = s.attempts[attempt.id];
    a.status = 'completed';
    a.finishedAt = new Date().toISOString();
    a.durationSeconds = elapsed;
    a.resultSummary = summary;
    s.stats.totalTimeSeconds += elapsed;
  });
  if (state.getCurrentAttemptId() === attempt.id) state.setCurrentAttempt(null);
  renderStudySummary(attempt);
}

function renderStudySummary(attempt) {
  const s = attempt.resultSummary;
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <div class="card score-hero">
      <h1>${escapeHtml(attempt.mode === 'review' ? t('study.summaryReview') : t('study.summaryStudy'))}</h1>
      <div class="big">${s.correct}/${s.total}</div>
      <p class="small muted">${escapeHtml(t('common.correct'))}: ${s.correct} · ${escapeHtml(t('common.incorrect'))}: ${s.incorrect} · ${escapeHtml(t('common.skipped'))}: ${s.unanswered}</p>
      <p class="muted">${escapeHtml(t('study.registered'))}</p>
      <div class="btn-row" style="justify-content:center">
        <a class="btn primary" href="#/study">${escapeHtml(t('study.another'))}</a>
        <a class="btn" href="#/progress">${escapeHtml(t('study.viewProgress'))}</a>
        <a class="btn ghost" href="#/">${escapeHtml(t('common.home'))}</a>
      </div>
    </div>`;
}
