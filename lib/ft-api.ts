type CacheEntry = { data: unknown; expires: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 5 * 60 * 1000;
export const TTL = {
  short: 30 * 1000,
  ranking: 5 * 60 * 1000,
  projects: 30 * 60 * 1000,
  longLived: 60 * 60 * 1000,
};

export type FetchOptions = { ttl?: number; force?: boolean };

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
