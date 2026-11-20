import { h, textarea, field, button, select, copyButton, status, kv } from '../../core/dom.js';

export function encodeBase64(text, url = false) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  return url ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
}

export function decodeBase64(text, url = false) {
  let value = text.replace(/\s/g, '');
  if (url) value = value.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error('Invalid Base64 alphabet or length.');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function transformTool(root, { options, encode, decode, inspect }) {
  const source = textarea();
  const output = textarea({ readOnly: true });
  const mode = options ? select(options) : null;
  const message = h('div');
  const details = h('div');
  function run(fn) {
    try {
      output.value = fn(source.value, mode?.value);
      message.replaceChildren();
      details.replaceChildren(...(inspect ? inspect(source.value) : []));
    } catch (error) { output.value = ''; details.replaceChildren(); message.replaceChildren(status('err', error.message)); }
  }
  root.append(h('div', { class: 'toolbar' }, mode ? field({ label: 'Mode', control: mode }) : null,
    button('Encode', { variant: 'primary', onclick: () => run(encode) }), button('Decode', { onclick: () => run(decode) }),
    button('Swap', { onclick: () => { [source.value, output.value] = [output.value, source.value]; message.replaceChildren(); details.replaceChildren(); } }), copyButton(() => output.value)),
    h('div', { class: 'panes' }, field({ label: 'Input', control: source }), field({ label: 'Output', control: output })), message, details);
}

export function base64Tool(root) {
  transformTool(root, { options: [['standard', 'Base64'], ['url', 'Base64URL']], encode: (v, mode) => encodeBase64(v, mode === 'url'), decode: (v, mode) => decodeBase64(v, mode === 'url') });
}

export function urlTool(root) {
  transformTool(root, {
    options: [['component', 'URL component'], ['uri', 'Full URI']],
    encode: (v, mode) => mode === 'uri' ? encodeURI(v) : encodeURIComponent(v),
    decode: (v, mode) => mode === 'uri' ? decodeURI(v) : decodeURIComponent(v),
    inspect: value => {
      try {
        const url = new URL(value);
        return [kv([['Protocol', url.protocol], ['Host', url.host], ['Path', url.pathname], ['Fragment', url.hash], ...[...url.searchParams].map(([k, v]) => [`Query: ${k}`, v || '(empty)'])])];
      } catch { return []; }
    },
  });
}

export function entitiesTool(root) {
  transformTool(root, {
    encode: text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    decode: text => text.replace(/&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, entity => {
      const node = document.createElement('textarea');
      node.innerHTML = entity;
      return node.value;
    }),
  });
}

export function jwtTool(root) {
  const source = textarea({ placeholder: 'eyJ…', autocomplete: 'off' });
  const result = h('div', { class: 'stack' });
  function run() {
    result.replaceChildren();
    if (!source.value.trim()) return;
    try {
      const parts = source.value.trim().split('.');
      if (parts.length !== 3) throw new Error('A signed JWT has three dot-separated parts. Encrypted JWE tokens are not supported.');
      const header = JSON.parse(decodeBase64(parts[0], true));
      const payload = JSON.parse(decodeBase64(parts[1], true));
      if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JWT header and payload must be JSON objects.');
      result.append(status('info', 'Decoded only. The signature and claims have NOT been verified. Never use this result to grant access.'));
      const panes = h('div', { class: 'panes' });
      for (const [label, value] of [['Header', header], ['Payload', payload]]) {
        const text = JSON.stringify(value, null, 2);
        panes.append(h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: label }), h('pre', { class: 'output', text }), copyButton(text)));
      }
      result.append(panes);
      const now = Date.now() / 1000;
      const claims = [];
      for (const key of ['iat', 'nbf', 'exp']) {
        if (payload[key] === undefined) continue;
        if (typeof payload[key] !== 'number' || !Number.isFinite(new Date(payload[key] * 1000).getTime())) { claims.push([key, 'Invalid NumericDate']); continue; }
        const state = key === 'exp' ? (payload[key] <= now ? 'expired' : 'not expired') : key === 'nbf' ? (payload[key] > now ? 'not yet active' : 'active') : (payload[key] > now ? 'issued in the future' : 'issued');
        claims.push([key, `${new Date(payload[key] * 1000).toISOString()} (${state}; unverified)`]);
      }
      result.append(kv(claims));
    } catch (error) { result.append(status('err', error.message)); }
  }
  source.addEventListener('input', run);
  root.append(field({ label: 'JSON Web Token', control: source, hint: 'Not saved or sent to a server.' }), result);
}
