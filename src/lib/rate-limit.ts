const CLEANUP_INTERVAL_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

function createStore() {
  const store = new Map<string, RateLimitEntry>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  };

  setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

  return store;
}

function makeLimiter(opts: { windowMs: number; maxHits: number }) {
  const { windowMs, maxHits } = opts;
  const store = createStore();

  return (key: string): RateLimitResult => {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxHits - 1, resetIn: windowMs };
    }

    if (entry.count >= maxHits) {
      return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true, remaining: maxHits - entry.count, resetIn: entry.resetAt - now };
  };
}

export const webhookRateLimiter = makeLimiter({ windowMs: 60_000, maxHits: 60 });

export const agentRateLimiter = makeLimiter({ windowMs: 60_000, maxHits: 30 });

export const loginRateLimiter = makeLimiter({ windowMs: 60_000, maxHits: 5 });

export const mutationRateLimiter = makeLimiter({ windowMs: 60_000, maxHits: 100 });
