import { Marked } from '../../../vendor/marked.esm.js';
import { h, textarea, field, copyButton, button, download, sanitizeHtml, status } from '../../core/dom.js';

const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const parser = new Marked({ renderer: { html: token => escape(token.text) } });

export function markdownTool(root, ctx) {
  const editor = textarea({ value: ctx.store.get('draft', ''), placeholder: '# Your document\n\nWrite Markdown here.' });
  const preview = h('div', { class: 'prose panel', 'aria-label': 'Markdown preview' });
  const message = h('div');
  let html = '';
  function render() {
    const fragment = sanitizeHtml(parser.parse(editor.value));
    preview.replaceChildren(fragment);
    html = preview.innerHTML;
  }
  editor.addEventListener('input', () => {
    render();
    message.replaceChildren(...(ctx.store.set('draft', editor.value) ? [] : [status('err', 'Draft could not be saved. Download a copy before leaving.')]));
  });
  root.append(h('div', { class: 'toolbar' }, copyButton(() => html, 'Copy HTML'), button('Download Markdown', { onclick: () => download(editor.value, 'document.md', 'text/markdown') })),
    h('div', { class: 'panes' }, field({ label: 'Markdown', control: editor }), h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: 'Preview' }), preview)), message);
  render();
}
