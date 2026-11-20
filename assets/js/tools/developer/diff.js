import { h, textarea, field, checkbox, button, copyButton, status } from '../../core/dom.js';

export function lineDiff(left, right, ignoreSpace = false, ignoreCase = false) {
  const lines = text => text === '' ? [] : text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const a = lines(left), b = lines(right);
  if (a.length > 1500 || b.length > 1500 || left.length + right.length > 500000) throw new Error('Compare up to 1,500 lines per side and 500,000 characters total.');
  const normalize = value => { if (ignoreSpace) value = value.trim().replace(/\s+/g, ' '); return ignoreCase ? value.toLowerCase() : value; };
  const aa = a.map(normalize), bb = b.map(normalize);
  const equal = (i, j) => aa[i] === bb[j] && (i === a.length - 1 && !left.endsWith('\n')) === (j === b.length - 1 && !right.endsWith('\n'));
  const cols = b.length + 1;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i * cols + j] = equal(i, j) ? 1 + table[(i + 1) * cols + j + 1] : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
  const changes = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && equal(i, j)) { changes.push({ kind: 'eq', text: a[i], old: i++, next: j++ }); }
    else if (j < b.length && (i === a.length || table[i * cols + j + 1] > table[(i + 1) * cols + j])) changes.push({ kind: 'add', text: b[j], next: j++ });
    else changes.push({ kind: 'del', text: a[i], old: i++ });
  }
  const prefix = { eq: ' ', add: '+', del: '-' };
  const body = changes.flatMap(change => {
    const noEnd = (change.old === a.length - 1 && !left.endsWith('\n')) || (change.next === b.length - 1 && !right.endsWith('\n'));
    return [prefix[change.kind] + change.text, ...(noEnd ? ['\\ No newline at end of file'] : [])];
  });
  const unified = `--- original\n+++ modified\n@@ -${a.length ? 1 : 0},${a.length} +${b.length ? 1 : 0},${b.length} @@\n${body.join('\n')}\n`;
  return { changes, unified, newlineDifference: Boolean(left) && Boolean(right) && left.endsWith('\n') !== right.endsWith('\n') };
}

export function diffTool(root) {
  const left = textarea(), right = textarea();
  const spaces = checkbox('Ignore whitespace'), casing = checkbox('Ignore letter case');
  const result = h('pre', { class: 'output' });
  const message = h('div');
  let unified = '';
  function run() {
    try {
      const data = lineDiff(left.value, right.value, spaces.box.checked, casing.box.checked);
      unified = data.unified;
      result.replaceChildren(...data.changes.map(change => h('span', { class: `diff-${change.kind}` }, h('span', { class: 'diff-gutter', text: { eq: ' ', add: '+', del: '-' }[change.kind] }), change.text || '\u00a0')));
      const added = data.changes.filter(c => c.kind === 'add').length, removed = data.changes.filter(c => c.kind === 'del').length;
      message.replaceChildren(status('ok', `${added} added, ${removed} removed.${data.newlineDifference ? ' Final newline differs.' : ''}${spaces.box.checked || casing.box.checked ? ' Comparison ignores selected differences; the copied diff is not an exact patch.' : ''}`));
    } catch (error) { unified = ''; result.replaceChildren(); message.replaceChildren(status('err', error.message)); }
  }
  root.append(h('div', { class: 'panes' }, field({ label: 'Original', control: left }), field({ label: 'Modified', control: right })),
    h('div', { class: 'toolbar' }, spaces.el, casing.el, button('Compare', { variant: 'primary', onclick: run }), copyButton(() => unified, 'Copy unified diff')), message, result);
}
