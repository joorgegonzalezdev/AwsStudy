# Guía de autoría de preguntas

## Checklist obligatoria (antes de marcar `verified`)

- [ ] Original; no copia ni reconstruye preguntas reales del examen.
- [ ] Mapea a EXACTAMENTE un dominio y task statement (`domain`, `taskStatement`).
- [ ] Prueba UN objetivo de aprendizaje identificable.
- [ ] Terminología AWS precisa (nombres de servicio en inglés).
- [ ] La respuesta correcta es claramente defendible.
- [ ] Distractores plausibles (mismo dominio/categoría, errores comunes reales).
- [ ] `explanation` justifica la respuesta correcta.
- [ ] `optionExplanations` cubre TODAS las opciones (por qué sí / por qué no).
- [ ] ≥1 `officialSources` con URL real de AWS.
- [ ] Sin precios exactos, cuotas ni límites volátiles.
- [ ] Sin servicios de `out-of-scope-services.json`.
- [ ] Sin trampas de redacción (doble negación, "todas las anteriores", etc.).
- [ ] Escenarios conceptuales > memorización de siglas.
- [ ] `hint` opcional, orientador, sin revelar la respuesta.
- [ ] `lessonId` válido y existente.

## Reglas estructurales

- Tipos: `single`, `multiple` (indica cuántas: "Elige DOS respuestas."), `truefalse` (solo estudio informal; excluido del simulacro).
- Opciones con `id` estable (`o1`…`o6`); NUNCA usar letras como identificador de corrección (las opciones se barajan).
- `correctAnswerIds` es un array; para `multiple` debe coincidir el conjunto completo.
- Dificultad: `basic` | `intermediate` | `challenging`.
- Mezcla objetivo: ≥50% basadas en escenario, 45/35/20 básico/intermedio/desafiante.
- Máximo 2 preguntas por subtema en un mismo quiz (el motor lo aplica).

## Flujo de estados

`draft → technical-review → language-review → verified → retired`

- Solo `verified` aparece en quiz rápido y simulacro.
- `retired` requiere `retirementReason`; su historial de aprendizaje se conserva.
- En modo de autoría individual: la validación automática + relectura diferida sustituyen la doble revisión humana.

## Detección de similitud

- Normalizar texto (minúsculas, sin signos), comparar por solapamiento de frases y patrón (mismo concepto + mismas opciones reordenadas).
- Preguntas similares se marcan manualmente con `similarTo` para adjudicación humana.
