import { h, input, select, field, button, status, kv } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { doh, DOH_SOURCE, RR_TYPES, normalizeDomain } from '../../api/networking.js';
import { reversePtr, normalizeIP } from './subnet.js';

export function domainName(value) {
  const result = normalizeDomain(value);
  if (result.error) throw new Error(result.error);
  return result.domain;
}

export function dnsResult(result) {
  if (result.ok && result.data.status !== 0) return { ...result, ok: false, error: new Error(`DNS returned ${result.data.rcode}.${result.data.comment ? ' ' + result.data.comment : ''}`) };
  return result;
}

export function recordList(records, empty = 'No matching records were returned.') {
  if (!records?.length) return status('info', empty);
  return h('div', { class: 'stack' }, records.map(r => kv([['Name', r.name], ['Type', r.type], ['TTL (seconds)', r.ttl], ['Data', r.data]])));
}

export function mountLookup(root, { label, placeholder, hint, source, validate, load, render, controls = [], action = 'Look up', idle = 'Enter a value and submit to look it up.' }) {
  const query = input({ placeholder });
  let submitted;
  const view = apiView({
    idle: status('info', idle), loadingText: 'Looking up records',
    load: async force => {
      try {
        if (submitted === undefined) throw new Error('Enter a value first.');
        return await load(validate(submitted), force);
      } catch (error) { return { ok: false, error, source }; }
    }, render,
  });
  const form = h('form', { class: 'stack', onsubmit: e => { e.preventDefault(); submitted = query.value; view.run(); } },
    field({ label, control: query, hint }), ...controls, button(action, { variant: 'primary', type: 'submit' }));
  root.append(form, view.el);
  return () => { view.destroy(); form.remove(); };
}

export function dnsLookupTool(root) {
  const type = select([...new Set(Object.values(RR_TYPES))]);
  let selectedType = type.value;
  const fieldType = field({ label: 'Record type', control: type });
  const cleanup = mountLookup(root, {
    label: 'Domain or DNS name', placeholder: 'example.com', hint: 'Queries go to Google Public DNS. Service labels such as _dmarc are accepted.', source: DOH_SOURCE,
    controls: [fieldType], validate: domainName,
    load: async (name, force) => dnsResult(await doh(name, selectedType, { force, dnssec: true })),
    render: d => [kv([['Resolver status', d.rcode], ['DNSSEC AD flag', d.ad ? 'Validated by resolver' : 'Not validated (not proof of a security problem)']]), recordList(d.answers), d.authority.length ? h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: 'Authority records' }), recordList(d.authority)) : null],
  });
  const form = root.querySelector('form');
  form.addEventListener('submit', () => { selectedType = type.value; }, true);
  return cleanup;
}

export function reverseDnsTool(root) {
  return mountLookup(root, {
    label: 'IPv4 or IPv6 address', placeholder: '192.0.2.1', source: DOH_SOURCE, validate: normalizeIP,
    hint: 'The address is sent to Google Public DNS. A missing PTR record is common and does not mean the host is offline.',
    load: async (ip, force) => {
      const name = reversePtr(ip), result = dnsResult(await doh(name, 'PTR', { force, dnssec: true }));
      return result.ok ? { ...result, data: { ...result.data, name, ip } } : result;
    },
    render: d => [kv([['Address', d.ip], ['Reverse query', d.name], ['DNSSEC AD flag', d.ad ? 'Validated by resolver' : 'Not validated']]), recordList(d.answers, 'No PTR hostname returned for this address.')],
  });
}
