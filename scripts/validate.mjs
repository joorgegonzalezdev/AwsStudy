/* scripts/validate.mjs — validación de contenido y sintaxis (solo desarrollo).
   Comprueba: JSON válido, integridad referencial, alcance de servicios,
   respuestas por opción, cobertura por task statement y PARIDAD BILINGÜE. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = join(root, 'data');
let errors = 0;
const warn = (m) => console.warn('  ⚠ ' + m);
const fail = (m) => { console.error('  ✗ ' + m); errors++; };

function loadJSON(p) {
  return JSON.parse(readFileSync(join(root, p), 'utf8'));
}

console.log('Validando JSON…');
const manifest = loadJSON('data/manifest.json');
const outScope = loadJSON(manifest.outOfScopeServices);
const outNames = new Set(outScope.services.map((s) => s.name.toLowerCase()));
const langs = manifest.languages || ['es'];
const perLang = {};

for (const lang of langs) {
  console.log(`— Idioma: ${lang} —`);
  const paths = manifest.content[lang];
  if (!paths) { fail(`manifest: falta content.${lang}`); continue; }
  const domains = paths.domains.map(loadJSON);
  const lessons = paths.lessons.map(loadJSON).flat();
  const questions = paths.questions.map(loadJSON).flat();
  const inScope = loadJSON(paths.inScopeServices);
  const glossary = loadJSON(paths.glossary);
  perLang[lang] = { domains, lessons, questions, inScope, glossary };

  console.log(`  ${domains.length} dominios, ${lessons.length} lecciones, ${questions.length} preguntas, ${inScope.services.length} servicios, ${glossary.terms.length} términos.`);

  const serviceIds = new Set(inScope.services.map((s) => s.id));
  const lessonIds = new Set(lessons.map((l) => l.id));
  const taskIds = new Set(domains.flatMap((d) => d.tasks.map((tk) => tk.id)));
  const domainIds = new Set(domains.map((d) => String(d.id)));
  const byTask = {};

  for (const q of questions) {
    const qid = q.id;
    if (!domainIds.has(String(q.domain))) fail(`${lang}/${qid}: dominio inválido ${q.domain}`);
    if (!taskIds.has(q.taskStatement)) fail(`${lang}/${qid}: task statement inválido ${q.taskStatement}`);
    if (q.lessonId && !lessonIds.has(q.lessonId)) fail(`${lang}/${qid}: lección inexistente ${q.lessonId}`);
    if (!Array.isArray(q.correctAnswerIds) || q.correctAnswerIds.length === 0) fail(`${lang}/${qid}: sin respuesta correcta`);
    const optIds = new Set(q.options.map((o) => o.id));
    for (const cid of q.correctAnswerIds) if (!optIds.has(cid)) fail(`${lang}/${qid}: respuesta ${cid} no existe en opciones`);
    if (q.type === 'multiple' && q.correctAnswerIds.length < 2) fail(`${lang}/${qid}: multiple con una sola respuesta correcta`);
    if (q.type === 'single' && q.correctAnswerIds.length !== 1) fail(`${lang}/${qid}: single con más de una respuesta correcta`);
    for (const o of q.options) {
      if (!q.optionExplanations?.[o.id]) fail(`${lang}/${qid}: falta explicación de la opción ${o.id}`);
    }
    if (!q.explanation) fail(`${lang}/${qid}: falta explanation`);
    if (!q.officialSources?.length) fail(`${lang}/${qid}: sin fuentes oficiales`);
    for (const sv of q.services || []) {
      const card = inScope.services.find((s) => s.id === sv);
      if (!card) warn(`${lang}/${qid}: servicio sin tarjeta: ${sv}`);
      if (card && outNames.has(card.name.toLowerCase())) fail(`${lang}/${qid}: usa servicio FUERA de alcance: ${card.name}`);
    }
    byTask[q.taskStatement] = (byTask[q.taskStatement] || 0) + (q.type === 'truefalse' ? 0 : 1);
  }

  for (const tk of taskIds) {
    const n = byTask[tk] || 0;
    if (n < 2) warn(`[${lang}] Tarea ${tk}: solo ${n} preguntas (mínimo recomendado: 2)`);
  }

  for (const l of lessons) {
    for (const kid of l.knowledgeCheckQuestionIds || []) {
      if (!questions.some((q) => q.id === kid)) fail(`[${lang}] Lección ${l.id}: pregunta inexistente ${kid}`);
    }
    for (const tk of l.taskStatements || []) {
      if (!taskIds.has(tk)) fail(`[${lang}] Lección ${l.id}: task statement inexistente ${tk}`);
    }
    if (!l.explanation || !l.examRelevance || !l.awsExample) fail(`[${lang}] Lección ${l.id}: campos base incompletos`);
  }
}

/* Paridad bilingüe */
if (perLang.es && perLang.en) {
  console.log('Validando paridad es/en…');
  const esQ = new Map(perLang.es.questions.map((q) => [q.id, q]));
  const enQ = new Map(perLang.en.questions.map((q) => [q.id, q]));
  for (const [id, q] of esQ) {
    const e = enQ.get(id);
    if (!e) { fail(`Paridad: pregunta ${id} falta en en`); continue; }
    if (e.correctAnswerIds.join() !== q.correctAnswerIds.join()) fail(`Paridad ${id}: correctAnswerIds difieren`);
    if (e.options.length !== q.options.length) fail(`Paridad ${id}: número de opciones difiere`);
    if (e.type !== q.type || e.difficulty !== q.difficulty || e.domain !== q.domain || e.taskStatement !== q.taskStatement) fail(`Paridad ${id}: metadatos difieren`);
  }
  for (const id of enQ.keys()) if (!esQ.has(id)) fail(`Paridad: pregunta ${id} falta en es`);
  const esL = new Set(perLang.es.lessons.map((l) => l.id));
  const enL = new Set(perLang.en.lessons.map((l) => l.id));
  for (const id of esL) if (!enL.has(id)) fail(`Paridad: lección ${id} falta en en`);
  for (const id of enL) if (!esL.has(id)) fail(`Paridad: lección ${id} falta en es`);
  const esS = new Set(perLang.es.inScope.services.map((s) => s.id));
  const enS = new Set(perLang.en.inScope.services.map((s) => s.id));
  for (const id of esS) if (!enS.has(id)) warn(`Paridad: tarjeta de servicio ${id} falta en en`);
}

console.log('Validando sintaxis de módulos JS…');
const jsDir = join(root, 'js');
const { spawnSync } = await import('node:child_process');
for (const f of readdirSync(jsDir)) {
  if (!f.endsWith('.js')) continue;
  const res = spawnSync(process.execPath, ['--check', join(jsDir, f)], { encoding: 'utf8' });
  if (res.status !== 0) fail(`${f}: ${res.stderr}`);
  else console.log(`  ✓ js/${f}`);
}

console.log(errors === 0 ? '\n✅ Validación completa sin errores.' : `\n❌ ${errors} error(es) encontrados.`);
process.exit(errors === 0 ? 0 : 1);
