type CacheEntry = { data: unknown; expires: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
// Per-token queue ensuring max ~1.8 req/s, safely under the 42 API 2 req/s spam limit
const tokenQueues = new Map<string, Promise<void>>();
const RATE_LIMIT_MS = 550;

const DEFAULT_TTL = 5 * 60 * 1000;
export const TTL = {
  short: 30 * 1000,
  ranking: 5 * 60 * 1000,
  projects: 30 * 60 * 1000,
  longLived: 60 * 60 * 1000,
};

export type FetchOptions = { ttl?: number; force?: boolean };

// Returns a promise that resolves when this slot's turn arrives.
// Each call chains a RATE_LIMIT_MS delay for the next caller.
function acquireSlot(token: string): Promise<void> {
  const prev = tokenQueues.get(token) ?? Promise.resolve();
  tokenQueues.set(
    token,
    prev.then(() => new Promise<void>((r) => setTimeout(r, RATE_LIMIT_MS))),
  );
  return prev;
}

export async function ftFetch<T = unknown>(
  path: string,
  accessToken: string,
  options: FetchOptions = {},
): Promise<T> {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const key = path;
  const now = Date.now();

  if (!options.force) {
    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.data as T;
  }

  const flying = inflight.get(key);
  if (flying) return flying as Promise<T>;

  const promise = (async () => {
    await acquireSlot(accessToken);
    try {
      const res = await fetch(`https://api.intra.42.fr${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        const stale = cache.get(key);
        if (stale) {
          return stale.data as T;
        }
        throw new Error(
          `42 API ${res.status} ${path} — ${body.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as T;
      cache.set(key, { data, expires: Date.now() + ttl });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise as Promise<T>;
}

export function cacheStats() {
  let live = 0;
  const now = Date.now();
  for (const entry of cache.values()) {
    if (entry.expires > now) live++;
  }
  return { total: cache.size, live, inflight: inflight.size };
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
