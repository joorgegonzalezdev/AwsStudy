/* settings.js — preferencias, exportación/importación de progreso y borrado. */

import * as state from './state.js';
import { escapeHtml, downloadJSON, confirmDialog, announce } from './utils.js';

export function renderSettings() {
  const outlet = document.getElementById('outlet');
  const s = state.getSettings();

  outlet.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card">
      <h2>Apariencia</h2>
      <div class="field">
        <label for="set-theme">Tema</label>
        <select id="set-theme">
          <option value="system" ${s.theme === 'system' ? 'selected' : ''}>Sistema (automático)</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Claro</option>
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Oscuro</option>
        </select>
      </div>
      <div class="check-row">
        <input type="checkbox" id="set-motion" ${s.reducedMotion ? 'checked' : ''}>
        <label for="set-motion">Reducir animaciones y movimiento</label>
      </div>
      <div class="field">
        <label for="set-quizsize">Tamaño por defecto del quiz rápido</label>
        <select id="set-quizsize">
          ${[10, 20, 30].map((n) => `<option value="${n}" ${s.defaultQuizSize === n ? 'selected' : ''}>${n} preguntas</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <h2>Tus datos</h2>
      <p class="small muted">Todo tu progreso se guarda <b>solo en este navegador</b> (localStorage). No se envía a ningún servidor. Haz copias de seguridad exportando a JSON.</p>
      <div class="btn-row">
        <button type="button" class="btn primary" id="export-btn">Exportar progreso (JSON)</button>
        <label class="btn" for="import-file">Importar progreso</label>
        <input type="file" id="import-file" accept="application/json,.json" class="sr-only">
      </div>
      <h3 class="mt">Zona de riesgo</h3>
      <button type="button" class="btn danger" id="clear-btn">Borrar todos los datos locales</button>
      <p class="small muted">Se eliminarán progreso, historial, marcadores y notas. Esta acción no se puede deshacer.</p>
    </div>

    <div class="card">
      <h2>Acerca de</h2>
      <p class="small">Ruta CLF-C02 es una herramienta de estudio <b>no oficial</b> para el examen AWS Certified Cloud Practitioner (CLF-C02). No está afiliada a, patrocinada por ni respaldada por Amazon Web Services. "AWS" y los nombres de servicios son marcas de Amazon.com, Inc.</p>
      <p class="small muted">Los porcentajes de la aplicación son estimaciones locales de estudio; el examen oficial usa puntuación escalada.</p>
    </div>`;

  outlet.querySelector('#set-theme').addEventListener('change', (e) => {
    state.updateSettings({ theme: e.target.value });
    state.applyPreferences();
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
    announce('Progreso exportado.');
  });

  outlet.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirmDialog({
      title: 'Importar progreso',
      message: 'Esto reemplazará TODO el progreso actual por el contenido del archivo. ¿Continuar?',
      okText: 'Importar',
      danger: true,
    });
    if (!ok) { e.target.value = ''; return; }
    try {
      const text = await file.text();
      state.importData(text);
      announce('Progreso importado correctamente.');
      renderSettings();
    } catch (err) {
      await confirmDialog({ title: 'Error al importar', message: String(err.message || err), okText: 'Entendido', cancelText: 'Cerrar' });
    }
    e.target.value = '';
  });

  outlet.querySelector('#clear-btn').addEventListener('click', async () => {
    const first = await confirmDialog({
      title: 'Borrar todos los datos',
      message: 'Se eliminarán permanentemente tu progreso, historial, marcadores y notas de este navegador.',
      okText: 'Continuar',
      danger: true,
    });
    if (!first) return;
    const second = await confirmDialog({
      title: '¿Seguro que quieres continuar?',
      message: 'Esta acción es definitiva y no se puede deshacer. Considera exportar una copia antes.',
      okText: 'Sí, borrar todo',
      danger: true,
    });
    if (!second) return;
    state.clearAllData();
    announce('Datos borrados.');
    renderSettings();
  });
}
