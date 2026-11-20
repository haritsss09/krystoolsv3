import { h, field, input, button, panel, status, kv } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { sunTimes, SUN_SOURCE } from '../../api/geography.js';

const EVENTS = [
  ['sunrise', 'Sunrise'], ['sunset', 'Sunset'], ['solar_noon', 'Solar noon'],
  ['civil_twilight_begin', 'Civil dawn'], ['civil_twilight_end', 'Civil dusk'],
  ['nautical_twilight_begin', 'Nautical dawn'], ['nautical_twilight_end', 'Nautical dusk'],
  ['astronomical_twilight_begin', 'Astronomical dawn'], ['astronomical_twilight_end', 'Astronomical dusk'],
];

function eventTime(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  // v1 serializes PHP false/true as epoch second 0/1 on polar days.
  if (!Number.isFinite(ms) || ms === 0 || ms === 1000) return null;
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function moonPhase(date) {
  // Mean synodic month and Jan 29 2025 new moon: NASA / Fred Espenak phase2001gmt.html.
  const days = (Date.parse(`${date}T12:00:00Z`) - Date.parse('2025-01-29T12:36:00Z')) / 86400000;
  const cycle = ((days / 29.530588) % 1 + 1) % 1;
  return ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'][Math.round(cycle * 8) % 8];
}

export function sunTool(workspace) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const lat = input({ type: 'number', step: 'any', min: '-90', max: '90', required: true, placeholder: '-6.2' });
  const lng = input({ type: 'number', step: 'any', min: '-180', max: '180', required: true, placeholder: '106.8' });
  const date = input({ type: 'date', value: today, min: '0001-01-01', max: '9999-12-31', required: true });
  const view = apiView({
    loadingText: 'Calculating sun times',
    idle: status('info', 'Enter coordinates and a date. Location permission is not needed.'),
    load: (force) => {
      if (!lat.value.trim() || !lng.value.trim()) return { ok: false, source: SUN_SOURCE, error: new Error('Enter both latitude and longitude.') };
      return sunTimes(Number(lat.value), Number(lng.value), date.value, { force });
    },
    isEmpty: (d) => !d || !EVENTS.some(([key]) => d[key] != null) && 'No sun events were returned for this location and date.',
    render: (data) => {
      const sunrise = eventTime(data.sunrise);
      const sunset = eventTime(data.sunset);
      const noRiseOrSet = !sunrise || !sunset;
      const polarDay = Date.parse(data.sunrise) === 1000 && Date.parse(data.sunset) === 1000;
      const polarNight = Date.parse(data.sunrise) === 0 && Date.parse(data.sunset) === 0;
      const seconds = Number(data.day_length);
      const duration = polarDay ? '24 hours (polar day)' : polarNight ? '0 hours (polar night)'
        : noRiseOrSet || data.day_length == null || !Number.isFinite(seconds) ? 'Not available'
          : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min ${Math.round(seconds % 60)} s`;
      return [
        h('h2', { text: `${data.date} · ${data.lat}, ${data.lng}` }),
        h('p', { class: 'field__hint', text: 'All sun-event times below are UTC, not your device or location’s local time.' }),
        noRiseOrSet ? status('info', polarDay ? 'Polar day: the sun does not set on this date.' : polarNight ? 'Polar night: the sun does not rise on this date.' : 'A sunrise or sunset does not occur or was not supplied. This can happen near the poles.') : null,
        kv([...EVENTS.map(([key, label]) => [label, eventTime(data[key]) || 'Does not occur / not supplied']), ['Day length', duration]]),
        h('h3', { text: `Approximate moon phase: ${moonPhase(data.date)}` }),
        h('p', { class: 'field__hint', text: 'Calculated locally for noon UTC on the selected date using a mean lunar cycle. This is an approximation, not a precise ephemeris or a moonrise prediction.' }),
        h('a', { href: 'https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html', target: '_blank', rel: 'noopener noreferrer', class: 'field__hint', text: 'Lunar-cycle reference: NASA / Fred Espenak' }),
      ];
    },
  });
  const form = h('form', { class: 'stack' }, h('div', { class: 'grid grid--2' },
    field({ label: 'Latitude (decimal degrees)', control: lat, hint: 'North is positive, south is negative.' }),
    field({ label: 'Longitude (decimal degrees)', control: lng, hint: 'East is positive, west is negative.' })),
    field({ label: 'Date', control: date }), h('div', null, button('Find sun times', { type: 'submit', variant: 'primary' })));
  const submit = (event) => { event.preventDefault(); view.run(); };
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack' }, panel('Location and date', form), panel('Sun and moon', view.el));
  workspace.append(root);
  return () => { form.removeEventListener('submit', submit); view.destroy(); root.remove(); };
}
