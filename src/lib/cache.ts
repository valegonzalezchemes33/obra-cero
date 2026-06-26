// ============================================================
// CACHÉ EN MEMORIA DEL LADO DEL SERVIDOR
// Almacena temporalmente resultados de consultas costosas
// para evitar recálculos en cada request.
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

// Limpieza periódica cada 60 segundos
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt) {
        store.delete(key);
      }
    }
  }, 60000);
}

/**
 * Obtiene un valor del caché. Si no existe o expiró, ejecuta `fetcher`
 * para obtenerlo y lo almacena con el TTL especificado.
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 30000 // 30 segundos por defecto
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);

  if (existing && now < existing.expiresAt) {
    return existing.data as T;
  }

  const data = await fetcher();
  store.set(key, { data, expiresAt: now + ttlMs });
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
