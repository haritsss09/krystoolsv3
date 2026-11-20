import { h, input, textarea, field, select, button, copyButton, download, status } from '../../core/dom.js';

export function uuidV7(now = Date.now()) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = BigInt(now);
  for (let i = 5; i >= 0; i--) { bytes[i] = Number(time & 255n); time >>= 8n; }
  bytes[6] = 0x70 | (bytes[6] & 15);
  bytes[8] = 0x80 | (bytes[8] & 63);
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidTool(root) {
  const version = select([['4', 'UUID v4'], ['7', 'UUID v7']]);
  const count = input({ type: 'number', min: 1, max: 1000, value: 1 });
  const output = textarea({ readOnly: true });
  const message = h('div');
  function run() {
    const n = Number(count.value);
    if (!Number.isInteger(n) || n < 1 || n > 1000) { message.replaceChildren(status('err', 'Enter a count between 1 and 1,000.')); return; }
    output.value = Array.from({ length: n }, () => version.value === '7' ? uuidV7() : crypto.randomUUID()).join('\n');
    message.replaceChildren();
  }
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Version', control: version }), field({ label: 'Count', control: count }), button('Generate', { variant: 'primary', onclick: run }), copyButton(() => output.value), button('Download', { onclick: () => { if (output.value) download(output.value, 'uuids.txt'); } })),
    field({ label: 'UUIDs', control: output, hint: 'v7 sorts by millisecond timestamp. UUIDs generated within the same millisecond have random ordering.' }), message);
  run();
}

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

export function loremTool(root) {
  const mode = select([['paragraphs', 'Paragraphs'], ['sentences', 'Sentences'], ['words', 'Words']]);
  const count = input({ type: 'number', min: 1, max: 1000, value: 3 });
  const output = textarea({ readOnly: true, class: 'textarea textarea--prose' });
  const message = h('div');
  function run() {
    const n = Number(count.value);
    const max = mode.value === 'paragraphs' ? 100 : 1000;
    if (!Number.isInteger(n) || n < 1 || n > max) { output.value = ''; message.replaceChildren(status('err', `Enter a count from 1 to ${max}.`)); return; }
    let index = 0;
    const words = length => Array.from({ length }, () => WORDS[index++ % WORDS.length]).join(' ');
    const sentence = () => { const text = words(12 + Math.floor(Math.random() * 10)); return text[0].toUpperCase() + text.slice(1) + '.'; };
    output.value = mode.value === 'words' ? words(n) : Array.from({ length: n }, () => mode.value === 'sentences' ? sentence() : Array.from({ length: 4 }, sentence).join(' ')).join(mode.value === 'paragraphs' ? '\n\n' : ' ');
    message.replaceChildren();
  }
  mode.addEventListener('change', () => { count.max = mode.value === 'paragraphs' ? '100' : '1000'; });
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Generate', control: mode }), field({ label: 'Count', control: count }), button('Generate text', { variant: 'primary', onclick: run }), copyButton(() => output.value)), field({ label: 'Placeholder text', control: output }), message);
  run();
}
