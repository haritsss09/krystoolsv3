import * as store from '../core/storage.js';

const memory = new Map();
const lastHit = new Map();
const inflight = new Map();
const MIN_INTERVAL = 350;

export class ApiError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCache(key) {
  const hit = memory.get(key) || store.get('cache:' + key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memory.delete(key);
    store.remove('cache:' + key);
    return null;
  }
  return hit;
}

function writeCache(key, entry, persist) {
  memory.set(key, entry);
  if (persist) {
    const ok = store.set('cache:' + key, entry);
    if (!ok) {
      store.clearAll('cache:');
      store.set('cache:' + key, entry);
    }
  }
}

async function throttle(host) {
  const last = lastHit.get(host) || 0;
  const wait = last + MIN_INTERVAL - Date.now();
  lastHit.set(host, Math.max(Date.now(), last + MIN_INTERVAL));
  if (wait > 0) await sleep(wait);
}

function describeStatus(status) {
  if (status === 404) return 'Not found at the source.';
  if (status === 429) return 'The source is rate limiting requests. Wait a moment and retry.';
  if (status >= 500) return `The source returned a server error (${status}).`;
  return `The source returned HTTP ${status}.`;
}

/*
  Returns { ok, data, error, source, fetchedAt, fromCache }. Never throws.
  validate(data) must return true or a string describing what is wrong.
*/
export async function request(url, opts = {}) {
  const {
    timeout = 10000,
    cacheTtl = 0,
    persist = cacheTtl >= 60000,
    retries = 1,
    validate,
    source = null,
    as = 'json',
    init = {},
    force = false,
    allowStatus = [],
  } = opts;
  const key = (init.method || 'GET') + ' ' + url + (init.body ? ' ' + init.body : '');

  if (cacheTtl && !force) {
    const hit = readCache(key);
    if (hit) return { ok: true, data: hit.data, source, fetchedAt: hit.at, fromCache: true, status: hit.status };
  }
  if (!init.body && inflight.has(key)) return inflight.get(key).then((r) => ({ ...r }));

  const run = (async () => {
    const host = new URL(url, location.href).host;
    let attempt = 0;
    while (true) {
      await throttle(host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        if (res.status === 429 && attempt < retries) {
          const ra = Number(res.headers.get('retry-after'));
          await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500, 8000));
          attempt++;
          continue;
        }
        if (!res.ok && !allowStatus.includes(res.status)) {
          let detail = '';
          try {
            const body = await res.json();
            detail = body?.error?.message || body?.error || body?.message || body?.title || '';
            if (typeof detail !== 'string') detail = '';
          } catch {}
          if (res.status >= 500 && attempt < retries) {
            attempt++;
            await sleep(800);
            continue;
          }
          return { ok: false, error: new ApiError('http', detail ? `${describeStatus(res.status)} ${detail}` : describeStatus(res.status), { status: res.status }), source };
        }
        let data;
        try {
          data = as === 'text' ? await res.text() : as === 'blob' ? await res.blob() : await res.json();
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          return { ok: false, error: new ApiError('parse', 'The source sent a response that could not be read.'), source };
        }
        if (validate) {
          const v = validate(data, res);
          if (v !== true) {
            return { ok: false, error: new ApiError('invalid', typeof v === 'string' ? v : 'The source sent data in an unexpected format.'), source };
          }
        }
        const at = Date.now();
        if (cacheTtl) writeCache(key, { data, at, expires: at + cacheTtl, status: res.status }, persist && as !== 'blob');
        return { ok: true, data, source, fetchedAt: at, fromCache: false, status: res.status };
      } catch (err) {
        clearTimeout(timer);
        if (attempt < retries) {
          attempt++;
          await sleep(600);
          continue;
        }
        if (err.name === 'AbortError') {
          return { ok: false, error: new ApiError('timeout', `No response within ${Math.round(timeout / 1000)} seconds.`), source };
        }
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        return {
          ok: false,
          error: new ApiError('network', offline ? 'You appear to be offline.' : 'Could not reach the source. It may be down or blocked by your network.'),
          source,
        };
      } finally {
        clearTimeout(timer);
      }
    }
  })();

  if (!init.body) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key));
  }
  return run.then((r) => ({ ...r }));
}

export const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
