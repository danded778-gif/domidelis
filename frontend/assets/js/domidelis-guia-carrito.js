/* ==========================================================
   DOMIDELIS - GUIAS VISUALES (VERSION UNICA)
   Recorrido inicial + guia dedicada del chat de DOMI IA +
   guia del carrito. Todo vive en este archivo: no hay
   version 1 ni version 2 de nada.

   Comportamiento :
   1. UN solo recorrido: categorias -> destacados -> tiendas
      -> DOMI IA. Arranque rapido: sale con la PRIMERA
      interaccion (scroll o toque) en cuanto el catalogo esta
      listo y ningun banner de instalacion este visible.
   2. Nada cierra el recorrido sin querer: tocar categorias,
      productos o tiendas NO lo cierra. Solo "Saltar",
      "Terminar" o la tecla ESC lo cierran.
   3. Si se abre CUALQUIER cosa (carrito, buscador, menu
      movil, chat de DOMI IA) el recorrido NO se acaba: se
      OCULTA y sigue donde iba al cerrarse eso mismo.
   4. Si el usuario entra a una categoria o a una tienda (o
      cualquier vista que esconda el inicio), el recorrido
      tambien se oculta y guarda el paso en que iba: al
      volver al inicio aparece otra vez en el mismo paso.
   5. GUIA DEDICADA DEL CHAT (el mensajito con "Entendido"):
      aparece CADA VEZ que el usuario abre el chat de DOMI IA,
      mientras el chat este abierto. Desaparece al pulsar
      "Entendido" (o a los 12 segundos) y despues ya no vuelve.
      Nunca se marca como vista solo por abrir el chat.
   6. IDs de DOMI IA centralizados en las constantes
      SELECTOR_IA_* de abajo: si tu IA usa otros IDs,
      cambialos ahi y todo se ajusta solo.
   ========================================================== */

(() => {
    'use strict';

    // ---------- Identificadores y claves ----------
    const ESTILO_ID = 'domidelis-guia-carrito-estilos';
    const HALO_ID = 'domidelis-carrito-halo';
    const MENSAJE_ID = 'domidelis-carrito-mensaje';
    const RECORRIDO_HALO_ID = 'domidelis-recorrido-halo';
    const RECORRIDO_CARD_ID = 'domidelis-recorrido-card';

    const CLAVE_VISTA = 'domidelis_guia_carrito_v1_vista';
    // ★ Clave nueva (v2): el mensajito del chat vuelve a salir
    // para todos, tambien para quien lo marco como visto en
    // pruebas anteriores sin haberlo visto de verdad.
    const CLAVE_VISTA_IA = 'domidelis_guia_ia_v2_vista';
    const CLAVE_RECORRIDO = 'domidelis_recorrido_inicio_v2_visto';
    // Paso en curso: sobrevive a los cambios de pagina de la
    // misma pestana (entrada a tienda/categoria y regreso).
    const CLAVE_RECORRIDO_PASO = 'domidelis_recorrido_paso';

    const DURACION_GUIA_CARRITO = 8000;
    const DURACION_GUIA_IA = 12000;

    const TEXTO_GUIA_CARRITO =
        '¡Producto agregado! ☝️ Mira el carrito en la parte superior.';
    const TEXTO_GUIA_IA =
        'Este es DOMI IA. Pídele lo que necesitas: recomendaciones, armar tu pedido o resolver tus dudas.';

    // ★ DOMI IA — IDs centralizados. Si tu boton o panel usan
    // otros IDs, cambia SOLO estas tres constantes.
    const SELECTOR_IA_FLOTANTE = '#ia-float';
    const SELECTOR_IA_PANEL = '#ia-panel';
    const SELECTOR_IA_OVERLAY = '#ia-overlay';

    // Capas que pausan las guias al abrirse. El menu movil
    // (header .nav-links) tambien: lo tapa todo.
    const SELECTORES_CAPAS = [
        ['#cart-panel', 'active'],
        ['#cart-overlay', 'active'],
        ['#search-panel', 'active'],
        ['#search-overlay', 'active'],
        ['#header-search-dropdown', 'active'],
        ['header .nav-links', 'active'],
        [SELECTOR_IA_PANEL, 'abierta'],
        [SELECTOR_IA_OVERLAY, 'visible']
    ];

    // Espera a que un elemento inyectado por otro script
    // aparezca en el DOM. Entrega el elemento por callback;
    // si no llega a tiempo, entrega null y no interfiere.
    function esperarElemento(selector, callback, tiempoMax = 3500) {
        const directo = document.querySelector(selector);
        if (directo) {
            callback(directo);
            return;
        }
        const plazo = setTimeout(() => {
            observador.disconnect();
            callback(null);
        }, tiempoMax);
        const observador = new MutationObserver(() => {
            const elemento = document.querySelector(selector);
            if (!elemento) return;
            clearTimeout(plazo);
            observador.disconnect();
            callback(elemento);
        });
        observador.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function yaVista(clave) {
        try {
            return localStorage.getItem(clave) === '1';
        } catch (_) {
            return false;
        }
    }

    function guardarVista(clave) {
        try {
            localStorage.setItem(clave, '1');
        } catch (_) {}
    }

    function iniciarGuiaCarrito() {
        const carrito = document.querySelector('#header-cart');
        const listaCarrito = document.querySelector('#cart-items');

        // Evitar inicializar dos veces. Si la pagina no tiene
        // carrito, no interferimos con la aplicacion.
        if (document.getElementById(HALO_ID)) return;
        if (!carrito || !listaCarrito) return;

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

            #${RECORRIDO_HALO_ID} {
                position: fixed;
                z-index: 99997;
                display: none;
                pointer-events: none;
                border: 3px solid #E63946;
                border-radius: 14px;
                box-shadow:
                    0 0 0 6px rgba(230,57,70,.16),
                    0 0 22px rgba(230,57,70,.4);
                animation: domidelisPulso 1.2s ease-in-out infinite;
            }

            #${RECORRIDO_HALO_ID}.activo {
                display: block;
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

            #${RECORRIDO_CARD_ID} {
                position: fixed;
                z-index: 99999;
                display: none;
                width: min(320px, calc(100vw - 24px));
                padding: 14px;
                box-sizing: border-box;
                border: 1px solid rgba(230,57,70,.2);
                border-radius: 14px;
                background: #fff;
                color: #252525;
                box-shadow: 0 8px 28px rgba(0,0,0,.22);
                font: 500 13px/1.45 Poppins, sans-serif;
            }

            #${RECORRIDO_CARD_ID}.activo {
                display: block;
            }

            #${RECORRIDO_CARD_ID} .recorrido-progreso {
                display: inline-block;
                margin-bottom: 7px;
                padding: 3px 8px;
                border-radius: 20px;
                background: rgba(230,57,70,.1);
                color: #C62828;
                font-size: 11px;
                font-weight: 700;
            }

            #${RECORRIDO_CARD_ID} strong {
                display: block;
                margin-bottom: 4px;
                font-size: 14px;
            }

            #${RECORRIDO_CARD_ID} p {
                margin: 0;
            }

            #${RECORRIDO_CARD_ID} .recorrido-acciones {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-top: 12px;
            }

            #${RECORRIDO_CARD_ID} button {
                min-height: 36px;
                padding: 7px 10px;
                border: 0;
                border-radius: 8px;
                background: transparent;
                color: #5D4037;
                font: 600 12px Poppins, sans-serif;
                cursor: pointer;
            }

            #${RECORRIDO_CARD_ID} .recorrido-siguiente {
                background: #E63946;
                color: #fff;
            }

            #${RECORRIDO_CARD_ID} button:focus-visible {
                outline: 3px solid #5D4037;
                outline-offset: 2px;
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
                #${HALO_ID}::after,
                #${RECORRIDO_HALO_ID} {
                    animation: none;
                }
            }
        `;

        document.head.appendChild(estilos);

        // ---------- Elementos de interfaz ----------
        // Un solo halo y un solo mensaje compartidos: la guia
        // del carrito y la guia del chat de DOMI IA reutilizan
        // lo mismo (sin estilos ni elementos duplicados).
        const halo = document.createElement('div');
        halo.id = HALO_ID;
        document.body.appendChild(halo);

        const mensaje = document.createElement('div');
        mensaje.id = MENSAJE_ID;

        const textoGuia = document.createElement('span');
        mensaje.appendChild(textoGuia);

        const botonCerrar = document.createElement('button');
        botonCerrar.type = 'button';
        botonCerrar.textContent = 'Entendido';
        mensaje.appendChild(botonCerrar);
        document.body.appendChild(mensaje);

        const recorridoHalo = document.createElement('div');
        recorridoHalo.id = RECORRIDO_HALO_ID;
        recorridoHalo.setAttribute('aria-hidden', 'true');
        document.body.appendChild(recorridoHalo);

        const recorridoCard = document.createElement('section');
        recorridoCard.id = RECORRIDO_CARD_ID;
        recorridoCard.setAttribute('role', 'dialog');
        recorridoCard.setAttribute('aria-modal', 'false');
        recorridoCard.setAttribute('aria-live', 'polite');
        recorridoCard.setAttribute('aria-label', 'Recorrido de DOMIDELIS');

        const progreso = document.createElement('span');
        progreso.className = 'recorrido-progreso';
        recorridoCard.appendChild(progreso);

        const tituloRecorrido = document.createElement('strong');
        recorridoCard.appendChild(tituloRecorrido);

        const textoRecorrido = document.createElement('p');
        recorridoCard.appendChild(textoRecorrido);

        const accionesRecorrido = document.createElement('div');
        accionesRecorrido.className = 'recorrido-acciones';

        const botonSaltar = document.createElement('button');
        botonSaltar.type = 'button';
        botonSaltar.textContent = 'Saltar';
        accionesRecorrido.appendChild(botonSaltar);

        const navegacionRecorrido = document.createElement('div');
        const botonAnterior = document.createElement('button');
        botonAnterior.type = 'button';
        botonAnterior.textContent = 'Anterior';
        navegacionRecorrido.appendChild(botonAnterior);

        const botonSiguiente = document.createElement('button');
        botonSiguiente.type = 'button';
        botonSiguiente.className = 'recorrido-siguiente';
        botonSiguiente.textContent = 'Siguiente';
        navegacionRecorrido.appendChild(botonSiguiente);

        accionesRecorrido.appendChild(navegacionRecorrido);
        recorridoCard.appendChild(accionesRecorrido);
        document.body.appendChild(recorridoCard);

        // ---------- Estado ----------
        let guiaFlotante = null;
        let temporizador = null;
        let recorridoActivo = false;
        let recorridoSuspendido = false;
        let pasosRecorrido = [];
        let indiceRecorrido = 0;
        let esperaPaso = 0;
        let guiaCarritoPendiente = false;
        let observadorCapas = null;
        let intervaloVisibilidad = null;

        // ---------- Utilidades de estado ----------
        function leerPasoGuardado() {
            try {
                const valor = sessionStorage.getItem(CLAVE_RECORRIDO_PASO);
                if (valor === null) return null;
                const indice = parseInt(valor, 10);
                return Number.isFinite(indice) ? indice : null;
            } catch (_) {
                return null;
            }
        }

        function guardarPasoActual() {
            try {
                sessionStorage.setItem(CLAVE_RECORRIDO_PASO, String(indiceRecorrido));
            } catch (_) {}
        }

        function borrarPasoGuardado() {
            try {
                sessionStorage.removeItem(CLAVE_RECORRIDO_PASO);
            } catch (_) {}
        }

        function capaIAAbierta() {
            const panel = document.querySelector(SELECTOR_IA_PANEL);
            if (panel && panel.classList.contains('abierta')) return true;
            const overlay = document.querySelector(SELECTOR_IA_OVERLAY);
            return !!(overlay && overlay.classList.contains('visible'));
        }

        function hayCapaAbierta() {
            return SELECTORES_CAPAS.some(([selector, clase]) => {
                const elemento = document.querySelector(selector);
                return elemento && elemento.classList.contains(clase);
            });
        }

        // Capas distintas al chat de DOMI IA (carrito, buscador,
        // menu movil): tapan el mensajito del chat.
        function hayOtraCapaAbierta() {
            return SELECTORES_CAPAS.some(([selector, clase]) => {
                if (selector === SELECTOR_IA_PANEL) return false;
                if (selector === SELECTOR_IA_OVERLAY) return false;
                const elemento = document.querySelector(selector);
                return elemento && elemento.classList.contains(clase);
            });
        }

        function objetivoVisible(elemento) {
            if (!elemento || !elemento.isConnected) return false;
            const rect = elemento.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }

        // ---------- Monitoreo permanente ----------
        // Observador (respuesta inmediata al abrir/cerrar capas)
        // + intervalo liviano de respaldo que cubre capas
        // inyectadas tarde y cambios de vista (categoria/tienda)
        // que no pasan por classList. Vive todo el tiempo:
        // cuando no hay guias activas solo hace unas lecturas
        // de DOM, y gracias a eso el mensajito del chat dispara
        // aunque el usuario nunca haya hecho el recorrido.
        function iniciarMonitoreo() {
            observadorCapas = new MutationObserver(refrescarVisibilidad);
            SELECTORES_CAPAS.forEach(([selector]) => {
                const elemento = document.querySelector(selector);
                if (elemento) {
                    observadorCapas.observe(elemento, {
                        attributes: true,
                        attributeFilter: ['class']
                    });
                }
            });

            // El panel y el overlay de DOMI IA pueden inyectarse
            // despues: se observan en cuanto aparezcan.
            [SELECTOR_IA_PANEL, SELECTOR_IA_OVERLAY].forEach(selector => {
                esperarElemento(selector, elemento => {
                    if (elemento && observadorCapas) {
                        observadorCapas.observe(elemento, {
                            attributes: true,
                            attributeFilter: ['class']
                        });
                    }
                }, 8000);
            });

            intervaloVisibilidad = setInterval(refrescarVisibilidad, 450);
        }

        // ---------- Guia flotante compartida ----------
        // Sirve para el carrito y para el chat de DOMI IA: mismo
        // halo, mismo mensaje, mismos tiempos.
        // tipo = 'carrito' | 'ia'.
        function posicionarGuiaFlotante() {
            if (!guiaFlotante || guiaFlotante.pausada) return;

            const objetivo = guiaFlotante.objetivo;
            if (!objetivo || !objetivo.isConnected) return;

            const rect = objetivo.getBoundingClientRect();

            // Guia del chat: SOLO mensajito, junto al panel
            // abierto (el boton esta detras del chat, un halo
            // sobre el no tendria sentido aqui).
            if (guiaFlotante.tipo === 'ia') {
                const altoMensaje = mensaje.offsetHeight || 80;
                const anchoMensaje = Math.min(270, window.innerWidth - 24);
                const izquierda = Math.max(12, Math.min(
                    rect.left + 16,
                    window.innerWidth - anchoMensaje - 12
                ));

                let arriba = rect.top - altoMensaje - 12;
                if (arriba < 12) arriba = rect.bottom + 12;
                if (arriba + altoMensaje > window.innerHeight - 12) {
                    arriba = 12;
                }

                mensaje.style.left = izquierda + 'px';
                mensaje.style.top = arriba + 'px';
                return;
            }

            // Guia del carrito: halo + mensaje (igual que siempre).
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

        function programarTemporizador() {
            if (temporizador) {
                clearTimeout(temporizador);
                temporizador = null;
            }
            if (!guiaFlotante) return;
            temporizador = setTimeout(() => {
                temporizador = null;
                if (guiaFlotante) ocultarGuiaFlotante(guiaFlotante.marcarAlExpirar);
            }, guiaFlotante.duracion);
        }

        function ocultarGuiaFlotante(marcarVista) {
            if (!guiaFlotante) return;

            if (temporizador) {
                clearTimeout(temporizador);
                temporizador = null;
            }

            if (marcarVista && guiaFlotante.clave) {
                guardarVista(guiaFlotante.clave);
            }

            halo.classList.remove('activo');
            mensaje.classList.remove('activo');
            guiaFlotante = null;
        }

        function mostrarGuiaFlotante(tipo, objetivo, texto, clave, duracion, marcarAlExpirar) {
            if (!objetivo || !objetivo.isConnected) return;

            if (guiaFlotante) {
                if (guiaFlotante.tipo === tipo) {
                    posicionarGuiaFlotante();
                    return;
                }
                ocultarGuiaFlotante(false);
            }

            guiaFlotante = {
                tipo,
                objetivo,
                clave,
                marcarAlExpirar,
                duracion,
                pausada: false
            };

            textoGuia.textContent = texto;
            halo.classList.toggle('activo', tipo !== 'ia');
            mensaje.classList.add('activo');
            posicionarGuiaFlotante();
            programarTemporizador();
            refrescarVisibilidad();
        }

        // ---------- Guia dedicada del chat de DOMI IA ----------
        // ★ El mensajito con "Entendido" sale CADA VEZ que se
        // abre el chat, mientras el chat este abierto. Solo
        // queda como vista cuando se pulsa "Entendido" (o al
        // cumplir los 12 segundos). Abrir el chat NUNCA lo
        // marca como visto por si solo.
        function mostrarGuiaIA() {
            const panel = document.querySelector(SELECTOR_IA_PANEL);
            if (!panel) return;

            mostrarGuiaFlotante(
                'ia',
                panel,
                TEXTO_GUIA_IA,
                CLAVE_VISTA_IA,
                DURACION_GUIA_IA,
                true
            );
        }

        // ---------- Visibilidad: ocultar y reanudar ----------
        // Reglas unicas:
        // - Recorrido: se oculta si se abre una capa (carrito,
        //   buscador, menu, chat) o el objetivo deja de verse
        //   (entrada a categoria/tienda). Al volver, reaparece
        //   donde estaba.
        // - Guia del chat: vive MIENTRAS el chat este abierto;
        //   se tapa si se abre otra cosa encima y reanuda al
        //   cerrarse esa otra cosa.
        // - Guia del carrito: se cancela si algo se abre y
        //   vuelve con el proximo producto agregado.
        function refrescarVisibilidad() {
            const capaAbierta = hayCapaAbierta();
            const chatAbierto = capaIAAbierta();

            // --- Recorrido ---
            if (recorridoActivo) {
                const paso = pasosRecorrido[indiceRecorrido];
                const objetivo = paso && document.querySelector(paso.selector);
                const suspendido = capaAbierta || !objetivoVisible(objetivo);

                if (suspendido !== recorridoSuspendido) {
                    recorridoSuspendido = suspendido;
                    recorridoCard.classList.toggle('activo', !suspendido);
                    recorridoHalo.classList.toggle('activo', !suspendido);
                    if (!suspendido) posicionarRecorrido();
                }
            }

            // --- Guia del chat de DOMI IA ---
            if (guiaFlotante && guiaFlotante.tipo === 'ia') {
                if (!chatAbierto) {
                    // El chat se cerro: el mensajito se va (sin
                    // quedar como vista si nunca se pulso
                    // "Entendido"). Vuelve en la proxima apertura.
                    ocultarGuiaFlotante(false);
                } else if (hayOtraCapaAbierta()) {
                    if (!guiaFlotante.pausada) {
                        if (temporizador) {
                            clearTimeout(temporizador);
                            temporizador = null;
                        }
                        guiaFlotante.pausada = true;
                        mensaje.classList.remove('activo');
                    }
                } else {
                    const estabaPausada = guiaFlotante.pausada;
                    guiaFlotante.pausada = false;
                    mensaje.classList.add('activo');
                    posicionarGuiaFlotante();
                    if (estabaPausada) programarTemporizador();
                }
            } else if (guiaFlotante) {
                // --- Guia del carrito ---
                const visible = !capaAbierta && objetivoVisible(guiaFlotante.objetivo);
                if (!visible) {
                    ocultarGuiaFlotante(false);
                }
            }

            // --- Disparo del mensajito del chat ---
            // Funciona incluso para quien ya hizo el recorrido
            // (por eso el monitoreo es permanente).
            if (!guiaFlotante && chatAbierto && !yaVista(CLAVE_VISTA_IA)) {
                mostrarGuiaIA();
            }
        }

        // ---------- Recorrido ----------
        function posicionarRecorrido() {
            if (!recorridoActivo) return;

            const paso = pasosRecorrido[indiceRecorrido];
            const objetivo = paso && document.querySelector(paso.selector);
            if (!objetivo || !objetivo.isConnected) return;

            const rect = objetivo.getBoundingClientRect();
            recorridoHalo.style.left = Math.max(4, rect.left - 6) + 'px';
            recorridoHalo.style.top = Math.max(4, rect.top - 6) + 'px';
            recorridoHalo.style.width = Math.max(36, rect.width + 12) + 'px';
            recorridoHalo.style.height = Math.max(36, rect.height + 12) + 'px';

            const ancho = recorridoCard.offsetWidth;
            const alto = recorridoCard.offsetHeight;
            const izquierda = Math.max(12, Math.min(
                rect.left,
                window.innerWidth - ancho - 12
            ));
            let arriba = rect.bottom + 14;

            if (arriba + alto > window.innerHeight - 12) {
                arriba = rect.top - alto - 14;
            }

            recorridoCard.style.left = izquierda + 'px';
            recorridoCard.style.top = Math.max(
                12,
                Math.min(arriba, window.innerHeight - alto - 12)
            ) + 'px';
        }

        function pintarPaso(objetivo) {
            const paso = pasosRecorrido[indiceRecorrido];
            if (!paso || !objetivo) {
                terminarRecorrido();
                return;
            }

            recorridoActivo = true;
            progreso.textContent = `${indiceRecorrido + 1} / ${pasosRecorrido.length}`;
            tituloRecorrido.textContent = paso.titulo;
            textoRecorrido.textContent = paso.texto;
            botonAnterior.hidden = indiceRecorrido === 0;
            botonSiguiente.textContent = indiceRecorrido === pasosRecorrido.length - 1
                ? 'Terminar'
                : 'Siguiente';
            recorridoSuspendido = false;
            guardarPasoActual();
            recorridoCard.classList.add('activo');
            recorridoHalo.classList.add('activo');
            refrescarVisibilidad();

            objetivo.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
                block: 'center',
                inline: 'nearest'
            });
            requestAnimationFrame(posicionarRecorrido);
        }

        function mostrarPasoRecorrido(indice) {
            indiceRecorrido = indice;
            const paso = pasosRecorrido[indiceRecorrido];

            if (!paso) {
                terminarRecorrido();
                return;
            }

            const objetivo = document.querySelector(paso.selector);
            if (objetivo && objetivo.isConnected) {
                pintarPaso(objetivo);
                return;
            }

            // El objetivo puede inyectarse tarde (ej. el boton de
            // DOMI IA). Se oculta la tarjeta un momento; si el
            // objetivo no aparece, el recorrido termina sin molestar.
            const espera = ++esperaPaso;
            recorridoCard.classList.remove('activo');
            recorridoHalo.classList.remove('activo');
            esperarElemento(paso.selector, encontrado => {
                if (espera !== esperaPaso) return;
                if (!encontrado) {
                    terminarRecorrido();
                    return;
                }
                pintarPaso(encontrado);
            }, 2500);
        }

        function terminarRecorrido() {
            recorridoActivo = false;
            recorridoSuspendido = false;
            esperaPaso++;
            recorridoCard.classList.remove('activo');
            recorridoHalo.classList.remove('activo');
            borrarPasoGuardado();
            guardarVista(CLAVE_RECORRIDO);

            if (guiaCarritoPendiente) {
                guiaCarritoPendiente = false;
                setTimeout(mostrarGuiaCarrito, 0);
            }
        }

        function manejarTeclaRecorrido(evento) {
            if (
                evento.key === 'Escape' &&
                recorridoActivo &&
                !recorridoSuspendido
            ) {
                terminarRecorrido();
            }
        }

        // ★ Sin salidas accidentales: tocar el elemento iluminado
        // (categoria, producto, tienda) NO cierra el recorrido.
        // Solo "Saltar", "Terminar" o ESC lo cierran.

        function iniciarRecorrido() {
            const categorias = document.getElementById('categories-scroll');
            const destacados = document.getElementById('productos-destacados-grid');
            const tiendas = document.getElementById('stores-grid');

            if (!categorias || !destacados || !tiendas) return;

            // Quien ya hizo el recorrido no lo ve de nuevo. El
            // mensajito del chat no depende de esto: sale solo al
            // abrir el chat (monitoreo permanente).
            let tourYaVisto = false;
            try {
                tourYaVisto = localStorage.getItem(CLAVE_RECORRIDO) === '1';
            } catch (_) {}
            if (tourYaVisto) return;

            let catalogoListo = false;
            let interaccionVista = false;
            const bannersInstalacion = [
                document.getElementById('install-banner'),
                document.getElementById('install-manual-banner')
            ].filter(Boolean);
            const observadorCatalogo = new MutationObserver(comprobarCatalogo);
            const observadorInstalacion = new MutationObserver(iniciarSiDisponible);

            function iniciarSiDisponible() {
                if (!catalogoListo) return;

                // Un recorrido guardado (regreso desde una tienda o
                // categoria) NO espera interaccion: aparece solo.
                if (!interaccionVista && leerPasoGuardado() === null) return;

                if (bannersInstalacion.some(banner => banner.classList.contains('mostrar'))) return;

                observadorInstalacion.disconnect();
                quitarEscuchaInteraccion();
                prepararRecorrido();
            }

            // ★ Arranque por interaccion: la PRIMERA vez que el
            // usuario scrollea o toca la pagina, sin temporizador
            // fijo (antes eran 6.5 segundos).
            function marcarInteraccion() {
                if (interaccionVista) return;
                interaccionVista = true;
                iniciarSiDisponible();
            }

            function quitarEscuchaInteraccion() {
                window.removeEventListener('scroll', marcarInteraccion, true);
                window.removeEventListener('pointerdown', marcarInteraccion, true);
            }

            window.addEventListener('scroll', marcarInteraccion, {
                passive: true,
                capture: true
            });
            window.addEventListener('pointerdown', marcarInteraccion, {
                passive: true,
                capture: true
            });

            function prepararRecorrido() {
                pasosRecorrido = [{
                    selector: '#categories-wrapper',
                    titulo: 'Explora por categorías',
                    texto: 'Elige una categoría y desliza para descubrir más.'
                }];

                if (
                    destacados.style.display !== 'none' &&
                    destacados.querySelector('.destacado-card')
                ) {
                    pasosRecorrido.push({
                        selector: '#productos-destacados-grid',
                        titulo: 'Productos estrella',
                        texto: 'Mira aquí algunas opciones destacadas para empezar.'
                    });
                }

                pasosRecorrido.push({
                    selector: '#stores-grid',
                    titulo: 'Encuentra una tienda',
                    texto: 'Explora las tiendas y toca una para ver su menú.'
                });

                // ★ DOMI IA: el boton puede inyectarse despues del
                // catalogo. Se espera maximo 1s antes de decidir si
                // el paso entra al recorrido.
                const pasoIA = {
                    selector: SELECTOR_IA_FLOTANTE,
                    titulo: 'Pide ayuda a DOMI IA',
                    texto: 'Tócala para pedir recomendaciones. El recorrido se pausa mientras conversas y continúa al cerrar el chat.'
                };

                const lanzar = () => {
                    const pasoGuardado = leerPasoGuardado();
                    const indiceInicial =
                        pasoGuardado !== null && pasoGuardado < pasosRecorrido.length
                            ? pasoGuardado
                            : 0;
                    mostrarPasoRecorrido(indiceInicial);
                };

                if (document.querySelector(SELECTOR_IA_FLOTANTE)) {
                    pasosRecorrido.push(pasoIA);
                    lanzar();
                } else {
                    esperarElemento(SELECTOR_IA_FLOTANTE, existe => {
                        if (existe) pasosRecorrido.push(pasoIA);
                        lanzar();
                    }, 1000);
                }
            }

            function comprobarCatalogo() {
                if (catalogoListo) return;

                const categoriasListas = categorias.querySelector('.category-item');
                const destacadosListos = destacados.style.display === 'none' ||
                    destacados.querySelector('.destacado-card');
                const tiendasListas = tiendas.querySelector('.store-card, .empty-state');

                if (!categoriasListas || !destacadosListos || !tiendasListas) return;

                catalogoListo = true;
                observadorCatalogo.disconnect();
                bannersInstalacion.forEach(banner => {
                    observadorInstalacion.observe(banner, {
                        attributes: true,
                        attributeFilter: ['class']
                    });
                });

                iniciarSiDisponible();
            }

            [categorias, destacados, tiendas].forEach(elemento => {
                observadorCatalogo.observe(elemento, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });
            });

            comprobarCatalogo();
        }

        // ---------- Guia del carrito ----------
        function mostrarGuiaCarrito() {
            if (recorridoActivo) {
                guiaCarritoPendiente = true;
                return;
            }

            if (yaVista(CLAVE_VISTA)) return;

            mostrarGuiaFlotante(
                'carrito',
                carrito,
                TEXTO_GUIA_CARRITO,
                CLAVE_VISTA,
                DURACION_GUIA_CARRITO,
                false
            );
        }

        botonCerrar.addEventListener('click', () => {
            ocultarGuiaFlotante(true);
        });

        // Al tocar el carrito, desaparece su guia (y queda como
        // vista). El evento original del carrito sigue funcionando.
        carrito.addEventListener('click', () => {
            if (guiaFlotante && guiaFlotante.tipo === 'carrito') {
                guardarVista(CLAVE_VISTA);
                ocultarGuiaFlotante(false);
            }
        }, true);

        window.addEventListener('resize', () => {
            posicionarGuiaFlotante();
            posicionarRecorrido();
        }, {
            passive: true
        });

        window.addEventListener('scroll', () => {
            posicionarGuiaFlotante();
            posicionarRecorrido();
        }, {
            passive: true,
            capture: true
        });

        document.addEventListener('keydown', manejarTeclaRecorrido);

        // Navegacion del recorrido: unica forma de avanzar o salir.
        // Tocar el elemento iluminado no cierra nada (regla 2).
        botonSaltar.addEventListener('click', terminarRecorrido);
        botonAnterior.addEventListener('click', () => {
            if (indiceRecorrido > 0) mostrarPasoRecorrido(indiceRecorrido - 1);
        });
        botonSiguiente.addEventListener('click', () => {
            if (indiceRecorrido === pasosRecorrido.length - 1) {
                terminarRecorrido();
            } else {
                mostrarPasoRecorrido(indiceRecorrido + 1);
            }
        });

        // Detectar cambios en el contenido del carrito sin
        // modificar la funcion que agrega productos.
        let estadoAnterior = listaCarrito.innerHTML;

        const observador = new MutationObserver(() => {
            const estadoNuevo = listaCarrito.innerHTML;
            const tieneProductos = listaCarrito.children.length > 0;

            if (tieneProductos && estadoNuevo !== estadoAnterior) {
                mostrarGuiaCarrito();
            }

            estadoAnterior = estadoNuevo;
        });

        observador.observe(listaCarrito, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });

        iniciarMonitoreo();
        iniciarRecorrido();
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