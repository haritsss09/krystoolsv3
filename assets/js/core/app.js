import { h, clear } from './dom.js';
import { CATEGORIES, toolsIn, toolById } from './registry.js';
import { search } from './search.js';
import * as router from './router.js';
import * as store from './storage.js';
import * as favorites from '../services/favorites.js';
import * as notifications from '../services/notifications.js';
import * as auth from '../services/auth.js';
import * as sync from '../services/sync.js';
import { homePage } from '../pages/home.js';
import { explorePage, categoriesPage, categoryPage } from '../pages/explore.js';
import { favoritesPage, recentPage } from '../pages/collections.js';
import { dashboardPage } from '../pages/dashboard.js';
import { settingsPage } from '../pages/settings.js';
import { accountPage } from '../pages/account.js';
import { adminPage } from '../pages/admin.js';
import * as adminSvc from '../services/admin.js';
import { toolPage } from '../pages/tool.js';
import { notFoundPage } from '../pages/not-found.js';

const NAV = [
  ['/', 'Home', 'home'],
  ['/explore', 'Explore tools', 'grid'],
  ['/categories', 'Categories', 'layers'],
  ['/favorites', 'Favorites', 'star', () => favorites.list().filter((id) => toolById.has(id)).length],
  ['/recent', 'Recent tools', 'clock'],
  ['/dashboard', 'Dashboard', 'chart'],
  ['/settings', 'Settings', 'sliders'],
  ['/account', 'Account', 'user'],
];
const ADMIN_NAV = ['/admin', 'Admin', 'shield'];

const NAV_ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><path d="M13.5 16.75h6.5M16.75 13.5V20"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z"/><path d="M12 9v4M12 15.5h.01"/>',
  sliders: '<path d="M5 7h9M18 7h1M5 17h3M12 17h7"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  developer: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/>',
  security: '<path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  networking: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.3 2.2 3.4 4.9 3.4 8S14.3 17.8 12 20c-2.3-2.2-3.4-4.9-3.4-8S9.7 6.2 12 4z"/>',
  productivity: '<path d="M5 6h14M5 10.5h14M5 15h9M5 19.5h6"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/>',
  information: '<path d="M4 18.5c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-9 6-13"/><path d="M4 21h16"/>',
  ai: '<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 7V4.5M9.5 12h.01M14.5 12h.01M9.5 15h5"/>',
  games: '<rect x="3.5" y="8" width="17" height="9.5" rx="3.5"/><path d="M8 11v3.5M6.25 12.75h3.5M15 12h.01M17 14h.01"/>',
};

function navIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'nav__icon');
  svg.innerHTML = NAV_ICONS[name] || '';
  return svg;
}

function navLink(href, label, iconName, count, extraClass = '') {
  return h('a', { class: 'nav__link ' + extraClass, href: '#' + href, dataset: { path: href, tip: label } },
    iconName ? navIcon(iconName) : h('span', { class: 'nav__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'nav__text', text: label }),
    count != null ? h('span', { class: 'nav__count', text: String(count) }) : null);
}

function buildNav() {
  const nav = document.getElementById('nav');
  const pinned = favorites.list().map((id) => toolById.get(id)).filter(Boolean).slice(0, 5);
  const pinnedIds = new Set(pinned.map((t) => t.id));
  const recent = store.get('recent', []).map((r) => toolById.get(r.id)).filter((t) => t && !pinnedIds.has(t.id)).slice(0, 4);
  const quick = (label, tools) => tools.length ? h('div', { class: 'nav__group nav__group--quick' },
    h('span', { class: 'nav__label', text: label }),
    tools.map((t) => navLink('/tool/' + t.id, t.name, null, null, 'nav__link--tool'))) : null;
  clear(nav).append(...[
    h('div', { class: 'nav__group' }, [...NAV, ...(adminSvc.isAdmin() ? [ADMIN_NAV] : [])].map(([href, label, ic, count]) => navLink(href, label, ic, count ? count() || null : null))),
    h('div', { class: 'nav__group' },
      h('span', { class: 'nav__label', text: 'Categories' }),
      CATEGORIES.map((c) => navLink('/category/' + c.id, c.name, c.id, toolsIn(c.id).length))),
    quick('Pinned', pinned),
    quick('Recently opened', recent),
  ].filter(Boolean));
  markCurrent(router.currentPath().path);
}

function markCurrent(path) {
  const m = path.match(/^\/tool\/(.+)$/);
  const tool = m && toolById.get(m[1]);
  const toolCat = tool ? '/category/' + tool.category : null;
  for (const a of document.querySelectorAll('.nav__link')) {
    const p = a.dataset.path;
    if (p === path || p === toolCat) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  renderCrumb(path, tool);
}

const PAGE_NAMES = { '/explore': 'Explore tools', '/categories': 'Categories', '/favorites': 'Favorites', '/recent': 'Recent tools', '/dashboard': 'Dashboard', '/settings': 'Settings', '/account': 'Account', '/admin': 'Admin' };

function renderCrumb(path, tool) {
  const el = document.getElementById('crumb');
  const parts = [];
  if (tool) {
    const cat = CATEGORIES.find((c) => c.id === tool.category);
    parts.push(h('a', { href: '#/category/' + cat.id, text: cat.name }), h('span', { 'aria-current': 'page', text: tool.name }));
  } else if (path.startsWith('/category/')) {
    const cat = CATEGORIES.find((c) => '/category/' + c.id === path);
    parts.push(h('a', { href: '#/categories', text: 'Categories' }), h('span', { 'aria-current': 'page', text: cat ? cat.name : 'Category' }));
  } else if (PAGE_NAMES[path]) {
    parts.push(h('span', { 'aria-current': 'page', text: PAGE_NAMES[path] }));
  }
  el.replaceChildren(...parts);
  el.hidden = !parts.length;
}

/* Desktop sidebar collapses to an icon rail; the choice persists on this device. */
function setupCollapse() {
  const app = document.getElementById('app');
  const btn = document.getElementById('collapse-btn');
  const apply = (collapsed) => {
    app.dataset.rail = collapsed ? 'true' : 'false';
    btn.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('aria-label', label);
    btn.title = label + ' ([)';
  };
  apply(store.get('rail', false));
  const toggle = () => {
    const next = app.dataset.rail !== 'true';
    store.set('rail', next);
    apply(next);
  };
  btn.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === '[' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !matchMedia('(max-width: 900px)').matches) toggle();
  });
}

function renderAccountFoot() {
  const el = document.getElementById('account-foot');
  if (!el) return;
  const u = auth.currentUser();
  el.textContent = u ? `Signed in as ${u.email || 'you'}. Pins and recent tools sync.` : 'Pins and recent tools stay on this device. Sign in to sync them.';
}

function setupScrollState() {
  const bar = document.getElementById('topbar');
  const progress = document.getElementById('scroll-progress');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.dataset.scrolled = String(scrollY > 4);
    progress.style.transform = `scaleX(${max > 240 ? Math.min(scrollY / max, 1) : 0})`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('hashchange', () => setTimeout(update, 50));
  update();
}

/* Mobile sidebar */
function setupMenu() {
  const btn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const mq = matchMedia('(max-width: 900px)');
  const open = () => {
    sidebar.dataset.open = 'true';
    scrim.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close navigation');
    (sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('a')).focus();
  };
  const close = (returnFocus = true) => {
    if (sidebar.dataset.open !== 'true') return;
    sidebar.dataset.open = 'false';
    scrim.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open navigation');
    if (returnFocus) btn.focus();
  };
  btn.addEventListener('click', () => (sidebar.dataset.open === 'true' ? close() : open()));
  scrim.addEventListener('click', () => close());
  sidebar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mq.matches) close();
    if (e.key === 'Tab' && mq.matches && sidebar.dataset.open === 'true') {
      const items = [...sidebar.querySelectorAll('a[href]')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a') && mq.matches) close(false);
  });
  mq.addEventListener('change', () => close(false));
}

/* Command palette */
function setupPalette() {
  const dialog = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  let results = [];
  let active = 0;

  const renderList = () => {
    const q = input.value;
    const groups = q.trim() ? [[null, search(q).slice(0, 12)]] : defaultGroups();
    results = groups.flatMap(([, tools]) => tools);
    active = Math.min(active, Math.max(results.length - 1, 0));
    clear(list);
    if (!results.length) {
      list.append(h('li', { class: 'palette__empty', role: 'presentation' },
        h('strong', { text: `No tools match "${q}"` }),
        h('span', { text: 'Try a format (csv, jwt), a task (compress, validate) or a source (bmkg).' })));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let i = 0;
    for (const [label, tools] of groups) {
      if (!tools.length) continue;
      if (label) list.append(h('li', { class: 'palette__group', role: 'presentation', text: label }));
      for (const tool of tools) {
        const idx = i++;
        const cat = CATEGORIES.find((c) => c.id === tool.category);
        list.append(h('li', {
          class: 'palette__item', role: 'option', id: 'pal-' + tool.id, 'aria-selected': String(idx === active),
          onclick: () => go(tool), onmousemove: () => { if (active !== idx) { active = idx; sync(); } },
        },
          h('span', { class: 'palette__cat' }, navIcon(tool.category)),
          h('span', { class: 'palette__main' }, h('span', { class: 'palette__name', text: tool.name }), h('small', { text: tool.description })),
          h('span', { class: 'palette__side' }, h('span', { class: 'sig', text: tool.signature.join(' → ') }), h('span', { class: 'palette__catname', text: cat ? cat.name : '' }))));
      }
    }
    sync();
  };
  const sync = () => {
    const items = [...list.querySelectorAll('.palette__item')];
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const cur = items[active];
    if (cur) {
      input.setAttribute('aria-activedescendant', cur.id);
      cur.scrollIntoView({ block: 'nearest' });
    }
  };
  const go = (tool) => {
    dialog.close();
    router.navigate('/tool/' + tool.id);
  };
  input.addEventListener('input', () => {
    active = 0;
    renderList();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(results.length, 1);
      sync();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + results.length) % Math.max(results.length, 1);
      sync();
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  let opener = null;
  dialog.addEventListener('close', () => {
    if (opener && document.contains(opener) && !location.hash.startsWith('#/tool/')) opener.focus();
  });

  const openPalette = (initial = '') => {
    if (dialog.open || !auth.currentUser() || auth.isRecoveryRequired()) return;
    opener = document.activeElement;
    input.value = initial;
    active = 0;
    renderList();
    dialog.showModal();
    input.focus();
  };
  document.getElementById('search-trigger').addEventListener('click', () => openPalette());
  document.getElementById('side-search').addEventListener('click', () => openPalette());
  document.getElementById('palette-close').addEventListener('click', () => dialog.close());
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openPalette();
    } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openPalette();
    }
  });
  window.ktOpenPalette = openPalette;
}

function defaultGroups() {
  const recent = store.get('recent', []).map((r) => toolById.get(r.id)).filter(Boolean).slice(0, 5);
  const seen = new Set(recent.map((t) => t.id));
  const featured = [...toolById.values()].filter((t) => t.featured && !seen.has(t.id)).slice(0, 12 - recent.length);
  return [['Recently opened', recent], ['Featured', featured]];
}

function setupRoutes() {
  router.route(/^\/$/, homePage);
  router.route(/^\/explore$/, explorePage);
  router.route(/^\/categories$/, categoriesPage);
  router.route(/^\/category\/([\w-]+)$/, categoryPage);
  router.route(/^\/favorites$/, favoritesPage);
  router.route(/^\/recent$/, recentPage);
  router.route(/^\/dashboard$/, dashboardPage);
  router.route(/^\/settings$/, settingsPage);
  router.route(/^\/account$/, accountPage);
  router.route(/^\/admin$/, adminPage);
  router.route(/^\/tool\/([\w-]+)$/, toolPage);
  router.fallback(notFoundPage);
  router.setGuard((path) => {
    if (auth.isRecoveryRequired() && path !== '/account') {
      router.navigate('/account?recovery=1');
      return false;
    }
    return path === '/account' || Boolean(auth.currentUser());
  }, accountPage);
  router.onChange(() => buildNav());
}

function applyAuthState() {
  const signedIn = Boolean(auth.currentUser()) && !auth.isRecoveryRequired();
  document.getElementById('app').dataset.auth = !auth.isReady() ? 'pending' : signedIn ? 'in' : 'out';
  return signedIn;
}

buildNav();
favorites.onChange(buildNav);
setupMenu();
setupCollapse();
setupScrollState();
setupPalette();
setupRoutes();
router.start();
notifications.resume();
addEventListener('kt:synced', () => { buildNav(); });
auth.onChange(renderAccountFoot);
renderAccountFoot();
applyAuthState();
let wasSignedIn = null;
auth.onChange(() => {
  const now = applyAuthState();
  if (now === wasSignedIn) return;
  wasSignedIn = now;
  if (router.currentPath().path !== '/account') router.render();
});
async function loadAnnouncement() {
  const el = document.getElementById('announce');
  if (!el) return;
  let text = '';
  if (auth.currentUser()) {
    try {
      const c = await auth.supabaseClient();
      const { data } = await c.from('app_settings').select('announcement').eq('id', 1).maybeSingle();
      text = (data?.announcement || '').trim();
    } catch { text = ''; }
  }
  el.textContent = text;
  el.hidden = !text;
}

sync.start();
adminSvc.start();
adminSvc.onChange(buildNav);
auth.onChange(loadAnnouncement);
addEventListener('kt:admin-saved', loadAnnouncement);
auth.init();
