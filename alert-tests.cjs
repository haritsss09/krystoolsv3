const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.value = ''; }
  append(...children) { for (const child of children) { this.children.push(child instanceof Element ? child : String(child)); if (child instanceof Element) child.parent = this; } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  get isConnected() { return !!this.parent; }
}
async function setup(worker = false) {
  const intervals = new Map(), nodes = [], notifications = [], messages = {}, data = new Map();
  let id = 0;
  class Audio {
    state = 'running'; currentTime = 0; destination = {};
    async resume() {}
    createOscillator() { const node = { frequency: {}, connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop(at) { this.stopAt = at; this.stops = (this.stops || 0) + 1; } }; nodes.push(node); return node; }
    createGain() { return { connect() {}, disconnect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
  }
  class Notification {
    static permission = 'granted';
    constructor(title, options) { Object.assign(this, { title, options }); notifications.push(this); }
    close() { this.closed = true; }
  }
  const body = new Element('body');
  const serviceWorker = { addEventListener(type, fn) { messages[type] = fn; } };
  if (worker) serviceWorker.register = async () => ({ active: { state: 'activated' }, async showNotification(title, options) { notifications.push({ title, options }); } });
  const context = vm.createContext({ console, Node: Element, document: { body, createElement: tag => new Element(tag), getElementById: () => null }, window: { AudioContext: Audio, Notification, addEventListener() {}, focus() {}, location: {} }, Notification, navigator: { serviceWorker }, localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }, setInterval(fn, ms) { intervals.set(++id, { fn, ms }); return id; }, clearInterval: id => intervals.delete(id), setTimeout, clearTimeout });
  const cache = new Map();
  async function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = file.endsWith('bmkg.js') ? 'export async function latestQuake() { return globalThis.quakeResult || {ok:false}; }' : fs.readFileSync(file, 'utf8');
    const mod = new vm.SourceTextModule(source, { context, identifier: file }); cache.set(file, mod);
    await mod.link((name, ref) => load(path.resolve(path.dirname(ref.identifier), name)));
    return mod;
  }
  const mod = await load(path.resolve(__dirname, 'assets/js/services/notifications.js')); await mod.evaluate();
  return { api: mod.namespace, load, body, intervals, nodes, notifications, messages, data, context };
}

test('loop duration, replacement, website confirmation and finite preview', async () => {
  const s = await setup();
  s.api.setTimerSoundOn(true); await s.api.unlockSound();
  await s.api.notifyTimer('Focus complete', 'Take a break');
  assert.equal(s.intervals.size, 1); assert.equal([...s.intervals.values()][0].ms, 1620);
  [...s.intervals.values()][0].fn(); assert.equal(s.nodes.length, 6);
  await s.api.notifyTimer('Break over', 'Focus again');
  assert.equal(s.intervals.size, 1); assert.equal(s.body.children[0].children.length, 1);
  assert.ok(s.nodes.slice(0, 6).every(n => n.disconnected && n.stops === 2));
  const panel = s.body.children[0].children[0]; panel.children.at(-1).listeners.click();
  assert.equal(s.intervals.size, 0); assert.equal(s.body.children.length, 0);
  assert.ok(s.nodes.every(n => n.disconnected));
  assert.equal(s.api.playSound('alarm'), true); assert.equal(s.intervals.size, 0);
  assert.ok(s.nodes.slice(-8).every(n => Number.isFinite(n.stopAt)));
});

test('blocked audio persists, recognized OS messages and fallback click confirm', async () => {
  const s = await setup(); s.api.setTimerSoundOn(true);
  s.data.set('kt:timerAlerts', 'true');
  await s.api.notifyTimer('Countdown finished', 'Done');
  assert.match(s.body.children[0].children[0].children[1].textContent, /blocked/);
  s.messages.message({ data: { type: 'wrong', tag: 'kt-timer' } }); assert.equal(s.intervals.size, 1);
  s.messages.message({ data: { type: 'kt-alert-confirm', tag: 'wrong' } }); assert.equal(s.intervals.size, 1);
  s.messages.message({ data: { type: 'kt-alert-confirm', tag: 'kt-timer' } }); assert.equal(s.intervals.size, 0);
  await s.api.notifyTimer('Again', 'Done');
  assert.equal(s.notifications.at(-1).options.requireInteraction, true);
  s.notifications.at(-1).onclick(); assert.equal(s.intervals.size, 0);
});

test('native timer append never receives null when notifications are enabled', async () => {
  const s = await setup(); s.data.set('kt:timerAlerts', 'true');
  const mod = await s.load(path.resolve(__dirname, 'assets/js/tools/productivity/timers.js')); await mod.evaluate();
  for (const name of ['pomodoroTool', 'stopwatchTool']) {
    const root = new Element('root'); const dispose = mod.namespace[name](root);
    assert.ok(!root.children.includes('null')); dispose();
  }
});

test('worker confirm broadcasts only to same-origin clients without navigation; body focuses', async () => {
  let listener, focused = 0, opened = 0; const received = [];
  const clients = [{ url: 'https://tools.test/', postMessage: m => received.push(m), focus: async () => focused++ }, { url: 'https://other.test/', postMessage() { throw Error('cross origin'); } }];
  const context = vm.createContext({ URL, self: { location: { origin: 'https://tools.test' }, addEventListener(type, fn) { if (type === 'notificationclick') listener = fn; }, clients: { matchAll: async () => clients, openWindow: async () => opened++ } } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, 'notification-worker.js'), 'utf8'), context);
  async function click(action) { let done; listener({ action, notification: { tag: 'kt-timer', data: { kind: 'countdown' }, close() {} }, waitUntil(p) { done = p; } }); await done; }
  await click('confirm'); assert.equal(received[0].type, 'kt-alert-confirm'); assert.equal(received[0].tag, 'kt-timer'); assert.equal(focused, 0); assert.equal(opened, 0);
  await click(''); assert.equal(focused, 1); assert.equal(opened, 0);
});

test('earthquake and timer panels coexist, dismissal does not confirm', async () => {
  const s = await setup(true); await s.api.unlockSound(); s.api.setTimerSoundOn(true);
  s.data.set('kt:quakeAlerts', 'true'); s.data.set('kt:quakeSeen', JSON.stringify('old'));
  s.context.quakeResult = { ok: true, data: { id: 'new', magnitude: 5, region: 'Region', dateLabel: 'Today', depth: '10 km' } };
  s.api.resume(); await new Promise(resolve => setImmediate(resolve));
  await s.api.notifyTimer('Done', 'Body');
  assert.equal(s.body.children[0].children.length, 2);
  assert.ok([...s.intervals.values()].some(i => i.ms === 2750));
  s.api.confirmAlert('kt-timer'); assert.equal(s.body.children[0].children.length, 1);
  assert.equal(s.notifications[0].options.tag, 'kt-quake');
  assert.equal(s.notifications[0].onclose, undefined);
  s.api.confirmAlert('kt-quake'); s.api.disableQuakeAlerts(); assert.equal(s.intervals.size, 0);
});

test('service-worker delivery uses persistent Confirm action', async () => {
  const s = await setup(true); s.data.set('kt:timerAlerts', 'true');
  await s.api.notifyTimer('Done', 'Body');
  const options = s.notifications[0].options;
  assert.equal(options.requireInteraction, true); assert.equal(options.actions[0].action, 'confirm');
  s.api.confirmAlert('kt-timer');
});
