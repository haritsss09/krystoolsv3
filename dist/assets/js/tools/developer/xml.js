import { h, textarea, field, button, select, copyButton, status } from '../../core/dom.js';

export function formatXml(text, indent = '  ', minify = false) {
  if (/<!DOCTYPE/i.test(text)) throw new Error('DOCTYPE declarations are not supported. Remove the declaration before formatting.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(error.textContent.trim());
  const serializer = new XMLSerializer();
  function visit(node, depth, preserve = false) {
    if (node.nodeType !== 1) return serializer.serializeToString(node);
    const space = node.getAttribute('xml:space');
    preserve = space === 'preserve' || (space !== 'default' && preserve);
    const children = [...node.childNodes];
    const mixed = children.some(c => c.nodeType === 4 || (c.nodeType === 3 && c.textContent.trim()));
    if (preserve || mixed || !children.length) return serializer.serializeToString(node);
    const shell = serializer.serializeToString(node.cloneNode(false));
    const opening = shell.replace(/\s*\/>$/, '>');
    const meaningful = children.filter(c => c.nodeType !== 3 || c.textContent.trim());
    if (!meaningful.length) return shell;
    const joiner = minify ? '' : '\n';
    const content = meaningful.map(c => (minify ? '' : indent.repeat(depth + 1)) + visit(c, depth + 1, preserve)).join(joiner);
    return opening + joiner + content + joiner + (minify ? '' : indent.repeat(depth)) + `</${node.nodeName}>`;
  }
  const declaration = text.match(/^\s*(<\?xml[^?]*\?>)/)?.[1];
  return [declaration, ...[...doc.childNodes].map(n => visit(n, 0))].filter(Boolean).join(minify ? '' : '\n');
}

export function xmlTool(root) {
  const source = textarea({ placeholder: '<root><item>Text</item></root>' });
  const output = textarea({ readOnly: true });
  const indent = select([['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tabs']]);
  const message = h('div');
  function run(minify) {
    if (!source.value.trim()) { output.value = ''; message.replaceChildren(); return; }
    try {
      output.value = formatXml(source.value, indent.value === 'tab' ? '\t' : ' '.repeat(Number(indent.value)), minify);
      message.replaceChildren(status('ok', 'Well-formed XML. Mixed text content and xml:space="preserve" are kept unchanged.'));
    } catch (error) { output.value = ''; message.replaceChildren(status('err', error.message)); }
  }
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Indent', control: indent }), button('Format', { variant: 'primary', onclick: () => run(false) }), button('Minify', { onclick: () => run(true) }), copyButton(() => output.value)),
    h('div', { class: 'panes' }, field({ label: 'XML input', control: source }), field({ label: 'XML output', control: output })), message);
}
