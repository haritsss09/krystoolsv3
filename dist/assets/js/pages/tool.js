import { h, status } from '../core/dom.js';
import { toolById, categoryById } from '../core/registry.js';
import { sig, runs, favButton } from '../core/ui.js';
import { setQuery } from '../core/router.js';
import * as store from '../core/storage.js';
import * as history from '../services/history.js';
import { notFoundPage } from './not-found.js';

const moduleCache = new Map();

function loadModule(path) {
  if (!moduleCache.has(path)) {
    const p = import(`../tools/${path}`);
    p.catch(() => moduleCache.delete(path));
    moduleCache.set(path, p);
  }
  return moduleCache.get(path);
}

export async function toolPage(view, ctx) {
  const tool = toolById.get(ctx.params[0]);
  if (!tool) return notFoundPage(view, ctx);
  const cat = categoryById.get(tool.category);
  document.title = `${tool.name} · KrysTools`;
  history.record(tool.id);

  const meta = h('div', { class: 'tool-head__meta' }, sig(tool), runs(tool, true));
  if (tool.source) meta.append(h('a', { class: 'sig', href: tool.source.url, target: '_blank', rel: 'noopener noreferrer', text: 'API docs' }));

  const workspace = h('div', { class: 'workspace' });
  view.append(
    h('header', { class: 'tool-head' },
      h('div', null,
        h('p', { class: 'tool-head__crumb' }, h('a', { href: `#/category/${cat.id}`, text: cat.name })),
        h('h1', { text: tool.name }),
        h('p', { text: tool.description }),
        meta),
      favButton(tool, { withLabel: true })),
    workspace,
  );
  if (tool.usage.length) {
    view.append(h('details', { class: 'usage', open: true },
      h('summary', { text: 'How to use' }),
      h('ul', null, tool.usage.map((u) => h('li', { text: u })))));
  }

  let mod;
  try {
    mod = await loadModule(tool.module);
  } catch (err) {
    workspace.append(status('err', 'This tool failed to load. Check your connection and reload the page.'));
    return;
  }
  const mount = mod[tool.export];
  if (typeof mount !== 'function') {
    workspace.append(status('err', 'This tool is not available in this build.'));
    return;
  }
  const ns = `tool:${tool.id}:`;
  const toolCtx = {
    tool,
    query: ctx.query,
    setQuery,
    store: {
      get: (k, f) => store.get(ns + k, f),
      set: (k, v) => store.set(ns + k, v),
      remove: (k) => store.remove(ns + k),
    },
  };
  try {
    return mount(workspace, toolCtx) || undefined;
  } catch (err) {
    console.error(err);
    workspace.replaceChildren(status('err', 'This tool hit an unexpected error while starting.'));
  }
}
