import { request, isObj, ApiError } from './api-client.js';

export const HOLIDAY_SOURCE = { name: 'Nager.Date', url: 'https://date.nager.at/' };
export const POSTAL_SOURCE = { name: 'Zippopotam.us (GeoNames data)', url: 'https://api.zippopotam.us/' };
export const SUN_SOURCE = { name: 'Sunrise-Sunset.org', url: 'https://sunrise-sunset.org/' };

const invalid = (source, message) => ({ ok: false, source, error: new ApiError('input', message) });
const text = (v) => typeof v === 'string';
const strings = (v) => Array.isArray(v) && v.every(text);
const empty404 = (res, data) => res.error?.status === 404
  ? { ok: true, data, source: res.source, fetchedAt: Date.now(), fromCache: false, status: 404 }
  : res;

export function availableCountries({ force = false } = {}) {
  return request('https://date.nager.at/api/v3/AvailableCountries', {
    force, cacheTtl: 86400000, source: HOLIDAY_SOURCE,
    validate: (d) => Array.isArray(d) && d.every((c) => /^[A-Z]{2}$/.test(c?.countryCode) && text(c.name))
      || 'Nager.Date returned an unexpected country list.',
  });
}

export async function publicHolidays(year, country, { force = false } = {}) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !/^[A-Z]{2}$/.test(country)) {
    return invalid(HOLIDAY_SOURCE, 'Choose a country and enter a whole year from 1 to 9999.');
  }
  const res = await request(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
    force, cacheTtl: 86400000, source: HOLIDAY_SOURCE,
    validate: (d) => Array.isArray(d) && d.every((v) => isObj(v) && text(v.date) && text(v.name)
      && text(v.localName) && typeof v.global === 'boolean' && (v.counties == null || strings(v.counties)) && strings(v.types))
      || 'Nager.Date returned unexpected holiday data.',
  });
  return empty404(res, []);
}

// Country codes published at https://api.zippopotam.us/#where (not global coverage).
export const POSTAL_COUNTRIES = [
  ['AD', 'Andorra'], ['AR', 'Argentina'], ['AS', 'American Samoa'], ['AT', 'Austria'], ['AU', 'Australia'],
  ['BD', 'Bangladesh'], ['BE', 'Belgium'], ['BG', 'Bulgaria'], ['BR', 'Brazil'], ['CA', 'Canada'],
  ['CH', 'Switzerland'], ['CZ', 'Czechia'], ['DE', 'Germany'], ['DK', 'Denmark'], ['DO', 'Dominican Republic'],
  ['ES', 'Spain'], ['FI', 'Finland'], ['FO', 'Faroe Islands'], ['FR', 'France'], ['GB', 'United Kingdom'],
  ['GF', 'French Guiana'], ['GG', 'Guernsey'], ['GL', 'Greenland'], ['GP', 'Guadeloupe'], ['GT', 'Guatemala'],
  ['GU', 'Guam'], ['GY', 'Guyana'], ['HR', 'Croatia'], ['HU', 'Hungary'], ['IM', 'Isle of Man'],
  ['IN', 'India'], ['IS', 'Iceland'], ['IT', 'Italy'], ['JE', 'Jersey'], ['JP', 'Japan'],
  ['LI', 'Liechtenstein'], ['LK', 'Sri Lanka'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MC', 'Monaco'],
  ['MD', 'Moldova'], ['MH', 'Marshall Islands'], ['MK', 'North Macedonia'], ['MP', 'Northern Mariana Islands'],
  ['MQ', 'Martinique'], ['MX', 'Mexico'], ['MY', 'Malaysia'], ['NL', 'Netherlands'], ['NO', 'Norway'],
  ['NZ', 'New Zealand'], ['PH', 'Philippines'], ['PK', 'Pakistan'], ['PL', 'Poland'], ['PM', 'Saint Pierre and Miquelon'],
  ['PR', 'Puerto Rico'], ['PT', 'Portugal'], ['RE', 'Réunion'], ['RU', 'Russia'], ['SE', 'Sweden'],
  ['SI', 'Slovenia'], ['SJ', 'Svalbard and Jan Mayen'], ['SK', 'Slovakia'], ['SM', 'San Marino'],
  ['TH', 'Thailand'], ['TR', 'Türkiye'], ['US', 'United States'], ['VA', 'Vatican City'],
  ['VI', 'US Virgin Islands'], ['YT', 'Mayotte'], ['ZA', 'South Africa'],
].sort((a, b) => a[1].localeCompare(b[1]));

export async function postalLookup(country, postal, { force = false } = {}) {
  country = String(country).toUpperCase();
  postal = String(postal).trim().toUpperCase();
  if (!POSTAL_COUNTRIES.some(([code]) => code === country) || !/^[A-Z0-9][A-Z0-9 -]{0,19}$/.test(postal)) {
    return invalid(POSTAL_SOURCE, 'Choose a listed country and enter a postal code using letters, digits, spaces or hyphens (up to 20 characters).');
  }
  const res = await request(`https://api.zippopotam.us/${country}/${encodeURIComponent(postal)}`, {
    force, cacheTtl: 86400000, source: POSTAL_SOURCE,
    validate: (d) => isObj(d) && text(d.country) && text(d['post code']) && Array.isArray(d.places)
      && d.places.every((p) => isObj(p) && text(p['place name']) && text(p.state))
      || 'Zippopotam.us returned unexpected place data.',
  });
  return empty404(res, { places: [] });
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function sunTimes(lat, lng, date, { force = false } = {}) {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !validDate(date)) {
    return invalid(SUN_SOURCE, 'Enter latitude from -90 to 90, longitude from -180 to 180, and a valid date.');
  }
  const q = new URLSearchParams({ lat, lng, date, formatted: '0' });
  const res = await request(`https://api.sunrise-sunset.org/json?${q}`, {
    force, cacheTtl: 86400000, source: SUN_SOURCE,
    validate: (d) => {
      if (d?.status !== 'OK') return `Sunrise-Sunset.org could not calculate these times (${text(d?.status) ? d.status : 'unexpected response'}).`;
      return isObj(d.results) && ('sunrise' in d.results) && ('sunset' in d.results)
        && (d.results.day_length == null || (Number.isFinite(Number(d.results.day_length)) && Number(d.results.day_length) >= 0))
        || 'Sunrise-Sunset.org returned unexpected sun data.';
    },
  });
  if (res.ok) res.data = { ...res.data.results, date, lat, lng };
  return res;
}
