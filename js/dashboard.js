/* dashboard.js — panel de progreso: por dominio, tarea, tema y servicio;
   intentos recientes, temas débiles, maestría. Estimación local, no oficial. */

import { getContent, getQuestion, getDomain } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, pct, formatDate, formatTime } from './utils.js';
import { setsEqual } from './scoring.js';
import { navigate } from './router.js';

export function renderDashboard() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const s = state.getState();

  /* Agregados a partir de intentos completados */
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

  outlet.innerHTML = `
    <h1>Tu progreso</h1>
    <p class="notice info">Estas métricas reflejan tu práctica local. <b>No</b> constituyen una predicción de tu resultado en el examen oficial.</p>

    <div class="grid grid-2">
      <div class="card">
        <h3>Contenido estudiado</h3>
        <div class="big" style="font-size:2rem;font-weight:800">${overall}%</div>
        <div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div>
        <p class="small muted mt">${seen} de ${verifiedTotal} preguntas vistas.</p>
      </div>
      <div class="card">
        <h3>Resumen</h3>
        <p class="small">Preguntas dominadas: <b>${mastered}</b></p>
        <p class="small">Pendientes de repaso: <b>${pendingReview}</b></p>
        <p class="small">Respuestas registradas: <b>${s.stats.totalAnswered}</b> · Aciertos: <b>${pct(s.stats.totalCorrect, s.stats.totalAnswered)}%</b></p>
        <p class="small muted">Última sesión: ${formatDate(s.stats.lastStudiedAt)} · Tiempo total: ${formatTime(s.stats.totalTimeSeconds)}</p>
      </div>
    </div>

    <div class="card">
      <h2>Rendimiento por dominio</h2>
      ${c.domains.map((d) => {
        const v = agg.byDomain[String(d.id)] || { correct: 0, total: 0 };
        const p = pct(v.correct, v.total);
        const cls = p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
        return `
          <div class="mt">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <a href="#/domain/${d.id}"><b>D${d.id} · ${escapeHtml(d.name)}</b></a>
              <span class="muted">${v.total ? `${p}% (${v.correct}/${v.total})` : 'Sin datos'} · peso oficial ${d.weight}%</span>
            </div>
            <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
          </div>`;
      }).join('')}
    </div>

    <div class="card">
      <h2>Rendimiento por task statement</h2>
      <table class="table">
        <thead><tr><th>Tarea</th><th>Precisión</th><th>Respuestas</th></tr></thead>
        <tbody>
          ${Object.entries(agg.byTask).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([t, v]) => `
            <tr><td>${escapeHtml(t)}</td><td>${pct(v.correct, v.total)}%</td><td>${v.correct}/${v.total}</td></tr>`).join('')
            || '<tr><td colspan="3" class="muted">Aún no hay intentos completados.</td></tr>'}
        </tbody>
      </table>
    </div>

    ${weakTopics.length ? `
    <div class="card">
      <h2>Temas débiles</h2>
      <div class="btn-row">
        ${weakTopics.slice(0, 8).map(([topic]) => `<a class="btn small" href="#/study">${escapeHtml(topic)}</a>`).join('')}
      </div>
      <p class="small muted mt">Consejo: estudia la lección de cada tema antes de repetir sus preguntas.</p>
    </div>` : ''}

    <div class="card">
      <h2>Intentos recientes</h2>
      ${recent.length ? `
      <table class="table">
        <thead><tr><th>Fecha</th><th>Modo</th><th>Resultado</th><th></th></tr></thead>
        <tbody>
          ${recent.map((a) => `
            <tr>
              <td>${formatDate(a.finishedAt)}</td>
              <td>${a.mode === 'exam' ? 'Simulacro' : a.mode === 'quiz' ? 'Quiz' : a.mode === 'review' ? 'Repaso' : 'Estudio'}</td>
              <td>${a.resultSummary?.correct}/${a.resultSummary?.total} (${a.resultSummary?.percentage}%)</td>
              <td><a class="btn small" href="#/results/${a.id}">Ver</a></td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p class="muted">Completa un quiz para ver tu historial aquí.</p>'}
    </div>`;
}
