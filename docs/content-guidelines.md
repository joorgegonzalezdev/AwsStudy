# Guía de contenido

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
