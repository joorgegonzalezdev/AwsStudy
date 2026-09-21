# Ruta CLF-C02 — Especificación del proyecto (Fase 1)

Herramienta **no oficial** de estudio para el examen AWS Certified Cloud Practitioner (CLF-C02).
No está afiliada a, patrocinada por ni respaldada por Amazon Web Services.

## Decisiones tomadas

| Decisión | Valor |
|---|---|
| Nombre | Ruta CLF-C02 |
| Stack | HTML5 + CSS3 + Vanilla JS (ES modules) + JSON + localStorage |
| Backend | Ninguno (estático); path futuro a sync vía `storage.js` |
| Idioma UI/contenido | Español (identificadores en inglés) |
| Alojamiento | GitHub Pages (configuración al final del proyecto) |
| Banco inicial | ~69 preguntas (65 no-truefalse para el simulacro) |
| Lecciones v1 | 15 lecciones núcleo |
| Timer quiz rápido | Solo referencial (no auto-entrega) |
| Simulacro < 65 verificadas | Fallback escalado con aviso visible |
| Git/GitHub | Diferido al final (cuenta personal del usuario) |

## Arquitectura

- Router hash (`#/ruta`) sobre un solo `index.html`.
- Capa de estado única (`state.js`) con persistencia en `storage.js` (versionado, migraciones, backup, export/import).
- Contenido versionado en JSON (inmutable en runtime); progreso del alumno separado del contenido.
- Selección de preguntas: muestreo estratificado por dominio, tope de 2 por subtema, anti-repetición por recencia, orden de opciones congelado por intento.

## Jerarquía de contenido

Dominio (4) → Task statement (19) → Tema → Lección → Conceptos / comparaciones / preguntas.
Tarjetas de servicio como catálogo plano cruzado. Conceptos transversales con "hogar" único.

## Pesos oficiales del examen CLF-C02

- Dominio 1 — Conceptos de la nube: 24%
- Dominio 2 — Seguridad y cumplimiento: 30%
- Dominio 3 — Tecnología y servicios de la nube: 34%
- Dominio 4 — Facturación, precios y soporte: 12%

Distribución del simulacro de 65 preguntas: **16 / 19 / 22 / 8** (aproximada, no garantiza la distribución de un intento oficial).

## Reglas de calidad de preguntas

- Originales, una sola tarea y un objetivo de aprendizaje por pregunta.
- Explican la respuesta correcta Y cada distractor.
- ≥1 fuente oficial de AWS; sin precios exactos volátiles; sin servicios fuera de alcance.
- Opciones con IDs estables (nunca letras como identificador de corrección).
- Estados: draft → technical-review → language-review → verified → retired.
- Solo `verified` entra al simulacro; `truefalse` solo para estudio informal.

## Modelo de datos (resumen)

- **Pregunta**: id, version, status, language, domain, taskStatement, topic, subtopic, services, concepts, difficulty, type, scenarioBased, question, selectionInstruction, options[{id,text}], correctAnswerIds, explanation, optionExplanations, hint, lessonId, officialSources[{title,url,type,accessedAt}], estimatedTimeSeconds, fechas.
- **Lección**: id, status, domainId, taskStatements[], title, summary, explanation, examRelevance, awsExample, keyTerms, commonConfusions, comparisons, knowledgeCheckQuestionIds, relatedServiceIds, estimatedMinutes, sources, lastReviewedAt.
- **Tarjeta de servicio**: id, name, category, scopeStatus, learningLevel (core/supporting/awareness), oneLinePurpose, keyUseCases, examPitfalls, relatedTasks, sources, lastReviewedAt.
- **Progreso (localStorage `ruta-clf-c02:v1`)**: schemaVersion, settings, questionStates (vistos, correctas, fechas de acierto separadas → maestría con 3 aciertos en días distintos), attempts (config, questionOrder, optionOrder congelado, answers, resumen), stats.

## Reglas de puntuación

- 1 punto por pregunta totalmente correcta; sin crédito parcial; sin responder = incorrecta; sin penalización por adivinar.
- Estudio: retroalimentación inmediata; pistas registradas pero no puntuadas; sin aprobar/reprobar.
- Simulacro: auto-entrega al agotar tiempo; resultados = aciertos, %, desglose por dominio/tarea, temas débiles.
- Cualquier porcentaje se presenta como **estimación local de estudio**; el examen oficial usa puntuación escalada (100–1000) que esta app no replica.

## Alcance excluido

`data/services/out-of-scope-services.json` es la lista excluyente configurable. Validada al autorar, al validar y al cargar. Un servicio fuera de alcance nunca es respuesta correcta ni objetivo de memorización.

## Accesibilidad

HTML semántico, operable por teclado, foco visible, etiquetas en controles, estado nunca solo por color, contraste AA, responsive ≥320px, zoom 200%, `prefers-reduced-motion`, anuncios ARIA para retroalimentación.

## Fases

1. Requisitos y arquitectura (este documento) ✅
2. Fundamento de contenido (glosario, tarjetas, lecciones, banco piloto) ✅ (v1)
3. Aplicación básica (shell, estudio, persistencia) ✅ (v1)
4. Evaluación (quiz rápido, simulacro, resultados) ✅ (v1)
5. Aprendizaje (repaso, marcadores, biblioteca, panel) ✅ (v1)
6. QA ✅ (v1)
7. Publicación (Git + GitHub Pages) ⏳ diferido
