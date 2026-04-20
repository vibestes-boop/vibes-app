// -----------------------------------------------------------------------------
// Serlo Service Worker — minimaler Offline-Support.
//
// Strategie:
//   - Install: öffnet den Cache und legt die Offline-Fallback-Page + Icons ab.
//   - Activate: räumt alte Cache-Versionen auf.
//   - Fetch: Network-first für Navigation (HTML); fällt bei Fehlschlag auf den
//     offline.html-Fallback zurück. Static-Assets (png/svg/css/js) werden
//     stale-while-revalidate gecached.
//   - POST-Requests, Server-Actions und API-Calls werden NICHT berührt — sie
//     gehen immer ans Netz (Cache-Poison-Schutz, damit Mutationen nicht aus
//     dem Cache serviert werden).
//
// Die `CACHE_VERSION` hier hochzählen, wenn sich die gecachte Asset-Liste
// ändert — dann purged die Activate-Phase die alte Version.
// -----------------------------------------------------------------------------

// Bump bei jeder signifikanten SW-Änderung — Activate-Phase purged dann
// alte Caches. v2 = Push-Handler-Support (v1.w.12.4).
const CACHE_VERSION = 'serlo-v2';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // Sofort aktivieren, nicht auf alte Tabs warten.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET cachen. POST/PUT/DELETE (Server-Actions, API, Auth) gehen ans Netz.
  if (req.method !== 'GET') return;

  // Supabase, Analytics und Auth-Endpoints NICHT cachen — sie haben eigene
  // Caching-Semantik und dürfen nicht stale serviert werden.
  const url = new URL(req.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.endsWith('supabase.co') ||
    url.hostname.endsWith('posthog.com') ||
    url.hostname.endsWith('i.posthog.com')
  ) {
    return;
  }

  // Navigation (HTML-Requests) → Network-first mit Offline-Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cached = await cache.match(OFFLINE_URL);
          return cached ?? new Response('Offline', { status: 503 });
        }
      })(),
    );
    return;
  }

  // Statische Assets → Stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    /\.(?:png|svg|jpg|jpeg|webp|gif|ico|css|js|woff2?|ttf)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      })(),
    );
  }
});

// -----------------------------------------------------------------------------
// PUSH-HANDLER (v1.w.12.4)
//
// Der Push-Service (FCM/Mozilla-Autopush/WNS) ruft den SW im Hintergrund auf,
// auch wenn die Site nicht offen ist. Wir bekommen einen verschlüsselten
// Payload den der Browser vorher mit unserem `auth`/`p256dh`-Secret
// entschlüsselt hat — d.h. in `event.data` liegt bereits Klartext.
//
// Payload-Contract (set by Edge-Function `send-web-push`):
//   {
//     title:   string,        // Notification-Titel
//     body:    string,        // Notification-Body
//     icon?:   string,        // Optional: Custom-Icon (default /icon.svg)
//     badge?:  string,        // Optional: Badge (default /icon.svg)
//     tag?:    string,        // Optional: Grouping-Key (neue ersetzt alte mit gleichem tag)
//     url?:    string,        // Optional: Deep-Link beim Click (default /)
//     data?:   object,        // Arbitrary payload — wird beim Click durchgereicht
//   }
//
// Fallback-Verhalten wenn Payload kaputt/leer: Zeige generische "Neue
// Aktivität"-Notification statt den Push zu droppen — Chrome zeigt sonst
// eine Chrome-Default-Notification („Site X has updated in the background")
// die peinlicher aussieht als ein generisches Serlo-Label.
// -----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // Payload war kein JSON → als raw text behandeln, damit niemand
      // schweigend verschwindet.
      try {
        payload = { title: 'Serlo', body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title = payload.title || 'Serlo';
  const options = {
    body: payload.body || 'Neue Aktivität',
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    tag: payload.tag, // gleicher tag → neue Notification ersetzt alte (wichtig
                      // z.B. damit 10 Likes auf einen Post nicht 10 Pop-Ups
                      // machen — Edge-Function setzt tag=`like:<postId>`)
    renotify: Boolean(payload.tag), // Tag-replaced notifications sollen
                                    // trotzdem die Vibration triggern.
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    // iOS-Safari ignoriert `actions`, Android/Desktop zeigt sie als Buttons.
    // Wir setzen keine Default-Actions — der Main-Click reicht.
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// -----------------------------------------------------------------------------
// NOTIFICATION-CLICK
//
// User klickt auf eine Push-Notification → wir wollen (a) die Notification
// schließen, (b) die Ziel-URL entweder in einem existierenden Tab öffnen
// oder einen neuen aufmachen. „Focus-existing" ist wichtig — sonst reißt
// jeder Like-Push einen neuen Tab auf.
// -----------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Versuche einen existierenden Tab zu finden der bereits auf der
      // Ziel-Route ist (URL-Prefix-Match reicht — wir wollen nicht wegen
      // Query-Params ein neues Fenster aufmachen).
      const absoluteTarget = new URL(targetUrl, self.location.origin).href;
      const existing = allClients.find((c) => {
        try {
          return new URL(c.url).pathname === new URL(absoluteTarget).pathname;
        } catch {
          return false;
        }
      });

      if (existing) {
        await existing.focus();
        // Falls Query-Params unterschiedlich sind, navigiere innerhalb
        // des Tabs. `navigate()` ist optional auf dem Client-Interface —
        // defensive null-check.
        if (existing.url !== absoluteTarget && typeof existing.navigate === 'function') {
          try {
            await existing.navigate(absoluteTarget);
          } catch {
            // navigate() kann an Cross-Origin-Grenzen fehlschlagen —
            // dann bleibt der Tab auf der alten URL. Acceptable.
          }
        }
        return;
      }

      // Kein passender Tab → neuen öffnen.
      if (self.clients.openWindow) {
        await self.clients.openWindow(absoluteTarget);
      }
    })(),
  );
});

// -----------------------------------------------------------------------------
// PUSHSUBSCRIPTIONCHANGE
//
// Browser kann eine Subscription unangekündigt invalidieren (z.B. FCM
// rotiert den Endpoint). Wir bekommen dann dieses Event mit `oldSubscription`
// und NULL als newSubscription — einzige Möglichkeit: neu subscriben und
// dem Server den neuen Endpoint melden. Der Client-Code (`useWebPush`)
// macht das beim nächsten Page-Load ohnehin, aber für User die die Site
// tagelang nicht öffnen wäre der Push-Service sonst kaputt.
//
// Nur Best-Effort — wenn der Re-Subscribe fehlschlägt, räumen wir auf beim
// nächsten regulären Besuch auf (alter Endpoint wird 410 Gone zurückgeben
// → Edge-Function ruft prune_web_push_subscription).
// -----------------------------------------------------------------------------
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      // Nothing to do server-side from the SW — the server identity
      // (auth.uid) is not accessible hier. Der Client-Hook re-subscribes
      // bei nächstem Page-Load. Event wird nur geloggt damit es in
      // Sentry-Breadcrumbs (falls PostMessage zum Page-Thread) sichtbar ist.
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const c of clients) {
          c.postMessage({ type: 'push-subscription-change' });
        }
      } catch {
        // Noch kein offenes Window — nichts zu tun, Hook resubscribt beim
        // nächsten Visit.
      }
    })(),
  );
});
