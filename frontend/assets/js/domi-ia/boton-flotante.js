// ============================================
// DOMIDELIS — BOTÓN FLOTANTE DOMI IA
// ★ v2: se oculta automáticamente mientras el
//   carrito está abierto (.cart-panel.active),
//   para no interferir con el flujo de compra.
//   · Requiere la regla CSS .ia-float-oculto-carrito
//     (ver domi-ia-ocultar-carrito.css)
//   · Control manual opcional:
//     DomiIABotonFlotante.ocultar() / .mostrar()
// ============================================

'use strict';

(function () {
  const FLOAT_POSITION_KEY = 'domi_ia_float_position_v1';

  // ★★★ NUEVO v2: OCULTAR EL BOTÓN MIENTRAS EL CARRITO ESTÁ ABIERTO ★★★
  // Configurado con los selectores reales de cart.css:
  // el estado abierto del carrito es .cart-panel.active
  // (funciona igual abriendo desde el header de home que
  // desde el .cart-float de las tiendas).
  const SELECTOR_CARRITO = '.cart-panel';
  const CLASES_ABIERTO = ['active'];
  const CLASE_BODY_CARRITO = ''; // tu carrito no pone clase en <body>

  const CLASE_OCULTO = 'ia-float-oculto-carrito';
  let ocultoPorCarrito = false;
  let observadorCarrito = null;

  function aplicarVisibilidadCarrito(button) {
    if (!button) return;
    button.classList.toggle(CLASE_OCULTO, ocultoPorCarrito);
  }

  function setOcultoPorCarrito(ocultar) {
    ocultoPorCarrito = !!ocultar;
    aplicarVisibilidadCarrito(document.getElementById('ia-float'));
  }

  function carritoAbiertoAhora() {
    if (CLASE_BODY_CARRITO && document.body.classList.contains(CLASE_BODY_CARRITO)) return true;
    if (!SELECTOR_CARRITO) return false;
    const panel = document.querySelector(SELECTOR_CARRITO);
    return !!panel && CLASES_ABIERTO.some(function (clase) {
      return panel.classList.contains(clase);
    });
  }

  function observarCarrito() {
    if (observadorCarrito || typeof MutationObserver === 'undefined') return;
    if (!SELECTOR_CARRITO && !CLASE_BODY_CARRITO) return;

    let intentos = 0;
    function conectar() {
      // En páginas sin carrito (checkout, confirmación) el panel
      // no existe: el observador queda en modo pasivo, sin errores.
      const panel = SELECTOR_CARRITO ? document.querySelector(SELECTOR_CARRITO) : null;
      if (SELECTOR_CARRITO && !panel && intentos++ < 20) {
        window.setTimeout(conectar, 500);
        return;
      }

      observadorCarrito = new MutationObserver(function () {
        setOcultoPorCarrito(carritoAbiertoAhora());
      });
      observadorCarrito.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      if (panel) observadorCarrito.observe(panel, { attributes: true, attributeFilter: ['class'] });

      // Sincronizar estado inicial (por si el carrito ya estaba abierto)
      setOcultoPorCarrito(carritoAbiertoAhora());
    }
    conectar();
  }
  // ★★★ FIN DEL BLOQUE NUEVO v2 ★★★

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
      // ★ v2: si el botón ya existía, igual aplicar estado y observador
      aplicarVisibilidadCarrito(existente);
      observarCarrito();
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
      // ★ v2: también respetar el estado "oculto por carrito"
      if (event.button !== 0 || button.classList.contains('oculto') || ocultoPorCarrito) return;
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
      // ★ v2: no recolocar ni guardar posición mientras está oculto por el carrito
      if (ocultoPorCarrito) return;
      if (!button.style.left || !button.style.top) return;
      const rect = button.getBoundingClientRect();
      posicionar(button, rect.left, rect.top);
      guardarPosicion(button);
      if (typeof onMove === 'function') onMove();
    });

    document.body.appendChild(button);
    aplicarVisibilidadCarrito(button); // ★ v2: aplica estado si ocultar() se llamó antes de crear
    observarCarrito();                 // ★ v2: activa la detección automática del carrito
    iniciarRotacion(pregunta);
    return button;
  }

  window.DomiIABotonFlotante = {
    crear: crear,
    // ★ v2: control manual opcional (útil si algún día prefieres
    // llamarlo desde tu propio JS del carrito en abrir/cerrar)
    ocultar: function () { setOcultoPorCarrito(true); },
    mostrar: function () { setOcultoPorCarrito(false); }
  };
})();
