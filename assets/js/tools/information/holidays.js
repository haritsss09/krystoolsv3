import { h, field, input, select, button, panel, status } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { availableCountries, publicHolidays, HOLIDAY_SOURCE } from '../../api/geography.js';

export function holidaysTool(workspace) {
  const country = select([], { required: true, disabled: true });
  const year = input({ type: 'number', value: String(new Date().getFullYear()), min: '1', max: '9999', step: '1', required: true });
  const search = button('Find holidays', { type: 'submit', variant: 'primary', disabled: true });
  const results = apiView({
    idle: status('info', 'Choose a country and year to see holidays, including regional entries and observances reported by the source.'),
    loadingText: 'Loading holidays',
    load: async (force) => {
      if (!country.value || !year.value.trim()) return { ok: false, source: HOLIDAY_SOURCE, error: new Error('Choose a country and enter a year.') };
      const code = country.value;
      const selectedYear = Number(year.value);
      const name = country.selectedOptions[0]?.textContent || code;
      const res = await publicHolidays(selectedYear, code, { force });
      return res.ok ? { ...res, data: { holidays: res.data, year: selectedYear, name } } : res;
    },
    isEmpty: (d) => !d.holidays.length && `No holidays were returned for ${d.name} in ${d.year}. Coverage varies by country and year.`,
    render: (d) => [
      h('h2', { text: `${d.name} · ${d.year}` }),
      h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Holiday dates and coverage' }, h('table', { class: 'table' },
        h('caption', { class: 'visually-hidden', text: 'Holidays reported by Nager.Date' }),
        h('thead', null, h('tr', null, ['Date', 'Holiday', 'Coverage', 'Type'].map((name) => h('th', { scope: 'col', text: name })))),
        h('tbody', null, [...d.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((day) => h('tr', null,
          h('td', null, h('time', { datetime: day.date, text: day.date })),
          h('td', null, h('div', { text: day.name }), day.localName !== day.name ? h('div', { class: 'field__hint', text: day.localName }) : null),
          h('td', { text: day.global ? 'Nationwide' : day.counties?.length ? day.counties.join(', ') : 'Regional (areas not supplied)' }),
          h('td', { text: day.types.join(', ') || 'Not supplied' }))))),
      ),
    ],
  });
  const countries = apiView({
    loadingText: 'Loading supported countries',
    load: (force) => availableCountries({ force }),
    isEmpty: (d) => !d.length && 'Nager.Date returned no supported countries.',
    render: (data) => {
      const previous = country.value;
      country.replaceChildren(...[...data].sort((a, b) => a.name.localeCompare(b.name)).map((c) => h('option', { value: c.countryCode, text: c.name })));
      country.value = data.some((c) => c.countryCode === previous) ? previous : data.some((c) => c.countryCode === 'ID') ? 'ID' : data[0].countryCode;
      country.disabled = false;
      search.disabled = false;
      return h('p', { class: 'field__hint', text: 'Country choices are supplied by Nager.Date.' });
    },
  });
  const form = h('form', { class: 'stack' }, h('div', { class: 'grid grid--2' },
    field({ label: 'Country', control: country }), field({ label: 'Year', control: year })), h('div', null, search));
  const submit = (event) => { event.preventDefault(); results.run(); };
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack' }, countries.el, panel('Holiday calendar', form), panel('Holidays', results.el));
  workspace.append(root);
  countries.run();
  return () => { form.removeEventListener('submit', submit); countries.destroy(); results.destroy(); root.remove(); };
}
