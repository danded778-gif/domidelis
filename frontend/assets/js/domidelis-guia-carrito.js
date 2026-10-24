
/* ==========================================================
   DOMIDELIS - GUIA VISUAL DEL CARRITO
   Archivo independiente: domidelis-guia-carrito.js
   Resalta el carrito existente sin reemplazar client.js.
   ========================================================== */

(() => {
    'use strict';

    const ESTILO_ID = 'domidelis-guia-carrito-estilos';
    const HALO_ID = 'domidelis-carrito-halo';
    const MENSAJE_ID = 'domidelis-carrito-mensaje';
    const CLAVE_VISTA = 'domidelis_guia_carrito_v1_vista';

    function iniciarGuiaCarrito() {
        const carrito = document.querySelector('#header-cart');
        const listaCarrito = document.querySelector('#cart-items');

        // Si los elementos no existen, no interferimos con la aplicación.
        if (!carrito || !listaCarrito) return;

        // Evitar inicializar dos veces.
        if (document.getElementById(HALO_ID)) return;

        const estilos = document.createElement('style');
        estilos.id = ESTILO_ID;

        estilos.textContent = `
            #${HALO_ID} {
                position: fixed;
                z-index: 99998;
                pointer-events: none;
                border: 3px solid #E63946;
                border-radius: 50%;
                box-shadow:
                    0 0 0 7px rgba(230,57,70,.22),
                    0 0 24px rgba(230,57,70,.55);
                animation: domidelisPulso 1.2s ease-in-out infinite;
                display: none;
            }

            #${HALO_ID}.activo {
                display: block;
            }

            #${HALO_ID}::after {
                content: '☝️';
                position: absolute;
                right: -12px;
                bottom: -29px;
                font-size: 29px;
                filter: drop-shadow(0 2px 3px rgba(0,0,0,.25));
                animation: domidelisDedo 0.7s ease-in-out infinite alternate;
            }

            #${MENSAJE_ID} {
                position: fixed;
                z-index: 99999;
                width: max-content;
                max-width: min(270px, calc(100vw - 24px));
                padding: 12px 14px;
                border-radius: 12px;
                background: #fff;
                color: #252525;
                border: 1px solid rgba(230,57,70,.2);
                box-shadow: 0 8px 28px rgba(0,0,0,.2);
                font: 600 13px/1.45 system-ui, sans-serif;
                text-align: center;
                display: none;
            }

            #${MENSAJE_ID}.activo {
                display: block;
            }

            #${MENSAJE_ID} button {
                display: block;
                margin: 9px auto 0;
                padding: 7px 13px;
                border: 0;
                border-radius: 8px;
                background: #E63946;
                color: #fff;
                font: 600 12px system-ui, sans-serif;
                cursor: pointer;
            }

            @keyframes domidelisPulso {
                0%, 100% { transform: scale(.94); }
                50% { transform: scale(1.08); }
            }

            @keyframes domidelisDedo {
                from { transform: translateY(0); }
                to { transform: translateY(-5px); }
            }

            @media (prefers-reduced-motion: reduce) {
                #${HALO_ID},
                #${HALO_ID}::after {
                    animation: none;
                }
            }
        `;

        document.head.appendChild(estilos);

        const halo = document.createElement('div');
        halo.id = HALO_ID;
        document.body.appendChild(halo);

        const mensaje = document.createElement('div');
        mensaje.id = MENSAJE_ID;
        mensaje.appendChild(
            document.createTextNode(
                '¡Producto agregado! ☝️ Mira el carrito en la parte superior.'
            )
        );

        const botonCerrar = document.createElement('button');
        botonCerrar.type = 'button';
        botonCerrar.textContent = 'Entendido';
        mensaje.appendChild(botonCerrar);
        document.body.appendChild(mensaje);

        let guiaActiva = false;
        let temporizador = null;

        function posicionarGuia() {
            if (!guiaActiva || !carrito.isConnected) return;

            const rect = carrito.getBoundingClientRect();

            halo.style.left = Math.max(2, rect.left - 7) + 'px';
            halo.style.top = Math.max(2, rect.top - 7) + 'px';
            halo.style.width = Math.max(36, rect.width + 14) + 'px';
            halo.style.height = Math.max(36, rect.height + 14) + 'px';

            // Mantener el mensaje dentro de la pantalla.
            const anchoMensaje = Math.min(270, window.innerWidth - 24);
            let izquierda = rect.right - anchoMensaje;
            izquierda = Math.max(12, Math.min(
                izquierda,
                window.innerWidth - anchoMensaje - 12
            ));

            let arriba = rect.bottom + 20;

            if (arriba + 100 > window.innerHeight) {
                arriba = Math.max(12, rect.top - 105);
            }

            mensaje.style.left = izquierda + 'px';
            mensaje.style.top = arriba + 'px';
        }

        function ocultarGuia() {
            guiaActiva = false;
            halo.classList.remove('activo');
            mensaje.classList.remove('activo');

            if (temporizador) {
                clearTimeout(temporizador);
                temporizador = null;
            }
        }

        function mostrarGuia() {
            if (guiaActiva) {
                posicionarGuia();
                return;
            }

            // Mostrar una sola vez por pestaña/sesión.
            try {
                if (localStorage.getItem(CLAVE_VISTA) === '1') return;
            } catch (_) {}

            guiaActiva = true;
            halo.classList.add('activo');
            mensaje.classList.add('activo');
            posicionarGuia();

            // Desaparece automáticamente después de unos segundos.
            temporizador = setTimeout(ocultarGuia, 8000);
        }

        botonCerrar.addEventListener('click', () => {
            try {
                localStorage.setItem(CLAVE_VISTA, '1');
            } catch (_) {}
            ocultarGuia();
        });

        // Al tocar el carrito, desaparece la guía.
        // El evento original del carrito sigue funcionando.
        carrito.addEventListener('click', () => {
            if (guiaActiva) {
                try {
                    localStorage.setItem(CLAVE_VISTA, '1');
                } catch (_) {}
            }
            ocultarGuia();
        }, true);

        window.addEventListener('resize', posicionarGuia, {
            passive: true
        });

        window.addEventListener('scroll', posicionarGuia, {
            passive: true,
            capture: true
        });

        // Detectar cambios en el contenido del carrito sin modificar
        // la función que agrega productos.
        let estadoAnterior = listaCarrito.innerHTML;

        const observador = new MutationObserver(() => {
            const estadoNuevo = listaCarrito.innerHTML;
            const tieneProductos = listaCarrito.children.length > 0;

            if (tieneProductos && estadoNuevo !== estadoAnterior) {
                mostrarGuia();
            }

            estadoAnterior = estadoNuevo;
        });

        observador.observe(listaCarrito, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            iniciarGuiaCarrito,
            { once: true }
        );
    } else {
        iniciarGuiaCarrito();
    }
})();
