import { h, field, input, panel, kv, formatBytes } from '../../core/dom.js';
import { stack, message } from './image.js';

const HEADER_LIMIT = 8 * 1024 * 1024;

export function parseExif(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const requireBytes = (at, length, end = bytes.length) => {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(length) || at < 0 || length < 0 || at + length > end) throw new Error('Truncated or invalid JPEG/EXIF offsets.');
  };
  requireBytes(0, 2);
  if (view.getUint16(0) !== 0xffd8) throw new Error('This is not a JPEG file. Only JPEG EXIF is supported.');
  let start = -1, end = 0;
  for (let p = 2; p < bytes.length;) {
    requireBytes(p, 2);
    if (bytes[p++] !== 255) throw new Error('Invalid JPEG marker before image data.');
    while (p < bytes.length && bytes[p] === 255) p++;
    requireBytes(p, 1);
    const marker = bytes[p++];
    if (marker === 218 || marker === 217) return { fields: [], found: false };
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    requireBytes(p, 2);
    const size = view.getUint16(p);
    if (size < 2) throw new Error('Invalid JPEG segment length.');
    requireBytes(p, size);
    if (marker === 225 && size >= 8 && String.fromCharCode(...bytes.subarray(p + 2, p + 8)) === 'Exif\0\0') {
      start = p + 8; end = p + size; break;
    }
    p += size;
  }
  if (start < 0) throw new Error('No complete EXIF header found in the first 8 MB, or the JPEG is truncated.');
  const bound = (at, n) => { if (at < start) throw new Error('EXIF offset precedes TIFF header.'); requireBytes(at, n, end); };
  bound(start, 8);
  const order = view.getUint16(start), little = order === 0x4949;
  if (!little && order !== 0x4d4d) throw new Error('Invalid EXIF byte order.');
  const u16 = (at) => { bound(at, 2); return view.getUint16(at, little); };
  const u32 = (at) => { bound(at, 4); return view.getUint32(at, little); };
  if (u16(start + 2) !== 42) throw new Error('Unsupported TIFF header.');
  const visited = new Set();
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const readIFD = (offset) => {
    const result = new Map();
    if (!offset) return result;
    if (!Number.isInteger(offset) || offset < 8 || visited.has(offset) || visited.size >= 4) throw new Error('Invalid or cyclic EXIF directory pointer.');
    visited.add(offset);
    const at = start + offset, count = u16(at);
    if (count > 1024) throw new Error('EXIF directory exceeds the 1,024-entry safety limit.');
    bound(at + 2, count * 12 + 4);
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12, tag = u16(entry), type = u16(entry + 2), countValues = u32(entry + 4), size = sizes[type];
      if (!size || !countValues) continue;
      const length = size * countValues;
      if (length > 65536) throw new Error('EXIF field is too large.');
      const data = length <= 4 ? entry + 8 : start + u32(entry + 8);
      bound(data, length);
      if (type === 2) {
        const string = new TextDecoder('ascii').decode(bytes.subarray(data, data + Math.min(length, 4096))).split('\0')[0].replace(/[\x00-\x1f\x7f]/g, '').trim();
        result.set(tag, string); continue;
      }
      if (countValues > 64) continue;
      const values = [];
      for (let j = 0; j < countValues; j++) {
        const p = data + j * size;
        if (type === 1 || type === 7) values.push(bytes[p]);
        else if (type === 3) values.push(u16(p));
        else if (type === 4) values.push(u32(p));
        else if (type === 9) values.push(view.getInt32(p, little));
        else {
          const numerator = type === 10 ? view.getInt32(p, little) : u32(p);
          const denominator = type === 10 ? view.getInt32(p + 4, little) : u32(p + 4);
          values.push(denominator ? numerator / denominator : null);
        }
      }
      result.set(tag, values.length === 1 ? values[0] : values);
    }
    return result;
  };
  const main = readIFD(u32(start + 4));
  const exif = readIFD(main.get(0x8769));
  const gps = readIFD(main.get(0x8825));
  const fields = [];
  const add = (name, value) => { if (value != null && value !== '' && !Array.isArray(value)) fields.push([name, String(value)]); };
  const numeric = (map, tag, transform) => { const value = map.get(tag); return typeof value === 'number' && Number.isFinite(value) ? transform(value) : null; };
  add('Camera make', main.get(0x010f)); add('Camera model', main.get(0x0110));
  add('Lens make', exif.get(0xa433)); add('Lens model', exif.get(0xa434));
  const lens = exif.get(0xa432);
  if (Array.isArray(lens) && lens.length === 4 && lens.every((v) => typeof v === 'number' && Number.isFinite(v))) add('Lens specification', `${lens[0]}–${lens[1]} mm, f/${lens[2]}–${lens[3]}`);
  add('Date taken (camera local)', exif.get(0x9003)); add('Date digitized', exif.get(0x9004)); add('Date modified', main.get(0x0132)); add('Timezone offset', exif.get(0x9011));
  add('Exposure time', numeric(exif, 0x829a, (v) => v > 0 && v < 1 ? `1/${(1 / v).toFixed(1).replace(/\.0$/, '')} s` : `${v} s`));
  add('Aperture', numeric(exif, 0x829d, (v) => `f/${Number(v.toFixed(2))}`));
  add('ISO', exif.get(0x8827)); add('Exposure bias', numeric(exif, 0x9204, (v) => `${Number(v.toFixed(2))} EV`));
  add('Focal length', numeric(exif, 0x920a, (v) => `${Number(v.toFixed(2))} mm`));
  add('35 mm equivalent', numeric(exif, 0xa405, (v) => `${v} mm`));
  add('Flash (EXIF code)', exif.get(0x9209)); add('Orientation (EXIF code)', main.get(0x0112));
  add('Pixel width', exif.get(0xa002)); add('Pixel height', exif.get(0xa003)); add('Software', main.get(0x0131));
  const coordinate = (tag, refTag, max, refs) => {
    const values = gps.get(tag), ref = gps.get(refTag);
    if (!Array.isArray(values) || values.length !== 3 || !values.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0) || !refs.includes(ref) || values[1] >= 60 || values[2] >= 60) return null;
    const value = values[0] + values[1] / 60 + values[2] / 3600;
    return value <= max ? value * (ref === refs[1] ? -1 : 1) : null;
  };
  const lat = coordinate(2, 1, 90, ['N', 'S']), lon = coordinate(4, 3, 180, ['E', 'W']);
  if (lat !== null && lon !== null) {
    add('GPS latitude', lat.toFixed(6)); add('GPS longitude', lon.toFixed(6));
  }
  add('GPS altitude', numeric(gps, 6, (v) => `${Number((v * (gps.get(5) === 1 ? -1 : 1)).toFixed(2))} m`));
  add('GPS date (UTC)', gps.get(29));
  const time = gps.get(7);
  if (Array.isArray(time) && time.length === 3 && time.every((v) => typeof v === 'number' && Number.isFinite(v))) add('GPS time (UTC)', time.map((v) => String(Number(v.toFixed(3))).padStart(2, '0')).join(':'));
  return { found: true, fields };
}

export function exifTool(root) {
  const file = input({ type: 'file', accept: 'image/jpeg,.jpg,.jpeg' });
  const feedback = h('div'), result = h('div');
  let version = 0, alive = true;
  message(feedback, 'info', 'Choose a JPEG to read camera, lens, exposure, dates and GPS. Only the first 8 MB is inspected. GPS is displayed as text, never requested from a map service.');
  file.addEventListener('change', async () => {
    const id = ++version, chosen = file.files[0]; result.replaceChildren();
    if (!chosen) { message(feedback, 'info', 'Choose a JPEG photo.'); return; }
    message(feedback, 'info', 'Reading JPEG metadata locally…');
    try {
      const bytes = new Uint8Array(await chosen.slice(0, HEADER_LIMIT).arrayBuffer());
      const parsed = parseExif(bytes);
      if (!alive || id !== version) return;
      result.replaceChildren(kv([['File', chosen.name], ['File size', formatBytes(chosen.size)], ...parsed.fields]));
      message(feedback, parsed.fields.length ? 'ok' : 'info', parsed.fields.length ? `${parsed.fields.length} EXIF fields found. Dates are recorded values, not verified timestamps.` : parsed.found ? 'EXIF exists, but none of the supported fields are present.' : 'No EXIF metadata found before the JPEG image data.');
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  root.append(panel('JPEG metadata', stack(field({ label: 'JPEG file', control: file }), feedback, result)));
  return () => { alive = false; version++; };
}
