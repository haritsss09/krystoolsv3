import { h, clear, input, textarea, checkbox, button, status, toast, relTime } from '../core/dom.js';
import { pageHead, countUp } from '../core/ui.js';
import * as admin from '../services/admin.js';
import * as auth from '../services/auth.js';

const fmtDate = (iso) => (iso ? relTime(Date.parse(iso)) : 'Never');

function stat(label, value, hint) {
  return h('div', { class: 'admin-stat' }, h('span', { class: 'admin-stat__label', text: label }), h('strong', { class: 'admin-stat__value' }, countUp(Number(value) || 0, { duration: 900 })), hint ? h('span', { class: 'field__hint', text: hint }) : null);
}

function usageChart(daily) {
  const days = Object.entries(daily);
  const max = Math.max(1, ...days.map(([, d]) => d.ai + d.net));
  return h('div', { class: 'admin-chart', role: 'img', 'aria-label': 'Requests per day for the last 7 days: ' + days.map(([d, v]) => `${d} ${v.ai} AI, ${v.net} checks`).join('; ') },
    days.map(([date, d]) => h('div', { class: 'admin-chart__col' },
      h('div', { class: 'admin-chart__bars' },
        h('span', { class: 'admin-chart__bar admin-chart__bar--net', style: `height:${(d.net / max) * 100}%` }),
        h('span', { class: 'admin-chart__bar admin-chart__bar--ai', style: `height:${(d.ai / max) * 100}%` })),
      h('span', { class: 'admin-chart__n', text: String(d.ai + d.net) }),
      h('span', { class: 'admin-chart__d', text: new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }) }))));
}

function settingsPanel(s, reload) {
  const ai = checkbox('AI tools are on', { checked: s.ai_enabled });
  const net = checkbox('URL status and header checks are on', { checked: s.net_enabled });
  const def = input({ type: 'number', min: '0', max: '10000', value: String(s.ai_daily_default), class: 'input input--mono', style: 'max-width:9rem' });
  const ann = textarea({ maxlength: '500', rows: '3', value: s.announcement, placeholder: 'Shown at the top of every page for signed-in users. Leave empty for none.' });
  ann.value = s.announcement;
  const msg = h('div', { 'aria-live': 'polite' });
  const save = button('Save site settings', { variant: 'primary' });
  save.addEventListener('click', async () => {
    const n = Number(def.value);
    if (!Number.isInteger(n) || n < 0 || n > 10000) { def.setAttribute('aria-invalid', 'true'); msg.replaceChildren(status('err', 'The default limit must be a whole number from 0 to 10,000.')); return; }
    def.removeAttribute('aria-invalid');
    save.disabled = true;
    const r = await admin.call('setSettings', { aiEnabled: ai.box.checked, netEnabled: net.box.checked, aiDailyDefault: n, announcement: ann.value });
    save.disabled = false;
    if (r.ok) { toast('Site settings saved'); dispatchEvent(new Event('kt:admin-saved')); reload(); }
    else msg.replaceChildren(status('err', r.error.message));
  });
  return h('section', { class: 'panel stack' },
    h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title', text: 'Site controls' })),
    h('div', { class: 'stack' }, ai.el, net.el),
    h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Default AI requests per user per 24 hours' }), def),
    h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Announcement' }), ann),
    h('div', { class: 'row' }, save), msg);
}

function userRow(u, meId, reload) {
  const limit = input({ type: 'number', min: '0', max: '10000', value: u.aiDailyLimit == null ? '' : String(u.aiDailyLimit), placeholder: 'Default', class: 'input input--mono admin-limit', 'aria-label': `AI limit for ${u.email || u.id}` });
  const saveLimit = button('Set', { variant: 'ghost', 'aria-label': `Save AI limit for ${u.email || u.id}` });
  const toggle = button(u.blocked ? 'Unblock' : 'Block', { variant: u.blocked ? '' : 'ghost' });
  if (u.id === meId) toggle.disabled = true;
  const send = async (blocked) => {
    const raw = limit.value.trim();
    const n = raw === '' ? null : Number(raw);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 10000)) { limit.setAttribute('aria-invalid', 'true'); toast('Limit must be 0 to 10,000, or empty for the default'); return; }
    limit.removeAttribute('aria-invalid');
    toggle.disabled = saveLimit.disabled = true;
    const r = await admin.call('setUser', { userId: u.id, blocked, aiDailyLimit: n });
    if (r.ok) { toast(blocked !== u.blocked ? (blocked ? 'User blocked' : 'User unblocked') : 'Limit saved'); reload(); }
    else { toggle.disabled = u.id === meId; saveLimit.disabled = false; toast(r.error.message); }
  };
  toggle.addEventListener('click', () => {
    if (!u.blocked && !confirm(`Block ${u.email || 'this user'} from AI tools and server checks?`)) return;
    send(!u.blocked);
  });
  saveLimit.addEventListener('click', () => send(u.blocked));
  const tags = [u.admin ? h('span', { class: 'pill pill--accent', text: 'Admin' }) : null, u.blocked ? h('span', { class: 'pill pill--err', text: 'Blocked' }) : null, !u.confirmed ? h('span', { class: 'pill', text: 'Unconfirmed' }) : null];
  return h('tr', null,
    h('td', null, h('div', { class: 'admin-user' }, h('span', { class: 'admin-user__email', text: u.email || '(no email)' }), h('span', { class: 'row admin-user__tags' }, tags)), h('span', { class: 'field__hint', text: `${u.provider || 'email'} · joined ${fmtDate(u.createdAt)}` })),
    h('td', { text: fmtDate(u.lastSignIn) }),
    h('td', { class: 'mono', text: `${u.usage.ai24} / ${u.usage.ai7}` }),
    h('td', { class: 'mono', text: String(u.usage.net7) }),
    h('td', null, h('div', { class: 'row admin-limit-row' }, limit, saveLimit)),
    h('td', null, toggle));
}

export async function adminPage(view) {
  document.title = 'Admin · KrysTools';
  view.append(pageHead('Admin', 'Users, usage and site controls. Changes apply on the server immediately.'));
  const body = h('div', { class: 'stack admin' });
  view.append(body);
  const load = async () => {
    if (!body.childElementCount) body.append(h('div', { class: 'loading' }, h('span', { class: 'loading__bar' }), h('span', { text: 'Loading admin data' })));
    const r = await admin.call('overview');
    if (!document.contains(body)) return;
    if (!r.ok) { clear(body).append(status('err', r.error.message)); return; }
    const d = r.data;
    const me = auth.currentUser()?.id;
    const q = input({ type: 'search', placeholder: 'Filter by email', class: 'input', 'aria-label': 'Filter users by email' });
    const tbody = h('tbody');
    const draw = () => {
      const term = q.value.trim().toLowerCase();
      const list = d.users.filter((u) => !term || (u.email || '').toLowerCase().includes(term))
        .sort((a, b) => (b.usage.ai7 + b.usage.net7) - (a.usage.ai7 + a.usage.net7) || String(b.createdAt).localeCompare(String(a.createdAt)));
      tbody.replaceChildren(...(list.length ? list.map((u) => userRow(u, me, load)) : [h('tr', null, h('td', { colspan: '6', text: 'No users match.' }))]));
    };
    q.addEventListener('input', draw);
    draw();
    clear(body).append(
      h('div', { class: 'admin-stats' },
        stat('Users', d.totals.users),
        stat('AI requests', d.totals.ai7, 'Last 7 days'),
        stat('Server checks', d.totals.net7, 'Last 7 days'),
        stat('Failed requests', d.totals.failed7, 'Last 7 days')),
      h('section', { class: 'panel stack' },
        h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title', text: 'Requests per day' }),
          h('span', { class: 'admin-legend' }, h('i', { class: 'admin-chart__bar--ai' }), 'AI ', h('i', { class: 'admin-chart__bar--net' }), 'Checks')),
        usageChart(d.daily),
        h('p', { class: 'field__hint', text: 'Counting started when the admin panel was installed; earlier usage was not recorded.' })),
      d.settings ? settingsPanel(d.settings, load) : status('err', 'Site settings are missing. Re-run the admin migration.'),
      h('section', { class: 'panel stack' },
        h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title', text: 'Users' }), q),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['Account', 'Last sign-in', 'AI 24h / 7d', 'Checks 7d', 'AI limit (24h)', 'Access'].map((t) => h('th', { text: t })))),
          tbody))));
  };
  await load();
}
