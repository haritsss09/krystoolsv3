import * as store from '../core/storage.js';

const MAX_RECENT = 30;

/* recent: [{id, at}] newest first. counts: {id: {n, first, last}} */
export function recent() {
  return store.get('recent', []);
}

export function counts() {
  return store.get('counts', {});
}

export function record(id) {
  const now = Date.now();
  const list = recent().filter((r) => r.id !== id);
  list.unshift({ id, at: now });
  store.set('recent', list.slice(0, MAX_RECENT));
  const c = counts();
  const entry = c[id] || { n: 0, first: now };
  entry.n += 1;
  entry.last = now;
  c[id] = entry;
  store.set('counts', c);
}

export function clear() {
  store.remove('recent');
  store.remove('counts');
}

export function since() {
  const c = Object.values(counts());
  return c.length ? Math.min(...c.map((e) => e.first)) : null;
}
