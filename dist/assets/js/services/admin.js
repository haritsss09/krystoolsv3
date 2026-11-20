import * as auth from './auth.js';
import * as backend from '../api/backend.js';

let checkedFor = null;
let admin = false;
const listeners = new Set();

export const isAdmin = () => admin;
export const onChange = (fn) => listeners.add(fn);

async function refresh() {
  const user = auth.currentUser();
  const id = user ? user.id : null;
  if (id === checkedFor) return;
  checkedFor = id;
  let next = false;
  if (id) {
    const r = await backend.call('admin', { action: 'whoami' }, { timeout: 10000 });
    next = r.ok && r.data.admin === true;
  }
  if (checkedFor !== id) return;
  if (next !== admin) { admin = next; for (const fn of listeners) fn(admin); }
}

export function start() {
  auth.onChange(refresh);
}

export function call(action, extra = {}) {
  return backend.call('admin', { action, ...extra }, { timeout: 20000, source: { name: 'KrysTools admin' } });
}
