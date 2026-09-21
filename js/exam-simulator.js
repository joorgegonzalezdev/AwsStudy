/* exam-simulator.js — Simulacro de examen: 65 preguntas, 90 minutos,
   distribución aproximada por pesos de dominio, navegador de preguntas,
   auto-entrega al agotar el tiempo. SIEMPRE no oficial. */

import { selectQuestions, createAttempt, startQuizSession, stopTimer } from './quiz-engine.js';
import { getContent } from './content-loader.js';
import * as state from './state.js';
import { escapeHtml, announce } from './utils.js';
import { navigate } from './router.js';

const EXAM_SIZE = 65;
const EXAM_SECONDS = 90 * 60;

export function renderExamStart() {
  const outlet = document.getElementById('outlet');
  /* Contar el pool real para avisar si el banco aún no cubre 65 */
  const available = selectQuestions({ mode: 'exam', size: EXAM_SIZE }).length;
  const partial = available < EXAM_SIZE;

  outlet.innerHTML = `
    <h1>Simulacro de examen</h1>
    <div class="notice"><b>Aviso:</b> este simulacro es una herramienta de estudio <b>no oficial</b>. No reproduce el examen real de AWS ni su algoritmo de puntuación. Tu resultado es una estimación local de estudio.</div>
    <div class="card">
      <h2>Formato</h2>
      <ul>
        <li><b>${partial ? available : EXAM_SIZE} preguntas</b> de selección única y de respuesta múltiple${partial ? ' (banco en crecimiento: simulacro reducido)' : ''}.</li>
        <li><b>90 minutos</b> de tiempo total. Al agotarse, el examen se entrega automáticamente.</li>
        <li>Distribución aproximada por dominio: D1 24% · D2 30% · D3 34% · D4 12%.</li>
        <li>Puedes avanzar, retroceder y marcar preguntas para revisar.</li>
        <li>Las respuestas se muestran solo al final; sin responder cuenta como incorrecta; no hay penalización por adivinar.</li>
      </ul>
      ${partial ? '<div class="notice info">El banco de preguntas verificadas aún no llega a 65; el simulacro se ofrecerá con el número disponible hasta completar el banco.</div>' : ''}
      <div class="btn-row">
        <button type="button" class="btn primary" id="exam-start">Comenzar el simulacro</button>
        <a class="btn ghost" href="#/">Cancelar</a>
      </div>
    </div>`;

  outlet.querySelector('#exam-start').addEventListener('click', () => {
    const att = createAttempt({
      mode: 'exam',
      config: {
        domains: [],
        tasks: [],
        size: EXAM_SIZE,
        timerSeconds: EXAM_SECONDS,
        label: 'Simulacro de examen (no oficial)',
      },
    });
    navigate('/exam/session');
    void att;
  });
}

export function startExamSession(attemptId) {
  startQuizSession(attemptId, { label: 'Simulacro de examen (no oficial)' });
}
