import { h, status, kv } from '../../core/dom.js';
import { doh, DOH_SOURCE } from '../../api/networking.js';
import { domainName, mountLookup, recordList } from '../networking/dns.js';

export function joinTxt(value) {
  const text = String(value);
  const chunks = [...text.matchAll(/"((?:\\.|[^"\\])*)"/g)];
  return chunks.length ? chunks.map(m => m[1].replace(/\\(["\\])/g, '$1')).join('') : text;
}

export function securityRecords(kind, answers) {
  const type = kind === 'SPF' || kind === 'DMARC' ? 'TXT' : kind;
  return (answers || []).filter(r => r.type === type && (kind === 'SPF' ? /^v=spf1(?:\s|$)/i.test(joinTxt(r.data)) : kind === 'DMARC' ? /^v=DMARC1(?:;|\s|$)/i.test(joinTxt(r.data)) : true));
}

export function dnsSecurityTool(root) {
  return mountLookup(root, {
    label: 'Domain', placeholder: 'example.com', source: DOH_SOURCE,
    hint: 'Queries SPF, _dmarc TXT, CAA and MX through Google Public DNS. This is a record lookup, not a security audit.',
    validate: value => {
      const domain = domainName(value);
      if (domain.includes('_')) throw new Error('Enter the base domain, not a service label.');
      return domain;
    },
    load: async (domain, force) => {
      const queries = [['SPF', domain, 'TXT'], ['DMARC', '_dmarc.' + domain, 'TXT'], ['CAA', domain, 'CAA'], ['MX', domain, 'MX']];
      const results = await Promise.all(queries.map(async ([kind, name, type]) => {
        const result = await doh(name, type, { force, dnssec: true });
        return { kind, name, result };
      }));
      if (results.every(q => !q.result.ok)) return results[0].result;
      return { ok: true, data: { domain, results }, source: DOH_SOURCE, fetchedAt: Math.min(...results.filter(q => q.result.ok).map(q => q.result.fetchedAt || Date.now())), fromCache: results.every(q => q.result.fromCache) };
    },
    render: ({ domain, results }) => [
      status('info', `Results for ${domain}. DKIM needs a known selector and is not checked. Parent-domain CAA inheritance, DMARC organizational fallback and SPF include chains are not evaluated.`),
      ...results.map(({ kind, name, result }) => {
        const d = result.data;
        if (!result.ok) return h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: kind }), status('err', result.error?.message || 'This query failed. Refresh to retry.'));
        const records = securityRecords(kind, d.answers);
        return h('section', { class: 'stack' }, h('h2', { class: 'panel__title', text: kind }),
          kv([['Query', name], ['Resolver status', d.rcode], ['DNSSEC AD flag', d.ad ? 'Validated by resolver for this response' : 'Not validated; unsigned, unavailable or other resolver outcome']]),
          d.status !== 0 ? status('err', `DNS returned ${d.rcode}. This is not evidence that a policy is absent.`) : recordList(records, `No ${kind} record returned at this exact name. This alone does not establish an insecure configuration.`),
          records.length > 1 && ['SPF', 'DMARC'].includes(kind) ? status('info', `Multiple ${kind} records found. Review the policy configuration.`) : null);
      }),
      status('info', 'AD is the resolver’s validation assertion, not independent validation by this browser. Record presence does not prove correct configuration.'),
    ],
  });
}
