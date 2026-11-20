import { h, input, textarea, field, copyButton, status } from '../../core/dom.js';

export function regexTool(root) {
  const pattern = input({ placeholder: '(?<word>\\w+)', maxlength: 2000 });
  const flags = input({ value: 'g', maxlength: 8 });
  const text = textarea({ placeholder: 'Text to match', maxlength: 100000 });
  const replacement = input({ placeholder: '$1 or $<word>', maxlength: 10000 });
  const highlighted = h('pre', { class: 'output', 'aria-label': 'Highlighted matches' });
  const groups = h('div', { class: 'stack' });
  const replaced = textarea({ readOnly: true });
  const message = h('div', { 'aria-live': 'polite' });
  let worker, timer, delay;
  function stop() { worker?.terminate(); worker = null; clearTimeout(timer); }
  function run() {
    stop();
    highlighted.replaceChildren(); groups.replaceChildren(); replaced.value = '';
    if (!pattern.value) { message.replaceChildren(); highlighted.textContent = text.value; return; }
    message.replaceChildren(status('info', 'Testing pattern…'));
    worker = new Worker(new URL('./regex-worker.js', import.meta.url), { type: 'module' });
    timer = setTimeout(() => { stop(); message.replaceChildren(status('err', 'Pattern exceeded the 1-second limit. Simplify nested quantifiers or shorten the test text.')); }, 1000);
    worker.onerror = () => { stop(); message.replaceChildren(status('err', 'The regex worker could not run. Reload the page and try again.')); };
    worker.onmessage = ({ data }) => {
      stop();
      if (data.error) { message.replaceChildren(status('err', data.error)); return; }
      message.replaceChildren(status('ok', `${data.matches.length}${data.capped ? '+' : ''} matches${data.capped ? ' (display limited to 1,000)' : ''}.`));
      let cursor = 0;
      data.matches.forEach((match, i) => {
        highlighted.append(text.value.slice(cursor, match.index), h('mark', { class: i % 2 ? 'hit hit--alt' : 'hit', text: match.text || '▏', title: `Match ${i + 1} at index ${match.index}` }));
        cursor = match.index + match.text.length;
        if (match.captures.length && i < 100) groups.append(h('pre', { class: 'output output--sm', text: JSON.stringify({ match: i + 1, index: match.index, captures: match.captures, named: match.groups }, null, 2) }));
      });
      highlighted.append(text.value.slice(cursor));
      replaced.value = data.output;
    };
    worker.postMessage({ pattern: pattern.value, flags: flags.value, text: text.value, replacement: replacement.value });
  }
  for (const control of [pattern, flags, text, replacement]) control.addEventListener('input', () => { stop(); clearTimeout(delay); delay = setTimeout(run, 250); });
  root.append(h('div', { class: 'panes' }, field({ label: 'Pattern (without slashes)', control: pattern }), field({ label: 'Flags', control: flags, hint: 'JavaScript flags: d g i m s u v y' })),
    h('div', { class: 'panes' }, field({ label: 'Test text', control: text }), h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: 'Matches' }), highlighted)), message,
    field({ label: 'Replace with', control: replacement }), field({ label: 'Replacement preview', control: replaced }), copyButton(() => replaced.value), groups);
  return () => { stop(); clearTimeout(delay); };
}
