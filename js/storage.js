/* storage.js — persistencia en localStorage con versionado, migraciones,
   copia de seguridad, exportación/importación y protección contra corrupción. */

const KEY = 'ruta-clf-c02:v1';
const BACKUP_KEY = KEY + ':backup';
export const SCHEMA_VERSION = 1;

export function defaults() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      theme: 'system',            // 'light' | 'dark' | 'system'
      reducedMotion: false,
      defaultQuizSize: 10,        // 10 | 20 | 30
    },
    session: { currentAttemptId: null },
    questionStates: {},           // qid -> { seenCount, correctCount, incorrectCount, consecutiveCorrect, separateCorrectDates:[], mastery, lastResult, lastAttemptAt, bookmarked, difficult, note, hintUsedCount }
    attempts: {},                 // attemptId -> attempt
    stats: {
      totalTimeSeconds: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      hintUses: 0,
      lastStudiedAt: null,
    },
  };
}

/* Cadena de migraciones: cada entrada transforma el estado de vN a vN+1. */
const migrations = {
  // 1 -> 2: ejemplo futuro: (s) => { s.newField = {}; return s; }
};

function migrate(state) {
  let v = state.schemaVersion ?? 0;
  while (v < SCHEMA_VERSION) {
    const next = v + 1;
    if (typeof migrations[next] === 'function') {
      state = migrations[next](state) ?? state;
    }
    state.schemaVersion = next;
    v = next;
  }
  return state;
}

function sanitize(state) {
  const d = defaults();
  return {
    ...d,
    ...state,
    settings: { ...d.settings, ...(state.settings || {}) },
    session: { ...d.session, ...(state.session || {}) },
    questionStates: state.questionStates && typeof state.questionStates === 'object' ? state.questionStates : {},
    attempts: state.attempts && typeof state.attempts === 'object' ? state.attempts : {},
    stats: { ...d.stats, ...(state.stats || {}) },
  };
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    console.error('localStorage no disponible:', e);
    return defaults();
  }
  if (!raw) return defaults();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('Estado corrupto; intentando copia de seguridad…');
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) parsed = JSON.parse(backup);
    } catch (e2) { /* sin respaldo válido */ }
    if (!parsed) {
      console.warn('Sin respaldo válido: se reinicia el estado (los datos se han perdido).');
      return defaults();
    }
  }
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
    console.warn('Los datos son de una versión más reciente de la app; no se modificarán.');
    return sanitize(parsed);
  }
  return sanitize(migrate(parsed));
}

export function saveState(state) {
  try {
    const current = localStorage.getItem(KEY);
    if (current) localStorage.setItem(BACKUP_KEY, current);
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('No se pudo guardar el estado:', e);
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch (e) {
    console.error('No se pudo limpiar el almacenamiento:', e);
  }
}

/* Importa un estado exportado; valida versión y forma básica. */
export function importState(json) {
  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('El archivo no es JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed) || !parsed.settings) {
    throw new Error('El archivo no parece un respaldo de Ruta CLF-C02.');
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error('El respaldo es de una versión más reciente de la app. Actualiza la aplicación.');
  }
  return sanitize(migrate(parsed));
}
