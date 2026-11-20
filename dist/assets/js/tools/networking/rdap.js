import { h, kv, status } from '../../core/dom.js';
import { rdapLookup } from '../../api/networking.js';
import { normalizeIP } from './subnet.js';
import { domainName, mountLookup } from './dns.js';

const SOURCE = { name: 'IANA RDAP bootstrap and registry RDAP servers', url: 'https://data.iana.org/rdap/' };

export function normalizeRdapQuery(value) {
  const s = String(value).trim();
  if (s.includes(':') && !s.includes('://') || /^[\d.]+$/.test(s)) return normalizeIP(s);
  const domain = domainName(s);
  if (domain.includes('_')) throw new Error('Registration lookups require a domain without service labels.');
  return domain;
}

export function rdapSummary(d) {
  const pairs = [['Object type', d.objectClassName], ['Domain', d.unicodeName || d.ldhName], ['Handle', d.handle], ['Network name', d.name], ['IP version', d.ipVersion], ['Start address', d.startAddress], ['End address', d.endAddress], ['Country', d.country], ['Status', Array.isArray(d.status) ? d.status.join(', ') : d.status]];
  for (const event of d.events || []) pairs.push([event.eventAction || 'Event', event.eventDate]);
  for (const ns of d.nameservers || []) pairs.push(['Name server', ns.unicodeName || ns.ldhName]);
  for (const entity of d.entities || []) {
    const name = entity.vcardArray?.[1]?.find?.(v => v[0] === 'fn')?.[3];
    pairs.push([(entity.roles || ['Entity']).join(', '), name || entity.handle || 'Name withheld']);
  }
  return pairs;
}

export function rdapTool(root) {
  return mountLookup(root, {
    label: 'Domain or IP address', placeholder: 'example.com', source: SOURCE, validate: normalizeRdapQuery,
    hint: 'Queries go to IANA and the responsible registry. The current adapter supports domains and IPv4 only; IPv6 returns an unsupported message.',
    load: (query, force) => rdapLookup(query, { force }),
    render: d => [kv(rdapSummary(d)), status('info', 'Redacted or missing registration fields are not inferred. Some registries restrict browser access.'), ...(d.notices || []).map(n => h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: n.title || 'Registry notice' }), h('p', { text: (n.description || []).join('\n') })))],
  });
}
