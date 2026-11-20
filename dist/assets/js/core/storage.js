const PREFIX = 'kt:';
const writeListeners = new Set();

export function onWrite(fn) {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}

function notify(key) {
  for (const fn of writeListeners) {
    try { fn(key); } catch {}
  }
}

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    notify(key);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    notify(key);
  } catch {}
}

export function keys(prefix = '') {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
    }
  } catch {}
  return out;
}

export function clearAll(prefix = '') {
  for (const k of keys(prefix)) remove(k);
}

export function usage(prefix = '') {
  let bytes = 0;
  for (const k of keys(prefix)) {
    const v = localStorage.getItem(PREFIX + k) || '';
    bytes += (k.length + v.length) * 2;
  }
  return bytes;
}
