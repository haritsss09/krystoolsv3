import * as store from '../core/storage.js';
import { toolById } from '../core/registry.js';
import * as auth from './auth.js';

const SYNCED = new Set(['favorites', 'recent']);
const MAX_RECENT = 30;
const PUSH_DELAY = 1200;

let applying = false;
let timer = null;
let lastPull = { id: null, at: 0 };
let state = { status: 'off', at: null, error: null };
const listeners = new Set();

function setState(next) {
  state = { ...state, ...next };
  for (const fn of listeners) {
    try { fn(state); } catch {}
  }
}

export function status() {
  return state;
}

export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function cleanFavorites(v) {
  return Array.isArray(v) ? [...new Set(v.filter((id) => typeof id === 'string' && toolById.has(id)))] : [];
}

function cleanRecent(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((r) => r && typeof r.id === 'string' && toolById.has(r.id) && Number.isFinite(r.at))
    .map((r) => ({ id: r.id, at: r.at }));
}

function mergeRecent(a, b) {
  const byId = new Map();
  for (const r of [...a, ...b]) {
    const prev = byId.get(r.id);
    if (!prev || r.at > prev.at) byId.set(r.id, r);
  }
  return [...byId.values()].sort((x, y) => y.at - x.at).slice(0, MAX_RECENT);
}

function localSnapshot() {
  return {
    favorites: cleanFavorites(store.get('favorites', [])),
    recent: cleanRecent(store.get('recent', [])),
  };
}

async function push() {
  const u = auth.currentUser();
  if (!u) return;
  setState({ status: 'syncing', error: null });
  try {
    const c = await auth.supabaseClient();
    const { error } = await c.from('user_prefs').upsert({ user_id: u.id, ...localSnapshot(), updated_at: new Date().toISOString() });
    if (error) throw error;
    setState({ status: 'synced', at: Date.now() });
  } catch (e) {
    setState({ status: 'error', error: describe(e) });
  }
}

function describe(e) {
  const msg = e?.message || String(e);
  if (/relation .*user_prefs.* does not exist|could not find the table/i.test(msg)) return 'The sync table has not been created on the server yet.';
  if (/failed to fetch|network/i.test(msg)) return 'Offline. Changes will sync when you are back online.';
  return msg;
}

function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(push, PUSH_DELAY);
}

/* Merge rather than overwrite, so signing in on a new device never loses what was pinned locally. */
export async function pullAndMerge() {
  const u = auth.currentUser();
  if (!u) return;
  setState({ status: 'syncing', error: null });
  try {
    const c = await auth.supabaseClient();
    const { data, error } = await c.from('user_prefs').select('favorites, recent').eq('user_id', u.id).maybeSingle();
    if (error) throw error;
    const local = localSnapshot();
    const remote = data ? { favorites: cleanFavorites(data.favorites), recent: cleanRecent(data.recent) } : null;
    const merged = remote ? {
      favorites: [...new Set([...remote.favorites, ...local.favorites])],
      recent: mergeRecent(remote.recent, local.recent),
    } : local;
    applying = true;
    try {
      store.set('favorites', merged.favorites);
      store.set('recent', merged.recent);
    } finally {
      applying = false;
    }
    window.dispatchEvent(new CustomEvent('kt:synced', { detail: merged }));
    await push();
  } catch (e) {
    setState({ status: 'error', error: describe(e) });
  }
}

export async function deleteRemote() {
  const u = auth.currentUser();
  if (!u) return { ok: false, error: 'Not signed in.' };
  try {
    const c = await auth.supabaseClient();
    const { error } = await c.from('user_prefs').delete().eq('user_id', u.id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

export function start() {
  store.onWrite((key) => {
    if (!applying && SYNCED.has(key) && auth.currentUser()) schedulePush();
  });
  auth.onChange((event, u) => {
    if (event === 'SIGNED_OUT' || !u) {
      clearTimeout(timer);
      lastPull = { id: null, at: 0 };
      setState({ status: 'off', at: null, error: null });
    } else if (event === 'SIGNED_IN' || event === 'READY') {
      // Supabase re-emits SIGNED_IN on tab focus; one merge per user per minute is enough.
      const now = Date.now();
      if (lastPull.id === u.id && now - lastPull.at < 60000) return;
      lastPull = { id: u.id, at: now };
      pullAndMerge();
    }
  });
  addEventListener('online', () => { if (auth.currentUser() && state.status === 'error') push(); });
}
