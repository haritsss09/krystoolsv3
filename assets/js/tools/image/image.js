import { h, field, input, textarea, select, checkbox, button, panel, status, kv, copyText, download, formatBytes } from '../../core/dom.js';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 24 * 1024 * 1024;
const MAX_SIDE = 16384;
const BASE64_BYTES = 12 * 1024 * 1024;
export const rasterTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const stack = (...children) => h('div', { class: 'stack', style: 'display:flex;flex-direction:column;gap:var(--space-3);min-width:0' }, ...children);
export const action = (label, props = {}) => button(label, { style: 'min-height:44px', ...props });
export const message = (host, kind, text) => host.replaceChildren(status(kind, text));
export const previewImage = (alt) => h('img', { alt, style: 'max-width:100%;max-height:420px;width:auto;height:auto;object-fit:contain', width: 400, height: 300 });

export function imageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Invalid image dimensions.');
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) throw new Error('Image limit: 16,384 pixels per side and 24 megapixels. Resize the source elsewhere first.');
  return { width, height };
}

export function rasterInfo(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const has = (p, n) => p >= 0 && p + n <= bytes.length;
  const text = (p, n) => String.fromCharCode(...bytes.subarray(p, p + n));
  let type, width, height;
  if (has(0, 24) && bytes[0] === 137 && text(1, 7) === 'PNG\r\n\x1a\n' && text(12, 4) === 'IHDR') {
    type = 'image/png'; width = v.getUint32(16); height = v.getUint32(20);
  } else if (has(0, 10) && ['GIF87a', 'GIF89a'].includes(text(0, 6))) {
    type = 'image/gif'; width = v.getUint16(6, true); height = v.getUint16(8, true);
  } else if (has(0, 12) && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    type = 'image/webp';
    for (let p = 12; has(p, 8);) {
      const kind = text(p, 4), size = v.getUint32(p + 4, true), d = p + 8;
      if (!has(d, size)) throw new Error('Truncated WebP image.');
      const u24 = (at) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
      if (kind === 'VP8X' && size >= 10) { width = u24(d + 4) + 1; height = u24(d + 7) + 1; break; }
      if (kind === 'VP8L' && size >= 5 && bytes[d] === 47) {
        const bits = v.getUint32(d + 1, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; break;
      }
      if (kind === 'VP8 ' && size >= 10 && text(d + 3, 3) === '\x9d\x01\x2a') {
        width = v.getUint16(d + 6, true) & 0x3fff; height = v.getUint16(d + 8, true) & 0x3fff; break;
      }
      p = d + size + (size & 1);
    }
  } else if (has(0, 4) && bytes[0] === 255 && bytes[1] === 216) {
    type = 'image/jpeg';
    for (let p = 2; has(p, 2);) {
      if (bytes[p++] !== 255) throw new Error('Invalid JPEG marker.');
      while (has(p, 1) && bytes[p] === 255) p++;
      if (!has(p, 1)) break;
      const marker = bytes[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (!has(p, 2)) break;
      const size = v.getUint16(p);
      if (size < 2 || !has(p, size)) throw new Error('Truncated JPEG image.');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) {
        height = v.getUint16(p + 3); width = v.getUint16(p + 5); break;
      }
      p += size;
    }
  }
  if (!type || !width || !height) throw new Error('Unsupported or malformed image. Use JPEG, PNG, WebP or GIF. SVG is not accepted here.');
  return { type, ...imageDimensions(width, height) };
}

export async function validateRaster(blob, limit = MAX_BYTES) {
  if (!blob.size || blob.size > limit) throw new Error(`Choose a nonempty image up to ${formatBytes(limit)}.`);
  if (!rasterTypes.includes(blob.type.toLowerCase())) throw new Error('Unsupported MIME type. Only image/jpeg, image/png, image/webp and image/gif are accepted.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const info = rasterInfo(bytes);
  if (info.type !== blob.type.toLowerCase()) throw new Error('The image MIME type does not match its file signature.');
  return info;
}

export function loadRaster(blob, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Cancelled.')); return; }
    const url = URL.createObjectURL(blob), image = new Image();
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      URL.revokeObjectURL(url);
      if (error) { image.src = ''; reject(error); } else resolve(image);
    };
    const abort = () => finish(new Error('Cancelled.'));
    image.onload = () => {
      try { imageDimensions(image.naturalWidth, image.naturalHeight); finish(); } catch (error) { finish(error); }
    };
    image.onerror = () => finish(new Error('The browser could not decode this image. It may be corrupt or unsupported.'));
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error('Image decoding timed out. Try a smaller image.')), 20000);
    image.src = url;
  });
}

export function parseImageBase64(value, rawType = 'image/png') {
  if (value.length > BASE64_BYTES * 1.4 + 1024) throw new Error('Base64 limit: 12 MB decoded.');
  let text = value.trim(), type = rawType;
  if (/^data:/i.test(text)) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]*)$/i.exec(text);
    if (!match) throw new Error('Use a raster image data URI with a base64 payload. SVG and other MIME types are not allowed.');
    type = match[1].toLowerCase(); text = match[2];
  }
  if (!rasterTypes.includes(type)) throw new Error('Unsupported raster MIME type.');
  text = text.replace(/\s/g, '');
  if (!text || !/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 === 1 || (text.includes('=') && text.length % 4 !== 0)) throw new Error('Invalid Base64 characters or padding.');
  let binary;
  try { binary = atob(text); } catch { throw new Error('Invalid Base64 encoding.'); }
  if (binary.length > BASE64_BYTES) throw new Error('Base64 limit: 12 MB decoded.');
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (rasterInfo(bytes).type !== type) throw new Error('The selected MIME type does not match the decoded image signature.');
  return new Blob([bytes], { type });
}

export function imageConvertTool(root) {
  const file = input({ type: 'file', accept: rasterTypes.join(',') });
  const width = input({ type: 'number', min: 1, max: MAX_SIDE, step: 1 });
  const height = input({ type: 'number', min: 1, max: MAX_SIDE, step: 1 });
  const lock = checkbox('Preserve aspect ratio', { checked: true });
  const format = select([['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP']]);
  const quality = input({ type: 'number', min: 1, max: 100, value: 85, step: 1 });
  const convert = action('Convert image', { variant: 'primary', disabled: true });
  const save = action('Download image', { disabled: true });
  const feedback = h('div'), details = h('div'), preview = h('div', { class: 'preview-box' });
  let source = null, sourceFile = null, result = null, url = null, version = 0, alive = true, controller;
  const clearResult = () => { result = null; save.disabled = true; preview.replaceChildren(); if (url) URL.revokeObjectURL(url); url = null; };
  const invalidate = () => {
    if (!source) return;
    version++; clearResult(); convert.disabled = false;
    message(feedback, 'info', 'Settings changed. Convert again to refresh the preview and download.');
  };
  const syncSize = (changed) => {
    if (!source || !lock.box.checked) return;
    if (changed === height) width.value = Math.max(1, Math.round(Number(height.value) * source.naturalWidth / source.naturalHeight));
    else height.value = Math.max(1, Math.round(Number(width.value) * source.naturalHeight / source.naturalWidth));
  };
  width.addEventListener('input', () => { syncSize(width); invalidate(); });
  height.addEventListener('input', () => { syncSize(height); invalidate(); });
  lock.box.addEventListener('change', () => { syncSize(width); invalidate(); });
  format.addEventListener('change', () => { quality.disabled = format.value === 'image/png'; invalidate(); });
  quality.addEventListener('input', invalidate);
  file.addEventListener('change', async () => {
    controller?.abort(); controller = new AbortController();
    const id = ++version;
    clearResult(); if (source) source.src = ''; source = null; sourceFile = file.files[0]; convert.disabled = true; details.replaceChildren();
    if (!sourceFile) { message(feedback, 'info', 'Choose an image to begin.'); return; }
    const chosen = sourceFile;
    message(feedback, 'info', 'Reading image locally…');
    try {
      await validateRaster(chosen);
      if (!alive || id !== version) return;
      const decoded = await loadRaster(chosen, controller.signal);
      if (!alive || id !== version) { decoded.src = ''; return; }
      source = decoded; width.value = source.naturalWidth; height.value = source.naturalHeight;
      details.replaceChildren(kv([['Original', chosen.name], ['Dimensions', `${width.value} × ${height.value}`], ['Size', formatBytes(chosen.size)]]));
      convert.disabled = false;
      message(feedback, 'ok', 'Image ready. Animated images export a single frame; JPEG transparency becomes white.');
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  convert.addEventListener('click', async () => {
    const id = ++version; clearResult();
    if (!source) return;
    let canvas;
    try {
      const dims = imageDimensions(Number(width.value), Number(height.value));
      const q = Number(quality.value), type = format.value;
      if (type !== 'image/png' && (!Number.isFinite(q) || q < 1 || q > 100)) throw new Error('Quality must be between 1 and 100.');
      convert.disabled = true; message(feedback, 'info', 'Converting locally…');
      canvas = document.createElement('canvas'); canvas.width = dims.width; canvas.height = dims.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not supported in this browser.');
      if (type === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, dims.width, dims.height); }
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, dims.width, dims.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Encoding failed. Try smaller dimensions.')), type, q / 100));
      if (!alive || id !== version) return;
      if (blob.type !== type) throw new Error(`This browser cannot export ${type}. Try PNG or JPEG.`);
      result = blob; url = URL.createObjectURL(blob);
      const image = previewImage('Converted image preview'); image.src = url; preview.replaceChildren(image);
      save.disabled = false;
      message(feedback, 'ok', `${dims.width} × ${dims.height}, ${formatBytes(blob.size)} (${Math.round(blob.size / sourceFile.size * 100)}% of original). Metadata removed.`);
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
    finally { if (canvas) { canvas.width = canvas.height = 1; } if (alive && id === version) convert.disabled = !source; }
  });
  save.addEventListener('click', () => { if (result) download(result, `${sourceFile.name.replace(/\.[^.]*$/, '') || 'image'}-converted.${result.type.split('/')[1] === 'jpeg' ? 'jpg' : result.type.split('/')[1]}`); });
  message(feedback, 'info', 'Choose JPEG, PNG, WebP or GIF. Limit: 32 MB, 24 megapixels, 16,384 pixels per side.');
  root.append(h('div', { class: 'panes' }, panel('Source and output settings', stack(
    field({ label: 'Image file', control: file }), details,
    h('div', { class: 'panes' }, field({ label: 'Width (pixels)', control: width }), field({ label: 'Height (pixels)', control: height })), lock.el,
    field({ label: 'Output format', control: format }), field({ label: 'Quality (1–100)', control: quality, hint: 'JPEG and WebP only. PNG uses lossless encoding.' }),
    h('div', { class: 'toolbar' }, convert, save))), panel('Converted preview', stack(feedback, preview))));
  return () => { alive = false; version++; controller?.abort(); if (source) source.src = ''; source = null; clearResult(); };
}

export function imageBase64Tool(root) {
  const file = input({ type: 'file', accept: rasterTypes.join(',') });
  const text = textarea({ placeholder: 'Paste a data:image/png;base64,… URI or raw Base64', rows: 8 });
  const mime = select(rasterTypes, { value: 'image/png' });
  const decode = action('Preview Base64', { variant: 'primary' }), copy = action('Copy data URI', { disabled: true }), save = action('Download image', { disabled: true });
  const feedback = h('div'), preview = h('div', { class: 'preview-box' });
  let version = 0, alive = true, result = null, uri = '', url = null, controller;
  const reset = () => { version++; controller?.abort(); result = null; uri = ''; copy.disabled = save.disabled = true; preview.replaceChildren(); if (url) URL.revokeObjectURL(url); url = null; };
  const display = async (blob, id) => {
    controller = new AbortController();
    const image = await loadRaster(blob, controller.signal);
    if (!alive || id !== version) { image.src = ''; return false; }
    url = URL.createObjectURL(blob); const shown = previewImage('Decoded raster image'); shown.src = url; preview.replaceChildren(shown);
    image.src = ''; result = blob; save.disabled = false;
    message(feedback, 'ok', `${blob.type}, ${formatBytes(blob.size)}. Original metadata is retained.`);
    return true;
  };
  text.addEventListener('input', () => { reset(); message(feedback, 'info', 'Press Preview Base64 to validate the edited content.'); });
  mime.addEventListener('change', reset);
  file.addEventListener('change', async () => {
    reset(); const id = version, chosen = file.files[0];
    if (!chosen) return;
    text.value = ''; message(feedback, 'info', 'Encoding image locally…');
    try {
      await validateRaster(chosen, BASE64_BYTES);
      if (!alive || id !== version) return;
      const bytes = new Uint8Array(await chosen.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const value = `data:${chosen.type.toLowerCase()};base64,${btoa(binary)}`;
      if (!alive || id !== version) return;
      if (await display(chosen, id)) { uri = value; text.value = value; mime.value = chosen.type.toLowerCase(); copy.disabled = false; }
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  decode.addEventListener('click', async () => {
    reset(); const id = version;
    message(feedback, 'info', 'Validating and decoding locally…');
    try {
      const blob = parseImageBase64(text.value, mime.value);
      if (await display(blob, id)) { uri = `data:${blob.type};base64,${text.value.replace(/^data:[^,]*,/i, '').replace(/\s/g, '')}`; copy.disabled = false; }
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  copy.addEventListener('click', async () => {
    const id = version;
    try {
      const ok = await copyText(uri);
      if (alive && id === version) message(feedback, ok ? 'ok' : 'err', ok ? 'Data URI copied.' : 'Copy failed. Select the data URI and copy manually.');
    } catch { if (alive && id === version) message(feedback, 'err', 'Copy failed. Select the data URI and copy manually.'); }
  });
  save.addEventListener('click', () => { if (result) download(result, `decoded-image.${result.type === 'image/jpeg' ? 'jpg' : result.type.split('/')[1]}`); });
  message(feedback, 'info', 'Choose a raster image or paste Base64. Limit: 12 MB decoded, 24 megapixels. SVG and non-image data URIs are rejected.');
  root.append(h('div', { class: 'panes' }, panel('Image / Base64', stack(field({ label: 'Image file', control: file }), field({ label: 'Data URI or raw Base64', control: text }), field({ label: 'MIME type for raw Base64', control: mime }), h('div', { class: 'toolbar' }, decode, copy, save))), panel('Image preview', stack(feedback, preview))));
  return () => { alive = false; reset(); };
}
