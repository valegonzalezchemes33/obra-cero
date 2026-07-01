# Architecture Overview

## Stack
- **Frontend:** Next.js + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Prisma ORM
- **AI Engine:** Groq LLM + Internal Agent System

## Project Stats
- Total modules: 124
- API routes: 36
- Database models: 13
- Agent modules: 26

## Layers
```
┌─────────────────────────────┐
│        Frontend (Pages)     │
├─────────────────────────────┤
│     API Routes (Backend)    │
├─────────────────────────────┤
│   Agent System (Groq + IA)  │
├─────────────────────────────┤
│     Prisma ORM (Database)   │
├─────────────────────────────┤
│     PostgreSQL (Storage)    │
└─────────────────────────────┘
```

## Key Patterns
- CRUD via factory pattern (`src/lib/crud-factory.ts`)
- Caching layer with rate limiting
- Agent-based intent dispatch
- Prisma for all database access
