/* content-loader.js — carga, valida e indexa el contenido JSON por idioma.
   Todos los idiomas comparten los mismos IDs de pregunta/lección/servicio,
   por lo que el progreso del alumno es independiente del idioma. */

const cache = new Map(); // lang -> content
let activeLang = 'es';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.json();
}

export function getContent() {
  const c = cache.get(activeLang);
  if (!c) throw new Error('El contenido aún no se ha cargado.');
  return c;
}

export function setActiveLanguage(lang) {
  if (cache.has(lang)) activeLang = lang;
}

export function isLoaded(lang = activeLang) {
  return cache.has(lang);
}

export async function loadContent(lang = 'es') {
  if (cache.has(lang)) { activeLang = lang; return cache.get(lang); }
  const manifest = await fetchJSON('data/manifest.json');
  const paths = manifest.content[lang] || manifest.content[manifest.defaultLanguage || 'es'];
  const [domains, lessons, questions, inScope, outOfScope, glossary] = await Promise.all([
    Promise.all(paths.domains.map(fetchJSON)),
    Promise.all(paths.lessons.map(fetchJSON)),
    Promise.all(paths.questions.map(fetchJSON)),
    fetchJSON(paths.inScopeServices),
    fetchJSON(manifest.outOfScopeServices),
    fetchJSON(paths.glossary),
  ]);

  const flatLessons = lessons.flat();
  const flatQuestions = questions.flat();
  const lessonsById = new Map(flatLessons.map((l) => [l.id, l]));
  const questionsById = new Map(flatQuestions.map((q) => [q.id, q]));
  const servicesById = new Map(inScope.services.map((s) => [s.id, s]));
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  const outOfScopeNames = new Set(outOfScope.services.map((s) => s.name.toLowerCase()));
  const tasksById = new Map();
  domains.forEach((d) => d.tasks.forEach((t) => tasksById.set(t.id, { ...t, domainId: d.id })));

  const byDomain = new Map();
  const byTask = new Map();
  const byTopic = new Map();
  const byService = new Map();
  flatQuestions.forEach((q) => {
    pushMap(byDomain, q.domain, q);
    pushMap(byTask, q.taskStatement, q);
    pushMap(byTopic, q.topic, q);
    (q.services || []).forEach((sv) => pushMap(byService, sv, q));
  });

  /* Validaciones en carga (puerta de runtime) */
  flatQuestions.forEach((q) => {
    (q.services || []).forEach((sv) => {
      const svc = servicesById.get(sv);
      if (!svc) {
        console.warn(`[contenido] La pregunta ${q.id} referencia un servicio fuera del catálogo: ${sv}`);
        return;
      }
      if (outOfScopeNames.has(svc.name.toLowerCase())) {
        console.warn(`[contenido] ALCANCE: la pregunta ${q.id} referencia un servicio fuera de alcance (${svc.name}).`);
      }
    });
    if (q.lessonId && !lessonsById.has(q.lessonId)) {
      console.warn(`[contenido] La pregunta ${q.id} apunta a una lección inexistente: ${q.lessonId}`);
    }
  });

  const content = {
    lang,
    manifest,
    domains,
    domainsById,
    tasksById,
    lessons: flatLessons,
    lessonsById,
    questions: flatQuestions,
    questionsById,
    services: inScope.services,
    servicesById,
    outOfScope,
    glossary: glossary.terms || [],
    indexes: { byDomain, byTask, byTopic, byService },
  };
  cache.set(lang, content);
  activeLang = lang;
  return content;
}

function pushMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

/* ---------- Consultas (siempre en el idioma activo) ---------- */

export function getQuestion(id) { return getContent()?.questionsById.get(id) || null; }
export function getLesson(id) { return getContent()?.lessonsById.get(id) || null; }
export function getDomain(id) { return getContent()?.domainsById.get(id) || null; }
export function getTask(id) { return getContent()?.tasksById.get(id) || null; }
export function getService(id) { return getContent()?.servicesById.get(id) || null; }
export function questionsByDomain(domainId) { return getContent()?.indexes.byDomain.get(domainId) || []; }
export function questionsByTask(taskId) { return getContent()?.indexes.byTask.get(taskId) || []; }

export function searchGlossary(query) {
  const q = (query || '').trim().toLowerCase();
  const terms = getContent()?.glossary || [];
  if (!q) return terms;
  return terms.filter((t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q));
}
