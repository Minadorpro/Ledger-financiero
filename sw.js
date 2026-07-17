// Service worker mínimo: hace que la app sea instalable y guarda una copia
// del archivo principal para que abra aunque no haya conexión en ese momento.
// Los datos reales (Firestore) siguen necesitando internet para sincronizarse.
//
// Estrategia: RED PRIMERO. Si hay internet, siempre se pide la versión más nueva
// (y se actualiza la copia guardada); solo se usa la copia guardada como respaldo
// si en ese momento no hay conexión. Así nunca te quedas viendo una versión vieja
// por accidente mientras tengas internet.
const CACHE_NAME = 'ledger-cache-v4';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // MUY IMPORTANTE: solo nos metemos con peticiones GET a nuestro propio origen (los
  // archivos de la app misma). Todo lo demás —Firebase, Firestore, CDNs, extensiones del
  // navegador— lo dejamos pasar sin tocar, para no interferir con la sincronización real
  // de datos ni con la carga de las librerías.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// al tocar la notificación de "pagos de mañana", abre la app (o la enfoca si ya está abierta)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
