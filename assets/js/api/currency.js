import { request, isObj } from './api-client.js';

export const FX_SOURCE = { name: 'Frankfurter (European Central Bank reference rates)', url: 'https://frankfurter.dev/' };
const BASE = 'https://api.frankfurter.dev/v1';

export async function currencies({ force = false } = {}) {
  return request(`${BASE}/currencies`, {
    cacheTtl: 7 * 24 * 3600000,
    force,
    source: FX_SOURCE,
    validate: (d) => (isObj(d) && Object.keys(d).length > 5 ? true : 'Frankfurter returned an unexpected currency list.'),
  });
}

export async function latestRates(base, symbols = [], { force = false } = {}) {
  const q = new URLSearchParams({ base });
  if (symbols.length) q.set('symbols', symbols.join(','));
  return request(`${BASE}/latest?${q}`, {
    cacheTtl: 30 * 60000,
    force,
    source: FX_SOURCE,
    validate: (d) => (isObj(d?.rates) && typeof d.date === 'string' ? true : 'Frankfurter returned unexpected rate data.'),
  });
}

export async function rateSeries(base, symbol, from, to, { force = false } = {}) {
  return request(`${BASE}/${from}..${to}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbol)}`, {
    cacheTtl: 6 * 3600000,
    force,
    source: FX_SOURCE,
    validate: (d) => (isObj(d?.rates) ? true : 'Frankfurter returned unexpected history data.'),
  });
}
