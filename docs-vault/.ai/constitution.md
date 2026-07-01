# Constitución del Proyecto — ObraCero

> Esta constitución define los principios y reglas que rigen el desarrollo del proyecto.
> Todo agente (IA o humano) debe respetarla. El Brain la utiliza para validar sus respuestas.

---

## Principios Fundamentales

### 1. La memoria es la única fuente de verdad
- `.ai/` contiene la verdad del proyecto, no el código fuente.
- Si el código y la memoria difieren, actualizar la memoria.
- Ningún agente debe inferir arquitectura desde el código sin consultar `.ai/`.

### 2. Todo cambio debe ser trazable
- Cada cambio importante se registra en `memory/decisions.md`.
- Cada cambio incrementa el `changeId` en `PROJECT_STATE.json`.
- Todo cambio debe responder: qué, por qué, y qué impacto tiene.

### 3. No duplicar lógica existente
- Antes de crear algo nuevo, buscar en el Brain si ya existe un patrón similar.
- Reutilizar CRUD factory, tipos compartidos, y utilities existentes.
- Si un patrón se repite 3+ veces, extraerlo a una utility compartida.

### 4. Reutilizar antes de crear
- Preferir composición sobre herencia.
- Preferir CRUD factory sobre rutas manuales.
- Preferir shadcn/ui sobre componentes propios.
- Preferir Prisma queries sobre SQL raw (excepto agregaciones complejas).

### 5. Todo módulo nuevo debe ser documentado automáticamente
- Ejecutar `npm run docs` después de crear o modificar un módulo.
- El sistema de análisis lo indexará automáticamente.
- No crear documentación manual — la memoria se auto-genera.

### 6. Todo agente debe consultar el Brain antes de escribir código
- Ejecutar `brain.ask({ intent: "before-change", target: "..." })` antes de empezar.
- Leer el plan de ejecución generado.
- No saltarse el análisis de impacto.

### 7. Toda feature debe pasar por análisis de impacto
- No implementar una feature sin conocer qué módulos, rutas, DB y agentes afecta.
- Si el riesgo es HIGH, obtener aprobación antes de proceder.

---

## Reglas de Arquitectura

### Base de datos
- Todo modelo Prisma debe tener: `id` (UUID), `createdAt`, `updatedAt`.
- Toda relación debe estar explícitamente definida en el schema.
- No hacer raw SQL fuera de consultas de reporting.
- Cada migración debe tener un nombre descriptivo.

### API
- Toda ruta API debe tener autenticación (excepto health y webhooks explícitos).
- Preferir CRUD factory sobre implementación manual.
- Las rutas deben seguir: `/api/{recurso}/[id]` para detalle, `/api/{recurso}` para colección.
- Las rutas custom (no CRUD) deben llevar el nombre de la acción: `/api/{recurso}/{accion}`.

### UI
- Server Components por defecto, Client Components solo cuando se necesita interactividad.
- Usar shadcn/ui para todos los componentes de UI.
- Los formularios deben usar react-hook-form + zod.

### Agente IA
- Todo intent debe estar registrado en el sistema de intents.
- Todo handler debe ser invocado por el dispatcher.
- Las tools deben ser registradas en el tool registry.
- El agente documental (DocumentAgent) debe manejar OCR y documentos.

### Tests
- Todo nuevo módulo debe tener tests.
- Los tests deben estar junto al módulo: `modulo.test.ts`.
- Coverage mínimo: 70% en lógica de negocio, 50% en UI.
- Ejecutar `npm test` antes de cada commit.

---

## Gobernanza

### Rol del Brain
- Validar que los planes de cambio cumplan con esta constitución.
- Rechazar automáticamente cambios que violen los principios.
- Advertir cuando se detecten patrones duplicados o lógica repetida.

### Proceso de cambio
1. Consultar al Brain con `intent: "before-change"`
2. Revisar el plan generado
3. Implementar siguiendo el plan
4. Ejecutar `npm run docs` para actualizar la memoria
5. Registrar en `memory/decisions.md`
6. Verificar que `npm run build` y `npm test` pasan

### Excepciones
- Si una regla de esta constitución debe ser eximida, registrar en `memory/decisions.md` con justificación.
- Las excepciones deben ser revisadas periódicamente.

---

*Esta constitución es parte de la memoria del proyecto y se actualiza solo cuando es necesario.*
*Última actualización: 2026-06-30*
