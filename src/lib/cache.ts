// ============================================================
// CACHÉ EN MEMORIA DEL LADO DEL SERVIDOR
// Almacena temporalmente resultados de consultas costosas
// para evitar recálculos en cada request.
//
// Mejoras implementadas:
//  - LRU eviction con límite de tamaño (MAX_CACHE_SIZE)
//  - Stale-while-revalidate: sirve datos vencidos mientras
//    refresca en background
//  - Métricas de hits/misses/evictions
//  - setInterval con unref() para evitar mantener vivo el proceso
//  - TTL adaptable por tipo de dato (solo en rutas)
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastAccessed: number;
}

const store = new Map<string, CacheEntry<any>>();
const MAX_CACHE_SIZE = 500;

// ─── Métricas ───────────────────────────────────────────────

const metrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  staleHits: 0,
};

// ─── Limpieza periódica cada 60 segundos ────────────────────

if (typeof setInterval !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt) {
        store.delete(key);
      }
    }
  }, 60000);
  // No mantener vivo el proceso solo por el intervalo
  if (typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }
}

// ─── LRU Eviction ───────────────────────────────────────────

function evictIfNeeded(): void {
  if (store.size < MAX_CACHE_SIZE) return;

  // Encontrar la entrada menos recientemente accedida
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of store) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    store.delete(oldestKey);
    metrics.evictions++;
  }
}

// ─── Stale-while-revalidate ─────────────────────────────────

const STALE_RENEWAL_IN_PROGRESS = new Set<string>();

async function staleRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<{ data: T; fromStale: boolean }> {
  // Si ya hay una renovación en curso para esta key, esperar
  if (STALE_RENEWAL_IN_PROGRESS.has(key)) {
    // Esperar a que termine la renovación (polling simple)
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const entry = store.get(key);
      if (entry && Date.now() < entry.expiresAt) {
        return { data: entry.data as T, fromStale: false };
      }
      if (!STALE_RENEWAL_IN_PROGRESS.has(key)) break;
    }
  }

  STALE_RENEWAL_IN_PROGRESS.add(key);
  try {
    const data = await fetcher();
    store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      lastAccessed: Date.now(),
    });
    return { data, fromStale: false };
  } finally {
    STALE_RENEWAL_IN_PROGRESS.delete(key);
  }
}

/**
 * Obtiene un valor del caché. Si no existe o expiró, ejecuta `fetcher`
 * para obtenerlo y lo almacena con el TTL especificado.
 *
 * Con stale-while-revalidate: si el dato expiró hace menos de 2 TTLs,
 * se sirve el dato vencido mientras se refresca en background.
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 30000 // 30 segundos por defecto
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);

  if (existing) {
    existing.lastAccessed = now;

    // Hit: dato vigente
    if (now < existing.expiresAt) {
      metrics.hits++;
      return existing.data as T;
    }

    // Stale hit: dato vencido pero dentro de ventana stale (2x TTL)
    if (now < existing.expiresAt + ttlMs * 2) {
      metrics.staleHits++;
      // Refrescar en background sin esperar
      staleRevalidate(key, fetcher, ttlMs).catch(() => {});
      return existing.data as T;
    }
  }

  // Miss: no existe o muy vencido
  metrics.misses++;
  evictIfNeeded();

  const data = await fetcher();
  store.set(key, {
    data,
    expiresAt: now + ttlMs,
    lastAccessed: now,
  });
  return data;
}

/**
 * Invalida una entrada específica del caché.
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Invalida todas las entradas que coincidan con un prefijo.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Limpia todo el caché.
 */
export function clearAllCache(): void {
  store.clear();
}

/**
 * Devuelve estadísticas del caché.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  const now = Date.now();
  const activeKeys: string[] = [];
  for (const [key, entry] of store) {
    if (now < entry.expiresAt) {
      activeKeys.push(key);
    }
  }
  return { size: activeKeys.length, keys: activeKeys };
}

/**
 * Devuelve métricas de uso del caché.
 */
export function getCacheMetrics() {
  const total = metrics.hits + metrics.misses + metrics.staleHits;
  return {
    ...metrics,
    hitRate: total > 0 ? metrics.hits / total : 0,
    totalRequests: total,
    size: store.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
