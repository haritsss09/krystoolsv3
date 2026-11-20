const routes = [];
let notFound = null;
let cleanup = null;
let renderId = 0;
let firstRender = true;
const listeners = new Set();
let guard = null;

/* allow(path) false renders gate instead of the matched route. */
export function setGuard(allow, gate) {
  guard = { allow, gate };
}

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

export function fallback(handler) {
  notFound = handler;
}

export function onChange(fn) {
  listeners.add(fn);
}

export function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(query) };
}

export function navigate(path) {
  if (location.hash === '#' + path) render();
  else location.hash = path;
}

export function setQuery(params) {
  const { path } = currentPath();
  const q = new URLSearchParams(params).toString();
  history.replaceState(null, '', '#' + path + (q ? '?' + q : ''));
}

export async function render() {
  const id = ++renderId;
  const { path, query } = currentPath();
  const main = document.getElementById('main');
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch {}
  }
  cleanup = null;

  let match = null;
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      try { match = { handler: r.handler, params: m.slice(1).map(decodeURIComponent) }; }
      catch { match = null; }
      break;
    }
  }
  const view = document.createElement('div');
  view.className = 'view-enter';
  main.replaceChildren(view);
  window.scrollTo(0, 0);
  if (!firstRender) main.focus({ preventScroll: true });
  firstRender = false;
  for (const fn of listeners) fn(path);
  const blocked = guard && !guard.allow(path);
  const handler = blocked ? guard.gate : match ? match.handler : notFound;
  let result;
  try {
    result = await handler(view, { params: match && !blocked ? match.params : [], query, path });
  } catch (err) {
    console.error(err);
  }
  if (id !== renderId) {
    if (typeof result === 'function') result();
    return;
  }
  cleanup = result;
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
