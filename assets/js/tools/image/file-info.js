import { h, field, input, select, panel, kv, formatBytes } from '../../core/dom.js';
import { stack, action, message } from './image.js';

export function detectFileType(bytes) {
  const at = (offset, values) => values.every((value, i) => bytes[offset + i] === value);
  const ascii = (offset, value) => at(offset, Array.from(value, (c) => c.charCodeAt(0)));
  const found = (name, mime, note = 'Signature match; not a validation of the full file.') => ({ name, mime, note });
  if (at(0, [137, 80, 78, 71, 13, 10, 26, 10])) return found('PNG image', 'image/png');
  if (at(0, [255, 216, 255])) return found('JPEG image', 'image/jpeg');
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return found('GIF image', 'image/gif');
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return found('WebP image', 'image/webp');
  if (ascii(0, 'BM')) return found('BMP image', 'image/bmp');
  if (at(0, [73, 73, 42, 0]) || at(0, [77, 77, 0, 42])) return found('TIFF image', 'image/tiff');
  if (at(0, [0, 0, 1, 0])) return found('Windows icon', 'image/x-icon');
  if (ascii(0, '%PDF-')) return found('PDF document', 'application/pdf');
  if (at(0, [80, 75, 3, 4]) || at(0, [80, 75, 5, 6]) || at(0, [80, 75, 7, 8])) return found('ZIP container', 'application/zip', 'May be ZIP, Office Open XML, EPUB, APK or another ZIP-based format. Container contents are not inspected.');
  if (at(0, [31, 139, 8])) return found('Gzip archive', 'application/gzip');
  if (ascii(0, 'BZh')) return found('Bzip2 archive', 'application/x-bzip2');
  if (at(0, [253, 55, 122, 88, 90, 0])) return found('XZ archive', 'application/x-xz');
  if (at(0, [55, 122, 188, 175, 39, 28])) return found('7-Zip archive', 'application/x-7z-compressed');
  if (ascii(0, 'Rar!\x1a\x07')) return found('RAR archive', 'application/vnd.rar');
  if (ascii(257, 'ustar')) return found('TAR archive', 'application/x-tar');
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return found('WAV audio', 'audio/wav');
  if (ascii(0, 'RIFF') && ascii(8, 'AVI ')) return found('AVI video', 'video/x-msvideo');
  if (ascii(0, 'fLaC')) return found('FLAC audio', 'audio/flac');
  if (ascii(0, 'OggS')) return found('Ogg container', 'application/ogg');
  if (ascii(0, 'ID3') || (bytes.length > 2 && bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0)) return found('Likely MP3 audio', 'audio/mpeg');
  if (at(0, [26, 69, 223, 163])) return found('Matroska / WebM container', 'video/x-matroska');
  if (ascii(4, 'ftyp') && bytes.length >= 12) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (['avif', 'avis'].includes(brand)) return found('AVIF image', 'image/avif');
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return found('HEIC image', 'image/heic');
    if (['mif1', 'msf1'].includes(brand)) return found('HEIF image container', 'image/heif');
    if (brand === 'qt  ') return found('QuickTime container', 'video/quicktime');
    return found(`ISO base media container (${brand.replace(/[^\x20-\x7e]/g, '?')})`, 'video/mp4', 'MP4-family container; may contain video, audio or images.');
  }
  if (ascii(0, 'SQLite format 3\0')) return found('SQLite database', 'application/vnd.sqlite3');
  if (at(0, [0, 97, 115, 109])) return found('WebAssembly module', 'application/wasm');
  if (at(0, [127, 69, 76, 70])) return found('ELF executable / object', 'application/x-elf');
  if (ascii(0, 'MZ')) return found('DOS / Windows executable', 'application/vnd.microsoft.portable-executable', 'MZ signature only; the PE header is not validated.');
  if (at(0, [208, 207, 17, 224, 161, 177, 26, 225])) return found('OLE compound document', 'application/x-ole-storage', 'May be a legacy Office document or another compound format.');
  if (ascii(0, 'wOFF')) return found('WOFF font', 'font/woff');
  if (ascii(0, 'wOF2')) return found('WOFF2 font', 'font/woff2');
  if (ascii(0, 'OTTO')) return found('OpenType font', 'font/otf');
  if (at(0, [0, 1, 0, 0])) return found('TrueType font', 'font/ttf');
  if (!bytes.length) return found('Empty file', '', 'No bytes to inspect.');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    if (text && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return found('Likely UTF-8 text', 'text/plain', 'Heuristic from the first 4 KB, not a magic signature. Text formats cannot be reliably identified this way.');
  } catch { /* Binary or another text encoding has no reliable signature here. */ }
  return found('Unknown binary / unsupported signature', '', 'No known signature in the inspected header. The filename and browser MIME type are not proof of format.');
}

export function hexDump(bytes, offset = 0) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16);
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = Array.from(row, (b) => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
    lines.push(`${(offset + i).toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}

export function fileInfoTool(root) {
  const file = input({ type: 'file' });
  const offset = input({ type: 'number', min: 0, step: 1, value: 0 });
  const count = select([['256', '256 bytes'], ['1024', '1 KB'], ['4096', '4 KB']], { value: '256' });
  const inspect = action('Read hex range', { disabled: true });
  const feedback = h('div'), info = h('div'), hex = h('pre', { class: 'output', tabindex: 0, 'aria-label': 'Hexadecimal file bytes', style: 'white-space:pre;max-width:100%' });
  let version = 0, alive = true, chosen = null;
  message(feedback, 'info', 'Choose any local file. Only a 4 KB header and the selected hex range are read, so large files do not need to be loaded into memory.');
  const readRange = async () => {
    if (!chosen) return;
    const id = ++version, current = chosen; hex.textContent = '';
    message(feedback, 'info', 'Reading file bytes locally…');
    try {
      const start = Number(offset.value);
      if (!Number.isSafeInteger(start) || start < 0 || start > current.size) throw new Error(`Offset must be a whole number from 0 to ${current.size}.`);
      const bytes = new Uint8Array(await current.slice(start, start + Number(count.value)).arrayBuffer());
      if (!alive || id !== version) return;
      hex.textContent = bytes.length ? hexDump(bytes, start) : '(No bytes at this offset.)';
      message(feedback, 'ok', `Read ${bytes.length} bytes at decimal offset ${start} (0x${start.toString(16)}). No file content is executed.`);
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  };
  file.addEventListener('change', async () => {
    const id = ++version; chosen = file.files[0]; offset.value = 0; info.replaceChildren(); hex.textContent = ''; inspect.disabled = true;
    if (!chosen) { message(feedback, 'info', 'Choose a local file.'); return; }
    const current = chosen;
    message(feedback, 'info', 'Inspecting file signature locally…');
    try {
      const bytes = new Uint8Array(await current.slice(0, 4096).arrayBuffer());
      if (!alive || id !== version) return;
      const type = detectFileType(bytes);
      info.replaceChildren(stack(kv([['Filename', current.name], ['Exact size', `${current.size.toLocaleString()} bytes (${formatBytes(current.size)})`], ['Browser MIME', current.type || 'Not provided'], ['Detected type', type.name], ['Detected MIME', type.mime || 'Unknown'], ['Last modified', new Date(current.lastModified).toLocaleString()]]), h('p', { class: 'field__hint', text: type.note })));
      inspect.disabled = false; await readRange();
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  inspect.addEventListener('click', readRange);
  root.append(panel('File details', stack(field({ label: 'Local file', control: file }), feedback, info)), panel('Hex preview', stack(h('div', { class: 'panes' }, field({ label: 'Start offset (decimal bytes)', control: offset }), field({ label: 'Bytes to display', control: count })), inspect, hex)));
  return () => { alive = false; version++; chosen = null; };
}
