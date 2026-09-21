/* app.js — arranque, registro de rutas, inicio y pantalla de dominio. */

import { loadContent, getContent, getDomain } from './content-loader.js';
import * as state from './state.js';
import { register, initRouter, navigate } from './router.js';
import { escapeHtml, pct, formatDate } from './utils.js';
import { initQuizEngine, startQuizSession, stopTimer, selectQuestions, createAttempt } from './quiz-engine.js';
import { renderStudyConfig, startStudySession } from './study-mode.js';
import { renderExamStart, startExamSession } from './exam-simulator.js';
import { renderResults } from './scoring.js';
import { renderReview, renderBookmarks } from './review.js';
import { renderDashboard } from './dashboard.js';
import { renderLibrary, renderLesson, renderServices, renderGlossary } from './library.js';
import { renderSettings } from './settings.js';

const $outlet = () => document.getElementById('outlet');

/* ---------- Inicio ---------- */

function renderHome() {
  stopTimer();
  const c = getContent();
  const s = state.getState();
  const outlet = $outlet();
  const unfinished = state.findUnfinishedAttempt();
  const mastered = Object.values(s.questionStates).filter((qs) => qs.mastery === 'mastered').length;
  const verifiedTotal = c.questions.filter((q) => q.status === 'verified').length;
  const seen = Object.values(s.questionStates).filter((qs) => qs.seenCount > 0).length;
  const overall = pct(seen, verifiedTotal);

  const attempts = state.listAttempts();
  const agg = {};
  attempts.forEach((a) => {
    Object.entries(a.resultSummary?.byDomain || {}).forEach(([d, v]) => {
      if (!agg[d]) agg[d] = { correct: 0, total: 0 };
      agg[d].correct += v.correct;
      agg[d].total += v.total;
    });
  });

  outlet.innerHTML = `
    <div class="card">
      <h1>Ruta CLF-C02</h1>
      <p class="muted">Preparación para el examen AWS Certified Cloud Practitioner (CLF-C02), en español y a tu ritmo.</p>
      <p class="notice mb0">Herramienta de estudio <b>no oficial</b>. No está afiliada a ni respaldada por AWS. Los resultados son estimaciones locales de estudio.</p>
      ${unfinished ? `
      <div class="notice info mt">
        Tienes una actividad sin terminar (${escapeHtml(unfinished.config?.label || unfinished.mode)}).
        <a href="#/${unfinished.mode === 'exam' ? 'exam/session' : unfinished.mode === 'quiz' ? 'quiz/session' : 'study/session'}">Continuar donde quedaste →</a>
      </div>` : ''}
      <div class="mt">
        <b>Progreso general: ${overall}%</b> · ${mastered} preguntas dominadas de ${verifiedTotal}
        <div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div>
      </div>
    </div>

    <div class="grid grid-4">
      ${c.domains.map((d) => {
        const v = agg[String(d.id)];
        const p = v && v.total ? pct(v.correct, v.total) : 0;
        const cls = !v || !v.total ? '' : p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
        return `
          <a class="card domain-card" href="#/domain/${d.id}">
            <h3>D${d.id} · ${escapeHtml(d.name)}</h3>
            <p class="weight">Peso oficial: <b>${d.weight}%</b></p>
            <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
            <p class="small muted mt">${v && v.total ? `${p}% de acierto en tu práctica` : 'Sin práctica todavía'}</p>
          </a>`;
      }).join('')}
    </div>

    <div class="card">
      <h2>¿Cómo quieres estudiar hoy?</h2>
      <div class="hero-actions">
        <a class="btn primary" href="#/study">📖 Modo estudio</a>
        <a class="btn" href="#/quiz">⚡ Quiz rápido</a>
        <a class="btn" href="#/exam">⏱ Simulacro de examen</a>
      </div>
      <div class="hero-actions">
        <a class="btn" href="#/review">🔁 Repasar errores</a>
        <a class="btn" href="#/bookmarks">☆ Marcadores</a>
        <a class="btn" href="#/library">📚 Biblioteca</a>
        <a class="btn" href="#/progress">📈 Progreso</a>
      </div>
      ${s.stats.lastStudiedAt ? `<p class="small muted">Última sesión: ${formatDate(s.stats.lastStudiedAt)}</p>` : ''}
    </div>`;
}

/* ---------- Pantalla de dominio ---------- */

function renderDomain(params) {
  const c = getContent();
  const d = getDomain(Number(params.id));
  const outlet = $outlet();
  if (!d) { navigate('/'); return; }
  const attempts = state.listAttempts();

  outlet.innerHTML = `
    <p><a href="#/">← Inicio</a></p>
    <div class="card">
      <h1>D${d.id} · ${escapeHtml(d.name)} <span class="badge info">${d.weight}% del examen</span></h1>
      <p class="muted">${escapeHtml(d.description)}</p>
      <div class="btn-row">
        <a class="btn primary" href="#/study">Estudiar este dominio</a>
        <a class="btn" href="#/quiz">Quiz de este dominio</a>
        <a class="btn" href="#/library">Ver lecciones</a>
      </div>
    </div>
    ${d.tasks.map((t) => {
      const lessons = c.lessons.filter((l) => (l.taskStatements || []).includes(t.id));
      /* precisión por tarea a partir de intentos completados */
      let correct = 0, total = 0;
      attempts.forEach((a) => {
        const v = a.resultSummary?.byTask?.[t.id];
        if (v) { correct += v.correct; total += v.total; }
      });
      const p = total ? pct(correct, total) : 0;
      const cls = !total ? '' : p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
      return `
        <div class="card">
          <h3>Tarea ${escapeHtml(t.id)} · ${escapeHtml(t.title)}</h3>
          <p class="small muted">Precisión registrada: ${total ? `${p}% (${correct}/${total})` : 'sin datos'}</p>
          <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
          <div class="chips mt">${t.topics.map((tp) => `<span class="chip">${escapeHtml(tp)}</span>`).join('')}</div>
          ${lessons.map((l) => `<p class="mt" style="margin-bottom:0">📖 <a href="#/library/lesson/${l.id}">${escapeHtml(l.title)}</a></p>`).join('')}
        </div>`;
    }).join('')}`;
}

/* ---------- Configurador de quiz rápido ---------- */

function renderQuizConfig() {
  stopTimer();
  const c = getContent();
  const outlet = $outlet();
  const settings = state.getSettings();
  outlet.innerHTML = `
    <h1>Quiz rápido</h1>
    <p class="muted">El cronómetro es <b>referencial</b>: no se entrega automáticamente al agotarse. Explicaciones al final.</p>
    <div class="card">
      <div class="field">
        <label>Número de preguntas</label>
        <div class="btn-row" role="radiogroup" aria-label="Número de preguntas">
          ${[10, 20, 30].map((n) => `
            <label class="option" style="flex:0 1 auto">
              <input type="radio" name="quiz-size" value="${n}" ${settings.defaultQuizSize === n ? 'checked' : ''}>
              <span>${n}</span>
            </label>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Dominios (ninguno marcado = todos)</label>
        ${c.domains.map((d) => `
          <label class="check-row">
            <input type="checkbox" class="quiz-domain" value="${d.id}">
            <span>D${d.id} · ${escapeHtml(d.name)} (${d.weight}%)</span>
          </label>`).join('')}
      </div>
      <p class="small muted" id="quiz-count"></p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="quiz-start">Comenzar quiz</button>
        <a class="btn ghost" href="#/">Cancelar</a>
      </div>
    </div>`;

  const countEl = outlet.querySelector('#quiz-count');
  function updateCount() {
    const domains = Array.from(outlet.querySelectorAll('.quiz-domain:checked')).map((i) => i.value);
    const n = Number(outlet.querySelector('input[name="quiz-size"]:checked')?.value || settings.defaultQuizSize);
    countEl.textContent = `${selectQuestions({ mode: 'quiz', domains, size: n }).length} preguntas seleccionadas para esta configuración.`;
  }
  outlet.querySelectorAll('.quiz-domain, input[name="quiz-size"]').forEach((el) => el.addEventListener('change', updateCount));
  updateCount();

  outlet.querySelector('#quiz-start').addEventListener('click', () => {
    const domains = Array.from(outlet.querySelectorAll('.quiz-domain:checked')).map((i) => i.value);
    const size = Number(outlet.querySelector('input[name="quiz-size"]:checked')?.value || settings.defaultQuizSize);
    const minutes = size === 10 ? 15 : size === 20 ? 30 : 45;
    createAttempt({
      mode: 'quiz',
      config: { domains, tasks: [], size, timerSeconds: minutes * 60, label: 'Quiz rápido' },
    });
    navigate('/quiz/session');
  });
}

/* ---------- Registro de rutas ---------- */

function registerRoutes() {
  register('/', renderHome);
  register('/domain/:id', renderDomain);

  register('/study', renderStudyConfig);
  register('/study/session', () => {
    const id = state.getCurrentAttemptId();
    const attempt = id && state.getAttempt(id);
    if (attempt && (attempt.mode === 'study' || attempt.mode === 'review') && attempt.status === 'in_progress') {
      startStudySession(attempt.id);
    } else {
      renderStudyConfig();
    }
  });

  register('/quiz', renderQuizConfig);
  register('/quiz/session', () => {
    const id = state.getCurrentAttemptId();
    const attempt = id && state.getAttempt(id);
    if (attempt && attempt.mode === 'quiz' && attempt.status === 'in_progress') {
      startQuizSession(attempt.id, { label: 'Quiz rápido' });
    } else {
      renderQuizConfig();
    }
  });

  register('/exam', () => {
    stopTimer();
    renderExamStart();
  });
  register('/exam/session', () => {
    const id = state.getCurrentAttemptId();
    const attempt = id && state.getAttempt(id);
    if (attempt && attempt.mode === 'exam' && attempt.status === 'in_progress') {
      startExamSession(attempt.id);
    } else {
      renderExamStart();
    }
  });

  register('/results/:id', (params) => renderResults(params.id));
  register('/review', renderReview);
  register('/bookmarks', renderBookmarks);
  register('/progress', renderDashboard);
  register('/library', renderLibrary);
  register('/library/lesson/:id', (params) => renderLesson(params.id));
  register('/library/services', renderServices);
  register('/library/glossary', renderGlossary);
  register('/settings', renderSettings);
}

/* ---------- Arranque ---------- */

async function boot() {
  state.applyPreferences();
  try {
    await loadContent();
  } catch (e) {
    document.getElementById('outlet').innerHTML = `
      <div class="card">
        <h1>No se pudo cargar el contenido</h1>
        <p class="muted">${String(e.message || e)}</p>
        <p class="small muted">Si abres los archivos directamente desde el disco, sirve la aplicación con un servidor local, por ejemplo: <code>npx http-server</code> o <code>python -m http.server</code>.</p>
      </div>`;
    return;
  }
  initQuizEngine();
  registerRoutes();
  initRouter(document.getElementById('outlet'));
}

boot();
