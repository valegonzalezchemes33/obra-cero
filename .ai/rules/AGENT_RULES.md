# Reglas Obligatorias para Agentes de IA

> Estas reglas son de cumplimiento obligatorio para cualquier agente
> que interactúe con el código de ObraCero.

---

## Regla 1: Single Source of Truth

La carpeta `.ai/` es la **única fuente de verdad** para entender el proyecto.
No inferir arquitectura, estructura o decisiones desde el código fuente.
Leer `.ai/` primero.

## Regla 2: Protocolo de 8 Pasos

TODO agente debe seguir el protocolo definido en `.ai/ENTRYPOINT.md`:

1. Leer PROJECT_STATE.json
2. Verificar VERSION y CHANGE_ID
3. Leer knowledge/ del área a modificar
4. Leer architecture/ del área a modificar
5. Leer memory/ (decisions, patterns, bugs, lessons)
6. Analizar impacto del cambio
7. Modificar código
8. Actualizar memoria automáticamente

## Regla 3: Detección de Staleness

- Antes de cada tarea, comparar el `changeId` de PROJECT_STATE.json
  con el que el agente tiene registrado localmente.
- Si `changeId` cambió: la memoria fue actualizada por otro agente.
  Releer architecture/ y knowledge/ relevante antes de actuar.
- Si el código fuente no coincide con la memoria: ejecutar `npm run docs`
  para regenerar y luego verificar que coincidan.

## Regla 4: Actualización Obligatoria

Después de cualquier cambio relevante:

1. Ejecutar `npm run docs` para regenerar `.ai/` completo.
2. Si el cambio es importante, agregar entrada en `memory/decisions.md`
   con formato: `YYYY-MM-DD — Título` y secciones Context/Decision/Impact.
3. Si se descubrió un bug, agregarlo a `memory/known-bugs.md`.
4. Si se completó un hito, actualizar `memory/roadmap.md`.
5. Verificar que `npm run build` y `npm test` pasan.

## Regla 5: Consistencia

- Seguir los patrones definidos en `memory/patterns.md`.
- No introducir nuevos patrones sin registrarlos en `memory/patterns.md`.
- No cambiar la arquitectura sin actualizar `architecture/`.
- No eliminar archivos de `.ai/` sin entender el impacto.

## Regla 6: Trazabilidad

Cada cambio importante debe poder rastrearse a:
- Una entrada en `memory/decisions.md` (el por qué)
- Un cambio en `knowledge/` o `architecture/` (el qué)
- Un cambioId incrementado en `PROJECT_STATE.json` (el cuándo)

## Regla 7: Prioridad de la Memoria

Si hay conflicto entre el código fuente y la memoria:
1. La memoria es la fuente de verdad del diseño INTENCIONADO.
2. El código es la fuente de verdad de la implementación REAL.
3. Si difieren, actualizar la memoria para reflejar el código real,
   o actualizar el código para cumplir con la memoria.
4. En caso de duda, ejecutar `npm run docs` y verificar.
