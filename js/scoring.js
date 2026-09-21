/* scoring.js — puntuación, desgloses y pantalla de resultados.
   Regla: 1 punto por pregunta totalmente correcta; sin crédito parcial;
   sin responder = incorrecta; sin penalización por adivinar. */

import { getContent, getQuestion, getDomain } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, pct, formatDate, formatTime } from './utils.js';
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
    .map(([t, v]) => {
      const p = pct(v.correct, v.total);
      return `<tr><td>Tarea ${escapeHtml(t)}</td><td>${p}% (${v.correct}/${v.total})</td></tr>`;
    })
    .join('');
}

export function renderResults(attemptId) {
  const outlet = document.getElementById('outlet');
  stopTimer();
  const attempt = state.getAttempt(attemptId);
  if (!attempt) {
    outlet.innerHTML = '<div class="card"><p>No se encontró el intento.</p><a class="btn primary" href="#/">Inicio</a></div>';
    return;
  }
  if (attempt.status !== 'completed') {
    navigate(attempt.mode === 'exam' ? '/exam/session' : attempt.mode === 'quiz' ? '/quiz/session' : '/study/session');
    return;
  }
  const s = attempt.resultSummary || computeSummary(attempt);
  const isExam = attempt.mode === 'exam';
  const wrongIds = attempt.questionOrder.filter((qid) => {
    const q = getQuestion(qid);
    const sel = attempt.answers[qid]?.selectedIds || [];
    return sel.length === 0 || !setsEqual(sel, q.correctAnswerIds);
  });

  outlet.innerHTML = `
    <div class="card score-hero">
      <h1>Resultados</h1>
      <p class="muted">${isExam ? 'Simulacro de examen (no oficial)' : 'Quiz rápido'} · ${formatDate(attempt.finishedAt)} · Tiempo: ${formatTime(attempt.durationSeconds || 0)}</p>
      <div class="big">${s.correct}/${s.total}</div>
      <div class="big" style="font-size:1.6rem">${s.percentage}%</div>
      <p class="small muted">Correctas: ${s.correct} · Incorrectas: ${s.incorrect} · Sin responder: ${s.unanswered}</p>
      <p class="notice mb0">⚠️ Estimación local de estudio. El examen oficial usa puntuación escalada (100–1000); este porcentaje <b>no</b> equivale a la puntuación oficial ni garantiza tu resultado.</p>
    </div>

    <div class="card">
      <h2>Desglose por dominio</h2>
      <table class="table"><tbody>${domainRows(s.byDomain)}</tbody></table>
      <h3 class="mt">Desglose por task statement</h3>
      <table class="table"><tbody>${taskRows(s.byTask)}</tbody></table>
    </div>

    ${s.weakTopics.length ? `
    <div class="card">
      <h2>Temas débiles detectados</h2>
      <ul>${s.weakTopics.map((t) => `<li>${escapeHtml(t.topic)} — ${pct(t.correct, t.total)}% (${t.correct}/${t.total})</li>`).join('')}</ul>
      <p class="small muted">Repasa las lecciones relacionadas y practica de nuevo estos temas.</p>
    </div>` : ''}

    <div class="card">
      <h2>Acciones recomendadas</h2>
      <div class="btn-row">
        ${wrongIds.length ? `<button type="button" class="btn primary" data-retry="${escapeHtml(wrongIds.join(','))}">Reintentar las ${wrongIds.length} incorrectas</button>` : '<span class="badge ok">¡Todas correctas!</span>'}
        <a class="btn" href="#/review">Ir a repaso de errores</a>
        <a class="btn" href="#/quiz">Nuevo quiz rápido</a>
        <a class="btn ghost" href="#/">Inicio</a>
      </div>
    </div>`;

  outlet.querySelector('[data-retry]')?.addEventListener('click', (e) => {
    const ids = e.currentTarget.dataset.retry.split(',').filter(Boolean);
    createAttempt({ mode: 'review', explicitIds: ids, config: { timerSeconds: 0, label: 'Repaso' } });
    navigate('/study/session');
  });
}
