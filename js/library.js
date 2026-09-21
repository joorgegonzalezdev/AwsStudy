/* library.js — biblioteca de estudio: lecciones por dominio/tarea,
   tarjetas de servicio con nivel de aprendizaje y glosario con búsqueda. */

import { getContent, getLesson, getDomain } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml } from './utils.js';
import { createAttempt } from './quiz-engine.js';
import { navigate } from './router.js';

export function renderLibrary() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <h1>Biblioteca de estudio</h1>
    <div class="btn-row">
      <a class="btn ${true ? 'toggled' : ''}" href="#/library">Lecciones</a>
      <a class="btn" href="#/library/services">Servicios de AWS</a>
      <a class="btn" href="#/library/glossary">Glosario</a>
    </div>
    ${c.domains.map((d) => `
      <div class="card">
        <h2>D${d.id} · ${escapeHtml(d.name)} <span class="badge neutral">${d.weight}%</span></h2>
        ${d.tasks.map((t) => {
          const lessons = c.lessons.filter((l) => (l.taskStatements || []).includes(t.id));
          if (!lessons.length) return '';
          return `
            <div class="mt">
              <b>${escapeHtml(t.id)} · ${escapeHtml(t.title)}</b>
              ${lessons.map((l) => `
                <p style="margin:6px 0 0 0">📖 <a href="#/library/lesson/${l.id}">${escapeHtml(l.title)}</a>
                <span class="muted small">· ${l.estimatedMinutes} min · ${l.knowledgeCheckQuestionIds?.length || 0} preguntas</span></p>`).join('')}
            </div>`;
        }).join('')}
        <div class="btn-row mt">
          <a class="btn small primary" href="#/domain/${d.id}">Abrir dominio</a>
        </div>
      </div>`).join('')}`;
}

export function renderLesson(lessonId) {
  const outlet = document.getElementById('outlet');
  const l = getLesson(lessonId);
  if (!l) {
    outlet.innerHTML = '<div class="card"><p>Lección no encontrada.</p><a class="btn primary" href="#/library">Volver</a></div>';
    return;
  }
  const relatedQuestions = getContent().questions.filter((q) => q.lessonId === l.id);
  outlet.innerHTML = `
    <p><a href="#/library">← Biblioteca</a></p>
    <div class="card lesson-body">
      <h1>${escapeHtml(l.title)}</h1>
      <div class="chips">
        ${(l.taskStatements || []).map((t) => `<span class="chip">Tarea ${t}</span>`).join('')}
        <span class="chip">${l.estimatedMinutes} min de lectura</span>
        ${l.status === 'verified' ? '<span class="badge ok">Contenido verificado</span>' : `<span class="badge warn">${l.status}</span>`}
      </div>
      <p class="mt"><b>${escapeHtml(l.summary)}</b></p>
      ${(l.explanation || '').split('\n\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      <h3>Por qué importa en el examen</h3>
      <p>${escapeHtml(l.examRelevance)}</p>
      <h3>Ejemplo práctico</h3>
      <p>${escapeHtml(l.awsExample)}</p>
      <h3>Términos clave</h3>
      <div class="lesson-terms">
        ${(l.keyTerms || []).map((t) => `<div class="term">· <b>${escapeHtml(t.term)}</b>: ${escapeHtml(t.definition)}</div>`).join('')}
      </div>
      <h3>Confusiones frecuentes</h3>
      ${(l.commonConfusions || []).map((cc) => `<div class="confusion"><b>${escapeHtml(cc.withWhat)}:</b> ${escapeHtml(cc.difference)}</div>`).join('')}
      ${(l.comparisons || []).map((cmp) => `
        <h3>${escapeHtml(cmp.title)}</h3>
        <table class="table">
          <thead><tr>${Object.keys(cmp.rows[0]).map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
          <tbody>${cmp.rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`).join('')}
      <h3>Comprobar lo aprendido</h3>
      <p class="small muted">${relatedQuestions.length} preguntas asociadas a esta lección.</p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="practice-lesson">Practicar esta lección (${relatedQuestions.length} preguntas)</button>
      </div>
      <h3>Fuentes oficiales</h3>
      <ul>${(l.sources || []).map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a></li>`).join('')}</ul>
      <p class="small muted">Última revisión: ${l.lastReviewedAt} · Guía de examen: ${l.examGuideVersion}</p>
    </div>`;

  outlet.querySelector('#practice-lesson').addEventListener('click', () => {
    const ids = relatedQuestions.map((q) => q.id);
    if (!ids.length) return;
    createAttempt({ mode: 'study', explicitIds: ids, config: { timerSeconds: 0, label: 'Lección' } });
    navigate('/study/session');
  });
}

export function renderServices() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  const levels = [
    { key: 'core', label: 'Núcleo', desc: 'Debes distinguir casos de uso y escenarios.' },
    { key: 'supporting', label: 'Apoyo', desc: 'Debes conocer su propósito y categoría.' },
    { key: 'awareness', label: 'Reconocimiento', desc: 'Reconocer el servicio y su propósito general.' },
  ];
  outlet.innerHTML = `
    <p><a href="#/library">← Biblioteca</a></p>
    <h1>Catálogo de servicios de AWS</h1>
    <p class="muted small">Nivel de aprendizaje recomendado según la guía del examen CLF-C02.</p>
    ${levels.map((lv) => `
      <div class="card level-${lv.key}">
        <h2>${lv.label} <span class="badge neutral">${c.services.filter((s) => s.learningLevel === lv.key).length} servicios</span></h2>
        <p class="small muted">${lv.desc}</p>
        <div class="grid grid-2">
          ${c.services.filter((s) => s.learningLevel === lv.key).map((s) => `
            <div>
              <b>${escapeHtml(s.name)}</b> <span class="chip">${escapeHtml(s.category)}</span>
              <p class="small" style="margin:4px 0 0">${escapeHtml(s.oneLinePurpose)}</p>
              ${(s.examPitfalls || []).length ? `<p class="small muted" style="margin:4px 0 0">⚠ ${s.examPitfalls.map(escapeHtml).join(' · ')}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>`).join('')}`;
}

export function renderGlossary() {
  const c = getContent();
  const outlet = document.getElementById('outlet');
  outlet.innerHTML = `
    <p><a href="#/library">← Biblioteca</a></p>
    <h1>Glosario</h1>
    <div class="field">
      <label for="glossary-search">Buscar término o definición</label>
      <input type="search" id="glossary-search" placeholder="p. ej., elasticidad, CloudTrail, Spot…">
    </div>
    <div class="card" id="glossary-list"></div>`;

  const list = outlet.querySelector('#glossary-list');
  const input = outlet.querySelector('#glossary-search');
  function draw() {
    const q = input.value.trim().toLowerCase();
    const terms = c.glossary.filter(
      (t) => !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    );
    list.innerHTML = terms.length
      ? terms.map((t) => `<div class="glossary-term"><b>${escapeHtml(t.term)}</b><br>${escapeHtml(t.definition)}</div>`).join('')
      : '<p class="muted">Sin resultados.</p>';
  }
  input.addEventListener('input', draw);
  draw();
}
