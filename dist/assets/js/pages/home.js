import { h, kv } from '../core/dom.js';
import { TOOLS, CATEGORIES, toolsIn, toolById } from '../core/registry.js';
import { search } from '../core/search.js';
import { tile, toolList, toolHref, statBlock } from '../core/ui.js';
import { apiView } from '../core/api-view.js';
import * as history from '../services/history.js';
import { latestQuake } from '../api/bmkg.js';
import { myIp } from '../api/networking.js';
import { latestRates } from '../api/currency.js';
import { quakeSummary } from '../tools/information/bmkg-view.js';

export function homePage(view) {
  document.title = 'KrysTools';
  const localCount = TOOLS.filter((t) => t.runs === 'local').length;

  const q = h('input', {
    class: 'input', type: 'search', id: 'home-search', placeholder: 'Try "json", "subnet", "gempa" or "sha256"',
    autocomplete: 'off', spellcheck: 'false', 'aria-controls': 'home-results',
  });
  const results = h('div', { id: 'home-results', 'aria-live': 'polite' });
  const defaultContent = h('div');

  const updateSearch = () => {
    const value = q.value.trim();
    if (!value) {
      results.replaceChildren();
      defaultContent.hidden = false;
      return;
    }
    const found = search(value);
    defaultContent.hidden = true;
    results.replaceChildren(h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h2', { text: found.length ? `${found.length} matching tool${found.length === 1 ? '' : 's'}` : 'No matching tools' })),
      found.length ? toolList(found.slice(0, 20), { showCategory: true }) : h('p', { class: 'field__hint', text: 'Try a format (csv, jwt), a task (compress, validate) or a data source (bmkg).' })));
  };
  q.addEventListener('input', updateSearch);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = search(q.value)[0];
      if (q.value.trim() && first) location.hash = toolHref(first);
    }
  });

  const quake = apiView({
    loadingText: 'Loading the latest BMKG earthquake',
    load: (force) => latestQuake({ force }),
    render: (d) => quakeSummary(d, { compact: true }),
  });
  const ip = apiView({
    loadingText: 'Finding your public IP',
    load: (force) => myIp({ force }),
    render: (d) => [h('div', { class: 'big-value', style: 'font-size:1.35rem', text: d.ip }),
      h('p', { class: 'field__hint', text: [d.city, d.country].filter(Boolean).join(', ') + (d.org ? ` · ${d.org}` : '') })],
  });
  const fx = apiView({
    loadingText: 'Loading exchange rates',
    load: (force) => latestRates('USD', ['IDR', 'EUR', 'SGD'], { force }),
    render: (d) => [
      h('div', { class: 'big-value', style: 'font-size:1.35rem' }, `1 USD = ${d.rates.IDR.toLocaleString('en-US', { maximumFractionDigits: 0 })} IDR`),
      kv([['EUR', d.rates.EUR.toFixed(4)], ['SGD', d.rates.SGD.toFixed(4)], ['Rate date', d.date]]),
    ],
  });

  const counts = history.counts();
  const mostUsed = Object.entries(counts).filter(([id]) => toolById.has(id)).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id]) => toolById.get(id));

  defaultContent.append(
    h('section', { class: 'section', 'aria-labelledby': 'live-h' },
      h('div', { class: 'section__head' }, h('h2', { id: 'live-h', text: 'Live right now' })),
      h('div', { class: 'live' },
        h('div', { class: 'panel' },
          h('div', { class: 'panel__head' }, h('h3', { class: 'panel__title', text: 'Latest earthquake in Indonesia' }), h('a', { href: '#/tool/earthquake', class: 'field__hint', text: 'Recent and felt quakes' })),
          quake.el),
        h('div', { class: 'live__side' },
          h('div', { class: 'panel' },
            h('div', { class: 'panel__head' }, h('h3', { class: 'panel__title', text: 'Your public IP' }), h('a', { href: '#/tool/ip-lookup', class: 'field__hint', text: 'Details' })),
            ip.el),
          h('div', { class: 'panel' },
            h('div', { class: 'panel__head' }, h('h3', { class: 'panel__title', text: 'Exchange rate' }), h('a', { href: '#/tool/currency', class: 'field__hint', text: 'Convert' })),
            fx.el)))),
    mostUsed.length ? h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h2', { text: 'Your most used' }), h('a', { href: '#/dashboard', text: 'Dashboard' })),
      toolList(mostUsed, { showCategory: true }),
      h('p', { class: 'field__hint', style: 'margin-top:var(--space-2)', text: 'Based on tool opens stored on this device.' })) : null,
    h('section', { class: 'section', 'aria-labelledby': 'feat-h' },
      h('div', { class: 'section__head' }, h('h2', { id: 'feat-h', text: 'Featured tools' }), h('a', { href: '#/explore', text: `All ${TOOLS.length} tools` })),
      h('div', { class: 'grid' }, TOOLS.filter((t) => t.featured).map(tile))),
    h('section', { class: 'section', 'aria-labelledby': 'stats-h' },
      h('div', { class: 'section__head' }, h('h2', { id: 'stats-h', text: 'What is in the toolbox' })),
      statBlock([
        [TOOLS.length, 'Tools', `Across ${CATEGORIES.length} categories`],
        [localCount, 'Run in your browser', 'Input never leaves the page'],
        [TOOLS.filter((t) => t.runs === 'api').length, 'Use public data', 'Fetched from open APIs such as BMKG'],
        [TOOLS.filter((t) => t.runs === 'server').length, 'Use the server', 'AI and network checks'],
      ])),
    h('section', { class: 'section section--categories', 'aria-labelledby': 'cat-h' },
      h('div', { class: 'section__head' }, h('h2', { id: 'cat-h', text: 'Browse by category' }), h('a', { href: '#/categories', text: 'Category overview' })),
      h('p', { class: 'cat-index__intro', text: 'Choose a category, or open a tool directly.' }),
      h('div', { class: 'cat-index' }, CATEGORIES.map((c) => {
        const tools = toolsIn(c.id);
        return h('div', { class: 'cat-index__item' },
          h('h3', null, h('a', { href: `#/category/${c.id}`, text: c.name }), h('span', { class: 'nav__count', text: String(tools.length) })),
          h('p', { text: c.blurb }),
          h('div', { class: 'cat-index__tools' }, tools.map((t) => h('a', { href: toolHref(t), text: t.name }))));
      }))),
  );

  view.append(
    h('section', { class: 'intro', 'aria-labelledby': 'intro-h' },
      h('div', null,
        h('h1', { id: 'intro-h' }, 'Tools for the data ', h('em', { text: 'you work with.' })),
        h('p', { text: `${TOOLS.length} tools for code, networks, security, text, images and public data. ${localCount} of them run entirely in your browser, so your input never leaves the page.` })),
      h('div', { class: 'intro__search', role: 'search' },
        h('label', { for: 'home-search', class: 'field__label', text: 'Find a tool' }),
        q,
        h('span', { class: 'intro__hint' }, 'Press', h('kbd', { text: '/' }), 'anywhere to search, or', h('kbd', { text: 'Ctrl' }), h('kbd', { text: 'K' })))),
    results,
    defaultContent,
  );

  quake.run();
  ip.run();
  fx.run();
  return () => { quake.destroy(); ip.destroy(); fx.destroy(); };
}
