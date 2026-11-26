// Service worker van de interne webapp: maakt hem installeerbaar en toont pushmeldingen.
// Bewust geen cache: klantgegevens horen niet offline op een telefoon te staan.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Avezaat & Evers', {
    body: d.body || '',
    icon: '/assets/img/app/intern-192.png',
    badge: '/assets/img/app/intern-badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/intern/' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var doel = new URL((e.notification.data && e.notification.data.url) || '/intern/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lijst) {
    for (var i = 0; i < lijst.length; i++) {
      var c = lijst[i];
      if (c.url.indexOf(self.location.origin + '/intern') === 0 && 'navigate' in c) return c.focus().then(function (f) { return (f || c).navigate(doel); });
    }
    return self.clients.openWindow(doel);
  }));
});
