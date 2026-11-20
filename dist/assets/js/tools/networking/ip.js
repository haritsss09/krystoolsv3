import { status, kv } from '../../core/dom.js';
import { lookupIp, myIp, IPWHO_SOURCE } from '../../api/networking.js';
import { normalizeIP } from './subnet.js';
import { mountLookup } from './dns.js';

export function ipLookupTool(root) {
  return mountLookup(root, {
    label: 'IP address (optional)', placeholder: 'Leave blank for your public IP',
    hint: 'Uses ipwho.is, with ipify as a public-IP fallback. Geolocation is approximate, not a person’s location.',
    source: IPWHO_SOURCE, validate: value => value.trim() ? normalizeIP(value) : '', action: 'Look up IP',
    idle: 'Submit with no address to request your public IP, or enter an IPv4 or IPv6 address.',
    load: (ip, force) => ip ? lookupIp(ip, { force }) : myIp({ force }),
    render: d => [kv([['IP address', d.ip], ['Address family', d.type], ['Country', d.country], ['Region', d.region], ['City', d.city], ['Postal code', d.postal], ['Latitude', d.lat], ['Longitude', d.lon], ['ASN', d.asn ? `AS${d.asn}` : null], ['Organization', d.org], ['ISP', d.isp], ['Domain', d.domain], ['Time zone', d.timezone], ['UTC offset', d.utcOffset]]), !d.type ? status('info', 'Only the public IP is available from the fallback provider. Location and ASN data were not returned.') : status('info', 'Provider location and ownership data can be incomplete or outdated.')],
  });
}
