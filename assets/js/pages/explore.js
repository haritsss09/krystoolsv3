import { h, field, input, select, debounce } from '../core/dom.js';
import { TOOLS, CATEGORIES, categoryById, toolsIn, RUNS_LABEL } from '../core/registry.js';
import { search } from '../core/search.js';
import { toolList, pageHead, empty } from '../core/ui.js';
import { setQuery } from '../core/router.js';
import * as history from '../services/history.js';
import * as favorites from '../services/favorites.js';
import { notFoundPage } from './not-found.js';

export function explorePage(view, { query }) {
  document.title = 'Explore tools · KrysTools';
  const q = input({ type: 'search', placeholder: 'Name, task, format or data source', value: query.get('q') || '' });
  const cat = select([['', 'All categories'], ...CATEGORIES.map((c) => [c.id, c.name])], { value: query.get('cat') || '' });
  const runs = select([['', 'Any'], ...Object.entries(RUNS_LABEL)], { value: query.get('runs') || '' });
  const sort = select([['relevance', 'Relevance'], ['name', 'Name A to Z'], ['category', 'Category'], ['used', 'Most used on this device'], ['favorites', 'Favorites first']], { value: query.get('sort') || 'relevance' });
  const count = h('p', { class: 'result-count', 'aria-live': 'polite' });
  const listHost = h('div');

  const update = () => {
    let tools = search(q.value);
    if (cat.value) tools = tools.filter((t) => t.category === cat.value);
    if (runs.value) tools = tools.filter((t) => t.runs === runs.value);
    const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
    if (sort.value === 'name') tools.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort.value === 'category') tools.sort((a, b) => order.get(a.category) - order.get(b.category) || a.name.localeCompare(b.name));
    else if (sort.value === 'used') {
      const c = history.counts();
      tools.sort((a, b) => (c[b.id]?.n || 0) - (c[a.id]?.n || 0));
    } else if (sort.value === 'favorites') {
      const f = favorites.list();
      tools.sort((a, b) => (f.includes(b.id) ? 1 : 0) - (f.includes(a.id) ? 1 : 0));
    } else if (!q.value.trim()) {
      tools.sort((a, b) => order.get(a.category) - order.get(b.category));
    }
    const params = {};
    if (q.value.trim()) params.q = q.value.trim();
    if (cat.value) params.cat = cat.value;
    if (runs.value) params.runs = runs.value;
    if (sort.value !== 'relevance') params.sort = sort.value;
    setQuery(params);
    count.textContent = `${tools.length} of ${TOOLS.length} tools`;
    if (!tools.length) {
      listHost.replaceChildren(empty('No tools match these filters', 'Try a shorter search, or reset the filters.',
        h('button', { class: 'btn', type: 'button', text: 'Reset filters', onclick: () => { q.value = ''; cat.value = ''; runs.value = ''; sort.value = 'relevance'; update(); q.focus(); } })));
      return;
    }
    const usage = sort.value === 'used' ? history.counts() : null;
    listHost.replaceChildren(toolList(tools, { showCategory: !cat.value }));
    if (usage) {
      [...listHost.querySelectorAll('.tool-row')].forEach((row, i) => {
        const n = usage[tools[i].id]?.n || 0;
        row.querySelector('.tool-row__meta').append(h('span', { class: 'sig', text: n ? `opened ${n}×` : 'not opened yet' }));
      });
    }
  };
  q.addEventListener('input', debounce(update, 120));
  for (const s of [cat, runs, sort]) s.addEventListener('change', update);

  const qField = field({ label: 'Search', control: q });
  qField.classList.add('field--grow');
  view.append(
    pageHead('Explore tools', 'Every tool says what it takes, what it gives back, and where it runs. "Runs locally" means your input never leaves this browser.'),
    h('div', { class: 'filters', role: 'search' },
      qField,
      field({ label: 'Category', control: cat }),
      field({ label: 'Runs', control: runs }),
      field({ label: 'Sort by', control: sort })),
    count,
    listHost,
  );
  update();
  if (!query.get('q')) setTimeout(() => q.focus({ preventScroll: true }), 0);
}

export function categoriesPage(view) {
  document.title = 'Categories · KrysTools';
  view.append(pageHead('Categories', `${CATEGORIES.length} categories, ${TOOLS.length} tools.`));
  for (const c of CATEGORIES) {
    const tools = toolsIn(c.id);
    view.append(h('section', { class: 'section', style: 'margin-top:var(--space-6)' },
      h('div', { class: 'section__head' },
        h('div', null, h('h2', null, h('a', { href: `#/category/${c.id}`, style: 'color:inherit;text-decoration:none', text: c.name })), h('p', { class: 'field__hint', text: c.blurb })),
        h('a', { href: `#/category/${c.id}`, text: `${tools.length} tools` })),
      toolList(tools)));
  }
}

export function categoryPage(view, ctx) {
  const c = categoryById.get(ctx.params[0]);
  if (!c) return notFoundPage(view, ctx);
  document.title = `${c.name} · KrysTools`;
  const tools = toolsIn(c.id);
  const local = tools.filter((t) => t.runs === 'local').length;
  const note = local === tools.length ? 'All of these run in your browser.' : local ? `${local} of ${tools.length} run in your browser.` : '';
  view.append(
    h('p', { class: 'tool-head__crumb' }, h('a', { href: '#/categories', text: 'Categories' }), ' / ', c.name),
    pageHead(c.name, `${c.blurb} ${note}`.trim()),
    toolList(tools),
  );
}
