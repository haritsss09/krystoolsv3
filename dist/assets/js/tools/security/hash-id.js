import { h, input, field, button, status, kv } from '../../core/dom.js';

export function identifyHash(value) {
  const hash = String(value).trim();
  if (!hash) throw new Error('Enter a hash string.');
  if (hash.length > 4096) throw new Error('Limit the hash to 4096 characters.');
  const candidates = [];
  const add = (name, reason) => candidates.push({ name, reason });
  if (/^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(hash)) add('bcrypt', 'Recognized bcrypt prefix, cost and encoded length.');
  if (/^\$argon2(?:id|i|d)\$(?:v=\d+\$)?m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.test(hash)) add('Argon2', 'Recognized Argon2 PHC structure; parameters are not verified.');
  if (/^\$1\$[^$]{1,8}\$[./A-Za-z0-9]{22}$/.test(hash)) add('MD5-crypt', 'Unix $1$ format, not a raw MD5 digest.');
  if (/^\$5\$(?:rounds=\d+\$)?[^$]{1,16}\$[./A-Za-z0-9]{43}$/.test(hash)) add('SHA-256-crypt', 'Unix $5$ format, not a raw SHA-256 digest.');
  if (/^\$6\$(?:rounds=\d+\$)?[^$]{1,16}\$[./A-Za-z0-9]{86}$/.test(hash)) add('SHA-512-crypt', 'Unix $6$ format, not a raw SHA-512 digest.');
  if (/^\{SSHA\}[A-Za-z0-9+/]+={0,2}$/i.test(hash)) add('LDAP salted SHA-1', 'Recognized {SSHA} prefix; payload not verified.');
  if (/^pbkdf2_sha256\$\d+\$[^$]+\$[A-Za-z0-9+/]+={0,2}$/.test(hash)) add('PBKDF2-HMAC-SHA256', 'Recognized Django-style prefix; parameters not verified.');
  if (/^[0-9a-f]+$/i.test(hash)) {
    const names = { 8: ['CRC-32', 'Adler-32'], 16: ['64-bit digest or truncated hash'], 32: ['MD5', 'MD4 / NTLM', '128-bit digest'], 40: ['SHA-1', 'RIPEMD-160'], 56: ['SHA-224', 'SHA3-224'], 64: ['SHA-256', 'SHA3-256', 'BLAKE2s-256'], 96: ['SHA-384', 'SHA3-384'], 128: ['SHA-512', 'SHA3-512', 'BLAKE2b-512'] };
    for (const name of names[hash.length] || []) add(name, `${hash.length} hexadecimal characters (${hash.length * 4} bits); length alone cannot distinguish these algorithms.`);
  }
  return { length: hash.length, candidates };
}

export function hashIdTool(root) {
  const hash = input({ placeholder: 'Paste a hash or encoded password hash', maxlength: 4096 });
  const output = h('div', { class: 'stack', 'aria-live': 'polite' }, status('info', 'Paste a hash to see format candidates.'));
  root.append(h('form', { class: 'stack', onsubmit: e => {
    e.preventDefault();
    try {
      const result = identifyHash(hash.value);
      output.replaceChildren(status('info', 'Candidates are not proof. Digests, random tokens and truncated outputs can look identical. No passwords are recovered or tested.'),
        ...(result.candidates.length ? result.candidates.map(c => kv([['Candidate', c.name], ['Evidence', c.reason]])) : [status('info', 'No recognized format. The value may be encoded, truncated, proprietary or malformed.') ]));
    } catch (err) { output.replaceChildren(status('err', err.message)); }
  } }, field({ label: 'Hash string', control: hash }), button('Identify candidates', { type: 'submit', variant: 'primary' })), output);
}
