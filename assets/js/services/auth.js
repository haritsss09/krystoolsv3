import config from '../config.js';

const SDK_SRC = 'assets/vendor/supabase-2.119.0.js';
const STORAGE_KEY = 'kt:auth';
const RETURN_KEY = 'kt:auth:return';
const RECOVERY_KEY = 'kt:auth:recovery';
let recoveryRequired = false;
try { recoveryRequired = sessionStorage.getItem(RECOVERY_KEY) === '1'; } catch {}

function requireRecovery() {
  recoveryRequired = true;
  try { sessionStorage.setItem(RECOVERY_KEY, '1'); } catch {}
}

export function isRecoveryRequired() {
  return recoveryRequired && Boolean(user);
}

function redirectError(message) {
  try { sessionStorage.setItem('kt:auth:error', message); } catch {}
  location.hash = '#/account';
}

let clientPromise = null;
let user = null;
let ready = false;
const listeners = new Set();

export const enabled = Boolean(config.supabaseUrl && config.anonKey);

function loadSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the sign-in library.'));
    document.head.append(s);
  });
}

function emit(event) {
  for (const fn of listeners) {
    try { fn(event, user); } catch (e) { console.error(e); }
  }
}

function client() {
  if (!enabled) return Promise.reject(new Error('Sign-in is not configured for this site.'));
  if (!clientPromise) {
    clientPromise = loadSdk().then(() => {
      const c = window.supabase.createClient(config.supabaseUrl, config.anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORAGE_KEY },
      });
      c.auth.onAuthStateChange((event, session) => {
        user = session?.user || null;
        ready = true;
        if (event === 'PASSWORD_RECOVERY' && user) requireRecovery();
        // Supabase callbacks must not await other auth calls inline; defer listeners.
        setTimeout(() => emit(event), 0);
      });
      return c;
    });
    clientPromise.catch(() => { clientPromise = null; });
  }
  return clientPromise;
}

function cleanAuthParams() {
  const url = new URL(location.href);
  let changed = false;
  for (const p of ['code', 'error', 'error_code', 'error_description', 'state', 'auth']) {
    if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
  }
  if (changed) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/* The 220 KB SDK only loads for people who have signed in or are returning from a sign-in link. */
export async function init() {
  if (!enabled) return;
  const params = new URLSearchParams(location.search);
  const returning = params.has('code') || params.has('error') || params.has('error_description');
  const resetCallback = params.get('auth') === 'recovery' && params.has('code');
  let hasSession = false;
  try { hasSession = Boolean(localStorage.getItem(STORAGE_KEY)); } catch {}
  if (!returning && !hasSession) { ready = true; emit('READY'); return; }
  try {
    const c = await client();
    const { data, error } = await c.auth.getSession();
    user = data.session?.user || null;
    ready = true;
    if (returning) {
      const failure = params.get('error_description') || params.get('error') || (error && friendly(error)) || (!user && 'This sign-in or password reset link is invalid or expired. Request a new link.');
      cleanAuthParams();
      let back;
      try {
        back = sessionStorage.getItem(RETURN_KEY);
        sessionStorage.removeItem(RETURN_KEY);
      } catch {}
      if (failure) redirectError(failure);
      else if (resetCallback) { requireRecovery(); location.hash = '#/account?recovery=1'; }
      else if (back && back.startsWith('#/') && back !== '#/account?recovery=1') location.hash = back;
    }
    emit('READY');
  } catch (e) {
    ready = true;
    cleanAuthParams();
    if (returning) redirectError(`Could not open this sign-in or password reset link. ${friendly(e)} Request a new link if it has expired.`);
    emit('READY');
  }
}

export function currentUser() {
  return user;
}

export function isReady() {
  return ready;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function supabaseClient() {
  return client();
}

export async function accessToken() {
  if (!user) return null;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

function redirectUrl() {
  return location.origin + location.pathname;
}

function rememberReturn(hash) {
  try { sessionStorage.setItem(RETURN_KEY, hash); } catch {}
}

function friendly(error) {
  const msg = error?.message || String(error || 'Something went wrong.');
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/password should be|weak password/i.test(msg)) return msg;
  if (/failed to fetch|network/i.test(msg)) return 'Could not reach the sign-in server. Check your connection.';
  if (/provider is not enabled|unsupported provider/i.test(msg)) return 'Google sign-in is not enabled for this site yet.';
  if (/code verifier|both auth code and code verifier/i.test(msg)) return 'Open the link in the same browser you requested it from.';
  return msg;
}

async function run(fn) {
  try {
    const c = await client();
    const { data, error } = await fn(c);
    if (error) return { ok: false, error: friendly(error) };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export function signIn(email, password) {
  return run((c) => c.auth.signInWithPassword({ email, password }));
}

export async function signUp(email, password) {
  rememberReturn('#/account');
  const r = await run((c) => c.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } }));
  if (r.ok) r.needsConfirmation = !r.data.session;
  return r;
}

export function signInWithGoogle() {
  rememberReturn(location.hash && location.hash !== '#/account' ? location.hash : '#/account');
  return run((c) => c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } }));
}

export function requestPasswordReset(email) {
  rememberReturn('#/account?recovery=1');
  return run((c) => c.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() + '?auth=recovery' }));
}

export async function updatePassword(password) {
  const r = await run((c) => c.auth.updateUser({ password }));
  if (r.ok) {
    recoveryRequired = false;
    try { sessionStorage.removeItem(RECOVERY_KEY); } catch {}
    emit('PASSWORD_UPDATED');
  }
  return r;
}

export async function signOut() {
  const r = await run((c) => c.auth.signOut({ scope: 'local' }));
  user = null;
  emit('SIGNED_OUT');
  return r;
}

export function takeRedirectError() {
  const e = sessionStorage.getItem('kt:auth:error');
  sessionStorage.removeItem('kt:auth:error');
  return e;
}
