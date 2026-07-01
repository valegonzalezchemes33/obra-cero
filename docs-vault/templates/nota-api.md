---
type: api
tags: [api, route]
date: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.file.title %>"
method: "GET"     # GET | POST | PATCH | DELETE
endpoint: "/api/example"
auth: true
status: active   # active | deprecated | planned
module: backend
---

# <% tp.file.title %>

## Descripción
<!-- ¿Qué hace este endpoint? -->

## Método
`<% tp.frontmatter.method %>`

## Endpoint
`<% tp.frontmatter.endpoint %>`

## Autenticación
<% tp.frontmatter.auth ? "✅ Requiere autenticación" : "❌ Público" %>

## Request
```json
{
  "example": "value"
}
```

## Response
```json
{
  "success": true,
  "data": {}
}
```

## Errores
| Código | Significado |
|--------|-------------|
| 400 | Bad Request |
| 401 | No autorizado |
| 404 | No encontrado |
| 500 | Error interno |
