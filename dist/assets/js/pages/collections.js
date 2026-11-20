import { h, relTime } from '../core/dom.js';
import { toolById } from '../core/registry.js';
import { toolList, pageHead, empty } from '../core/ui.js';
import * as favorites from '../services/favorites.js';
import * as history from '../services/history.js';

const browseLink = () => h('a', { class: 'btn', href: '#/explore', text: 'Browse tools' });

export function favoritesPage(view) {
  document.title = 'Favorites · KrysTools';
  const host = h('div');
  const render = () => {
    const tools = favorites.list().map((id) => toolById.get(id)).filter(Boolean);
    host.replaceChildren(tools.length
      ? toolList(tools, { showCategory: true })
      : empty('No favorites yet', 'Use the star on any tool to keep it here.', browseLink()));
  };
  view.append(pageHead('Favorites', 'Starred tools, newest first. Stored on this device.'), host);
  render();
  return favorites.onChange(render);
}

export function recentPage(view) {
  document.title = 'Recent tools · KrysTools';
  const host = h('div');
  const clearBtn = h('button', { class: 'btn btn--sm', type: 'button', text: 'Clear history' });
  const render = () => {
    const items = history.recent().filter((r) => toolById.has(r.id));
    clearBtn.hidden = !items.length;
    if (!items.length) {
      host.replaceChildren(empty('Nothing here yet', 'Tools you open will appear here so you can get back to them.', browseLink()));
      return;
    }
    const tools = items.map((r) => toolById.get(r.id));
    const list = toolList(tools, { showCategory: true });
    [...list.querySelectorAll('.tool-row__meta')].forEach((meta, i) => {
      meta.append(h('span', { class: 'sig', title: new Date(items[i].at).toLocaleString(), text: `opened ${relTime(items[i].at)}` }));
    });
    host.replaceChildren(list);
  };
  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear recent tools and usage counts on this device?')) return;
    history.clear();
    render();
  });
  view.append(pageHead('Recent tools', 'The last 30 tools you opened on this device.', clearBtn), host);
  render();
}
