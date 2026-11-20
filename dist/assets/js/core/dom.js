const PROP_KEYS = new Set(['value', 'checked', 'selected', 'disabled', 'hidden', 'multiple', 'readOnly', 'indeterminate', 'open']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key === 'text') el.textContent = val;
      else if (key === 'dataset') Object.assign(el.dataset, val);
      else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
      else if (PROP_KEYS.has(key)) el[key] = val;
      else el.setAttribute(key, val === true ? '' : String(val));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

const ICONS = {
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2"/>',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

export function toast(message) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = h('div', { class: 'toast', text: message });
  host.append(t);
  setTimeout(() => t.remove(), 2400);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function copyButton(getText, label = 'Copy') {
  const text = h('span', { text: label });
  const btn = h('button', { class: 'btn btn--sm', type: 'button' }, icon('copy'), text);
  btn.addEventListener('click', async () => {
    const value = typeof getText === 'function' ? getText() : getText;
    if (!value) {
      toast('Nothing to copy yet');
      return;
    }
    const ok = await copyText(value);
    if (!ok) {
      toast('Copy failed. Select the text and copy manually.');
      return;
    }
    btn.classList.add('btn--copied');
    btn.firstChild.replaceWith(icon('check'));
    text.textContent = 'Copied';
    setTimeout(() => {
      btn.classList.remove('btn--copied');
      btn.firstChild.replaceWith(icon('copy'));
      text.textContent = label;
    }, 1400);
  });
  return btn;
}

let uid = 0;
export const nextId = (p = 'f') => `${p}-${++uid}`;

export function field({ label, control, hint, meta, id }) {
  const cid = id || control.id || nextId();
  control.id = cid;
  const lab = h('label', { class: 'field__label', for: cid }, h('span', { text: label }), meta || null);
  const hintEl = hint ? h('span', { class: 'field__hint', id: cid + '-hint', text: hint }) : null;
  if (hintEl) control.setAttribute('aria-describedby', hintEl.id);
  return h('div', { class: 'field' }, lab, control, hintEl);
}

export function input(props = {}) {
  return h('input', { class: 'input', type: 'text', autocomplete: 'off', spellcheck: 'false', ...props });
}

export function textarea(props = {}) {
  return h('textarea', { class: 'textarea', spellcheck: 'false', ...props });
}

export function select(options, props = {}) {
  const el = h('select', { class: 'select', ...props });
  for (const opt of options) {
    const [value, label] = Array.isArray(opt) ? opt : [opt, opt];
    el.append(h('option', { value, text: label }));
  }
  if (props.value != null) el.value = props.value;
  return el;
}

export function checkbox(label, props = {}) {
  const box = h('input', { type: 'checkbox', ...props });
  return { el: h('label', { class: 'check' }, box, h('span', { text: label })), box };
}

export function button(label, props = {}) {
  const { variant, ...rest } = props;
  return h('button', { class: `btn${variant ? ' btn--' + variant : ''}`, type: 'button', ...rest }, label);
}

export function segmented(options, value, onChange, label) {
  const root = h('div', { class: 'segmented', role: 'group', 'aria-label': label });
  let current = value;
  const buttons = options.map(([val, text]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(val === value), text });
    b.addEventListener('click', () => {
      if (current === val) return;
      current = val;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
      onChange(val);
    });
    return b;
  });
  root.append(...buttons);
  root.getValue = () => current;
  return root;
}

export function status(kind, message) {
  const mark = kind === 'ok' ? 'OK' : kind === 'err' ? 'ERR' : 'i';
  return h('div', { class: `status status--${kind}`, role: kind === 'err' ? 'alert' : 'status' },
    h('span', { class: 'status__mark', 'aria-hidden': 'true', text: mark }), h('span', { text: message }));
}

export function kv(pairs) {
  const dl = h('dl', { class: 'kv' });
  for (const [k, v, opts] of pairs) {
    if (v == null || v === '') continue;
    const dd = h('dd', null, h('span', { text: String(v) }));
    if (opts?.copy) dd.append(copyButton(String(v), 'Copy'));
    dl.append(h('dt', { text: k }), dd);
  }
  return dl;
}

export function panel(title, ...children) {
  const actions = children.find((c) => c && c.__actions);
  const body = children.filter((c) => c !== actions);
  return h('section', { class: 'panel' },
    title || actions ? h('div', { class: 'panel__head' }, title ? h('h2', { class: 'panel__title', text: title }) : h('span'), actions ? actions.el : null) : null,
    ...body);
}

export const actions = (...els) => ({ __actions: true, el: h('div', { class: 'row' }, ...els) });

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function download(data, filename, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(n < 10 ? 2 : 1)} ${units[i]}`;
}

export function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diff) < 60) return rtf.format(-Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

const SAFE_TAGS = new Set(['P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'EM', 'B', 'I', 'DEL', 'S', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'INPUT', 'SPAN']);
const SAFE_ATTRS = { A: ['href', 'title'], IMG: ['src', 'alt', 'title'], INPUT: ['type', 'checked', 'disabled'], TH: ['align'], TD: ['align'], OL: ['start'], CODE: ['class'] };

function safeUrl(url, forImage) {
  const v = url.trim();
  if (forImage && /^data:image\/(png|gif|jpe?g|webp);base64,/i.test(v)) return v;
  try {
    const parsed = new URL(v, location.href);
    return (forImage ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:']).includes(parsed.protocol) ? v : null;
  } catch {
    return null;
  }
}

/* Allowlist sanitizer: everything not explicitly safe is unwrapped or dropped. */
export function sanitizeHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walk = (node) => {
    for (const child of [...node.children]) {
      if (!SAFE_TAGS.has(child.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'FORM'].includes(child.tagName)) child.remove();
        else {
          walk(child);
          child.replaceWith(...child.childNodes);
        }
        continue;
      }
      const allowed = SAFE_ATTRS[child.tagName] || [];
      for (const attr of [...child.attributes]) {
        if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'A') {
        const href = child.getAttribute('href');
        const safe = href == null ? null : safeUrl(href, false);
        if (safe == null) child.removeAttribute('href');
        else {
          child.setAttribute('rel', 'noopener noreferrer nofollow');
          if (/^https?:/i.test(safe)) child.setAttribute('target', '_blank');
        }
      }
      if (child.tagName === 'IMG') {
        const src = child.getAttribute('src');
        if (src == null || safeUrl(src, true) == null) child.removeAttribute('src');
        child.setAttribute('loading', 'lazy');
        child.setAttribute('referrerpolicy', 'no-referrer');
      }
      if (child.tagName === 'INPUT' && child.getAttribute('type') !== 'checkbox') child.remove();
      walk(child);
    }
  };
  walk(tpl.content);
  return tpl.content;
}
