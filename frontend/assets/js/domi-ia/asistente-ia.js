'use strict';

(function () {
  const API_BASE = IA_API_URL;
  const MAX_CONSULTA = 500;
  const MAX_HISTORIAL = 10;
  const SALUDO_INICIAL = '¡Hola! Cuéntame qué se te antoja y te recomiendo opciones de nuestras tiendas aliadas.';
  const SUGERENCIAS = [
    'Algo para compartir',
    'Tengo antojo de hamburguesa',
    'Quiero algo dulce'
  ];

  function encabezadosIA(encabezados) {
    const resultado = Object.assign({}, encabezados);
    const host = window.location.hostname;
    if (host.includes('.ngrok-free.dev') || host.includes('.ngrok.io')) {
      resultado['ngrok-skip-browser-warning'] = 'true';
    }
    return resultado;
  }

  let elementos;
  let historial = [{ rol: 'assistant', texto: SALUDO_INICIAL }];
  let productosPorId = new Map();
  let ultimosProductosRecomendados = [];
  let productosMostrados = new Set();
  let enviando = false;
  let ultimaConsulta = '';
  let ultimoEnvioTs = 0;

  function crearElemento(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function actualizarBotonCheckout() {
    if (!elementos || typeof window.obtenerCarrito !== 'function') return;

    const carrito = window.obtenerCarrito();
    const cantidad = carrito.reduce(function (total, item) {
      return total + (Number(item.cantidad) || 1);
    }, 0);
    elementos.checkout.hidden = cantidad === 0;
    elementos.checkout.textContent = cantidad === 1
      ? 'Ir al checkout · 1 producto'
      : 'Ir al checkout · ' + cantidad + ' productos';
  }

  function construirInterfaz() {
    if (document.getElementById('ia-float')) return;

    if (!window.DomiIABotonFlotante || typeof window.DomiIABotonFlotante.crear !== 'function') {
      console.error('[Asistente IA] No se cargó el módulo del botón flotante.');
      return;
    }
    const botonFlotante = window.DomiIABotonFlotante.crear(alternarPanel);

    const overlay = crearElemento('div', 'ia-overlay');
    overlay.id = 'ia-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const panel = crearElemento('section', 'ia-panel');
    panel.id = 'ia-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'ia-titulo');

    const header = crearElemento('header', 'ia-header');
    const tituloGrupo = crearElemento('div', 'ia-header-titulo');
    const icono = crearElemento('span', 'ia-header-icono');
    icono.innerHTML = '<i class="fas fa-comment-dots" aria-hidden="true"></i>';
    const textos = crearElemento('div', 'ia-header-textos');
    const titulo = crearElemento('strong', '', 'DOMI IA');
    titulo.id = 'ia-titulo';
    const cuota = crearElemento('span', 'ia-cuota', 'Buscando recomendaciones…');
    cuota.id = 'ia-cuota';
    textos.append(titulo, cuota);
    tituloGrupo.append(icono, textos);

    const acciones = crearElemento('div', 'ia-header-acciones');
    const limpiar = crearElemento('button', 'ia-btn-icono');
    limpiar.type = 'button';
    limpiar.title = 'Limpiar conversación';
    limpiar.setAttribute('aria-label', 'Limpiar conversación');
    limpiar.innerHTML = '<i class="fas fa-eraser" aria-hidden="true"></i>';
    const cerrarPanel = crearElemento('button', 'ia-btn-icono');
    cerrarPanel.type = 'button';
    cerrarPanel.title = 'Cerrar asistente';
    cerrarPanel.setAttribute('aria-label', 'Cerrar asistente');
    cerrarPanel.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    acciones.append(limpiar, cerrarPanel);
    header.append(tituloGrupo, acciones);

    const confirmar = crearElemento('div', 'ia-confirmar');
    confirmar.hidden = true;
    const confirmarTexto = crearElemento('span', '', '¿Vaciar la conversación?');
    const confirmarSi = crearElemento('button', 'ia-btn-mini ia-btn-peligro', 'Vaciar');
    confirmarSi.type = 'button';
    const confirmarNo = crearElemento('button', 'ia-btn-mini', 'Cancelar');
    confirmarNo.type = 'button';
    confirmar.append(confirmarTexto, confirmarSi, confirmarNo);

    const mensajes = crearElemento('div', 'ia-mensajes');
    mensajes.id = 'ia-mensajes';
    mensajes.setAttribute('aria-live', 'polite');
    mensajes.setAttribute('aria-relevant', 'additions');

    const chips = crearElemento('div', 'ia-chips');
    SUGERENCIAS.forEach(function (texto) {
      const chip = crearElemento('button', 'ia-chip', texto);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        elementos.input.value = texto;
        enviarConsulta(texto);
      });
      chips.appendChild(chip);
    });

    const entrada = crearElemento('form', 'ia-entrada');
    const input = crearElemento('input', 'ia-input');
    input.id = 'ia-input';
    input.type = 'text';
    input.name = 'consulta';
    input.maxLength = MAX_CONSULTA;
    input.placeholder = '¿Qué se te antoja?';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Escribe qué te gustaría pedir');
    const contador = crearElemento('span', 'ia-contador', '0/500');
    contador.id = 'ia-contador';
    const enviar = crearElemento('button', 'ia-enviar');
    enviar.type = 'submit';
    enviar.setAttribute('aria-label', 'Enviar consulta');
    enviar.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i>';
    entrada.append(input, contador, enviar);

    const checkout = crearElemento('button', 'ia-checkout', 'Ir al checkout');
    checkout.id = 'ia-checkout';
    checkout.type = 'button';
    checkout.hidden = true;

    panel.append(header, confirmar, mensajes, chips, checkout, entrada);

    const toast = crearElemento('div', 'ia-toast-fallback');
    toast.id = 'ia-toast-fallback';
    toast.setAttribute('role', 'status');
    document.body.append(overlay, panel, toast);

    elementos = {
      botonFlotante: botonFlotante,
      overlay: overlay,
      panel: panel,
      cuota: cuota,
      mensajes: mensajes,
      chips: chips,
      input: input,
      contador: contador,
      enviar: enviar,
      checkout: checkout,
      limpiar: limpiar,
      cerrarPanel: cerrarPanel,
      confirmar: confirmar,
      confirmarSi: confirmarSi,
      confirmarNo: confirmarNo,
      toast: toast
    };

    cerrarPanel.addEventListener('click', cerrar);
    overlay.addEventListener('click', cerrar);
    limpiar.addEventListener('click', function () {
      confirmar.hidden = false;
      confirmarNo.focus();
    });
    confirmarNo.addEventListener('click', function () {
      confirmar.hidden = true;
      limpiar.focus();
    });
    confirmarSi.addEventListener('click', limpiarConversacion);
    checkout.addEventListener('click', function () {
      actualizarBotonCheckout();
      if (checkout.hidden) {
        mostrarAviso('Agrega un producto al carrito antes de ir al checkout.');
        return;
      }
      if (typeof window.irACheckout !== 'function') {
        mostrarAviso('No se pudo abrir el checkout. Inténtalo desde el carrito.');
        return;
      }
      window.irACheckout();
    });
    window.addEventListener('domidelis:carrito-actualizado', actualizarBotonCheckout);
    window.addEventListener('storage', function (event) {
      if (event.key === 'carrito') actualizarBotonCheckout();
    });
    entrada.addEventListener('submit', function (event) {
      event.preventDefault();
      enviarConsulta(input.value);
    });
    input.addEventListener('input', actualizarContador);
    document.addEventListener('keydown', gestionarTeclado);

    agregarMensaje('ia', SALUDO_INICIAL);
    actualizarBotonCheckout();
    actualizarContador();
  }

  function abrirPanel() {
    elementos.panel.classList.add('abierta');
    elementos.overlay.classList.add('visible');
    elementos.botonFlotante.classList.add('oculto');
    elementos.botonFlotante.classList.remove('ia-pulso');
    elementos.botonFlotante.setAttribute('aria-expanded', 'true');
    elementos.overlay.setAttribute('aria-hidden', 'false');
    ajustarPanelAlViewport();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', ajustarPanelAlViewport);
      window.visualViewport.addEventListener('scroll', ajustarPanelAlViewport);
    }
    elementos.input.focus();
  }

  function ajustarPanelAlViewport() {
    if (!elementos || window.innerWidth > 480 || !window.visualViewport) return;

    const viewport = window.visualViewport;
    elementos.panel.style.top = Math.max(0, viewport.offsetTop) + 'px';
    elementos.panel.style.bottom = 'auto';
    elementos.panel.style.height = Math.max(240, viewport.height) + 'px';
    elementos.panel.style.maxHeight = 'none';
  }

  function cerrar() {
    if (!elementos) return;
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', ajustarPanelAlViewport);
      window.visualViewport.removeEventListener('scroll', ajustarPanelAlViewport);
    }
    elementos.panel.classList.remove('abierta');
    elementos.panel.style.top = '';
    elementos.panel.style.bottom = '';
    elementos.panel.style.height = '';
    elementos.panel.style.maxHeight = '';
    elementos.overlay.classList.remove('visible');
    elementos.botonFlotante.classList.remove('oculto');
    elementos.botonFlotante.setAttribute('aria-expanded', 'false');
    elementos.overlay.setAttribute('aria-hidden', 'true');
    elementos.botonFlotante.focus();
  }

  function alternarPanel() {
    if (elementos.panel.classList.contains('abierta')) cerrar();
    else abrirPanel();
  }

  function gestionarTeclado(event) {
    if (event.key === 'Escape' && elementos.panel.classList.contains('abierta')) cerrar();
  }

  function actualizarContador() {
    elementos.contador.textContent = elementos.input.value.length + '/' + MAX_CONSULTA;
  }

  function agregarMensaje(rol, texto, consultaParaCalificar) {
    const mensaje = crearElemento('div', 'ia-msg ' + rol);
    const contenido = crearElemento('div', 'ia-msg-texto', texto);
    mensaje.appendChild(contenido);
    if (rol === 'ia' && consultaParaCalificar) {
      agregarCalificacion(mensaje, consultaParaCalificar);
    }
    elementos.mensajes.appendChild(mensaje);
    desplazarMensajes();
    return mensaje;
  }

  /* Fila 👍/👎 bajo las respuestas del asistente */
  function agregarCalificacion(mensaje, consulta) {
    if (!window.DomiIAAprendizaje) return;
    const fila = crearElemento('div', 'ia-calificacion');
    fila.setAttribute('role', 'group');
    fila.setAttribute('aria-label', '¿Te sirvió esta respuesta?');
    const si = crearElemento('button', 'ia-cal-btn');
    si.type = 'button';
    si.title = 'Me sirvió';
    si.setAttribute('aria-label', 'Me sirvió esta respuesta');
    si.innerHTML = '<i class="fa-solid fa-thumbs-up" aria-hidden="true"></i>';
    const no = crearElemento('button', 'ia-cal-btn');
    no.type = 'button';
    no.title = 'No me sirvió';
    no.setAttribute('aria-label', 'No me sirvió esta respuesta');
    no.innerHTML = '<i class="fa-solid fa-thumbs-down" aria-hidden="true"></i>';
    function calificar(tipo) {
      window.DomiIAAprendizaje.registrarEvento(tipo, consulta);
      fila.replaceChildren(crearElemento(
        'span',
        'ia-cal-gracias',
        tipo === 'positivo' ? '¡Genial, gracias!' : 'Gracias, lo tendremos en cuenta'
      ));
    }
    si.addEventListener('click', function () { calificar('positivo'); });
    no.addEventListener('click', function () { calificar('negativo'); });
    fila.append(si, no);
    mensaje.appendChild(fila);
  }

  /* Señales automáticas tras cada respuesta completa */
  function registrarResultadoRespuesta(consulta, respuesta) {
    if (!window.DomiIAAprendizaje) return;
    const texto = window.DomiIARazonamiento.normalizarTexto(respuesta);
    if (/no encontre|no tengo|no hay|no pude encontrar|no cuento con/.test(texto)) {
      window.DomiIAAprendizaje.registrarEvento('sin_respuesta', consulta);
    }
    const preferencia = window.DomiIARazonamiento.normalizarTexto(consulta)
      .match(/\bsin (cebolla|cilantro|lactosa|azucar|carne|gluten|picante|sal)\b/);
    if (preferencia) {
      window.DomiIAAprendizaje.registrarPreferencia('sin ' + preferencia[1]);
    }
  }

  function mostrarEscritura() {
    const typing = crearElemento('div', 'ia-msg ia ia-typing');
    typing.setAttribute('aria-label', 'El asistente está escribiendo');
    for (let i = 0; i < 3; i += 1) typing.appendChild(document.createElement('span'));
    typing.appendChild(crearElemento('span', 'ia-typing-texto', 'Buscando opciones para ti…'));
    elementos.mensajes.appendChild(typing);
    desplazarMensajes();
    return typing;
  }

  async function leerRespuestaEnFlujo(response, estadoUI) {
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('El navegador no pudo leer la respuesta en tiempo real.');
    }

    const lector = response.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';
    let evento = 'message';
    let datosFinales = null;

    function procesarBloque(bloque) {
      let contenido = '';
      evento = 'message';
      bloque.split(/\r?\n/).forEach(function (linea) {
        if (linea.indexOf('event:') === 0) evento = linea.slice(6).trim();
        else if (linea.indexOf('data:') === 0) contenido += linea.slice(5).trim();
      });
      if (!contenido) return;

      const datos = JSON.parse(contenido);
      if (evento === 'delta') {
        if (!estadoUI.burbuja) {
          if (estadoUI.typing) estadoUI.typing.remove();
          estadoUI.typing = null;
          estadoUI.burbuja = agregarMensaje('ia', '');
        }
        const texto = estadoUI.burbuja.querySelector('.ia-msg-texto');
        texto.textContent += datos.texto || '';
        desplazarMensajes();
      } else if (evento === 'reset') {
        if (estadoUI.burbuja) estadoUI.burbuja.remove();
        estadoUI.burbuja = null;
        if (!estadoUI.typing || !estadoUI.typing.isConnected) {
          estadoUI.typing = mostrarEscritura();
        }
      } else if (evento === 'done') {
        datosFinales = datos;
      } else if (evento === 'error') {
        throw new Error(datos.error || 'No pude conectar con el asistente. Inténtalo de nuevo.');
      }
    }

    while (true) {
      const resultado = await lector.read();
      buffer += decodificador.decode(resultado.value || new Uint8Array(), { stream: !resultado.done });
      const bloques = buffer.split(/\r?\n\r?\n/);
      buffer = bloques.pop() || '';
      bloques.forEach(procesarBloque);
      if (resultado.done) break;
    }
    if (buffer.trim()) procesarBloque(buffer);
    if (!datosFinales) throw new Error('La respuesta del asistente llegó incompleta.');

    if (estadoUI.typing) {
      estadoUI.typing.remove();
      estadoUI.typing = null;
    }
    if (estadoUI.burbuja) {
      estadoUI.burbuja.querySelector('.ia-msg-texto').textContent =
        datosFinales.respuesta || 'Cuéntame un poco más de lo que buscas.';
    } else {
      estadoUI.burbuja = agregarMensaje(
        'ia',
        datosFinales.respuesta || 'Cuéntame un poco más de lo que buscas.'
      );
    }
    desplazarMensajes();
    return datosFinales;
  }

  function desplazarMensajes() {
    elementos.mensajes.scrollTop = elementos.mensajes.scrollHeight;
  }

  function mostrarAviso(texto) {
    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(texto, 'error');
      return;
    }
    elementos.toast.textContent = texto;
    elementos.toast.classList.add('visible');
    window.setTimeout(function () {
      elementos.toast.classList.remove('visible');
    }, 3500);
  }

  function mostrarProductos(ids) {
    const idsValidos = ids
      .map(function (id) { return String(id); })
      .filter(function (id) { return productosPorId.has(id); });
    if (idsValidos.length) ultimosProductosRecomendados = idsValidos;

    const nuevosIds = idsValidos.filter(function (id) {
      return !productosMostrados.has(id);
    });
    nuevosIds.forEach(function (id) {
      const producto = productosPorId.get(String(id));
      if (!producto) return;
      productosMostrados.add(String(id));

      const card = crearElemento('article', 'ia-card');
      const imageContainer = crearElemento('div', 'ia-card-img');
      const imageUrl = producto.imagen_url || producto.imagen || producto.icono;
      if (imageUrl && /^(https?:\/\/|data:image)/i.test(String(imageUrl))) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.onerror = function () {
          image.remove();
          imageContainer.innerHTML = '<i class="fas fa-utensils" aria-hidden="true"></i>';
        };
        imageContainer.appendChild(image);
      } else {
        imageContainer.innerHTML = '<i class="fas fa-utensils" aria-hidden="true"></i>';
      }

      const info = crearElemento('div', 'ia-card-info');
      info.appendChild(crearElemento('strong', 'ia-card-nombre', producto.nombre));
      if (producto.tiendaNombre) info.appendChild(crearElemento('span', 'ia-card-tienda', producto.tiendaNombre));
      info.appendChild(crearElemento('span', 'ia-card-precio', formatearPrecio(producto.precio)));

      const add = crearElemento('button', 'ia-card-agregar', 'Agregar');
      add.type = 'button';
      add.setAttribute('aria-label', 'Agregar ' + producto.nombre + ' al carrito');
      add.addEventListener('click', function () {
        if (window.DomiIAAprendizaje) {
          window.DomiIAAprendizaje.registrarEvento('conversion', ultimaConsulta, producto.nombre);
        }
        const original = productosPorId.get(String(id));
        if (original && window.DomiModal && typeof window.DomiModal.abrir === 'function') {
          window.DomiModal.abrir(original);
        } else {
          mostrarAviso('No se pudo abrir la personalización del producto.');
        }
      });

      card.append(imageContainer, info, add);
      elementos.mensajes.appendChild(card);
    });
    desplazarMensajes();
  }

  function gestionarSolicitudAgregar(consulta) {
    const interpretacion = window.DomiIARazonamiento.interpretarSolicitud(consulta);
    const texto = interpretacion.texto;
    if (!interpretacion.intencionAgregar) return false;

    const productosRecientes = ultimosProductosRecomendados
      .map(function (id) { return productosPorId.get(id); })
      .filter(Boolean);
    const porNombre = productosRecientes.filter(function (producto) {
      const nombre = window.DomiIARazonamiento.normalizarTexto(producto.nombre).trim();
      return nombre.length >= 3 && texto.includes(nombre);
    });

    const ordinales = [
      { patron: /\b(?:primero|primera|opcion uno|opcion 1)\b/, indice: 0 },
      { patron: /\b(?:segundo|segunda|opcion dos|opcion 2)\b/, indice: 1 },
      { patron: /\b(?:tercero|tercera|opcion tres|opcion 3)\b/, indice: 2 }
    ];
    const ordinal = ordinales.find(function (opcion) { return opcion.patron.test(texto); });
    const referencial = /\b(?:ese|esa|eso|este|esta|esto|lo|la|el producto)\b/.test(texto);
    let seleccionado = null;

    if (porNombre.length === 1) {
      seleccionado = porNombre[0];
    } else if (porNombre.length > 1) {
      agregarMensaje('user', consulta);
      agregarMensaje('ia', 'Veo varias opciones de ese producto: ' +
        porNombre.map(function (producto) { return producto.nombre + ' de ' + (producto.tiendaNombre || 'una tienda aliada'); }).join(', ') +
        '. Elige cuál quieres con el botón Agregar de su tarjeta.');
      historial.push({ rol: 'user', texto: consulta }, {
        rol: 'assistant',
        texto: 'Pedí aclarar cuál producto quiere agregar porque hay varias opciones.'
      });
      historial = historial.slice(-MAX_HISTORIAL);
      return true;
    } else if (ordinal && productosRecientes[ordinal.indice]) {
      seleccionado = productosRecientes[ordinal.indice];
    } else if (productosRecientes.length === 1 && (referencial || intencionAgregar)) {
      seleccionado = productosRecientes[0];
    }

    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    if (!seleccionado) {
      const respuesta = productosRecientes.length
        ? 'Claro. ¿Cuál quieres agregar: ' +
          productosRecientes.map(function (producto, indice) {
            return `${indice + 1}) ${producto.nombre}${producto.tiendaNombre ? ' de ' + producto.tiendaNombre : ''}`;
          }).join('; ') + '? También puedes tocar Agregar en su tarjeta.'
        : 'Claro. Primero dime qué producto quieres o cuéntame qué se te antoja para mostrarte opciones.';
      agregarMensaje('ia', respuesta);
      historial.push({ rol: 'assistant', texto: respuesta });
      historial = historial.slice(-MAX_HISTORIAL);
      return true;
    }

    if (!window.DomiModal || typeof window.DomiModal.abrir !== 'function') {
      const respuesta = 'No pude abrir ese producto ahora. Puedes tocar Agregar en su tarjeta e intentarlo de nuevo.';
      agregarMensaje('ia', respuesta);
      historial.push({ rol: 'assistant', texto: respuesta });
      historial = historial.slice(-MAX_HISTORIAL);
      return true;
    }

    window.DomiModal.abrir(seleccionado);
    const respuesta = 'Listo, te ayudo con ' + seleccionado.nombre +
      '. Revisa el carrito y, si aparecen opciones del producto, confírmalas para agregarlo.';
    agregarMensaje('ia', respuesta);
    historial.push({ rol: 'assistant', texto: respuesta });
    historial = historial.slice(-MAX_HISTORIAL);
    return true;
  }

  function formatearPrecio(valor) {
    if (typeof window.formatearPrecio === 'function') return window.formatearPrecio(valor);
    return '$' + (Number(valor) || 0).toLocaleString('es-CO');
  }

  function esCorreccionDeAlcance(consulta) {
    return /\b(quien dijo|quien te dijo|yo no dije|no dije que solo|no solo|no solamente|no unicamente|no exclusivamente|no me limites|no te limites|no necesariamente|amplia(?:r|me)? la busqueda|tambien quiero|tambien puede)\b/
      .test(window.DomiIARazonamiento.normalizarTexto(consulta));
  }

  function obtenerConsultaDeCatalogo(consulta) {
    if (!esCorreccionDeAlcance(consulta)) return consulta;
    const mensajeAnterior = historial.slice().reverse().find(function (mensaje) {
      return mensaje.rol === 'user';
    });
    return mensajeAnterior ? mensajeAnterior.texto + ' ' + consulta : consulta;
  }

  async function consultarEstado() {
    try {
      const response = await fetch(API_BASE + '/estado', {
        headers: encabezadosIA({ Accept: 'application/json' })
      });
      if (!response.ok) throw new Error('Estado del asistente no disponible (' + response.status + ')');
      const data = await response.json();
      if (data.configurada === true) {
        elementos.cuota.textContent = 'IA configurada';
      } else {
        elementos.cuota.textContent = 'Asistente en mantenimiento';
        elementos.cuota.classList.add('alerta');
      }
    } catch (error) {
      elementos.cuota.textContent = 'Conexión temporalmente no disponible';
      elementos.cuota.classList.add('alerta');
      console.warn('[Asistente IA] No se pudo consultar su estado:', error.message);
    }
  }

  async function enviarConsulta(texto) {
    const consulta = String(texto || '').trim();
    if (!consulta || enviando) return;
    if (consulta.length > MAX_CONSULTA) {
      mostrarAviso('Escribe una consulta de máximo 500 caracteres.');
      return;
    }

    const haceUnMomento = !!ultimaConsulta && (Date.now() - ultimoEnvioTs) < 90000;
    const repitePalabra = haceUnMomento && window.DomiIARazonamiento.normalizarTexto(consulta)
      .split(/\s+/)
      .some(function (palabra) {
        return palabra.length > 3 &&
          window.DomiIARazonamiento.normalizarTexto(ultimaConsulta).includes(palabra);
      });
    if (repitePalabra && window.DomiIAAprendizaje) {
      window.DomiIAAprendizaje.registrarEvento('reformulacion', consulta, ultimaConsulta);
    }
    ultimaConsulta = consulta;
    ultimoEnvioTs = Date.now();

    const tipoPreguntaProducto = window.DomiIARazonamiento.clasificarPreguntaProducto(consulta);
    if (tipoPreguntaProducto) {
      const respuestaProducto = window.DomiIACatalogo.responderPreguntaProducto(
        consulta,
        ultimosProductosRecomendados
      );
      elementos.chips.hidden = true;
      elementos.input.value = '';
      actualizarContador();
      agregarMensaje('user', consulta);
      historial.push({ rol: 'user', texto: consulta });
      agregarMensaje('ia', respuestaProducto.respuesta, consulta);
      historial.push({ rol: 'assistant', texto: respuestaProducto.respuesta });
      historial = historial.slice(-MAX_HISTORIAL);
      return;
    }

    const consultaCatalogo = obtenerConsultaDeCatalogo(consulta);
    const idsExcluidos = Array.from(productosMostrados);
    const catalogo = window.DomiIACatalogo.buscar(consultaCatalogo, {
      excluirIds: idsExcluidos,
      incluirIds: []
    });
    const candidatos = catalogo.candidatos;
    productosPorId = catalogo.productosPorId;
    if (gestionarSolicitudAgregar(consulta)) {
      elementos.input.value = '';
      actualizarContador();
      elementos.chips.hidden = true;
      return;
    }
    ultimosProductosRecomendados = [];

    if (!candidatos.length && !catalogo.hayCatalogo &&
        !window.DomiIARazonamiento.esSaludoSimple(consulta)) {
      agregarMensaje('user', consulta);
      agregarMensaje('ia', 'Todavía estoy cargando las opciones del catálogo. Inténtalo de nuevo en unos segundos.');
      return;
    }

    elementos.chips.hidden = true;
    elementos.input.value = '';
    actualizarContador();
    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    const respuestaDirecta = window.DomiIACatalogo.recomendarDirectamente(
      consultaCatalogo,
      catalogo,
      historial.slice(0, -1),
      { excluirIds: idsExcluidos }
    );
    if (respuestaDirecta) {
      agregarMensaje('ia', respuestaDirecta.respuesta, consulta);
      historial.push({ rol: 'assistant', texto: respuestaDirecta.respuesta });
      historial = historial.slice(-MAX_HISTORIAL);
      mostrarProductos(respuestaDirecta.ids);
      return;
    }

    const estadoUI = { typing: mostrarEscritura(), burbuja: null };
    enviando = true;
    elementos.enviar.disabled = true;

    try {
      const response = await fetch(API_BASE + '/consultar', {
        method: 'POST',
        headers: encabezadosIA({ 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' }),
        body: JSON.stringify({
          consulta: consulta,
          candidatos: candidatos,
          contextoNegocio: Object.assign(window.DomiIARazonamiento.completarContextoConCatalogo(
            window.DomiIARazonamiento.crearContextoNegocio(
              typeof tiendas !== 'undefined' ? tiendas : []
            ),
            catalogo
          ), {
            conocimiento: await window.DomiIARazonamiento.obtenerConocimiento(consulta)
          }),
          historial: historial.slice(-MAX_HISTORIAL)
        })
      });
      const esFlujo = (response.headers.get('content-type') || '').includes('text/event-stream');
      const data = esFlujo
        ? await leerRespuestaEnFlujo(response, estadoUI)
        : await response.json().catch(function () { return {}; });
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || 'No pude consultar el asistente. Inténtalo de nuevo.');
      }

      if (!estadoUI.burbuja) {
        if (estadoUI.typing) estadoUI.typing.remove();
        estadoUI.typing = null;
        estadoUI.burbuja = agregarMensaje('ia', data.respuesta || 'Cuéntame un poco más de lo que buscas.');
      }
      registrarResultadoRespuesta(consulta, data.respuesta || '');
      agregarCalificacion(estadoUI.burbuja, consulta);
      historial.push({ rol: 'assistant', texto: data.respuesta || '' });
      historial = historial.slice(-MAX_HISTORIAL);
      if (Array.isArray(data.ids)) mostrarProductos(data.ids);
      if (typeof data.restantesHoy === 'number') actualizarCuota(data.restantesHoy);
    } catch (error) {
      if (estadoUI.typing) estadoUI.typing.remove();
      if (estadoUI.burbuja) estadoUI.burbuja.remove();
      agregarMensaje('ia', error.message || 'No pude conectar con el asistente. Inténtalo de nuevo.');
      console.error('[Asistente IA] Error al enviar consulta:', error);
    } finally {
      enviando = false;
      elementos.enviar.disabled = false;
      elementos.input.focus();
    }
  }

  function actualizarCuota(restantes) {
    if (restantes <= 0) {
      elementos.cuota.textContent = 'Límite diario alcanzado';
      elementos.cuota.classList.add('agotada');
    } else if (restantes <= 50) {
      elementos.cuota.textContent = 'Quedan ' + restantes + ' recomendaciones hoy';
      elementos.cuota.classList.add('alerta');
    }
  }

  function limpiarConversacion() {
    historial = [{ rol: 'assistant', texto: SALUDO_INICIAL }];
    ultimosProductosRecomendados = [];
    productosMostrados.clear();
    elementos.mensajes.replaceChildren();
    elementos.chips.hidden = false;
    elementos.confirmar.hidden = true;
    agregarMensaje('ia', SALUDO_INICIAL);
    elementos.input.focus();
  }

  function iniciar() {
    if (!window.DomiIARazonamiento || !window.DomiIACatalogo) {
      console.error('[Asistente IA] No se cargaron los módulos de catálogo y razonamiento.');
      return;
    }
    construirInterfaz();
    consultarEstado();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();