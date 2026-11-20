import { h, icon, relTime } from './dom.js';
import { empty as emptyBlock } from './ui.js';

/*
  One component for every API-backed result: loading, success, empty, error, retry,
  last-updated time and source attribution.
*/
export function apiView({ load, render, isEmpty, loadingText = 'Loading', idle = null }) {
  const root = h('div', { class: 'api-state', 'aria-live': 'polite', 'aria-busy': 'false' });
  let seq = 0;
  let timeTimer = null;
  if (idle) root.append(idle);

  async function run(force = false) {
    const id = ++seq;
    clearInterval(timeTimer);
    root.setAttribute('aria-busy', 'true');
    root.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'loading__bar', 'aria-hidden': 'true' }), h('span', { text: loadingText })));
    let result;
    try {
      result = await load(force);
    } catch (err) {
      result = { ok: false, error: err };
    }
    if (id !== seq) return result;
    root.setAttribute('aria-busy', 'false');

    if (!result || !result.ok) {
      const err = result?.error;
      root.replaceChildren(
        h('div', { class: 'status status--err', role: 'alert' },
          h('span', { class: 'status__mark', 'aria-hidden': 'true', text: 'ERR' }),
          h('div', { class: 'stack', style: 'gap:var(--space-2)' },
            h('span', { text: err?.message || 'Something went wrong.' }),
            err?.kind === 'config' ? null : h('div', null,
              h('button', { class: 'btn btn--sm', type: 'button', onclick: () => run(true) }, icon('refresh'), 'Retry')))),
        ...(result?.source ? [footer(result, false)] : []),
      );
      return result;
    }

    try {
      const emptyMsg = isEmpty ? isEmpty(result.data) : false;
      if (emptyMsg) {
        root.replaceChildren(emptyBlock('No results', emptyMsg), footer(result, true));
        return result;
      }
      const content = render(result.data, result);
      root.replaceChildren(...[].concat(content).filter(Boolean), footer(result, true));
    } catch {
      root.replaceChildren(emptyBlock('Could not display this response', 'The source returned data this tool could not display.',
        h('button', { class: 'btn', type: 'button', onclick: () => run(true), text: 'Retry' })), footer(result, false));
    }
    return result;
  }

  function footer(result, withTime) {
    const src = result.source;
    const timeEl = h('span');
    const updateTime = () => {
      if (!result.fetchedAt) return;
      const d = new Date(result.fetchedAt);
      timeEl.textContent = `Updated ${relTime(result.fetchedAt)}${result.fromCache ? ' (cached)' : ''}`;
      timeEl.title = d.toLocaleString();
    };
    if (withTime) {
      updateTime();
      timeTimer = setInterval(updateTime, 30000);
    }
    return h('div', { class: 'api-foot' },
      src ? h('span', null, 'Source: ', src.url ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', text: src.name }) : src.name) : h('span'),
      withTime ? h('span', { class: 'row' }, timeEl,
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => run(true) }, icon('refresh'), 'Refresh')) : null);
  }

  return { el: root, run, destroy: () => { seq++; clearInterval(timeTimer); } };
}
