type Env = Record<string, string | undefined>;
export type Fn = 'ai' | 'net-inspect';

export function serviceKey(env: Env): string {
  return env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export async function db(env: Env, path: string, init: RequestInit = {}): Promise<unknown> {
  const key = serviceKey(env);
  if (!env.SUPABASE_URL || !key) throw new Error('Server database access is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Database request failed (HTTP ${res.status}).`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function isAdmin(env: Env, userId: string): Promise<boolean> {
  const rows = await db(env, `/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`) as unknown[];
  return rows.length > 0;
}

/* Returns a user-facing refusal, or null when the call may proceed. Fails closed. */
export async function checkPolicy(env: Env, userId: string, fn: Fn): Promise<string | null> {
  try {
    const id = encodeURIComponent(userId);
    const [settings, flags] = await Promise.all([
      db(env, '/rest/v1/app_settings?id=eq.1&select=ai_enabled,net_enabled,ai_daily_default') as Promise<Record<string, unknown>[]>,
      db(env, `/rest/v1/user_flags?user_id=eq.${id}&select=blocked,ai_daily_limit`) as Promise<Record<string, unknown>[]>,
    ]);
    const s = settings[0] || { ai_enabled: true, net_enabled: true, ai_daily_default: 50 };
    const f = flags[0] || {};
    if (f.blocked) return 'Your account has been blocked from server tools. Contact the site owner.';
    if (fn === 'ai' && !s.ai_enabled) return 'AI tools are paused by the site owner. Try again later.';
    if (fn === 'net-inspect' && !s.net_enabled) return 'Server checks are paused by the site owner. Try again later.';
    if (fn === 'ai') {
      const limit = typeof f.ai_daily_limit === 'number' ? f.ai_daily_limit : Number(s.ai_daily_default);
      const since = new Date(Date.now() - 86400000).toISOString();
      const count = await countRows(env, `/rest/v1/usage_log?user_id=eq.${id}&fn=eq.ai&created_at=gte.${encodeURIComponent(since)}&select=id`);
      if (count >= limit) return `You reached your AI limit of ${limit} requests in 24 hours. Try again later.`;
    }
    return null;
  } catch {
    return 'Server tools are temporarily unavailable. Try again later.';
  }
}

export async function countRows(env: Env, path: string): Promise<number> {
  const key = serviceKey(env);
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Database request failed (HTTP ${res.status}).`);
  const total = (res.headers.get('content-range') || '').split('/')[1];
  return Number(total) || 0;
}

export async function logUsage(env: Env, userId: string, fn: Fn, ok: boolean): Promise<void> {
  try {
    await db(env, '/rest/v1/usage_log', { method: 'POST', body: JSON.stringify({ user_id: userId, fn, ok }), headers: { Prefer: 'return=minimal' } });
  } catch { /* usage logging must not break the tool */ }
}
