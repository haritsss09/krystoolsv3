import qrcode from '../../../vendor/qrcode.mjs';
import { h, textarea, input, select, checkbox, field, button, download, status } from '../../core/dom.js';

export function qrTool(root) {
  const mode = select([['text', 'Text or URL'], ['wifi', 'Wi-Fi']]);
  const text = textarea({ class: 'textarea textarea--sm', maxlength: 3000 });
  const ssid = input({ maxlength: 32 }), password = input({ type: 'password', autocomplete: 'off', maxlength: 128 });
  const security = select([['WPA', 'WPA / WPA2'], ['WEP', 'WEP (legacy)'], ['nopass', 'Open network']]);
  const hidden = checkbox('Hidden network');
  const wifi = h('div', { class: 'stack', hidden: true }, field({ label: 'Network name (SSID)', control: ssid }), field({ label: 'Security', control: security }), field({ label: 'Password', control: password }), hidden.el);
  const textField = field({ label: 'Text or URL', control: text });
  const correction = select([['L', 'Low (7%)'], ['M', 'Medium (15%)'], ['Q', 'Quartile (25%)'], ['H', 'High (30%)']], { value: 'M' });
  const scale = select([['4', '4 pixels per module'], ['8', '8 pixels per module'], ['12', '12 pixels per module']], { value: '8' });
  const canvas = h('canvas', { width: 256, height: 256, 'aria-label': 'QR code preview', role: 'img', hidden: true, style: 'max-width:100%;height:auto;image-rendering:pixelated' });
  const message = h('div');
  let svg = '';
  const saveSvg = button('Download SVG', { disabled: true, onclick: () => download(svg, 'qrcode.svg', 'image/svg+xml') });
  const savePng = button('Download PNG', { disabled: true, onclick: () => canvas.toBlob(blob => { if (blob) download(blob, 'qrcode.png'); else message.replaceChildren(status('err', 'PNG export failed.')); }, 'image/png') });
  const invalidate = () => { svg = ''; canvas.hidden = true; saveSvg.disabled = savePng.disabled = true; message.replaceChildren(); };
  mode.addEventListener('change', () => { wifi.hidden = mode.value !== 'wifi'; textField.hidden = mode.value === 'wifi'; });
  security.addEventListener('change', () => { password.disabled = security.value === 'nopass'; });
  for (const control of [mode, text, ssid, password, security, hidden.box, correction, scale]) control.addEventListener('input', invalidate);
  const escapeWifi = value => value.replace(/[\\;,:\"]/g, '\\$&');
  function generate() {
    invalidate();
    try {
      if (mode.value === 'wifi' && !ssid.value) throw new Error('Enter the network name.');
      const value = mode.value === 'wifi' ? `WIFI:T:${security.value};S:${escapeWifi(ssid.value)};P:${security.value === 'nopass' ? '' : escapeWifi(password.value)};H:${hidden.box.checked};;` : text.value;
      if (!value) throw new Error('Enter text or a URL.');
      const bytes = new TextEncoder().encode(value);
      if (bytes.length > 2900) throw new Error('Content is too large. Use fewer than 2,900 UTF-8 bytes.');
      const qr = qrcode(0, correction.value);
      qr.addData([...bytes].map(b => String.fromCharCode(b)).join(''), 'Byte');
      qr.make();
      const cell = Number(scale.value), modules = qr.getModuleCount(), size = (modules + 8) * cell;
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0, 0, size, size); context.fillStyle = '#000';
      for (let row = 0; row < modules; row++) for (let col = 0; col < modules; col++) if (qr.isDark(row, col)) context.fillRect((col + 4) * cell, (row + 4) * cell, cell, cell);
      svg = qr.createSvgTag(cell, cell * 4);
      canvas.hidden = false; saveSvg.disabled = savePng.disabled = false;
      message.replaceChildren(status('ok', `${size} × ${size} pixels. Keep the white margin when placing or printing the code.`));
    } catch (error) { message.replaceChildren(status('err', error.message || 'Content does not fit at this correction level. Shorten it or choose lower error correction.')); }
  }
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Content type', control: mode }), field({ label: 'Error correction', control: correction }), field({ label: 'Export size', control: scale })), textField, wifi,
    h('div', { class: 'toolbar' }, button('Generate QR code', { variant: 'primary', onclick: generate }), saveSvg, savePng), message, h('div', { class: 'preview-box' }, canvas));
}
