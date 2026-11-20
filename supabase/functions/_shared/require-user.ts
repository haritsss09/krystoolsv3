type Env = Record<string, string | undefined>;

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/* Confirms the bearer token is a live Supabase user session; publishable/anon keys are rejected. */
export async function requireUser(req: Request, env: Env): Promise<{ id: string } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!JWT_RE.test(token)) return null;
  const base = env.SUPABASE_URL;
  const apikey = env.SUPABASE_ANON_KEY || req.headers.get('apikey') || '';
  if (!base || !apikey) return null;
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === 'string' ? { id: user.id } : null;
  } catch {
    return null;
  }
}
