import { describe, it, expect, beforeEach } from "vitest";
import { getCached, invalidateCache, invalidateCachePrefix, clearAllCache, getCacheStats, getCacheMetrics } from "./cache";

describe("cache", () => {
  beforeEach(() => {
    clearAllCache();
  });

  it("returns fetched data on first call", async () => {
    const result = await getCached("key1", () => Promise.resolve("hello"), 1000);
    expect(result).toBe("hello");
  });

  it("returns cached data on second call", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return "data";
    };

    const r1 = await getCached("key2", fn, 1000);
    const r2 = await getCached("key2", fn, 1000);
    expect(r1).toBe("data");
    expect(r2).toBe("data");
    expect(calls).toBe(1);
  });

  it("re-fetches after TTL expires (beyond stale window)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return `call-${calls}`;
    };

    const r1 = await getCached("key3", fn, 10);
    expect(r1).toBe("call-1");

    // Esperar más allá de la ventana stale (2x TTL = 20ms + margen)
    await new Promise((r) => setTimeout(r, 60));

    const r2 = await getCached("key3", fn, 10);
    expect(r2).toBe("call-2");
    expect(calls).toBe(2);
  });

  it("re-fetches after TTL expires but within stale window", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return `call-${calls}`;
    };

    const r1 = await getCached("key-stale", fn, 500);
    expect(r1).toBe("call-1");

    // Esperar a que TTL expire pero dentro de stale window
    await new Promise((r) => setTimeout(r, 600));

    // Debería devolver stale mientras refresca en background
    const r2 = await getCached("key-stale", fn, 500);
    expect(r2).toBe("call-1"); // Stale hit

    // Esperar a que termine el refresh en background (tarda ~0ms, solo incrementa contador)
    await new Promise((r) => setTimeout(r, 100));

    // Ahora debería tener el dato fresco, y el TTL nuevo arrancó desde r2+500
    const r3 = await getCached("key-stale", fn, 500);
    expect(r3).toBe("call-2");
    expect(calls).toBe(2);
  });

  it("invalidateCache removes specific key", async () => {
    await getCached("key4", () => Promise.resolve("val"), 1000);
    invalidateCache("key4");

    let calls = 0;
    const r = await getCached("key4", async () => {
      calls++;
      return "fresh";
    }, 1000);
    expect(r).toBe("fresh");
    expect(calls).toBe(1);
  });

  it("invalidateCachePrefix removes matching keys", async () => {
    await getCached("ctx:abc", () => Promise.resolve(1), 1000);
    await getCached("ctx:def", () => Promise.resolve(2), 1000);
    await getCached("other:xyz", () => Promise.resolve(3), 1000);

    invalidateCachePrefix("ctx:");

    const stats = getCacheStats();
    expect(stats.keys).toEqual(["other:xyz"]);
  });

  it("getCacheStats returns correct count", async () => {
    await getCached("a", () => Promise.resolve(1), 1000);
    await getCached("b", () => Promise.resolve(2), 1000);
    expect(getCacheStats().size).toBe(2);
  });

  it("clearAllCache removes all entries", async () => {
    await getCached("a", () => Promise.resolve(1), 1000);
    await getCached("b", () => Promise.resolve(2), 1000);
    clearAllCache();
    expect(getCacheStats().size).toBe(0);
  });

  it("getCacheMetrics returns usage metrics", async () => {
    await getCached("m1", () => Promise.resolve(1), 1000);
    await getCached("m1", () => Promise.resolve(2), 1000); // hit

    const m = getCacheMetrics();
    expect(m.hits).toBeGreaterThan(0);
    expect(m.misses).toBeGreaterThan(0);
    expect(m.hitRate).toBeGreaterThan(0);
    expect(m.hitRate).toBeLessThanOrEqual(1);
    expect(m.maxSize).toBe(500);
    expect(typeof m.totalRequests).toBe("number");
  });
});
