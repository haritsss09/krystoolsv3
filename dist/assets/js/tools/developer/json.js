import { h, textarea, field, button, select, copyButton, download, status } from '../../core/dom.js';

export function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJson(value[key])]));
  return value;
}

export function jsonTool(root) {
  const source = textarea({ placeholder: 'Paste JSON here', 'aria-label': 'JSON input' });
  const result = textarea({ readOnly: true, placeholder: 'Formatted JSON', 'aria-label': 'JSON output' });
  const indent = select([['2', '2 spaces'], ['4', '4 spaces'], ['\t', 'Tabs']]);
  const message = h('div', { 'aria-live': 'polite' });
  let mode = 'format';
  function run(next = mode) {
    mode = next;
    if (!source.value.trim()) { result.value = ''; message.replaceChildren(); return; }
    try {
      const data = JSON.parse(source.value);
      result.value = JSON.stringify(mode === 'sort' ? sortJson(data) : data, null, mode === 'minify' ? 0 : indent.value === '\t' ? '\t' : Number(indent.value));
      message.replaceChildren(status('ok', 'Valid JSON'));
    } catch (error) {
      result.value = '';
      const position = error.message.match(/position (\d+)/);
      let detail = error.message;
      if (position && !/line \d+/.test(detail)) {
        const before = source.value.slice(0, Number(position[1])).split('\n');
        detail += ` (line ${before.length}, column ${before.at(-1).length + 1})`;
      }
      message.replaceChildren(status('err', detail));
    }
  }
  source.addEventListener('input', () => run());
  indent.addEventListener('change', () => run());
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Indent', control: indent }),
    button('Format', { variant: 'primary', onclick: () => run('format') }), button('Minify', { onclick: () => run('minify') }),
    button('Sort keys', { onclick: () => run('sort') }),
    button('Example', { onclick: () => { source.value = '{"project":"KrysTools","local":true,"tools":["JSON","XML"]}'; run(); } }),
    button('Clear', { onclick: () => { source.value = ''; run(); } })),
    h('div', { class: 'panes' }, field({ label: 'Input', control: source }), field({ label: 'Output', control: result })),
    message, h('div', { class: 'toolbar' }, copyButton(() => result.value), button('Download JSON', { onclick: () => { if (result.value) download(result.value, 'formatted.json', 'application/json'); } })));
}
