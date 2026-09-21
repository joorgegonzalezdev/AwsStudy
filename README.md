# Ruta CLF-C02 🧭

Herramienta **no oficial** de estudio en español para el examen **AWS Certified Cloud Practitioner (CLF-C02)**. No está afiliada a, patrocinada por ni respaldada por Amazon Web Services.

## Qué es

Aplicación web 100 % estática y sin backend, **bilingüe (español / inglés)**:

- **Modo estudio** — preguntas una a una con explicación de cada opción, pistas y enlaces a lecciones.
- **Quiz rápido** — 10/20/30 preguntas con cronómetro referencial y resultados por dominio.
- **Simulacro de examen** — 65 preguntas / 90 minutos con distribución aproximada por pesos oficiales (D1 24 %, D2 30 %, D3 34 %, D4 12 %), navegador de preguntas y auto-entrega.
- **Repaso de errores** — con regla de maestría (3 aciertos en días distintos).
- **Biblioteca** — 15 lecciones, catálogo de servicios por nivel de aprendizaje y glosario.
- **Progreso local** — todo se guarda en `localStorage`; exportación/importación JSON incluida.

El idioma se cambia en Ajustes y afecta a la interfaz **y** al contenido. Los IDs de preguntas son compartidos entre idiomas: tu progreso se conserva al cambiar de idioma.

Tecnología: HTML5 + CSS3 + JavaScript (ES modules) + JSON. Sin frameworks, sin backend, sin cuentas.

## Cómo ejecutarla en local

Los módulos ES requieren servir por HTTP (no abrir `index.html` con doble clic):

```powershell
npm run start        # sirve en http://localhost:8080
```

o cualquier servidor estático equivalente (`python -m http.server`).

## Validación y pruebas (desarrollo)

```powershell
npm run validate     # JSON, integridad referencial, alcance, sintaxis JS
node scripts/smoke.mjs  # prueba de humo: selección, simulacro, puntuación
```

## Estructura

```
index.html          shell único
css/                tokens+base, componentes, responsive
js/                 13 módulos ES (router, estado, motor de quiz, modos…)
data/               contenido versionado (dominios, lecciones, preguntas,
                    servicios, glosario) — ver data/manifest.json
docs/               especificación (plan.md) y guías de autoría
scripts/            validación y smoke test (solo desarrollo)
```

## Reglas de contenido

- Solo preguntas `verified` entran al simulacro; los servicios fuera de alcance están excluidos y validados.
- Los porcentajes de la app son **estimaciones locales de estudio**; el examen oficial usa puntuación escalada (100–1000).
- Para añadir contenido, sigue `docs/question-authoring-guide.md` y ejecuta `npm run validate`.

## Publicación

Git/GitHub Pages se configurará al final del proyecto en la cuenta personal del propietario.
