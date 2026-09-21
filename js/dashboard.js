/* dashboard.js — panel de progreso: por dominio, tarea, tema y servicio;
   intentos recientes, temas débiles, maestría. Estimación local, no oficial. */

import { getContent, getQuestion } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, pct, formatDate, formatTime } from './utils.js';
import { t } from './i18n.js';
import { setsEqual } from './scoring.js';
import { lessonStatusCounts, getLessonDisplayStatus, renderRecommendations } from './recommend.js';

export function renderDashboard() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const s = state.getState();

  const agg = { byDomain: {}, byTask: {}, byTopic: {}, byService: {} };
  state.listAttempts().forEach((a) => {
    a.questionOrder.forEach((qid) => {
      const q = getQuestion(qid);
      const ans = a.answers[qid];
      if (!q || !ans) return;
      const sel = ans.selectedIds || [];
      if (!sel.length) return;
      const ok = setsEqual(sel, q.correctAnswerIds);
      const acc = (map, key) => {
        if (!map[key]) map[key] = { correct: 0, total: 0 };
        map[key].total += 1;
        if (ok) map[key].correct += 1;
      };
      acc(agg.byDomain, String(q.domain));
      acc(agg.byTask, q.taskStatement);
      if (q.topic) acc(agg.byTopic, q.topic);
      (q.services || []).forEach((sv) => acc(agg.byService, sv));
    });
  });

  const qStates = Object.values(s.questionStates);
  const mastered = qStates.filter((q) => q.mastery === 'mastered').length;
  const pendingReview = Object.entries(s.questionStates)
    .filter(([, qs]) => qs.incorrectCount > 0 && qs.mastery !== 'mastered').length;
  const verifiedTotal = c.questions.filter((q) => q.status === 'verified').length;
  const seen = qStates.filter((qs) => qs.seenCount > 0).length;
  const overall = pct(seen, verifiedTotal);

  const weakTopics = Object.entries(agg.byTopic)
    .filter(([, v]) => v.total >= 2 && v.correct / v.total < 0.6)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));

  const recent = state.listAttempts().slice(0, 5);
  const lessonCounts = lessonStatusCounts();
  const toReview = getContent().lessons.filter((l) => getLessonDisplayStatus(l.id) === 'needsReview');

  outlet.innerHTML = `
    <h1>${escapeHtml(t('dashboard.title'))}</h1>
    <p class="notice info">${escapeHtml(t('dashboard.notice'))}</p>

    <div class="grid grid-2">
      <div class="card">
        <h3>${escapeHtml(t('dashboard.studied'))}</h3>
        <div class="big" style="font-size:2rem;font-weight:800">${overall}%</div>
        <div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div>
        <p class="small muted mt">${escapeHtml(t('dashboard.seenOf', { seen, total: verifiedTotal }))}</p>
      </div>
      <div class="card">
        <h3>${escapeHtml(t('dashboard.overview'))}</h3>
        <p class="small">${escapeHtml(t('dashboard.mastered'))} <b>${mastered}</b></p>
        <p class="small">${escapeHtml(t('dashboard.pendingReview'))} <b>${pendingReview}</b></p>
        <p class="small">${escapeHtml(t('dashboard.recorded'))} <b>${s.stats.totalAnswered}</b> · ${escapeHtml(t('dashboard.accuracy'))} <b>${pct(s.stats.totalCorrect, s.stats.totalAnswered)}%</b></p>
        <p class="small muted">${escapeHtml(t('dashboard.lastSession', { date: formatDate(s.stats.lastStudiedAt) }))} · ${escapeHtml(t('dashboard.totalTime', { time: formatTime(s.stats.totalTimeSeconds) }))}</p>
      </div>
    </div>

    <div class="card">
      <h2>${escapeHtml(t('dashboardLessons.title'))}</h2>
      <p class="small">${escapeHtml(t('dashboardLessons.summary', {
        completed: lessonCounts.completed, mastered: lessonCounts.mastered,
        review: lessonCounts.needsReview, inProgress: lessonCounts.inProgress + lessonCounts.checkPending,
      }))}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${pct(lessonCounts.completed + lessonCounts.mastered, getContent().lessons.length)}%"></div></div>
      <div class="btn-row mt">
        <a class="btn small primary" href="#/learn">${escapeHtml(t('dashboardLessons.continuePath'))}</a>
      </div>
      ${toReview.length ? `
        <h3 class="mt">${escapeHtml(t('dashboardLessons.toReview'))}</h3>
        ${toReview.slice(0, 5).map((l) => `
          <div class="rec-item">
            <span aria-hidden="true">🔁</span>
            <span class="rec-text">📖 <a href="#/lesson/${l.id}">${escapeHtml(l.title)}</a></span>
            <a class="btn small" href="#/lesson/${l.id}">${escapeHtml(t('learn.reviewLesson'))}</a>
          </div>`).join('')}` : ''}
    </div>

    <div class="card">
      <h3>${escapeHtml(t('recommend.title'))}</h3>
      <div id="rec-strip"></div>
    </div>

    <div class="card">
      <h2>${escapeHtml(t('dashboard.byDomain'))}</h2>
      ${c.domains.map((d) => {
        const v = agg.byDomain[String(d.id)] || { correct: 0, total: 0 };
        const p = pct(v.correct, v.total);
        const cls = p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
        return `
          <div class="mt">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <a href="#/domain/${d.id}"><b>D${d.id} · ${escapeHtml(d.name)}</b></a>
              <span class="muted">${v.total ? `${p}% (${v.correct}/${v.total})` : escapeHtml(t('common.noData'))} · ${escapeHtml(t('home.weight'))} ${d.weight}%</span>
            </div>
            <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
          </div>`;
      }).join('')}
    </div>

    <div class="card">
      <h2>${escapeHtml(t('dashboard.byTask'))}</h2>
      <table class="table">
        <thead><tr><th>${escapeHtml(t('dashboard.thTask'))}</th><th>${escapeHtml(t('dashboard.thAccuracy'))}</th><th>${escapeHtml(t('dashboard.thAnswers'))}</th></tr></thead>
        <tbody>
          ${Object.entries(agg.byTask).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([tk, v]) => `
            <tr><td>${escapeHtml(tk)}</td><td>${pct(v.correct, v.total)}%</td><td>${v.correct}/${v.total}</td></tr>`).join('')
            || `<tr><td colspan="3" class="muted">${escapeHtml(t('dashboard.noAttempts'))}</td></tr>`}
        </tbody>
      </table>
    </div>

    ${weakTopics.length ? `
    <div class="card">
      <h2>${escapeHtml(t('dashboard.weak'))}</h2>
      <div class="btn-row">
        ${weakTopics.slice(0, 8).map(([topic]) => `<a class="btn small" href="#/study">${escapeHtml(topic)}</a>`).join('')}
      </div>
      <p class="small muted mt">${escapeHtml(t('dashboard.weakTip'))}</p>
    </div>` : ''}

    <div class="card">
      <h2>${escapeHtml(t('dashboard.recent'))}</h2>
      ${recent.length ? `
      <table class="table">
        <thead><tr><th>${escapeHtml(t('dashboard.thDate'))}</th><th>${escapeHtml(t('dashboard.thMode'))}</th><th>${escapeHtml(t('dashboard.thResult'))}</th><th></th></tr></thead>
        <tbody>
          ${recent.map((a) => `
            <tr>
              <td>${formatDate(a.finishedAt)}</td>
              <td>${escapeHtml(t(`mode.${a.mode}`))}</td>
              <td>${a.resultSummary?.correct}/${a.resultSummary?.total} (${a.resultSummary?.percentage}%)</td>
              <td><a class="btn small" href="#/results/${a.id}">${escapeHtml(t('common.view'))}</a></td>
            </tr>`).join('')}
        </tbody>
      </table>` : `<p class="muted">${escapeHtml(t('dashboard.noQuizzes'))}</p>`}
    </div>`;

  renderRecommendations(document.getElementById('rec-strip'), 4);
}
