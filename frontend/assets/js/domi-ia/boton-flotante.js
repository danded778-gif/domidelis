// ============================================
// DOMIDELIS — BOTÓN FLOTANTE DOMI IA
// ★ v3: se oculta mientras el carrito esté abierto
//   (.cart-panel.active) O el buscador esté activo:
//     · Móvil:      #search-panel.active
//     · Escritorio: #header-search-dropdown.active
//       (se activa al teclear ≥2 letras; también cuando
//        dice "No encontramos…", porque el usuario sigue tecleando)
//   · El buscador solo existe en index.html: cada capa se conecta
//     con el patrón resiliente del v2 (reintento 500 ms × 20, sin errores)
//   · El cierre móvil quita .active de inmediato (el panel se desvanece
//     320 ms después): el botón reaparece al instante
//   · Requiere la regla CSS .ia-float-oculto-carrito
//     (la MISMA del v2 — v3 no cambia ni una línea de CSS)
//   · Control manual opcional:
//     DomiIABotonFlotante.ocultar() / .mostrar()
//     (v3: son un bloqueo independiente — el botón solo reaparece
//      con mostrar() si además no hay carrito ni buscador abiertos)
// ============================================

'use strict';

(function () {
  const FLOAT_POSITION_KEY = 'domi_ia_float_position_v1';

  // ★★★ v3: CAPAS QUE ESCONDEN EL BOTÓN ★★★
  // Cada capa vigila un panel real del sitio con su clase "abierto".
  // El botón se oculta si AL MENOS UNA capa está abierta
  // (carrito abierto O buscador abierto). Para vigilar una capa nueva
  // basta añadirla a esta lista: no hay que tocar el resto del código.
  const CAPAS = [
    {
      razon: 'carrito',
      // Selectores reales de cart.css: el estado abierto del carrito
      // es .cart-panel.active (funciona igual abriendo desde el header
      // de home que desde el .cart-float de las tiendas).
      selector: '.cart-panel',
      clasesAbierto: ['active'],
      claseBody: '' // tu carrito no pone clase en <body>
    },
    {
      razon: 'buscador-movil',
      // buscador.js: abrirBuscadorMovil() añade .active a #search-panel
      // (dentro de un requestAnimationFrame, ~1 frame después de mostrarlo)
      selector: '#search-panel',
      clasesAbierto: ['active'],
      claseBody: ''
    },
    {
      razon: 'buscador-desktop',
      // buscador.js: renderResultadosBusqueda() añade .active al dropdown
      // al teclear ≥2 letras — también en el caso "No encontramos…"
      selector: '#header-search-dropdown',
      clasesAbierto: ['active'],
      claseBody: ''
    }
  ];
  const MAX_REINTENTOS = 20; // igual que v2
  const INTERVALO_REINTENTO_MS = 500;

  const CLASE_OCULTO = 'ia-float-oculto-carrito';
  let bloqueoManual = false;
  let observadorCapas = null;

  function estaOculto() {
    if (bloqueoManual) return true;
    return CAPAS.some(function (capa) {
      return capa.conectada && capa.abierta;
    });
  }

  function aplicarVisibilidad(button) {
    if (!button) return;
    button.classList.toggle(CLASE_OCULTO, estaOculto());
  }

  function refrescarVisibilidad() {
    aplicarVisibilidad(document.getElementById('ia-float'));
  }

  function setBloqueoManual(bloquear) {
    bloqueoManual = !!bloquear;
    refrescarVisibilidad();
  }

  function capaAbierta(capa) {
    if (capa.claseBody && document.body.classList.contains(capa.claseBody)) return true;
    const panel = document.querySelector(capa.selector);
    if (!panel) return false;
    return capa.clasesAbierto.some(function (clase) {
      return panel.classList.contains(clase);
    });
  }

  function recalcularCapas() {
    CAPAS.forEach(function (capa) {
      if (capa.conectada) capa.abierta = capaAbierta(capa);
    });
    refrescarVisibilidad();
  }

  function asegurarObservador() {
    if (observadorCapas || typeof MutationObserver === 'undefined') return;
    observadorCapas = new MutationObserver(recalcularCapas);
  }

  function vigilarCapa(capa) {
    if (capa.conectada || typeof MutationObserver === 'undefined') return;

    let intentos = 0;
    function conectar() {
      // En páginas sin esta capa (el buscador solo existe en index.html;
      // el carrito no existe en checkout/confirmación) el vigilante
      // queda en modo pasivo, sin errores.
      const panel = document.querySelector(capa.selector);
      if (!panel && intentos++ < MAX_REINTENTOS) {
        window.setTimeout(conectar, INTERVALO_REINTENTO_MS);
        return;
      }
      if (!panel) return;

      capa.conectada = true;
      asegurarObservador();

      // Si algún día una capa usa clase en <body>, vigilar <body> también
      if (CAPAS.some(function (c) { return !!c.claseBody; })) {
        observadorCapas.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
      observadorCapas.observe(panel, { attributes: true, attributeFilter: ['class'] });

      // Sincronizar estado inicial (por si la capa ya estaba abierta)
      capa.abierta = capaAbierta(capa);
      refrescarVisibilidad();
    }
    conectar();
  }

  function vigilarCapas() {
    CAPAS.forEach(vigilarCapa);
  }
  // ★★★ FIN DEL BLOQUE v3 ★★★

  const PREGUNTAS_IA = [
  // Antojo
  '¿Qué se te antoja hoy?',
  '¿Antojo de qué tienes?',
  '¿Qué te provoca ahora?',

  // Necesidad
  '¿Hambre de verdad?',
  '¿Qué puedo pedir?',
  '¿Qué te urge pedir?',

  // Ahorro
  '¿Quieres ahorrar hoy?',
  '¿Algo rico y barato?',
  '¿Qué ofertas hay?',

  // Descubrimiento
  '¿Probar algo nuevo?',
  '¿Qué no has probado?',
  '¿Sorpréndeme hoy?',

  // Decisión
  '¿Ya sabes qué pedir?',
  '¿Te ayudo a elegir?',
  '¿Qué pides hoy?'
];

  let rotacionTimer = null;

  function crearElemento(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function posicionar(button, left, top) {
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - button.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - button.offsetHeight - margin);
    button.style.left = Math.min(Math.max(margin, left), maxLeft) + 'px';
    button.style.top = Math.min(Math.max(margin, top), maxTop) + 'px';
    button.style.right = 'auto';
    button.style.bottom = 'auto';
  }

  function guardarPosicion(button) {
    const rect = button.getBoundingClientRect();
    try {
      localStorage.setItem(FLOAT_POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (error) {
      console.warn('[DOMI IA] No se pudo guardar la posición del botón:', error);
    }
  }

  function restaurarPosicion(button) {
    try {
      const stored = JSON.parse(localStorage.getItem(FLOAT_POSITION_KEY) || 'null');
      if (stored && Number.isFinite(stored.left) && Number.isFinite(stored.top)) {
        posicionar(button, stored.left, stored.top);
      }
    } catch (error) {
      console.warn('[DOMI IA] No se pudo restaurar la posición del botón:', error);
    }
  }

  function iniciarRotacion(pregunta) {
    if (rotacionTimer) window.clearInterval(rotacionTimer);
    let indice = 0;
    rotacionTimer = window.setInterval(function () {
      if (!pregunta || !pregunta.isConnected) {
        window.clearInterval(rotacionTimer);
        rotacionTimer = null;
        return;
      }
      indice = (indice + 1) % PREGUNTAS_IA.length;
      pregunta.classList.add('ia-pregunta-cambiando');
      window.setTimeout(function () {
        if (!pregunta.isConnected) return;
        pregunta.textContent = PREGUNTAS_IA[indice];
        pregunta.classList.remove('ia-pregunta-cambiando');
      }, 160);
    }, 3200);
  }

  function crear(onActivate, onMove) {
    const existente = document.getElementById('ia-float');
    if (existente) {
      // ★ v3: si el botón ya existía, igual aplicar estado y vigilantes
      aplicarVisibilidad(existente);
      vigilarCapas();
      return existente;
    }

    const button = crearElemento('button', 'ia-float ia-pulso');
    button.id = 'ia-float';
    button.type = 'button';
    button.setAttribute('aria-label', 'Abrir DOMI IA, asistente de DOMIDELIS');
    button.setAttribute('aria-controls', 'ia-panel');
    button.setAttribute('aria-expanded', 'false');
    button.title = 'Abrir DOMI IA; también puedes arrastrar para moverlo';

    const icon = crearElemento('span', 'ia-float-icon');
    icon.setAttribute('aria-hidden', 'true');
    const image = crearElemento('img', 'ia-float-imagen');
    image.src = encodeURI('/assets/img/ia/Mascota IA con audífonos rojos_80kb.jpg');
    image.alt = '';
    image.loading = 'eager';
    image.addEventListener('error', function () {
      image.remove();
      const fallback = crearElemento('i');
      fallback.className = 'fas fa-robot';
      fallback.setAttribute('aria-hidden', 'true');
      icon.appendChild(fallback);
    }, { once: true });
    icon.appendChild(image);

    const contenido = crearElemento('span', 'ia-float-contenido');
    const badge = crearElemento('span', 'ia-float-badge', 'IA DOMIDELIS BETA');
    const pregunta = crearElemento('span', 'ia-float-pregunta', PREGUNTAS_IA[0]);
    const subtitulo = crearElemento('span', 'ia-float-subtitulo', 'Te ayudo a encontrar tu pedido');
    contenido.append(badge, pregunta, subtitulo);

    const flecha = crearElemento('span', 'ia-float-flecha');
    flecha.setAttribute('aria-hidden', 'true');
    const iconoFlecha = crearElemento('i');
    iconoFlecha.className = 'fas fa-arrow-right';
    flecha.appendChild(iconoFlecha);

    button.append(icon, contenido, flecha);
    restaurarPosicion(button);

    let pointerDrag = null;
    let moved = false;

    button.addEventListener('pointerdown', function (event) {
      // ★ v3: también respetar el estado "oculto" (carrito, buscador o manual)
      if (event.button !== 0 || button.classList.contains('oculto') || estaOculto()) return;
      const rect = button.getBoundingClientRect();
      pointerDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false
      };
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });

    button.addEventListener('pointermove', function (event) {
      if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
      const deltaX = event.clientX - pointerDrag.startX;
      const deltaY = event.clientY - pointerDrag.startY;
      if (!pointerDrag.moved && Math.hypot(deltaX, deltaY) < 6) return;
      pointerDrag.moved = true;
      button.classList.add('ia-float-arrastrando');
      posicionar(button, pointerDrag.left + deltaX, pointerDrag.top + deltaY);
      if (typeof onMove === 'function') onMove();
    });

    function terminarMovimiento(event) {
      if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
      if (pointerDrag.moved) {
        moved = true;
        guardarPosicion(button);
        if (typeof onMove === 'function') onMove();
      }
      button.classList.remove('ia-float-arrastrando');
      pointerDrag = null;
    }

    button.addEventListener('pointerup', terminarMovimiento);
    button.addEventListener('pointercancel', terminarMovimiento);
    button.addEventListener('keydown', function (event) {
      const desplazamiento = event.shiftKey ? 40 : 16;
      const movimientos = {
        ArrowUp: [0, -desplazamiento], ArrowDown: [0, desplazamiento],
        ArrowLeft: [-desplazamiento, 0], ArrowRight: [desplazamiento, 0]
      };
      const movimiento = movimientos[event.key];
      if (!movimiento) return;
      event.preventDefault();
      const rect = button.getBoundingClientRect();
      posicionar(button, rect.left + movimiento[0], rect.top + movimiento[1]);
      guardarPosicion(button);
      if (typeof onMove === 'function') onMove();
    });

    button.addEventListener('click', function (event) {
      if (moved) {
        moved = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (typeof onActivate === 'function') onActivate();
    });

    window.addEventListener('resize', function () {
      // ★ v3: no recolocar ni guardar posición mientras esté oculto
      // (por carrito, buscador o bloqueo manual)
      if (estaOculto()) return;
      if (!button.style.left || !button.style.top) return;
      const rect = button.getBoundingClientRect();
      posicionar(button, rect.left, rect.top);
      guardarPosicion(button);
      if (typeof onMove === 'function') onMove();
    });

    document.body.appendChild(button);
    aplicarVisibilidad(button); // ★ v3: aplica estado si ocultar() se llamó antes de crear
    vigilarCapas();             // ★ v3: activa la detección de carrito + buscador
    iniciarRotacion(pregunta);
    return button;
  }

  window.DomiIABotonFlotante = {
    crear: crear,
    // ★ v3: control manual opcional (bloqueo independiente de las capas;
    // útil si algún día prefieres llamarlo desde tu propio JS)
    ocultar: function () { setBloqueoManual(true); },
    mostrar: function () { setBloqueoManual(false); }
  };
})();