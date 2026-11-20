import { h, input, select, field, button, copyButton, status, kv } from '../../core/dom.js';

export function readColor(value) {
  if (!value.trim() || /\b(var|env|currentcolor|inherit|initial|unset|revert|light-dark)\b/i.test(value) || !CSS.supports('color', value)) throw new Error('Enter an explicit CSS color, such as #f0a43a or rgb(240 164 58).');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = value; context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
}
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

export function colorFormats([r, g, b, a]) {
  const channels = [r, g, b].map(n => n / 255), [rr, gg, bb] = channels;
  const max = Math.max(...channels), min = Math.min(...channels), delta = max - min, light = (max + min) / 2;
  let hue = 0;
  if (delta) hue = ((max === rr ? (gg - bb) / delta : max === gg ? (bb - rr) / delta + 2 : (rr - gg) / delta + 4) * 60 + 360) % 360;
  const saturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
  const [lr, lg, lb] = channels.map(linear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(A, B), angle = chroma < 0.00001 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  const alpha = a < 255 ? ` / ${(a / 255).toFixed(3)}` : '';
  return [
    ['HEX', '#' + [r, g, b, ...(a < 255 ? [a] : [])].map(n => n.toString(16).padStart(2, '0')).join('')],
    ['RGB', `rgb(${r} ${g} ${b}${alpha})`],
    ['HSL', `hsl(${hue.toFixed(1)} ${(saturation * 100).toFixed(1)}% ${(light * 100).toFixed(1)}%${alpha})`],
    ['OKLCH', `oklch(${(L * 100).toFixed(2)}% ${chroma.toFixed(4)} ${angle.toFixed(2)}${alpha})`],
  ];
}

export function contrastRatio(foreground, background) {
  const bg = background.slice(0, 3).map(c => c * background[3] / 255 + 255 * (1 - background[3] / 255));
  const fg = foreground.slice(0, 3).map((c, i) => c * foreground[3] / 255 + bg[i] * (1 - foreground[3] / 255));
  const luminance = channels => channels.map(c => linear(c / 255)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(fg), y = luminance(bg);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function colorTool(root) {
  const color = input({ value: '#f0a43a' }), background = input({ value: '#111214' });
  const swatch = h('div', { class: 'swatch' }), output = h('div', { class: 'stack' });
  function run() {
    try {
      const fg = readColor(color.value), bg = readColor(background.value), ratio = contrastRatio(fg, bg);
      swatch.style.background = color.value;
      output.replaceChildren(kv(colorFormats(fg).map(([key, value]) => [key, value, { copy: true }])),
        status(ratio >= 4.5 ? 'ok' : 'err', `Contrast ${ratio.toFixed(2)}:1. AA normal text: ${ratio >= 4.5 ? 'pass' : 'fail'}; AA large text: ${ratio >= 3 ? 'pass' : 'fail'}; AAA normal text: ${ratio >= 7 ? 'pass' : 'fail'}.`),
        h('p', { class: 'field__hint', text: 'Conversions are rounded to 8-bit sRGB. Transparent backgrounds are composited over white. Large text means at least 18 pt regular or 14 pt bold.' }));
    } catch (error) { output.replaceChildren(status('err', error.message)); }
  }
  color.addEventListener('input', run); background.addEventListener('input', run);
  root.append(h('div', { class: 'panes' }, field({ label: 'Foreground color', control: color }), field({ label: 'Background for contrast', control: background })), swatch, output); run();
}

export function gradientTool(root) {
  const type = select([['linear', 'Linear'], ['radial', 'Radial'], ['conic', 'Conic']]);
  const angle = input({ type: 'number', min: 0, max: 360, value: 90 });
  const list = h('div', { class: 'stack' }), preview = h('div', { class: 'swatch' });
  const output = h('pre', { class: 'output output--sm' }), message = h('div');
  const stops = [];
  function run() {
    output.textContent = ''; message.replaceChildren();
    try {
      if (angle.value === '' || !Number.isFinite(Number(angle.value)) || Number(angle.value) < 0 || Number(angle.value) > 360) throw new Error('Angle must be between 0 and 360 degrees.');
      const values = stops.map(({ color, position }) => {
        const rgba = readColor(color.value);
        const n = Number(position.value);
        if (!position.value || n < 0 || n > 100 || !Number.isFinite(n)) throw new Error('Stop positions must be between 0 and 100 percent.');
        return `${colorFormats(rgba)[1][1]} ${type.value === 'conic' ? n * 3.6 + 'deg' : n + '%'}`;
      });
      const start = type.value === 'linear' ? `${angle.value}deg` : type.value === 'conic' ? `from ${angle.value}deg at center` : 'circle at center';
      const css = `${type.value}-gradient(${start}, ${values.join(', ')})`;
      preview.style.background = css; output.textContent = `background: ${css};`;
    } catch (error) { preview.style.background = ''; message.replaceChildren(status('err', error.message)); }
  }
  function add(colorValue = '#ffffff', percent = 100) {
    if (stops.length >= 8) return;
    const color = input({ value: colorValue }), position = input({ type: 'number', value: percent, min: 0, max: 100 });
    const entry = { color, position };
    const remove = button('Remove', { onclick: () => { stops.splice(stops.indexOf(entry), 1); row.remove(); sync(); run(); } });
    const row = h('div', { class: 'toolbar' }, field({ label: 'Stop color', control: color }), field({ label: 'Position (%)', control: position }), remove);
    entry.remove = remove; stops.push(entry); list.append(row);
    color.addEventListener('input', run); position.addEventListener('input', run); sync(); run();
  }
  const addButton = button('Add stop', { onclick: () => add() });
  function sync() { addButton.disabled = stops.length >= 8; for (const stop of stops) stop.remove.disabled = stops.length <= 2; }
  type.addEventListener('change', () => { angle.disabled = type.value === 'radial'; run(); }); angle.addEventListener('input', run);
  root.append(h('div', { class: 'toolbar' }, field({ label: 'Gradient type', control: type }), field({ label: 'Angle', control: angle })), list, h('div', { class: 'toolbar' }, addButton, copyButton(() => output.textContent, 'Copy CSS')), preview, output, message);
  add('#111214', 0); add('#f0a43a', 100);
}
