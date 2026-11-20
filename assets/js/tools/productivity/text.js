import { h, field, textarea, select, checkbox, button, panel, actions, copyButton, status, kv } from '../../core/dom.js';

const MAX_TEXT = 500000;
function checkText(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Use at most 500,000 characters.');
  return text.replace(/\r\n?/g, '\n');
}

export function textStats(text) {
  const normalized = checkText(text);
  const words = normalized.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  return {
    words: words.length,
    characters: Array.from(text).length,
    withoutSpaces: Array.from(text.replace(/\s/gu, '')).length,
    sentences: (normalized.match(/[^.!?。！？\s][^.!?。！？]*(?:[.!?。！？]+|$)/gu) || []).length,
    paragraphs: normalized.trim() ? normalized.trim().split(/\n\s*\n/).length : 0,
    lines: normalized ? normalized.split('\n').length : 0,
    readingSeconds: Math.ceil(words.length / 200 * 60),
    speakingSeconds: Math.ceil(words.length / 130 * 60),
  };
}

export function convertCase(text, mode) {
  checkText(text);
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'sentence') return text.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  if (mode === 'title') return text.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  const words = text.replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2').replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').match(/[\p{L}\p{N}]+/gu) || [];
  const lower = words.map(w => w.toLowerCase());
  const capital = w => Array.from(w)[0].toUpperCase() + w.slice(Array.from(w)[0].length);
  if (mode === 'snake') return lower.join('_');
  if (mode === 'kebab') return lower.join('-');
  if (mode === 'camel') return lower.map((w, i) => i ? capital(w) : w).join('');
  if (mode === 'pascal') return lower.map(capital).join('');
  throw new Error('Choose a case format.');
}

export function cleanText(text, options = {}) {
  let result = checkText(text);
  if (options.invisible) result = result.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '');
  if (options.quotes) result = result.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"');
  if (options.spaces) result = result.replace(/[^\S\n]+/g, ' ');
  if (options.trim) result = result.split('\n').map(line => line.trim()).join('\n').trim();
  if (options.breaks) result = result.replace(/\n+/g, ' ');
  return result;
}

export function transformLines(text, mode, { unique = false, empty = false, insensitive = false } = {}, random = Math.random) {
  const normalized = checkText(text);
  if (!normalized) return '';
  let lines = normalized.split('\n');
  if (lines.length > 50000) throw new Error('Use at most 50,000 lines.');
  if (empty) lines = lines.filter(line => line.trim());
  if (unique) {
    const seen = new Set();
    lines = lines.filter(line => {
      const key = insensitive ? line.toLowerCase() : line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (mode === 'asc' || mode === 'desc') {
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: insensitive ? 'accent' : 'variant' });
    lines.sort((a, b) => collator.compare(a, b) * (mode === 'desc' ? -1 : 1));
  } else if (mode === 'reverse') lines.reverse();
  else if (mode === 'shuffle') {
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
  } else if (mode !== 'keep') throw new Error('Choose a line operation.');
  return lines.join('\n');
}

function textWorkspace(root, controls, transform) {
  const source = textarea({ placeholder: 'Paste or type text here', 'aria-label': 'Input text' });
  const output = textarea({ readOnly: true, 'aria-label': 'Output text' });
  const feedback = h('div');
  const update = () => {
    try {
      output.value = transform(source.value);
      source.removeAttribute('aria-invalid');
      feedback.replaceChildren();
    } catch (error) {
      output.value = '';
      source.setAttribute('aria-invalid', 'true');
      feedback.replaceChildren(status('err', error.message));
    }
  };
  source.addEventListener('input', update);
  controls.addEventListener('change', update);
  root.append(controls, h('div', { class: 'toolbar' },
    button('Apply', { variant: 'primary', onclick: update }),
    button('Clear', { onclick: () => { source.value = ''; update(); source.focus(); } }),
    button('Use output as input', { onclick: () => { source.value = output.value; update(); } })),
  feedback, h('div', { class: 'panes' },
    panel('Input', field({ label: 'Text', control: source, hint: 'Maximum 500,000 characters.' })),
    panel('Output', actions(copyButton(() => output.value)), field({ label: 'Result', control: output }))));
  update();
}

export function textStatsTool(root) {
  const source = textarea({ placeholder: 'Paste or type text to count' });
  const result = h('div', { 'aria-live': 'polite' });
  const duration = seconds => `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
  const update = () => {
    try {
      const s = textStats(source.value);
      result.replaceChildren(kv([
        ['Words', s.words], ['Characters', s.characters], ['Without whitespace', s.withoutSpaces],
        ['Sentences', s.sentences], ['Paragraphs', s.paragraphs], ['Lines', s.lines],
        ['Reading time', duration(s.readingSeconds)], ['Speaking time', duration(s.speakingSeconds)],
      ]));
    } catch (error) { result.replaceChildren(status('err', error.message)); }
  };
  source.addEventListener('input', update);
  root.append(h('div', { class: 'panes' },
    panel('Input', actions(button('Clear', { onclick: () => { source.value = ''; update(); } })),
      field({ label: 'Text to count', control: source, hint: 'Maximum 500,000 characters. Characters count Unicode code points, not visual graphemes.' })),
    panel('Text statistics', result, h('p', { class: 'field__hint', text: 'Word and sentence counts are estimates. Reading: 200 words/min. Speaking: 130 words/min. Blank lines separate paragraphs.' }))));
  update();
}

export function caseTool(root) {
  const mode = select([['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case'], ['sentence', 'Sentence case'], ['camel', 'camelCase'], ['pascal', 'PascalCase'], ['snake', 'snake_case'], ['kebab', 'kebab-case']]);
  textWorkspace(root, h('div', { class: 'toolbar' }, field({ label: 'Case format', control: mode })), text => convertCase(text, mode.value));
}

export function cleanTool(root) {
  const options = [
    ['trim', 'Trim each line', true], ['spaces', 'Collapse spaces and tabs', true],
    ['breaks', 'Remove line breaks', false], ['quotes', 'Straighten smart quotes', true],
    ['invisible', 'Remove zero-width characters', false],
  ].map(([key, label, checked]) => ({ key, ...checkbox(label, { checked }) }));
  textWorkspace(root, h('div', { class: 'toolbar' }, ...options.map(o => o.el)), text => cleanText(text, Object.fromEntries(options.map(o => [o.key, o.box.checked]))));
  root.append(h('p', { class: 'field__hint', text: 'Removing zero-width joiners can change emoji and some writing systems. Line endings are normalized to LF.' }));
}

export function linesTool(root) {
  const mode = select([['asc', 'Sort ascending (natural)'], ['desc', 'Sort descending (natural)'], ['keep', 'Keep original order'], ['reverse', 'Reverse'], ['shuffle', 'Shuffle']]);
  const unique = checkbox('Remove duplicates');
  const empty = checkbox('Remove empty lines');
  const insensitive = checkbox('Ignore case');
  textWorkspace(root, h('div', { class: 'toolbar' }, field({ label: 'Operation', control: mode }), unique.el, empty.el, insensitive.el),
    text => transformLines(text, mode.value, { unique: unique.box.checked, empty: empty.box.checked, insensitive: insensitive.box.checked }));
}
