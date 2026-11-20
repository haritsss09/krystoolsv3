import { h, relTime } from '../core/dom.js';
import { toolById, CATEGORIES, categoryById } from '../core/registry.js';
import { toolList, pageHead, empty, toolHref } from '../core/ui.js';
import * as favorites from '../services/favorites.js';
import * as history from '../services/history.js';

function bars(rows, total) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return h('div', { class: 'usage-bars' }, rows.map((r) =>
    h('div', { class: 'usage-bar' },
      r.href ? h('a', { href: r.href, text: r.label }) : h('span', { text: r.label }),
      h('span', { class: 'usage-bar__track', role: 'img', 'aria-label': `${r.n} of ${total} opens` }, h('span', { style: `width:${(r.n / max) * 100}%` })),
      h('span', { class: 'usage-bar__n', text: String(r.n) }))));
}

export function dashboardPage(view) {
  document.title = 'Dashboard · KrysTools';
  const counts = history.counts();
  const entries = Object.entries(counts).filter(([id]) => toolById.has(id));
  const total = entries.reduce((s, [, e]) => s + e.n, 0);
  const favs = favorites.list().map((id) => toolById.get(id)).filter(Boolean);
  const recent = history.recent().filter((r) => toolById.has(r.id)).slice(0, 6);
  const since = history.since();

  const summary = total
    ? `${total} tool open${total === 1 ? '' : 's'} across ${entries.length} tool${entries.length === 1 ? '' : 's'} since ${new Date(since).toLocaleDateString(undefined, { dateStyle: 'medium' })}. ${favs.length} favorite${favs.length === 1 ? '' : 's'}.`
    : 'No activity recorded on this device yet.';

  view.append(pageHead('Dashboard', `${summary} Everything here comes from this browser's local storage. Nothing is sent to a server.`));

  view.append(h('section', { class: 'section', style: 'margin-top:0' },
    h('div', { class: 'section__head' }, h('h2', { text: 'Quick access' }), h('a', { href: '#/favorites', text: 'All favorites' })),
    favs.length ? toolList(favs.slice(0, 8), { showCategory: true }) : empty('No favorites yet', 'Star tools you use often and they will show up here.', h('a', { class: 'btn', href: '#/explore', text: 'Browse tools' }))));

  if (!total) {
    view.append(h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h2', { text: 'Usage' })),
      empty('No usage yet', 'Open a few tools and this page will show which ones you rely on.')));
  } else {
    const top = entries.sort((a, b) => b[1].n - a[1].n).slice(0, 10)
      .map(([id, e]) => ({ label: toolById.get(id).name, href: toolHref(toolById.get(id)), n: e.n }));
    const byCat = new Map();
    for (const [id, e] of entries) {
      const c = toolById.get(id).category;
      byCat.set(c, (byCat.get(c) || 0) + e.n);
    }
    const catRows = CATEGORIES.filter((c) => byCat.has(c.id)).map((c) => ({ label: c.name, href: `#/category/${c.id}`, n: byCat.get(c.id) }))
      .sort((a, b) => b.n - a.n);

    view.append(h('div', { class: 'grid--2 grid', style: 'margin-top:var(--space-7);align-items:start' },
      h('section', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title', text: 'Most opened tools' })),
        bars(top, total)),
      h('section', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title', text: 'Opens by category' })),
        bars(catRows, total))));

    view.append(h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h2', { text: 'Recently used' }), h('a', { href: '#/recent', text: 'Full history' })),
      h('div', { class: 'tool-list' }, recent.map((r) => {
        const t = toolById.get(r.id);
        return h('div', { class: 'tool-row' },
          h('a', { class: 'tool-row__main', href: toolHref(t) },
            h('span', { class: 'tool-row__name', text: t.name }),
            h('span', { class: 'tool-row__desc', text: categoryById.get(t.category).name })),
          h('span', { class: 'sig', title: new Date(r.at).toLocaleString(), text: relTime(r.at) }));
      }))));
  }

}
