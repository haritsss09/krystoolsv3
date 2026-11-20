import { h, input, select, field, button, panel, status, kv, nextId, copyButton, actions } from '../../core/dom.js';

const DAY = 86400000;
function utcDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a date in YYYY-MM-DD format.');
  const [year, month, day] = value.split('-').map(Number);
  const date = utcDate(year, month, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Enter a real calendar date between years 0001 and 9999.');
  return date;
}

function dateString(date) {
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) throw new Error('Result must be between years 0001 and 9999.');
  return date.toISOString().slice(0, 10);
}

export function dateDifference(start, end) {
  const a = parseDate(start).getTime();
  const b = parseDate(end).getTime();
  const days = (b - a) / DAY;
  const count = Math.abs(days);
  let weekdays = Math.floor(count / 7) * 5;
  const first = new Date(Math.min(a, b)).getUTCDay();
  for (let i = 0; i < count % 7; i++) {
    const day = (first + i) % 7;
    if (day !== 0 && day !== 6) weekdays++;
  }
  return { days, weeks: days / 7, weekdays: weekdays * Math.sign(days) };
}

export function addDate(value, amount, unit) {
  const date = parseDate(value);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100000) throw new Error('Use a whole-number offset from -100,000 to 100,000.');
  if (unit === 'months') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount);
    const last = utcDate(date.getUTCFullYear(), date.getUTCMonth() + 2, 0).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else if (unit === 'days' || unit === 'weeks') date.setUTCDate(date.getUTCDate() + amount * (unit === 'weeks' ? 7 : 1));
  else if (unit === 'business') {
    let remaining = Math.abs(amount);
    while (remaining) {
      date.setUTCDate(date.getUTCDate() + Math.sign(amount));
      if (![0, 6].includes(date.getUTCDay())) remaining--;
    }
  } else throw new Error('Choose days, weeks, months or business days.');
  return dateString(date);
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateCalcTool(root) {
  const start = input({ type: 'date', value: localToday(), min: '0001-01-01', max: '9999-12-31' });
  const end = input({ type: 'date', value: localToday(), min: '0001-01-01', max: '9999-12-31' });
  const base = input({ type: 'date', value: localToday(), min: '0001-01-01', max: '9999-12-31' });
  const amount = input({ type: 'number', step: 1, min: -100000, max: 100000, value: '7' });
  const unit = select([['days', 'Days'], ['weeks', 'Weeks'], ['months', 'Months'], ['business', 'Business days (Mon–Fri)']]);
  const difference = h('div', { 'aria-live': 'polite' });
  const addition = h('div', { 'aria-live': 'polite' });
  function diff() {
    try {
      const result = dateDifference(start.value, end.value);
      difference.replaceChildren(kv([['Days', result.days], ['Weeks', Number(result.weeks.toFixed(6))], ['Weekdays', result.weekdays]]));
    } catch (error) { difference.replaceChildren(status('err', error.message)); }
  }
  function add() {
    try {
      if (!amount.value.trim()) throw new Error('Enter an offset. Negative values subtract.');
      addition.replaceChildren(kv([['Result date', addDate(base.value, Number(amount.value), unit.value), { copy: true }]]));
    } catch (error) { addition.replaceChildren(status('err', error.message)); }
  }
  for (const control of [start, end]) control.addEventListener('change', diff);
  for (const control of [base, amount, unit]) control.addEventListener('change', add);
  root.append(h('div', { class: 'panes' },
    panel('Between dates', h('div', { class: 'workspace' }, field({ label: 'Start date', control: start }), field({ label: 'End date', control: end }),
      button('Calculate difference', { variant: 'primary', onclick: diff }), difference,
      h('p', { class: 'field__hint', text: 'Signed calendar difference: end minus start. Weekdays count the earlier date, excluding the later date, with the same sign. Holidays are not excluded.' }))),
    panel('Add or subtract', h('div', { class: 'workspace' }, field({ label: 'Base date', control: base }), field({ label: 'Offset', control: amount, hint: 'Use a negative value to subtract.' }), field({ label: 'Unit', control: unit }),
      button('Calculate date', { variant: 'primary', onclick: add }), addition,
      h('p', { class: 'field__hint', text: 'Months clamp to the last valid day (Jan 31 + 1 month becomes Feb 28 or 29). Business-day offsets exclude the base date and skip weekends, not holidays. Dates are calendar-only, independent of DST.' })))));
  diff();
  add();
}

function zoneFormatter(zone) {
  if (typeof zone !== 'string' || zone.length > 100 || !zone.trim()) throw new Error('Enter an IANA time zone, such as Europe/London.');
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch { throw new Error(`Unknown time zone: ${zone}. Use an IANA name such as America/New_York.`); }
}

function wallParts(formatter, timestamp) {
  return Object.fromEntries(formatter.formatToParts(timestamp).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

function wallStamp(parts) {
  return utcDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second).getTime();
}

export function possibleInstants(value, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error('Enter a local date and time, including hours and minutes.');
  const date = parseDate(value.slice(0, 10));
  const [hour, minute, second = 0] = value.slice(11).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59 || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) throw new Error('Use a valid time and a year from 1900 to 2100. Leap seconds are not supported.');
  date.setUTCHours(hour, minute, second);
  const wanted = date.getTime();
  const formatter = zoneFormatter(zone);
  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = wanted + hours * 3600000;
    offsets.add(wallStamp(wallParts(formatter, probe)) - probe);
  }
  const matches = [...offsets].map(offset => wanted - offset).filter(candidate => wallStamp(wallParts(formatter, candidate)) === wanted);
  return [...new Set(matches)].sort((a, b) => a - b);
}

export function resolveZonedTime(value, zone, policy = 'reject') {
  if (!['reject', 'earlier', 'later'].includes(policy)) throw new Error('Choose a valid ambiguity policy.');
  const matches = possibleInstants(value, zone);
  if (!matches.length) throw new Error('This local time does not exist in the source zone because the clock jumps forward. Choose another time.');
  if (matches.length > 1 && policy === 'reject') throw new Error(`This local time occurs twice. Choose earlier or later explicitly: ${matches.map(t => new Date(t).toISOString()).join(' or ')}.`);
  return policy === 'later' ? matches[matches.length - 1] : matches[0];
}

export function formatZonedTime(timestamp, zone) {
  const formatter = zoneFormatter(zone);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp.');
  const parts = wallParts(formatter, timestamp);
  const offset = Math.round((wallStamp(parts) - Math.floor(timestamp / 1000) * 1000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  const absolute = Math.abs(offset);
  const suffix = `UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(absolute / 3600))}:${pad(Math.floor(absolute % 3600 / 60))}${absolute % 60 ? ':' + pad(absolute % 60) : ''}`;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)} (${suffix})`;
}

export function timezoneTool(root) {
  const defaultZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const listId = nextId('zones');
  const common = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
  const zoneNames = Intl.supportedValuesOf ? ['UTC', ...Intl.supportedValuesOf('timeZone')] : common;
  const zoneList = h('datalist', { id: listId }, ...zoneNames.map(zone => h('option', { value: zone })));
  const source = input({ value: defaultZone, list: listId, maxlength: 100 });
  const target = input({ value: 'UTC', list: listId, maxlength: 100 });
  const now = new Date();
  const wall = input({ type: 'datetime-local', step: 1, value: `${localToday()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, min: '1900-01-01T00:00', max: '2100-12-31T23:59:59' });
  const policy = select([['reject', 'Ask when a time occurs twice'], ['earlier', 'Earlier occurrence'], ['later', 'Later occurrence']]);
  const result = h('div', { 'aria-live': 'polite' });
  const clocks = h('div');
  let copy = '';
  function convert() {
    try {
      const stamp = resolveZonedTime(wall.value, source.value.trim(), policy.value);
      copy = formatZonedTime(stamp, target.value.trim());
      result.replaceChildren(kv([['Source', formatZonedTime(stamp, source.value.trim())], ['Target', copy], ['UTC instant', new Date(stamp).toISOString()]]));
      if (possibleInstants(wall.value, source.value.trim()).length > 1) result.append(status('info', `Repeated local time: using the ${policy.value} occurrence.`));
    } catch (error) { copy = ''; result.replaceChildren(status('err', error.message)); }
  }
  function worldClocks() {
    const time = Date.now();
    clocks.replaceChildren(kv(common.map(zone => [zone, formatZonedTime(time, zone)])));
  }
  for (const control of [source, target, wall, policy]) control.addEventListener('change', convert);
  root.append(zoneList, h('div', { class: 'panes' }, panel('Convert local time', h('div', { class: 'workspace' },
    field({ label: 'Source time zone (IANA)', control: source }), field({ label: 'Local date and time in source zone', control: wall }),
    field({ label: 'Target time zone (IANA)', control: target }), field({ label: 'Repeated-time policy', control: policy }),
    button('Convert time', { variant: 'primary', onclick: convert }),
    h('p', { class: 'field__hint', text: 'Skipped local times are rejected. Repeated times require an explicit earlier/later choice. Rules come from this browser’s IANA data; supported input years: 1900–2100.' }))),
  panel('Converted time', actions(copyButton(() => copy)), result)), panel('Current world times', clocks),
  h('p', { class: 'field__hint', text: 'World clocks refresh every 30 seconds while this tool is open.' }));
  convert();
  worldClocks();
  const timer = setInterval(worldClocks, 30000);
  return () => clearInterval(timer);
}
