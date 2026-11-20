export class InspectError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'InspectError';
    this.code = code;
  }
}

export const NETWORK_LIMITS = Object.freeze({ deadlineMs: 8000, headerBytes: 65536, redirects: 4, attempts: 3 });
const fail = (code: string, message: string): never => { throw new InspectError(code, message); };

// Strict literals only. URL normalization is checked separately to reject octal/hex IPv4.
export function parseIp(value: string): { version: number; value: bigint; canonical: string } | null {
  if (typeof value !== 'string' || !value || value.includes('%')) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    const parts = value.split('.');
    if (parts.some((p) => Number(p) > 255 || String(Number(p)) !== p)) return null;
    return { version: 4, value: parts.reduce((n, p) => (n << 8n) | BigInt(p), 0n), canonical: value };
  }
  if (!value.includes(':') || !/^[\da-f:]+$/i.test(value)) return null;
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if ([...left, ...right].some((p) => !/^[\da-f]{1,4}$/i.test(p))) return null;
  const count = left.length + right.length;
  if (halves.length === 1 ? count !== 8 : count >= 8) return null;
  const parts = [...left, ...Array(8 - count).fill('0'), ...right];
  return { version: 6, value: parts.reduce((n, p) => (n << 16n) | BigInt('0x' + p), 0n), canonical: parts.map((p) => parseInt(p, 16).toString(16)).join(':') };
}

const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const;
const V6_BLOCKS = [
  ['2001::', 23], // IETF assignments, including Teredo, benchmarking, ORCHID and translation.
  ['2001:db8::', 32], ['2002::', 16], ['2620:4f:8000::', 48], ['3ffe::', 16], ['3fff::', 20],
] as const;
const inPrefix = (value: bigint, base: bigint, bits: number, size: number) =>
  value >> BigInt(size - bits) === base >> BigInt(size - bits);

export function isPublicIp(address: string): boolean {
  const ip = parseIp(address);
  if (!ip) return false;
  if (ip.version === 4) return !V4_BLOCKS.some(([base, bits]) => inPrefix(ip.value, parseIp(base)!.value, bits, 32));
  // Fail closed outside global unicast; excludes mapped/compatible IPv4, NAT64, ULA and multicast.
  if (ip.value >> 125n !== 1n || V6_BLOCKS.some(([base, bits]) => inPrefix(ip.value, parseIp(base)!.value, bits, 128))) return false;
  const interfacePrefix = Number((ip.value >> 32n) & 0xffffffffn);
  return interfacePrefix !== 0x00005efe && interfacePrefix !== 0x02005efe; // ISATAP
}

export function validateTarget(value: string): URL {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f-\uffff\\]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) {
    return fail('invalid_url', 'Use an ASCII HTTP or HTTPS URL without control characters (maximum 2048 characters).');
  }
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || authority.includes('@') || authority.includes('%')) return fail('invalid_url', 'URL credentials and encoded hostnames are not allowed.');
  let url: URL;
  try { url = new URL(value); } catch { return fail('invalid_url', 'Enter a valid HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    return fail('invalid_url', 'Only HTTP port 80 and HTTPS port 443 are allowed, without credentials.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const ip = parseIp(host);
  if (ip) {
    const rawHost = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0];
    if (ip.version === 4 && rawHost !== host) return fail('invalid_url', 'Use canonical dotted-decimal IPv4 addresses.');
    if (!isPublicIp(host)) return fail('blocked_address', 'Only public, non-special network addresses are allowed.');
  } else {
    if (host.length > 253 || !host.includes('.') || host.endsWith('.') || host.split('.').some((p) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(p)) || /^\d+$/.test(host.split('.').at(-1)!)) {
      return fail('invalid_url', 'Enter a public fully qualified hostname or a public IP address.');
    }
    if (/(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion|arpa)$/.test(host)) return fail('blocked_address', 'Local and special-use hostnames are not allowed.');
  }
  url.hash = '';
  return url;
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.reject(new InspectError('timeout', 'The check was cancelled or exceeded its total 8-second deadline.'));
  }
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(new InspectError('timeout', 'The check was cancelled or exceeded its total 8-second deadline.')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

export async function readBounded(body: ReadableStream<Uint8Array> | null, max: number, signal: AbortSignal): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    for (;;) {
      const { value, done } = await abortable(reader.read(), signal);
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > max) return fail('payload_too_large', 'The payload exceeds the allowed size.');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    // Do not wait for a hostile stream's cancellation acknowledgement.
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function resolvePublicAddresses(url: URL, signal: AbortSignal): Promise<string[]> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const literal = parseIp(host);
  if (literal) {
    if (!isPublicIp(host)) return fail('blocked_address', 'The destination address is not public.');
    return [literal.canonical];
  }
  const results = await Promise.all([1, 28].map(async (type) => {
    const response = await abortable(fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`, {
      signal, redirect: 'error', headers: { Accept: 'application/dns-json' },
    }), signal);
    if (!response.ok) { response.body?.cancel().catch(() => {}); return fail('dns_failed', 'Public DNS resolution failed.'); }
    let data;
    try { data = JSON.parse(await readBounded(response.body, 65536, signal)); }
    catch (error) { if (error instanceof InspectError) throw error; return fail('dns_failed', 'Public DNS returned an invalid response.'); }
    if (data.Status !== 0 || data.TC === true || (data.Answer !== undefined && !Array.isArray(data.Answer))) return fail('dns_failed', 'Public DNS could not resolve this hostname completely.');
    const answers = data.Answer || [];
    if (answers.length > 64) return fail('dns_failed', 'Public DNS returned too many records.');
    const addresses: string[] = [];
    for (const record of answers) {
      if (record.type !== 1 && record.type !== 28) continue;
      const ip = parseIp(record.data);
      if (!ip || ip.version !== (record.type === 1 ? 4 : 6) || !isPublicIp(record.data)) return fail('blocked_address', 'DNS returned a non-public or special-use address.');
      addresses.push(ip.canonical);
    }
    return addresses;
  }));
  const addresses = [...new Set(results.flat())];
  if (!addresses.length || addresses.length > 32) return fail('dns_failed', 'No usable public address was returned.');
  return addresses;
}

type Head = { status: number; headers: Record<string, string[]> };

// The parser counts every byte including informational responses, and never consumes a body.
export function headParser() {
  let pending = '', bytes = 0;
  return (chunk: Uint8Array): Head | null => {
    for (const byte of chunk) {
      if (++bytes > NETWORK_LIMITS.headerBytes) return fail('headers_too_large', 'Response headers exceed 64 KiB.');
      if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) return fail('invalid_response', 'The server returned malformed HTTP headers.');
      pending += String.fromCharCode(byte);
      if (!pending.endsWith('\r\n\r\n')) continue;
      const lines = pending.slice(0, -4).split('\r\n');
      const match = lines.shift()!.match(/^HTTP\/1\.[01] ([1-5]\d{2})(?: [\x20-\x7e\x80-\xff]*)?$/);
      if (!match) return fail('invalid_response', 'The server did not return a valid HTTP/1.x response.');
      const status = Number(match[1]);
      const headers: Record<string, string[]> = Object.create(null);
      for (const line of lines) {
        const field = line.match(/^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*([^\r\n]*)$/);
        if (!field) return fail('invalid_response', 'The server returned malformed HTTP headers.');
        const name = field[1].toLowerCase();
        (headers[name] ||= []).push(field[2].trim());
      }
      if (status === 101) return fail('invalid_response', 'Protocol upgrades are not supported.');
      if (status < 200) { pending = ''; continue; }
      return { status, headers };
    }
    return null;
  };
}

async function pinnedHead(url: URL, address: string, signal: AbortSignal): Promise<Head> {
  if (!isPublicIp(address)) return fail('blocked_address', 'The destination address is not public.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const port = url.protocol === 'https:' ? 443 : 80;
  const request = new TextEncoder().encode(`HEAD ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nConnection: close\r\n\r\n`);
  const parse = headParser();
  const deno = (globalThis as any).Deno;
  if (deno) {
    if (typeof deno.connect !== 'function' || typeof deno.startTls !== 'function') return fail('transport_unavailable', 'Pinned socket transport is unavailable in this runtime.');
    let socket: any;
    const close = () => { try { socket?.close(); } catch {} };
    const adopt = (conn: any) => { if (signal.aborted) { try { conn.close(); } catch {} throw new InspectError('timeout', 'The check exceeded its deadline.'); } socket = conn; return conn; };
    signal.addEventListener('abort', close, { once: true });
    try {
      await abortable(deno.connect({ hostname: address, port, transport: 'tcp' }).then(adopt), signal);
      if (port === 443) {
        await abortable(deno.startTls(socket, { hostname, alpnProtocols: ['http/1.1'] }).then(adopt), signal);
        if (typeof socket.handshake === 'function') await abortable(socket.handshake(), signal);
      }
      let sent = 0;
      while (sent < request.length) {
        const n = await abortable<number>(socket.write(request.subarray(sent)), signal);
        if (!n) return fail('network_failed', 'The server connection closed while sending the request.');
        sent += n;
      }
      const buffer = new Uint8Array(4096);
      for (;;) {
        const n = await abortable<number | null>(socket.read(buffer), signal);
        if (n === null) return fail('invalid_response', 'The connection closed before complete headers arrived.');
        const result = parse(buffer.subarray(0, n));
        if (result) return result;
      }
    } finally { signal.removeEventListener('abort', close); close(); }
  }
  let net: any, tls: any;
  try { net = await import('node:net'); tls = await import('node:tls'); }
  catch { return fail('transport_unavailable', 'Pinned socket transport is unavailable in this runtime.'); }
  if (signal.aborted) return fail('timeout', 'The check exceeded its deadline.');
  return new Promise((resolve, reject) => {
    let raw: any, socket: any, settled = false;
    const finish = (error?: unknown, result?: Head) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      socket?.destroy();
      if (raw !== socket) raw?.destroy();
      if (error) reject(error); else resolve(result!);
    };
    const onAbort = () => finish(new InspectError('timeout', 'The check exceeded its total 8-second deadline.'));
    const onError = () => finish(new InspectError('network_failed', 'The connection or TLS certificate verification failed.'));
    const start = () => {
      socket.on('data', (chunk: Uint8Array) => {
        try { const result = parse(chunk); if (result) finish(undefined, result); }
        catch (error) { finish(error); }
      });
      socket.on('end', () => finish(new InspectError('invalid_response', 'The connection closed before complete headers arrived.')));
      socket.write(request);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      // No target hostname reaches the resolver or connect call.
      raw = socket = net.connect({ host: address, port, family: parseIp(address)!.version });
      raw.on('error', onError);
      raw.on('close', () => { if (!settled) onError(); });
      raw.once('connect', () => {
        if (settled) return;
        if (port !== 443) { start(); return; }
        try {
          socket = tls.connect({
            socket: raw, servername: parseIp(hostname) ? undefined : hostname,
            rejectUnauthorized: true, ALPNProtocols: ['http/1.1'],
            checkServerIdentity: (_name: string, cert: any) => tls.checkServerIdentity(hostname, cert),
          });
          socket.on('error', onError);
          socket.on('close', () => { if (!settled) onError(); });
          socket.once('secureConnect', start);
        } catch { onError(); }
      });
    } catch { onError(); }
  });
}

export async function inspectUrl(value: string, signal: AbortSignal) {
  let url = validateTarget(value);
  const started = performance.now();
  const hops: { url: string; status: number; durationMs: number; dnsMs: number; headMs: number }[] = [];
  for (let hop = 0; hop <= NETWORK_LIMITS.redirects; hop++) {
    const began = performance.now();
    const addresses = await resolvePublicAddresses(url, signal);
    const resolved = performance.now();
    const response = await pinnedHead(url, addresses[0], signal);
    const ended = performance.now();
    hops.push({ url: url.href, status: response.status, durationMs: Math.round(ended - began), dnsMs: Math.round(resolved - began), headMs: Math.round(ended - resolved) });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
      if (hop === NETWORK_LIMITS.redirects) return fail('redirect_limit', 'The website exceeded the four-redirect limit.');
      if (response.headers.location.length !== 1) return fail('invalid_response', 'The server returned ambiguous redirect headers.');
      const location = response.headers.location[0];
      if (!location || /[\s\u0000-\u001f\u007f-\uffff\\]/.test(location)) return fail('invalid_url', 'The redirect URL is invalid.');
      let next: string;
      try { next = new URL(location, url).href; } catch { return fail('invalid_url', 'The redirect URL is invalid.'); }
      // Reject credentials/encoded authorities before URL normalization, including empty userinfo.
      if (/^(?:https?:)?\/\//i.test(location)) validateTarget(location.startsWith('//') ? url.protocol + location : location);
      url = validateTarget(next);
      continue;
    }
    delete response.headers['set-cookie'];
    delete response.headers['set-cookie2'];
    return { url: value, finalUrl: url.href, status: response.status, headers: response.headers, hops, redirects: hops.length - 1, durationMs: Math.round(performance.now() - started) };
  }
  return fail('redirect_limit', 'The website exceeded the redirect limit.');
}
