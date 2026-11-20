import { h, input, select, checkbox, field, button, panel, status } from '../../core/dom.js';
import { timerAlertsOn, notifyTimer, timerSoundOn, setTimerSoundOn, unlockSound } from '../../services/notifications.js';

function alertHint() {
  return timerAlertsOn() ? null : h('p', { class: 'field__hint' }, 'Want a notification when the timer ends? Turn on ', h('a', { href: '#/settings', text: 'Timer alerts in Settings' }), '.');
}

export class TimestampTimer {
  constructor({ duration = null, now = () => Date.now() } = {}) {
    if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 604800000)) throw new Error('Countdown duration must be greater than zero and at most seven days.');
    this.duration = duration;
    this.now = now;
    this.elapsed = 0;
    this.startedAt = null;
  }
  start() {
    if (this.startedAt !== null || this.snapshot().done) return;
    this.startedAt = this.now();
  }
  pause() {
    const snapshot = this.snapshot();
    this.elapsed = snapshot.elapsed;
    this.startedAt = null;
    return this.snapshot();
  }
  reset() {
    this.elapsed = 0;
    this.startedAt = null;
  }
  snapshot() {
    const elapsed = this.elapsed + (this.startedAt === null ? 0 : Math.max(0, this.now() - this.startedAt));
    const done = this.duration !== null && elapsed >= this.duration;
    if (done) { this.elapsed = this.duration; this.startedAt = null; }
    return { elapsed: done ? this.duration : elapsed, remaining: this.duration === null ? null : Math.max(0, this.duration - elapsed), running: this.startedAt !== null, done };
  }
}

export function formatTimer(milliseconds, centiseconds = false) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid timer value.');
  const seconds = centiseconds ? Math.floor(milliseconds / 1000) : Math.ceil(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const pad = n => String(n).padStart(2, '0');
  return `${hours ? pad(hours) + ':' : ''}${pad(minutes)}:${pad(seconds % 60)}${centiseconds ? '.' + pad(Math.floor(milliseconds % 1000 / 10)) : ''}`;
}

function soundControl(feedback) {
  const sound = checkbox('Play a sound when finished (sound selected in Settings)', { checked: timerSoundOn() });
  let disposed = false;
  const report = () => { if (!disposed) feedback.replaceChildren(status('err', 'Sound is unavailable or blocked. The timer will still finish visually.')); };
  sound.box.addEventListener('change', async () => {
    if (sound.box.checked) {
      try { await unlockSound(); if (!disposed) feedback.replaceChildren(); }
      catch { sound.box.checked = false; report(); }
    }
    setTimerSoundOn(sound.box.checked);
  });
  return {
    el: sound.el,
    dispose() { disposed = true; },
  };
}

function minutesValue(control, maximum) {
  const value = Number(control.value);
  if (!control.value.trim() || !Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`Enter whole minutes from 1 to ${maximum}.`);
  return value * 60000;
}

export function pomodoroTool(root) {
  const focus = input({ type: 'number', value: '25', min: 1, max: 180, step: 1 });
  const rest = input({ type: 'number', value: '5', min: 1, max: 60, step: 1 });
  const feedback = h('div');
  const announcement = h('div', { role: 'status', 'aria-live': 'polite' });
  const sound = soundControl(feedback);
  const display = h('div', { class: 'timer-display', role: 'timer', 'aria-label': 'Time remaining', 'aria-live': 'off' });
  const phaseLabel = h('p', { class: 'panel__title', text: 'Focus' });
  const count = h('p', { class: 'field__hint', text: 'Completed focus intervals: 0' });
  let phase = 'focus';
  let completed = 0;
  let handled = false;
  let timer = new TimestampTimer({ duration: 25 * 60000 });
  const start = button('Start focus', { variant: 'primary', onclick: () => {
    try {
      if (timer.snapshot().done) changePhase();
      if (timer.snapshot().elapsed === 0) timer = new TimestampTimer({ duration: duration() });
      timer.start();
      announcement.textContent = `${phase === 'focus' ? 'Focus' : 'Break'} timer running.`;
      feedback.replaceChildren();
      tick();
    } catch (error) { feedback.replaceChildren(status('err', error.message)); }
  } });
  const pause = button('Pause', { onclick: () => { timer.pause(); announcement.textContent = 'Paused.'; tick(); } });
  function duration() { return phase === 'focus' ? minutesValue(focus, 180) : minutesValue(rest, 60); }
  function changePhase() {
    const next = phase === 'focus' ? 'break' : 'focus';
    const nextDuration = next === 'focus' ? minutesValue(focus, 180) : minutesValue(rest, 60);
    phase = next;
    timer = new TimestampTimer({ duration: nextDuration });
    handled = false;
    phaseLabel.textContent = phase === 'focus' ? 'Focus' : 'Break';
  }
  function tick() {
    const snapshot = timer.snapshot();
    if (snapshot.done && !handled) {
      handled = true;
      if (phase === 'focus') completed++;
      count.textContent = `Completed focus intervals: ${completed}`;
      announcement.textContent = `${phase === 'focus' ? 'Focus' : 'Break'} complete. Start the next interval when ready.`;
      void notifyTimer(phase === 'focus' ? 'Focus complete' : 'Break over', phase === 'focus' ? `Focus interval ${completed} done. Time for a break.` : 'Ready to start the next focus interval.').catch(error => feedback.replaceChildren(status('err', error.message)));
    }
    display.textContent = formatTimer(snapshot.remaining);
    start.disabled = snapshot.running;
    start.textContent = snapshot.done ? `Start ${phase === 'focus' ? 'break' : 'focus'}` : snapshot.elapsed ? 'Resume' : `Start ${phase}`;
    pause.disabled = !snapshot.running;
    focus.disabled = rest.disabled = snapshot.running || snapshot.elapsed > 0 && !snapshot.done;
  }
  const reset = button('Reset interval', { onclick: () => {
    try {
      timer = new TimestampTimer({ duration: duration() });
      handled = false;
      announcement.textContent = 'Interval reset.';
      feedback.replaceChildren();
      tick();
    } catch (error) { feedback.replaceChildren(status('err', error.message)); }
  } });
  const skip = button('Switch focus / break', { onclick: () => {
    try { changePhase(); announcement.textContent = 'Interval switched, paused.'; feedback.replaceChildren(); tick(); }
    catch (error) { feedback.replaceChildren(status('err', error.message)); }
  } });
  for (const control of [focus, rest]) control.addEventListener('change', () => {
    if (timer.snapshot().elapsed === 0) {
      try { timer = new TimestampTimer({ duration: duration() }); feedback.replaceChildren(); tick(); }
      catch (error) { feedback.replaceChildren(status('err', error.message)); }
    }
  });
  root.append(panel('Focus timer', phaseLabel, display, h('div', { class: 'toolbar' }, start, pause, reset, skip), announcement, count),
    h('div', { class: 'panes' }, field({ label: 'Focus duration (minutes)', control: focus }), field({ label: 'Break duration (minutes)', control: rest })), sound.el, ...[alertHint()].filter(node => node != null), feedback,
    h('p', { class: 'field__hint', text: 'Each interval stops at completion. Start the next one manually. Timers use timestamps, so background delays do not accumulate. Alerts may be delayed in sleeping tabs. Leaving this tool stops the timer.' }));
  tick();
  const interval = setInterval(tick, 200);
  return () => { clearInterval(interval); timer.pause(); sound.dispose(); };
}

export function stopwatchTool(root) {
  let timer = new TimestampTimer();
  let handled = false;
  const mode = select([['stopwatch', 'Stopwatch'], ['countdown', 'Countdown']]);
  const duration = input({ type: 'number', value: '300', min: 1, max: 604800, step: 1 });
  const durationField = field({ label: 'Countdown duration (seconds)', control: duration, hint: '1 to 604,800 seconds (seven days).' });
  const display = h('div', { class: 'timer-display', role: 'timer', 'aria-label': 'Timer display', 'aria-live': 'off' });
  const feedback = h('div');
  const announcement = h('div', { role: 'status', 'aria-live': 'polite' });
  const sound = soundControl(feedback);
  const laps = [];
  const lapList = h('ol', { class: 'output output--sm' });
  const lapsPanel = panel('Laps (split / total)', lapList);
  const start = button('Start', { variant: 'primary', onclick: () => {
    try {
      if (mode.value === 'countdown' && timer.snapshot().elapsed === 0) timer = makeTimer();
      timer.start();
      announcement.textContent = 'Running.';
      feedback.replaceChildren();
      tick();
    } catch (error) { feedback.replaceChildren(status('err', error.message)); }
  } });
  const pause = button('Pause', { onclick: () => { timer.pause(); announcement.textContent = 'Paused.'; tick(); } });
  const lap = button('Record lap', { onclick: () => {
    if (laps.length >= 200) { feedback.replaceChildren(status('err', 'Maximum 200 laps. Reset to start a new session.')); return; }
    const total = timer.snapshot().elapsed;
    const split = total - (laps.at(-1) || 0);
    laps.push(total);
    lapList.append(h('li', { text: `Lap ${laps.length}: ${formatTimer(split, true)} / ${formatTimer(total, true)}` }));
  } });
  function makeTimer() {
    if (mode.value === 'stopwatch') return new TimestampTimer();
    const seconds = Number(duration.value);
    if (!duration.value.trim() || !Number.isInteger(seconds) || seconds < 1 || seconds > 604800) throw new Error('Enter a whole duration from 1 to 604,800 seconds.');
    return new TimestampTimer({ duration: seconds * 1000 });
  }
  function reset() {
    timer.reset();
    handled = false;
    laps.length = 0;
    lapList.replaceChildren();
    try {
      timer = makeTimer();
      announcement.textContent = 'Ready.';
      feedback.replaceChildren();
    } catch (error) {
      timer = new TimestampTimer();
      announcement.textContent = 'Enter a valid duration to start.';
      feedback.replaceChildren(status('err', error.message));
    }
    tick();
  }
  function tick() {
    const snapshot = timer.snapshot();
    const countdown = mode.value === 'countdown';
    if (snapshot.done && !handled) { handled = true; announcement.textContent = 'Countdown finished.'; void notifyTimer('Countdown finished', `${formatTimer(timer.duration)} countdown is done.`, 'countdown').catch(error => feedback.replaceChildren(status('err', error.message))); }
    display.textContent = formatTimer(countdown ? snapshot.remaining ?? 0 : snapshot.elapsed, !countdown);
    start.disabled = snapshot.running || snapshot.done;
    start.textContent = snapshot.elapsed && !snapshot.done ? 'Resume' : 'Start';
    pause.disabled = !snapshot.running;
    lap.disabled = !snapshot.running || countdown;
    lap.hidden = lapsPanel.hidden = countdown;
    durationField.hidden = sound.el.hidden = !countdown;
    duration.disabled = snapshot.running || snapshot.elapsed > 0 && !snapshot.done;
  }
  mode.addEventListener('change', reset);
  duration.addEventListener('change', reset);
  root.append(field({ label: 'Timer mode (changing resets the session)', control: mode }), durationField,
    panel('Timer', display, h('div', { class: 'toolbar' }, start, pause, button('Reset', { onclick: reset }), lap), announcement), sound.el, ...[alertHint()].filter(node => node != null), feedback, lapsPanel,
    h('p', { class: 'field__hint', text: 'Stopwatch laps show split and total time, up to 200 laps. Timestamps compensate for background throttling. Sound may be delayed by browser sleep. Leaving this tool stops the timer. System clock changes can affect timing.' }));
  tick();
  const interval = setInterval(tick, 50);
  return () => { clearInterval(interval); timer.pause(); sound.dispose(); };
}
