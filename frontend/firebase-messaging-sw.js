// ============================================
// firebase-messaging-sw.js — PWA + FCM Unificado
// ★ v2.1 — TEMA 1 + TEMA 2:
//   - CACHE_NAME v2.0 → v2.1 (purga la basura del ?v= viejo
//     y dispara la actualización en usuarios con la app instalada)
//   - ARCHIVOS_ESTATICOS ampliado: domi-back.js, catalogo-fresco.js,
//     catalogo.json (salvavidas offline) + CSS/JS que faltaban
//   - IMAGES_CACHE_NAME se mantiene en v2.0 (conserva las imágenes)
// ============================================

// 1. Inicialización de Firebase (Compatibilidad en SW)
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

// Manejador de notificaciones FCM en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje recibido en segundo plano:', payload);
  const notificationTitle = payload.notification?.title || 'DOMIDELIS';
  const notificationOptions = {
    body: payload.notification?.body || 'Actualización de tu pedido',
    icon: '/assets/img/icon-192x192.png',
    badge: '/assets/img/icon-192x192.png',
    tag: payload.data?.tag || 'domidelis-push',
    requireInteraction: true,
    data: payload.data
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. Estrategia PWA: Cache First + Network Fallback
const isDev = false;
// ★ v2.1 — TOQUE 1: versión subida (era v2.0). Al activarse, el SW borra
//   todo caché que no sea este nombre ni el de imágenes: se lleva puesta
//   la basura acumulada por el truco viejo del ?v= (una copia del catálogo
//   por visita) y obliga a re-precachear la lista nueva de archivos.
const CACHE_NAME = isDev ? 'dev-' + Date.now() : 'domidelis-v2.1';
// ★ v2.1 — imágenes SIN tocar (v2.0): se conservan entre versiones.
const IMAGES_CACHE_NAME = 'domidelis-img-cache-v2.0';

// ★ v2.1 — TOQUE 2: lista ampliada. Antes solo estaban unos pocos archivos:
//   el resto se cacheaba "al vuelo" tras la primera visita online, así que
//   abrir offline DESDE LA PRIMERA VEZ dejaba la app a medias (sin botón
//   atrás, sin modal, sin buscador, sin estilos del home...).
//   Ahora el SW guarda por adelantado todo lo que index.html carga.
const ARCHIVOS_ESTATICOS = [
  '/',
  '/index.html',
  '/login.html',
  '/checkout.html',
  '/confirmacion.html',
  '/admin.html',
  '/domiciliario.html',
  '/manifest.json',
  // CSS del catálogo (index.html) — ★ v2.1: faltaban
  '/assets/css/styles.css',
  '/assets/css/home.css',
  '/assets/css/cart.css',
  '/assets/css/modal-personalizacion.css',
  '/assets/css/product-card.css',
  '/assets/css/buscador.css',
  '/assets/css/domidelis-intro.css',
  '/assets/css/anuncios.css',
  '/assets/css/offline-game.css',
  // JS base del catálogo (index.html) — ★ v2.1: faltaban
  '/assets/js/config.js',
  '/assets/js/components/toast.js',
  '/assets/js/paginator.js',
  '/assets/js/client.js',
  '/assets/js/cliente/categorias-dinamicas.js',
  '/assets/js/tienda-oculto.js',
  '/assets/js/cart-empty-cta.js',
  '/assets/js/buscador.js',
  '/assets/js/anuncios.js',
  '/assets/js/modal-personalizacion.js',
  '/assets/js/offline-game.js',
  // ★ v2.1 — TEMA 1: botón atrás
  '/assets/js/cliente/domi-back.js',
  // ★ v2.1 — TEMA 2: catálogo fresco + refresco al reabrir
  '/assets/js/cliente/catalogo-fresco.js',
  // ★ v2.1 — TEMA 2: salvavidas offline total.
  '/data/catalogo.json',
  // Otras páginas (como ya estaba)
  '/assets/js/checkout.js',
  '/assets/js/confirmacion.js',
  '/assets/js/domiciliario.js',
  '/assets/js/informe-financiero.js',
  '/assets/js/notificaciones.js',
  '/assets/js/auth-guard.js',
  '/assets/img/icon-192x192.png',
  '/assets/img/icon-512x512.png'
];


const RECURSOS_EXTERNOS = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.socket.io/4.6.1/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// INSTALAR
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
                if (resp.status === 200) return cache.put(archivo, resp);
                else console.warn(`[SW] Archivo no encontrado (status ${resp.status}):`, archivo);
              })
              .catch(err => console.warn('[SW] Error al intentar cachear:', archivo, err.message));
          })
        );
        const promExternos = Promise.allSettled(
          RECURSOS_EXTERNOS.map(url => fetch(url).then(resp => {
            if (resp.status === 200) return cache.put(url, resp);
          }).catch(() => {}))
        );
        return Promise.all([promLocales, promExternos]);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting();
      })
  );
});

// ACTIVAR
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

// FETCH
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NO interceptar la app de tiendas
  if (url.pathname.includes('/app-tiendas/')) {
    return;
  }

  // NO cachear peticiones a nuestra API
  // ★ v2.1 — NOTA: esta rama YA cubre /api/catalogo sin cambios:
  //   red primero → guarda copia → si no hay red sirve la última copia.
  //   Es exactamente lo que el Tema 2 necesita.
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && request.method === 'GET') {
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

  // NO cachear peticiones al Google Apps Script
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

  // NO cachear peticiones POST
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // ESTRATEGIA DEDICADA PARA IMÁGENES DE GITHUB
  if (url.hostname.includes('githubusercontent.com') &&
     (url.pathname.includes('.jpg') || url.pathname.includes('.png') || url.pathname.includes('.webp'))) {
    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          if (cachedResponse) {
            fetch(request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) cache.put(request, networkResponse);
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // CACHE FIRST para todo lo demás
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse));
              }
              return networkResponse;
            })
            .catch(() => null);
          return cached;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clon = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clon));
            }
            return networkResponse;
          })
          .catch(() => {
            if (request.headers.get('accept')?.includes('text/html')) {
              // ★ NOTA: Cambiado de '/domidelis/index.html' a '/index.html' para alinearse con tus archivos estáticos
              return caches.match('/index.html');
            }
            return new Response('', { status: 408 });
          });
      })
  );
});

// EVENTO DE CLIC EN NOTIFICACIÓN
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