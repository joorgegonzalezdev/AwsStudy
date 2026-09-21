# Guía de contenido

## Sistema de aprendizaje (ciclo)
Aprender → Comprobar → Practicar → Repasar errores → Repetir.
La sección "Aprender" (dominio → tarea → lección → comprobación de 3-5 preguntas) es la experiencia principal; los quizzes miden, no enseñan.

## Estados de lección
- `not_started` / `in_progress` (visitada) / `check_pending` (comprobación intentada sin superar) / `completed` (umbral superado, por defecto 80 %) / `needs_review` (fallo posterior a la comprobación o > reviewDays sin repasar) / `mastered` (todas sus preguntas dominadas: 3 aciertos en días distintos).
- Abrir o desplazar una lección NUNCA equivale a completarla ni dominarla.

## Esquema de lección (campos)
Obligatorios: id, status, domainId, taskStatements, title, summary, explanation, examRelevance, awsExample, keyTerms, commonConfusions, comparisons, knowledgeCheckQuestionIds, sources, lastReviewedAt, examGuideVersion.
Recomendados: learningObjective, prerequisites (IDs de lección), examClues (palabras clave de escenario), subtopics.
Los dominios se completan en piloto (Dominio 1) y se extienden progresivamente a los demás.

## Tipos de contenido
1. Lecciones completas · 2. Tarjetas de servicio · 3. Guías de comparación (`data/comparisons/`) · 4. Flashcards (generadas de keyTerms) · 5. Ejercicios de decisión (escenario → servicio) · 6. Explicaciones de errores comunes · 7. Resúmenes de dominio · 8. Glosario buscable.

## Guías de comparación
Cada guía: título, pregunta de decisión, opciones con "úselo cuando…/evítela cuando…", diferencias clave, pista de examen, servicios y lecciones relacionadas. Enfocadas en ELEGIR según escenario, no en memorizar definiciones.

## Idioma
- Todo el contenido existe en español e inglés con IDs compartidos (progreso preservado).
- Paridad bilingüe validada por `npm run validate`.

## Idioma y tono
- Contenido y UI en español claro, para principiantes.
- Nombres de servicios SIEMPRE en inglés (Amazon S3, AWS Lambda) — son nombres propios.
- Tuteo consistente ("elige", "verás").

## Lecciones
Cada lección debe contener:
1. `summary` — resumen en ≤ 60 palabras.
2. `explanation` — explicación en lenguaje llano (2–4 párrafos).
3. `examRelevance` — por qué importa en el examen.
4. `awsExample` — ejemplo práctico con servicios reales.
5. `keyTerms` — 4–6 términos con definición breve.
6. `commonConfusions` — 2–3 confusiones frecuentes y su diferencia.
7. `comparisons` — al menos una tabla comparativa cuando aporte.
8. `knowledgeCheckQuestionIds` — 2–3 preguntas relacionadas.
9. Fuentes oficiales de AWS, `lastReviewedAt` y estado.

## Reglas generales
- Conceptos transversales: la lección vive en UNA tarea; otras se enlazan, no se duplican.
- Prohibido: precios exactos volátiles, cuotas/límites sin fecha ni fuente, servicios fuera de alcance.
- Las comparaciones destacan diferencias relevantes para el examen (p. ej. CloudTrail vs CloudWatch vs Config).
- Servicios Awareness: solo reconocimiento (nombre → propósito general); no lecciones profundas.

## Mantenimiento
- Ciclo de revisión: 6 meses o ante cambio de guía de examen.
- `examGuideVersion` en cada elemento; `retirementReason` al retirar.
- La lista fuera de alcance es configurable en `data/services/out-of-scope-services.json`.
