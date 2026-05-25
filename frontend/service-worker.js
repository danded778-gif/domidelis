// ============================================
// service-worker.js — PWA Completa
// Estrategia: Cache First + Network Fallback
// ============================================

const isDev = false;
const CACHE_NAME = isDev
    ? 'dev-' + Date.now() 
    : 'soluvencon-v1.6.6'; 

// ★ NUEVO: Baúl exclusivo para imágenes que NO se borrará con las actualizaciones de la app
const IMAGES_CACHE_NAME = 'soluvencon-img-cache-v1'; 

// Archivos que se cachean al instalar
const ARCHIVOS_ESTATICOS = [
  '/domidelis/',
  '/domidelis/index.html',
  '/domidelis/login.html',
  '/domidelis/checkout.html',
  '/domidelis/confirmacion.html',
  '/domidelis/admin.html',
  '/domidelis/domiciliario.html',
  '/domidelis/manifest.json',
  '/domidelis/assets/css/styles.css',
  '/domidelis/assets/js/config.js',
  '/domidelis/assets/js/client.js',
  '/domidelis/assets/js/checkout.js',
  '/domidelis/assets/js/admin.js',
  '/domidelis/assets/js/domiciliario.js',
  '/domidelis/assets/js/informe-financiero.js',
  '/domidelis/assets/js/notificaciones.js',
  '/domidelis/assets/js/push-manager.js',
  '/domidelis/assets/js/auth-guard.js',
  '/domidelis/assets/img/icon-192x192.png',
  '/domidelis/assets/img/icon-512x512.png',
  '/domidelis/assets/css/offline-game.css',  
  '/domidelis/assets/js/offline-game.js'
];

// Recursos externos que también cacheamos
const RECURSOS_EXTERNOS = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.socket.io/4.6.1/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ============================================
// INSTALAR — Cachear todo lo estático
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
                if (resp.ok) {
                  return cache.put(archivo, resp);
                } else {
                  console.warn(`[SW] Archivo no encontrado (status ${resp.status}):`, archivo);
                }
              })
              .catch(err => {
                console.warn('[SW] Error al intentar cachear:', archivo, err.message);
              });
          })
        );

        const promExternos = Promise.allSettled(
          RECURSOS_EXTERNOS.map(url =>
            fetch(url).then(resp => {
              if (resp.ok) return cache.put(url, resp);
            }).catch(() => {})
          )
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
// ACTIVAR — Limpiar cachés viejas
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');

  event.waitUntil(
    caches.keys()
      .then((nombresCache) => {
        return Promise.all(
          nombresCache
            // ★ NUEVO: NO borrar la caché de imágenes cuando actualices la app
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
// FETCH — Estrategia inteligente
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

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

  // ★ NUEVO: ESTRATEGIA DEDICADA PARA IMÁGENES DE GITHUB (Vital para 3G)
  // Interceptamos las fotos de los productos antes de que pasen al bloque genérico
  if (url.hostname.includes('githubusercontent.com') && 
     (url.pathname.includes('.jpg') || url.pathname.includes('.png') || url.pathname.includes('.webp'))) {
    
    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            // ¡Ya la tenemos en el celular! La mostramos al instante
            // Y de fondo, vamos a GitHub a buscar si hay una nueva (por si cambiaste la foto)
            fetch(request).then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse);
              }
            }).catch(() => {}); // Silenciar error si no hay red
            
            return cachedResponse; // Entrega instantánea
          }

          // No está en caché (primera vez) → Vamos a GitHub
          return fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              // La guardamos en el baúl de imágenes para toda la vida
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return; // Detenemos la ejecución para que no pase al bloque de abajo
  }

  // ─── CACHE FIRST para todo lo demás (HTML, CSS, JS, fuentes) ───
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          // Actualizar caché en segundo plano
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, networkResponse);
                });
              }
              return networkResponse;
            })
            .catch(() => null);

          return cached;
        }

        // No está en caché → ir a la red
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clon = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, clon);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html');
            }
            return new Response('', { status: 408 });
          });
      })
  );
});

// ============================================
// PUSH Y CLICK EN NOTIFICACIÓN (Quedan igual)
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido');
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'SOLUVENCON', body: 'Nueva notificación' }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SOLUVENCON', {
      body: data.body || 'Nueva notificación',
      icon: data.icon || '/domidelis/assets/img/icon-192x192.png',
      badge: data.badge || '/domidelis/assets/img/icon-192x192.png',
      tag: data.tag || 'soluvencon-push',
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