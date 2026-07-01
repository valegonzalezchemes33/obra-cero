---
type: decision
tags: [decision, architecture]
date: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.file.title %>"
status: proposed  # proposed | accepted | deprecated | superseded
area: backend     # backend | frontend | database | agents | ui | devops
author: "<% tp.system.prompt("¿Quién tomó esta decisión?") %>"
---

# <% tp.file.title %>

## Contexto
<!-- ¿Qué problema motivó esta decisión? ¿Qué alternativas se consideraron? -->

## Decisión
<!-- ¿Qué se decidió? -->

## Consecuencias
<!-- ¿Qué impacto tiene esta decisión en el proyecto? -->

## Alternativas descartadas
<!-- ¿Qué otras opciones se consideraron y por qué se descartaron? -->

## Archivos afectados
<!-- `path/to/file.ts`, `path/to/other.ts` -->

---

```dataview
TABLE date, status, area, author
FROM "memory"
WHERE type = "decision"
SORT date DESC
LIMIT 10
```
