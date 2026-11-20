import { h, field, input, segmented, status, toast } from '../core/dom.js';
import { pageHead } from '../core/ui.js';
import * as auth from '../services/auth.js';
import * as sync from '../services/sync.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function googleMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'auth__google');
  svg.innerHTML = '<path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>';
  return svg;
}

function passwordInput(autocomplete) {
  return input({ type: 'password', autocomplete, minlength: String(MIN_PASSWORD), required: true, spellcheck: 'false' });
}

function signedOutView(initialMode) {
  let mode = initialMode;
  const box = h('div', { class: 'auth__body' });
  const out = h('div', { 'aria-live': 'polite' });

  const redirectError = auth.takeRedirectError();
  if (redirectError) out.replaceChildren(status('err', redirectError));

  const tabs = segmented([['signin', 'Sign in'], ['signup', 'Create account']], mode === 'signup' ? 'signup' : 'signin', (v) => { mode = v; out.replaceChildren(); render(true); }, 'Account action');

  const busy = (btn, on, label) => {
    btn.disabled = on;
    btn.textContent = on ? label : btn.dataset.label;
  };

  function credentialsForm() {
    const isSignup = mode === 'signup';
    const email = input({ type: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'you@example.com' });
    const pass = passwordInput(isSignup ? 'new-password' : 'current-password');
    const submit = h('button', { class: 'btn btn--primary auth__submit', type: 'submit', text: isSignup ? 'Create account' : 'Sign in', dataset: { label: isSignup ? 'Create account' : 'Sign in' } });
    const form = h('form', { class: 'stack', novalidate: true },
      field({ label: 'Email', control: email }),
      field({ label: 'Password', control: pass, hint: isSignup ? `At least ${MIN_PASSWORD} characters.` : null }),
      submit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = email.value.trim();
      const pw = pass.value;
      const markInvalid = (el, bad) => (bad ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'));
      markInvalid(email, !EMAIL_RE.test(em));
      markInvalid(pass, pw.length < MIN_PASSWORD);
      if (!EMAIL_RE.test(em)) { out.replaceChildren(status('err', 'Enter a valid email address.')); email.focus(); return; }
      if (pw.length < MIN_PASSWORD) { out.replaceChildren(status('err', `Use a password of at least ${MIN_PASSWORD} characters.`)); pass.focus(); return; }
      busy(submit, true, isSignup ? 'Creating account' : 'Signing in');
      const r = isSignup ? await auth.signUp(em, pw) : await auth.signIn(em, pw);
      busy(submit, false);
      if (!r.ok) { out.replaceChildren(status('err', r.error)); return; }
      if (isSignup && r.needsConfirmation) {
        pass.value = '';
        out.replaceChildren(status('ok', `Check ${em} for a confirmation link, then come back here to sign in.`));
      }
    });

    const forgot = isSignup ? null : h('button', { class: 'auth__link', type: 'button', text: 'Forgot password?', onclick: () => { mode = 'reset'; out.replaceChildren(); render(true); } });
    return [form, forgot];
  }

  function resetForm() {
    const email = input({ type: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'you@example.com' });
    const submit = h('button', { class: 'btn btn--primary auth__submit', type: 'submit', text: 'Send reset link', dataset: { label: 'Send reset link' } });
    const form = h('form', { class: 'stack', novalidate: true },
      h('p', { class: 'field__hint', text: 'We will email you a link to choose a new password. Open it in this browser.' }),
      field({ label: 'Email', control: email }),
      submit);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = email.value.trim();
      if (!EMAIL_RE.test(em)) { email.setAttribute('aria-invalid', 'true'); out.replaceChildren(status('err', 'Enter a valid email address.')); return; }
      email.removeAttribute('aria-invalid');
      busy(submit, true, 'Sending');
      const r = await auth.requestPasswordReset(em);
      busy(submit, false);
      out.replaceChildren(r.ok ? status('ok', `If an account exists for ${em}, a reset link is on its way.`) : status('err', r.error));
    });
    const back = h('button', { class: 'auth__link', type: 'button', text: 'Back to sign in', onclick: () => { mode = 'signin'; out.replaceChildren(); render(true); } });
    return [form, back];
  }

  function render(focus = false) {
    const google = h('button', { class: 'btn auth__oauth', type: 'button', dataset: { label: 'Continue with Google' } }, googleMark(), h('span', { text: 'Continue with Google' }));
    google.addEventListener('click', async () => {
      google.disabled = true;
      const r = await auth.signInWithGoogle();
      if (!r.ok) { google.disabled = false; out.replaceChildren(status('err', r.error)); }
    });
    const parts = mode === 'reset' ? resetForm() : credentialsForm();
    box.replaceChildren(...[
      mode === 'reset' ? h('h2', { class: 'auth__title', text: 'Reset your password' }) : tabs,
      ...parts,
      mode === 'reset' ? null : h('div', { class: 'auth__divider' }, h('span', { text: 'or' })),
      mode === 'reset' ? null : google,
      out].filter(part => part != null));
    if (focus) box.querySelector('input')?.focus();
  }

  render();
  return box;
}

function recoveryView(onDone) {
  const pass = passwordInput('new-password');
  const confirmIn = passwordInput('new-password');
  const out = h('div', { 'aria-live': 'polite' });
  const submit = h('button', { class: 'btn btn--primary auth__submit', type: 'submit', text: 'Save new password' });
  const form = h('form', { class: 'stack', novalidate: true },
    h('h2', { class: 'auth__title', text: 'Choose a new password' }),
    field({ label: 'New password', control: pass, hint: `At least ${MIN_PASSWORD} characters.` }),
    field({ label: 'Confirm new password', control: confirmIn }),
    submit, out);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pass.value.length < MIN_PASSWORD) { out.replaceChildren(status('err', `Use at least ${MIN_PASSWORD} characters.`)); return; }
    if (pass.value !== confirmIn.value) { out.replaceChildren(status('err', 'The two passwords do not match.')); return; }
    submit.disabled = true;
    const r = await auth.updatePassword(pass.value);
    submit.disabled = false;
    if (!r.ok) { out.replaceChildren(status('err', r.error)); return; }
    toast('Password updated');
    onDone();
  });
  return h('div', { class: 'auth__body' }, form);
}

function syncLine(s) {
  if (s.status === 'syncing') return status('info', 'Syncing.');
  if (s.status === 'error') return status('err', s.error || 'Sync failed.');
  if (s.status === 'synced') return status('ok', `Synced at ${new Date(s.at).toLocaleTimeString()}.`);
  return status('info', 'Waiting to sync.');
}

function signedInView(user) {
  const provider = user.app_metadata?.provider === 'google' ? 'Google' : 'Email and password';
  const syncEl = h('div', { 'aria-live': 'polite' }, syncLine(sync.status()));
  const unsub = sync.onStatus((s) => syncEl.replaceChildren(syncLine(s)));

  const syncNow = h('button', { class: 'btn', type: 'button', text: 'Sync now', onclick: () => sync.pullAndMerge() });
  const signOut = h('button', { class: 'btn btn--primary', type: 'button', text: 'Sign out' });
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    await auth.signOut();
    toast('Signed out. Your pins stay on this device.');
  });
  const wipe = h('button', { class: 'btn btn--ghost', type: 'button', text: 'Delete synced data' });
  wipe.addEventListener('click', async () => {
    if (!confirm('Delete the pins and recent tools stored in your account? This device keeps its copy.')) return;
    wipe.disabled = true;
    const r = await sync.deleteRemote();
    wipe.disabled = false;
    syncEl.replaceChildren(r.ok ? status('ok', 'Synced data deleted from your account.') : status('err', r.error));
  });

  const body = h('div', { class: 'auth__body' },
    h('div', { class: 'auth__who' },
      h('span', { class: 'auth__avatar', 'aria-hidden': 'true', text: (user.email || '?').slice(0, 1).toUpperCase() }),
      h('div', { class: 'auth__who-text' },
        h('strong', { text: user.email || 'Signed in' }),
        h('span', { class: 'field__hint', text: provider }))),
    syncEl,
    h('div', { class: 'row' }, syncNow, signOut, wipe));
  return { el: body, cleanup: unsub };
}

export function accountPage(view, { query }) {
  document.title = 'Account · KrysTools';
  view.append(pageHead('Account', 'Sign in to keep your pinned tools and recent tools the same on every device.'));

  const card = h('section', { class: 'panel auth' });
  const aside = h('aside', { class: 'auth__aside' },
    h('h2', { text: 'What syncs' }),
    h('ul', { class: 'auth__list' },
      h('li', { text: 'Pinned tools' }),
      h('li', { text: 'Recently opened tools' })),
    h('h2', { text: 'What stays on this device' }),
    h('p', { class: 'field__hint', text: 'Notes, drafts, usage counts, cached API data and server settings. Every tool works without an account.' }));
  view.append(h('div', { class: 'auth-layout' }, card, aside));

  if (!auth.enabled) {
    card.append(status('err', 'Sign-in is not configured for this site.'));
    return;
  }

  let recovery = auth.isRecoveryRequired();
  let inner = null;
  let drawnFor;
  const draw = (event) => {
    if (event === 'USER_UPDATED' && recovery) return;
    recovery = auth.isRecoveryRequired();
    const u = auth.currentUser();
    const key = !auth.isReady() ? 'pending' : `${u ? u.id : 'none'}:${recovery}`;
    if (key === drawnFor) return;
    drawnFor = key;
    if (inner?.cleanup) inner.cleanup();
    if (!auth.isReady()) inner = { el: h('div', { class: 'loading' }, h('span', { class: 'loading__bar' }), h('span', { text: 'Checking your session' })) };
    else if (u && recovery) inner = { el: recoveryView(() => { recovery = false; history.replaceState(null, '', '#/account'); draw(); }) };
    else if (u) inner = signedInView(u);
    else inner = { el: signedOutView(query.get('mode') === 'signup' ? 'signup' : 'signin') };
    const redirectError = u && auth.isReady() ? auth.takeRedirectError() : null;
    card.replaceChildren(...[redirectError ? status('err', redirectError) : null, inner.el].filter(part => part != null));
  };
  draw();
  const unsub = auth.onChange((event) => draw(event));
  return () => { unsub(); if (inner?.cleanup) inner.cleanup(); };
}
