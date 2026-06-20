// ============================================
// service-worker.js — PWA Completa
// Estrategia: Cache First + Network Fallback
// ============================================

const isDev = false;
const CACHE_NAME = isDev
    ? 'dev-' + Date.now() 
    : 'domidelis-v1.8.6'; 

const IMAGES_CACHE_NAME = 'domidelis-img-cache-v1'; 

const ARCHIVOS_ESTATICOS = [
  '/',
  '/index.html',
  '/login.html',
  '/checkout.html',
  '/confirmacion.html',
  '/admin.html',
  '/domiciliario.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/client.js',
  '/assets/js/checkout.js',
  '/assets/js/admin.js',
  '/assets/js/domiciliario.js',
  '/assets/js/informe-financiero.js',
  '/assets/js/notificaciones.js',
  '/assets/js/push-manager.js',
  '/assets/js/auth-guard.js',
  '/assets/img/icon-192x192.png',
  '/assets/img/icon-512x512.png',
  '/assets/css/offline-game.css',  
  '/assets/js/offline-game.js'
];

const RECURSOS_EXTERNOS = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.socket.io/4.6.1/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ============================================
// INSTALAR
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos estáticos...');
        const promLocales = Promise.allSettled(
          ARCHIVOS_ESTATICOS.map(archivo => {
            return fetch(archivo)
              .then(resp => {
                if (resp.ok) return cache.put(archivo, resp);
                else console.warn(`[SW] Archivo no encontrado (status ${resp.status}):`, archivo);
              })
              .catch(err => console.warn('[SW] Error al intentar cachear:', archivo, err.message));
          })
        );
        const promExternos = Promise.allSettled(
          RECURSOS_EXTERNOS.map(url => fetch(url).then(resp => { if (resp.ok) return cache.put(url, resp); }).catch(() => {}))
        );
        return Promise.all([promLocales, promExternos]);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVAR
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys()
      .then((nombresCache) => {
        return Promise.all(
          nombresCache
            .filter((nombre) => nombre !== CACHE_NAME && nombre !== IMAGES_CACHE_NAME)
            .map((nombre) => {
              console.log('[SW] Borrando caché vieja:', nombre);
              return caches.delete(nombre);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completa, cache:', CACHE_NAME);
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ★★★ NUEVA VALLA ★★★
  // ─── NO interceptar la app de tiendas (tiene su propio SW) ───
  if (url.pathname.includes('/app-tiendas/')) {
    return; // Dejamos que la petición vaya a la red directamente sin pasar por este SW
  }

  // ─── NO cachear peticiones a nuestra API ───
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.method === 'GET') {
            const clon = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clon));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || new Response(
              JSON.stringify({ success: false, error: 'Sin conexión' }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // ─── NO cachear peticiones al Google Apps Script ───
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: 'Sin conexión' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // ─── NO cachear peticiones POST ───
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // ★ ESTRATEGIA DEDICADA PARA IMÁGENES DE GITHUB
  if (url.hostname.includes('githubusercontent.com') && 
     (url.pathname.includes('.jpg') || url.pathname.includes('.png') || url.pathname.includes('.webp'))) {
    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            fetch(request).then(networkResponse => {
              if (networkResponse && networkResponse.ok) cache.put(request, networkResponse);
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // ─── CACHE FIRST para todo lo demás ───
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse));
              }
              return networkResponse;
            })
            .catch(() => null);
          return cached;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clon = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clon));
            }
            return networkResponse;
          })
          .catch(() => {
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/domidelis/index.html'); // Este solo aplica si falla el index principal
            }
            return new Response('', { status: 408 });
          });
      })
  );
});

// ============================================
// PUSH Y CLICK (Quedan igual)
// ============================================
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'DOMIDELIS', body: 'Nueva notificación' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'DOMIDELIS', {
      body: data.body || 'Nueva notificación',
      icon: data.icon || '/domidelis/assets/img/icon-192x192.png',
      badge: data.badge || '/domidelis/assets/img/icon-192x192.png',
      tag: data.tag || 'domidelis-push',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      data: { url: data.url || '/', pedidoId: data.pedidoId || null, tipo: data.tipo || 'general' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
  );
});