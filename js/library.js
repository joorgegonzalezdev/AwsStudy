/* library.js — biblioteca de estudio: lecciones por dominio/tarea,
   tarjetas de servicio con nivel de aprendizaje y glosario con búsqueda. */

import { getContent, getLesson } from './content-loader.js';
import { escapeHtml, shuffle } from './utils.js';
import { t } from './i18n.js';
import { createAttempt } from './quiz-engine.js';
import { navigate } from './router.js';

export function renderLibrary() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <h1>${escapeHtml(t('library.title'))}</h1>
    <div class="btn-row">
      <a class="btn toggled" href="#/library">${escapeHtml(t('library.tabLessons'))}</a>
      <a class="btn" href="#/library/comparisons">${escapeHtml(t('comparison.tab'))}</a>
      <a class="btn" href="#/library/flashcards">${escapeHtml(t('flashcards.tab'))}</a>
      <a class="btn" href="#/library/services">${escapeHtml(t('library.tabServices'))}</a>
      <a class="btn" href="#/library/glossary">${escapeHtml(t('library.tabGlossary'))}</a>
    </div>
    ${c.domains.map((d) => `
      <div class="card">
        <h2>D${d.id} · ${escapeHtml(d.name)} <span class="badge neutral">${d.weight}%</span></h2>
        ${d.tasks.map((tk) => {
          const lessons = c.lessons.filter((l) => (l.taskStatements || []).includes(tk.id));
          if (!lessons.length) return '';
          return `
            <div class="mt">
              <b>${escapeHtml(tk.id)} · ${escapeHtml(tk.title)}</b>
              ${lessons.map((l) => `
                <p style="margin:6px 0 0 0">📖 <a href="#/lesson/${l.id}">${escapeHtml(l.title)}</a>
                <span class="muted small">· ${escapeHtml(t('lesson.readingTime', { n: l.estimatedMinutes }))} · ${escapeHtml(t('library.related', { n: l.knowledgeCheckQuestionIds?.length || 0 }))}</span></p>`).join('')}
            </div>`;
        }).join('')}
        <div class="btn-row mt">
          <a class="btn small primary" href="#/domain/${d.id}">${escapeHtml(t('library.openDomain'))}</a>
        </div>
      </div>`).join('')}`;
}

export function renderLesson(lessonId) {
  const outlet = document.getElementById('outlet');
  const l = getLesson(lessonId);
  if (!l) {
    outlet.innerHTML = `<div class="card"><p>${escapeHtml(t('lesson.notFound'))}</p><a class="btn primary" href="#/library">${escapeHtml(t('lesson.backToList'))}</a></div>`;
    return;
  }
  const relatedQuestions = getContent().questions.filter((q) => q.lessonId === l.id);
  outlet.innerHTML = `
    <p><a href="#/library">${escapeHtml(t('lesson.back'))}</a></p>
    <div class="card lesson-body">
      <h1>${escapeHtml(l.title)}</h1>
      <div class="chips">
        ${(l.taskStatements || []).map((tk) => `<span class="chip">${escapeHtml(t('common.task'))} ${tk}</span>`).join('')}
        <span class="chip">${escapeHtml(t('lesson.readingTime', { n: l.estimatedMinutes }))}</span>
        ${l.status === 'verified' ? `<span class="badge ok">${escapeHtml(t('lesson.verified'))}</span>` : `<span class="badge warn">${escapeHtml(l.status)}</span>`}
      </div>
      <p class="mt"><b>${escapeHtml(l.summary)}</b></p>
      ${(l.explanation || '').split('\n\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      <h3>${escapeHtml(t('lesson.whyExam'))}</h3>
      <p>${escapeHtml(l.examRelevance)}</p>
      <h3>${escapeHtml(t('lesson.example'))}</h3>
      <p>${escapeHtml(l.awsExample)}</p>
      <h3>${escapeHtml(t('lesson.keyTerms'))}</h3>
      <div class="lesson-terms">
        ${(l.keyTerms || []).map((tk) => `<div class="term">· <b>${escapeHtml(tk.term)}</b>: ${escapeHtml(tk.definition)}</div>`).join('')}
      </div>
      <h3>${escapeHtml(t('lesson.confusions'))}</h3>
      ${(l.commonConfusions || []).map((cc) => `<div class="confusion"><b>${escapeHtml(cc.withWhat)}:</b> ${escapeHtml(cc.difference)}</div>`).join('')}
      ${(l.comparisons || []).map((cmp) => `
        <h3>${escapeHtml(cmp.title)}</h3>
        <table class="table">
          <thead><tr>${Object.keys(cmp.rows[0]).map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
          <tbody>${cmp.rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`).join('')}
      <h3>${escapeHtml(t('lesson.checkTitle'))}</h3>
      <p class="small muted">${escapeHtml(t('lesson.associated', { n: relatedQuestions.length }))}</p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="practice-lesson">${escapeHtml(t('lesson.practice', { n: relatedQuestions.length }))}</button>
      </div>
      <h3>${escapeHtml(t('lesson.sources'))}</h3>
      <ul>${(l.sources || []).map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a></li>`).join('')}</ul>
      <p class="small muted">${escapeHtml(t('lesson.lastReview', { date: l.lastReviewedAt }))} · ${escapeHtml(t('lesson.examGuide', { v: l.examGuideVersion }))}</p>
    </div>`;

  outlet.querySelector('#practice-lesson').addEventListener('click', () => {
    const ids = relatedQuestions.map((q) => q.id);
    if (!ids.length) return;
    createAttempt({ mode: 'study', explicitIds: ids, config: { timerSeconds: 0 } });
    navigate('/study/session');
  });
}

export function renderServices() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const levels = [
    { key: 'core', label: t('services.core'), desc: t('services.coreDesc') },
    { key: 'supporting', label: t('services.supporting'), desc: t('services.supportingDesc') },
    { key: 'awareness', label: t('services.awareness'), desc: t('services.awarenessDesc') },
  ];
  outlet.innerHTML = `
    <p><a href="#/library">${escapeHtml(t('lesson.back'))}</a></p>
    <h1>${escapeHtml(t('services.title'))}</h1>
    <p class="muted small">${escapeHtml(t('services.subtitle'))}</p>
    ${levels.map((lv) => `
      <div class="card level-${lv.key}">
        <h2>${escapeHtml(lv.label)} <span class="badge neutral">${c.services.filter((s) => s.learningLevel === lv.key).length} ${escapeHtml(t('services.count'))}</span></h2>
        <p class="small muted">${escapeHtml(lv.desc)}</p>
        <div class="grid grid-2">
          ${c.services.filter((s) => s.learningLevel === lv.key).map((s) => `
            <div>
              <b>${escapeHtml(s.name)}</b> <span class="chip">${escapeHtml(s.category)}</span>
              <p class="small" style="margin:4px 0 0">${escapeHtml(s.oneLinePurpose)}</p>
              ${(s.examPitfalls || []).length ? `<p class="small muted" style="margin:4px 0 0">⚠ ${s.examPitfalls.map((p) => escapeHtml(p)).join(' · ')}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>`).join('')}`;
}

export function renderGlossary() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <p><a href="#/library">${escapeHtml(t('lesson.back'))}</a></p>
    <h1>${escapeHtml(t('glossary.title'))}</h1>
    <div class="field">
      <label for="glossary-search">${escapeHtml(t('glossary.search'))}</label>
      <input type="search" id="glossary-search" placeholder="${escapeHtml(t('glossary.placeholder'))}">
    </div>
    <div class="card" id="glossary-list"></div>`;

  const list = outlet.querySelector('#glossary-list');
  const input = outlet.querySelector('#glossary-search');
  function draw() {
    const q = input.value.trim().toLowerCase();
    const terms = c.glossary.filter(
      (x) => !q || x.term.toLowerCase().includes(q) || x.definition.toLowerCase().includes(q)
    );
    list.innerHTML = terms.length
      ? terms.map((x) => `<div class="glossary-term"><b>${escapeHtml(x.term)}</b><br>${escapeHtml(x.definition)}</div>`).join('')
      : `<p class="muted">${escapeHtml(t('glossary.noResults'))}</p>`;
  }
  input.addEventListener('input', draw);
  draw();
}

/* ---------- Guías de comparación ---------- */

export function renderComparisons() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <p><a href="#/library">${escapeHtml(t('lesson.back'))}</a></p>
    <h1>${escapeHtml(t('comparison.title'))}</h1>
    <p class="muted small">${escapeHtml(t('comparison.subtitle'))}</p>
    <div class="grid grid-2">
      ${c.comparisons.map((cmp) => `
        <a class="card domain-card" href="#/comparison/${cmp.id}" style="margin-bottom:0">
          <h3>⚖️ ${escapeHtml(cmp.title)}</h3>
          <p class="small muted" style="margin:0">${escapeHtml(cmp.question)}</p>
        </a>`).join('')}
    </div>`;
}

export function renderComparison(comparisonId) {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const cmp = c.comparisonsById.get(comparisonId);
  if (!cmp) {
    outlet.innerHTML = `<div class="card"><p>${escapeHtml(t('comparison.notFound'))}</p><a class="btn primary" href="#/library/comparisons">${escapeHtml(t('comparison.back'))}</a></div>`;
    return;
  }
  outlet.innerHTML = `
    <p><a href="#/library/comparisons">${escapeHtml(t('comparison.back'))}</a></p>
    <div class="card lesson-body">
      <h1>⚖️ ${escapeHtml(cmp.title)}</h1>
      <p class="muted"><b>${escapeHtml(cmp.question)}</b></p>
      <div class="grid grid-2">
        ${cmp.options.map((o) => `
          <div class="card" style="margin-bottom:0">
            <h3>${escapeHtml(o.name)}</h3>
            <p><b>${escapeHtml(t('comparison.whenToUse'))}</b> ${escapeHtml(o.useWhen)}</p>
            <p class="small muted"><b>${escapeHtml(t('comparison.avoidWhen'))}</b> ${escapeHtml(o.avoidWhen)}</p>
          </div>`).join('')}
      </div>
      <h3>${escapeHtml(t('comparison.keyDifferences'))}</h3>
      <table class="table">
        <thead><tr>${Object.keys(cmp.differences[0]).map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
        <tbody>${cmp.differences.map((r) => `<tr>${Object.values(r).map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <div class="confusion mt"><b>${escapeHtml(t('comparison.examClue'))}:</b> ${escapeHtml(cmp.examClue)}</div>
      ${(cmp.relatedLessons || []).length ? `
        <h3>${escapeHtml(t('comparison.relatedLessons'))}</h3>
        ${cmp.relatedLessons.map((lid) => {
          const l = c.lessonsById.get(lid);
          return l ? `<p style="margin:4px 0">📖 <a href="#/lesson/${l.id}">${escapeHtml(l.title)}</a></p>` : '';
        }).join('')}` : ''}
    </div>`;
}

/* ---------- Tarjetas de estudio (flashcards) ---------- */

export function renderFlashcards() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const cards = shuffle(c.lessons.flatMap((l) => (l.keyTerms || []).map((kt) => ({ term: kt.term, definition: kt.definition }))));
  let i = 0;

  outlet.innerHTML = `
    <p><a href="#/library">${escapeHtml(t('lesson.back'))}</a></p>
    <h1>${escapeHtml(t('flashcards.title'))}</h1>
    <p class="muted small">${escapeHtml(t('flashcards.subtitle'))}</p>
    <div class="card score-hero" id="flashcard-zone"></div>`;

  const zone = outlet.querySelector('#flashcard-zone');
  function draw() {
    if (i >= cards.length) {
      zone.innerHTML = `
        <p class="big" style="font-size:1.6rem">🎉</p>
        <p><b>${escapeHtml(t('flashcards.done', { n: cards.length }))}</b></p>
        <button type="button" class="btn primary" id="fc-restart">${escapeHtml(t('flashcards.restart'))}</button>`;
      zone.querySelector('#fc-restart').addEventListener('click', () => renderFlashcards());
      return;
    }
    const card = cards[i];
    zone.innerHTML = `
      <p class="small muted">${escapeHtml(t('flashcards.count', { i: i + 1, n: cards.length }))}</p>
      <div class="flashcard" id="fc-card" tabindex="0" role="button" aria-label="${escapeHtml(t('flashcards.reveal'))}">
        <div class="fc-term">${escapeHtml(card.term)}</div>
        <div class="fc-def" hidden>${escapeHtml(card.definition)}</div>
      </div>
      <p class="small muted">${escapeHtml(t('flashcards.reveal'))}</p>
      <div class="btn-row" style="justify-content:center">
        <button type="button" class="btn" id="fc-again">${escapeHtml(t('flashcards.again'))}</button>
        <button type="button" class="btn primary" id="fc-know" disabled>${escapeHtml(t('flashcards.know'))}</button>
      </div>`;
    const defEl = zone.querySelector('.fc-def');
    const knowBtn = zone.querySelector('#fc-know');
    const reveal = () => { defEl.hidden = false; knowBtn.disabled = false; };
    zone.querySelector('#fc-card').addEventListener('click', reveal);
    zone.querySelector('#fc-card').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
    });
    knowBtn.addEventListener('click', () => { i += 1; draw(); });
    zone.querySelector('#fc-again').addEventListener('click', () => {
      cards.push(cards.splice(i, 1)[0]);
      draw();
    });
  }
  draw();
}
