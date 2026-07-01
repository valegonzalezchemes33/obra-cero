# PROTOCOLO OBLIGATORIO — Memoria Activa del Proyecto

> **IMPORTANTE:** Este archivo define EL PROTOCOLO que TODO agente debe seguir.
> No comenzar a modificar código sin completar los pasos 1–5.
> No finalizar una tarea sin completar los pasos 7–8.

---

## Identidad del Proyecto

- **Nombre:** ObraCero
- **Stack:** Next.js + Prisma + Groq LLM
- **Versión:** `PROJECT_STATE.json → version`
- **Change ID:** `PROJECT_STATE.json → changeId`
- **Última actualización:** `PROJECT_STATE.json → lastUpdated`

## Protocolo de Trabajo (8 pasos)

Los siguientes pasos son OBLIGATORIOS. No saltarse ninguno.

### FASE 1 — LECTURA (obligatoria antes de escribir código)

```
Paso 1: Leer PROJECT_STATE.json
        └─ Verificar: version, changeId, health
        └─ Si health !== "OK", detenerse y reportar

Paso 2: Verificar VERSION y CHANGE_ID
        └─ Comparar changeId con el registrado localmente
        └─ Si el changeId cambió, la memoria fue actualizada
        └─ Releer architecture/ y knowledge/ relevante

Paso 3: Leer knowledge/ del área a modificar
        └─ project.json     → contexto general
        └─ routes.json       → si tocas APIs
        └─ database.json     → si tocas DB
        └─ agents.json       → si tocas el agente
        └─ modules.json      → si tocas módulos
        └─ dependencies.json → para entender impacto

Paso 4: Leer architecture/ del área a modificar
        └─ overview.md  → siempre
        └─ backend.md   → si tocas APIs
        └─ frontend.md  → si tocas UI
        └─ database.md  → si tocas DB
        └─ agents.md    → si tocas el agente

Paso 5: Leer memory/
        └─ decisions.md  → no repetir errores
        └─ patterns.md   → mantener consistencia
        └─ known-bugs.md → conocer bugs activos
        └─ lessons.md    → aplicar lecciones aprendidas
```

### FASE 2 — ACCIÓN

```
Paso 6: Analizar impacto del cambio
        └─ ¿Qué módulos toca?
        └─ ¿Hay relaciones en dependencies.json afectadas?
        └─ ¿Hay tests que actualizar?
        └─ ¿Hay decisiones previas que contradigan este cambio?

Paso 7: Modificar código
        └─ Escribir el código siguiendo patterns.md
        └─ Mantener consistencia con architecture/
```

### FASE 3 — ACTUALIZACIÓN (obligatoria antes de finalizar)

```
Paso 8: Actualizar la memoria automáticamente
        └─ Ejecutar: npm run docs   (regenera .ai/ completo)
        └─ Si el cambio es relevante, agregar entrada en:
           memory/decisions.md — "YYYY-MM-DD — Qué cambió y por qué"
           memory/known-bugs.md — si se descubrió un bug
           memory/roadmap.md — si aplica
        └─ Verificar que docs/ y .ai/ están sincronizados
        └─ Confirmar: build pasa, tests pasan
```

## Reglas Absolutas

1. **NO** escribir código sin completar Pasos 1–5.
2. **NO** finalizar tarea sin completar Pasos 7–8.
3. **SI** la memoria está desactualizada (changeId distinto), regenerar con `npm run docs`.
4. **SI** se descubre una inconsistencia entre el código y la memoria, corregir la memoria.
5. **CADA** cambio importante se registra en `memory/decisions.md`.
6. **SIEMPRE** verificar build y tests antes de dar por terminada una tarea.

## Estado al 2026-06-30

- Archivos escaneados: 124
- Módulos documentados: model: 13, layout: 1, loading: 1, page: 2, route: 36, agent-module: 26, module: 21, config: 7, mcp: 3, automation: 14, total: 124
- Salud del proyecto: Build OK, Tests OK (86/86)
