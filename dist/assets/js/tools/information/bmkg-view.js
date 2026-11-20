import { h, kv, relTime } from '../../core/dom.js';

export const osmLink = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=8/${lat}/${lon}`;

export function tsunamiPill(potential) {
  if (!potential) return null;
  const p = potential.toLowerCase();
  const risk = p.includes('berpotensi tsunami') && !p.includes('tidak berpotensi');
  return h('span', { class: `pill ${risk ? 'pill--err' : ''}`, text: potential });
}

export function quakeSummary(q, { compact = false } = {}) {
  const when = q.time && !Number.isNaN(q.time.getTime()) ? q.time : null;
  const head = h('div', { class: 'quake-head' },
    h('span', { class: 'quake-mag' }, Number.isFinite(q.magnitude) ? q.magnitude.toFixed(1) : '?', h('small', { text: 'M' })),
    h('div', { class: 'grow' },
      h('div', { style: 'font-weight:500', text: q.region }),
      h('div', { class: 'field__hint', text: when ? `${relTime(when.getTime())} · ${q.dateLabel}` : q.dateLabel })));
  const rows = [
    ['Depth', q.depth],
    ['Felt', q.felt],
  ];
  if (!compact) {
    rows.unshift(['Your time', when ? when.toLocaleString() : '']);
    rows.push(['Coordinates', `${q.latLabel} ${q.lonLabel}`.trim()]);
  }
  const map = q.lat != null && q.lon != null
    ? h('a', { href: osmLink(q.lat, q.lon), target: '_blank', rel: 'noopener noreferrer', class: 'field__hint', text: 'Open epicentre on OpenStreetMap' })
    : null;
  return [
    head,
    kv(rows),
    h('div', { class: 'row row--between' }, tsunamiPill(q.potential) || h('span'), map),
  ];
}
