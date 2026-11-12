'use strict';

(function () {
  const PALABRAS_VACIAS = new Set([
    'tengo', 'ganas', 'quiero', 'quisiera', 'busco', 'recomiendame', 'recomienda',
    'recomiendas', 'sugiereme', 'sugerencias', 'opciones', 'algo', 'rico', 'rica',
    'antojo', 'antoja', 'tienen', 'hay', 'disponibles', 'mostrar', 'muestrame',
    'para', 'con', 'una', 'uno', 'del', 'que', 'esto', 'esta', 'este', 'porfavor',
    'el', 'la', 'los', 'las', 'un', 'unos', 'unas', 'de', 'en', 'por', 'favor',
    'me', 'mi', 'mis', 'te', 'se', 'es', 'son', 'y', 'o', 'a', 'al', 'como',
    'cuando', 'donde', 'mas', 'menos', 'tambien', 'tiene', 'cual', 'cuales',
    'quiero', 'quisiera', 'podria', 'puedes', 'puedo', 'ser', 'estar', 'noche',
    'dia', 'hoy'
  ]);

  function normalizarTexto(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function esSaludoSimple(texto) {
    return /^(?:hola|holi|buenas(?:\s+(?:dias|tardes|noches))?|buenos dias|hey|ey|que tal|como estas)[\s!,.¿?]*$/
      .test(normalizarTexto(texto));
  }

  function clasificarPreguntaProducto(consulta) {
    const texto = normalizarTexto(consulta);
    if (/\b(color(?:es)?|tonos?)\b/.test(texto)) return 'colores';
    if (/\b(cuant[oa]s?|numero de|cantidad|unidades?|piezas?|vienen)\b/.test(texto)) return 'cantidad';
    if (/\b(incluye|incluyen|incluido|incluida|incluidos|incluidas|que trae|que tiene|contenido)\b/.test(texto)) return 'incluye';
    if (/\b(presentacion|presentaciones|tamano|talla|medida)\b/.test(texto)) return 'presentacion';
    return null;
  }

  function interpretarSolicitud(consulta) {
    const texto = normalizarTexto(consulta);
    const solicitaRopa = /\b(ropa|vestuario|vestimenta|prenda\w*|camis\w*|pantalon\w*|vestid\w*|zapato\w*|zapatilla\w*|calzado|tenis|falda\w*|chaqueta\w*|blusa\w*)\b/.test(texto);
    const categoriasPrioritarias = /\b(?:almuerzos?|almorz\w*|menu(?:\s+del)?\s+dia)\b/.test(texto)
      ? ['almuerzo']
      : /\b(?:desayunos?|desayunar|desayunamos)\b/.test(texto)
        ? ['desayuno', 'menu']
        : [];
    const palabras = texto.split(/\s+/).filter(function (palabra) {
      return palabra.length > 3 && !PALABRAS_VACIAS.has(palabra);
    });
    const intencionAgregar = /\b(?:agrega(?:me|lo|la|r|s)?|anade(?:me|lo|la|r|s)?|mete(?:me|lo|la|s)?|pon(?:me|lo|la|es)?|incluye(?:me|lo|la|s)?|(?:quiero|quisiera|puedes|podrias|me puedes|me podrias)\s+(?:agregar|anadir|meter(?:lo|la)?|poner(?:lo|la)?|incluir))\b/.test(texto);
    const buscaFrioRefrescante = /\b(fr[ií]o|fr[ií]a|fr[ií]os|fr[ií]as|fresq\w*|fresc\w*|refresc\w*|helad\w*|congelad\w*|granizad\w*|frapp\w*|frozen)\b/.test(texto);

    return {
      texto: texto,
      palabras: palabras,
      categoriasPrioritarias: categoriasPrioritarias,
      solicitaRopa: solicitaRopa,
      buscaEconomico: /\b(economico|economica|economicos|economicas|barato|barata|baratos|baratas|menor precio|bajo presupuesto)\b/.test(texto),
      buscaFrioRefrescante: buscaFrioRefrescante,
      tipoPreguntaProducto: clasificarPreguntaProducto(texto),
      esSaludo: esSaludoSimple(texto),
      intencionAgregar: intencionAgregar
    };
  }

  function limpiarTextoHTML(html) {
    const documento = new DOMParser().parseFromString(html, 'text/html');
    documento.querySelectorAll('script, style, nav, header, footer, button:not(.faq-button), input, .search-modal').forEach(function (elemento) {
      elemento.remove();
    });
    return documento;
  }

  function extraerSecciones(documento, tipo, url) {
    const main = documento.querySelector('main');
    if (!main) return [];

    if (tipo === 'ayuda') {
      const preguntas = Array.from(main.querySelectorAll('.faq-item')).map(function (item) {
        return {
          titulo: item.querySelector('.faq-button span')?.textContent.trim() || 'Ayuda',
          texto: item.querySelector('.faq-answer')?.textContent.trim() || '',
          fuente: url
        };
      }).filter(function (seccion) { return seccion.texto; });
      const guias = Array.from(main.querySelectorAll('h2')).map(function (titulo, indice) {
        const bloque = titulo.closest('section') || titulo.parentElement;
        const contenido = bloque ? bloque.cloneNode(true) : null;
        if (contenido) contenido.querySelectorAll('h2').forEach(function (elemento) {
          elemento.remove();
        });
        return {
          titulo: titulo.textContent.trim(),
          texto: contenido ? contenido.textContent.trim().replace(/\s+/g, ' ').slice(0, 1800) : '',
          fuente: url,
          indice: indice
        };
      }).filter(function (seccion) { return seccion.texto; });
      return guias.concat(preguntas);
    }

    const titulos = Array.from(main.querySelectorAll('h2'));
    return titulos.map(function (titulo, indice) {
      const texto = [];
      let elemento = titulo.nextElementSibling;
      while (elemento && elemento.tagName.toLowerCase() !== 'h2' &&
        !elemento.querySelector('h2')) {
        const contenido = elemento.textContent.trim();
        if (contenido) texto.push(contenido);
        elemento = elemento.nextElementSibling;
      }
      return {
        titulo: titulo.textContent.trim(),
        texto: texto.join(' ').slice(0, 1800),
        fuente: url,
        indice: indice
      };
    }).filter(function (seccion) { return seccion.texto; });
  }

  function obtenerConocimiento(consulta) {
    const texto = normalizarTexto(consulta);
    const consultaAyuda = /\b(ayuda|soporte|politica|privacidad|terminos?|condiciones|cancelar|cancelacion|devolucion|reclamo|pago|envio|entrega|datos personales|promocion|pedido|contacto|aplicacion|app|funciona|funcionamiento|usar|uso|agregar|anadir|carrito|checkout|confirmar|instalar|zona|barrio|domicilio)\b/.test(texto);
    if (!consultaAyuda) return Promise.resolve([]);

    if (!window.__domiIADocumentosOficiales) {
      const fuentes = [
        { tipo: 'ayuda', ruta: 'pages/centro-de-ayuda.html' },
        { tipo: 'politica', ruta: 'pages/politicas.html' },
        { tipo: 'terminos', ruta: 'pages/terminos.html' },
        { tipo: 'terminos', ruta: 'pages/TyC.html' }
      ];
      window.__domiIADocumentosOficiales = Promise.all(fuentes.map(async function (fuente) {
        const url = new URL(fuente.ruta, document.baseURI);
        try {
          const respuesta = await fetch(url.href, { cache: 'no-cache' });
          if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
          const documento = limpiarTextoHTML(await respuesta.text());
          return extraerSecciones(documento, fuente.tipo, '/' + fuente.ruta);
        } catch (error) {
          console.warn('[Asistente IA] No se pudo cargar ' + fuente.ruta + ':', error.message);
          return [];
        }
      })).then(function (grupos) {
        return grupos.flat();
      });
    }

    const terminos = texto.split(/\s+/).filter(function (termino) {
      return termino.length > 3 && !PALABRAS_VACIAS.has(termino);
    });
    return window.__domiIADocumentosOficiales.then(function (secciones) {
      return secciones.map(function (seccion) {
        const contenido = normalizarTexto(seccion.titulo + ' ' + seccion.texto);
        const puntos = terminos.reduce(function (total, termino) {
          const variantes = [termino];
          if (termino.length > 4 && /[aeiou]$/.test(termino)) variantes.push(termino.slice(0, -1));
          if (termino.length > 4 && /s$/.test(termino)) variantes.push(termino.slice(0, -1));
          return total + (variantes.some(function (variante) {
            return contenido.includes(variante);
          }) ? 1 : 0);
        }, 0);
        return { seccion: seccion, puntos: puntos };
      }).filter(function (item) { return item.puntos > 0; })
        .sort(function (a, b) { return b.puntos - a.puntos; })
        .slice(0, 5)
        .map(function (item) {
          return {
            titulo: item.seccion.titulo.slice(0, 120),
            texto: item.seccion.texto.slice(0, 1200),
            fuente: item.seccion.fuente
          };
        });
    });
  }

  function crearContextoNegocio(tiendas) {
    const contexto = {
      zonaHoraria: 'America/Bogota',
      fechaHoraActual: new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'full',
        timeStyle: 'short'
      }).format(new Date()),
      tiendas: [],
      zonas: []
    };

    if (Array.isArray(tiendas)) {
      contexto.tiendas = tiendas.map(function (tienda) {
        let abiertaAhora = null;
        if (typeof window.checkStoreStatus === 'function') {
          try {
            abiertaAhora = window.checkStoreStatus(tienda.horario).isOpen;
          } catch (error) {
            console.warn('[Asistente IA] No se pudo comprobar el horario de una tienda:', error);
          }
        }

        return {
          id: String(tienda.id || ''),
          nombre: String(tienda.nombre || '').slice(0, 80),
          horario: String(tienda.horario || '').slice(0, 500),
          abiertaAhora: abiertaAhora,
          promovida: Number(tienda.promovida) === 1 || tienda.promovida === true,
          esTiendaBase: normalizarTexto(tienda.nombre).includes('domi delis')
        };
      }).sort(function (a, b) {
        return Number(b.abiertaAhora === true) - Number(a.abiertaAhora === true) ||
          Number(b.promovida) - Number(a.promovida) ||
          Number(b.esTiendaBase) - Number(a.esTiendaBase);
      }).slice(0, 60);
    }

    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.zonas) {
      contexto.zonas = Object.entries(APP_CONFIG.zonas).filter(function (entrada) {
        return entrada[1].activo !== false;
      }).slice(0, 100).map(function (entrada) {
        return {
          nombre: String(entrada[1].nombre || entrada[0]).slice(0, 80),
          envioBase: Number(entrada[1].envio) || 0
        };
      });
    }

    return contexto;
  }

  function completarContextoConCatalogo(contexto, catalogo) {
    contexto.categoriasCatalogo = Array.isArray(catalogo && catalogo.categorias)
      ? catalogo.categorias.slice(0, 30)
      : [];
    return contexto;
  }

  window.DomiIARazonamiento = {
    normalizarTexto: normalizarTexto,
    esSaludoSimple: esSaludoSimple,
    clasificarPreguntaProducto: clasificarPreguntaProducto,
    interpretarSolicitud: interpretarSolicitud,
    crearContextoNegocio: crearContextoNegocio,
    completarContextoConCatalogo: completarContextoConCatalogo,
    obtenerConocimiento: obtenerConocimiento
  };
})();
