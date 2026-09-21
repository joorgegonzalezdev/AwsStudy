/* scoring.js — puntuación, desgloses y pantalla de resultados.
   Regla: 1 punto por pregunta totalmente correcta; sin crédito parcial;
   sin responder = incorrecta; sin penalización por adivinar. */

import { getQuestion, getDomain } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, pct, formatDate, formatTime } from './utils.js';
import { t } from './i18n.js';
import { createAttempt, stopTimer } from './quiz-engine.js';
import { navigate } from './router.js';

export function setsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function computeSummary(attempt) {
  const byDomain = {};
  const byTask = {};
  const byTopic = {};
  const byService = {};
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;

  attempt.questionOrder.forEach((qid) => {
    const q = getQuestion(qid);
    if (!q) return;
    const sel = attempt.answers[qid]?.selectedIds || [];
    const answered = sel.length > 0;
    const isOk = answered && setsEqual(sel, q.correctAnswerIds);
    if (!answered) unanswered += 1;
    else if (isOk) correct += 1;
    else incorrect += 1;

    const acc = (map, key) => {
      if (!map[key]) map[key] = { correct: 0, incorrect: 0, total: 0 };
      map[key].total += 1;
      if (isOk) map[key].correct += 1;
      else if (answered) map[key].incorrect += 1;
    };
    acc(byDomain, String(q.domain));
    acc(byTask, q.taskStatement);
    if (q.topic) acc(byTopic, q.topic);
    (q.services || []).forEach((s) => acc(byService, s));
  });

  const weakTopics = Object.entries(byTopic)
    .filter(([, v]) => v.total >= 2 && v.correct / v.total < 0.6)
    .map(([topic, v]) => ({ topic, ...v }));

  return {
    total: attempt.questionOrder.length,
    correct,
    incorrect,
    unanswered,
    percentage: pct(correct, attempt.questionOrder.length),
    byDomain,
    byTask,
    byTopic,
    byService,
    weakTopics,
  };
}

/* ---------- Pantalla de resultados ---------- */

function domainRows(byDomain) {
  return Object.entries(byDomain)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([d, v]) => {
      const dom = getDomain(Number(d));
      const p = pct(v.correct, v.total);
      const cls = p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
      return `
        <tr>
          <td>D${d} · ${escapeHtml(dom?.name || '')}</td>
          <td class="bar-cell"><div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div></td>
          <td>${p}% (${v.correct}/${v.total})</td>
        </tr>`;
    })
    .join('');
}

function taskRows(byTask) {
  return Object.entries(byTask)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([tk, v]) => {
      const p = pct(v.correct, v.total);
      return `<tr><td>${escapeHtml(t('common.task'))} ${escapeHtml(tk)}</td><td>${p}% (${v.correct}/${v.total})</td></tr>`;
    })
    .join('');
}

export function renderResults(attemptId) {
  const outlet = document.getElementById('outlet');
  stopTimer();
  const attempt = state.getAttempt(attemptId);
  if (!attempt) {
    outlet.innerHTML = `<div class="card"><p>${escapeHtml(t('results.notFound'))}</p><a class="btn primary" href="#/">${escapeHtml(t('common.home'))}</a></div>`;
    return;
  }
  if (attempt.status !== 'completed') {
    navigate(attempt.mode === 'exam' ? '/exam/session' : attempt.mode === 'quiz' ? '/quiz/session' : '/study/session');
    return;
  }
  const s = attempt.resultSummary || computeSummary(attempt);
  const wrongIds = attempt.questionOrder.filter((qid) => {
    const q = getQuestion(qid);
    const sel = attempt.answers[qid]?.selectedIds || [];
    return sel.length === 0 || !setsEqual(sel, q.correctAnswerIds);
  });

  outlet.innerHTML = `
    <div class="card score-hero">
      <h1>${escapeHtml(t('results.title'))}</h1>
      <p class="muted">${escapeHtml(t(`mode.${attempt.mode}`))} · ${formatDate(attempt.finishedAt)} · ${escapeHtml(t('results.time', { time: formatTime(attempt.durationSeconds || 0) }))}</p>
      <div class="big">${s.correct}/${s.total}</div>
      <div class="big" style="font-size:1.6rem">${s.percentage}%</div>
      <p class="small muted">${escapeHtml(t('common.correct'))}: ${s.correct} · ${escapeHtml(t('common.incorrect'))}: ${s.incorrect} · ${escapeHtml(t('common.unanswered'))}: ${s.unanswered}</p>
      <p class="notice mb0">${escapeHtml(t('results.estimate'))}</p>
    </div>

    <div class="card">
      <h2>${escapeHtml(t('results.byDomain'))}</h2>
      <table class="table"><tbody>${domainRows(s.byDomain)}</tbody></table>
      <h3 class="mt">${escapeHtml(t('results.byTask'))}</h3>
      <table class="table"><tbody>${taskRows(s.byTask)}</tbody></table>
    </div>

    ${s.weakTopics.length ? `
    <div class="card">
      <h2>${escapeHtml(t('results.weakTopics'))}</h2>
      <ul>${s.weakTopics.map((tk) => `<li>${escapeHtml(tk.topic)} — ${pct(tk.correct, tk.total)}% (${tk.correct}/${tk.total})</li>`).join('')}</ul>
      <p class="small muted">${escapeHtml(t('results.weakHint'))}</p>
    </div>` : ''}

    <div class="card">
      <h2>${escapeHtml(t('results.actions'))}</h2>
      <div class="btn-row">
        ${wrongIds.length ? `<button type="button" class="btn primary" data-retry="${escapeHtml(wrongIds.join(','))}">${escapeHtml(t('results.retryN', { n: wrongIds.length }))}</button>` : `<span class="badge ok">${escapeHtml(t('results.allCorrect'))}</span>`}
        <a class="btn" href="#/review">${escapeHtml(t('results.goReview'))}</a>
        <a class="btn" href="#/quiz">${escapeHtml(t('results.newQuiz'))}</a>
        <a class="btn ghost" href="#/">${escapeHtml(t('common.home'))}</a>
      </div>
    </div>`;

  outlet.querySelector('[data-retry]')?.addEventListener('click', (e) => {
    const ids = e.currentTarget.dataset.retry.split(',').filter(Boolean);
    createAttempt({ mode: 'review', explicitIds: ids, config: { timerSeconds: 0 } });
    navigate('/study/session');
  });
}
