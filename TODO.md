# TODO — Mejora del Agente Interno

## Objetivo
Convertir el agente en un orquestador basado en *tool registry* y/o *workflow engine*, para que pueda ejecutar tareas nuevas dentro del sistema con cambios mínimos.

## Pasos
1. Crear catálogo de herramientas (tool registry) con contrato único.
2. Agregar 1er lote de herramientas “core” (p.ej. export_data y update_project_progress) y enrutarlas desde el agente.
3. Unificar confirmación multi-turn para acciones destructivas (reusar un solo mecanismo en agent-memory / agent-extended).
4. Cambiar estrategia de NLU/orquestación: usar planner (Groq) solo si hace falta y luego ejecutar tool(s).
5. Conectar CRUDs restantes como herramientas (crear/editar/eliminar tareas, materiales, transacciones, proveedores, projects).
6. Integrar workflow-engine como backend universal: acciones -> workflow steps.
7. Tests manuales rápidos (mensajes ejemplo) y corrección de schemas/validación.
8. Correr `bun run lint` y `bun run build` (o `npm`) según corresponda.

