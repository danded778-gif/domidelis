'use strict';

/* ============================================
   ★ v1.6 HORARIO (11-11-2026) — EL FILTRO DE LA VERDAD
   Regla nueva: una tienda CERRADA a esta hora (según su horario real,
   día por día) no aparece en las respuestas de DOMI IA, ni ella ni sus
   productos. Mismas reglas que client.js v4.9.2:
   getDayKey + getHorarioHoy + checkStoreStatus (copia fiel).
   Cambios de esta versión:
   1. claveDiaHoy / horarioDeHoy / estadoTienda / tiendaEstaAbierta —
      motor de horario con hora de Colombia (America/Bogota). Si client.js
      está cargado en la página se reusa window.checkStoreStatus; la copia
      interna cubre páginas sin client.js (ej. checkout.html).
   2. buscar(): filtra productos de tiendas cerradas (además de ocultas
      e inactivas, que ya existían).
   3. responderPreguntaProducto(): mismo filtro de tienda cerrada.
   4. categoriasCatalogo(): mismo filtro de tienda cerrada.
   5. Cada candidato ahora lleva `promovida` (0/1) para que el servidor
      ponga primero las tiendas promovidas que estén abiertas.
   ============================================ */

(function () {
  let rotacionCatalogoAmplio = 0;
  const PRODUCTO_FRIO_COMPATIBLE = /\b(helad\w*|granizad\w*|frutas?|fresas?|mangos?|ensalada|copa|kumis|hielo|frapp\w*|batid\w*|raspa\w*|postre\w*|limonad\w*|jugos?|aguas?|gaseosas?|maltead\w*)\b/;

  function normalizarTexto(texto) {
    return window.DomiIARazonamiento.normalizarTexto(texto);
  }

  function leerCatalogoPublicado() {
    return {
      tiendas: typeof tiendas !== 'undefined' && Array.isArray(tiendas) ? tiendas : [],
      productos: typeof productosGlobal !== 'undefined' && Array.isArray(productosGlobal)
        ? productosGlobal
        : [],
      complementos: typeof complementosGlobal !== 'undefined' && Array.isArray(complementosGlobal)
        ? complementosGlobal
        : []
    };
  }

  function tiendaEstaOculta(tienda) {
    return normalizarTexto(tienda && tienda.descripcion)
      .replace(/\s+/g, '')
      .includes('(oculto)');
  }

  /* ★ v1.6 — Motor de horario (copia fiel de client.js v4.9.2). */
  function claveDiaHoy() {
    const ahora = new Date();
    const horaColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const dias = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return dias[horaColombia.getDay()];
  }

  function horarioDeHoy(horario) {
    if (!horario) return '11:00-22:00';
    if (typeof horario === 'string' && horario.trim().startsWith('{')) {
      try {
        const horarioLimpio = horario
          .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
          .replace(/'/g, '"');
        const obj = JSON.parse(horarioLimpio);
        return obj[claveDiaHoy()] || 'Cerrado';
      } catch (error) {
        return horario;
      }
    }
    return horario;
  }

  function estadoTienda(tienda) {
    const horario = tienda && tienda.horario;
    if (window.checkStoreStatus) {
      try {
        return window.checkStoreStatus(horario);
      } catch (error) {
        /* client.js falló: se usa la copia interna */
      }
    }
    const horarioHoy = horarioDeHoy(horario);
    if (!horarioHoy || horarioHoy.toLowerCase() === 'cerrado' || horarioHoy.indexOf('-') === -1) {
      return { isOpen: false, nextOpening: 'Cerrado hoy' };
    }
    const ahora = new Date();
    const horaColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const minutosActuales = (horaColombia.getHours() * 60) + horaColombia.getMinutes();
    const partes = horarioHoy.split('-');
    const inicio = partes[0].split(':').map(Number);
    const fin = partes[1] ? partes[1].split(':').map(Number) : [];
    const minutosInicio = (inicio[0] * 60) + (inicio[1] || 0);
    const minutosFin = (fin[0] * 60) + (fin[1] || 0);
    let abierta;
    if (minutosFin > minutosInicio) {
      abierta = minutosActuales >= minutosInicio && minutosActuales < minutosFin;
    } else {
      abierta = minutosActuales >= minutosInicio || minutosActuales < minutosFin;
    }
    return {
      isOpen: abierta,
      nextOpening: abierta ? '' : 'Abre a las ' + partes[0].trim()
    };
  }

  function tiendaEstaAbierta(tienda) {
    return estadoTienda(tienda).isOpen === true;
  }

  function esPromovida(tienda) {
    return tienda && (tienda.promovida === 1 || tienda.promovida === true) ? 1 : 0;
  }

  function buscar(consulta, opcionesBusqueda) {
    // These arrays are populated by the app's published catalog JSON loader; this module never calls Sheets.
    const catalogo = leerCatalogoPublicado();
    const tiendas = catalogo.tiendas;
    const productos = catalogo.productos.slice();
    const tiendasPorId = new Map(tiendas.map(function (tienda) {
      return [String(tienda.id), tienda];
    }));

    tiendas.forEach(function (tienda) {
      if (!Array.isArray(tienda.productos)) return;
      tienda.productos.forEach(function (producto) {
        productos.push(Object.assign({}, producto, {
          tiendaId: producto.tiendaId || tienda.id,
          tiendaNombre: producto.tiendaNombre || tienda.nombre
        }));
      });
    });

    const productosPorId = new Map();
    const disponibles = productos.filter(function (producto) {
      if (!producto || producto.id === undefined || !producto.nombre ||
          producto.activo === false || normalizarTexto(producto.badge) === 'agotado') return false;
      if (/^(extra|salsa|opcion)$/.test(normalizarTexto(producto.tipo))) return false;
      const tienda = tiendasPorId.get(String(producto.tiendaId));
      if (tienda && (tienda.activo === false || tiendaEstaOculta(tienda) || !tiendaEstaAbierta(tienda))) return false;
      const id = String(producto.id);
      if (productosPorId.has(id)) return false;
      productosPorId.set(id, producto);
      return true;
    });

    const interpretacion = window.DomiIARazonamiento.interpretarSolicitud(consulta);
    const categorias = interpretacion.categoriasPrioritarias;
    const productosCompatiblesFrio = interpretacion.buscaFrioRefrescante
      ? disponibles.filter(function (producto) {
        const categoria = normalizarTexto(producto.categoria);
        const textoProducto = normalizarTexto(producto.nombre + ' ' + producto.descripcion);
        const esBebida = /\bbebidas?\b/.test(categoria);
        const esPostreOFruta = !/\b(menu|almuerzo|licores|cervezas|farmacia)\b/.test(categoria) &&
          PRODUCTO_FRIO_COMPATIBLE.test(textoProducto);
        return esBebida || esPostreOFruta;
      })
      : [];
    function indiceCategoria(producto) {
      const categoria = normalizarTexto(producto.categoria);
      return categorias.findIndex(function (prioritaria) {
        if (prioritaria === 'menu') return /\bmenu\b/.test(categoria);
        if (prioritaria === 'almuerzo') return /\balmuerzos?\b/.test(categoria);
        return prioritaria === 'desayuno' && /\bdesayunos?\b/.test(categoria);
      });
    }
    const productosDeCategoria = interpretacion.buscaFrioRefrescante
      ? productosCompatiblesFrio
      : categorias.length
      ? disponibles.filter(function (producto) { return indiceCategoria(producto) !== -1; })
      : disponibles;
    const baseBusqueda = interpretacion.buscaFrioRefrescante
      ? productosCompatiblesFrio
      : productosDeCategoria.length ? productosDeCategoria : disponibles;
    const priorizados = baseBusqueda.map(function (producto, indice) {
      const indiceCoincidencia = indiceCategoria(producto);
      const textoProducto = normalizarTexto([
        producto.nombre,
        producto.categoria,
        producto.descripcion
      ].join(' '));
      const categoria = normalizarTexto(producto.categoria);
      const puntuacionFrio = interpretacion.buscaFrioRefrescante
        ? (/\bbebidas?\b/.test(categoria) ? 20 : 0) +
          (/\b(helad\w*|granizad\w*|frut\w*|fres\w*|mang\w*|ensalada|copa|kumis|hielo|frapp\w*|batid\w*|raspa\w*|postre\w*|limonad\w*|jugo\w*|agua|gaseosa|maltead\w*)\b/.test(textoProducto) ? 10 : 0)
        : 0;
      const puntosCategoria = indiceCoincidencia === -1
        ? 0
        : (categorias.length - indiceCoincidencia) * 100;
      const puntosTexto = interpretacion.palabras.reduce(function (puntos, palabra) {
        return puntos + (textoProducto.includes(palabra) ? 10 : 0);
      }, 0);
      return { producto: producto, indice: indice, puntos: puntuacionFrio + puntosCategoria + puntosTexto };
    }).sort(function (a, b) {
      return b.puntos - a.puntos || a.indice - b.indice;
    });

    const hayCoincidenciaTexto = priorizados.some(function (item) { return item.puntos > 0; });
    let seleccionados;
    if (interpretacion.solicitaRopa) {
      seleccionados = [];
    } else if (interpretacion.buscaFrioRefrescante) {
      seleccionados = priorizados.slice(0, 20).map(function (item) { return item.producto; });
    } else if (categorias.length && productosDeCategoria.length === 0) {
      seleccionados = [];
    } else if (interpretacion.buscaEconomico) {
      const baseOrdenada = categorias.length || hayCoincidenciaTexto
        ? priorizados.map(function (item) { return item.producto; })
        : disponibles.slice();
      seleccionados = baseOrdenada.slice().sort(function (a, b) {
        return (Number(a.precio) || 0) - (Number(b.precio) || 0);
      }).slice(0, 20);
    } else if (!categorias.length && !hayCoincidenciaTexto &&
        !interpretacion.esSaludo && disponibles.length > 20) {
      const pasoRotacion = Math.ceil(disponibles.length / 20);
      const inicioRotacion = (rotacionCatalogoAmplio * pasoRotacion) % disponibles.length;
      rotacionCatalogoAmplio += 1;
      seleccionados = Array.from({ length: 20 }, function (_, indice) {
        const posicion = (inicioRotacion + Math.floor(indice * disponibles.length / 20)) % disponibles.length;
        return disponibles[posicion];
      });
    } else {
      seleccionados = priorizados.slice(0, 20).map(function (item) { return item.producto; });
    }

    const excluidos = new Set((opcionesBusqueda && Array.isArray(opcionesBusqueda.excluirIds)
      ? opcionesBusqueda.excluirIds
      : []).map(String));
    if (excluidos.size && seleccionados.length) {
      const seleccionAnterior = seleccionados;
      const nuevos = seleccionados.filter(function (producto) {
        return !excluidos.has(String(producto.id));
      });
      if (nuevos.length) {
        const idsNuevos = new Set(nuevos.map(function (producto) { return String(producto.id); }));
        priorizados.forEach(function (item) {
          const id = String(item.producto.id);
          if (nuevos.length >= 20 || excluidos.has(id) || idsNuevos.has(id)) return;
          nuevos.push(item.producto);
          idsNuevos.add(id);
        });
        seleccionados = nuevos;
      } else {
        seleccionados = seleccionAnterior;
      }
    }

    const candidatos = seleccionados.map(function (producto) {
      return crearCandidato(producto, catalogo.complementos);
    });
    const idsIncluidos = new Set((opcionesBusqueda && Array.isArray(opcionesBusqueda.incluirIds)
      ? opcionesBusqueda.incluirIds
      : []).map(String));
    if (idsIncluidos.size) {
      const productosIncluidos = Array.from(idsIncluidos)
        .map(function (id) { return productosPorId.get(id); })
        .filter(function (producto) { return producto && !candidatos.some(function (candidato) {
          return candidato.id === String(producto.id);
        }); })
        .slice(0, 3);
      candidatos.splice(Math.max(0, 20 - productosIncluidos.length));
      productosIncluidos.forEach(function (producto) {
        candidatos.push(crearCandidato(producto, catalogo.complementos));
      });
    }
    const categoriasCatalogo = Array.from(new Set(productos.filter(function (producto) {
      const tienda = tiendasPorId.get(String(producto && producto.tiendaId));
      return producto && producto.nombre && producto.categoria &&
        !/^(extra|salsa|opcion)$/.test(normalizarTexto(producto.tipo)) &&
        producto.activo !== false &&
        (!tienda || (tienda.activo !== false && !tiendaEstaOculta(tienda) && tiendaEstaAbierta(tienda)));
    }).map(function (producto) {
      return String(producto.categoria).trim();
    }).filter(Boolean)));

    /* ★ v1.6: bandera `promovida` por tienda (0/1) — la usa el servidor
       para poner primero las tiendas promovidas abiertas. */
    candidatos.forEach(function (candidato) {
      candidato.promovida = esPromovida(tiendasPorId.get(candidato.tiendaId));
    });

    return {
      candidatos: candidatos,
      productosPorId: productosPorId,
      hayCatalogo: tiendas.length > 0 || productos.length > 0,
      categorias: categoriasCatalogo,
      complementos: catalogo.complementos
    };
  }

  function crearCandidato(producto, complementos) {
    return {
      id: String(producto.id),
      nombre: String(producto.nombre).slice(0, 120),
      precio: Number(producto.precio) || 0,
      tiendaId: String(producto.tiendaId || ''),
      categoria: String(producto.categoria || '').slice(0, 40),
      tiendaNombre: String(producto.tiendaNombre || '').slice(0, 80),
      descripcion: String(producto.descripcion || '').slice(0, 160),
      badge: String(producto.badge || '').slice(0, 30),
      opciones: obtenerComplementos(producto, complementos).map(function (opcion) {
        return {
          grupo: String(opcion.grupo || '').slice(0, 50),
          nombre: String(opcion.nombre || '').slice(0, 80),
          precio: Number(opcion.precio) || 0,
          tipo: String(opcion.tipo || '').slice(0, 30),
          min: Number(opcion.min) || 0,
          max: Number(opcion.max) || 0
        };
      })
    };
  }

  function responderPreguntaProducto(consulta, idsReferencia) {
    const tipo = window.DomiIARazonamiento.clasificarPreguntaProducto(consulta);
    if (!tipo) return null;

    const catalogo = leerCatalogoPublicado();
    const tiendasPorId = new Map(catalogo.tiendas.map(function (tienda) {
      return [String(tienda.id), tienda];
    }));
    const productos = catalogo.productos.slice();
    catalogo.tiendas.forEach(function (tienda) {
      if (!Array.isArray(tienda.productos)) return;
      tienda.productos.forEach(function (producto) {
        productos.push(Object.assign({}, producto, {
          tiendaId: producto.tiendaId || tienda.id,
          tiendaNombre: producto.tiendaNombre || tienda.nombre
        }));
      });
    });
    const disponibles = productos.filter(function (producto) {
      if (!producto || producto.id === undefined || !producto.nombre ||
          producto.activo === false || normalizarTexto(producto.badge) === 'agotado') return false;
      const tienda = tiendasPorId.get(String(producto.tiendaId));
      return !tienda || (tienda.activo !== false && !tiendaEstaOculta(tienda) && tiendaEstaAbierta(tienda));
    });
    const texto = normalizarTexto(consulta);
    const textoProducto = texto
      .replace(/^(?:y\s+)?(?:de\s+)?(?:las?|los|el)?\s*/,'')
      .replace(/\b(cuant[oa]s?|numero|cantidad|unidades?|piezas?|vienen|trae|traen|colores?|color|tonos?|incluye|incluyen|incluido|incluida|incluidos|incluidas|que|de|hay|tiene|tienen|producto|presentacion|presentaciones|tamano|talla|medida|son|estan|disponible|disponibles|flores|flor|ramo|ramito)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const productosMencionados = disponibles.filter(function (producto) {
      const nombre = normalizarTexto(producto.nombre);
      return nombre.length > 2 && texto.includes(nombre) ||
        /\b(flor|flores|ramo|ramito)\b/.test(texto) &&
          /\b(flor|flores|ramo|ramito)\b/.test(normalizarTexto(producto.nombre + ' ' + producto.descripcion));
    });
    const ids = new Set((productosMencionados.length
      ? productosMencionados.map(function (producto) { return String(producto.id); })
      : idsReferencia || []).map(String));
    let objetivo = disponibles.filter(function (producto) {
      return ids.has(String(producto.id));
    });
    if (textoProducto) {
      const productosCoincidentes = disponibles.filter(function (producto) {
        const contenido = normalizarTexto(producto.nombre + ' ' + producto.descripcion + ' ' + producto.categoria);
        return textoProducto.split(/\s+/).some(function (palabra) {
          return palabra.length > 2 && contenido.includes(palabra);
        });
      });
      if (productosCoincidentes.length) objetivo = productosCoincidentes;
    }
    if (!objetivo.length) {
      return {
        respuesta: '¿De qué producto quieres saber ese dato? Dime cuál y lo reviso en el catálogo.',
        ids: []
      };
    }

    function obtenerDatos(producto) {
      const descripcion = String(producto.descripcion || '').trim();
      const complementos = obtenerComplementos(producto, catalogo.complementos);
      const coloresConfigurados = complementos.filter(function (opcion) {
        return /\b(color|tono)\b/.test(normalizarTexto(opcion.grupo + ' ' + opcion.nombre));
      }).map(function (opcion) { return String(opcion.nombre).trim(); });
      const coloresTexto = descripcion.match(/\b(?:rojo|roja|azul|amarillo|amarilla|verde|rosado|rosada|rosa|blanco|blanca|negro|negra|morado|morada|lila|violeta|naranja)\b/ig) || [];
      const colores = Array.from(new Set(coloresConfigurados.concat(coloresTexto)));
      const cantidadEnDescripcion = descripcion.match(/\b\d+\s*(?:flores?|unidades?|piezas?|und(?:s)?|ramos?)\b/i);
      const cantidad = cantidadEnDescripcion
        ? cantidadEnDescripcion[0]
        : producto.cantidad && Number(producto.cantidad) > 0
          ? `${producto.cantidad} ${producto.cantidadTipo || 'unidades'}`
          : '';
      const presentacion = [producto.presentacion, producto.tamano, producto.medida]
        .filter(Boolean).map(String);
      const opcionesPresentacion = complementos.filter(function (opcion) {
        return /\b(presentacion|tamano|talla|medida)\b/.test(normalizarTexto(opcion.grupo));
      }).map(function (opcion) { return String(opcion.nombre).trim(); });
      return {
        descripcion: descripcion,
        colores: colores,
        cantidad: cantidad,
        presentacion: presentacion.concat(opcionesPresentacion)
      };
    }

    const detalles = objetivo.slice(0, 3).map(function (producto) {
      return { producto: producto, datos: obtenerDatos(producto) };
    });
    const desconocido = 'el catálogo no especifica ese dato';
    const respuestas = detalles.map(function (item) {
      const nombre = String(item.producto.nombre).trim();
      const datos = item.datos;
      if (tipo === 'cantidad') {
        if (datos.cantidad) return `${nombre}: el catálogo indica ${datos.cantidad}`;
        return `${nombre}: ${desconocido} de cuántas unidades o flores trae`;
      }
      if (tipo === 'colores') {
        if (datos.colores.length) return `${nombre}: aparecen ${datos.colores.join(', ')}`;
        return `${nombre}: ${desconocido} qué colores hay`;
      }
      if (tipo === 'presentacion') {
        if (datos.presentacion.length) return `${nombre}: ${datos.presentacion.join(', ')}`;
        if (datos.descripcion) return `${nombre}: ${datos.descripcion}`;
        return `${nombre}: ${desconocido} su presentación`;
      }
      if (datos.descripcion) return `${nombre}: ${datos.descripcion}`;
      if (datos.presentacion.length) return `${nombre}: ${datos.presentacion.join(', ')}`;
      return `${nombre}: ${desconocido} qué incluye`;
    });
    return { respuesta: respuestas.join('. ') + '.', ids: [] };
  }

  function seleccionarPorTienda(productos) {
    const seleccionados = [];
    const tiendasElegidas = new Set();
    productos.forEach(function (producto) {
      const tienda = normalizarTexto(producto.tiendaNombre);
      if (tienda && tiendasElegidas.has(tienda)) return;
      seleccionados.push(producto);
      if (tienda) tiendasElegidas.add(tienda);
    });
    return (seleccionados.length >= 3 ? seleccionados : productos).slice(0, 3);
  }

  const PALABRAS_FUNCION_IA = new Set([
    'hola', 'como', 'estas', 'quiero', 'quisiera', 'ver', 'si', 'tienen', 'hay',
    'muestra', 'muestrame', 'mostrar', 'catalogo', 'recomendados', 'recomiendame',
    'opciones', 'productos', 'producto', 'porfa', 'favor', 'claro', 'dale', 'listo',
    'gracias', 'que', 'del', 'las', 'los', 'una', 'uno', 'para', 'por', 'de', 'el',
    'la', 'en', 'me', 'puedes', 'podrias', 'quisiera', 'algo', 'rico', 'rica'
  ]);

  function encontrarCoincidencias(texto, productos, categorias) {
    const tokens = normalizarTexto(texto).split(/\s+/).filter(function (token) {
      return token.length > 2 && !PALABRAS_FUNCION_IA.has(token);
    });
    const categoriasSolicitadas = categorias.filter(function (nombre) {
      const normalizada = normalizarTexto(nombre);
      const coincideCategoria = tokens.some(function (token) {
        return token === normalizada ||
          token === normalizada + 's' ||
          normalizada === token + 's';
      });
      if (coincideCategoria) return true;

      const aliasCategoria = {
        almuerzo: /\b(almuerz\w*|almorz\w*|bandeja paisa|menu del dia|parrilla)\b/,
        licores: /\b(licor\w*|aguardiente|ron|whisky|vino)\b/,
        cervezas: /\b(cervez\w*)\b/,
        bebidas: /\b(bebid\w*|gaseosa|jugo|agua)\b/
      };
      const patron = aliasCategoria[normalizada];
      return Boolean(patron && patron.test(normalizarTexto(texto)));
    });
    function posicionCategoria(nombre) {
      const normalizada = normalizarTexto(nombre);
      const posiciones = tokens.filter(function (token) {
        return token === normalizada ||
          token === normalizada + 's' ||
          normalizada === token + 's';
      }).map(function (token) {
        return normalizarTexto(texto).indexOf(token);
      });
      const aliasCategoria = {
        almuerzo: /\b(almuerz\w*|almorz\w*|bandeja paisa|menu del dia|parrilla)\b/,
        licores: /\b(licor\w*|aguardiente|ron|whisky|vino)\b/,
        cervezas: /\b(cervez\w*)\b/,
        bebidas: /\b(bebid\w*|gaseosa|jugo|agua)\b/
      }[normalizada];
      const aliasMatch = aliasCategoria && aliasCategoria.exec(normalizarTexto(texto));
      if (aliasMatch) posiciones.push(aliasMatch.index);
      return posiciones.length ? Math.min.apply(Math, posiciones) : Number.MAX_SAFE_INTEGER;
    }
    categoriasSolicitadas.sort(function (a, b) {
      return posicionCategoria(a) - posicionCategoria(b);
    });

    if (categoriasSolicitadas.length) {
      const textoNormalizado = normalizarTexto(texto);
      const grupos = categoriasSolicitadas.map(function (categoria) {
        const parrilla = categoria === 'Almuerzo' && /\bparrilla\b/.test(textoNormalizado);
        const productoCategoria = productos.filter(function (producto) {
          if (normalizarTexto(producto.categoria) !== normalizarTexto(categoria)) return false;
          return !parrilla || normalizarTexto(producto.tiendaNombre).includes('parrilla');
        });
        const categoriaSolicitada = categoria === 'Menu' && /\bbebid\w*\b/.test(textoNormalizado)
          ? 'Bebidas'
          : parrilla ? 'Parrilla' : categoria;
        return {
          categoria: categoriaSolicitada,
          productos: productoCategoria
        };
      });
      const productosCoincidentes = grupos.reduce(function (todos, grupo) {
        return todos.concat(grupo.productos);
      }, []);
      return {
        etiqueta: grupos.map(function (grupo) { return grupo.categoria.toLowerCase(); }).join(' y '),
        categorias: grupos,
        productos: productosCoincidentes
      };
    }

    const alias = [
      { patron: /\b(salchipap\w*)\b/, texto: 'salchipapa', categoria: 'Menu' },
      { patron: /\b(licor\w*|aguardiente|ron|whisky|vino)\b/, texto: '', categoria: 'Licores', categoriaCompleta: true },
      { patron: /\b(cervez\w*)\b/, texto: '', categoria: 'Cervezas', categoriaCompleta: true },
      { patron: /\b(almuerz\w*|almorz\w*|bandeja paisa|menu del dia)\b/, texto: '', categoria: 'Almuerzo', categoriaCompleta: true },
      { patron: /\b(comida rapida|restaurante)\b/, texto: 'menu', categoria: 'Menu', categoriaCompleta: true },
      { patron: /\b(flor\w*)\b/, texto: 'flor' },
      { patron: /\b(hamburgues\w*|perro caliente|perritos|pizza|lasan\w*)\b/, texto: '', categoria: 'Menu' }
    ].find(function (item) { return item.patron.test(normalizarTexto(texto)); });

    if (alias) {
      const aliasMatch = alias.patron.exec(normalizarTexto(texto));
      const termino = alias.texto || (aliasMatch && aliasMatch[0]) || '';
      const seleccionados = productos.filter(function (producto) {
        const nombre = normalizarTexto(producto.nombre + ' ' + producto.descripcion);
        return (termino && nombre.includes(termino)) ||
          (alias.categoriaCompleta && normalizarTexto(producto.categoria) === normalizarTexto(alias.categoria));
      });
      if (seleccionados.length) {
        const grupoCategoria = alias.categoria
          ? (alias.categoriaCompleta ? alias.categoria : alias.categoria)
          : '';
        return {
          etiqueta: termino === 'menu' ? 'menú' : (alias.categoriaCompleta ? alias.categoria.toLowerCase() : termino),
          categorias: grupoCategoria ? [{ categoria: grupoCategoria, productos: seleccionados }] : [],
          productos: seleccionados
        };
      }
    }

    const productoCoincide = productos.map(function (producto) {
      const nombre = normalizarTexto(producto.nombre);
      const nombreTokens = nombre.split(/\s+/);
      const puntos = tokens.reduce(function (total, token) {
        return total + (nombreTokens.some(function (palabra) {
          return palabra === token ||
            (palabra.length > 4 && palabra.replace(/s$/, '') === token.replace(/s$/, '')) ||
            (palabra.length > 4 && token.length > 4 && (palabra.startsWith(token) || token.startsWith(palabra)));
        }) ? 1 : 0);
      }, 0);
      return { producto: producto, puntos: puntos };
    });
    const maximoPuntaje = Math.max.apply(Math, productoCoincide.map(function (item) { return item.puntos; }));
    const mejorCoincidencia = productoCoincide.filter(function (item) {
      return item.puntos > 0 && item.puntos === maximoPuntaje;
    })
      .sort(function (a, b) { return b.puntos - a.puntos; })
      .map(function (item) { return item.producto; });

    return mejorCoincidencia.length
      ? {
        etiqueta: tokens.join(' '),
        categorias: Array.from(new Set(mejorCoincidencia.map(function (producto) {
          return producto.categoria;
        }))).filter(Boolean).map(function (categoria) {
          return {
            categoria: categoria,
            productos: mejorCoincidencia.filter(function (producto) {
              return producto.categoria === categoria;
            })
          };
        }),
        productos: mejorCoincidencia
      }
      : null;
  }

  function esConsultaDeAyuda(texto) {
    return /\b(como pedir|como hago un pedido|como comprar|como funciona la app|como usar la app|como se hace un pedido|privacidad|terminos|politica|ayuda)\b/.test(normalizarTexto(texto));
  }

  function esSeguimientoDeCatalogo(texto) {
    const normalizado = normalizarTexto(texto);
    return /^(?:si|claro|dale|listo|ok|okay|porfa|por favor|de una|gracias)[.! ]*$/.test(normalizado) ||
      /\b(catalogo|muestr\w*|mostrar|ver|recomendad\w*|opciones|productos|explorar|agregar|anadir|carrito|primero|primera|segundo|segunda|tercero|tercera)\b/.test(normalizado);
  }

  function empiezaConConector(texto) {
    return /^(?:y|tambien|ademas)\b/.test(normalizarTexto(texto).replace(/^[^a-z0-9]+/, ''));
  }

  function buscarContextoEnMensajes(mensajesUsuario, productos, categorias) {
    for (let indice = 0; indice < mensajesUsuario.length; indice += 1) {
      const mensaje = mensajesUsuario[indice];
      if (esConsultaDeAyuda(mensaje.texto)) return null;
      const coincidencia = encontrarCoincidencias(mensaje.texto, productos, categorias);
      if (coincidencia && coincidencia.productos.length) {
        if (empiezaConConector(mensaje.texto)) {
          const anterior = buscarContextoEnMensajes(mensajesUsuario.slice(indice + 1), productos, categorias);
          return combinarCoincidencias(anterior, coincidencia);
        }
        return coincidencia;
      }
      if (!esSeguimientoDeCatalogo(mensaje.texto)) return null;
    }
    return null;
  }

  function contextoDeConversacion(historial, productos, categorias) {
    const mensajesUsuario = (historial || []).filter(function (mensaje) {
      return mensaje.rol === 'user';
    }).slice().reverse();
    return buscarContextoEnMensajes(mensajesUsuario, productos, categorias);
  }

  function combinarCoincidencias(anterior, nueva) {
    if (!anterior || !nueva) return nueva || anterior;
    const grupos = (anterior.categorias || []).concat(nueva.categorias || []);
    const unicos = new Map();
    grupos.forEach(function (grupo) {
      const clave = normalizarTexto(grupo.categoria);
      if (!unicos.has(clave)) unicos.set(clave, grupo);
    });
    if (unicos.size < 2) return nueva;
    const categorias = Array.from(unicos.values());
    return {
      etiqueta: categorias.map(function (grupo) { return grupo.categoria.toLowerCase(); }).join(' y '),
      categorias: categorias,
      productos: categorias.reduce(function (items, grupo) { return items.concat(grupo.productos); }, [])
    };
  }

  function obtenerComplementos(producto, complementos) {
    return (complementos || []).filter(function (complemento) {
      return String(complemento.id_producto) === String(producto.id);
    });
  }

  function consultarSalsaBBQ(texto, productos, complementos, historial) {
    const preguntaPrecio = /\b(costo|cuesta|vale|precio|adicional|cuanto)\b/.test(texto);
    const mencionaBBQ = /\b(bbq|barbacoa)\b/.test(texto);
    const ultimoMensajeUsuario = (historial || []).slice().reverse().find(function (mensaje) {
      return mensaje.rol === 'user';
    });
    const historialMencionaBBQ = ultimoMensajeUsuario &&
      /\b(bbq|barbacoa)\b/.test(normalizarTexto(ultimoMensajeUsuario.texto));
    if (!mencionaBBQ && !(preguntaPrecio && historialMencionaBBQ)) return null;

    const mensajeAncla = mencionaBBQ
      ? texto
      : normalizarTexto(ultimoMensajeUsuario.texto);
    const coincidencia = encontrarCoincidencias(mensajeAncla, productos, []);
    const productosObjetivo = coincidencia ? coincidencia.productos : [];
    const coincidenciasBBQ = (complementos || []).filter(function (complemento) {
      return /\bbbq\b/.test(normalizarTexto(complemento.nombre));
    });

    if (productosObjetivo.length) {
      const asociados = productosObjetivo.map(function (producto) {
        return {
          producto: producto,
          opciones: obtenerComplementos(producto, coincidenciasBBQ)
        };
      }).filter(function (item) { return item.opciones.length; });
      if (asociados.length) {
        const detalles = asociados.slice(0, 3).map(function (item) {
          const opcion = item.opciones[0];
          const precio = Number(opcion.precio) || 0;
          return `${opcion.nombre} para ${item.producto.nombre}: ${precio === 0 ? 'sin costo adicional' : `+$${precio.toLocaleString('es-CO')}`}`;
        });
        return {
          respuesta: detalles.join('; ') + '.',
          ids: preguntaPrecio ? [] : asociados.slice(0, 3).map(function (item) { return String(item.producto.id); })
        };
      }

      const esHamburguesa = /\bhamburgues/i.test(mensajeAncla);
      const tiendasConBBQ = Array.from(new Set(coincidenciasBBQ.map(function (opcion) {
        return productos.find(function (producto) {
          return String(producto.id) === String(opcion.id_producto);
        });
      }).filter(Boolean).map(function (producto) {
        return producto.tiendaNombre;
      }).filter(Boolean))).slice(0, 3);
      const referencia = tiendasConBBQ.length
        ? ` La salsa BBQ figura sin costo adicional en algunos productos de ${tiendasConBBQ.join(', ')}, pero ese precio no se puede trasladar a otro producto.`
        : '';
      return {
        respuesta: esHamburguesa
          ? `No encuentro salsa BBQ asociada a las hamburguesas que muestra el catálogo, así que no puedo confirmar su disponibilidad ni costo para ellas.${referencia}`
          : `No encuentro salsa BBQ asociada a ${productosObjetivo[0].nombre} en los datos del catálogo.${referencia}`,
        ids: preguntaPrecio ? [] : productosObjetivo.slice(0, 3).map(function (producto) { return String(producto.id); })
      };
    }

    const opcionesConProducto = coincidenciasBBQ.map(function (opcion) {
      return {
        opcion: opcion,
        producto: productos.find(function (producto) {
          return String(producto.id) === String(opcion.id_producto);
        })
      };
    }).filter(function (item) { return item.producto; }).slice(0, 3);
    if (!opcionesConProducto.length) return null;
    return {
      respuesta: opcionesConProducto.map(function (item) {
        const precio = Number(item.opcion.precio) || 0;
        return `La BBQ para ${item.producto.nombre} figura ${precio === 0 ? 'sin costo adicional' : `a $${precio.toLocaleString('es-CO')}`}`;
      }).join('; ') + '.',
      ids: []
    };
  }

  function consultarPresentacionesFruta(texto, productos, complementos, historial) {
    const preguntaPrecio = /\b(costo|cuesta|vale|precio|adicional|cuanto)\b/.test(texto);
    const mencionaEnsalada = /\bensalada\b.*\bfrutas\b|\bfrutas\b.*\bensalada\b/.test(texto);
    const ultimoMensajeUsuario = (historial || []).slice().reverse().find(function (mensaje) {
      return mensaje.rol === 'user';
    });
    const historialFruta = ultimoMensajeUsuario &&
      /\bensalada\b.*\bfrutas\b|\bfrutas\b.*\bensalada\b/.test(normalizarTexto(ultimoMensajeUsuario.texto));
    if (!mencionaEnsalada && !(preguntaPrecio && historialFruta)) return null;

    const ensalada = productos.find(function (producto) {
      return normalizarTexto(producto.nombre) === 'ensalada de frutas';
    });
    if (!ensalada) return null;
    const presentaciones = obtenerComplementos(ensalada, complementos).filter(function (opcion) {
      return normalizarTexto(opcion.grupo) === 'presentacion';
    });
    if (!presentaciones.length) return null;

    const precioBase = Number(ensalada.precio) || 0;
    const opciones = presentaciones.map(function (opcion) {
      const adicional = Number(opcion.precio) || 0;
      return `${opcion.nombre}: $${(precioBase + adicional).toLocaleString('es-CO')}${adicional ? ` (+$${adicional.toLocaleString('es-CO')})` : ''}`;
    });
    return {
      respuesta: `La ensalada de frutas cuesta $${precioBase.toLocaleString('es-CO')} y sus presentaciones son: ${opciones.join('; ')}.`,
      ids: preguntaPrecio ? [] : [String(ensalada.id)]
    };
  }

  function recomendarDirectamente(consulta, catalogo, historial, opcionesBusqueda) {
    const texto = normalizarTexto(consulta);
    const productos = Array.from(catalogo.productosPorId.values());
    const complementos = catalogo.complementos || [];
    const interpretacion = window.DomiIARazonamiento.interpretarSolicitud(consulta);
    if (interpretacion.buscaFrioRefrescante) {
      const compatibles = productos.filter(function (producto) {
        const categoria = normalizarTexto(producto.categoria);
        const textoProducto = normalizarTexto(producto.nombre + ' ' + producto.descripcion);
        return /\bbebidas?\b/.test(categoria) ||
            (!/\b(menu|almuerzo|licores|cervezas|farmacia)\b/.test(categoria) && PRODUCTO_FRIO_COMPATIBLE.test(textoProducto));
      });
      if (interpretacion.buscaEconomico) {
        compatibles.sort(function (a, b) {
            return (Number(a.precio) || 0) - (Number(b.precio) || 0);
        });
      }
      const idsExcluidos = new Set((opcionesBusqueda && Array.isArray(opcionesBusqueda.excluirIds)
        ? opcionesBusqueda.excluirIds
        : []).map(String));
      let disponibles = compatibles.filter(function (producto) {
        return !idsExcluidos.has(String(producto.id));
      });
      if (disponibles.length < Math.min(3, compatibles.length)) disponibles = compatibles;

      const porPuntaje = disponibles.map(function (producto, indice) {
        const categoria = normalizarTexto(producto.categoria);
        const textoProducto = normalizarTexto(producto.nombre + ' ' + producto.descripcion);
        return {
          producto: producto,
          indice: indice,
          puntaje: (/\bbebidas?\b/.test(categoria) ? 20 : 0) +
            (PRODUCTO_FRIO_COMPATIBLE.test(textoProducto) ? 10 : 0)
        };
      }).sort(function (a, b) {
        return interpretacion.buscaEconomico
          ? (Number(a.producto.precio) || 0) - (Number(b.producto.precio) || 0) || a.indice - b.indice
          : b.puntaje - a.puntaje || a.indice - b.indice;
      }).map(function (item) { return item.producto; });
      const elegidos = [];
      const categoriasElegidas = new Set();
      if (interpretacion.buscaEconomico) {
        elegidos.push(...porPuntaje.slice(0, 3));
      } else {
        porPuntaje.forEach(function (producto) {
          const categoria = normalizarTexto(producto.categoria);
          if (elegidos.length >= 3 || categoriasElegidas.has(categoria)) return;
          elegidos.push(producto);
          categoriasElegidas.add(categoria);
        });
        porPuntaje.forEach(function (producto) {
          if (elegidos.length < 3 && !elegidos.includes(producto)) elegidos.push(producto);
        });
      }
      if (!elegidos.length) return null;
      const seleccionados = elegidos.map(function (producto) {
        return crearCandidato(producto, complementos);
      });
      const esCorreccion = /\b(quien dijo|quien te dijo|yo no dije|no dije que solo|no solo|no solamente|no unicamente|no exclusivamente|no me limites|no te limites|no necesariamente|amplia(?:r|me)? la busqueda|tambien quiero|tambien puede)\b/.test(texto);
      return {
        respuesta: (esCorreccion
          ? 'Tienes razón, disculpa. Amplío la búsqueda: '
          : 'Encontré opciones de bebidas y alternativas con frutas o postres: ') +
          seleccionados.map(function (producto) {
            return `${producto.nombre}${producto.tiendaNombre ? ' de ' + producto.tiendaNombre : ''}, $${(Number(producto.precio) || 0).toLocaleString('es-CO')}`;
          }).join('; ') + '.',
        ids: seleccionados.map(function (producto) { return String(producto.id); })
      };
    }
    const ayuda = /\b(como pedir|como hago un pedido|como comprar|como funciona la app|como usar la app)\b/.test(texto);
    if (ayuda) {
      return {
        respuesta: 'Para pedir: elige productos y agrégalos al carrito; completa tus datos, dirección y zona; revisa el pedido y el envío, selecciona el pago y confirma por WhatsApp.',
        ids: []
      };
    }

    if (window.DomiIARazonamiento.esSaludoSimple(consulta) ||
        /\b(hola|holi|buenas|buenos dias)\b.*\b(como estas|que tal)\b/.test(texto)) {
      return {
        respuesta: '¡Muy bien, gracias! Estoy aquí para ayudarte a encontrar algo rico en DOMIDELIS. ¿Qué te gustaría pedir hoy?',
        ids: []
      };
    }

    const respuestaBBQ = consultarSalsaBBQ(texto, productos, complementos, historial);
    if (respuestaBBQ) return respuestaBBQ;

    const respuestaPresentaciones = consultarPresentacionesFruta(texto, productos, complementos, historial);
    if (respuestaPresentaciones) return respuestaPresentaciones;

    if (/\b(no se que pedir|no se que quiero|sorprendeme|recomiendame algo)\b/.test(texto)) {
      return {
        respuesta: '¡No te preocupes! ¿Te provoca un almuerzo, comida rápida, una bebida o algo dulce?',
        ids: []
      };
    }

    if (/\b(algo dulce|postres?|antojo dulce)\b/.test(texto)) {
      const dulces = productos.filter(function (producto) {
        return /\b(fresas con crema|copa frutimix|ensalada de frutas|waffle especial|banana splitt|gomitas)\b/.test(normalizarTexto(producto.nombre));
      }).sort(function (a, b) {
        return (Number(a.precio) || 0) - (Number(b.precio) || 0);
      }).slice(0, 3);
      if (dulces.length) {
        return {
          respuesta: '¡Claro! Algunas opciones dulces del catálogo son: ' + dulces.map(function (producto) {
            return `${producto.nombre} de ${producto.tiendaNombre}, $${(Number(producto.precio) || 0).toLocaleString('es-CO')}`;
          }).join('; ') + '.',
          ids: dulces.map(function (producto) { return String(producto.id); })
        };
      }
    }

    if (/\b(que venden|que ofrecen|que hay en domidelis|que productos tienen)\b/.test(texto)) {
      const categoriasNormalizadas = (catalogo.categorias || []).map(normalizarTexto);
      const categoriasGenerales = [];
      if (categoriasNormalizadas.some(function (categoria) {
        return categoria === 'menu' || categoria === 'almuerzo';
      })) categoriasGenerales.push('comidas');
      ['bebidas', 'licores', 'cervezas', 'detalles'].forEach(function (categoria) {
        if (categoriasNormalizadas.includes(categoria)) categoriasGenerales.push(categoria);
      });
      if (categoriasNormalizadas.includes('otras')) categoriasGenerales.push('otros productos');
      if (categoriasNormalizadas.includes('farmacia')) categoriasGenerales.push('productos de farmacia');
      return {
        respuesta: `En DOMIDELIS encuentras ${categoriasGenerales.join(', ') || 'productos del catálogo'}. ¿Qué te gustaría buscar?`,
        ids: []
      };
    }

    const pideAlmuerzoAmplio = /\b(quiero|quisiera|busco|tengo ganas|se me antoja|recomiend\w*|sugier\w*)\b.*\b(almuerz\w*|almorz\w*)\b/.test(texto) &&
      !/\b(opciones|catalogo|muestr\w*|mostrar|licor\w*|cervez\w*|salchipap\w*|producto|parrilla|caser\w*|hamburgues\w*|econom\w*|barat\w*|menor precio)\b/.test(texto);
    if (pideAlmuerzoAmplio) {
      return {
        respuesta: '¡Claro! ¿Qué prefieres: un almuerzo casero, comida rápida o algo especial? Si quieres, también te muestro todas las opciones.',
        ids: []
      };
    }
    if (/\b(tengo hambre|tengo mucha hambre|me dio hambre)\b/.test(texto)) {
      return {
        respuesta: '¡Hola! Con gusto te ayudo. ¿Buscas un almuerzo completo, una hamburguesa o algo más ligero?',
        ids: []
      };
    }

    const esExploracion = /\b(catalogo|muestr\w*|mostrar|ver|recomendad\w*|opciones|productos|explorar|cuales|hay|todo|si|claro|dale|listo|ok|okay|porfa|de una)\b/.test(texto);
    let coincidenciaActual = encontrarCoincidencias(texto, productos, catalogo.categorias || []);
    if (coincidenciaActual && empiezaConConector(texto)) {
      coincidenciaActual = combinarCoincidencias(
        contextoDeConversacion(historial, productos, catalogo.categorias || []),
        coincidenciaActual
      );
    }
    let coincidencia = coincidenciaActual;
    if (!coincidencia) {
      if (!esExploracion) return null;
      coincidencia = contextoDeConversacion(historial, productos, catalogo.categorias || []);
    }

    if (!coincidencia && esExploracion) {
      coincidencia = {
        etiqueta: 'el catálogo',
        productos: (catalogo.candidatos || []).map(function (candidato) {
          return catalogo.productosPorId.get(String(candidato.id));
        }).filter(Boolean)
      };
    }
    if (!coincidencia || !coincidencia.productos.length) return null;

    let productosSeleccionados;
    let productosNoDisponibles = [];
    if (coincidencia.categorias && coincidencia.categorias.length > 1) {
      const gruposDisponibles = coincidencia.categorias.map(function (grupo) {
        const productosGrupo = grupo.productos.slice();
        if (window.DomiIARazonamiento.interpretarSolicitud(consulta).buscaEconomico) {
          productosGrupo.sort(function (a, b) {
            return (Number(a.precio) || 0) - (Number(b.precio) || 0);
          });
        }
        return {
          categoria: grupo.categoria,
          productos: seleccionarPorTienda(productosGrupo).slice(0, 2)
        };
      });
      productosNoDisponibles = gruposDisponibles
        .filter(function (grupo) { return grupo.productos.length === 0; })
        .map(function (grupo) { return grupo.categoria.toLowerCase(); });
      productosSeleccionados = [];
      gruposDisponibles.forEach(function (grupo) {
        if (grupo.productos[0]) productosSeleccionados.push(grupo.productos[0]);
      });
      for (let indice = 1; indice < 2 && productosSeleccionados.length < 4; indice += 1) {
        gruposDisponibles.forEach(function (grupo) {
          const producto = grupo.productos[indice];
          if (producto && productosSeleccionados.length < 4) productosSeleccionados.push(producto);
        });
      }
    } else {
      const productosCoincidencia = coincidencia.productos.slice();
      if (window.DomiIARazonamiento.interpretarSolicitud(consulta).buscaEconomico) {
        productosCoincidencia.sort(function (a, b) {
          return (Number(a.precio) || 0) - (Number(b.precio) || 0);
        });
      }
      productosSeleccionados = seleccionarPorTienda(productosCoincidencia);
    }

    const seleccionados = productosSeleccionados.map(function (producto) {
      return crearCandidato(producto, complementos);
    });
    if (!seleccionados.length) return null;
    const categoriasNoDisponibles = productosNoDisponibles.length
      ? ` No veo opciones disponibles de ${productosNoDisponibles.join(' y ')} en este momento.`
      : '';
    const esAlmuerzoYLicores = coincidencia.categorias &&
      coincidencia.categorias.some(function (grupo) { return grupo.categoria === 'Almuerzo'; }) &&
      coincidencia.categorias.some(function (grupo) { return grupo.categoria === 'Licores'; });
    const mensajeIntroduccion = esAlmuerzoYLicores
      ? '¡Claro! Te muestro primero los almuerzos disponibles y luego los licores: '
      : `¡Claro! Te muestro opciones de ${coincidencia.etiqueta}${coincidencia.categorias && coincidencia.categorias.length > 1 ? ', separadas por categoría' : ''}: `;
    if (esAlmuerzoYLicores && productosNoDisponibles.length) {
      return {
        respuesta: '¡Claro! Te muestro los almuerzos disponibles. Por ahora no veo licores disponibles en el catálogo.',
        ids: seleccionados.filter(function (producto) {
          const original = catalogo.productosPorId.get(producto.id);
          return original && original.categoria === 'Almuerzo';
        }).map(function (producto) { return producto.id; })
      };
    }
    const detallesProducto = seleccionados.map(function (producto) {
      const original = catalogo.productosPorId.get(producto.id);
      const unidades = original && /^\d+\s*und$/i.test(String(original.descripcion || '').trim())
        ? ` (${original.descripcion.trim()})`
        : '';
      const tienda = producto.tiendaNombre ? ` de ${producto.tiendaNombre}` : '';
      return `${producto.nombre}${unidades}${tienda}, $${Number(producto.precio).toLocaleString('es-CO')}`;
    }).join('; ');
    const avisoFarmacia = seleccionados.some(function (producto) {
      return producto.categoria === 'Farmacia';
    })
      ? ' El catálogo muestra estos productos, pero confirma la disponibilidad con la tienda antes de pedir.'
      : '';

    return {
      respuesta: mensajeIntroduccion + detallesProducto + '.' + categoriasNoDisponibles + avisoFarmacia,
      ids: seleccionados.map(function (producto) { return producto.id; })
    };
  }

  window.DomiIACatalogo = {
    buscar: buscar,
    recomendarDirectamente: recomendarDirectamente,
    responderPreguntaProducto: responderPreguntaProducto
  };
})();