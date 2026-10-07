/* ============================================
   domi-back.js — Botón atrás / gesto "volver" de la PWA
   Ubicación: /frontend/assets/js/cliente/domi-back.js
   ★ Solo se incluye en index.html

   ★ QUÉ HACE
   - Convierte el botón atrás de Android y el gesto de borde
     de iOS en navegación real dentro del catálogo.
   - PANTALLAS (principal / categoría / tienda): cada una es
     una entrada del historial del navegador.
   - CAPAS (carrito, buscador móvil, modal de producto, modal
     de envío, menú hamburguesa): comparten UNA sola entrada
     de historial ("el guardián") y una pila privada interna.

   ★ CÓMO SE USA (los demás archivos solo AVISAN):
   - DomiBack.navegar('tienda', { id })   → al cambiar de pantalla
   - DomiBack.capaAbierta('carrito')      → al abrir una capa
   - DomiBack.capaCerrada('carrito')      → al cerrar una capa
   - DomiBack.atras()                     → botón "Volver" visible

   ★ REGLAS
   - Este módulo NO pinta nada: solo coordina el historial.
   - Cerrar una capa JAMÁS toca el contenido del carrito
     (eso vive en localStorage y solo lo borra vaciarCarrito()).
   ============================================ */

(function () {
    'use strict';

    if (window.DomiBack) return; // protección anti-doble-carga

    // El scroll lo restauramos nosotros (el render es en memoria)
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // ─── ESTADO INTERNO ─────────────────────
    let capas = [];                  // pila privada de capas abiertas (de abajo hacia arriba)
    const registros = {};            // nombre → { estaAbierta(), cerrar() }
    let cima = { tipo: 'pantalla', vista: 'principal' }; // espejo de la entrada actual del historial
    let enPop = false;               // true mientras atendemos un popstate
    let backAuto = false;            // el popstate que llega fue provocado por nosotros
    let guardiaPendiente = false;    // hay un guardián por quitar (diferido)
    let timerQuitar = null;

    // ─── HELPERS ────────────────────────────
    function entradaPantalla(vista, params, scroll) {
        return { tipo: 'pantalla', vista: vista, params: params || {}, scroll: scroll || 0 };
    }

    function interpretar(state) {
        if (state && state.tipo === 'guardia') return { tipo: 'guardia' };
        if (state && state.tipo === 'pantalla') return state;
        return entradaPantalla('principal', {}, 0);
    }

    // Guarda el scroll actual DENTRO de la entrada de pantalla vigente
    // (para restaurarlo exactamente ahí al volver atrás)
    function guardarScrollActual() {
        const st = history.state;
        if (st && st.tipo === 'pantalla') {
            history.replaceState(entradaPantalla(st.vista, st.params, window.scrollY), '');
        }
    }

    function cancelarQuitarPendiente() {
        guardiaPendiente = false;
        if (timerQuitar) { clearTimeout(timerQuitar); timerQuitar = null; }
    }

    // Quita del historial la entrada guardián sobrante: ocurre cuando la última
    // capa se cerró con su propio botón (la X, "Entendido", etc.). Sin esto,
    // el próximo "atrás" sería muerto (no haría nada visible).
    function quitarGuardia() {
        timerQuitar = null;
        if (!guardiaPendiente) return;
        guardiaPendiente = false;
        if (cima.tipo === 'guardia' && capas.length === 0) {
            backAuto = true;
            history.back();
        }
    }

    // ─── API: CAPAS ─────────────────────────
    function registrarCapa(nombre, registro) {
        registros[nombre] = registro;
    }

    function capaAbierta(nombre) {
        if (!registros[nombre]) return;
        if (capas.some(c => c.nombre === nombre)) return; // ya estaba abierta

        capas.push({ nombre: nombre });

        // Solo la PRIMERA capa encendida crea la entrada guardián.
        // Las siguientes solo se apilan aquí, en la pila privada.
        if (cima.tipo !== 'guardia') {
            guardarScrollActual();
            history.pushState({ tipo: 'guardia' }, '');
            cima = { tipo: 'guardia' };
        }
    }

    function capaCerrada(nombre) {
        const i = capas.findIndex(c => c.nombre === nombre);
        if (i !== -1) capas.splice(i, 1);

        // ¿Era la última? El guardián ya no tiene razón de ser.
        // Se quita EN DIFERIDO: si en el mismo instante llega una
        // navegación (buscador → producto), el guardián se
        // TRANSFORMA en pantalla en vez de quitarse. Sin huecos.
        if (capas.length === 0 && cima.tipo === 'guardia' && !enPop) {
            guardiaPendiente = true;
            if (timerQuitar) clearTimeout(timerQuitar);
            timerQuitar = setTimeout(quitarGuardia, 0);
        }
    }

    // ─── API: PANTALLAS ─────────────────────
    function navegar(vista, params) {
        if (enPop) return; // llegamos aquí POR un atrás: la entrada ya existe
        params = params || {};

        // 1) Misma pantalla y mismos parámetros → reemplazar
        //    (evita entradas duplicadas = "atrás muertos")
        if (cima.tipo === 'pantalla' && cima.vista === vista &&
            JSON.stringify(cima.params || {}) === JSON.stringify(params)) {
            history.replaceState(entradaPantalla(vista, params, window.scrollY), '');
            cima = interpretar(history.state);
            return;
        }

        // 2) Hay guardián arriba (capas recién cerradas o aún abiertas):
        //    el guardián SE TRANSFORMA en la pantalla nueva
        if (cima.tipo === 'guardia') {
            while (capas.length) {
                const capa = capas.pop();
                try {
                    const reg = registros[capa.nombre];
                    if (reg && typeof reg.cerrar === 'function') reg.cerrar();
                } catch (e) { /* cierre defensivo */ }
            }
            cancelarQuitarPendiente();
            history.replaceState(entradaPantalla(vista, params, 0), '');
            cima = interpretar(history.state);
            return;
        }

        // 3) Navegación normal: guardar scroll de la pantalla que dejo + apilar
        guardarScrollActual();
        history.pushState(entradaPantalla(vista, params, 0), '');
        cima = interpretar(history.state);
    }

    // ─── API: BOTÓN VISIBLE "VOLVER" ────────
    function atras() {
        history.back(); // pasa por el MISMO camino que el botón físico
    }

    // ─── POPSTATE: llegó un "atrás" (o "adelante") ───
    window.addEventListener('popstate', function (e) {
        const destino = interpretar(e.state);

        // A) Back provocado por nosotros (limpieza del guardián) → silencio
        if (backAuto) {
            backAuto = false;
            cima = destino;
            return;
        }

        // B) El atrás consumió la entrada guardián
        if (cima.tipo === 'guardia') {
            if (capas.length > 0) {
                // Cerrar la capa de arriba (la última que se abrió)
                const capa = capas.pop();
                try {
                    const reg = registros[capa.nombre];
                    if (reg && typeof reg.cerrar === 'function') reg.cerrar();
                } catch (err) { }
                const i = capas.findIndex(c => c.nombre === capa.nombre);
                if (i !== -1) capas.splice(i, 1); // blindaje si no avisó

                if (capas.length > 0) {
                    // Quedan capas: re-armar el guardián para el próximo atrás
                    history.pushState({ tipo: 'guardia' }, '');
                    cima = { tipo: 'guardia' };
                } else {
                    cima = destino; // la pantalla de abajo sigue pintada: no se toca
                }
            } else {
                cima = destino; // guardián fantasma: atrás silencioso
            }
            return;
        }

        // C) Atrás/adelante entre pantallas → renderizar el destino
        cima = destino;
        if (destino.tipo === 'guardia') return; // "adelante" hacia un guardián muerto: ignorar
        if (typeof window.renderDesdeAtras === 'function') {
            enPop = true;
            try {
                window.renderDesdeAtras(destino.vista, destino.params || {}, destino.scroll || 0);
            } finally {
                enPop = false;
            }
        }
    });

    // ─── ARRANQUE ───────────────────────────
    // La entrada inicial (recarga de la app) queda marcada como pantalla principal
    history.replaceState(entradaPantalla('principal', {}, 0), '');
    cima = interpretar(history.state);

    // Registro de las capas de la app: quién es y cómo se cierra.
    // Las funciones de cierre viven en client.js, buscador.js y modal-personalizacion.js.
    document.addEventListener('DOMContentLoaded', function () {
        registrarCapa('carrito', {
            estaAbierta: function () {
                const p = document.getElementById('cart-panel');
                return !!(p && p.classList.contains('active'));
            },
            cerrar: function () { if (typeof window.cerrarCarrito === 'function') window.cerrarCarrito(); }
        });

        registrarCapa('modal-producto', {
            estaAbierta: function () {
                const o = document.getElementById('domi-modal-overlay');
                return !!(o && o.classList.contains('domi-is-open'));
            },
            cerrar: function () { if (window.DomiModal) window.DomiModal.cerrar(); }
        });

        registrarCapa('modal-envio', {
            estaAbierta: function () {
                const o = document.getElementById('modal-envio-overlay');
                return !!(o && o.classList.contains('abierto'));
            },
            cerrar: function () { if (typeof window.cerrarModalEnvioCarrito === 'function') window.cerrarModalEnvioCarrito(); }
        });

        registrarCapa('buscador', {
            estaAbierta: function () {
                const p = document.getElementById('search-panel');
                return !!(p && p.classList.contains('active'));
            },
            cerrar: function () { if (typeof window.cerrarBuscadorMovil === 'function') window.cerrarBuscadorMovil(); }
        });

        registrarCapa('menu', {
            estaAbierta: function () {
                const n = document.getElementById('nav-links');
                return !!(n && n.classList.contains('active'));
            },
            cerrar: function () { if (typeof window.cerrarMenuHamburguesa === 'function') window.cerrarMenuHamburguesa(); }
        });
    });

    // ─── EXPOSICIÓN PÚBLICA ─────────────────
    window.DomiBack = {
        registrarCapa: registrarCapa,
        capaAbierta: capaAbierta,
        capaCerrada: capaCerrada,
        navegar: navegar,
        atras: atras
    };
})();