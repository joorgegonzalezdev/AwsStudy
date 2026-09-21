/* scripts/smoke.mjs — prueba de humo en Node: carga de contenido,
   selección estratificada del simulacro, intentos y puntuación. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Stub de entorno navegador */
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
globalThis.window = { setTimeout, addEventListener() {}, scrollTo() {} };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const p = join(root, url.replace(/^\/+/, ''));
  return { ok: true, json: async () => JSON.parse(readFileSync(p, 'utf8')) };
};

const { loadContent, setActiveLanguage, getContent } = await import('../js/content-loader.js');
const { selectQuestions, createAttempt } = await import('../js/quiz-engine.js');
const { computeSummary } = await import('../js/scoring.js');

/* Contenido bilingüe */
const esContent = await loadContent('es');
const enContent = await loadContent('en');
console.log(`Contenido cargado: es ${esContent.questions.length} preguntas / en ${enContent.questions.length} preguntas.`);
const esIds = new Set(esContent.questions.map((q) => q.id));
const enIds = new Set(enContent.questions.map((q) => q.id));
if (esIds.size !== enIds.size) console.error('  ✗ los bancos es/en difieren en tamaño');
for (const id of esIds) if (!enIds.has(id)) console.error(`  ✗ falta en en: ${id}`);
const sampleEn = enContent.questionsById.get('D1-T1.1-001');
if (!sampleEn || !sampleEn.question.match(/^[A-Z]/)) console.error('  ✗ el contenido en no parece estar en inglés');
const sampleEs = esContent.questionsById.get('D1-T1.1-001');
if (!sampleEs || !/[áéíóúñ¿]/i.test(sampleEs.question)) console.warn('  ⚠ el contenido es no parece tener caracteres españoles');

/* El motor usa el idioma activo */
setActiveLanguage('en');
if (getContent().lang !== 'en') console.error('  ✗ idioma activo no aplicado');
setActiveLanguage('es');

/* Simulacro: distribución por dominio */
const exam = selectQuestions({ mode: 'exam', size: 65 });
const dist = {};
exam.forEach((q) => { dist[q.domain] = (dist[q.domain] || 0) + 1; });
console.log('Simulacro (65):', dist, 'total', exam.length);
const expected = { 1: 16, 2: 19, 3: 22, 4: 8 };
for (const [d, n] of Object.entries(expected)) {
  if ((dist[d] || 0) !== n) console.warn(`  ⚠ D${d}: esperado ${n}, obtenido ${dist[d] || 0}`);
}
const tf = exam.filter((q) => q.type === 'truefalse').length;
if (tf > 0) console.error('  ✗ truefalse apareció en el simulacro');

/* Sin repetidos */
const ids = exam.map((q) => q.id);
if (new Set(ids).size !== ids.length) console.error('  ✗ preguntas repetidas en el simulacro');

/* Subtema: máx 2 por subtema */
const subCount = {};
exam.forEach((q) => {
  const k = `${q.domain}|${q.subtopic}`;
  subCount[k] = (subCount[k] || 0) + 1;
});
const overCap = Object.entries(subCount).filter(([, n]) => n > 2);
if (overCap.length) console.warn('  ⚠ subtemas con más de 2:', overCap);

/* Quiz rápido de 10 en D2 */
const quiz = selectQuestions({ mode: 'quiz', domains: ['2'], size: 10 });
console.log('Quiz D2 (10):', quiz.length, 'preguntas, dominios:', [...new Set(quiz.map((q) => q.domain))]);
if (quiz.length !== 10) console.error('  ✗ quiz debería devolver 10');
quiz.forEach((q) => { if (String(q.domain) !== '2') console.error('  ✗ pregunta fuera del dominio solicitado'); });

/* Intento y puntuación */
const attempt = createAttempt({ mode: 'exam', config: { size: 65, timerSeconds: 5400, domains: [], tasks: [] } });
console.log('Intento creado:', attempt.id, attempt.questionOrder.length, 'preguntas.');
/* Responder correctamente la mitad, incorrectamente un cuarto */
attempt.questionOrder.forEach((qid, i) => {
  const q = getContent().questionsById.get(qid);
  if (i % 4 === 3) attempt.answers[qid] = { selectedIds: [], flagged: false };
  else if (i % 4 === 2) {
    const wrong = q.options.find((o) => !q.correctAnswerIds.includes(o.id)).id;
    attempt.answers[qid] = { selectedIds: [wrong], flagged: false };
  } else {
    attempt.answers[qid] = { selectedIds: [...q.correctAnswerIds], flagged: false };
  }
});
const summary = computeSummary(attempt);
console.log('Resumen:', { correct: summary.correct, incorrect: summary.incorrect, unanswered: summary.unanswered, pct: summary.percentage });
if (summary.correct + summary.incorrect + summary.unanswered !== 65) console.error('  ✗ la suma no cuadra');
const d1 = summary.byDomain['1'];
if (!d1 || d1.correct + d1.incorrect > d1.total) console.error('  ✗ desglose por dominio inconsistente');

/* Persistencia del intento */
const saved = JSON.parse(localStorage.getItem('ruta-clf-c02:v1'));
if (!saved.attempts[attempt.id]) console.error('  ✗ intento no persistido');

console.log('✅ Smoke test completado.');

