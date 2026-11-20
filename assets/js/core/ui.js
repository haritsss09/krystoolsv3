import { h, icon, toast } from './dom.js';
import { RUNS_LABEL, categoryById } from './registry.js';
import * as favorites from '../services/favorites.js';

export const toolHref = (tool) => `#/tool/${tool.id}`;

export function sig(tool) {
  const [a, b] = tool.signature;
  return h('span', { class: 'sig', title: 'Input and output' },
    h('b', { text: a }), h('i', { 'aria-hidden': 'true', text: '→' }), h('span', { class: 'visually-hidden', text: ' to ' }), h('b', { text: b }));
}

export function runs(tool, long = false) {
  let text = RUNS_LABEL[tool.runs];
  if (long && tool.runs === 'api' && tool.source) text = `Public API: ${tool.source.name}`;
  const title = {
    local: 'Your input stays in this browser',
    api: 'Requests go directly from your browser to a public API',
    server: 'Requests go through the KrysTools server function',
  }[tool.runs];
  return h('span', { class: `runs runs--${tool.runs}`, title, text });
}

function syncFav(btn) {
  const on = favorites.has(btn.dataset.tool);
  const name = btn.dataset.name;
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? `Remove ${name} from favorites` : `Add ${name} to favorites`);
  btn.title = on ? 'Remove from favorites' : 'Add to favorites';
  const label = btn.querySelector('.fav-btn__label');
  if (label) label.textContent = on ? 'Favorited' : 'Favorite';
}

favorites.onChange(() => document.querySelectorAll('.fav-btn').forEach(syncFav));

export function favButton(tool, { withLabel = false } = {}) {
  const btn = h('button', {
    class: `btn btn--ghost fav-btn ${withLabel ? '' : 'btn--sm btn--icon'}`,
    type: 'button',
    dataset: { tool: tool.id, name: tool.name },
  }, icon('star'), withLabel ? h('span', { class: 'fav-btn__label' }) : null);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const on = favorites.toggle(tool.id);
    toast(on ? `${tool.name} added to favorites` : `${tool.name} removed from favorites`);
  });
  syncFav(btn);
  return btn;
}

export function toolRow(tool, { showCategory = false, extra = null } = {}) {
  return h('div', { class: 'tool-row' },
    h('a', { class: 'tool-row__main', href: toolHref(tool) },
      h('span', { class: 'tool-row__name', text: tool.name }),
      h('span', { class: 'tool-row__desc', text: tool.description }),
      h('span', { class: 'tool-row__meta' },
        sig(tool),
        runs(tool),
        showCategory ? h('span', { class: 'sig', text: categoryById.get(tool.category).name }) : null,
        extra)),
    favButton(tool));
}

export function toolList(tools, opts) {
  return h('div', { class: 'tool-list' }, tools.map((t) => toolRow(t, opts)));
}

export function tile(tool) {
  return h('a', { class: 'tile', href: toolHref(tool) },
    h('span', { class: 'tile__name', text: tool.name }),
    h('span', { class: 'tile__desc', text: tool.description }),
    h('span', { class: 'row' }, sig(tool), runs(tool)));
}

export function empty(title, text, action) {
  return h('div', { class: 'empty' }, h('strong', { text: title }), h('span', { text }), action || null);
}

export function pageHead(title, text, aside) {
  return h('header', { class: 'page-head' },
    h('div', null, h('h1', { text: title }), text ? h('p', { text }) : null),
    aside || null);
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');

/* Final value is always in the DOM text, so screen readers and no-JS-observer browsers read the real number. */
export function countUp(value, { duration = 1400, className = 'count' } = {}) {
  const el = h('span', { class: className, text: fmtNum(value) });
  if (reduceMotion.matches || !('IntersectionObserver' in window) || value <= 0) return el;
  el.textContent = '0';
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = fmtNum(value * (1 - (1 - t) ** 4));
      if (t < 1) requestAnimationFrame(tick);
      else el.classList.add('is-done');
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.6 });
  io.observe(el);
  return el;
}

export function statBlock(items) {
  return h('dl', { class: 'stats' }, items.map(([value, label, hint]) =>
    h('div', { class: 'stats__item' },
      h('dt', { class: 'stats__label', text: label }),
      h('dd', { class: 'stats__value' }, countUp(value)),
      hint ? h('dd', { class: 'stats__hint', text: hint }) : null)));
}
