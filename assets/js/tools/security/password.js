import { h, input, textarea, select, checkbox, field, button, status, kv, copyText } from '../../core/dom.js';

export const PASSPHRASE_WORDS = Object.freeze(('acorn amber anchor apple arch arrow atlas autumn bamboo beach birch bloom blue boat branch breeze brick brook cedar cherry chestnut clay cloud coast coral crane creek dawn delta dune eagle earth elm ember fern field finch flame flint forest frost garden glass glade grain grape grass grove harbor hazel hill honey island ivory jade juniper lake lantern leaf lemon lilac lime linen lotus maple marble meadow mint moon moss mountain oak ocean olive onyx orange orchid otter palm paper peach pearl pebble pine plum pond poppy quartz rain raven reed ridge river robin rock rose sage sand shell shore silver sky slate snow solar sparrow spring spruce star stone storm stream summit sun swift thorn tide tiger timber trail tulip valley violet wave wheat willow wind winter wolf wood wren').split(' '));
export const CHARACTER_SETS = Object.freeze({ lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?' });

export function randomIndex(size, fill = a => globalThis.crypto.getRandomValues(a)) {
  if (!Number.isInteger(size) || size < 1 || size > 0x100000000) throw new Error('Random pool size is out of range.');
  const limit = Math.floor(0x100000000 / size) * size;
  const value = new Uint32Array(1);
  do { fill(value); } while (value[0] >= limit);
  return value[0] % size;
}

export function generateSecret({ mode = 'characters', length = 20, pool = Object.values(CHARACTER_SETS).join(''), words = PASSPHRASE_WORDS, separator = '-' } = {}, fill) {
  if (!['characters', 'passphrase'].includes(mode)) throw new Error('Unknown generation mode.');
  const items = [...new Set(mode === 'passphrase' ? words : [...pool])];
  if (items.length < 2 || items.some(item => typeof item !== 'string' || !item || (mode === 'passphrase' && /[^a-z]/.test(item)))) throw new Error('Choose a pool with at least two distinct valid entries.');
  if (mode === 'passphrase' && !['-', ' ', '.'].includes(separator)) throw new Error('Choose a dash, space or dot separator.');
  if (!Number.isInteger(length) || length < 1 || length > (mode === 'passphrase' ? 32 : 128)) throw new Error('Length is outside the supported range.');
  const value = Array.from({ length }, () => items[randomIndex(items.length, fill)]).join(mode === 'passphrase' ? separator : '');
  return { value, poolSize: items.length, entropy: length * Math.log2(items.length) };
}

const COMMON = ['password', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'secret', 'login', 'abc123', '123456', 'trustno1'];

export function estimatePasswordStrength(value) {
  const chars = [...String(value)], length = chars.length;
  if (length > 4096) throw new Error('Limit input to 4096 characters.');
  const lower = String(value).toLowerCase(), normalized = lower.replace(/[@4]/g, 'a').replace(/[03]/g, c => c === '0' ? 'o' : 'e').replace(/[1!]/g, 'i').replace(/[$5]/g, 's').replace(/7/g, 't');
  const findings = [];
  let score = length >= 20 ? 4 : length >= 14 ? 3 : length >= 10 ? 2 : length >= 8 ? 1 : 0;
  if (length < 12) findings.push('Short length makes guessing easier. Prefer a longer, unique generated password.');
  if (COMMON.some(word => lower.includes(word) || normalized.includes(word))) { score = Math.min(score, 1); findings.push('Contains a common password or a predictable substitution.'); }
  const runs = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  if (runs.some(run => [run, [...run].reverse().join('')].some(s => Array.from({ length: s.length - 3 }, (_, i) => s.slice(i, i + 4)).some(part => lower.includes(part))))) { score = Math.max(0, score - 1); findings.push('Contains a numeric, alphabetic or keyboard sequence.'); }
  if (/(.)\1{2,}/u.test(value) || /^(.{1,32})\1+$/u.test(value) || (length > 4 && new Set(chars).size <= 3)) { score = Math.min(score, 1); findings.push('Repeated characters or blocks make this predictable.'); }
  if (/(?:19|20)\d{2}|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(value)) { score = Math.max(0, score - 1); findings.push('Contains a year or date-like pattern.'); }
  const words = lower.split(/[^a-z]+/).filter(Boolean);
  if (words.some(word => PASSPHRASE_WORDS.includes(word)) || COMMON.some(word => normalized.includes(word))) { score = Math.max(0, score - 1); findings.push('Contains words in this checker’s small dictionary. Randomly chosen words and human phrases cannot be distinguished here.'); }
  if (/^\d+$/.test(value)) { score = Math.min(score, 1); findings.push('Uses only decimal digits.'); }
  if (!findings.length) findings.push('No pattern detected by this limited checker. That is not proof of strength.');
  return { length, score, label: ['Very weak estimate', 'Weak estimate', 'Moderate estimate', 'Higher estimate', 'Higher estimate'][score], findings };
}

export function passwordGenTool(root) {
  let alive = true;
  const mode = select([['characters', 'Characters'], ['passphrase', 'Passphrase']]);
  const length = input({ type: 'number', min: 1, max: 128, value: 20 });
  const count = input({ type: 'number', min: 1, max: 20, value: 1 });
  const separator = select([['-', 'Dash'], [' ', 'Space'], ['.', 'Dot']], { disabled: true });
  const options = Object.entries(CHARACTER_SETS).map(([key, pool]) => ({ key, pool, ...checkbox({ lower: 'Lowercase', upper: 'Uppercase', digits: 'Digits', symbols: 'Symbols' }[key], { checked: true }) }));
  const exclude = checkbox('Exclude ambiguous characters (I, l, 1, O, 0)');
  const output = textarea({ readOnly: true, autocomplete: 'off' });
  const message = h('div', { 'aria-live': 'polite' }, status('info', 'Choose a mode and generate. Secrets are not saved by this tool.'));
  const lengthField = field({ label: 'Characters per password', control: length });
  const charControls = h('div', { class: 'stack' }, h('div', { class: 'toolbar' }, options.map(o => o.el)), exclude.el);
  mode.addEventListener('change', () => {
    const phrase = mode.value === 'passphrase';
    length.value = phrase ? '12' : '20'; length.max = phrase ? '32' : '128';
    lengthField.querySelector('label span').textContent = phrase ? 'Words per passphrase' : 'Characters per password';
    charControls.hidden = phrase; separator.disabled = !phrase;
  });
  const form = h('form', { class: 'stack', onsubmit: e => {
    e.preventDefault(); output.value = '';
    try {
      const total = Number(count.value);
      if (!Number.isInteger(total) || total < 1 || total > 20) throw new Error('Generate between 1 and 20 secrets at once.');
      let pool = options.filter(o => o.box.checked).map(o => o.pool).join('');
      if (exclude.box.checked) pool = pool.replace(/[Il1O0]/g, '');
      const results = Array.from({ length: total }, () => generateSecret({ mode: mode.value, length: Number(length.value), pool, separator: separator.value }));
      output.value = results.map(r => r.value).join('\n');
      const r = results[0];
      message.replaceChildren(status('ok', `Generated ${total}. ${r.entropy.toFixed(1)} bits per secret under independent uniform selection from ${r.poolSize} ${mode.value === 'passphrase' ? 'words' : 'characters'}.`), status('info', mode.value === 'passphrase' ? 'This bundled dictionary is small. Entropy uses its actual size; separators add no entropy. Repeated words are allowed. Do not shorten or hand-pick the result.' : 'Selected sets form one pool; each set is not guaranteed to appear. Repeated characters are allowed. Entropy assumes you use the generated result unchanged.'));
    } catch (err) { message.replaceChildren(status('err', err.message)); }
  } }, field({ label: 'Mode', control: mode }), h('div', { class: 'toolbar' }, lengthField, field({ label: 'Number to generate', control: count }), field({ label: 'Word separator', control: separator })), charControls,
  h('p', { class: 'field__hint', text: `Passphrases use a bundled pool of ${PASSPHRASE_WORDS.length} words. All choices use crypto.getRandomValues with rejection sampling.` }),
  button('Generate secrets', { type: 'submit', variant: 'primary' }));
  const copy = button('Copy generated secrets', { onclick: async () => {
    if (!output.value) { message.replaceChildren(status('err', 'Generate a secret before copying.')); return; }
    try { const ok = await copyText(output.value); if (alive) message.replaceChildren(status(ok ? 'ok' : 'err', ok ? 'Copied. Your clipboard now contains the generated secrets.' : 'Copy failed. Select and copy the output manually.')); }
    catch { if (alive) message.replaceChildren(status('err', 'Copy failed. Select and copy the output manually.')); }
  } });
  root.append(form, field({ label: 'Generated secrets', control: output }), copy, message);
  return () => { alive = false; output.value = ''; form.remove(); };
}

export function passwordStrengthTool(root) {
  const secret = input({ type: 'password', autocomplete: 'off', maxlength: 4096 });
  const show = checkbox('Show password');
  const output = h('div', { 'aria-live': 'polite' });
  show.box.addEventListener('change', () => { secret.type = show.box.checked ? 'text' : 'password'; });
  const update = () => {
    if (!secret.value) { output.replaceChildren(status('info', 'Enter a password to see a local, heuristic estimate.')); return; }
    try {
      const result = estimatePasswordStrength(secret.value);
      output.replaceChildren(kv([['Assessment', result.label], ['Length (Unicode code points)', result.length]]), h('ul', null, result.findings.map(text => h('li', { text }))));
    } catch (err) { output.replaceChildren(status('err', err.message)); }
  };
  secret.addEventListener('input', update);
  root.append(field({ label: 'Password to assess', control: secret }), show.el,
    status('info', 'Estimated guessability, not measured entropy or a crack-time prediction. The small pattern list cannot check breaches, reuse, personal details or all languages. Nothing entered is sent or saved by this tool.'), output);
  update();
  return () => { secret.removeEventListener('input', update); secret.value = ''; };
}
