---
tags: [entrypoint, project]
---

# ObraCero 🏗️

Sistema CRM interno con Agente IA para la construcción. Una plataforma web para gestionar proyectos, finanzas, inventario, tareas, proveedores y automatizaciones, potenciada por un asistente conversacional con IA.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui |
| **Backend** | Next.js API Routes (36 endpoints) |
| **Base de datos** | PostgreSQL + Prisma ORM (13 modelos) |
| **Agente IA** | Groq LLM + Sistema de herramientas propio (41 tools) |
| **Autenticación** | NextAuth v4 (credenciales internas) |
| **Hosting** | Vercel (producción) |

---

## Inicio Rápido — Local

### 1. Requisitos

- **Node.js** >= 18
- **npm** (o **bun** si prefieres, algunos scripts lo usan)
- **PostgreSQL** — puedes usar [Supabase](https://supabase.com) (gratuito) o una instancia local

### 2. Clonar e instalar

```bash
git clone <url-del-repo>
cd obra-cero
npm install
```

> `npm install` ejecuta automáticamente `prisma generate` (via `postinstall`).

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

Requeridas mínimas para desarrollo:

```env
DATABASE_URL="postgresql://postgres:tu-password@localhost:5432/obracero"
NEXTAUTH_SECRET="cambiar-en-produccion-openssl-rand-base64-32"
ADMIN_USER="admin"
ADMIN_PASSWORD="cambiar-esta-password"
GROQ_API_KEY="gsk_xxxxxxxxxxxxxx"   # Opcional en dev, recomendado
AUTH_DISABLED=1                       # Solo para desarrollo inicial
```

> ⚠️ `AUTH_DISABLED=1` desactiva la autenticación. **No usar en producción.**

### 4. Inicializar la base de datos

```bash
npm run db:push      # Sincroniza el schema de Prisma con la DB
npm run db:generate  # Genera el cliente Prisma
```

Opcionalmente, puedes cargar datos de prueba:

```bash
curl -X POST http://localhost:3000/api/seed
```

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Comandos principales

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Compila para producción |
| `npm run start` | Inicia servidor de producción |
| `npm run lint` | ESLint |
| `npm test` | Ejecuta tests con Vitest |
| `npm run db:push` | Sincroniza schema Prisma con la DB |
| `npm run db:migrate` | Crea migración Prisma |
| `npm run db:reset` | Resetea la base de datos |
| `npm run docs` | Escanea docs-vault y regenera índices |
| `npm run brain` | Ejecuta el sistema de conocimiento del proyecto |
| `npm run brain:mcp` | MCP server para herramientas externas |

---

## Estructura del Proyecto

```
├── .ai/                  # Memoria compartida del agente IA
├── docs-vault/           # Vault de Obsidian con documentación
│   └── .obsidian/        # Configuración del vault Obsidian
├── prisma/
│   └── schema.prisma     # Schema de base de datos (13 modelos)
├── scripts/              # Scripts de utilidad
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes (36 endpoints)
│   │   └── components/   # Componentes React
│   ├── components/       # Componentes compartidos
│   │   ├── ui/           # shadcn/ui components
│   │   └── views/        # Vistas del dashboard
│   ├── hooks/            # Custom hooks
│   └── lib/              # Lógica compartida
│       ├── agent/        # Módulos del agente IA (8 submódulos)
│       ├── capabilities/ # Capacidades del agente
│       └── ...           # Utilidades (auth, cache, db, etc.)
├── .env.example          # Template de variables de entorno
├── Caddyfile             # Proxy reverso (opcional)
├── next.config.ts        # Configuración de Next.js
├── vercel.json           # Configuración de Vercel
└── package.json
```

> 📓 La documentación y el vault de Obsidian están completamente separados en **`docs-vault/`**.
> Para abrirlo en Obsidian: *"Open folder as vault"* → selecciona `docs-vault/`.

---

## Conceptos Clave

### Agente IA
El sistema incluye un asistente conversacional que entiende lenguaje natural en español. Puede crear proyectos, tareas, movimientos de stock, generar informes, y mucho más. 41 herramientas disponibles organizadas en categorías.

> Si no configuras `GROQ_API_KEY`, el agente funciona en modo reducido con detección de intenciones local.

### Dashboard
La página principal muestra KPIs: presupuesto total, gastos, ingresos, proyectos activos, tareas pendientes, alertas de inventario y más.

### Automatizaciones
El sistema soporta workflows multi-paso con disparadores por schedule, eventos, webhooks, o manuales.

---

## Enlaces útiles

- [Documentación del proyecto](docs-vault/INDEX.md)
- [Arquitectura](docs-vault/architecture/overview.md)
- [Catálogo de herramientas del agente](docs-vault/agents/tools.md)
- [Roadmap](docs-vault/memory/roadmap.md)
- [TODO actual](TODO.md)

