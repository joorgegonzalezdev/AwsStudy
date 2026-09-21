/* content-loader.js — carga, valida e indexa todo el contenido JSON. */

let content = null;
let loadPromise = null;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.json();
}

export function getContent() {
  if (!content) throw new Error('El contenido aún no se ha cargado.');
  return content;
}

export function isLoaded() {
  return !!content;
}

export async function loadContent() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const manifest = await fetchJSON('data/manifest.json');
    const [domains, lessons, questions, inScope, outOfScope, glossary] = await Promise.all([
      Promise.all(manifest.domains.map(fetchJSON)),
      Promise.all(manifest.lessons.map(fetchJSON)),
      Promise.all(manifest.questions.map(fetchJSON)),
      fetchJSON(manifest.services.inScope),
      fetchJSON(manifest.services.outOfScope),
      fetchJSON(manifest.glossary),
    ]);

    const flatLessons = lessons.flat();
    const flatQuestions = questions.flat();
    const lessonsById = new Map(flatLessons.map((l) => [l.id, l]));
    const questionsById = new Map(flatQuestions.map((q) => [q.id, q]));
    const servicesById = new Map(inScope.services.map((s) => [s.id, s]));
    const domainsById = new Map(domains.map((d) => [d.id, d]));
    const outOfScopeNames = new Set(outOfScope.services.map((s) => s.name.toLowerCase()));
    const outOfScopeIds = new Set(
      outOfScope.services
        .map((s) => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    );
    const tasksById = new Map();
    domains.forEach((d) => d.tasks.forEach((t) => tasksById.set(t.id, { ...t, domainId: d.id })));

    /* Índices */
    const byDomain = new Map();   // domainId -> [question]
    const byTask = new Map();     // taskId -> [question]
    const byTopic = new Map();    // topic -> [question]
    const byService = new Map();  // serviceId -> [question]
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
        const nameLower = svc.name.toLowerCase();
        if (outOfScopeNames.has(nameLower) || outOfScopeIds.has(svc.id)) {
          console.warn(`[contenido] ALCANCE: la pregunta ${q.id} referencia un servicio fuera de alcance (${svc.name}). No debería estar verificada.`);
        }
      });
      if (q.lessonId && !lessonsById.has(q.lessonId)) {
        console.warn(`[contenido] La pregunta ${q.id} apunta a una lección inexistente: ${q.lessonId}`);
      }
    });

    content = {
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
    return content;
  })();
  return loadPromise;
}

function pushMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

/* ---------- Consultas ---------- */

export function getQuestion(id) {
  return content?.questionsById.get(id) || null;
}

export function getLesson(id) {
  return content?.lessonsById.get(id) || null;
}

export function getDomain(id) {
  return content?.domainsById.get(id) || null;
}

export function getTask(id) {
  return content?.tasksById.get(id) || null;
}

export function getService(id) {
  return content?.servicesById.get(id) || null;
}

export function questionsByDomain(domainId) {
  return content?.indexes.byDomain.get(domainId) || [];
}

export function questionsByTask(taskId) {
  return content?.indexes.byTask.get(taskId) || [];
}

export function searchGlossary(query) {
  const q = (query || '').trim().toLowerCase();
  const terms = content?.glossary || [];
  if (!q) return terms;
  return terms.filter(
    (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
  );
}

/* Nivel de aprendizaje de un servicio (core/supporting/awareness) por nombre. */
export function serviceLevelByName(name) {
  const svc = [...(content?.services || [])].find((s) => s.name.toLowerCase() === String(name).toLowerCase());
  return svc?.learningLevel || null;
}
