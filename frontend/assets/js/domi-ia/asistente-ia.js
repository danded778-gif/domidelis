/* =====================================================================
   DOMIDELIS · asistente-ia.js — integración (2026-11-10)
   ★ NUEVO en esta versión (se trabaja sobre el mismo código que ya
   tienes; los cambios están marcados con ★):
   1. Autollenado del checkout (Fase 5): si el cliente escribe sus datos
      en el chat, se guardan cifrados con la clave 'domidelis_cliente'
      (la misma que usa el checkout) y, si la página tiene los campos,
      se rellenan y se dispara el evento change que ejecuta el autoguardado.
      La extracción es local por patrones: nunca inventa datos.
   2. Blindaje anti-pensamiento: ningún texto tipo <think>…</think> se
      muestra en el chat ni vuelve a entrar al historial (el servidor
      v1.4 ya limpia; esto es la segunda capa).
   3. Corrección: en gestionarSolicitudAgregar se usaba la variable
      'intencionAgregar' sin definir (crash en mensajes tipo "ponme X"
      con un solo producto reciente). Ahora usa
      interpretacion.intencionAgregar.
   ---------------------------------------------------------------------
   ★ v2 (11-11-2026) — tiendas cerradas, descripciones y zoom de fotos:
   1. Regla de la verdad para tiendas CERRADAS: si el cliente nombra un
      producto que SOLO existe en tiendas cerradas (ej. Shawarma de
      Astro un martes o antes de las 16:00), DOMI IA responde con la
      descripción real del catálogo y la hora real de apertura
      ("Astro abre a las 16:00") y muestra la tarjeta SIN botón Agregar:
      ningún producto de tienda cerrada entra al carrito por el chat.
      Si alguna tienda ABIERTA tiene ese producto, el flujo normal
      sigue igual (misma regla que iaCatalogo v1.6).
   2. Las tarjetas del chat ahora muestran la descripción real del
      producto cuando el catálogo la trae (se omite solo si es vacía o
      del tipo "1 und").
   3. Las fotos de las tarjetas del chat abren el visor de imágenes
      (visor-imagenes.js). Si ese archivo no está cargado, nada se
      rompe: el zoom simplemente no aparece.
   4. LA IA VE EL CARRITO: cuando el cliente agrega un producto nuevo,
      DOMI IA dice "¡Vi que agregaste X! Tu pedido lleva: …" y, SOLO si
      en el carrito hay comida (y no hay ya una bebida ni un helado),
      pregunta "¿Deseas algo de tomar?" y muestra 2 bebidas reales de
      tiendas abiertas (gaseosas primero). Reglas tomadas de tu
      palabra: bebidas SOLO con comida; con helados, NUNCA gaseosa.
      Clasificación con datos reales del catálogo (por id de producto):
      Bebidas/Cervezas/Licores = bebida; "helad" en nombre o descripción
      = helado (Luna Cremosa, categoría Detalles); Menu/Almuerzo/Otras =
      comida (las hamburguesas reales viven en "Otras"), excepto lo que
      no es comida en el catálogo real (Peluche, Flores, Cubeta de
      Huevos, Encargo Express). Se informa cada aumento o nueva línea del
      carrito; la bebida se ofrece una sola vez por pedido y, si el chat
      está cerrado, el mensaje espera y aparece al abrirlo.
   ===================================================================== */
'use strict';

(function () {
  const API_BASE = IA_API_URL;
  const MAX_CONSULTA = 500;
  const MAX_HISTORIAL = 10;
  const CLAVE_CONVERSACION = 'domidelis_ia_conversacion';
  const VERSION_CONVERSACION = 1;
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
  /* ★ v2: palabras de función (misma lista que usa iaCatalogo v1.6)
     para no confundir palabras comunes con nombres de producto. */
  const PALABRAS_FUNCION_CHAT = new Set([
    'hola', 'como', 'estas', 'quiero', 'quisiera', 'ver', 'si', 'tienen', 'hay',
    'muestra', 'muestrame', 'mostrar', 'catalogo', 'recomendados', 'recomiendame',
    'opciones', 'productos', 'producto', 'porfa', 'favor', 'claro', 'dale', 'listo',
    'gracias', 'que', 'del', 'las', 'los', 'una', 'uno', 'para', 'por', 'de', 'el',
    'la', 'en', 'me', 'puedes', 'podrias', 'algo', 'rico', 'rica'
  ]);
  const TIPO_NO_LISTABLE = /^(extra|salsa|opcion)$/;
  let productosMostrados = new Set();
  let enviando = false;
  let ultimaConsulta = '';
  let ultimoEnvioTs = 0;
  let observadorConversacion;
  let temporizadorGuardarConversacion;
  let revisionConversacion = 0;
  let colaGuardadoConversacion = Promise.resolve();

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

  function serializarNodoConversacion(nodo) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      return { tipo: 'texto', valor: nodo.nodeValue || '' };
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE || nodo.classList.contains('ia-typing')) return null;

    const atributos = {};
    ['class', 'role', 'aria-label', 'aria-hidden', 'title', 'alt', 'type',
      'disabled', 'data-product-id', 'data-product-json', 'data-consulta'].forEach(function (nombre) {
      if (nodo.hasAttribute(nombre)) atributos[nombre] = nodo.getAttribute(nombre);
    });
    if (nodo.tagName === 'IMG') {
      const src = nodo.getAttribute('src') || '';
      if (/^(https?:\/\/|data:image\/)/i.test(src)) atributos.src = src;
    }

    return {
      tipo: 'elemento',
      etiqueta: nodo.tagName.toLowerCase(),
      atributos: atributos,
      hijos: Array.from(nodo.childNodes).map(serializarNodoConversacion).filter(Boolean)
    };
  }

  function restaurarNodoConversacion(datos, nivel, presupuesto) {
    if (!datos || nivel > 20 || presupuesto.restantes <= 0) return null;
    presupuesto.restantes -= 1;
    if (datos.tipo === 'texto' && typeof datos.valor === 'string') {
      return document.createTextNode(datos.valor.slice(0, 10000));
    }
    const etiquetasPermitidas = new Set(['div', 'article', 'span', 'button', 'img', 'i', 'strong']);
    if (datos.tipo !== 'elemento' || !etiquetasPermitidas.has(datos.etiqueta)) return null;

    const elemento = document.createElement(datos.etiqueta);
    const atributos = datos.atributos && typeof datos.atributos === 'object' ? datos.atributos : {};
    ['class', 'role', 'aria-label', 'aria-hidden', 'title', 'alt', 'type',
      'data-product-id', 'data-product-json', 'data-consulta'].forEach(function (nombre) {
      if (typeof atributos[nombre] === 'string' && atributos[nombre].length <= 50000) {
        elemento.setAttribute(nombre, atributos[nombre]);
      }
    });
    if (atributos.disabled === '' || atributos.disabled === 'true') elemento.disabled = true;
    if (datos.etiqueta === 'img' && typeof atributos.src === 'string' &&
        /^(https?:\/\/|data:image\/)/i.test(atributos.src)) {
      elemento.setAttribute('src', atributos.src);
    }
    if (Array.isArray(datos.hijos)) {
      datos.hijos.forEach(function (hijo) {
        const restaurado = restaurarNodoConversacion(hijo, nivel + 1, presupuesto);
        if (restaurado) elemento.appendChild(restaurado);
      });
    }
    return elemento;
  }

  function guardarConversacion() {
    if (!elementos) return;
    const estado = {
      version: VERSION_CONVERSACION,
      historial: historial.slice(-MAX_HISTORIAL),
      mensajes: Array.from(elementos.mensajes.children)
        .map(serializarNodoConversacion).filter(Boolean),
      chipsOcultos: elementos.chips.hidden,
      productosMostrados: Array.from(productosMostrados),
      productosVistos: Array.from(productosVistosEnSesion),
      ultimosProductosRecomendados: ultimosProductosRecomendados,
      ultimaConsulta: ultimaConsulta,
      ultimoEnvioTs: ultimoEnvioTs,
      bebidaSugerida: bebidaSugerida,
      ofertaBebidaPendiente: ofertaBebidaPendiente,
      mensajeCarritoPendiente: mensajeCarritoPendiente,
      solicitarDatosPedido: solicitarDatosPedido,
      solicitarObservacionesPedido: solicitarObservacionesPedido
    };
    if (!window.DomiAlmacenSeguro) {
      console.error('[Asistente IA] No se guardó la conversación porque falta el almacenamiento cifrado.');
      return;
    }
    const revision = ++revisionConversacion;
    colaGuardadoConversacion = colaGuardadoConversacion.catch(function () {}).then(async function () {
      if (revision !== revisionConversacion) return;
      await window.DomiAlmacenSeguro.guardarSesion(CLAVE_CONVERSACION, estado);
    });
    colaGuardadoConversacion.catch(function (error) {
      console.warn('[Asistente IA] No se pudo guardar la conversación de esta sesión:', error);
      mostrarAviso('No se pudo proteger la conversación en este navegador.');
    });
  }

  function programarGuardadoConversacion() {
    window.clearTimeout(temporizadorGuardarConversacion);
    temporizadorGuardarConversacion = window.setTimeout(guardarConversacion, 100);
  }

  function restaurarInteraccionesConversacion() {
    elementos.mensajes.querySelectorAll('.ia-card').forEach(function (tarjeta) {
      let producto;
      try {
        producto = JSON.parse(tarjeta.dataset.productJson || 'null');
      } catch (error) {
        console.warn('[Asistente IA] No se pudo restaurar un producto de la conversación:', error);
        return;
      }
      if (!producto || producto.id === undefined || !producto.nombre) return;
      const id = String(producto.id);
      productosPorId.set(id, producto);
      const botonAgregar = tarjeta.querySelector('.ia-card-agregar');
      if (botonAgregar) {
        botonAgregar.addEventListener('click', function () {
          if (window.DomiIAAprendizaje) {
            window.DomiIAAprendizaje.registrarEvento('conversion', ultimaConsulta, producto.nombre);
          }
          if (window.DomiModal && typeof window.DomiModal.abrir === 'function') {
            window.DomiModal.abrir(producto);
          } else {
            mostrarAviso('No se pudo abrir la personalización del producto.');
          }
        });
      }
      const imagen = tarjeta.querySelector('.ia-card-img img');
      if (imagen) activarZoom(imagen.parentElement, imagen, producto.nombre);
    });
    elementos.mensajes.querySelectorAll('.ia-calificacion').forEach(function (fila) {
      const consulta = fila.dataset.consulta || '';
      const botones = fila.querySelectorAll('.ia-cal-btn');
      botones.forEach(function (boton, indice) {
        boton.addEventListener('click', function () {
          if (window.DomiIAAprendizaje) {
            window.DomiIAAprendizaje.registrarEvento(indice === 0 ? 'positivo' : 'negativo', consulta);
          }
          fila.replaceChildren(crearElemento(
            'span',
            'ia-cal-gracias',
            indice === 0 ? '¡Genial, gracias!' : 'Gracias, lo tendremos en cuenta'
          ));
          programarGuardadoConversacion();
        });
      });
    });
  }

  async function restaurarConversacion() {
    let estado;
    try {
      if (!window.DomiAlmacenSeguro) {
        throw new Error('No se cargó el almacenamiento cifrado.');
      }
      estado = await window.DomiAlmacenSeguro.leerSesion(CLAVE_CONVERSACION);
    } catch (error) {
      console.warn('[Asistente IA] No se pudo leer la conversación guardada:', error);
      throw error;
    }
    if (!estado || estado.version !== VERSION_CONVERSACION ||
        !Array.isArray(estado.historial) || !Array.isArray(estado.mensajes)) return false;

    historial = estado.historial.filter(function (mensaje) {
      return mensaje && (mensaje.rol === 'user' || mensaje.rol === 'assistant') &&
        typeof mensaje.texto === 'string';
    }).slice(-MAX_HISTORIAL);
    if (!historial.length) return false;
    elementos.mensajes.replaceChildren();
    const presupuesto = { restantes: 2000 };
    estado.mensajes.forEach(function (mensaje) {
      const restaurado = restaurarNodoConversacion(mensaje, 0, presupuesto);
      if (restaurado) elementos.mensajes.appendChild(restaurado);
    });
    if (!elementos.mensajes.childNodes.length) return false;
    productosMostrados = new Set(Array.isArray(estado.productosMostrados)
      ? estado.productosMostrados.map(String) : []);
    productosVistosEnSesion = new Set(Array.isArray(estado.productosVistos)
      ? estado.productosVistos.map(String) : []);
    ultimosProductosRecomendados = Array.isArray(estado.ultimosProductosRecomendados)
      ? estado.ultimosProductosRecomendados.map(String) : [];
    ultimaConsulta = typeof estado.ultimaConsulta === 'string' ? estado.ultimaConsulta : '';
    ultimoEnvioTs = Number(estado.ultimoEnvioTs) || 0;
    bebidaSugerida = estado.bebidaSugerida === true;
    ofertaBebidaPendiente = estado.ofertaBebidaPendiente === true;
    mensajeCarritoPendiente = estado.mensajeCarritoPendiente || null;
    solicitarDatosPedido = estado.solicitarDatosPedido === true;
    solicitarObservacionesPedido = estado.solicitarObservacionesPedido === true;
    elementos.chips.hidden = estado.chipsOcultos === true;
    restaurarInteraccionesConversacion();
    desplazarMensajes();
    return true;
  }

  function iniciarPersistenciaConversacion() {
    if (observadorConversacion) observadorConversacion.disconnect();
    observadorConversacion = new MutationObserver(programarGuardadoConversacion);
    observadorConversacion.observe(elementos.mensajes, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled']
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') guardarConversacion();
    });
    window.addEventListener('pagehide', guardarConversacion);
    programarGuardadoConversacion();
  }

  /* ★ v2 punto 4 — LA IA VE EL CARRITO (mismo evento que ya usa el
     botón de checkout: 'domidelis:carrito-actualizado'). */
  let carritoInicializado = false;
  let itemsCarritoPrevios = new Map();
  let bebidaSugerida = false;
  let ofertaBebidaPendiente = false;
  let mensajeCarritoPendiente = null;
  let productosVistosEnSesion = new Set();
  let solicitarDatosPedido = false;
  let solicitarObservacionesPedido = false;

  const NO_SON_COMIDA = /peluche|flores?|cubeta|encargo/;

  function obtenerCarritoSeguro() {
    if (typeof window.obtenerCarrito !== 'function') return [];
    try {
      const carrito = window.obtenerCarrito();
      return Array.isArray(carrito) ? carrito : [];
    } catch (error) {
      return [];
    }
  }

  /* ★ Mapa id → producto real del catálogo publicado (la misma fuente
     de iaCatalogo: productosGlobal + tiendas[].productos). El ítem del
     carrito NO trae categoría, así que se busca el producto por id. */
  function mapaProductosCarrito() {
    const mapa = new Map();
    const agregarProducto = function (producto, tienda) {
      if (!producto || producto.id === undefined || !producto.nombre) return;
      const clave = String(producto.id);
      if (mapa.has(clave)) return;
      mapa.set(clave, Object.assign({}, producto, {
        tiendaId: producto.tiendaId || tienda.id,
        tiendaNombre: producto.tiendaNombre || tienda.nombre
      }));
    };
    const lista = typeof tiendas !== 'undefined' && Array.isArray(tiendas) ? tiendas : [];
    lista.forEach(function (tienda) {
      (Array.isArray(tienda.productos) ? tienda.productos : []).forEach(function (producto) {
        agregarProducto(producto, tienda);
      });
    });
    if (typeof productosGlobal !== 'undefined' && Array.isArray(productosGlobal)) {
      productosGlobal.forEach(function (producto) {
        agregarProducto(producto, { id: producto.tiendaId, nombre: producto.tiendaNombre });
      });
    }
    return mapa;
  }

  /* ★ Clasificación del ítem con datos reales del catálogo:
     'bebida' | 'helado' | 'comida' | 'otro'. */
  function clasificarProductoCarrito(producto) {
    if (!producto) return 'otro';
    const categoria = window.DomiIARazonamiento.normalizarTexto(producto.categoria);
    if (categoria === 'bebidas' || categoria === 'cervezas' || categoria === 'licores') return 'bebida';
    const texto = window.DomiIARazonamiento.normalizarTexto(
      producto.nombre + ' ' + (producto.descripcion || ''));
    if (texto.indexOf('helad') !== -1) return 'helado';
    if ((categoria === 'menu' || categoria === 'almuerzo' || categoria === 'otras') &&
        !NO_SON_COMIDA.test(texto)) return 'comida';
    return 'otro';
  }

  function construirResumenCarrito(carrito, mapa) {
    return carrito.map(function (item) {
      const producto = mapa.get(String(item.id));
      const nombre = producto ? producto.nombre : item.nombre;
      const cantidad = Number(item.cantidad) || 1;
      return cantidad > 1 ? cantidad + '\u00d7 ' + nombre : nombre;
    }).join(', ');
  }

  function opcionesSeleccionadas(item) {
    const selecciones = item.selecciones && typeof item.selecciones === 'object'
      ? item.selecciones
      : {};
    return Object.keys(selecciones).sort().reduce(function (opciones, grupo) {
      const seleccion = Array.isArray(selecciones[grupo]) ? selecciones[grupo] : [];
      seleccion.forEach(function (opcion) {
        if (!opcion || !opcion.nombre) return;
        const cantidad = Number(opcion.cantidad) || 1;
        opciones.push((grupo ? grupo + ': ' : '') + opcion.nombre +
          (cantidad > 1 ? ' × ' + cantidad : ''));
      });
      return opciones;
    }, []);
  }

  function construirRespuestaCarrito() {
    const carrito = obtenerCarritoSeguro();
    if (!carrito.length) {
      return 'Tu carrito está vacío por ahora. Cuéntame qué se te antoja y te muestro opciones disponibles.';
    }

    const mapa = mapaProductosCarrito();
    const lineas = carrito.map(function (item) {
      const cantidad = Number(item.cantidad) || 1;
      const nombre = (mapa.get(String(item.id)) || item).nombre || 'Producto';
      const opciones = opcionesSeleccionadas(item);
      const subtotalGuardado = item.subtotal === undefined || item.subtotal === null || item.subtotal === ''
        ? NaN
        : Number(item.subtotal);
      const precioUnitario = Number(item.precioUnitario || item.precioBase || item.precio) || 0;
      const subtotal = Number.isFinite(subtotalGuardado)
        ? subtotalGuardado
        : precioUnitario * cantidad;
      return (cantidad > 1 ? cantidad + ' × ' : '') + nombre +
        (opciones.length ? ' (' + opciones.join(', ') + ')' : '') +
        ' — ' + formatearPrecio(subtotal);
    });
    const total = carrito.reduce(function (suma, item) {
      const subtotal = item.subtotal === undefined || item.subtotal === null || item.subtotal === ''
        ? NaN
        : Number(item.subtotal);
      const cantidad = Number(item.cantidad) || 1;
      const precioUnitario = Number(item.precioUnitario || item.precioBase || item.precio) || 0;
      return suma + (Number.isFinite(subtotal) ? subtotal : precioUnitario * cantidad);
    }, 0);
    return 'En tu carrito tienes: ' + lineas.join('; ') +
      '. Subtotal de productos (sin domicilio): ' + formatearPrecio(total) +
      '. Puedes añadir algo más o tocar “Ir al checkout” para completar tu pedido.';
  }

  function responderPreguntaCarrito(consulta) {
    const respuesta = construirRespuestaCarrito();
    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    agregarMensaje('ia', respuesta, consulta);
    historial.push({ rol: 'assistant', texto: respuesta });
    historial = historial.slice(-MAX_HISTORIAL);
    elementos.chips.hidden = true;
    elementos.input.value = '';
    actualizarContador();
    actualizarBotonCheckout();
  }

  function claveItemCarrito(item) {
    const selecciones = item.selecciones && typeof item.selecciones === 'object'
      ? item.selecciones
      : {};
    const seleccionesClave = Object.keys(selecciones).sort().map(function (grupo) {
      return grupo + ':' + (Array.isArray(selecciones[grupo]) ? selecciones[grupo] : [])
        .map(function (opcion) {
          return [
            String(opcion.nombre || ''),
            String(opcion.cantidad || 1),
            String(opcion.precio || 0)
          ].join('|');
        }).sort().join(',');
    }).join(';');
    return [
      String(item.id),
      String(item.cantidadTipo || ''),
      seleccionesClave
    ].join('\u001f');
  }

  function indexarCarrito(carrito) {
    const items = new Map();
    carrito.forEach(function (item) {
      items.set(claveItemCarrito(item), {
        item: item,
        cantidad: Number(item.cantidad) || 1
      });
    });
    return items;
  }

  function inicializarSeguimientoCarrito() {
    itemsCarritoPrevios = indexarCarrito(obtenerCarritoSeguro());
    carritoInicializado = true;
  }

  /* ★ Bebidas reales de tiendas ABIERTAS (gaseosas primero), máximo 2.
     Si la tienda de la bebida está cerrada, la bebida no se ofrece. */
  function bebidasParaSugerir(mapa) {
    const candidatos = [];
    mapa.forEach(function (producto) {
      if (window.DomiIARazonamiento.normalizarTexto(producto.categoria) !== 'bebidas') return;
      if (producto.activo === false) return;
      if (window.DomiIARazonamiento.normalizarTexto(producto.badge) === 'agotado') return;
      const tienda = (typeof tiendas !== 'undefined' && Array.isArray(tiendas)
        ? tiendas : []).find(function (t) { return String(t.id) === String(producto.tiendaId); });
      if (!tienda || tienda.activo === false || tiendaEstaOculta(tienda)) return;
      if (!window.DomiIACatalogo.estadoTienda(tienda).isOpen) return;
      candidatos.push(producto);
    });
    function rotar(lista) {
      if (lista.length < 2) return lista;
      const inicio = Math.floor(Math.random() * lista.length);
      return lista.slice(inicio).concat(lista.slice(0, inicio));
    }
    const gaseosas = candidatos.filter(function (producto) {
      return /gaseosa/i.test(producto.nombre);
    });
    const otras = candidatos.filter(function (producto) {
      return !/gaseosa/i.test(producto.nombre);
    });
    return rotar(gaseosas).concat(rotar(otras)).slice(0, 2);
  }

  function mostrarProductosCarrito(productos) {
    productos.forEach(function (producto) {
      const clave = String(producto.id);
      productosPorId.set(clave, producto);
      productosMostrados.delete(clave);
    });
    mostrarProductos(productos.map(function (producto) { return String(producto.id); }));
  }

  async function gestionarCambioCarrito() {
    const carrito = obtenerCarritoSeguro();
    const mapa = mapaProductosCarrito();
    const itemsActuales = indexarCarrito(carrito);

    if (!carritoInicializado) {
      carritoInicializado = true;
      itemsCarritoPrevios = itemsActuales;
      return;
    }
    if (!carrito.length) {
      itemsCarritoPrevios = itemsActuales;
      bebidaSugerida = false;
      ofertaBebidaPendiente = false;
      mensajeCarritoPendiente = null;
      solicitarDatosPedido = false;
      solicitarObservacionesPedido = false;
      return;
    }

    const adiciones = [];
    itemsActuales.forEach(function (actual, clave) {
      const previo = itemsCarritoPrevios.get(clave);
      const cantidadAnterior = previo ? previo.cantidad : 0;
      if (actual.cantidad > cantidadAnterior) {
        adiciones.push({
          item: actual.item,
          cantidad: actual.cantidad - cantidadAnterior
        });
      }
    });
    itemsCarritoPrevios = itemsActuales;
    if (!adiciones.length) return;

    const resumenAdiciones = adiciones.map(function (adicion) {
      const producto = mapa.get(String(adicion.item.id));
      const nombre = producto ? producto.nombre : adicion.item.nombre;
      return (adicion.cantidad > 1 ? adicion.cantidad + '\u00d7 ' : '') + nombre;
    }).join(', ');

    let mensaje = '\u00a1Agregaste ' + resumenAdiciones + '! Tu pedido lleva: ' +
      construirResumenCarrito(carrito, mapa) + '.';

    /* ★ Reglas de tu palabra: la bebida SOLO se ofrece si hay comida en
       el carrito, si NO hay ya bebida, si NO hay helado (a los helados
       no se les ofrece gaseosa) y solo la primera vez por pedido. */
    const clases = carrito.map(function (item) {
      return clasificarProductoCarrito(mapa.get(String(item.id)));
    });
    let idsBebidas = [];
    if (!bebidaSugerida &&
        clases.indexOf('comida') !== -1 &&
        clases.indexOf('bebida') === -1 &&
        clases.indexOf('helado') === -1) {
      const bebidas = bebidasParaSugerir(mapa);
      if (bebidas.length) {
        bebidaSugerida = true;
        ofertaBebidaPendiente = true;
        mensaje += ' \u00bfDeseas algo de tomar? Te muestro las bebidas disponibles:';
        idsBebidas = bebidas;
      }
    } else if (clases.indexOf('bebida') !== -1) {
      ofertaBebidaPendiente = false;
    }

    if (!idsBebidas.length) {
      mensaje += ' ' + await construirSolicitudDatosPedido();
    }

    if (elementos && elementos.panel.classList.contains('abierta')) {
      agregarMensaje('ia', mensaje);
      historial.push({ rol: 'assistant', texto: mensaje });
      historial = historial.slice(-MAX_HISTORIAL);
      if (idsBebidas.length) mostrarProductosCarrito(idsBebidas);
    } else {
      mensajeCarritoPendiente = {
        texto: mensajeCarritoPendiente
          ? mensajeCarritoPendiente.texto + ' ' + mensaje
          : mensaje,
        bebidas: idsBebidas.length
          ? idsBebidas
          : (mensajeCarritoPendiente ? mensajeCarritoPendiente.bebidas : [])
      };
    }
  }

  function entregarMensajeCarritoPendiente() {
    if (!mensajeCarritoPendiente || !elementos) return;
    const pendiente = mensajeCarritoPendiente;
    mensajeCarritoPendiente = null;
    agregarMensaje('ia', pendiente.texto);
    historial.push({ rol: 'assistant', texto: pendiente.texto });
    historial = historial.slice(-MAX_HISTORIAL);
    if (pendiente.bebidas.length) mostrarProductosCarrito(pendiente.bebidas);
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

    /* ★ v2: estilos de los elementos nuevos (descripción, etiqueta de
       tienda cerrada, zoom de foto). Colores neutrales con opacity y
       currentColor para convivir con cualquier tema sin tocar las hojas
       de estilo existentes (CAPAS). */
    const estilos = document.createElement('style');
    estilos.id = 'ia-estilos-v2';
    estilos.textContent =
      '.ia-card-desc{display:block;font-size:12px;opacity:.75;line-height:1.35;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
      '.ia-card-img.ia-zoom{cursor:zoom-in;}' +
      '.ia-card-img.ia-zoom img{transition:transform .15s ease;}' +
      '.ia-card-img.ia-zoom:hover img{transform:scale(1.04);}' +
      '.ia-card-agregar:disabled{opacity:.55;cursor:not-allowed;filter:grayscale(.25);}' +
      '.ia-card-cerrada{align-self:center;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;border:1px dashed currentColor;color:inherit;opacity:.7;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:600;text-align:center;max-width:110px;}';
    document.head.appendChild(estilos);

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
    inicializarSeguimientoCarrito();
    window.addEventListener('domidelis:carrito-actualizado', function () {
      gestionarCambioCarrito().catch(function (error) {
        console.error('[Asistente IA] No se pudo actualizar el mensaje del carrito:', error);
        mostrarAviso('No se pudieron recuperar los datos protegidos del pedido.');
      });
    });
    window.addEventListener('storage', function (event) {
      if (event.key === 'carrito') {
        actualizarBotonCheckout();
        gestionarCambioCarrito().catch(function (error) {
          console.error('[Asistente IA] No se pudo actualizar el mensaje del carrito:', error);
          mostrarAviso('No se pudieron recuperar los datos protegidos del pedido.');
        }); /* ★ v2 */
      }
    });
    entrada.addEventListener('submit', function (event) {
      event.preventDefault();
      enviarConsulta(input.value);
    });
    input.addEventListener('input', actualizarContador);
    document.addEventListener('keydown', gestionarTeclado);

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
    entregarMensajeCarritoPendiente(); /* ★ v2: si agregó algo con el chat cerrado */
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
    fila.dataset.consulta = consulta;
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
        /* ★ NUEVO: se acumula el texto y se pinta ya sin pensamiento. */
        estadoUI.textoAcumulado += datos.texto || '';
        texto.textContent = quitarPensamiento(estadoUI.textoAcumulado);
        desplazarMensajes();
      } else if (evento === 'reset') {
        if (estadoUI.burbuja) estadoUI.burbuja.remove();
        estadoUI.burbuja = null;
        estadoUI.textoAcumulado = ''; /* ★ NUEVO: el reintento parte limpio */
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
    const respuestaFinal = quitarPensamiento(datosFinales.respuesta || '') ||
      'Cuéntame un poco más de lo que buscas.';
    if (estadoUI.burbuja) {
      estadoUI.burbuja.querySelector('.ia-msg-texto').textContent = respuestaFinal;
    } else {
      estadoUI.burbuja = agregarMensaje('ia', respuestaFinal);
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

  /* ★ v2: zoom de foto con el visor de imágenes (visor-imagenes.js).
     Capa defensiva: si el visor no está cargado, no pasa nada. */
  function activarZoom(contenedor, imagen, titulo) {
    if (!window.DomiVisorImagenes ||
        typeof window.DomiVisorImagenes.abrir !== 'function') return;
    contenedor.classList.add('ia-zoom');
    imagen.addEventListener('click', function (evento) {
      evento.preventDefault();
      evento.stopPropagation();
      window.DomiVisorImagenes.abrir(imagen.src, titulo || '');
    });
  }

  function mostrarProductos(ids) {
    const idsValidos = ids
      .map(function (id) { return String(id); })
      .filter(function (id) { return productosPorId.has(id); });
    idsValidos.forEach(function (id) { productosVistosEnSesion.add(id); });
    if (idsValidos.length) ultimosProductosRecomendados = idsValidos;

    const nuevosIds = idsValidos.filter(function (id) {
      return !productosMostrados.has(id);
    });
    nuevosIds.forEach(function (id) {
      const producto = productosPorId.get(String(id));
      if (!producto) return;
      productosMostrados.add(String(id));

      const card = crearElemento('article', 'ia-card');
      card.dataset.productName = producto.nombre;
      card.dataset.productId = String(producto.id);
      card.dataset.productJson = JSON.stringify(producto);
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
        activarZoom(imageContainer, image, producto.nombre); /* ★ v2 */
        imageContainer.appendChild(image);
      } else {
        imageContainer.innerHTML = '<i class="fas fa-utensils" aria-hidden="true"></i>';
      }

      const info = crearElemento('div', 'ia-card-info');
      info.appendChild(crearElemento('strong', 'ia-card-nombre', producto.nombre));
      if (producto.tiendaNombre) info.appendChild(crearElemento('span', 'ia-card-tienda', producto.tiendaNombre));
      info.appendChild(crearElemento('span', 'ia-card-precio', formatearPrecio(producto.precio)));
      /* ★ v2: descripción real del producto en la tarjeta. */
      const descripcionProducto = String(producto.descripcion || '').trim();
      if (descripcionProducto && !/^\d+\s*und$/i.test(descripcionProducto)) {
        info.appendChild(crearElemento('span', 'ia-card-desc', descripcionProducto));
      }

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

  function tiendaEstaOculta(tienda) {
    return window.DomiIACatalogo.tiendaEstaOculta(tienda);
  }

  /* ★ v2: todas las tiendas visibles (activas y sin "(oculto)"), abiertas
     o cerradas. Fuente real: la misma variable global `tiendas` que
     alimenta iaCatalogo. */
  function tiendasVisibles() {
    const lista = typeof tiendas !== 'undefined' && Array.isArray(tiendas) ? tiendas : [];
    return lista.filter(function (tienda) {
      return tienda && tienda.activo !== false &&
        !tiendaEstaOculta(tienda) && Array.isArray(tienda.productos);
    });
  }

  /* ★ v2: ¿el cliente nombra un producto que SOLO existe en tiendas
     cerradas? Coincidencia contra el nombre real del catálogo (la misma
     regla de responderPreguntaProducto: nombre normalizado dentro del
     texto, o una palabra fuerte de la consulta dentro del nombre).
     Si alguna tienda ABIERTA tiene ese producto devuelve null y el
     flujo normal de siempre continúa. */
  function productoSoloEnTiendaCerrada(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    if (!texto || texto.length < 3) return null;
    const tokens = texto.split(/\s+/).filter(function (palabra) {
      return palabra.length > 3 && !PALABRAS_FUNCION_CHAT.has(palabra);
    });
    const encontrados = [];
    tiendasVisibles().forEach(function (tienda) {
      const estado = window.DomiIACatalogo.estadoTienda(tienda);
      tienda.productos.forEach(function (producto) {
        if (!producto || producto.id === undefined || !producto.nombre ||
            producto.activo === false) return;
        if (window.DomiIARazonamiento.normalizarTexto(producto.badge) === 'agotado') return;
        if (TIPO_NO_LISTABLE.test(window.DomiIARazonamiento.normalizarTexto(producto.tipo))) return;
        const nombre = window.DomiIARazonamiento.normalizarTexto(producto.nombre);
        if (nombre.length <= 2) return;
        let puntaje = 0;
        if (texto.includes(nombre)) {
          puntaje = 2;
        } else if (nombre.length > 3 && tokens.some(function (palabra) {
          return nombre.includes(palabra);
        })) {
          puntaje = 1;
        }
        if (puntaje) {
          encontrados.push({ producto: producto, tienda: tienda, estado: estado, puntaje: puntaje });
        }
      });
    });
    if (!encontrados.length) return null;
    if (encontrados.some(function (item) { return item.estado.isOpen; })) return null;
    encontrados.sort(function (a, b) {
      return b.puntaje - a.puntaje ||
        b.producto.nombre.length - a.producto.nombre.length ||
        (Number(a.producto.id) || 0) - (Number(b.producto.id) || 0);
    });
    return encontrados[0];
  }

  /* ★ v2: respuesta con la verdad para un producto de tienda cerrada:
     descripción real + hora real de apertura + tarjeta SIN Agregar. */
  function responderProductoCerrado(consulta) {
    const coincidencia = productoSoloEnTiendaCerrada(consulta);
    if (!coincidencia) return false;

    const producto = coincidencia.producto;
    const tienda = coincidencia.tienda;
    const estado = coincidencia.estado;
    const descripcion = String(producto.descripcion || '').trim();
    const apertura = estado.nextOpening || '';

    let mensaje = producto.nombre + ' es de ' + tienda.nombre + ' (' +
      formatearPrecio(producto.precio) + ').';
    if (descripcion) mensaje += ' ' + descripcion + '.';
    if (apertura === 'Cerrado hoy') {
      mensaje += ' ' + tienda.nombre + ' está cerrada hoy, así que por ahora no puedo agregarlo al carrito.';
    } else if (apertura) {
      mensaje += ' ' + tienda.nombre + ' ' + apertura.charAt(0).toLowerCase() + apertura.slice(1) +
        ', así que por ahora no puedo agregarlo al carrito.';
    } else {
      mensaje += ' ' + tienda.nombre + ' está cerrada en este momento, así que por ahora no puedo agregarlo al carrito.';
    }
    mensaje += ' ¿Te muestro opciones parecidas de las tiendas abiertas?';

    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    agregarMensaje('ia', mensaje);
    historial.push({ rol: 'assistant', texto: mensaje });
    historial = historial.slice(-MAX_HISTORIAL);
    mostrarProductoCerrado(producto, tienda, estado);
    return true;
  }

  /* ★ v2: tarjeta de producto de tienda cerrada. Igual a la normal pero
     SIN botón Agregar: en su lugar, la etiqueta "Tienda cerrada" con la
     hora real de apertura. Sus ids NO entran a
     ultimosProductosRecomendados, así que tampoco puede agregarse por
     chat ("ponme el shawarma" no lo puede meter al carrito). */
  function mostrarProductoCerrado(producto, tienda, estado) {
    const card = crearElemento('article', 'ia-card');
    card.classList.add('ia-cerrada');
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
      activarZoom(imageContainer, image, producto.nombre);
      imageContainer.appendChild(image);
    } else {
      imageContainer.innerHTML = '<i class="fas fa-utensils" aria-hidden="true"></i>';
    }

    const info = crearElemento('div', 'ia-card-info');
    info.appendChild(crearElemento('strong', 'ia-card-nombre', producto.nombre));
    if (tienda && tienda.nombre) info.appendChild(crearElemento('span', 'ia-card-tienda', tienda.nombre));
    info.appendChild(crearElemento('span', 'ia-card-precio', formatearPrecio(producto.precio)));
    const descripcion = String(producto.descripcion || '').trim();
    if (descripcion && !/^\d+\s*und$/i.test(descripcion)) {
      info.appendChild(crearElemento('span', 'ia-card-desc', descripcion));
    }

    const etiqueta = crearElemento('span', 'ia-card-cerrada',
      'Tienda cerrada' + (estado.nextOpening ? ' · ' + estado.nextOpening : ''));
    etiqueta.setAttribute('role', 'note');
    card.append(imageContainer, info, etiqueta);
    elementos.mensajes.appendChild(card);
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
    } else if (productosRecientes.length === 1 && (referencial || interpretacion.intencionAgregar)) { /* ★ CORREGIDO: antes 'intencionAgregar' sin definir (crash) */
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

  function obtenerTiendaMencionada(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    if (!texto || typeof tiendas === 'undefined' || !Array.isArray(tiendas)) return null;
    return tiendasVisibles().slice().sort(function (a, b) {
      return String(b.nombre || '').length - String(a.nombre || '').length;
    }).find(function (tienda) {
      const nombre = window.DomiIARazonamiento.normalizarTexto(tienda.nombre);
      return nombre.length >= 4 && texto.includes(nombre);
    }) || null;
  }

  function obtenerZonaMencionada(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.zonas) return null;
    return Object.entries(APP_CONFIG.zonas).filter(function (entrada) {
      return entrada[1].activo !== false;
    }).map(function (entrada) {
      return { id: entrada[0], nombre: entrada[1].nombre, envio: Number(entrada[1].envio) || 0 };
    }).sort(function (a, b) {
      return Math.max(b.nombre.length, b.id.length) - Math.max(a.nombre.length, a.id.length);
    }).find(function (zona) {
      const nombre = window.DomiIARazonamiento.normalizarTexto(zona.nombre);
      const id = window.DomiIARazonamiento.normalizarTexto(zona.id);
      return [nombre, id].some(function (valor) {
        if (valor.length < 3) return false;
        const escapado = valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?:^|[^a-z0-9])' + escapado + '(?:$|[^a-z0-9])').test(texto);
      });
    }) || null;
  }

  function construirRespuestaZonas() {
    const zonas = typeof APP_CONFIG !== 'undefined' && APP_CONFIG.zonas
      ? Object.entries(APP_CONFIG.zonas).filter(function (entrada) {
        return entrada[1].activo !== false;
      }).map(function (entrada) {
        return { nombre: String(entrada[1].nombre || entrada[0]).trim(), envio: Number(entrada[1].envio) || 0 };
      })
      : [];
    if (!zonas.length) return 'No tengo las tarifas de envío disponibles ahora. Puedes verlas al seleccionar tu zona en el checkout.';

    const grupos = new Map();
    zonas.forEach(function (zona) {
      const lista = grupos.get(zona.envio) || [];
      lista.push(zona.nombre);
      grupos.set(zona.envio, lista);
    });
    const tarifas = Array.from(grupos.entries()).sort(function (a, b) {
      return a[0] - b[0];
    }).map(function (grupo) {
      return formatearPrecio(grupo[0]) + ': ' + grupo[1].join(', ');
    });
    return 'Estas son las zonas y tarifas base de envío: ' + tarifas.join(' | ') +
      '. El total puede variar si combinas productos de varias tiendas; el checkout confirma el valor final.';
  }

  function responderConsultaOperativa(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    const zonaMencionada = obtenerZonaMencionada(consulta);
    const preguntaZonas = /\b(zonas?|coberturas?|tarifas?|envios?|entregas?|domicilios?|barrios?|sectores?)\b/.test(texto) ||
      (!!zonaMencionada && /\b(cuest\w*|preci\w*|valor|tarifa)\b/.test(texto));
    if (preguntaZonas) {
      return zonaMencionada
        ? 'La tarifa base de envío para ' + zonaMencionada.nombre + ' es ' +
          formatearPrecio(zonaMencionada.envio) +
          '. El total puede variar si combinas productos de varias tiendas; el checkout confirma el valor final.'
        : construirRespuestaZonas();
    }

    const solicitaRecomendacionTienda =
      /\b(recomiend\w*|sugier\w*|mejor|preferid\w*)\b/.test(texto) &&
      /\b(tiend\w*|restaur\w*|negocio\w*|local\w*)\b/.test(texto);
    if (solicitaRecomendacionTienda) {
      const abiertas = tiendasVisibles().filter(function (opcion) {
        return window.DomiIACatalogo.estadoTienda(opcion).isOpen;
      });
      const promovidas = abiertas.filter(function (opcion) {
        return Number(opcion.promovida) === 1 || opcion.promovida === true;
      });
      const recomendadas = promovidas.length ? promovidas : abiertas;
      if (!recomendadas.length) {
        return 'Según los horarios del catálogo, no hay tiendas abiertas ahora. Puedo revisar otras opciones cuando vuelvan a abrir.';
      }
      const nombres = recomendadas.slice(0, 5).map(function (opcion) {
        return opcion.nombre;
      }).join(', ');
      return promovidas.length
        ? 'Te recomiendo estas tiendas promovidas que están abiertas ahora: ' + nombres + '.'
        : 'No veo tiendas promovidas abiertas ahora; estas tiendas sí están abiertas: ' + nombres + '.';
    }

    const tienda = obtenerTiendaMencionada(consulta);
    const preguntaProductosTienda = /\b(producto\w*|vende\w*|ofrece\w*|menu|catalogo|que hay|que tiene)\b/.test(texto);
    const preguntaTienda = /\b(tiend\w*|aliad\w*|horari\w*|abiert\w*|cerrad\w*|abre|abren|cierra|cierran|atiende|atienden|ubicacion|direccion|informacion|conoces|sabes|habl\w*|cuent\w*)\b/.test(texto) ||
      (tienda && texto === window.DomiIARazonamiento.normalizarTexto(tienda.nombre));
    if (tienda && preguntaTienda && !preguntaProductosTienda) {
      const estado = window.DomiIACatalogo.estadoTienda(tienda);
      const horarioHoy = typeof getHorarioHoy === 'function'
        ? getHorarioHoy(tienda.horario)
        : String(tienda.horario || '').trim();
      const horario = horarioHoy && horarioHoy.toLowerCase() !== 'cerrado'
        ? ' Su horario de hoy es ' + horarioHoy + '.'
        : ' Hoy figura cerrada en el catálogo.';
      return 'Según el catálogo, ' + tienda.nombre + ' está ' +
        (estado.isOpen ? 'abierta ahora.' : 'cerrada ahora.') + horario;
    }

    const preguntaTiendasAbiertas = /\b(tiend\w*|aliad\w*|establecimient\w*)\b/.test(texto) &&
      /\b(abiert\w*|disponibles|ahora|hoy)\b/.test(texto);
    if (preguntaTiendasAbiertas) {
      const abiertas = tiendasVisibles().filter(function (opcion) {
        return window.DomiIACatalogo.estadoTienda(opcion).isOpen;
      });
      if (!abiertas.length) return 'Según los horarios del catálogo, no hay tiendas abiertas en este momento.';
      return 'Según los horarios del catálogo, están abiertas: ' +
        abiertas.slice(0, 12).map(function (opcion) { return opcion.nombre; }).join(', ') +
        (abiertas.length > 12 ? ', entre otras. Dime el nombre de una tienda y reviso su horario.' : '.');
    }
    return null;
  }

  function responderLocal(consulta, respuesta) {
    elementos.chips.hidden = true;
    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    agregarMensaje('ia', respuesta, consulta);
    historial.push({ rol: 'assistant', texto: respuesta });
    historial = historial.slice(-MAX_HISTORIAL);
    elementos.input.value = '';
    actualizarContador();
  }

  function desactivarTarjetasProducto() {
    if (!elementos) return;
    elementos.mensajes.querySelectorAll('.ia-card-agregar:not(:disabled)').forEach(function (boton) {
      const card = boton.closest('.ia-card');
      const nombre = card ? card.dataset.productName : '';
      boton.disabled = true;
      boton.textContent = 'Opción anterior';
      boton.title = 'Esta opción quedó desactualizada; consulta nuevamente para ver opciones vigentes.';
      boton.setAttribute('aria-label', nombre
        ? 'Opción anterior: ' + nombre
        : 'Opción anterior');
    });
  }

  function esRechazoBebida(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta)
      .replace(/[¡!¿?.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return /^(?:no|no gracias(?: por ahora)?|no por ahora|ahora no|por ahora no|no quiero(?: nada| tomar nada| nada (?:de|para) tomar| eso| la bebida| bebidas?| agregarla)?|no deseo(?: nada| tomar nada| nada (?:de|para) tomar| eso| la bebida| bebidas?)?|no la quiero|no me interesa|as[ií] est[aá] bien|estoy bien|con eso(?: basta| estoy bien)?|ya est[aá]|ser[ií]a todo|nada m[aá]s|solo eso|eso es todo|estamos bien|no gracias (?:solo eso|nada m[aá]s|eso es todo))$/
      .test(texto);
  }

  async function gestionarRechazoBebida(consulta) {
    if (!ofertaBebidaPendiente || !esRechazoBebida(consulta)) return false;
    ofertaBebidaPendiente = false;
    desactivarTarjetasProducto();
    productosMostrados.clear();
    ultimosProductosRecomendados = [];

    solicitarDatosPedido = true;
    const respuesta = '¡Entendido! No agrego bebidas. ' + await construirSolicitudDatosPedido();
    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    agregarMensaje('ia', respuesta);
    historial.push({ rol: 'assistant', texto: respuesta });
    historial = historial.slice(-MAX_HISTORIAL);
    actualizarBotonCheckout();
    return true;
  }

  /* ★ NUEVO: blindaje anti-pensamiento (segunda capa en el navegador).
     El servidor v1.4 ya limpia el razonamiento; esto protege si algún
     proveedor se cuela con bloques <think>…</think> en el texto. */
  function quitarPensamiento(texto) {
    let limpio = String(texto || '');
    limpio = limpio.replace(/<think(?:ing)?\s*>[\s\S]*?<\/think(?:ing)?>/gi, '');
    limpio = limpio.replace(/<think(?:ing)?\s*>[\s\S]*$/i, '');
    return limpio;
  }

  /* ★ NUEVO: autollenado del checkout (Fase 5). Extracción LOCAL por
     patrones: solo guarda lo que el cliente escribió explícitamente,
     nunca inventa datos. 'domidelis_cliente' se cifra con Web Crypto y
     se descifra al restaurarlo para el asistente o el checkout. */

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
    const coincidencia = /\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÑÜáéíóúñü'’-]+(?:\s+[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’-]+){0,2})/i
      .exec(String(consulta || ''));
    if (!coincidencia) return '';
    const palabras = [];
    for (const fragmento of coincidencia[1].split(/\s+/)) {
      const clave = window.DomiIARazonamiento.normalizarTexto(fragmento);
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
      telefono: extraerTelefono(consulta),
      zona: solicitarDatosPedido ? extraerZona(consulta) : null,
      referencias: solicitarDatosPedido || solicitarObservacionesPedido
        ? extraerObservaciones(consulta)
        : ''
    };
  }

  function extraerObservaciones(consulta) {
    const texto = String(consulta || '').trim();
    const coincidencia = /(?:\bobservaciones?\b|\breferencias?\b|\bnotas?\b|\bsin\s+|\bno\s+me\s+gustan?\b|\bno\s+quiero\b|\bno\s+le\s+pongas?\b|\bno\s+le\s+pongan\b|\bevitar\b|\bprefiero\b|\bpor\s+favor\s+(?:sin|no)\b|\btocar\s+timbre\b|\bllamar\s+al\s+llegar\b)\s*[:,-]?\s*/i
      .exec(texto);
    if (!coincidencia) return '';
    return texto.slice(coincidencia.index).trim().replace(/\s+/g, ' ');
  }

  function esSinObservaciones(consulta) {
    return /^(?:no|ninguna|ninguna observaci[oó]n|no tengo|no gracias|as[ií] est[aá] bien|todo bien|est[aá] bien)$/i
      .test(String(consulta || '').trim().replace(/[.!?¿¡]+/g, ''));
  }

  function obtenerZonasDisponibles() {
    return typeof ZONAS !== 'undefined' && Array.isArray(ZONAS) ? ZONAS : [];
  }

  function extraerZona(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    const zonas = obtenerZonasDisponibles().slice().sort(function (a, b) {
      return String(b.nombre || '').length - String(a.nombre || '').length;
    });
    for (const zona of zonas) {
      const nombres = [zona.nombre, zona.id].filter(Boolean);
      for (const nombre of nombres) {
        const normalizado = window.DomiIARazonamiento.normalizarTexto(nombre);
        const escapado = normalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (normalizado && new RegExp('(?:^|[^a-z0-9])' + escapado + '(?:$|[^a-z0-9])').test(texto)) {
          return zona;
        }
      }
    }
    return null;
  }

  async function obtenerDatosClienteGuardados() {
    try {
      if (!window.DomiAlmacenSeguro) {
        throw new Error('No se cargó el almacenamiento cifrado.');
      }
      const datos = await window.DomiAlmacenSeguro.leerLocal('domidelis_cliente') || {};
      const zonas = obtenerZonasDisponibles();
      const zonaKey = datos.zonaKey || localStorage.getItem('zonaSeleccionada') || '';
      const zona = zonas.find(function (opcion) {
        return String(opcion.id) === String(zonaKey);
      });
      return {
        nombre: String(datos.nombre || '').trim(),
        telefono: String(datos.telefono || '').trim(),
        zona: zona || null,
        referencias: String(datos.referencias || '').trim()
      };
    } catch (error) {
      console.warn('[Asistente IA] No se pudieron leer los datos guardados del cliente:', error);
      throw error;
    }
  }

  async function construirSolicitudDatosPedido() {
    const datos = await obtenerDatosClienteGuardados();
    const faltantes = [];
    if (!datos.nombre) faltantes.push('tu nombre completo');
    if (!datos.telefono) faltantes.push('tu número de celular');
    if (!datos.zona) faltantes.push('tu zona o barrio');
    if (!faltantes.length) {
      solicitarDatosPedido = false;
      if (!datos.referencias) {
        solicitarObservacionesPedido = true;
        return 'Tus datos están listos. Si quieres, dime alguna observación o algo que no te guste (por ejemplo, “sin cebolla”) y lo guardaré como referencia del pedido. Si no tienes, responde “ninguna”. Después toca “Ir al checkout” para completar la dirección exacta y confirmar.';
      }
      solicitarObservacionesPedido = false;
      return 'Tus datos y observaciones están listos. Toca “Ir al checkout” para completar la dirección exacta y confirmar el pedido.';
    }
    solicitarDatosPedido = true;
    return 'Si ya terminaste de elegir, dime ' + faltantes.join(', ') +
      '. Puedes enviarlos juntos; por ejemplo: “Me llamo Ana, mi celular es 3001234567 y vivo en Centro”. ' +
      'Después podrás completar la dirección exacta en el checkout.';
  }

  async function procesarDatosPedido(consulta, datosNuevos) {
    if (!solicitarDatosPedido && !solicitarObservacionesPedido) return false;
    if (datosNuevos.referencias.length > 100) {
      await guardarDatosClienteEnLocal(Object.assign({}, datosNuevos, { referencias: '' }));
      agregarMensaje('user', consulta);
      historial.push({ rol: 'user', texto: consulta });
      agregarMensaje('ia', 'La referencia admite máximo 100 caracteres. Envíamela más corta, por favor.');
      historial.push({ rol: 'assistant', texto: 'La referencia admite máximo 100 caracteres. Envíamela más corta, por favor.' });
      historial = historial.slice(-MAX_HISTORIAL);
      return true;
    }
    const omiteObservaciones = solicitarObservacionesPedido && esSinObservaciones(consulta);
    const hayDatosNuevos = !!(
      datosNuevos.nombre || datosNuevos.telefono || datosNuevos.zona || datosNuevos.referencias
    );
    if (!hayDatosNuevos && !omiteObservaciones) return false;

    if (hayDatosNuevos) await guardarDatosClienteEnLocal(datosNuevos);
    const datos = await obtenerDatosClienteGuardados();
    const faltantes = [];
    if (!datos.nombre) faltantes.push('tu nombre completo');
    if (!datos.telefono) faltantes.push('tu número de celular');
    if (!datos.zona) faltantes.push('tu zona o barrio (tal como aparece en el checkout)');

    agregarMensaje('user', consulta);
    historial.push({ rol: 'user', texto: consulta });
    let respuesta;
    if (faltantes.length) {
      respuesta = 'Gracias, ya guardé lo que me compartiste. Aún necesito ' + faltantes.join(' y ') + '.';
      solicitarDatosPedido = true;
    } else {
      solicitarDatosPedido = false;
      if (datos.referencias || datosNuevos.referencias) {
        solicitarObservacionesPedido = false;
        respuesta = '¡Gracias! Ya guardé tu nombre, celular, zona y observación en las referencias del pedido. Toca “Ir al checkout” para completar la dirección exacta y confirmar.';
      } else if (omiteObservaciones) {
        solicitarObservacionesPedido = false;
        respuesta = '¡Gracias! No agregaré observaciones. Toca “Ir al checkout” para completar la dirección exacta y confirmar el pedido.';
      } else {
        solicitarObservacionesPedido = true;
        respuesta = '¡Gracias! Ya dejé listos tu nombre, celular y zona. ¿Quieres agregar alguna observación, como “sin cebolla”? Es opcional; si no tienes, responde “ninguna”. Después toca “Ir al checkout” para completar la dirección exacta y confirmar.';
      }
    }
    agregarMensaje('ia', respuesta);
    historial.push({ rol: 'assistant', texto: respuesta });
    historial = historial.slice(-MAX_HISTORIAL);
    actualizarBotonCheckout();
    return true;
  }

  async function guardarDatosClienteEnLocal(datos) {
    if (!window.DomiAlmacenSeguro) {
      throw new Error('No se cargó el almacenamiento cifrado.');
    }
    let previo = await window.DomiAlmacenSeguro.leerLocal('domidelis_cliente') || {};
    if (!previo || typeof previo !== 'object' || Array.isArray(previo)) previo = {};
    const fusion = Object.assign({}, previo);
    if (datos.nombre) fusion.nombre = datos.nombre;
    if (datos.telefono) fusion.telefono = datos.telefono;
    if (datos.referencias) fusion.referencias = datos.referencias;
    if (datos.zona) {
      fusion.zonaNombre = datos.zona.nombre;
      fusion.zonaKey = datos.zona.id;
    }
    await window.DomiAlmacenSeguro.guardarLocal('domidelis_cliente', fusion);
    if (datos.zona) localStorage.setItem('zonaSeleccionada', datos.zona.id);
    console.info('[Asistente IA] Datos del cliente protegidos y listos para el checkout.');

    /* Si el asistente corre en la página del checkout, también rellena
       los campos reales; el evento change ejecuta el autoguardado del
       checkout sin tocar checkout.js. */
    try {
      const campoNombre = document.getElementById('nombre');
      const campoTelefono = document.getElementById('telefono');
      const campoReferencias = document.getElementById('referencias');
      const campoZona = document.getElementById('zona-checkout-input');
      const campoZonaId = document.getElementById('zona-checkout');
      if (campoNombre && datos.nombre && !String(campoNombre.value || '').trim()) {
        campoNombre.value = datos.nombre;
        campoNombre.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (campoTelefono && datos.telefono && !String(campoTelefono.value || '').trim()) {
        campoTelefono.value = datos.telefono;
        campoTelefono.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (campoReferencias && datos.referencias && !String(campoReferencias.value || '').trim()) {
        campoReferencias.value = datos.referencias;
        campoReferencias.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (datos.zona && campoZona && campoZonaId) {
        campoZona.value = datos.zona.nombre;
        campoZonaId.value = datos.zona.id;
        campoZonaId.dispatchEvent(new Event('change', { bubbles: true }));
        campoZona.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (error) {
      console.warn('[Asistente IA] No se pudo rellenar el checkout:', error);
    }
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
    elementos.input.value = '';
    actualizarContador();

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

    /* ★ NUEVO: autollenado del checkout. Si el cliente dejó su nombre o
       celular en el mensaje, se guardan en silencio para el checkout. */
    const datosCliente = extraerDatosCliente(consulta);
    if (datosCliente.nombre || datosCliente.telefono || datosCliente.zona || datosCliente.referencias) {
      try {
        await guardarDatosClienteEnLocal(datosCliente);
      } catch (error) {
        console.error('[Asistente IA] No se pudieron proteger los datos del cliente:', error);
        mostrarAviso('No se pudieron proteger tus datos en este navegador. No los volveré a guardar en texto plano.');
        return;
      }
    }

    const intencionAgregar = window.DomiIARazonamiento.interpretarSolicitud(consulta).intencionAgregar;
    const contextoEtapas = window.DomiIAEtapas.clasificarConsulta(consulta, {
      tieneCarrito: obtenerCarritoSeguro().length > 0,
      tieneDatos: !!(datosCliente.nombre || datosCliente.telefono || datosCliente.zona),
      intencionAgregar: intencionAgregar
    });
    window.DomiIAEtapas.registrarPaso(contextoEtapas.etapa);
    const respuestaOperativa = responderConsultaOperativa(consulta);
    if (respuestaOperativa) {
      responderLocal(consulta, respuestaOperativa);
      return;
    }
    if (contextoEtapas.paso === 'consultar') {
      responderPreguntaCarrito(consulta);
      return;
    }

    try {
      if (await procesarDatosPedido(consulta, datosCliente)) return;

      if (await gestionarRechazoBebida(consulta)) {
        elementos.chips.hidden = true;
        elementos.input.value = '';
        actualizarContador();
        return;
      }

      if (contextoEtapas.paso === 'guiar_checkout') {
        solicitarDatosPedido = true;
        const respuesta = await construirSolicitudDatosPedido();
        agregarMensaje('user', consulta);
        historial.push({ rol: 'user', texto: consulta });
        agregarMensaje('ia', respuesta);
        historial.push({ rol: 'assistant', texto: respuesta });
        historial = historial.slice(-MAX_HISTORIAL);
        actualizarBotonCheckout();
        elementos.chips.hidden = true;
        elementos.input.value = '';
        actualizarContador();
        return;
      }
    } catch (error) {
      console.error('[Asistente IA] No se pudieron procesar los datos protegidos del pedido:', error);
      mostrarAviso('No se pudieron leer o guardar tus datos protegidos. Revisa el almacenamiento del navegador e inténtalo otra vez.');
      return;
    }

    if (!intencionAgregar) {
      ofertaBebidaPendiente = false;
      desactivarTarjetasProducto();
      productosMostrados.clear();
      ultimosProductosRecomendados = [];
    }

    /* ★ v2: regla de la verdad para tiendas cerradas. Va primero de
       todo: si el producto mencionado solo existe en tiendas cerradas,
       se responde con descripción real + hora real y SIN Agregar. Si
       alguna tienda abierta lo tiene, el flujo normal sigue. */
    if (responderProductoCerrado(consulta)) {
      elementos.chips.hidden = true;
      elementos.input.value = '';
      actualizarContador();
      return;
    }

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
    const idsExcluidos = Array.from(productosVistosEnSesion);
    const tiendaEnConsulta = obtenerTiendaMencionada(consulta);
    const consultaProductosTienda = tiendaEnConsulta &&
      /\b(vende\w*|ofrece\w*|producto\w*|menu|catalogo|tiene\w*|hay)\b/.test(
        window.DomiIARazonamiento.normalizarTexto(consulta)
      );
    const catalogoBase = window.DomiIACatalogo.buscar(consultaCatalogo, {
      excluirIds: idsExcluidos,
      incluirIds: []
    });
    const catalogo = consultaProductosTienda
      ? Object.assign({}, catalogoBase, {
        candidatos: catalogoBase.candidatos.filter(function (candidato) {
          return String(candidato.tiendaId) === String(tiendaEnConsulta.id);
        }),
        productosPorId: new Map(Array.from(catalogoBase.productosPorId.entries())
          .filter(function (entrada) {
            return String(entrada[1].tiendaId) === String(tiendaEnConsulta.id);
          }))
      })
      : catalogoBase;
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

    const estadoUI = { typing: mostrarEscritura(), burbuja: null, textoAcumulado: '' };
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

      const respuestaLimpia = quitarPensamiento(data.respuesta || '');
      if (!estadoUI.burbuja) {
        if (estadoUI.typing) estadoUI.typing.remove();
        estadoUI.typing = null;
        estadoUI.burbuja = agregarMensaje('ia', respuestaLimpia || 'Cuéntame un poco más de lo que buscas.');
      }
      registrarResultadoRespuesta(consulta, respuestaLimpia);
      agregarCalificacion(estadoUI.burbuja, consulta);
      /* ★ NUEVO: al historial entra el texto limpio; el pensamiento nunca
         vuelve a entrar a la conversación. */
      historial.push({ rol: 'assistant', texto: respuestaLimpia });
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
    revisionConversacion += 1;
    if (window.DomiAlmacenSeguro) {
      colaGuardadoConversacion = colaGuardadoConversacion.catch(function () {}).then(function () {
        window.DomiAlmacenSeguro.eliminarSesion(CLAVE_CONVERSACION);
      }).catch(function (error) {
        console.warn('[Asistente IA] No se pudo eliminar la conversación protegida:', error);
      });
    } else {
      sessionStorage.removeItem(CLAVE_CONVERSACION);
      sessionStorage.removeItem(CLAVE_CONVERSACION + ':cifrado');
    }
    historial = [{ rol: 'assistant', texto: SALUDO_INICIAL }];
    ultimosProductosRecomendados = [];
    productosMostrados.clear();
    productosVistosEnSesion.clear();
    solicitarDatosPedido = false;
    solicitarObservacionesPedido = false;
    window.DomiIAEtapas.reiniciar();
    elementos.mensajes.replaceChildren();
    elementos.chips.hidden = false;
    elementos.confirmar.hidden = true;
    agregarMensaje('ia', SALUDO_INICIAL);
    elementos.input.focus();
  }

  async function iniciar() {
    if (!window.DomiIARazonamiento || !window.DomiIACatalogo) {
      console.error('[Asistente IA] No se cargaron los módulos de catálogo y razonamiento.');
      return;
    }
    construirInterfaz();
    try {
      if (window.DomiAlmacenSeguro) {
        localStorage.removeItem('domidelis_telefono');
        localStorage.removeItem('domidelis_uid');
        await window.DomiAlmacenSeguro.leerLocal('domidelis_cliente');
      } else {
        throw new Error('No se cargó el almacenamiento cifrado.');
      }
    } catch (error) {
      console.error('[Asistente IA] No se pudieron migrar los datos guardados al almacenamiento cifrado:', error);
      mostrarAviso('No se pudieron migrar algunos datos guardados de forma segura.');
    }
    try {
      if (!await restaurarConversacion()) {
        if (window.DomiIAEtapas && typeof window.DomiIAEtapas.reiniciar === 'function') {
          window.DomiIAEtapas.reiniciar();
        }
        agregarMensaje('ia', SALUDO_INICIAL);
      }
    } catch (error) {
      if (window.DomiIAEtapas && typeof window.DomiIAEtapas.reiniciar === 'function') {
        window.DomiIAEtapas.reiniciar();
      }
      agregarMensaje('ia', SALUDO_INICIAL);
      mostrarAviso('No se pudo restaurar la conversación protegida. Puedes continuar con una nueva.');
    }
    actualizarBotonCheckout();
    actualizarContador();
    iniciarPersistenciaConversacion();
    consultarEstado();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      iniciar().catch(function (error) {
        console.error('[Asistente IA] No se pudo iniciar el asistente:', error);
      });
    }, { once: true });
  } else {
    iniciar().catch(function (error) {
      console.error('[Asistente IA] No se pudo iniciar el asistente:', error);
    });
  }
})();