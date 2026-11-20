import { h, field, input, select, button, panel, status, kv } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { call } from '../../api/backend.js';

function renderAttempt(result, showHeaders) {
  if (!result.ok) return h('section', { class: 'stack' },
    h('h3', { text: `Attempt ${result.attempt}` }),
    status('err', result.error?.message || 'The check did not complete.'),
    kv([['Elapsed', `${result.durationMs} ms`]]));
  return h('section', { class: 'stack', style: 'min-width:0;overflow-wrap:anywhere' },
    h('h3', { text: `Attempt ${result.attempt}: HTTP ${result.status}` }),
    kv([['Final URL', result.finalUrl], ['Total time', `${result.durationMs} ms`], ['Redirects followed', result.redirects]]),
    h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': `Attempt ${result.attempt} request hops` },
      h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['URL', 'HTTP', 'DNS', 'Connect / TLS / HEAD'].map((text) => h('th', { scope: 'col', text })))),
        h('tbody', null, result.hops.map((hop) => h('tr', null,
          h('td', { class: 'mono', text: hop.url }), h('td', { text: hop.status }),
          h('td', { text: `${hop.dnsMs} ms` }), h('td', { text: `${hop.headMs} ms` })))))),
    showHeaders ? h('div', { class: 'stack' },
      h('h4', { text: 'Header presence on the final response' }),
      ...result.checks.map((check) => h('div', { class: 'stack', style: 'gap:var(--space-2)' },
        kv([[check.name, check.state], ['Value', check.values.join('\n')]]),
        h('p', { class: 'field__hint', text: check.note }))),
      h('details', null, h('summary', { text: 'Response headers (cookies omitted)' }),
        kv(Object.entries(result.headers).map(([name, values]) => [name, values.join('\n')])))) : null);
}

// Shared by the two registry entry points so their request and result contracts stay aligned.
export function inspectionTool(workspace, action) {
  const showHeaders = action === 'header';
  const url = input({ type: 'url', required: true, maxlength: '2048', placeholder: 'https://example.com', 'aria-label': 'Website URL' });
  const attempts = select([['1', '1 attempt'], ['2', '2 attempts'], ['3', '3 attempts']], { value: '1' });
  const submitButton = button(showHeaders ? 'Check headers' : 'Check URL status', { type: 'submit', variant: 'primary' });
  let lastRequest = null;
  let pending = null;
  let destroyed = false;
  const view = apiView({
    idle: status('info', 'No request has been sent. Enter a public website you own or have permission to check, then submit.'),
    loadingText: showHeaders ? 'Reading website response headers' : 'Checking website status sequentially',
    load: () => {
      if (pending) return pending;
      if (!lastRequest) return { ok: false, error: { message: 'Enter a website URL and submit the form.' } };
      submitButton.disabled = url.disabled = attempts.disabled = true;
      pending = call('net-inspect', lastRequest, { timeout: 12000, source: { name: 'KrysTools server HEAD check; DNS via Google Public DNS' } })
        .then((result) => {
          if (result.ok && (!Array.isArray(result.data?.results) || !result.data?.limits)) {
            return { ...result, ok: false, error: { message: 'The server returned an unsupported inspection response.' } };
          }
          return result;
        })
        .finally(() => {
          pending = null;
          if (!destroyed) submitButton.disabled = url.disabled = attempts.disabled = false;
        });
      return pending;
    },
    isEmpty: (data) => !data.results.length && 'No attempts completed. Submit another check when the server is available.',
    render: (data) => [
      h('p', { class: 'field__hint', text: data.note }),
      kv([['Method', data.method], ['Attempts completed', `${data.attemptsCompleted} of ${data.attemptsRequested}`], ['Overall elapsed', `${data.durationMs} ms`]]),
      ...data.results.map((result) => renderAttempt(result, showHeaders)),
      h('details', null, h('summary', { text: 'Service limits' }),
        kv([['Total deadline', `${data.limits.deadlineMs} ms across all attempts`], ['Maximum redirects', data.limits.redirects],
          ['Response header limit', `${data.limits.headerBytes} bytes per hop`], ['Requests per IP / minute', data.limits.requestsPerIp],
          ['Requests per instance / minute', data.limits.requestsGlobal], ['Concurrent checks per instance', data.limits.concurrentGlobal],
          ['Client map cap', data.limits.ipMapCap]]),
        h('p', { class: 'field__hint', text: data.limits.rateScope }),
        h('p', { class: 'field__hint', text: data.limits.clientIdentity })),
    ],
  });
  const form = h('form', { class: 'stack' },
    field({ label: 'Website URL', control: url, hint: 'HTTP port 80 or HTTPS port 443 only. No credentials, local addresses or custom request headers. Avoid URLs containing private tokens.' }),
    showHeaders ? null : field({ label: 'Sequential attempts', control: attempts, hint: 'At most three attempts share one 8-second deadline. This is a snapshot, not continuous monitoring.' }),
    h('div', null, submitButton));
  const submit = (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    lastRequest = { action, url: url.value.trim(), ...(showHeaders ? {} : { attempts: Number(attempts.value) }) };
    view.run();
  };
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack', style: 'min-width:0' },
    panel(showHeaders ? 'Inspect HTTP headers' : 'Inspect URL status', form,
      h('p', { class: 'field__hint', text: 'Up to four redirects are checked and resolved again. Only public destinations are contacted. Header presence is not a security grade; HEAD status does not prove the page works in a browser.' })),
    panel('Results', view.el));
  workspace.append(root);
  return () => { destroyed = true; form.removeEventListener('submit', submit); view.destroy(); root.remove(); };
}

export function headersTool(workspace) {
  return inspectionTool(workspace, 'header');
}
