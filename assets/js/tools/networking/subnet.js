import { h, input, select, textarea, field, button, status, kv } from '../../core/dom.js';

export function ipv4ToInt(value) {
  const s = String(value).trim();
  if (!/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(s)) throw new Error('Enter four decimal IPv4 octets without leading zeros.');
  const parts = s.split('.').map(Number);
  if (parts.some(n => n > 255)) throw new Error('IPv4 octets must be between 0 and 255.');
  return parts.reduce((n, part) => n * 256 + part, 0);
}

export function intToIPv4(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('IPv4 integer must be between 0 and 4294967295.');
  return [24, 16, 8, 0].map(bits => Math.floor(n / 2 ** bits) % 256).join('.');
}

export function expandIPv6(value) {
  let s = String(value).trim().toLowerCase();
  if (!s || /[^0-9a-f:.]/.test(s)) throw new Error('Enter an IPv6 address without brackets, port, prefix or zone ID.');
  if (s.includes('.')) {
    const index = s.lastIndexOf(':');
    if (index < 0) throw new Error('Invalid IPv6 address.');
    const n = ipv4ToInt(s.slice(index + 1));
    s = s.slice(0, index + 1) + Math.floor(n / 65536).toString(16) + ':' + (n % 65536).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) throw new Error('IPv6 may contain only one double colon.');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const count = left.length + right.length;
  if ([...left, ...right].some(p => !/^[0-9a-f]{1,4}$/.test(p)) || (halves.length === 1 ? count !== 8 : count >= 8)) throw new Error('Invalid IPv6 group count or hexadecimal group.');
  return [...left, ...Array(8 - count).fill('0'), ...right].map(p => p.padStart(4, '0')).join(':');
}

export function compressIPv6(value) {
  const parts = expandIPv6(value).split(':').map(p => Number.parseInt(p, 16).toString(16));
  let bestStart = -1, bestLength = 1;
  for (let i = 0; i < 8;) {
    if (parts[i] !== '0') { i++; continue; }
    let end = i;
    while (end < 8 && parts[end] === '0') end++;
    if (end - i > bestLength) { bestStart = i; bestLength = end - i; }
    i = end;
  }
  if (bestStart < 0) return parts.join(':');
  return parts.slice(0, bestStart).join(':') + '::' + parts.slice(bestStart + bestLength).join(':');
}

export function normalizeIP(value) {
  const s = String(value).trim();
  return s.includes(':') ? compressIPv6(s) : intToIPv4(ipv4ToInt(s));
}

export function reversePtr(value) {
  const ip = normalizeIP(value);
  return ip.includes(':') ? expandIPv6(ip).replaceAll(':', '').split('').reverse().join('.') + '.ip6.arpa' : ip.split('.').reverse().join('.') + '.in-addr.arpa';
}

export function calculateSubnet(cidr) {
  const parts = String(cidr).trim().split('/');
  if (parts.length !== 2 || !/^(0|[1-9]\d?)$/.test(parts[1]) || Number(parts[1]) > 32) throw new Error('Enter IPv4/CIDR with a prefix from /0 to /32.');
  const ip = ipv4ToInt(parts[0]), prefix = Number(parts[1]);
  const size = 2 ** (32 - prefix), network = Math.floor(ip / size) * size, broadcast = network + size - 1;
  const usable = prefix >= 31 ? size : size - 2;
  return { cidr: `${intToIPv4(network)}/${prefix}`, prefix, network: intToIPv4(network), broadcast: intToIPv4(broadcast), mask: intToIPv4(2 ** 32 - size), wildcard: intToIPv4(size - 1), first: intToIPv4(network + (prefix >= 31 ? 0 : 1)), last: intToIPv4(broadcast - (prefix >= 31 ? 0 : 1)), size, usable };
}

export function splitSubnet(cidr, newPrefix, limit = 256) {
  const subnet = calculateSubnet(cidr);
  if (!Number.isInteger(newPrefix) || newPrefix < subnet.prefix || newPrefix > 32) throw new Error(`Split prefix must be between /${subnet.prefix} and /32.`);
  if (!Number.isInteger(limit) || limit < 1 || limit > 256) throw new Error('Output limit must be 1 to 256.');
  const count = 2 ** (newPrefix - subnet.prefix), size = 2 ** (32 - newPrefix), start = ipv4ToInt(subnet.network);
  return { count, truncated: count > limit, subnets: Array.from({ length: Math.min(count, limit) }, (_, i) => `${intToIPv4(start + i * size)}/${newPrefix}`) };
}

export function convertIPv4(value, format = 'dotted') {
  const s = String(value).trim();
  let n;
  if (format === 'dotted') n = ipv4ToInt(s);
  else if (format === 'integer' && /^\d{1,10}$/.test(s)) n = Number(s);
  else if (format === 'hex' && /^(?:0x)?[0-9a-f]{1,8}$/i.test(s)) n = Number.parseInt(s.replace(/^0x/i, ''), 16);
  else if (format === 'binary' && /^(?:0b)?[01]{1,32}$/.test(s)) n = Number.parseInt(s.replace(/^0b/i, ''), 2);
  else throw new Error('Input does not match the selected IPv4 format.');
  return { dotted: intToIPv4(n), integer: n, hex: '0x' + n.toString(16).padStart(8, '0'), binary: n.toString(2).padStart(32, '0') };
}

export function subnetTool(root) {
  const cidr = input({ placeholder: '192.0.2.10/24' }), split = input({ type: 'number', min: 0, max: 32, placeholder: 'Optional' });
  const output = h('div', { class: 'stack', 'aria-live': 'polite' }, status('info', 'Enter an IPv4 CIDR to calculate its range.'));
  const form = h('form', { class: 'stack', onsubmit: e => {
    e.preventDefault();
    try {
      const s = calculateSubnet(cidr.value);
      const entries = [['Network', s.cidr], ['Subnet mask', s.mask], ['Wildcard mask', s.wildcard], ['Last address / broadcast', s.broadcast], ['First usable', s.first], ['Last usable', s.last], ['Total addresses', s.size], ['Usable addresses', s.usable]];
      output.replaceChildren(kv(entries), status('info', s.prefix === 31 ? '/31 uses both addresses for point-to-point links (RFC 3021), with no broadcast.' : s.prefix === 32 ? '/32 represents one host, with no broadcast.' : 'Usable range excludes the network and broadcast addresses.'));
      if (split.value !== '') {
        const result = splitSubnet(cidr.value, Number(split.value));
        output.append(status('info', `${result.count} subnets. Showing ${result.subnets.length}${result.truncated ? ' (output capped at 256)' : ''}.`), field({ label: 'Split subnets', control: textarea({ readOnly: true, value: result.subnets.join('\n') }) }));
      }
    } catch (err) { output.replaceChildren(status('err', err.message)); }
  } }, field({ label: 'IPv4 CIDR', control: cidr }), field({ label: 'Split into prefix (optional)', control: split }), button('Calculate subnet', { type: 'submit', variant: 'primary' }));
  root.append(form, output);
}

export function ipConvertTool(root) {
  const source = input({ placeholder: '192.0.2.1 or 2001:db8::1' });
  const format = select([['dotted', 'IPv4 dotted decimal'], ['integer', 'IPv4 integer'], ['hex', 'IPv4 hexadecimal'], ['binary', 'IPv4 binary'], ['ipv6', 'IPv6']]);
  const output = h('div', { 'aria-live': 'polite' }, status('info', 'Choose the input format, then enter an address.'));
  root.append(h('form', { class: 'stack', onsubmit: e => {
    e.preventDefault();
    try {
      const data = format.value === 'ipv6' ? { compressed: compressIPv6(source.value), expanded: expandIPv6(source.value), PTR: reversePtr(source.value) } : convertIPv4(source.value, format.value);
      output.replaceChildren(kv(Object.entries(data)));
    } catch (err) { output.replaceChildren(status('err', err.message)); }
  } }, field({ label: 'Input format', control: format }), field({ label: 'IP address or value', control: source }), button('Convert address', { type: 'submit', variant: 'primary' })), output);
}
