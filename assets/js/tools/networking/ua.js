import { h, textarea, field, button, status, kv } from '../../core/dom.js';

export function parseUserAgent(value) {
  const ua = String(value).trim();
  if (!ua) throw new Error('Enter a User-Agent string.');
  if (ua.length > 8192) throw new Error('Limit the User-Agent to 8192 characters.');
  const browsers = [
    ['Microsoft Edge', /(?:EdgA|EdgiOS|Edg|Edge)\/([\d.]+)/], ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/], ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['Internet Explorer', /(?:MSIE\s|Trident\/[\d.]+.*rv:)([\d.]+)/], ['Safari', /Version\/([\d.]+).*Safari\//],
  ];
  let browser = 'Unknown', version = 'Unknown';
  for (const [name, re] of browsers) { const match = ua.match(re); if (match) { browser = name; version = match[1]; break; } }
  let os = 'Unknown';
  if (/Windows Phone/.test(ua)) os = 'Windows Phone';
  else if (/Windows NT/.test(ua)) { const v = ua.match(/Windows NT ([\d.]+)/)?.[1]; os = ({ '10.0': 'Windows 10 or later (UA cannot distinguish Windows 11)', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' })[v] || `Windows NT ${v || ''}`; }
  else if (/(?:iPhone|iPad|iPod)/.test(ua)) os = 'iOS / iPadOS' + (ua.match(/(?:CPU(?: iPhone)? OS|iPhone OS) ([\d_]+)/)?.[1] ? ' ' + ua.match(/(?:CPU(?: iPhone)? OS|iPhone OS) ([\d_]+)/)[1].replaceAll('_', '.') : '');
  else if (/Android/.test(ua)) os = 'Android' + (ua.match(/Android ([\d.]+)/)?.[1] ? ' ' + ua.match(/Android ([\d.]+)/)[1] : '');
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS' + (ua.match(/Mac OS X ([\d_]+)/)?.[1] ? ' ' + ua.match(/Mac OS X ([\d_]+)/)[1].replaceAll('_', '.') : '');
  else if (/Linux/.test(ua)) os = 'Linux';
  const ios = /iPhone|iPad|iPod/.test(ua);
  let engine = 'Unknown';
  if (/Trident\//.test(ua)) engine = 'Trident';
  else if (/Edge\//.test(ua)) engine = 'EdgeHTML';
  else if (ios && /AppleWebKit\//.test(ua)) engine = 'WebKit (reported)';
  else if (/Chrome\/|Chromium\//.test(ua)) engine = 'Blink (inferred)';
  else if (/Gecko\//.test(ua) && /Firefox\//.test(ua)) engine = 'Gecko';
  else if (/AppleWebKit\//.test(ua)) engine = 'WebKit';
  else if (/Presto\//.test(ua)) engine = 'Presto';
  const bot = /bot\b|crawler|spider|slurp|headless/i.test(ua);
  const device = bot ? 'Bot / automation (claimed)' : /iPad|Tablet|PlayBook/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet (inferred)' : /Mobi|iPhone|iPod|Windows Phone/i.test(ua) ? 'Mobile (inferred)' : /Windows NT|Macintosh|X11|CrOS/.test(ua) ? 'Desktop (inferred)' : 'Unknown';
  return { browser, version, engine, os, device };
}

export function uaTool(root) {
  const text = textarea({ value: globalThis.navigator?.userAgent || '', maxlength: 8192 });
  const output = h('div', { 'aria-live': 'polite' });
  const parse = () => {
    try {
      const r = parseUserAgent(text.value);
      output.replaceChildren(kv([['Browser', r.browser], ['Reported version', r.version], ['Engine', r.engine], ['Operating system', r.os], ['Device type', r.device]]));
    } catch (err) { output.replaceChildren(status('err', err.message)); }
  };
  root.append(h('form', { class: 'stack', onsubmit: e => { e.preventDefault(); parse(); } }, field({ label: 'User-Agent string', control: text }),
    h('div', { class: 'toolbar' }, button('Parse User-Agent', { variant: 'primary', type: 'submit' }), button('Use this browser', { onclick: () => { text.value = globalThis.navigator?.userAgent || ''; parse(); } }))),
    status('info', 'These are hints from a string, not device detection. User-Agents can be spoofed or frozen; browsers can hide their identity, and iPad desktop mode may resemble macOS.'), output);
  if (text.value) parse(); else output.append(status('info', 'Paste a User-Agent to parse it locally.'));
}
