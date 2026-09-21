/* settings.js — preferencias (incl. idioma), exportación/importación y borrado. */

import * as state from './state.js';
import { escapeHtml, downloadJSON, confirmDialog, announce } from './utils.js';
import { t, isLang } from './i18n.js';

export function renderSettings() {
  const outlet = document.getElementById('outlet');
  const s = state.getSettings();

  outlet.innerHTML = `
    <h1>${escapeHtml(t('settings.title'))}</h1>
    <div class="card">
      <h2>${escapeHtml(t('settings.appearance'))}</h2>
      <div class="field">
        <label for="set-theme">${escapeHtml(t('settings.theme'))}</label>
        <select id="set-theme">
          <option value="system" ${s.theme === 'system' ? 'selected' : ''}>${escapeHtml(t('settings.system'))}</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>${escapeHtml(t('settings.light'))}</option>
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>${escapeHtml(t('settings.dark'))}</option>
        </select>
      </div>
      <div class="field">
        <label for="set-language">${escapeHtml(t('settings.language'))}</label>
        <select id="set-language">
          <option value="es" ${s.language === 'es' ? 'selected' : ''}>${escapeHtml(t('settings.langEs'))}</option>
          <option value="en" ${s.language === 'en' ? 'selected' : ''}>${escapeHtml(t('settings.langEn'))}</option>
        </select>
        <p class="hint-text">${escapeHtml(t('common.questions'))}: también cambia el idioma del contenido.</p>
      </div>
      <div class="check-row">
        <input type="checkbox" id="set-motion" ${s.reducedMotion ? 'checked' : ''}>
        <label for="set-motion">${escapeHtml(t('settings.reducedMotion'))}</label>
      </div>
      <div class="field">
        <label for="set-quizsize">${escapeHtml(t('settings.quizSize'))}</label>
        <select id="set-quizsize">
          ${[10, 20, 30].map((n) => `<option value="${n}" ${s.defaultQuizSize === n ? 'selected' : ''}>${escapeHtml(t('settings.nQuestions', { n }))}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <h2>${escapeHtml(t('settings.data'))}</h2>
      <p class="small muted">${escapeHtml(t('settings.dataNotice'))}</p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="export-btn">${escapeHtml(t('settings.export'))}</button>
        <label class="btn" for="import-file">${escapeHtml(t('settings.import'))}</label>
        <input type="file" id="import-file" accept="application/json,.json" class="sr-only">
      </div>
      <h3 class="mt">${escapeHtml(t('settings.dangerZone'))}</h3>
      <button type="button" class="btn danger" id="clear-btn">${escapeHtml(t('settings.clearBtn'))}</button>
      <p class="small muted">${escapeHtml(t('settings.clearWarn'))}</p>
    </div>

    <div class="card">
      <h2>${escapeHtml(t('settings.about'))}</h2>
      <p class="small">${escapeHtml(t('settings.aboutText'))}</p>
      <p class="small muted">${escapeHtml(t('settings.estimates'))}</p>
    </div>`;

  outlet.querySelector('#set-theme').addEventListener('change', (e) => {
    state.updateSettings({ theme: e.target.value });
    state.applyPreferences();
  });

  /* El cambio de idioma recarga la app para cargar el contenido del idioma elegido */
  outlet.querySelector('#set-language').addEventListener('change', (e) => {
    const lang = e.target.value;
    if (!isLang(lang)) return;
    state.updateSettings({ language: lang });
    location.reload();
  });

  outlet.querySelector('#set-motion').addEventListener('change', (e) => {
    state.updateSettings({ reducedMotion: e.target.checked });
    state.applyPreferences();
  });
  outlet.querySelector('#set-quizsize').addEventListener('change', (e) => {
    state.updateSettings({ defaultQuizSize: Number(e.target.value) });
  });

  outlet.querySelector('#export-btn').addEventListener('click', () => {
    downloadJSON(state.exportData(), `ruta-clf-c02-progreso-${new Date().toISOString().slice(0, 10)}.json`);
    announce(t('notify.exported'));
  });

  outlet.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirmDialog({
      title: t('confirm.importTitle'),
      message: t('confirm.importMsg'),
      okText: t('confirm.continue'),
      cancelText: t('common.cancel'),
      danger: true,
    });
    if (!ok) { e.target.value = ''; return; }
    try {
      const text = await file.text();
      state.importData(text);
      announce(t('notify.imported'));
      renderSettings();
    } catch (err) {
      await confirmDialog({
        title: t('settings.errImportTitle'),
        message: String(err.message || err),
        okText: t('confirm.understood'),
        cancelText: t('confirm.close'),
      });
    }
    e.target.value = '';
  });

  outlet.querySelector('#clear-btn').addEventListener('click', async () => {
    const first = await confirmDialog({
      title: t('confirm.clearTitle'),
      message: t('confirm.clearMsg'),
      okText: t('confirm.continue'),
      cancelText: t('common.cancel'),
      danger: true,
    });
    if (!first) return;
    const second = await confirmDialog({
      title: t('confirm.sureTitle'),
      message: t('confirm.sureMsg'),
      okText: t('confirm.clearYes'),
      cancelText: t('common.cancel'),
      danger: true,
    });
    if (!second) return;
    state.clearAllData();
    announce(t('notify.cleared'));
    renderSettings();
  });
}
