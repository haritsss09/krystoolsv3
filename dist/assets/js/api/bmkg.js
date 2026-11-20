import { request, isObj } from './api-client.js';

export const QUAKE_SOURCE = { name: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)', url: 'https://data.bmkg.go.id/gempabumi/' };
export const WEATHER_SOURCE = { name: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)', url: 'https://data.bmkg.go.id/prakiraan-cuaca/' };

const BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/';

function normalizeQuake(g) {
  const [lat, lon] = String(g.Coordinates || '').split(',').map(Number);
  return {
    time: g.DateTime ? new Date(g.DateTime) : null,
    dateLabel: `${g.Tanggal || ''} ${g.Jam || ''}`.trim(),
    magnitude: Number(g.Magnitude),
    depth: g.Kedalaman || '',
    region: g.Wilayah || '',
    potential: g.Potensi || '',
    felt: g.Dirasakan || '',
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    latLabel: g.Lintang || '',
    lonLabel: g.Bujur || '',
    shakemap: g.Shakemap && /^[\w.-]+\.(jpg|png)$/i.test(g.Shakemap) ? BASE + g.Shakemap : null,
    id: g.DateTime || `${g.Tanggal} ${g.Jam}`,
  };
}

const validQuake = (g) => isObj(g) && (g.DateTime || g.Tanggal) && g.Magnitude != null;

export async function latestQuake({ force = false } = {}) {
  const res = await request(BASE + 'autogempa.json', {
    cacheTtl: 60000,
    force,
    source: QUAKE_SOURCE,
    validate: (d) => (validQuake(d?.Infogempa?.gempa) ? true : 'BMKG returned earthquake data in an unexpected format.'),
  });
  if (res.ok) res.data = normalizeQuake(res.data.Infogempa.gempa);
  return res;
}

export async function quakeList(kind, { force = false } = {}) {
  const file = kind === 'felt' ? 'gempadirasakan.json' : 'gempaterkini.json';
  const res = await request(BASE + file, {
    cacheTtl: 120000,
    force,
    source: QUAKE_SOURCE,
    validate: (d) => {
      const list = d?.Infogempa?.gempa;
      return Array.isArray(list) && list.every(validQuake) ? true : 'BMKG returned an earthquake list in an unexpected format.';
    },
  });
  if (res.ok) res.data = res.data.Infogempa.gempa.map(normalizeQuake);
  return res;
}

export const ADM4_RE = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

export async function forecast(adm4, { force = false } = {}) {
  const res = await request(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`, {
    cacheTtl: 30 * 60000,
    force,
    source: WEATHER_SOURCE,
    validate: (d) => {
      const first = d?.data?.[0];
      return isObj(first?.lokasi) && Array.isArray(first?.cuaca) ? true : 'BMKG returned forecast data in an unexpected format.';
    },
  });
  if (res.ok) {
    const block = res.data.data[0];
    const loc = { ...block.lokasi, ...(res.data.lokasi || {}) };
    const steps = block.cuaca.flat().filter(isObj).map((c) => ({
      local: c.local_datetime || '',
      utc: c.datetime ? new Date(c.datetime) : null,
      temp: Number(c.t),
      humidity: Number(c.hu),
      cloud: Number(c.tcc),
      rain: Number(c.tp),
      desc: c.weather_desc || '',
      descEn: c.weather_desc_en || '',
      windDir: c.wd || '',
      windSpeed: Number(c.ws),
      visibility: c.vs_text || '',
      icon: typeof c.image === 'string' && /^https:\/\/api-apps\.bmkg\.go\.id\//.test(c.image) ? c.image : null,
    }));
    res.data = {
      location: {
        village: loc.desa || '', district: loc.kecamatan || '', city: loc.kotkab || '', province: loc.provinsi || '',
        lat: Number(loc.lat), lon: Number(loc.lon), timezone: loc.timezone || 'Asia/Jakarta',
      },
      steps,
    };
  } else if (res.error?.status === 404) {
    res.error.message = 'BMKG has no forecast for this location code. Check the code, or pick a listed city.';
  }
  return res;
}

export const CITIES = [
  ['31.71.03.1001', 'Jakarta Pusat'],
  ['36.71.01.1001', 'Tangerang'],
  ['32.73.01.1001', 'Bandung'],
  ['33.74.01.1001', 'Semarang'],
  ['34.71.01.1001', 'Yogyakarta'],
  ['35.78.01.1001', 'Surabaya'],
  ['51.71.01.1001', 'Denpasar'],
  ['12.71.01.1001', 'Medan'],
  ['13.71.01.1001', 'Padang'],
  ['16.71.01.1001', 'Palembang'],
  ['63.71.01.1001', 'Banjarmasin'],
  ['64.72.01.1001', 'Samarinda'],
  ['73.71.01.1001', 'Makassar'],
  ['71.71.01.1001', 'Manado'],
];
