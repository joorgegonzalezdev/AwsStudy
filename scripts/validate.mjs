/* scripts/validate.mjs — validación de contenido y sintaxis (solo desarrollo).
   Comprueba: JSON válido, integridad referencial, alcance de servicios,
   respuestas por opción y cobertura por task statement. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = join(root, 'data');
let errors = 0;
const warn = (m) => console.warn('  ⚠ ' + m);
const fail = (m) => { console.error('  ✗ ' + m); errors++; };

function loadJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

console.log('Validando JSON…');
const manifest = loadJSON(join(data, 'manifest.json'));
const domains = manifest.domains.map((f) => loadJSON(join(data, '..', f)));
const lessonsFiles = manifest.lessons.map((f) => loadJSON(join(data, '..', f)));
const questionFiles = manifest.questions.map((f) => loadJSON(join(data, '..', f)));
const inScope = loadJSON(join(data, 'services', 'in-scope-services.json'));
const outScope = loadJSON(join(data, 'services', 'out-of-scope-services.json'));
const glossary = loadJSON(join(data, 'glossary', 'glossary-es.json'));

const lessons = lessonsFiles.flat();
const questions = questionFiles.flat();
const serviceIds = new Set(inScope.services.map((s) => s.id));
const outNames = new Set(outScope.services.map((s) => s.name.toLowerCase()));
const lessonIds = new Set(lessons.map((l) => l.id));
const questionIds = new Set(questions.map((q) => q.id));
const taskIds = new Set(domains.flatMap((d) => d.tasks.map((t) => t.id)));
const domainIds = new Set(domains.map((d) => String(d.id)));

console.log(`  ${domains.length} dominios, ${lessons.length} lecciones, ${questions.length} preguntas, ${inScope.services.length} servicios en alcance, ${glossary.terms.length} términos.`);

console.log('Validando preguntas…');
const byTask = {};
for (const q of questions) {
  const qid = q.id;
  if (!domainIds.has(String(q.domain))) fail(`${qid}: dominio inválido ${q.domain}`);
  if (!taskIds.has(q.taskStatement)) fail(`${qid}: task statement inválido ${q.taskStatement}`);
  if (q.lessonId && !lessonIds.has(q.lessonId)) fail(`${qid}: lección inexistente ${q.lessonId}`);
  if (!Array.isArray(q.correctAnswerIds) || q.correctAnswerIds.length === 0) fail(`${qid}: sin respuesta correcta`);
  const optIds = new Set(q.options.map((o) => o.id));
  for (const cid of q.correctAnswerIds) if (!optIds.has(cid)) fail(`${qid}: respuesta correcta ${cid} no existe en opciones`);
  if (q.type === 'multiple' && q.correctAnswerIds.length < 2) fail(`${qid}: multiple con una sola respuesta correcta`);
  if (q.type === 'single' && q.correctAnswerIds.length !== 1) fail(`${qid}: single con más de una respuesta correcta`);
  for (const o of q.options) {
    if (!q.optionExplanations?.[o.id]) fail(`${qid}: falta explicación de la opción ${o.id}`);
  }
  if (!q.explanation) fail(`${qid}: falta explanation`);
  if (!q.officialSources?.length) fail(`${qid}: sin fuentes oficiales`);
  for (const sv of q.services || []) {
    if (!serviceIds.has(sv)) warn(`${qid}: servicio sin tarjeta: ${sv}`);
    const card = inScope.services.find((s) => s.id === sv);
    if (card && outNames.has(card.name.toLowerCase())) fail(`${qid}: usa servicio FUERA de alcance: ${card.name}`);
  }
  byTask[q.taskStatement] = (byTask[q.taskStatement] || 0) + (q.type === 'truefalse' ? 0 : 1);
}

console.log('Validando cobertura (mínimo 2 preguntas verificadas no-TF por task statement)…');
for (const t of taskIds) {
  const n = byTask[t] || 0;
  if (n < 2) warn(`Tarea ${t}: solo ${n} preguntas (mínimo recomendado: 2)`);
}

console.log('Validando lecciones…');
for (const l of lessons) {
  for (const kid of l.knowledgeCheckQuestionIds || []) {
    if (!questionIds.has(kid)) fail(`Lección ${l.id}: pregunta inexistente ${kid}`);
  }
  for (const t of l.taskStatements || []) {
    if (!taskIds.has(t)) fail(`Lección ${l.id}: task statement inexistente ${t}`);
  }
  if (!l.explanation || !l.examRelevance || !l.awsExample) fail(`Lección ${l.id}: campos base incompletos`);
}

console.log('Validando sintaxis de módulos JS…');
const jsDir = join(root, 'js');
for (const f of readdirSync(jsDir)) {
  if (!f.endsWith('.js')) continue;
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, ['--check', join(jsDir, f)], { encoding: 'utf8' });
  if (res.status !== 0) fail(`${f}: ${res.stderr}`);
  else console.log(`  ✓ js/${f}`);
}

console.log(errors === 0 ? '\n✅ Validación completa sin errores.' : `\n❌ ${errors} error(es) encontrados.`);
process.exit(errors === 0 ? 0 : 1);
