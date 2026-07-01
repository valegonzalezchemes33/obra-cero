---
type: report
tags: [report, weekly]
date: <% tp.date.now("YYYY-MM-DD") %>
week: <% tp.date.now("YYYY-[W]WW") %>
title: "Reporte Semanal - <% tp.date.now("YYYY-[W]WW") %>"
author: "<% tp.system.prompt("Autor del reporte") %>"
status: draft  # draft | review | published
---

# Reporte Semanal - <% tp.date.now("YYYY-[W]WW") %>

## Resumen
<!-- Breve resumen de la semana -->

## Logros
- 

## Pendientes
- 

## Bloqueantes
- 

## Decisiones tomadas
- 

## Próximos pasos
- 

---

```dataview
TABLE date, status, area, author
FROM "memory"
WHERE type = "decision" AND date >= date(<% tp.date.now("YYYY-MM-DD", -7) %>)
SORT date DESC
```
