import { requireUser } from '../_shared/require-user.ts';
import { db, isAdmin, serviceKey } from '../_shared/policy.ts';

type Env = Record<string, string | undefined>;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(request: Request): Promise<Row> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Content-Type must be application/json.');
  const text = await request.text();
  if (text.length > 8000) throw new Error('Request is too large.');
  const body = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Send a JSON object.');
  return body;
}

async function listUsers(env: Env) {
  const key = serviceKey(env);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Could not list users (HTTP ${res.status}).`);
  const data = await res.json();
  return (data.users || []) as Row[];
}

async function overview(env: Env) {
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const day = Date.now() - 86400000;
  const [users, flags, admins, settings, usage] = await Promise.all([
    listUsers(env),
    db(env, '/rest/v1/user_flags?select=user_id,blocked,ai_daily_limit') as Promise<Row[]>,
    db(env, '/rest/v1/admins?select=user_id') as Promise<Row[]>,
    db(env, '/rest/v1/app_settings?id=eq.1&select=ai_enabled,net_enabled,ai_daily_default,announcement') as Promise<Row[]>,
    db(env, `/rest/v1/usage_log?created_at=gte.${encodeURIComponent(since7)}&select=user_id,fn,ok,created_at&order=created_at.desc&limit=20000`) as Promise<Row[]>,
  ]);
  const flagBy = new Map(flags.map((f) => [f.user_id, f]));
  const adminIds = new Set(admins.map((a) => a.user_id));
  const per = new Map<unknown, { ai24: number; ai7: number; net7: number; failed7: number; last: string | null }>();
  const daily: Record<string, { ai: number; net: number }> = {};
  for (let i = 6; i >= 0; i--) daily[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = { ai: 0, net: 0 };
  for (const u of usage) {
    const p = per.get(u.user_id) || { ai24: 0, ai7: 0, net7: 0, failed7: 0, last: null };
    const t = Date.parse(String(u.created_at));
    if (u.fn === 'ai') { p.ai7++; if (t >= day) p.ai24++; } else p.net7++;
    if (!u.ok) p.failed7++;
    if (!p.last) p.last = String(u.created_at);
    per.set(u.user_id, p);
    const d = daily[String(u.created_at).slice(0, 10)];
    if (d) { if (u.fn === 'ai') d.ai++; else d.net++; }
  }
  return {
    settings: settings[0] || null,
    daily,
    totals: { users: users.length, ai7: usage.filter((u) => u.fn === 'ai').length, net7: usage.filter((u) => u.fn !== 'ai').length, failed7: usage.filter((u) => !u.ok).length },
    users: users.map((u) => {
      const f = flagBy.get(u.id) || {};
      return {
        id: u.id, email: u.email || null, provider: (u.app_metadata as Row | undefined)?.provider || null,
        createdAt: u.created_at, lastSignIn: u.last_sign_in_at || null, confirmed: Boolean(u.email_confirmed_at),
        admin: adminIds.has(u.id), blocked: Boolean(f.blocked), aiDailyLimit: typeof f.ai_daily_limit === 'number' ? f.ai_daily_limit : null,
        usage: per.get(u.id) || { ai24: 0, ai7: 0, net7: 0, failed7: 0, last: null },
      };
    }),
  };
}

function intOrNull(v: unknown, name: string): number | null {
  if (v === null) return null;
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 10000) throw new Error(`${name} must be a whole number from 0 to 10,000.`);
  return v as number;
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const respond = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code, headers });
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter((s) => s && s !== '*');
  if (origin && !allowed.includes(origin)) return respond({ error: 'This origin is not allowed.' }, 403);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return respond({ error: 'Use POST.' }, 405); }
  const user = await requireUser(request, env);
  if (!user) return respond({ error: 'Sign in to KrysTools first.' }, 401);
  let body: Row;
  try { body = await readJson(request); } catch (e) { return respond({ error: (e as Error).message }, 400); }
  try {
    const admin = await isAdmin(env, user.id);
    if (body.action === 'whoami') return respond({ admin });
    if (!admin) return respond({ error: 'Only site admins can do this.' }, 403);

    if (body.action === 'overview') return respond(await overview(env));

    if (body.action === 'setUser') {
      if (typeof body.userId !== 'string' || !UUID.test(body.userId)) return respond({ error: 'Choose a valid user.' }, 400);
      if (typeof body.blocked !== 'boolean') return respond({ error: 'Blocked must be true or false.' }, 400);
      if (body.userId === user.id && body.blocked) return respond({ error: 'You cannot block your own admin account.' }, 400);
      const limit = intOrNull(body.aiDailyLimit ?? null, 'The AI limit');
      await db(env, '/rest/v1/user_flags?on_conflict=user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: body.userId, blocked: body.blocked, ai_daily_limit: limit, updated_at: new Date().toISOString() }),
      });
      return respond({ ok: true });
    }

    if (body.action === 'setSettings') {
      const { aiEnabled, netEnabled, aiDailyDefault, announcement } = body;
      if (typeof aiEnabled !== 'boolean' || typeof netEnabled !== 'boolean') return respond({ error: 'Tool switches must be true or false.' }, 400);
      const def = intOrNull(aiDailyDefault, 'The default AI limit');
      if (def === null) return respond({ error: 'Set a default AI limit.' }, 400);
      if (typeof announcement !== 'string' || announcement.length > 500) return respond({ error: 'The announcement must be at most 500 characters.' }, 400);
      await db(env, '/rest/v1/app_settings?id=eq.1', {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ai_enabled: aiEnabled, net_enabled: netEnabled, ai_daily_default: def, announcement: announcement.trim(), updated_at: new Date().toISOString() }),
      });
      return respond({ ok: true });
    }
    return respond({ error: 'Unsupported admin action.' }, 400);
  } catch (e) {
    const msg = (e as Error).message;
    return respond({ error: /must be|Choose|Set a/.test(msg) ? msg : 'The admin request failed. Check that the admin migration has been applied.' }, /must be|Choose|Set a/.test(msg) ? 400 : 500);
  }
}
