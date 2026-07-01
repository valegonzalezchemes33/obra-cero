---
type: report
tags: [report, financial]
date: <% tp.date.now("YYYY-MM-DD") %>
title: "Reporte Financiero - <% tp.date.now("YYYY-MM") %>"
period: "<% tp.date.now("YYYY-MM") %>"
author: ""
status: draft
---

# Reporte Financiero - <% tp.date.now("YYYY-MM") %>

## Resumen de Ingresos y Gastos

| Métrica | Monto |
|---------|-------|
| Ingresos Totales | |
| Gastos Totales | |
| Margen Neto | |

## Gastos por Categoría

| Categoría | Monto | % del Total |
|-----------|-------|-------------|
| Materiales | | |
| Mano de Obra | | |
| Servicios | | |
| Impuestos | | |
| Equipos | | |

## Próximos Vencimientos
- 

## Notas
<!-- Observaciones sobre tendencias o anomalías -->

---

```dataview
TABLE date, amount, category, description
FROM "finances"
WHERE type = "transaction"
SORT date DESC
LIMIT 20
```
