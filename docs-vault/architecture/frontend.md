# Frontend Architecture

## Pages (4 total)

| Page | Route |
|------|-------|
| Home | `src/app/layout.tsx` |
| Home | `src/app/loading.tsx` |
| login | `src/app/login/page.tsx` |
| Home | `src/app/page.tsx` |

## Stack
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui components
- Server Components by default
- Client Components where interactivity needed

## State Management
- React Server Components for data fetching
- URL search params for filter/shareable state
- No global state library (kept intentionally simple)
