# Catálogo de Herramientas — ObraCero Agent

Relacionado: [[architecture/agents]], [[agent-architecture]], [[agents/extending]]

## Total: 41 herramientas

| # | Tool | Intent | Categoría | Riesgo |
|---|---|---|---|---|
| 1 | `create_project` | `action_create_project_direct` | proyectos | moderate |
| 2 | `update_project_progress` | `action_update_project_progress` | proyectos | moderate |
| 3 | `update_project_status` | `action_update_project_status` | proyectos | moderate |
| 4 | `edit_project` | `action_edit_project` | proyectos | moderate |
| 5 | `close_project` | `action_close_project` | proyectos | destructive |
| 6 | `create_task` | `action_create_task` | tareas | moderate |
| 7 | `complete_task` | `action_complete_task` | tareas | moderate |
| 8 | `edit_task` | `action_edit_task` | tareas | moderate |
| 9 | `delete_task` | `action_delete_task` | tareas | destructive |
| 10 | `create_expense` | `action_create_expense` | finanzas | moderate |
| 11 | `create_income` | `action_create_income` | finanzas | moderate |
| 12 | `delete_transaction` | `action_delete_transaction` | finanzas | destructive |
| 13 | `add_materials` | `action_add_materials` | inventario | moderate |
| 14 | `add_stock_movement` | `action_add_stock_movement` | inventario | moderate |
| 15 | `update_stock` | `action_update_stock` | inventario | moderate |
| 16 | `edit_material` | `action_edit_material` | inventario | moderate |
| 17 | `delete_material` | `action_delete_material` | inventario | destructive |
| 18 | `reorder` | `action_reorder` | inventario | moderate |
| 19 | `create_supplier` | `action_create_supplier` | proveedores | moderate |
| 20 | `trigger_workflow` | `action_trigger_workflow` | automatización | moderate |
| 21 | `list_workflows` | `action_list_workflows` | automatización | safe |
| 22 | `list_project_tasks` | `action_list_project_tasks` | consulta | safe |
| 23 | `list_automations` | `config_list_automations` | automatización | safe |
| 24 | `export_data` | `action_export_data` | utilidades | safe |
| 25 | `remember_preference` | `capability_remember_preference` | memoria | moderate |
| 26 | `recall_preference` | `capability_recall_preference` | memoria | safe |
| 27 | `forget_preference` | `capability_forget_preference` | memoria | moderate |
| 28 | `list_preferences` | `capability_list_preferences` | memoria | safe |
| 29 | `schedule_event` | `capability_schedule_event` | calendario | moderate |
| 30 | `list_events` | `capability_list_events` | calendario | safe |
| 31 | `complete_event` | `capability_complete_event` | calendario | moderate |
| 32 | `cancel_event` | `capability_cancel_event` | calendario | moderate |
| 33 | `send_notification` | `capability_send_notification` | notificaciones | moderate |
| 34 | `list_notifications` | `capability_list_notifications` | notificaciones | safe |
| 35 | `resolve_notification` | `capability_resolve_notification` | notificaciones | moderate |
| 36 | `dismiss_all_notifications` | `capability_dismiss_all_notifications` | notificaciones | moderate |
| 37 | `search_projects` | `capability_search_projects` | consulta | safe |
| 38 | `search_clients` | `capability_search_clients` | consulta | safe |
| 39 | `search_budgets` | `capability_search_budgets` | consulta | safe |
| 40 | `list_budget_ranges` | `capability_list_budget_ranges` | consulta | safe |
| 41 | `generate_document` | `capability_generate_document` | documentos | moderate |

---

## Detalle de Capabilities Nuevas (FASE 4-5)

### Memoria (`capability_remember_preference`, etc.)

Guarda, recupera y olvida preferencias del usuario.

```typescript
// remember_preference
rememberPreference({ key: "idioma", value: "es", category: "general" })
// → "✅ Guardado: idioma = 'es' (general)"

// recall_preference
recallPreference({ key: "idioma" })
// → "📌 idioma = 'es' (guardado el 29/06/2026)"

// forget_preference
forgetPreference({ key: "idioma" })
// → "🗑️ Olvidado: idioma fue eliminada de la memoria."

// list_preferences
listAllPreferences()
// → Lista todas las preferencias guardadas
```

**Schemas Zod:**
```typescript
rememberPreference: { key: string, value: any, category: "communication"|"finance"|"project"|"ui"|"general" }
recallPreference: { key: string }
forgetPreference: { key: string }
listPreferences: {}
```

---

### Calendario (`schedule_event`, etc.)

Gestiona eventos y recordatorios vinculados a proyectos.

```typescript
// schedule_event
scheduleEvent({
  title: "Reunión de avance OB-001",
  date: "2026-07-15T14:00",
  duration: 60,
  projectRef: "001",
  reminders: [15, 60],
  priority: "medium"
})
// → "📅 Evento creado: Reunión de avance OB-001..."

// list_events
listEvents({ from: "2026-07-01", to: "2026-07-31", status: "active" })
// → Lista eventos del período

// complete_event
completeEvent({ eventId: "cuid..." })
// → "✅ Evento marcado como completado."

// cancel_event
cancelEvent({ eventId: "cuid..." })
// → "❌ Evento cancelado."
```

**Schemas Zod:**
```typescript
scheduleEvent: { title, date: ISO8601, duration?: 15-480min, projectRef?, reminders?: number[], priority }
listEvents: { from?, to?, projectRef?, status: "active"|"completed"|"cancelled", limit }
completeEvent: { eventId: string }
cancelEvent: { eventId: string }
```

---

### Notificaciones (`send_notification`, etc.)

Envía y gestiona notificaciones internas al usuario.

```typescript
// send_notification
sendNotification({
  title: "Stock bajo: Cemento",
  description: "El material tiene stock 5 / mín 20",
  severity: "warning",
  type: "alert",
  projectRef: "001"
})
// → "🟡 Notificación enviada: Stock bajo: Cemento"

// list_notifications
listNotifications({ unreadOnly: false, severity: "warning", limit: 20 })
// → Lista notificaciones con filtros

// resolve_notification
resolveNotification({ notificationId: "cuid..." })
// → "✅ Notificación resuelta."

// dismiss_all_notifications
dismissAllNotifications()
// → "🗑️ 5 notificación(es) descartada(s)."
```

**Schemas Zod:**
```typescript
sendNotification: { title, description?, severity: "info"|"warning"|"critical", type, projectRef?, link? }
listNotifications: { unreadOnly?: bool, severity?, limit }
resolveNotification: { notificationId: string }
dismissAllNotifications: {}
```

---

### Documentos (`generate_document`)

Genera informes profesionales usando Groq + datos reales del CRM.

```typescript
generateDocument({ type: "project_report", projectRef: "001" })
// → Informe ejecutivo del proyecto con finanzas, tareas y predicciones

generateDocument({ type: "financial_report" })
// → Informe financiero de los últimos 90 días

generateDocument({ type: "inventory_report" })
// → Estado del inventario con alertas de stock bajo

generateDocument({ type: "task_summary", projectRef: "001" })
// → Resumen de tareas del proyecto con priorización

generateDocument({ type: "budget_summary", projectRef: "001" })
// → Desglose presupuestario por categoría

generateDocument({ type: "client_summary", projectRef: "001" })
// → Información del cliente + historial del proyecto

generateDocument({ type: "purchase_plan" })
// → Plan de compras priorizado con proveedores sugeridos

generateDocument({ type: "custom", description: "Informe mensual...", title: "Febrero 2026" })
// → Documento custom con contexto del CRM
```

**Schemas Zod:**
```typescript
generateDocument: {
  type: "project_report"|"budget_summary"|"financial_report"|"task_summary"|
        "inventory_report"|"client_summary"|"purchase_plan"|"custom",
  projectRef?,
  format?: "markdown"|"text",
  title?,
  description?
}
```

**Fallback:** Si Groq no está disponible, `generate_document` para `project_report` devuelve un informe básico sin enriquecimiento de IA.

---

### Búsquedas (`search_projects`, etc.)

```typescript
// search_projects
searchProjects({
  query: "Jose",
  status: "in_progress",
  minBudget: 1_000_000,
  limit: 20
})
// → Lista proyectos filtrados por nombre/cliente/estado/presupuesto

// search_clients
searchClients({ query: "Perez", projectStatus: "in_progress" })
// → Lista clientes agrupados por nombre con sus proyectos

// search_budgets
searchBudgets({ minAmount: 2_000_000, maxAmount: 10_000_000 })
// → Lista proyectos con presupuesto entre $2M y $10M con visualización

// list_budget_ranges
listBudgetRanges()
// → Rangos predefinidos: "Hasta $500K", "$500K-$2M", "$2M-$5M", "$5M-$10M", "+$10M"
```

**Schemas Zod:**
```typescript
searchProjects: { query?, status?, minBudget?, maxBudget?, clientName?, limit }
searchClients: { query?, projectStatus?, limit }
searchBudgets: { minAmount?, maxAmount?, projectStatus?, limit }
listBudgetRanges: {}
```

---

## Niveles de Riesgo

| Nivel | Descripción | Comportamiento |
|---|---|---|
| **safe** | Solo lectura, no modifica datos | Se ejecuta sin confirmación |
| **moderate** | Puede crear o modificar datos | Puede pedir confirmación según contexto |
| **destructive** | Elimina datos permanentemente | Siempre pide confirmación explícita |

---

## Categorías Visualés (ToolBadge)

| Categoría | Color | Icono |
|---|---|---|
| proyectos | azul | Package |
| tareas | verde | CheckCircle2 |
| finanzas | esmeralda | DollarSign |
| inventario | naranja | Package |
| proveedores | púrpura | Package |
| automatización | rosa | Workflow |
| consulta | gris | Search |
| calendario | cian | Calendar |
| notificaciones | amarillo | Bell |
| documentos | índigo | FileText |
| memoria | rosa/rojo | Bookmark |