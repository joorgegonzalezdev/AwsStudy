/* exam-simulator.js — Simulacro de examen: 65 preguntas, 90 minutos,
   distribución aproximada por pesos de dominio, navegador de preguntas,
   auto-entrega al agotar el tiempo. SIEMPRE no oficial. */

import { selectQuestions, createAttempt } from './quiz-engine.js';
import * as state from './state.js';
import { escapeHtml } from './utils.js';
import { t } from './i18n.js';
import { navigate } from './router.js';

const EXAM_SIZE = 65;
const EXAM_SECONDS = 90 * 60;

export function renderExamStart() {
  const outlet = document.getElementById('outlet');
  /* Contar el pool real para avisar si el banco aún no cubre 65 */
  const available = selectQuestions({ mode: 'exam', size: EXAM_SIZE }).length;
  const partial = available < EXAM_SIZE;

  outlet.innerHTML = `
    <h1>${escapeHtml(t('exam.title'))}</h1>
    <div class="notice"><b>${escapeHtml(t('exam.notice'))}</b></div>
    <div class="card">
      <h2>${escapeHtml(t('exam.format'))}</h2>
      <ul>
        <li>${escapeHtml(t('exam.f1', { n: partial ? available : EXAM_SIZE, suffix: partial ? t('exam.f1Suffix') : '' }))}</li>
        <li>${escapeHtml(t('exam.f2'))}</li>
        <li>${escapeHtml(t('exam.f3'))}</li>
        <li>${escapeHtml(t('exam.f4'))}</li>
        <li>${escapeHtml(t('exam.f5'))}</li>
      </ul>
      ${partial ? `<div class="notice info">${escapeHtml(t('exam.partial'))}</div>` : ''}
      <div class="btn-row">
        <button type="button" class="btn primary" id="exam-start">${escapeHtml(t('exam.start'))}</button>
        <a class="btn ghost" href="#/">${escapeHtml(t('common.cancel'))}</a>
      </div>
    </div>`;

  outlet.querySelector('#exam-start').addEventListener('click', () => {
    createAttempt({
      mode: 'exam',
      config: {
        domains: [],
        tasks: [],
        size: EXAM_SIZE,
        timerSeconds: EXAM_SECONDS,
      },
    });
    navigate('/exam/session');
  });
}
