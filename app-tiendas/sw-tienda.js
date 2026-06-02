// ============================================
// sw-tienda.js — PWA Tienda (Aislada)
// ============================================

const CACHE_NAME = 'tienda-cache-v1';

// Archivos estáticos de la tienda para cachear al instalar
const ARCHIVOS_ESTATICOS_TIENDA = [
  './',
  './index-tienda.html',
  './login-tienda.html',
  './manifest-tienda.json',
  './assets/css/tiendas.css',
  './assets/js/config-tienda.js',
  './assets/js/tiendas.js',
  './assets/img/icon-192x192.png',
  './assets/img/icon-512x512.png'
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
        // Usamos Promise.allSettled por si algún archivo falla, no rompa toda la instalación
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
          // Si la API responde bien, la guardamos en caché por si se queda sin internet luego
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si no hay internet, intentamos la caché
          return caches.match(e.request).then(cachedResponse => {
            // Si no está en caché, devolvemos un error genérico seguro (esto evita el TypeError)
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

        // No está en caché, vamos a la red
        return fetch(e.request)
          .then(networkResponse => {
            // Si lo trae de la red, lo guardamos para la próxima vez
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback final si se cae la red y no está en caché
            // Si es una página HTML, intentamos mostrar el index de la tienda
            if (e.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index-tienda.html');
            }
            // Si es una imagen u otro recurso, simplemente fallamos sin crashear
            return new Response('', { status: 408 });
          });
      })
  );
});