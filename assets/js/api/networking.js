import { request, isObj, ApiError } from './api-client.js';

export const IPWHO_SOURCE = { name: 'ipwho.is', url: 'https://ipwhois.io/documentation' };
export const IPIFY_SOURCE = { name: 'ipify', url: 'https://www.ipify.org/' };
export const DOH_SOURCE = { name: 'Google Public DNS', url: 'https://developers.google.com/speed/public-dns/docs/doh/json' };

function normalizeIp(d) {
  return {
    ip: d.ip,
    type: d.type,
    city: d.city || '',
    region: d.region || '',
    country: d.country || '',
    countryCode: d.country_code || '',
    continent: d.continent || '',
    postal: d.postal || '',
    lat: d.latitude,
    lon: d.longitude,
    asn: d.connection?.asn || null,
    org: d.connection?.org || '',
    isp: d.connection?.isp || '',
    domain: d.connection?.domain || '',
    timezone: d.timezone?.id || '',
    utcOffset: d.timezone?.utc || '',
  };
}

const validIpwho = (d) => {
  if (!isObj(d)) return 'ipwho.is returned an unexpected response.';
  if (d.success === false) return d.message ? `ipwho.is: ${d.message}.` : 'ipwho.is could not look up this address.';
  return typeof d.ip === 'string' ? true : 'ipwho.is returned an unexpected response.';
};

export async function lookupIp(ip = '', { force = false } = {}) {
  const res = await request(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    cacheTtl: ip ? 6 * 3600000 : 10 * 60000,
    force,
    source: IPWHO_SOURCE,
    validate: validIpwho,
  });
  if (res.ok) res.data = normalizeIp(res.data);
  return res;
}

export async function myIp({ force = false } = {}) {
  const res = await lookupIp('', { force });
  if (res.ok) return res;
  const plain = await request('https://api.ipify.org?format=json', {
    cacheTtl: 10 * 60000,
    force,
    source: IPIFY_SOURCE,
    validate: (d) => (typeof d?.ip === 'string' ? true : 'ipify returned an unexpected response.'),
  });
  if (plain.ok) plain.data = { ip: plain.data.ip };
  return plain.ok ? plain : res;
}

export const RR_TYPES = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 46: 'RRSIG', 48: 'DNSKEY', 65: 'HTTPS', 257: 'CAA' };
export const RCODES = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };

export async function doh(name, type, { force = false, dnssec = false } = {}) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}${dnssec ? '&do=1' : ''}`;
  const res = await request(url, {
    cacheTtl: 60000,
    force,
    source: DOH_SOURCE,
    validate: (d) => (isObj(d) && typeof d.Status === 'number' ? true : 'The DNS resolver returned an unexpected response.'),
  });
  if (!res.ok) return res;
  const d = res.data;
  return {
    ...res,
    data: {
      status: d.Status,
      rcode: RCODES[d.Status] || String(d.Status),
      ad: Boolean(d.AD),
      answers: (d.Answer || []).map((a) => ({ name: a.name, type: RR_TYPES[a.type] || String(a.type), ttl: a.TTL, data: a.data })),
      authority: (d.Authority || []).map((a) => ({ name: a.name, type: RR_TYPES[a.type] || String(a.type), ttl: a.TTL, data: a.data })),
      comment: d.Comment || '',
    },
  };
}

/* Hostname validation: letters, digits, hyphens, IDN punycode; at least one dot. */
export function normalizeDomain(input) {
  let v = String(input || '').trim().toLowerCase();
  if (!v) return { error: 'Enter a domain name.' };
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(v)) v = new URL(v).hostname;
  } catch {}
  v = v.replace(/\/.*$/, '').replace(/\.$/, '');
  try {
    v = new URL('http://' + v).hostname;
  } catch {
    return { error: 'That does not look like a domain name.' };
  }
  if (!/^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(v)) {
    return { error: 'That does not look like a domain name, for example example.com.' };
  }
  return { domain: v };
}

/* RDAP via the IANA bootstrap registry */
const RDAP_SOURCE = { name: 'IANA RDAP bootstrap and registry RDAP servers', url: 'https://data.iana.org/rdap/' };

async function bootstrap(kind) {
  return request(`https://data.iana.org/rdap/${kind}.json`, {
    cacheTtl: 24 * 3600000,
    source: RDAP_SOURCE,
    validate: (d) => (Array.isArray(d?.services) ? true : 'The IANA RDAP bootstrap file has an unexpected format.'),
  });
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
}

function inCidr4(ip, cidr) {
  const [base, bits] = cidr.split('/');
  const size = 2 ** (32 - Number(bits));
  const start = ipv4ToInt(base);
  const v = ipv4ToInt(ip);
  return v >= start && v < start + size;
}

export async function rdapServerFor(query) {
  const isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(query);
  const isV6 = query.includes(':');
  if (isV6) return { error: new ApiError('unsupported', 'IPv6 RDAP lookups are not supported yet. Try an IPv4 address or a domain.') };
  const boot = await bootstrap(isV4 ? 'ipv4' : 'dns');
  if (!boot.ok) return { error: boot.error };
  if (isV4) {
    for (const [ranges, urls] of boot.data.services) {
      if (ranges.some((r) => inCidr4(query, r))) return { base: pickHttps(urls), kind: 'ip' };
    }
    return { error: new ApiError('unsupported', 'No RDAP server is registered for this address range.') };
  }
  const labels = query.split('.');
  for (let i = 0; i < labels.length; i++) {
    const suffix = labels.slice(i).join('.');
    for (const [tlds, urls] of boot.data.services) {
      if (tlds.includes(suffix)) return { base: pickHttps(urls), kind: 'domain' };
    }
  }
  return { error: new ApiError('unsupported', `.${labels[labels.length - 1]} does not publish an RDAP service in the IANA registry, so registration data is not available here.`) };
}

const pickHttps = (urls) => {
  const u = urls.find((x) => x.startsWith('https://')) || urls[0];
  return u.endsWith('/') ? u : u + '/';
};

export async function rdapLookup(query, { force = false } = {}) {
  const server = await rdapServerFor(query);
  if (server.error) return { ok: false, error: server.error, source: RDAP_SOURCE };
  const url = `${server.base}${server.kind}/${encodeURIComponent(query)}`;
  const res = await request(url, {
    cacheTtl: 3600000,
    force,
    timeout: 12000,
    source: { name: `RDAP: ${new URL(server.base).host}`, url },
    init: { headers: { Accept: 'application/rdap+json, application/json' } },
    validate: (d) => (isObj(d) && (d.objectClassName || d.ldhName || d.handle) ? true : 'The registry returned an unexpected RDAP response.'),
  });
  if (!res.ok && res.error?.status === 404) res.error.message = 'The registry has no record of this name. It may be unregistered.';
  return res;
}
