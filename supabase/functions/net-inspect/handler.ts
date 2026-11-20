import { InspectError, NETWORK_LIMITS, inspectUrl, parseIp, readBounded, validateTarget } from '../_shared/net-transport.ts';
import { requireUser } from '../_shared/require-user.ts';
import { checkPolicy, logUsage } from '../_shared/policy.ts';

type Env = { ALLOWED_ORIGINS?: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
const LIMITS = Object.freeze({
  ...NETWORK_LIMITS, bodyBytes: 4096, methods: ['HEAD'], ports: [80, 443],
  rateWindowMs: 60000, requestsPerIp: 6, requestsGlobal: 30,
  concurrentPerIp: 1, concurrentGlobal: 4, ipMapCap: 1024,
  rateScope: 'Per process/isolate, not a distributed quota. All POST requests, including health and invalid requests, count.',
  clientIdentity: 'Rightmost X-Forwarded-For IP. Ingress must overwrite this header; missing or invalid addresses share one bucket. The global limit also applies.',
  deadlineScope: 'One total deadline for body, DNS, connection, TLS, headers, redirects and all sequential attempts.',
});
type Bucket = { count: number; reset: number; active: number };
const clients = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, reset: 0, active: 0 };

function clientKey(req: Request): string {
  const raw = (req.headers.get('x-forwarded-for') || '').split(',').at(-1)!.trim();
  const mapped = raw.match(/^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i);
  const ip = parseIp(mapped ? mapped[1] : raw);
  return ip ? `${ip.version}:${ip.canonical}` : 'unknown';
}

function acquire(req: Request): (() => void) | null {
  const now = Date.now();
  if (globalBucket.reset <= now) globalBucket = { count: 0, reset: now + LIMITS.rateWindowMs, active: globalBucket.active };
  for (const [key, bucket] of clients) if (bucket.reset <= now && !bucket.active) clients.delete(key);
  const key = clientKey(req);
  let bucket = clients.get(key);
  if (!bucket) {
    if (clients.size >= LIMITS.ipMapCap) return null;
    bucket = { count: 0, reset: now + LIMITS.rateWindowMs, active: 0 };
    clients.set(key, bucket);
  }
  if (bucket.reset <= now) { bucket.count = 0; bucket.reset = now + LIMITS.rateWindowMs; }
  if (bucket.count >= LIMITS.requestsPerIp || globalBucket.count >= LIMITS.requestsGlobal || bucket.active >= LIMITS.concurrentPerIp || globalBucket.active >= LIMITS.concurrentGlobal) return null;
  bucket.count++; bucket.active++; globalBucket.count++; globalBucket.active++;
  return () => { bucket!.active--; globalBucket.active--; };
}

function cors(req: Request, env: Env): Headers | null {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const origin = req.headers.get('origin');
  if (origin === null) return headers;
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) return null;
  const own = new URL(req.url);
  const sameOriginDev = ['localhost', '127.0.0.1', '[::1]'].includes(own.hostname) && origin === own.origin;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter((v) => v && v !== '*');
  if (!sameOriginDev && !allowed.includes(origin)) return null;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type, authorization, apikey, x-client-info');
  headers.set('Access-Control-Max-Age', '600');
  return headers;
}

const CHECKS = [
  ['strict-transport-security', 'HSTS is only effective over HTTPS; presence does not validate max-age or scope.'],
  ['content-security-policy', 'Policy strength and compatibility require reviewing the directives.'],
  ['x-frame-options', 'Framing may also be controlled by CSP frame-ancestors.'],
  ['x-content-type-options', 'Review the value; the expected option is nosniff.'],
  ['referrer-policy', 'Review whether the policy matches the site’s privacy needs.'],
  ['permissions-policy', 'Feature restrictions depend on policy values and browser support.'],
];

function headerChecks(headers: Record<string, string[]>) {
  return CHECKS.map(([name, note]) => ({ name, state: Object.hasOwn(headers, name) ? 'present' : 'missing', values: headers[name] || [], note }));
}

function safeError(error: unknown) {
  if (error instanceof InspectError) return { code: error.code, message: error.message };
  return { code: 'network_failed', message: 'The check could not complete. The website or pinned transport may be unavailable.' };
}

export async function handle(req: Request, env: Env = {}): Promise<Response> {
  const headers = cors(req, env);
  if (!headers) return Response.json({ error: { code: 'origin_denied', message: 'This origin is not allowed. The owner must configure an exact ALLOWED_ORIGINS entry.' } }, { status: 403, headers: { 'Vary': 'Origin', 'Cache-Control': 'no-store' } });
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === 'OPTIONS') {
    const method = req.headers.get('access-control-request-method');
    const requested = (req.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
    if (!req.headers.has('origin') || method !== 'POST' || requested.some((v) => !['content-type', 'authorization', 'apikey', 'x-client-info'].includes(v))) return json({ error: { code: 'invalid_preflight', message: 'This cross-origin request is not supported.' } }, 403);
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS');
    return json({ error: { code: 'method_not_allowed', message: 'Use POST with a JSON body.' } }, 405);
  }
  const user = await requireUser(req, env);
  if (!user) return json({ error: { code: 'unauthorized', message: 'Sign in to KrysTools to use server checks.' } }, 401);
  const release = acquire(req);
  if (!release) {
    headers.set('Retry-After', '60');
    return json({ error: { code: 'rate_limited', message: 'This instance’s request or concurrency limit was reached. Wait 60 seconds before retrying.' }, limits: LIMITS }, 429);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, NETWORK_LIMITS.deadlineMs);
  req.signal.addEventListener('abort', abort, { once: true });
  if (req.signal.aborted) abort();
  try {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) return json({ error: { code: 'content_type', message: 'Content-Type must be application/json.' } }, 415);
    const length = req.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMITS.bodyBytes)) return json({ error: { code: 'payload_too_large', message: 'JSON bodies are limited to 4096 bytes.' } }, 413);
    let body;
    try { body = JSON.parse(await readBounded(req.body, LIMITS.bodyBytes, controller.signal)); }
    catch (error) { if (error instanceof InspectError) throw error; return json({ error: { code: 'invalid_body', message: 'Provide a valid JSON object.' } }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !['health', 'inspect', 'header', 'status'].includes(body.action)) return json({ error: { code: 'invalid_action', message: 'Choose health, inspect, header or status.' } }, 400);
    const keys = body.action === 'health' ? ['action'] : body.action === 'status' ? ['action', 'url', 'attempts'] : ['action', 'url'];
    if (Object.keys(body).some((key) => !keys.includes(key))) return json({ error: { code: 'invalid_body', message: 'The request contains unsupported fields. Custom headers and bodies are not accepted.' } }, 400);
    if (body.action === 'health') return json({ configured: true, service: 'net-inspect', limits: LIMITS, note: 'Handler loaded. No DNS or target connection was made; transport availability is checked only on explicit inspection.' });
    const refusal = await checkPolicy(env, user.id, 'net-inspect');
    if (refusal) return json({ error: { code: 'forbidden', message: refusal } }, 403);
    const target = validateTarget(body.url).href;
    const attempts = body.action === 'status' ? body.attempts ?? 1 : 1;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > NETWORK_LIMITS.attempts) return json({ error: { code: 'invalid_attempts', message: 'Choose one, two or three sequential attempts.' } }, 400);
    const started = performance.now();
    const results = [];
    for (let i = 0; i < attempts; i++) {
      const began = performance.now();
      try {
        const result = await inspectUrl(target, controller.signal);
        results.push({ attempt: i + 1, ok: true, ...result, checks: headerChecks(result.headers) });
      } catch (error) {
        const detail = safeError(error);
        if (body.action !== 'status') throw error;
        results.push({ attempt: i + 1, ok: false, error: detail, durationMs: Math.round(performance.now() - began) });
        // Never retry blocked destinations, malformed redirects or exhausted deadlines.
        if (controller.signal.aborted || !['network_failed', 'dns_failed', 'invalid_response'].includes(detail.code)) break;
      }
    }
    await logUsage(env, user.id, 'net-inspect', results.some((r) => r.ok));
    return json({ action: body.action, method: 'HEAD', url: target, attemptsRequested: attempts, attemptsCompleted: results.length, results, durationMs: Math.round(performance.now() - started), limits: LIMITS,
      note: 'A server-side HEAD snapshot, not an uptime guarantee or security certification. HEAD may differ from GET. No response bodies are fetched; cookies are omitted. DNS uses Google Public DNS. Timings include DNS, connection, TLS and header reads.' });
  } catch (error) {
    const detail = safeError(error);
    const status = detail.code === 'timeout' ? 504 : detail.code === 'payload_too_large' ? 413 : ['invalid_url', 'blocked_address'].includes(detail.code) ? 400 : detail.code === 'transport_unavailable' ? 503 : 502;
    return json({ error: detail, limits: LIMITS }, status);
  } finally {
    clearTimeout(timer);
    controller.abort();
    req.signal.removeEventListener('abort', abort);
    release();
  }
}
