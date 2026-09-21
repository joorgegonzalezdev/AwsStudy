/* app.js — arranque bilingüe, registro de rutas, inicio y pantalla de dominio. */

import { loadContent, getContent, getDomain } from './content-loader.js';
import * as state from './state.js';
import { register, initRouter, navigate } from './router.js';
import { escapeHtml, pct, formatDate } from './utils.js';
import { t, initI18n, applyStaticI18n, isLang } from './i18n.js';
import { initQuizEngine, startQuizSession, stopTimer, selectQuestions, createAttempt } from './quiz-engine.js';
import { renderStudyConfig, startStudySession } from './study-mode.js';
import { renderExamStart } from './exam-simulator.js';
import { renderResults } from './scoring.js';
import { renderReview, renderBookmarks } from './review.js';
import { renderDashboard } from './dashboard.js';
import { renderLibrary, renderLesson, renderServices, renderGlossary, renderComparisons, renderComparison, renderFlashcards } from './library.js';
import { renderSettings } from './settings.js';
import { renderLearnHome, renderLessonReader } from './learn.js';
import { renderRecommendations, getRecommendations } from './recommend.js';

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
      <p class="muted">${escapeHtml(t('home.subtitle'))}</p>
      <p class="notice mb0">${escapeHtml(t('home.unofficial'))}</p>
      ${unfinished ? `
      <div class="notice info mt">
        ${escapeHtml(t('home.unfinished', { label: t(`mode.${unfinished.mode}`) }))}
        <a href="#/${unfinished.mode === 'exam' ? 'exam/session' : unfinished.mode === 'quiz' ? 'quiz/session' : 'study/session'}">${escapeHtml(t('home.resume'))}</a>
      </div>` : ''}
      <div class="card inner mt" id="home-recommendations" style="box-shadow:none;border-style:dashed">
        <h3 style="margin-top:0">${escapeHtml(t('homeExtra.continueLearning'))}</h3>
        <div id="rec-strip"></div>
      </div>
      <div class="mt">
        <b>${escapeHtml(t('home.overall', { pct: overall }))}</b> · ${escapeHtml(t('home.masteredOf', { mastered, total: verifiedTotal }))}
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
            <p class="weight">${escapeHtml(t('home.weight'))} <b>${d.weight}%</b></p>
            <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
            <p class="small muted mt">${v && v.total ? escapeHtml(t('home.practicePct', { pct: p })) : escapeHtml(t('home.noPractice'))}</p>
          </a>`;
      }).join('')}
    </div>

    <div class="card">
      <h2>${escapeHtml(t('home.howTitle'))}</h2>
      <div class="hero-actions">
        <a class="btn primary" href="#/learn">${escapeHtml(t('home.actionLearn'))}</a>
        <a class="btn" href="#/study">${escapeHtml(t('home.actionStudy'))}</a>
        <a class="btn" href="#/quiz">${escapeHtml(t('home.actionQuiz'))}</a>
        <a class="btn" href="#/exam">${escapeHtml(t('home.actionExam'))}</a>
      </div>
      <div class="hero-actions">
        <a class="btn" href="#/review">${escapeHtml(t('home.actionReview'))}</a>
        <a class="btn" href="#/bookmarks">${escapeHtml(t('home.actionBookmarks'))}</a>
        <a class="btn" href="#/library">${escapeHtml(t('home.actionLibrary'))}</a>
        <a class="btn" href="#/progress">${escapeHtml(t('home.actionProgress'))}</a>
      </div>
      ${s.stats.lastStudiedAt ? `<p class="small muted">${escapeHtml(t('home.lastSession', { date: formatDate(s.stats.lastStudiedAt) }))}</p>` : ''}
    </div>`;

  renderRecommendations(document.getElementById('rec-strip'), 3);
}

/* ---------- Pantalla de dominio ---------- */

function renderDomain(params) {
  const c = getContent();
  const d = getDomain(Number(params.id));
  const outlet = $outlet();
  if (!d) { navigate('/'); return; }
  const attempts = state.listAttempts();

  outlet.innerHTML = `
    <p><a href="#/">← ${escapeHtml(t('common.home'))}</a></p>
    <div class="card">
      <h1>D${d.id} · ${escapeHtml(d.name)} <span class="badge info">${escapeHtml(t('domain.examWeight', { pct: d.weight }))}</span></h1>
      <p class="muted">${escapeHtml(d.description)}</p>
      <div class="btn-row">
        <a class="btn primary" href="#/study">${escapeHtml(t('domain.practiceStudy'))}</a>
        <a class="btn" href="#/quiz">${escapeHtml(t('domain.practiceQuiz'))}</a>
        <a class="btn" href="#/library">${escapeHtml(t('domain.viewLessons'))}</a>
      </div>
    </div>
    ${d.tasks.map((tk) => {
      const lessons = c.lessons.filter((l) => (l.taskStatements || []).includes(tk.id));
      let correct = 0, total = 0;
      attempts.forEach((a) => {
        const v = a.resultSummary?.byTask?.[tk.id];
        if (v) { correct += v.correct; total += v.total; }
      });
      const p = total ? pct(correct, total) : 0;
      const cls = !total ? '' : p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad';
      return `
        <div class="card">
          <h3>${escapeHtml(t('common.task'))} ${escapeHtml(tk.id)} · ${escapeHtml(tk.title)}</h3>
          <p class="small muted">${escapeHtml(t('domain.accuracy'))} ${total ? `${p}% (${correct}/${total})` : escapeHtml(t('common.noData'))}</p>
          <div class="progress-track"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
          <div class="chips mt">${tk.topics.map((tp) => `<span class="chip">${escapeHtml(tp)}</span>`).join('')}</div>
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
    <h1>${escapeHtml(t('quiz.title'))}</h1>
    <p class="muted">${escapeHtml(t('quiz.intro'))}</p>
    <div class="card">
      <div class="field">
        <label>${escapeHtml(t('quiz.size'))}</label>
        <div class="btn-row" role="radiogroup" aria-label="${escapeHtml(t('quiz.sizeAria'))}">
          ${[10, 20, 30].map((n) => `
            <label class="option" style="flex:0 1 auto">
              <input type="radio" name="quiz-size" value="${n}" ${settings.defaultQuizSize === n ? 'checked' : ''}>
              <span>${n}</span>
            </label>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>${escapeHtml(t('quiz.domains'))}</label>
        ${c.domains.map((d) => `
          <label class="check-row">
            <input type="checkbox" class="quiz-domain" value="${d.id}">
            <span>D${d.id} · ${escapeHtml(d.name)} (${d.weight}%)</span>
          </label>`).join('')}
      </div>
      <p class="small muted" id="quiz-count"></p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="quiz-start">${escapeHtml(t('quiz.start'))}</button>
        <a class="btn ghost" href="#/">${escapeHtml(t('common.cancel'))}</a>
      </div>
    </div>`;

  const countEl = outlet.querySelector('#quiz-count');
  function updateCount() {
    const domains = Array.from(outlet.querySelectorAll('.quiz-domain:checked')).map((i) => i.value);
    const n = Number(outlet.querySelector('input[name="quiz-size"]:checked')?.value || settings.defaultQuizSize);
    countEl.textContent = t('quiz.selected', { n: selectQuestions({ mode: 'quiz', domains, size: n }).length });
  }
  outlet.querySelectorAll('.quiz-domain, input[name="quiz-size"]').forEach((el) => el.addEventListener('change', updateCount));
  updateCount();

  outlet.querySelector('#quiz-start').addEventListener('click', () => {
    const domains = Array.from(outlet.querySelectorAll('.quiz-domain:checked')).map((i) => i.value);
    const size = Number(outlet.querySelector('input[name="quiz-size"]:checked')?.value || settings.defaultQuizSize);
    const minutes = size === 10 ? 15 : size === 20 ? 30 : 45;
    createAttempt({
      mode: 'quiz',
      config: { domains, tasks: [], size, timerSeconds: minutes * 60 },
    });
    navigate('/quiz/session');
  });
}

/* ---------- Registro de rutas ---------- */

function registerRoutes() {
  register('/', renderHome);
  register('/domain/:id', renderDomain);

  register('/learn', renderLearnHome);
  register('/lesson/:id', (params) => renderLessonReader(params.id));
  register('/comparison/:id', (params) => renderComparison(params.id));

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
      startQuizSession(attempt.id);
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
      startQuizSession(attempt.id);
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
  register('/library/comparisons', renderComparisons);
  register('/library/flashcards', renderFlashcards);
  register('/library/services', renderServices);
  register('/library/glossary', renderGlossary);
  register('/settings', renderSettings);
}

/* ---------- Arranque ---------- */

async function boot() {
  state.applyPreferences();
  const preferred = state.getSettings().language;
  try {
    await initI18n(isLang(preferred) ? preferred : 'es');
    await loadContent(isLang(preferred) ? preferred : 'es');
  } catch (e) {
    $outlet().innerHTML = `
      <div class="card">
        <h1>${t('boot.loadFail')}</h1>
        <p class="muted">${String(e.message || e)}</p>
        <p class="small muted">${t('boot.loadFailHint')}</p>
      </div>`;
    return;
  }
  applyStaticI18n();
  initQuizEngine();
  registerRoutes();
  initRouter(document.getElementById('outlet'));
}

boot();
