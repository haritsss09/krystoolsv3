import * as store from '../core/storage.js';

const listeners = new Set();

export function list() {
  return store.get('favorites', []);
}

export function has(id) {
  return list().includes(id);
}

export function toggle(id) {
  const favs = list();
  const i = favs.indexOf(id);
  if (i === -1) favs.unshift(id);
  else favs.splice(i, 1);
  store.set('favorites', favs);
  for (const fn of listeners) fn(favs);
  return i === -1;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
