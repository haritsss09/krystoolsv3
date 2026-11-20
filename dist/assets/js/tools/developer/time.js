import { h, input, field, button, select, status, kv, copyButton } from '../../core/dom.js';

export function parseTimestamp(value, unit = 'auto') {
  const text = value.trim();
  if (!text) throw new Error('Enter a timestamp or an ISO date.');
  let date;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const multiplier = unit === 'seconds' || (unit === 'auto' && text.replace(/^-/, '').split('.')[0].length <= 10) ? 1000 : 1;
    date = new Date(Number(text) * multiplier);
  } else date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date. Try an ISO date such as 2026-01-01T12:00:00Z.');
  return date;
}

export function timestampTool(root) {
  const value = input({ placeholder: 'Unix timestamp or ISO date' });
  const unit = select([['auto', 'Auto-detect'], ['seconds', 'Unix seconds'], ['milliseconds', 'Unix milliseconds']]);
  const output = h('div');
  function run() {
    if (!value.value.trim()) { output.replaceChildren(); return; }
    try {
      const date = parseTimestamp(value.value, unit.value);
      output.replaceChildren(kv([['Unix seconds', date.getTime() / 1000, { copy: true }], ['Unix milliseconds', date.getTime(), { copy: true }], ['ISO / UTC', date.toISOString(), { copy: true }], ['Local', date.toLocaleString()], ['Local zone', Intl.DateTimeFormat().resolvedOptions().timeZone], ['Weekday', date.toLocaleDateString('en', { weekday: 'long' })]]));
    } catch (error) { output.replaceChildren(status('err', error.message)); }
  }
  value.addEventListener('input', run); unit.addEventListener('change', run);
  root.append(h('div', { class: 'panes' }, field({ label: 'Timestamp or date', control: value, hint: 'Include Z or an offset for an unambiguous time. Date-times without offsets use your local zone.' }), field({ label: 'Numeric input unit', control: unit, hint: 'Auto treats up to 10 digits as seconds. Choose a unit for early or distant dates.' })),
    h('div', { class: 'toolbar' }, button('Convert', { variant: 'primary', onclick: run }), button('Now', { onclick: () => { unit.value = 'milliseconds'; value.value = String(Date.now()); run(); } })), output);
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const FIELDS = [['Minute',0,59], ['Hour',0,23], ['Day of month',1,31], ['Month',1,12], ['Day of week',0,7]];

export function parseCron(expression) {
  const parts = expression.trim().toUpperCase().split(/\s+/);
  if (parts.length !== 5) throw new Error('Use exactly five fields: minute hour day-of-month month day-of-week.');
  return parts.map((raw, index) => {
    const [name, min, max] = FIELDS[index];
    const aliases = index === 3 ? MONTHS : index === 4 ? DAYS : [];
    const text = raw.replace(/[A-Z]+/g, word => {
      const n = aliases.indexOf(word);
      if (n < 0) throw new Error(`Unknown name ${word} in ${name.toLowerCase()}.`);
      return String(n + (index === 3 ? 1 : 0));
    });
    const values = new Set();
    for (const item of text.split(',')) {
      const match = item.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/);
      if (!match) throw new Error(`Invalid ${name.toLowerCase()} field: ${raw}.`);
      const step = match[2] === undefined ? 1 : Number(match[2]);
      if (!Number.isInteger(step) || step < 1 || step > max - min + 1) throw new Error(`Invalid step in ${name.toLowerCase()}.`);
      let start, end;
      if (match[1] === '*') { start = min; end = max; }
      else {
        const range = match[1].split('-').map(Number);
        start = range[0]; end = range[1] ?? (match[2] ? max : start);
      }
      if (start < min || end > max || start > end) throw new Error(`${name} must be between ${min} and ${max}.`);
      for (let value = start; value <= end; value += step) values.add(index === 4 && value === 7 ? 0 : value);
    }
    return { name, raw, values, wildcard: raw === '*' };
  });
}

export function nextCronRuns(fields, from = new Date(), count = 5) {
  const cursor = new Date(from); cursor.setSeconds(0, 0); cursor.setTime(cursor.getTime() + 60000);
  const limit = new Date(from); limit.setFullYear(limit.getFullYear() + 5);
  const result = [];
  while (cursor <= limit && result.length < count) {
    const dom = fields[2].values.has(cursor.getDate()), dow = fields[4].values.has(cursor.getDay());
    const dayMatch = fields[2].wildcard ? dow : fields[4].wildcard ? dom : dom || dow;
    if (!fields[3].values.has(cursor.getMonth() + 1) || !dayMatch) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(0, 0, 0, 0); continue; }
    if (fields[0].values.has(cursor.getMinutes()) && fields[1].values.has(cursor.getHours())) result.push(new Date(cursor));
    cursor.setTime(cursor.getTime() + 60000);
  }
  return result;
}

export function cronTool(root) {
  const expression = input({ value: '0 9 * * MON-FRI', maxlength: 200 });
  const output = h('div', { class: 'stack' });
  function run() {
    try {
      const fields = parseCron(expression.value);
      const runs = nextCronRuns(fields);
      const descriptions = fields.map((field, i) => [field.name, field.wildcard ? `Every ${field.name.toLowerCase()}` : [...field.values].sort((a, b) => a - b).map(n => i === 3 ? MONTHS[n - 1] : i === 4 ? DAYS[n] : n).join(', ')]);
      output.replaceChildren(kv(descriptions), status('info', `Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Restricted day-of-month and day-of-week fields use OR. Daylight saving follows local time; repeated times may occur twice.`),
        h('h2', { class: 'panel__title', text: 'Next runs' }), runs.length ? h('ol', null, runs.map(date => h('li', { text: `${date.toLocaleString()} (${date.toISOString()})` }))) : status('info', 'No matching date in the next five years.'));
    } catch (error) { output.replaceChildren(status('err', error.message)); }
  }
  root.append(field({ label: 'Cron expression', control: expression }), h('div', { class: 'toolbar' }, button('Explain schedule', { variant: 'primary', onclick: run }), copyButton(() => expression.value)), output);
  run();
}
