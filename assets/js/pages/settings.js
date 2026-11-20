import { h, field, input, status, toast, formatBytes } from '../core/dom.js';
import { pageHead } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as history from '../services/history.js';
import * as notifications from '../services/notifications.js';
import * as backend from '../api/backend.js';
import config from '../config.js';

function section(title, desc, ...body) {
  return h('section', { class: 'settings-row' },
    h('div', { class: 'settings-row__label' }, h('h2', { text: title }), desc ? h('p', { class: 'field__hint', text: desc }) : null),
    h('div', { class: 'settings-row__control stack' }, ...body));
}

export function settingsPage(view) {
  document.title = 'Settings · KrysTools';
  view.append(pageHead('Settings', 'Preferences are stored in this browser. Sign in from Account to sync pins and recent tools.'));

  function notificationTest(kind) {
    const result = h('div', { role: 'status', 'aria-live': 'polite' });
    const button = h('button', { type: 'button', class: 'btn', text: 'Test notification', onclick: async () => {
      button.disabled = true;
      result.textContent = 'Sending test notification...';
      try {
        const sent = await notifications.testNotification(kind);
        result.replaceChildren(status(sent.ok ? 'ok' : 'err', sent.ok
          ? 'Browser accepted the test. If no popup appears, check OS notifications, Do Not Disturb and browser site settings.'
          : sent.error));
      } catch (error) {
        result.replaceChildren(status('err', error.message));
        toast(error.message);
      } finally {
        button.disabled = false;
        renderAlert();
        renderTimer();
      }
    } });
    return [button, result];
  }

  const quakeSoundStatus = h('div', { role: 'status' });
  const quakePreview = h('button', { type: 'button', class: 'btn', text: 'Test earthquake sound', onclick: async () => {
    try { await notifications.unlockSound(); notifications.playSound('alarm'); quakeSoundStatus.replaceChildren(); }
    catch (error) { quakeSoundStatus.replaceChildren(status('err', error.message)); }
  } });

  // Earthquake alerts
  const alertStatus = h('div');
  const alertBox = h('input', { type: 'checkbox', checked: notifications.quakeAlertsOn() });
  const renderAlert = () => {
    const p = notifications.permission();
    let msg = '';
    if (p === 'unsupported') msg = 'This browser does not support notifications.';
    else if (p === 'denied') msg = 'Notifications are blocked for this site. Allow them in your browser\'s site settings first.';
    else if (notifications.quakeAlertsOn()) msg = 'On. KrysTools checks BMKG every 5 minutes while a KrysTools tab is open.';
    else msg = 'Off.';
    alertStatus.replaceChildren(h('p', { class: 'field__hint', text: msg }));
    alertBox.disabled = p === 'unsupported' || p === 'denied';
  };
  alertBox.addEventListener('change', async () => {
    if (alertBox.checked) {
      try { await notifications.unlockSound(); }
      catch (error) { toast(error.message); }
      const r = await notifications.enableQuakeAlerts();
      alertBox.checked = r === 'granted';
      if (r === 'granted') toast('Earthquake alerts on');
    } else {
      notifications.disableQuakeAlerts();
      toast('Earthquake alerts off');
    }
    renderAlert();
    renderTimer();
  });
  renderAlert();
  view.append(section('Earthquake alerts', 'Get a browser notification when BMKG publishes a new latest earthquake.',
    h('label', { class: 'check' }, alertBox, h('span', { text: 'Notify me about new BMKG earthquakes' })), alertStatus,
    h('p', { class: 'field__hint', text: 'Earthquake alerts use a warning tone. This is a BMKG update notification, not an earthquake early-warning system.' }),
    h('div', { class: 'row' }, quakePreview), quakeSoundStatus, ...notificationTest('bmkg')));

  // Timer alerts
  const timerStatus = h('div');
  const timerBox = h('input', { type: 'checkbox', checked: notifications.timerAlertsOn() });
  const renderTimer = () => {
    const p = notifications.permission();
    let msg = '';
    if (p === 'unsupported') msg = 'This browser does not support notifications.';
    else if (p === 'denied') msg = 'Notifications are blocked for this site. Allow them in your browser\'s site settings first.';
    else if (notifications.timerAlertsOn()) msg = 'On. You get a notification when a Pomodoro interval or countdown ends, even if this tab is in the background.';
    else msg = 'Off.';
    timerStatus.replaceChildren(h('p', { class: 'field__hint', text: msg }));
    timerBox.disabled = p === 'unsupported' || p === 'denied';
  };
  timerBox.addEventListener('change', async () => {
    if (timerBox.checked) {
      const r = await notifications.enableTimerAlerts();
      timerBox.checked = r === 'granted';
      if (r === 'granted') toast('Timer alerts on');
    } else {
      notifications.disableTimerAlerts();
      toast('Timer alerts off');
    }
    renderTimer();
    renderAlert();
  });
  renderTimer();
  const soundStatus = h('div', { role: 'status' });
  const soundBox = h('input', { type: 'checkbox', checked: notifications.timerSoundOn() });
  let selectedSound = notifications.timerSound();
  const soundChoices = h('fieldset', { class: 'timer-sounds' },
    h('legend', { class: 'field__label', text: 'Timer sound' }),
    h('div', { class: 'timer-sounds__options' }, [['noisy', 'Berisik'], ['alarm', 'Peringatan', 'Seperti earthquake'], ['calm', 'Santai']].map(([value, label, hint]) => {
      const radio = h('input', { type: 'radio', name: 'timer-sound', value, checked: value === selectedSound });
      radio.addEventListener('change', () => {
        if (radio.checked) { selectedSound = value; notifications.setTimerSound(value); }
      });
      return h('label', { class: 'timer-sounds__option' }, radio,
        h('span', {}, h('strong', { text: label }), hint ? h('small', { text: hint }) : null));
    })));
  soundBox.addEventListener('change', async () => {
    if (soundBox.checked) {
      try { await notifications.unlockSound(); soundStatus.replaceChildren(); }
      catch (error) { soundBox.checked = false; soundStatus.replaceChildren(status('err', error.message)); }
    }
    notifications.setTimerSoundOn(soundBox.checked);
  });
  const preview = h('button', { type: 'button', class: 'btn', text: 'Test timer sound', onclick: async () => {
    try { await notifications.unlockSound(); notifications.playSound(selectedSound); soundStatus.replaceChildren(); }
    catch (error) { soundStatus.replaceChildren(status('err', error.message)); }
  } });
  view.append(section('Timer alerts', 'Get a browser notification when Pomodoro and countdown timers finish. The tool must stay open in a tab.',
    h('label', { class: 'check' }, timerBox, h('span', { text: 'Notify me when a timer finishes' })), timerStatus,
    h('label', { class: 'check' }, soundBox, h('span', { text: 'Play sound when timers finish' })),
    soundChoices,
    h('p', { class: 'field__hint', text: 'After reopening the site, interact with the page to allow audio. Sleeping tabs may delay alerts.' }),
    h('div', { class: 'row' }, preview), soundStatus, ...notificationTest('timer')));

  // Backend
  const current = backend.settings();
  const urlIn = input({ type: 'url', placeholder: 'https://<project>.supabase.co/functions/v1', value: store.get('backend', null)?.url || '', class: 'input input--mono' });
  const keyIn = input({ placeholder: 'Supabase anon public key (optional for local dev)', value: store.get('backend', null)?.anonKey || '', class: 'input input--mono' });
  const backendStatus = h('div', { 'aria-live': 'polite' });
  const describe = () => {
    const s = backend.settings();
    const where = s.fromDevice ? 'set on this device' : config.functionsUrl ? 'set by the site config' : 'not set';
    return s.url ? `Using ${s.url} (${where}).` : 'Not configured. AI tools, URL status and HTTP header checks need server functions.';
  };
  const backendDesc = h('p', { class: 'field__hint', text: describe() });

  const save = h('button', { class: 'btn btn--primary', type: 'button', text: 'Save' });
  const test = h('button', { class: 'btn', type: 'button', text: 'Test connection' });
  const reset = h('button', { class: 'btn btn--ghost', type: 'button', text: 'Use site default' });

  save.addEventListener('click', () => {
    const url = urlIn.value.trim();
    if (url && !/^https:\/\/[^\s]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/.test(url)) {
      urlIn.setAttribute('aria-invalid', 'true');
      backendStatus.replaceChildren(status('err', 'Use an https:// URL. Plain http is only allowed for localhost.'));
      return;
    }
    urlIn.removeAttribute('aria-invalid');
    if (url) store.set('backend', { url, anonKey: keyIn.value.trim() });
    else store.remove('backend');
    backendDesc.textContent = describe();
    backendStatus.replaceChildren(status('ok', 'Saved.'));
  });
  reset.addEventListener('click', () => {
    store.remove('backend');
    urlIn.value = '';
    keyIn.value = '';
    backendDesc.textContent = describe();
    backendStatus.replaceChildren(status('ok', 'Using the site default.'));
  });
  test.addEventListener('click', async () => {
    test.disabled = true;
    backendStatus.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'loading__bar' }), h('span', { text: 'Contacting server functions' })));
    const [net, ai] = await Promise.all([backend.call('net-inspect', { action: 'health' }, { timeout: 10000 }), backend.call('ai', { action: 'health' }, { timeout: 10000 })]);
    test.disabled = false;
    const lines = [];
    lines.push(net.ok ? status('ok', 'net-inspect is reachable.') : status('err', `net-inspect: ${net.error.message}`));
    if (ai.ok) {
      lines.push(ai.data.configured
        ? status('ok', `ai is reachable. Provider: ${ai.data.provider}, model: ${ai.data.model}.`)
        : status('err', 'ai is reachable but no AI provider key is set on the server.'));
    } else lines.push(status('err', `ai: ${ai.error.message}`));
    backendStatus.replaceChildren(h('div', { class: 'stack' }, lines));
  });

  view.append(section('Server functions', 'Some tools need a server: AI requests (to keep provider keys secret), and URL and header checks (browsers cannot read cross-site headers). These run as Supabase Edge Functions. The anon key is public by design; never paste a service role or AI provider key here.',
    backendDesc,
    h('div', { class: 'grid grid--2' }, field({ label: 'Functions URL', control: urlIn }), field({ label: 'Anon key', control: keyIn })),
    h('div', { class: 'row' }, save, test, current.fromDevice ? reset : null),
    backendStatus));

  // Data
  const usageEl = h('p', { class: 'field__hint' });
  const renderUsage = () => {
    usageEl.textContent = `KrysTools is using about ${formatBytes(store.usage())} of local storage, of which ${formatBytes(store.usage('cache:'))} is cached API responses.`;
  };
  renderUsage();
  const act = (label, confirmText, fn) => h('button', {
    class: 'btn', type: 'button', text: label,
    onclick: () => {
      if (confirmText && !confirm(confirmText)) return;
      fn();
      renderUsage();
      toast('Done');
    },
  });
  view.append(section('Data on this device', 'Notes, drafts, usage counts and cached API responses never leave this browser. Pins and recent tools are copied to your account only while you are signed in.',
    usageEl,
    h('div', { class: 'row' },
      act('Clear cached API data', null, () => store.clearAll('cache:')),
      act('Clear history and usage', 'Clear recent tools and usage counts?', () => history.clear()),
      act('Clear favorites', 'Remove all favorites?', () => { store.remove('favorites'); location.reload(); }),
      act('Delete everything', 'Delete all KrysTools data on this device, including notes and drafts? This cannot be undone.', () => { store.clearAll(''); location.reload(); }))));
}
