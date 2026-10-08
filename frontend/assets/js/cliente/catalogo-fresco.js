/* ============================================
   catalogo-fresco.js — Tema 2: catálogo fresco
   Ubicación: /frontend/assets/js/cliente/catalogo-fresco.js
   ★ Se incluye en index.html (después de client.js)

   ★ QUÉ HACE
   - obtenerCatalogo(): 1º backend Railway (datos de Sheets), y si
     está dormido/caído → 2º JSON local (salvavidas).
   - Refresco silencioso al REABRIR la app (Android congela la PWA
     en vez de cerrarla): re-pregunta al backend y SOLO repinta si
     el catálogo cambió de verdad.

   ★ REGLAS
   - No pinta nada por sí mismo: solo actualiza las variables
     globales del catálogo (tiendas, productosGlobal,
     complementosGlobal) y llama a las funciones de client.js.
   - Si nada cambió: cero parpadeos, cero re-barajados, scroll intacto.
   - Al repintar usa las funciones normales de client.js, que avisan
     a DomiBack con replaceState → la pila del botón atrás NO se ensucia.
   ============================================ */

(function () {
    'use strict';

    if (window.CatalogoFresco) return; // protección anti-doble-carga

    let ultimoCatalogoRaw = null;        // último texto recibido (para comparar)
    let refrescando = false;             // evita refrescos simultáneos
    let momentoOcultado = 0;
    const UMBRAL_REFRESCO_MS = 30_000;   // reabrió tras 30s+ oculta → re-preguntar
    const TIMEOUT_FETCH_MS = 8_000;      // cold start de Railway: abortamos a los 8s

    // ─── FETCH con límite de tiempo ─────────
    function fetchConTimeout(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_FETCH_MS);
        return fetch(url, { cache: 'no-store', signal: controller.signal })
            .finally(() => clearTimeout(timer));
    }

    // ─── Carga inicial: backend → salvavidas ─
    async function obtenerCatalogo() {
        try {
            const res = await fetchConTimeout(CATALOGO_URL);
            if (res.ok) {
                const raw = await res.text();
                ultimoCatalogoRaw = raw;
                return JSON.parse(raw);
            }
            console.warn('[Catálogo] Backend respondió', res.status, '→ usando copia local');
        } catch (e) {
            console.warn('[Catálogo] Backend inaccesible → usando copia local');
        }

        const resLocal = await fetch(CATALOGO_FALLBACK_URL);
        if (!resLocal.ok) throw new Error('Error en la red');
        const raw = await resLocal.text();
        ultimoCatalogoRaw = raw;
        return JSON.parse(raw);
    }

    // ─── ¿Qué pantalla está pintada ahora? ──
    // Detección por DOM (mismo patrón que usa domi-back):
    // .back-button dentro de stores-grid = menú de una tienda.
    function vistaActualCatalogo() {
        const storesGrid = document.getElementById('stores-grid');
        if (!storesGrid) return null;
        if (storesGrid.querySelector('.back-button')) {
            return {
                vista: 'tienda',
                id: (typeof currentStoreProducts !== 'undefined' && currentStoreProducts.length)
                    ? currentStoreProducts[0].tiendaId : null
            };
        }
        const catGrid = document.getElementById('categoria-productos-grid');
        if (catGrid && catGrid.style.display === 'block') return { vista: 'categoria' };
        return { vista: 'principal' };
    }

    // ─── Refresco silencioso al reabrir ──────
    async function refrescarAlVolver() {
        if (refrescando) return;
        if (!document.getElementById('stores-grid')) return; // solo en index.html
        refrescando = true;
        try {
            // ★ Solo el backend: si falla NO bajamos al salvavidas local
            //   (serían datos más VIEJOS que los ya pintados en pantalla)
            const res = await fetchConTimeout(CATALOGO_URL);
            if (!res.ok) return;
            const raw = await res.text();

            // ★ Nada cambió → no tocamos la pantalla
            if (raw === ultimoCatalogoRaw) return;

            ultimoCatalogoRaw = raw;
            const data = JSON.parse(raw);
            tiendas = data.tiendas || [];
            productosGlobal = data.productosGlobal || [];
            complementosGlobal = data.complementosGlobal || [];

            // Repintar SOLO la pantalla que estaba viendo el usuario
            const vista = vistaActualCatalogo();
            if (!vista) return;

            if (vista.vista === 'tienda' && vista.id) {
                verMenuTienda(vista.id);
            } else if (vista.vista === 'categoria' && typeof categoriaActiva !== 'undefined' && categoriaActiva !== 'Todas') {
                mostrarProductosPorCategoria();
            } else {
                volverATiendas();
                renderizarTiendas();
                // ★ A diferencia del "atrás" (v4.9.1), aquí la vitrina SÍ se
                // re-pinta: los datos cambiaron y los precios de la vitrina
                // deben actualizarse también.
                renderizarProductosDestacados();
            }
        } catch (e) {
            console.warn('[Refresco] Sin conexión — se conservan los datos actuales');
        } finally {
            refrescando = false;
        }
    }

    // ─── Detectores de reapertura ───────────
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            momentoOcultado = Date.now();
        } else if (momentoOcultado && Date.now() - momentoOcultado >= UMBRAL_REFRESCO_MS) {
            refrescarAlVolver();
        }
    });

    // Restaurado desde BFCache (atrás/adelante del navegador)
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) refrescarAlVolver();
    });

    // ─── API pública (la usa client.js en cargarTiendas) ───
    window.CatalogoFresco = { obtenerCatalogo };

})();