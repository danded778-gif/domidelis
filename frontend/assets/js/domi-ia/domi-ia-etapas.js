/* =====================================================================
   DOMIDELIS · domi-ia-etapas.js — guía por etapas (v1, 2026-11-11)
   =====================================================================
   QUÉ ES: una capa NUEVA que guía la conversación en 4 etapas, sin
   tocar asistente-ia.js ni iaRoutes.js (ni una línea de esos archivos).
   Las recomendaciones de productos siguen saliendo del mismo cerebro de
   siempre; este archivo solo decide CUÁNDO responder localmente con un
   mensaje corto y humano, y lleva la cuenta de la etapa.

   ETAPAS:
     1. Saludo        -> "hola"                              -> saludo corto + 1 pregunta
     2. Antojo        -> presupuesto / categoría / antojo     -> el flujo normal responde (NO se toca)
     3. Carrito       -> agregó algo al carrito / "eso es todo" -> pregunta de guía
     4. Datos         -> nombre / teléfono en el mensaje       -> guarda y confirma CORTO (sin discurso de vendedor)

   INSTALACIÓN (una sola línea, DESPUÉS de asistente-ia.js):
     <script src="assets/js/domi-ia/asistente-ia.js" defer></script>
     <script src="assets/js/domi-ia/domi-ia-etapas.js" defer></script>

   SEGURIDAD:
   - Si DomiIARazonamiento o DomiIACatalogo no están cargados, este
     archivo NO interviene en nada (paso directo al flujo normal).
   - Nunca intercepta mensajes con intención de comida (los decide
     DomiIACatalogo.buscar, no suposiciones).
   - Nunca inventa datos: usa los mismos patrones de extracción de
     asistente-ia.js (copia local para no editar ese archivo).
   ===================================================================== */

'use strict';

(function () {
  const VERSION = 'v1 (2026-11-11)';
  const CLAVE_ETAPA = 'domi_ia_etapa';

  /* ---------- estado de etapas ---------- */
  let etapa = leerEtapa();
  let ultimoMomentoGuia = 0;

  function leerEtapa() {
    try {
      const valor = parseInt(localStorage.getItem(CLAVE_ETAPA), 10);
      return valor >= 1 && valor <= 4 ? valor : 1;
    } catch (error) {
      return 1;
    }
  }

  function guardarEtapa() {
    try {
      localStorage.setItem(CLAVE_ETAPA, String(etapa));
    } catch (error) { /* sin localStorage no pasa nada grave */ }
    console.info('[DOMI IA Etapas] Etapa actual: ' + etapa);
  }

  function marcarEtapa(numero) {
    if (numero > etapa) {
      etapa = numero;
      guardarEtapa();
    }
  }

  /* ---------- módulos base (si faltan, este archivo no actúa) ---------- */
  function moduloListo() {
    return !!(window.DomiIARazonamiento && window.DomiIACatalogo);
  }

  function normalizar(texto) {
    return window.DomiIARazonamiento.normalizarTexto(texto);
  }

  /* ---------- detección de intención de comida (data, no invento) ---------- */
  function tieneIntencionComida(consulta) {
    try {
      const catalogo = window.DomiIACatalogo.buscar(String(consulta || ''), {
        excluirIds: [],
        incluirIds: []
      });
      return !!(catalogo && Array.isArray(catalogo.candidatos) && catalogo.candidatos.length);
    } catch (error) {
      return false;
    }
  }

  /* =====================================================================
     EXTRACCIÓN DE DATOS — copia exacta de los patrones de asistente-ia.js
     (se copian aquí para NO editar ese archivo; misma clave localStorage).
     ===================================================================== */
  const PATRON_TELEFONO_CON_CLAVE = /\b(?:telefono|celular|cel|n[uú]mero|whatsapp|guatsapp|wap)\b[a-záéíóúñü\s#:]{0,12}?(?:es\b\s*|:)?\s*\+?5?7?[\s.-]*((?:\d[\s.-]?){9}\d)/i;
  const PATRON_CELULAR_LIBRE = /\b3(?:[\s.-]?\d){9}\b/;

  const PALABRAS_CORTE_NOMBRE = new Set([
    'y', 'e', 'mi', 'mis', 'tu', 'yo', 'de', 'del', 'en', 'el', 'la', 'los',
    'las', 'un', 'una', 'unos', 'unas', 'que', 'quiero', 'quisiera', 'pero',
    'vivo', 'trabajo', 'estoy', 'dame', 'para', 'por', 'con', 'hambre',
    'antojo', 'telefono', 'celular', 'numero', 'whatsapp', 'direccion',
    'barrio', 'zona', 'casa', 'soy', 'llamo'
  ]);
  const NO_SON_NOMBRES = new Set([
    'alergico', 'alergica', 'vegetariano', 'vegetariana', 'vegano', 'vegana',
    'diabetico', 'diabetica', 'celiaco', 'celiaca', 'intolerante', 'nuevo',
    'nueva', 'cliente', 'fan', 'curioso', 'curiosa', 'mayor', 'menor',
    'hombre', 'mujer', 'joven'
  ]);

  function extraerNombre(consulta) {
    const coincidencia = /\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÑÜáéíóúñü'’-]+(?:\s+[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’-]+){0,2})/
      .exec(String(consulta || ''));
    if (!coincidencia) return '';
    const palabras = [];
    for (const fragmento of coincidencia[1].split(/\s+/)) {
      const clave = normalizar(fragmento);
      if (PALABRAS_CORTE_NOMBRE.has(clave) || NO_SON_NOMBRES.has(clave)) break;
      if (!/^[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’-]+$/.test(fragmento)) break;
      if (clave.length < 2) break;
      palabras.push(fragmento);
      if (palabras.length === 3) break;
    }
    if (!palabras.length) return '';
    return palabras.map(function (fragmento) {
      return fragmento.charAt(0).toUpperCase() + fragmento.slice(1).toLowerCase();
    }).join(' ');
  }

  function extraerTelefono(consulta) {
    const texto = String(consulta || '');
    let candidato = '';
    const conClave = PATRON_TELEFONO_CON_CLAVE.exec(texto);
    if (conClave) {
      candidato = conClave[1];
    } else {
      const libre = PATRON_CELULAR_LIBRE.exec(texto);
      if (libre) candidato = libre[0];
    }
    if (!candidato) return '';
    const digitos = candidato.replace(/\D/g, '');
    if (digitos.length !== 10) return '';
    const posicion = texto.toLowerCase().indexOf(candidato.toLowerCase());
    const antes = posicion >= 0 ? texto.slice(0, posicion).toLowerCase() : '';
    if (/\b(?:c[eé]dula|documento|cc)\b[^.!?]{0,14}$/.test(antes)) return '';
    return digitos;
  }

  function extraerDatosCliente(consulta) {
    return {
      nombre: extraerNombre(consulta),
      telefono: extraerTelefono(consulta)
    };
  }

  function guardarDatosClienteEnLocal(datos) {
    let previo = {};
    try {
      previo = JSON.parse(localStorage.getItem('domidelis_cliente') || '{}');
      if (!previo || typeof previo !== 'object' || Array.isArray(previo)) previo = {};
    } catch (error) {
      previo = {};
    }

    const fusion = Object.assign({}, previo);
    if (datos.nombre) fusion.nombre = datos.nombre;
    if (datos.telefono) fusion.telefono = datos.telefono;
    try {
      localStorage.setItem('domidelis_cliente', JSON.stringify(fusion));
      console.info('[DOMI IA Etapas] Datos del cliente listos para el checkout.');
    } catch (error) {
      console.warn('[DOMI IA Etapas] No se pudieron guardar los datos del cliente:', error);
      return;
    }

    try {
      const campoNombre = document.getElementById('nombre');
      const campoTelefono = document.getElementById('telefono');
      if (campoNombre && datos.nombre && !String(campoNombre.value || '').trim()) {
        campoNombre.value = datos.nombre;
        campoNombre.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (campoTelefono && datos.telefono && !String(campoTelefono.value || '').trim()) {
        campoTelefono.value = datos.telefono;
        campoTelefono.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (error) {
      console.warn('[DOMI IA Etapas] No se pudo rellenar el checkout:', error);
    }
  }

  /* =====================================================================
     UI — réplicas exactas de la estructura que crea asistente-ia.js
     (.ia-msg.user / .ia-msg.ia / .ia-msg-texto / .ia-typing en #ia-mensajes)
     ===================================================================== */
  function contenedorMensajes() {
    return document.getElementById('ia-mensajes');
  }

  function crearElemento(tag, clase, texto) {
    const el = document.createElement(tag);
    el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  function desplazar() {
    const cont = contenedorMensajes();
    if (cont) cont.scrollTop = cont.scrollHeight;
  }

  function burbujaUsuario(texto) {
    const cont = contenedorMensajes();
    if (!cont) return;
    const mensaje = crearElemento('div', 'ia-msg user');
    mensaje.appendChild(crearElemento('div', 'ia-msg-texto', texto));
    cont.appendChild(mensaje);
    desplazar();
  }

  function burbujaIA(texto) {
    const cont = contenedorMensajes();
    if (!cont) return;
    const mensaje = crearElemento('div', 'ia-msg ia');
    mensaje.appendChild(crearElemento('div', 'ia-msg-texto', texto));
    cont.appendChild(mensaje);
    desplazar();
  }

  /* Pequeña pausa "escribiendo…" para que no suene a robot */
  function responderCon(texto) {
    const cont = contenedorMensajes();
    if (!cont) return;
    const typing = crearElemento('div', 'ia-msg ia ia-typing');
    typing.setAttribute('aria-label', 'El asistente está escribiendo');
    for (let i = 0; i < 3; i += 1) typing.appendChild(document.createElement('span'));
    typing.appendChild(crearElemento('span', 'ia-typing-texto', 'Escribiendo…'));
    cont.appendChild(typing);
    desplazar();
    window.setTimeout(function () {
      if (typing.isConnected) typing.remove();
      burbujaIA(texto);
    }, 380);
  }

  function ocultarChipsYLimpiarInput(input) {
    const chips = document.querySelector('#ia-panel .ia-chips');
    if (chips) chips.hidden = true;
    if (input) input.value = '';
    const contador = document.getElementById('ia-contador');
    if (contador) contador.textContent = '0/500';
  }

  /* =====================================================================
     DETECTORES DE ETAPA
     ===================================================================== */
  function esSaludoPuro(consulta) {
    if (!window.DomiIARazonamiento.esSaludoSimple(consulta)) return false;
    if (/\d/.test(consulta)) return false;
    return consulta.split(/\s+/).length <= 4;
  }

  const CIERRE_PEDIDO = /\b(eso es todo|eso seria todo|nada mas|no gracias|ya esta|listo|solo eso|solamente eso|por ahora nada|nada)\b/;

  function esCierrePedido(consulta) {
    const texto = normalizar(consulta);
    if (!CIERRE_PEDIDO.test(texto)) return false;
    return texto.split(/\s+/).length <= 6;
  }

  function carritoTieneItems() {
    try {
      if (typeof window.obtenerCarrito === 'function') {
        const carrito = window.obtenerCarrito();
        if (Array.isArray(carrito)) return carrito.length > 0;
      }
    } catch (error) { /* sigue con el respaldo */ }
    try {
      const crudo = JSON.parse(localStorage.getItem('carrito') || '[]');
      if (Array.isArray(crudo)) return crudo.length > 0;
    } catch (error) { /* sin carrito legible */ }
    return false;
  }

  /* =====================================================================
     RESPUESTAS CORTAS POR ETAPA (una pregunta por mensaje, sin discursos)
     ===================================================================== */
  const SALUDOS = [
    '¡Hola! ¿Qué se te antoja hoy?',
    '¡Hola! Cuéntame qué te provoca y te muestro opciones.',
    '¡Hola! ¿Qué quieres comer hoy?'
  ];

  function responderSaludo() {
    const texto = SALUDOS[Math.floor(Math.random() * SALUDOS.length)];
    responderCon(texto);
  }

  function responderDatos(datos) {
    guardarDatosClienteEnLocal(datos);
    const conCarrito = carritoTieneItems();
    if (datos.nombre && datos.telefono) {
      responderCon(conCarrito
        ? '¡Listo, ' + datos.nombre + '! Tus datos quedaron guardados. Cuando quieras, toca "Ir al checkout".'
        : '¡Listo, ' + datos.nombre + '! ¿Qué se te antoja para tu pedido?');
    } else if (datos.nombre) {
      responderCon('¡Hola, ' + datos.nombre + '! ¿Me pasas también tu número de teléfono?');
    } else {
      responderCon('¡Perfecto, anoté tu teléfono! ¿Y tu nombre para el pedido?');
    }
    marcarEtapa(4);
  }

  function responderCierre() {
    responderCon('¿Algo más para tu pedido, o me pasas tu nombre y teléfono para finalizar?');
    marcarEtapa(3);
  }

  /* =====================================================================
     INTERCEPTOR DEL ENVÍO (captura en document, no toca el formulario)
     ===================================================================== */
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!form || !form.classList || !form.classList.contains('ia-entrada')) return;
    if (!moduloListo()) return;

    const input = form.querySelector('.ia-input');
    if (!input) return;
    const consulta = String(input.value || '').trim();
    if (!consulta || consulta.length > 500) return;
    if (document.querySelector('#ia-mensajes .ia-typing')) return;

    const datos = extraerDatosCliente(consulta);
    const hayDatos = !!(datos.nombre || datos.telefono);
    const comida = tieneIntencionComida(consulta);

    /* Etapa 4 — datos personales (solo si el mensaje no pide comida) */
    if (hayDatos && !comida) {
      event.preventDefault();
      event.stopPropagation();
      ocultarChipsYLimpiarInput(input);
      burbujaUsuario(consulta);
      responderDatos(datos);
      return;
    }

    /* Etapa 1 — saludo puro */
    if (!comida && !hayDatos && esSaludoPuro(consulta)) {
      event.preventDefault();
      event.stopPropagation();
      ocultarChipsYLimpiarInput(input);
      burbujaUsuario(consulta);
      responderSaludo();
      return;
    }

    /* Etapa 3 — cierre de pedido con carrito lleno */
    if (!comida && !hayDatos && esCierrePedido(consulta) && carritoTieneItems()) {
      event.preventDefault();
      event.stopPropagation();
      ocultarChipsYLimpiarInput(input);
      burbujaUsuario(consulta);
      responderCierre();
      return;
    }

    /* Etapa 2 — antojo: pasa al flujo normal, intacto */
    if (comida) marcarEtapa(2);
  }, true);

  /* =====================================================================
     ETAPA 3 — guía después de que el cliente agrega algo al carrito
     ===================================================================== */
  window.addEventListener('domidelis:carrito-actualizado', function () {
    const ahora = Date.now();
    if (ahora - ultimoMomentoGuia < 30000) return;
    const panel = document.getElementById('ia-panel');
    if (!panel || !panel.classList.contains('abierta')) return;
    ultimoMomentoGuia = ahora;
    marcarEtapa(3);

    window.setTimeout(function () {
      const texto = '¿Algo más, o te tomo los datos para el pedido?';
      const cont = contenedorMensajes();
      if (!cont) return;
      if (document.querySelector('#ia-mensajes .ia-typing')) return;
      const ultimas = cont.querySelectorAll('.ia-msg.ia .ia-msg-texto');
      if (ultimas.length && ultimas[ultimas.length - 1].textContent === texto) return;
      burbujaIA(texto);
    }, 900);
  });

  /* Reset de etapas cuando el cliente vacía la conversación (botón Vaciar) */
  document.addEventListener('click', function (event) {
    const boton = event.target && event.target.closest ? event.target.closest('.ia-btn-peligro') : null;
    if (!boton) return;
    etapa = 1;
    guardarEtapa();
  }, true);

  /* Estado visible para pruebas */
  window.DomiIAEtapas = {
    version: VERSION,
    etapaActual: function () { return etapa; }
  };

  function iniciar() {
    if (!moduloListo()) {
      console.warn('[DOMI IA Etapas] Módulos base no cargados; queda en modo paso directo.');
      return;
    }
    console.info('[DOMI IA Etapas] Activo (' + VERSION + '), etapa: ' + etapa);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
