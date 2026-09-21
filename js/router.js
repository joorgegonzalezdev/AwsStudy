/* router.js — enrutador hash minimalista con soporte de parámetros. */

import { t } from './i18n.js';
import { escapeHtml } from './utils.js';

const routes = new Map(); // patrón -> handler(params)
let outlet = null;

export function register(pattern, handler) {
  routes.set(pattern, handler);
}

export function initRouter(outletEl) {
  outlet = outletEl;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function navigate(path) {
  const target = '#' + path;
  if (location.hash === target) handleRoute();
  else location.hash = target;
}

function handleRoute() {
  if (!outlet) return;
  const hash = (location.hash || '#/').replace(/^#/, '') || '/';
  const path = hash.split('?')[0];
  const segments = path.split('/').filter(Boolean);

  for (const [pattern, handler] of routes) {
    const pSegs = pattern.split('/').filter(Boolean);
    if (pattern === '/' && segments.length === 0) {
      render(handler, {});
      return;
    }
    if (pSegs.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < pSegs.length; i++) {
      const p = pSegs[i];
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segments[i]);
      else if (p !== segments[i]) { matched = false; break; }
    }
    if (matched) { render(handler, params); return; }
  }
  outlet.innerHTML = `
    <div class="card">
      <h1>${escapeHtml(t('router.notFound'))}</h1>
      <p class="muted">${escapeHtml(t('router.notFoundDesc', { path }))}</p>
      <a class="btn primary" href="#/">${escapeHtml(t('common.backHome'))}</a>
    </div>`;
}

function render(handler, params) {
  try {
    window.scrollTo(0, 0);
    handler(params);
  } catch (e) {
    console.error('Error al renderizar la ruta:', e);
    outlet.innerHTML = `
      <div class="card">
        <h1>${escapeHtml(t('router.errorTitle'))}</h1>
        <p class="muted">${String(e && e.message ? e.message : e)}</p>
        <a class="btn primary" href="#/">${escapeHtml(t('common.backHome'))}</a>
      </div>`;
  }
}

/* Marca el enlace activo del menú. */
export function setActiveNav(path) {
  document.querySelectorAll('.main-nav a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href === '#' + path || (path !== '/' && href !== '#/' && path.startsWith(href.slice(1) + '/'))) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}
