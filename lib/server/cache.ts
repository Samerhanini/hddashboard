// Small in-memory cache for read routes (CLAUDE.md: cache briefly to avoid vendor rate limits).
// Each server instance has its own copy; failures are never cached, and concurrent callers share one request.

const DEFAULT_TTL = 5 * 60 * 1000;
const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = DEFAULT_TTL): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then((value) => { store.set(key, { at: Date.now(), value }); return value; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Drop cached entries whose key starts with the prefix (e.g. after a roster write). */
export function bust(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
