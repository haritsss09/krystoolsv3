import { h, field, input, select, button, panel, status } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { CITIES, ADM4_RE, latestQuake, quakeList, forecast, WEATHER_SOURCE } from '../../api/bmkg.js';
import { quakeSummary } from './bmkg-view.js';

export function quakeTool(workspace) {
  const kind = select([['latest', 'Latest earthquake'], ['recent', 'Recent M5+ earthquakes'], ['felt', 'Felt earthquakes']]);
  const view = apiView({
    loadingText: 'Loading earthquakes from BMKG',
    load: async (force) => {
      const selected = kind.value;
      const res = selected === 'latest' ? await latestQuake({ force }) : await quakeList(selected, { force });
      return res.ok ? { ...res, data: { kind: selected, quakes: selected === 'latest' ? [res.data] : res.data } } : res;
    },
    isEmpty: (d) => !d.quakes.length && 'BMKG has not supplied any events for this list.',
    render: ({ kind: selected, quakes }) => quakes.map((q) => {
      const content = h('div', { class: 'stack' }, ...quakeSummary(q, { compact: selected !== 'latest' }));
      if (selected === 'latest' && q.shakemap) {
        const fallback = h('p', { class: 'field__hint', hidden: true, text: 'The shakemap image could not load. Open the original image below.' });
        content.append(h('img', {
          src: q.shakemap, alt: `BMKG shakemap for ${q.region}`, width: 600, height: 600,
          style: 'width:100%;height:auto;max-height:640px;object-fit:contain', loading: 'lazy',
          onerror: (event) => { event.currentTarget.hidden = true; fallback.hidden = false; },
        }), fallback, h('a', { href: q.shakemap, target: '_blank', rel: 'noopener noreferrer', text: 'Open original BMKG shakemap' }));
      }
      return panel(selected === 'latest' ? 'Latest event' : q.dateLabel, content);
    }),
  });
  const change = () => view.run();
  kind.addEventListener('change', change);
  const root = h('div', { class: 'stack' }, field({ label: 'Earthquake feed', control: kind }),
    status('info', 'Follow BMKG and local authorities for safety instructions. This page is not an emergency alert service.'), view.el);
  workspace.append(root);
  view.run();
  return () => { kind.removeEventListener('change', change); view.destroy(); root.remove(); };
}

const measurement = (value, unit) => Number.isFinite(value) ? `${value} ${unit}` : 'Not supplied';

export function weatherTool(workspace) {
  const city = select([...CITIES, ['', 'Custom village code']]);
  const code = input({ value: CITIES[0][0], required: true, placeholder: '31.71.03.1001' });
  const view = apiView({
    loadingText: 'Loading BMKG forecast',
    idle: status('info', 'Choose a city or enter a village code to load its forecast.'),
    load: async (force) => {
      const adm4 = code.value.trim();
      if (!ADM4_RE.test(adm4)) return { ok: false, source: WEATHER_SOURCE, error: new Error('Enter an adm4 village code such as 31.71.03.1001.') };
      const res = await forecast(adm4, { force });
      if (res.error?.status === 404) return { ok: true, data: { steps: [] }, source: WEATHER_SOURCE, fetchedAt: Date.now() };
      return res;
    },
    isEmpty: (d) => !d.steps.length && 'No forecast is available for this village code. Check the code or choose a listed city.',
    render: ({ location, steps }) => {
      const rows = steps.map((step) => h('tr', null,
        h('td', { text: step.local || 'Not supplied' }),
        h('td', { text: step.descEn || step.desc || 'Not supplied' }),
        h('td', { text: measurement(step.temp, '°C') }),
        h('td', { text: measurement(step.humidity, '%') }),
        h('td', { text: `${measurement(step.windSpeed, 'km/h')} ${step.windDir}`.trim() }),
        h('td', { text: measurement(step.rain, 'mm') }),
        h('td', { text: step.visibility || 'Not supplied' })));
      return [
        h('h2', { text: [location.village, location.district, location.city, location.province].filter(Boolean).join(', ') || 'Forecast location' }),
        h('p', { class: 'field__hint', text: `Times are local to the forecast location (${location.timezone}). City presets select one village, not the entire city.` }),
        h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Weather forecast table' }, h('table', { class: 'table' },
          h('caption', { class: 'visually-hidden', text: 'BMKG three-day forecast' }),
          h('thead', null, h('tr', null, ['Local date and time', 'Conditions', 'Temperature', 'Humidity', 'Wind', 'Rain', 'Visibility'].map((name) => h('th', { scope: 'col', text: name })))),
          h('tbody', null, rows))),
      ];
    },
  });
  const form = h('form', { class: 'stack' },
    h('div', { class: 'grid grid--2' }, field({ label: 'City preset', control: city }),
      field({ label: 'Village code (adm4)', control: code, hint: 'The code has four parts: 00.00.00.0000.' })),
    h('div', null, button('Load forecast', { type: 'submit', variant: 'primary' })));
  const submit = (e) => { e.preventDefault(); view.run(); };
  const choose = () => { if (city.value) code.value = city.value; };
  const custom = () => { city.value = CITIES.some(([v]) => v === code.value.trim()) ? code.value.trim() : ''; };
  form.addEventListener('submit', submit);
  city.addEventListener('change', choose);
  code.addEventListener('input', custom);
  const root = h('div', { class: 'stack' }, panel('Location', form), panel('Forecast', view.el));
  workspace.append(root);
  view.run();
  return () => { form.removeEventListener('submit', submit); city.removeEventListener('change', choose); code.removeEventListener('input', custom); view.destroy(); root.remove(); };
}
