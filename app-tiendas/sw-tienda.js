// ============================================
// sw-tienda.js — PWA Tienda (Aislada + FCM)
// ============================================

// ★ 1. Importaciones de Firebase (Compatibilidad en SW) ★
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCfQGtf-7NBSO3j23crjhMsxggCHToqwYQ",
  authDomain: "domidelis-app.firebaseapp.com",
  projectId: "domidelis-app",
  storageBucket: "domidelis-app.firebasestorage.app",
  messagingSenderId: "942295492847",
  appId: "1:942295492847:web:9183f67bec7c71ee4f931a",
  measurementId: "G-P9PCQS31F9"
});

const messaging = firebase.messaging();

// ★ 2. Notificaciones en segundo plano con FCM ★
messaging.onBackgroundMessage((payload) => {
  console.log('[SW Tienda] Mensaje recibido en segundo plano:', payload);
  const notificationTitle = payload.notification?.title || 'Mi Tienda';
  const notificationOptions = {
    body: payload.notification?.body || 'Nuevo pedido recibido',
    icon: '/app-tiendas/assets/img/icon-192x192.png',
    badge: '/app-tiendas/assets/img/icon-192x192.png',
    tag: payload.data?.tag || 'tienda-push',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.data?.url || '/app-tiendas/index-tienda.html',
      pedidoId: payload.data?.pedidoId || null,
      tipo: payload.data?.tipo || 'general'
    }
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// CONFIGURACIÓN PWA (Caché)
// ============================================
const CACHE_NAME = 'tienda-cache-v2';

// Archivos estáticos de la tienda para cachear al instalar (RUTAS ABSOLUTAS)
const ARCHIVOS_ESTATICOS_TIENDA = [
  '/app-tiendas/',
  '/app-tiendas/index-tienda.html',
  '/app-tiendas/login-tienda.html',
  '/app-tiendas/manifest-tienda.json',
  '/app-tiendas/assets/css/tiendas.css',
  '/app-tiendas/assets/js/config-tienda.js',
  '/app-tiendas/assets/js/tiendas.js',
  '/app-tiendas/assets/img/icon-192x192.png',
  '/app-tiendas/assets/img/icon-512x512.png'
];

// ============================================
// INSTALAR — Cachear estáticos de la tienda
// ============================================
self.addEventListener('install', e => {
  console.log('[SW Tienda] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW Tienda] Cacheando archivos estáticos');
        return Promise.allSettled(
          ARCHIVOS_ESTATICOS_TIENDA.map(url =>
            cache.add(url).catch(err => console.warn('[SW Tienda] Error cacheando:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVAR — Limpiar cachés viejas de la tienda
// ============================================
self.addEventListener('activate', e => {
  console.log('[SW Tienda] Activando...');
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('tienda-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH — Estrategia inteligente y segura
// ============================================
self.addEventListener('fetch', e => {
  // Ignorar peticiones POST, PUT, DELETE
  if (e.request.method !== 'GET') return;

  // ─── Network First para la API ───
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request).then(cachedResponse => {
            return cachedResponse || new Response(
              JSON.stringify({ error: 'Sin conexión al servidor' }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // ─── Cache First para archivos estáticos (HTML, CSS, JS, imágenes) ───
  e.respondWith(
    caches.match(e.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // ¡Está en caché, entrega instantánea!
        }

        return fetch(e.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            if (e.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/app-tiendas/index-tienda.html');
            }
            return new Response('', { status: 408 });
          });
      })
  );
});

// ============================================
// CLICK EN NOTIFICACIÓN — Mantenemos este para abrir la app
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/app-tiendas/index-tienda.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});