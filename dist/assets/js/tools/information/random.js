import { h, button, panel, status } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { randomFact, randomQuote } from '../../api/utilities.js';

function sourceLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function randomTool(workspace, kind) {
  const isFact = kind === 'fact';
  const view = apiView({
    idle: status('info', `Request a random ${kind} from the source.`),
    loadingText: `Loading a random ${kind}`,
    load: (force) => (isFact ? randomFact : randomQuote)({ force }),
    isEmpty: (data) => !(isFact ? data.text : data.quote).trim() && `The source returned an empty ${kind}. Request another.`,
    render: (data) => {
      if (!isFact) return [
        h('blockquote', { class: 'prose', style: 'margin:0;overflow-wrap:anywhere', text: data.quote }),
        h('p', { text: `Attributed to ${data.author || 'an unspecified author'} by DummyJSON` }),
        h('p', { class: 'field__hint', text: 'This is from DummyJSON’s sample quote dataset. Attributions have not been independently verified.' }),
      ];
      const href = sourceLink(data.source_url);
      return [
        h('p', { class: 'prose', style: 'overflow-wrap:anywhere', text: data.text }),
        href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer', text: `Original source: ${typeof data.source === 'string' ? data.source : new URL(href).hostname}` }) : null,
        h('p', { class: 'field__hint', text: 'Trivia supplied by Useless Facts API. Check the original source before relying on it.' }),
      ];
    },
  });
  const next = button(`Get random ${kind}`, { variant: 'primary' });
  const requestNext = () => view.run(true);
  next.addEventListener('click', requestNext);
  const root = h('div', { class: 'stack' }, h('div', null, next), panel(isFact ? 'Random fact' : 'Random quote', view.el));
  workspace.append(root);
  return () => { next.removeEventListener('click', requestNext); view.destroy(); root.remove(); };
}

export const factTool = (workspace) => randomTool(workspace, 'fact');
export const quoteTool = (workspace) => randomTool(workspace, 'quote');
