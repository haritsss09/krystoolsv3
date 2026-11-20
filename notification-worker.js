const ROUTES = { bmkg: '#/tool/earthquake', timer: '#/tool/pomodoro', countdown: '#/tool/stopwatch' };
const ALERT_TAGS = new Set(['kt-timer', 'kt-quake']);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('notificationclick', event => {
  if (event.action && event.action !== 'confirm') return;
  event.notification.close();
  const kind = event.notification.data?.kind;
  const route = Object.hasOwn(ROUTES, kind) ? ROUTES[kind] : ROUTES.timer;
  const target = new URL('/' + route, self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.filter(client => new URL(client.url).origin === target.origin);
    if (ALERT_TAGS.has(event.notification.tag)) {
      for (const client of sameOrigin) client.postMessage({ type: 'kt-alert-confirm', tag: event.notification.tag });
    }
    if (event.action === 'confirm') return;
    for (const client of sameOrigin) {
      const url = new URL(client.url);
      if (!['/', '/index.html'].includes(url.pathname)) continue;
      await client.focus();
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
