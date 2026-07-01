# Code Patterns

## CRUD Factory
- **Location:** `src/lib/crud-factory.ts`
- **Pattern:** Functional helpers (`cachedGet`, `createPost`, etc.) composed per route
- **Usage:** `const GET = cachedGet(prisma.modelName)`
- **Benefit:** New CRUD route in ~10 lines

## Caching
- **Location:** `src/lib/cache.ts`
- **Pattern:** In-memory TTL cache with stale-while-revalidate
- **Usage:** Wrap expensive operations that don't need real-time freshness

## Rate Limiting
- **Location:** `src/lib/rate-limit.ts`
- **Pattern:** Token bucket per IP
- **Usage:** Protect API routes from abuse

## Agent Dispatch
- **Location:** `src/lib/agent/`
- **Pattern:** Intent → Handler → Tool chain
- **Flow:** User message → intent detection → handler selection → tool execution → response

## Database Access
- **Pattern:** Singleton Prisma client via `prisma.ts`
- **Pattern:** All queries go through Prisma (no raw SQL except complex aggregations)

## Common Abstractions Across Modules

