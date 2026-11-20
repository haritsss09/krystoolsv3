import { h } from '../core/dom.js';
import { pageHead } from '../core/ui.js';

export function notFoundPage(view, { path }) {
  document.title = 'Not found · KrysTools';
  view.append(
    pageHead('Page not found', `Nothing lives at ${path}. The link may be old, or the tool may have been renamed.`),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn--primary', href: '#/explore', text: 'Search all tools' }),
      h('a', { class: 'btn', href: '#/', text: 'Go to home' })),
  );
}
