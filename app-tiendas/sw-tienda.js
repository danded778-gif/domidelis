self.addEventListener('fetch', e => {
  // Ignorar peticiones POST, PUT, DELETE (solo cachear GET)
  if (e.request.method !== 'GET') return;

  // Si es una petición a la API, ir siempre a la red primero (Network First)
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(networkResponse => {
          // Si la respuesta es OK, la clonamos y la guardamos en caché por si se queda sin internet luego
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si no hay internet, intentamos sacar la respuesta de la caché como plan B
          return caches.match(e.request);
        })
    );
  } else {
    // Si son archivos estáticos (HTML, CSS, JS), usar caché primero (Cache First)
    e.respondWith(
      caches.match(e.request)
        .then(response => {
          return response || fetch(e.request);
        })
    );
  }
});