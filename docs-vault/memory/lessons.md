# Lessons Learned

_Record important lessons here as they are discovered._

## Lessons
- **Dynamic imports in TypeScript:** When splitting modules, ensure import paths are correct (./ → ../) to avoid build failures.
- **Circular dependencies:** Extract shared utilities (like `generateSku`) to dedicated files to break cycles.
- **N+1 in Prisma:** Always check if `include` and `select` are truly needed. Profile queries before optimizing.
- **Debouncing watch mode:** A 300ms debounce on file watchers prevents cascading regenerations.
