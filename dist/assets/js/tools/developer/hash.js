import { h, textarea, input, select, field, button, copyButton, status } from '../../core/dom.js';

export function md5(bytes) {
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(size);
  data.set(bytes); data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  const bits = BigInt(bytes.length) * 8n;
  view.setUint32(size - 8, Number(bits & 0xffffffffn), true);
  view.setUint32(size - 4, Number(bits >> 32n), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  for (let offset = 0; offset < size; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const sum = (a + f + constants[i] + view.getUint32(offset + g * 4, true)) | 0;
      const shift = shifts[Math.floor(i / 16) * 4 + i % 4];
      [a, b, c, d] = [d, (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0, b, c];
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const digest = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => digest.setUint32(i * 4, v, true));
  return [...new Uint8Array(digest.buffer)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export async function digestBytes(bytes, algorithm, key) {
  if (algorithm === 'MD5') {
    if (key !== undefined) throw new Error('HMAC is supported only for SHA algorithms.');
    return md5(bytes);
  }
  const digest = key === undefined ? await crypto.subtle.digest(algorithm, bytes) : await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key === '' ? new Uint8Array([0]) : new TextEncoder().encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign']), bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function hashTool(root) {
  const text = textarea();
  const algorithm = select(['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1', 'MD5']);
  const mode = select([['hash', 'Hash'], ['hmac', 'HMAC']]);
  const key = input({ type: 'password', autocomplete: 'off', disabled: true });
  const output = textarea({ readOnly: true, class: 'textarea textarea--sm' });
  const message = h('div');
  const run = button('Compute digest', { variant: 'primary', onclick: async () => {
    run.disabled = true; message.replaceChildren(status('info', 'Computing…')); output.value = '';
    try {
      if (text.value.length > 5000000) throw new Error('Limit text to 5 million characters.');
      output.value = await digestBytes(new TextEncoder().encode(text.value), algorithm.value, mode.value === 'hmac' ? key.value : undefined);
      message.replaceChildren(status('ok', `${algorithm.value}${mode.value === 'hmac' ? ' HMAC' : ''} computed from UTF-8 input.`));
    } catch (error) { message.replaceChildren(status('err', error.message)); }
    finally { run.disabled = false; }
  } });
  mode.addEventListener('change', () => { key.disabled = mode.value !== 'hmac'; });
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Algorithm', control: algorithm }), field({ label: 'Operation', control: mode })),
    field({ label: 'Text', control: text }), field({ label: 'HMAC key', control: key, hint: 'Not saved. MD5 and SHA-1 are unsuitable for security-sensitive hashing.' }),
    h('div', { class: 'toolbar' }, run, copyButton(() => output.value)), field({ label: 'Hex digest', control: output }), message);
}
