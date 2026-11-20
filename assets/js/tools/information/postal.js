import { h, field, input, select, button, panel, status, kv } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { POSTAL_COUNTRIES, postalLookup } from '../../api/geography.js';
import { osmLink } from './bmkg-view.js';

export function postalTool(workspace) {
  const country = select(POSTAL_COUNTRIES, { value: 'US', required: true });
  const postal = input({ required: true, maxlength: '20', placeholder: '90210' });
  const view = apiView({
    loadingText: 'Looking up postal code',
    idle: status('info', 'Enter a postal code to find its places. Coverage is limited to the source’s listed countries.'),
    load: (force) => postalLookup(country.value, postal.value, { force }),
    isEmpty: (d) => !d.places.length && 'No places were found. Check the postal code and country. Some countries only have partial-code coverage.',
    render: (data) => [
      h('h2', { text: `${data['post code']} · ${data.country}` }),
      ...data.places.map((place) => {
        const lat = Number(place.latitude);
        const lng = Number(place.longitude);
        const hasCoordinates = place.latitude != null && String(place.latitude).trim() !== '' && place.longitude != null && String(place.longitude).trim() !== ''
          && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
        return h('section', { class: 'stack' }, h('h3', { text: place['place name'] }),
          kv([['State / region', place.state || 'Not supplied'], ['State code', place['state abbreviation']],
            ['Coordinates', hasCoordinates ? `${lat}, ${lng}` : 'Not supplied']]),
          hasCoordinates ? h('a', { href: osmLink(lat, lng), target: '_blank', rel: 'noopener noreferrer', text: 'Open place on OpenStreetMap' }) : null);
      }),
    ],
  });
  const form = h('form', { class: 'stack' }, h('div', { class: 'grid grid--2' },
    field({ label: 'Country', control: country }), field({ label: 'Postal code', control: postal, hint: 'Keep leading zeroes. Canada: first 3 characters (A0A); UK: outward code (AB1); Netherlands: 4 digits.' })),
    h('div', null, button('Look up postal code', { type: 'submit', variant: 'primary' })));
  const submit = (event) => { event.preventDefault(); view.run(); };
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack' }, panel('Postal lookup', form), panel('Places', view.el));
  workspace.append(root);
  return () => { form.removeEventListener('submit', submit); view.destroy(); root.remove(); };
}
