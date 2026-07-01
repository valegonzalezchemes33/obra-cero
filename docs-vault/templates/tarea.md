---
type: task
tags: [task]
date: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.file.title %>"
status: pending   # pending | in_progress | completed | cancelled
priority: medium  # low | medium | high | critical
assignee: "<% tp.system.prompt("Asignado a") %>"
due: "<% tp.system.prompt("Fecha de vencimiento (YYYY-MM-DD)") %>"
project: ""
---

# <% tp.file.title %>

## Descripción
<!-- Descripción de la tarea -->

## Criterios de aceptación
- [ ] 

## Notas adicionales
<!-- Cualquier información adicional -->
