/* i18n.js — internacionalización de la interfaz (es/en).
   Diccionarios en data/i18n/ui-{lang}.json; claves con interpolación {var}. */

const LANGS = ['es', 'en'];
const dicts = { es: null, en: null };
let lang = 'es';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  return res.json();
}

export async function initI18n(preferred) {
  [dicts.es, dicts.en] = await Promise.all([
    fetchJSON('data/i18n/ui-es.json'),
    fetchJSON('data/i18n/ui-en.json'),
  ]);
  lang = LANGS.includes(preferred) ? preferred : 'es';
}

export function getLang() {
  return lang;
}

export function isLang(l) {
  return LANGS.includes(l);
}

/* Traduce una clave punteada; cae al español si falta en el idioma activo,
   y a la propia clave si no existe en ninguno. Interpola {vars}. */
export function t(key, vars = {}) {
  const resolve = (d) => key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), d);
  let text = resolve(dicts[lang]);
  if (typeof text !== 'string') text = resolve(dicts.es);
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, v) => (vars[v] !== undefined ? String(vars[v]) : `{${v}}`));
}

/* Aplica traducciones a los elementos estáticos de index.html
   (header, footer, skip-link) y al atributo lang del documento. */
export function applyStaticI18n() {
  document.documentElement.lang = lang;
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
}
