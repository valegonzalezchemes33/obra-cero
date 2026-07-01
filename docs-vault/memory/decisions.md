# Decision Log

## YYYY-MM-DD — Title
- **Context:** What prompted the decision
- **Decision:** What was decided
- **Alternatives:** What was considered
- **Impact:** What this means for the project

---

*Auto-generated entries:*

## 2026-07-01 — Project Intelligence System
- **Context:** El proyecto necesitaba una capa de memoria compartida para agentes de IA
- **Decision:** Se creó `.ai/` como fuente única de verdad con `knowledge/`, `architecture/`, `memory/`
- **Alternatives:** Documentación tradicional en docs/, wiki externa
- **Impact:** Cualquier agente puede entender el proyecto en segundos leyendo `.ai/ENTRYPOINT.md`

## 2026-07-01 — CRUD Factory
- **Context:** Rutas duplicaban lógica CRUD manualmente
- **Decision:** Se creó `src/lib/crud-factory.ts` con 7 helpers
- **Alternatives:** Clases base, librería externa
- **Impact:** 10 rutas migradas. Nueva ruta CRUD requiere ~10 líneas.

## 2026-07-01 — N+1 Query Fixes
- **Context:** Varias queries cargaban datos innecesarios
- **Decision:** Se aplicaron límites, selects específicos, y se eliminaron includes no usados
- **Alternatives:** Paginación completa con cursor
- **Impact:** Reducción significativa de datos transferidos por query
