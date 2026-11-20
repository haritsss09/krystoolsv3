import { h, input, field, button, status, kv, formatBytes } from '../../core/dom.js';
import { digestBytes } from '../developer/hash.js';

export const FILE_HASH_ALGORITHMS = Object.freeze(['SHA-256', 'SHA-512', 'SHA-1', 'MD5']);
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export async function hashFileBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Expected file bytes.');
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('This tool supports files up to 32 MiB. Use a local command-line checksum tool for larger files.');
  const hashes = {};
  for (const algorithm of FILE_HASH_ALGORITHMS) hashes[algorithm] = await digestBytes(bytes, algorithm);
  return hashes;
}

export function compareChecksum(hashes, value) {
  const expected = String(value).trim().toLowerCase();
  const algorithm = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 128: 'SHA-512' }[expected.length];
  if (!algorithm || !/^[0-9a-f]+$/.test(expected)) throw new Error('Paste only a hexadecimal MD5, SHA-1, SHA-256 or SHA-512 checksum, without a filename or prefix.');
  if (!hashes?.[algorithm]) throw new Error('Compute the file hashes before comparing.');
  return { algorithm, matches: hashes[algorithm].toLowerCase() === expected };
}

export function fileHashTool(root) {
  let sequence = 0, alive = true, hashes = null;
  const file = input({ type: 'file' });
  const expected = input({ placeholder: 'Optional hexadecimal checksum', maxlength: 128 });
  const output = h('div', { class: 'stack', 'aria-live': 'polite' }, status('info', 'Choose a local file, then compute its checksums.'));
  const comparison = h('div', { 'aria-live': 'polite' });
  const compare = () => {
    comparison.replaceChildren();
    if (!expected.value.trim()) return;
    try {
      const result = compareChecksum(hashes, expected.value);
      comparison.append(status(result.matches ? 'ok' : 'err', result.matches ? `${result.algorithm} matches. This confirms checksum equality, not the trustworthiness of the file or checksum source.` : `${result.algorithm} does not match the expected checksum.`));
    } catch (err) { comparison.append(status('err', err.message)); }
  };
  expected.addEventListener('input', compare);
  const run = button('Compute file hashes', { variant: 'primary', type: 'submit' });
  const form = h('form', { class: 'stack', onsubmit: async e => {
    e.preventDefault(); const id = ++sequence; hashes = null; comparison.replaceChildren();
    const selected = file.files?.[0];
    if (!selected) { output.replaceChildren(status('err', 'Choose a file first.')); return; }
    if (selected.size > MAX_FILE_BYTES) { output.replaceChildren(status('err', 'The file exceeds the 32 MiB limit. Use a local command-line checksum tool.')); return; }
    run.disabled = true; output.replaceChildren(status('info', `Reading and hashing ${selected.name} locally...`));
    output.setAttribute('aria-busy', 'true');
    try {
      const result = await hashFileBytes(new Uint8Array(await selected.arrayBuffer()));
      if (!alive || id !== sequence) return;
      hashes = result;
      output.replaceChildren(kv([['File', selected.name], ['Size', `${selected.size} bytes (${formatBytes(selected.size)})`], ...Object.entries(hashes)]));
      compare();
    } catch (err) { if (alive && id === sequence) output.replaceChildren(status('err', err.message || 'Unable to read or hash this file.')); }
    finally { if (alive && id === sequence) { run.disabled = false; output.setAttribute('aria-busy', 'false'); } }
  } }, field({ label: 'Local file', control: file, hint: 'Maximum 32 MiB. The entire file is held in memory; no upload is made.' }), run);
  file.addEventListener('change', () => { sequence++; hashes = null; run.disabled = false; output.setAttribute('aria-busy', 'false'); output.replaceChildren(status('info', 'File selection changed. Compute its checksums to continue.')); comparison.replaceChildren(); });
  root.append(form, status('info', 'MD5 and SHA-1 are for legacy checksum compatibility, not collision-resistant security verification. Use a checksum from a trusted source.'), output, field({ label: 'Expected checksum (optional)', control: expected }), comparison);
  return () => { alive = false; sequence++; hashes = null; file.value = ''; expected.removeEventListener('input', compare); form.remove(); };
}
