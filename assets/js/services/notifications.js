import * as store from '../core/storage.js';
import { latestQuake } from '../api/bmkg.js';
import { toast, h, button } from '../core/dom.js';

const ROUTES = { bmkg: '#/tool/earthquake', timer: '#/tool/pomodoro', countdown: '#/tool/stopwatch' };
const WORKER_TIMEOUT = 5000;

function failure(message) {
  toast(message);
  return { ok: false, error: message };
}

function bounded(promise) {
  let timeout;
  return Promise.race([promise, new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Notification worker timed out.')), WORKER_TIMEOUT);
  })]).finally(() => clearTimeout(timeout));
}

function waitForActivation(registration) {
  if (registration.active?.state === 'activated') return Promise.resolve(registration);
  return new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) { reject(new Error('Notification worker is unavailable.')); return; }
    const timeout = setTimeout(() => finish(new Error('Notification worker activation timed out.')), WORKER_TIMEOUT);
    function finish(error) {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', changed);
      error ? reject(error) : resolve(registration);
    }
    function changed() {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('Notification worker failed to activate.'));
    }
    worker.addEventListener('statechange', changed);
    changed();
  });
}

export async function requestPermission() {
  if (!supported()) return 'unsupported';
  try {
    return permission() === 'default' ? await Notification.requestPermission() : permission();
  } catch (error) {
    failure(`Could not request notification permission: ${error.message}`);
    return 'error';
  }
}

export async function sendNotification(title, { body, tag, requireInteraction = false, kind = 'timer' } = {}) {
  const p = permission();
  if (p !== 'granted') return failure(p === 'unsupported'
    ? 'This browser does not support notifications.'
    : p === 'denied' ? 'Notifications are blocked. Allow this site in browser settings.'
      : 'Allow notifications in Settings first.');
  const session = sessions.get(tag);
  const stale = () => session && sessions.get(tag) !== session;
  const route = ROUTES[kind] || ROUTES.timer;
  const options = { body, tag, requireInteraction, data: { kind: Object.hasOwn(ROUTES, kind) ? kind : 'timer' } };
  if (ALERT_TAGS.has(tag)) options.actions = [{ action: 'confirm', title: 'Confirm' }];
  let workerError;
  if ('serviceWorker' in navigator) {
    try {
      const registration = await bounded(navigator.serviceWorker.register('/notification-worker.js'));
      await waitForActivation(registration);
      if (stale()) return { ok: true, error: null };
      if (session) session.registration = registration;
      await bounded(registration.showNotification(title, options));
      if (stale() && !sessions.has(tag)) {
        const delivered = await registration.getNotifications?.({ tag });
        delivered?.forEach(notification => notification.close());
      }
      return { ok: true, error: null };
    } catch (error) {
      workerError = error;
      toast(`Persistent notification failed: ${error.message}. Trying browser fallback.`);
    }
  }
  try {
    if (stale()) return { ok: true, error: null };
    const { actions, ...fallbackOptions } = options;
    const notification = new Notification(title, fallbackOptions);
    if (session) session.notification = notification;
    notification.onclick = () => { confirmAlert(tag); window.focus(); window.location.hash = route; notification.close(); };
    notification.onerror = () => { failure('The browser could not deliver the notification. Check site and OS notification settings.'); };
    return { ok: true, error: null };
  } catch (error) {
    return failure(`Notification failed: ${error.message}${workerError ? ` (worker: ${workerError.message})` : ''}. Check browser and OS notification settings.`);
  }
}

export async function testNotification(kind) {
  const p = await requestPermission();
  if (p === 'error') return { ok: false, error: 'Could not request notification permission.' };
  return sendNotification('KrysTools notification test', {
    body: 'This is only a test, not an earthquake update or a completed timer.',
    tag: `kt-test-${kind}`, kind,
  });
}

const POLL_MS = 5 * 60000;
let timer = null;
let audio = null;

export const timerSound = () => store.get('timerSound', 'calm');
export const timerSoundOn = () => store.get('timerSoundOn', false);
export const setTimerSound = value => store.set('timerSound', value);
export const setTimerSoundOn = value => store.set('timerSoundOn', value);

export async function unlockSound() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('This browser does not support alert sounds.');
  audio ||= new Audio();
  await audio.resume();
  if (audio.state !== 'running') throw new Error('Sound is blocked. Enable sound again in Settings.');
}

function toneNotes(kind) {
  return kind === 'alarm'
    ? Array.from({ length: 8 }, (_, i) => [i * 0.35, i % 2 ? 650 : 950, 0.28])
    : kind === 'noisy'
      ? Array.from({ length: 10 }, (_, i) => [i * 0.2, i % 2 ? 1200 : 850, 0.13])
      : [[0, 523.25, 0.8], [0.3, 659.25, 0.8], [0.6, 783.99, 1]];
}

export function playSound(kind = timerSound(), nodes = new Set()) {
  if (!audio || audio.state !== 'running') return false;
  for (const [offset, frequency, duration] of toneNotes(kind)) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + offset;
    oscillator.type = kind === 'calm' ? 'sine' : 'square';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(kind === 'calm' ? 0.08 : 0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    const node = { oscillator, gain };
    nodes.add(node);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.delete(node); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  return true;
}

const ALERT_TAGS = new Set(['kt-timer', 'kt-quake']);
const sessions = new Map();
let alertHost;

export function confirmAlert(tag) {
  if (!ALERT_TAGS.has(tag)) return;
  const session = sessions.get(tag);
  if (!session) return;
  sessions.delete(tag);
  clearInterval(session.interval);
  for (const { oscillator, gain } of session.nodes) {
    try { oscillator.stop(); } catch {}
    oscillator.disconnect();
    gain.disconnect();
  }
  session.nodes.clear();
  session.panel.remove();
  session.notification?.close();
  session.registration?.getNotifications?.({ tag }).then(notifications => {
    if (!sessions.has(tag)) notifications.forEach(notification => notification.close());
  }).catch(() => {});
  if (!sessions.size) { alertHost?.remove(); alertHost = null; }
}

function startAlert(tag, title, body, soundKind) {
  confirmAlert(tag);
  alertHost ||= h('div', { class: 'alert-confirmations', 'aria-label': 'Alerts awaiting confirmation' });
  if (!alertHost.isConnected) document.body.append(alertHost);
  const soundStatus = h('p', { role: 'status', class: 'alert-confirmation__status' });
  const titleId = `${tag}-title`;
  const panel = h('section', { class: 'panel alert-confirmation', 'aria-labelledby': titleId },
    h('div', { role: 'alert' }, h('h2', { class: 'panel__title', id: titleId, text: title }), h('p', { text: body })),
    soundStatus, button('Confirm', { variant: 'primary', onclick: () => confirmAlert(tag) }));
  const session = { panel, nodes: new Set(), interval: null };
  sessions.set(tag, session);
  alertHost.append(panel);
  if (!soundKind) { soundStatus.textContent = 'Sound is off. Confirm to dismiss this alert.'; return; }
  const repeat = () => {
    if (sessions.get(tag) !== session) return;
    try {
      soundStatus.textContent = playSound(soundKind, session.nodes)
        ? 'Sound repeats until you confirm.' : 'Sound is blocked or unavailable. Interact with the website to enable it, or confirm this alert.';
    } catch {
      soundStatus.textContent = 'Sound is unavailable. Confirm to dismiss this alert.';
    }
  };
  repeat();
  const duration = Math.max(...toneNotes(soundKind).map(([offset, , length]) => offset + length + 0.02));
  session.interval = setInterval(repeat, Math.ceil(duration * 1000));
}

navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data?.type === 'kt-alert-confirm' && ALERT_TAGS.has(event.data.tag)) confirmAlert(event.data.tag);
});

window.addEventListener('pointerdown', () => {
  if (timerSoundOn() || quakeAlertsOn() || sessions.size) unlockSound().catch(() => {});
});

export const supported = () => 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');
export const quakeAlertsOn = () => store.get('quakeAlerts', false) && permission() === 'granted';

async function check() {
  const res = await latestQuake({ force: true });
  if (!res.ok) return;
  const q = res.data;
  const seen = store.get('quakeSeen', null);
  store.set('quakeSeen', q.id);
  if (seen && seen !== q.id && quakeAlertsOn()) {
    const title = `M${q.magnitude.toFixed(1)} earthquake, BMKG`;
    const body = `${q.region}\n${q.dateLabel}, depth ${q.depth}`;
    startAlert('kt-quake', title, body, 'alarm');
    await sendNotification(title, { body, tag: 'kt-quake', kind: 'bmkg', requireInteraction: true });
  }
}

function startPolling() {
  stopPolling();
  const poll = () => check().catch(error => failure(`BMKG alert check failed: ${error.message}`));
  poll();
  timer = setInterval(poll, POLL_MS);
}

function stopPolling() {
  clearInterval(timer);
  timer = null;
}

export async function enableQuakeAlerts() {
  if (!supported()) return 'unsupported';
  const p = await requestPermission();
  if (p !== 'granted') {
    store.set('quakeAlerts', false);
    return p;
  }
  store.set('quakeAlerts', true);
  startPolling();
  return 'granted';
}

export function disableQuakeAlerts() {
  store.set('quakeAlerts', false);
  stopPolling();
}

export const timerAlertsOn = () => store.get('timerAlerts', false) && permission() === 'granted';

export async function enableTimerAlerts() {
  if (!supported()) return 'unsupported';
  const p = await requestPermission();
  store.set('timerAlerts', p === 'granted');
  return p;
}

export function disableTimerAlerts() {
  store.set('timerAlerts', false);
}

export async function notifyTimer(title, body, kind = 'timer') {
  startAlert('kt-timer', title, body, timerSoundOn() ? timerSound() : null);
  if (!store.get('timerAlerts', false)) return { ok: true, error: null };
  return sendNotification(title, { body, tag: 'kt-timer', requireInteraction: true, kind });
}

export function resume() {
  if (quakeAlertsOn()) startPolling();
}
