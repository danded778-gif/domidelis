'use strict';

(function () {
  const VERSION = 'v2';
  const CLAVE_ETAPA = 'domi_ia_etapa';
  const ETAPAS = {
    saludo: 1,
    venta: 2,
    carrito: 3,
    datos: 4
  };
  const PREGUNTA_CARRITO =
    /\b(?:que|cual(?:es)?|cuant[oa]s?|muestr\w*|ver|revis\w*|resumen|detall\w*|contenido|dime)\b.{0,45}\b(?:mi\s+)?(?:carrito|pedido)\b|\b(?:carrito|pedido)\b.{0,40}\b(?:que|cual(?:es)?|cuant[oa]s?|tengo|llevo|hay|contiene|agregue|agregado|subtotal|total|cuesta|vale)\b|\bque\s+(?:tengo|llevo|he\s+agregado)\s+(?:en\s+el\s+)?(?:carrito|pedido)\b/;
  const CIERRE_PEDIDO =
    /\b(eso es todo|eso seria todo|nada mas|no gracias|ya esta|listo|solo eso|solamente eso|por ahora nada|nada)\b/;

  function leerEtapa() {
    try {
      const valor = Number(localStorage.getItem(CLAVE_ETAPA));
      return Number.isInteger(valor) && valor >= 1 && valor <= 4 ? valor : ETAPAS.saludo;
    } catch (error) {
      return ETAPAS.saludo;
    }
  }

  let etapa = leerEtapa();

  function registrarPaso(nombre) {
    const siguiente = ETAPAS[nombre];
    if (!siguiente || siguiente <= etapa) return;
    etapa = siguiente;
    try {
      localStorage.setItem(CLAVE_ETAPA, String(etapa));
    } catch (error) {
      console.warn('[DOMI IA Etapas] No se pudo guardar el avance de etapa:', error);
    }
  }

  function esPreguntaCarrito(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    return PREGUNTA_CARRITO.test(texto) ||
      /\b(?:cuant[oa]s?|que|cual(?:es)?)\b.{0,30}\b(?:llevo|tengo|he\s+agregado|agregue|vale|cuesta)\b/.test(texto);
  }

  function esCierrePedido(consulta) {
    const texto = window.DomiIARazonamiento.normalizarTexto(consulta);
    return CIERRE_PEDIDO.test(texto) && texto.split(/\s+/).length <= 6;
  }

  function clasificarConsulta(consulta, contexto) {
    const opciones = contexto || {};
    if (esPreguntaCarrito(consulta)) {
      return { etapa: 'carrito', paso: 'consultar' };
    }
    if (window.DomiIARazonamiento.esSaludoSimple(consulta) && !/\d/.test(consulta)) {
      return { etapa: 'saludo', paso: 'saludo_inicial' };
    }
    if (esCierrePedido(consulta) && opciones.tieneCarrito) {
      return { etapa: 'carrito', paso: 'guiar_checkout' };
    }
    if (opciones.tieneDatos) {
      return { etapa: 'datos', paso: 'capturar_datos' };
    }
    if (opciones.intencionAgregar) {
      return { etapa: 'carrito', paso: 'agregar_producto' };
    }
    return { etapa: 'venta', paso: 'asesorar_y_recomendar' };
  }

  function reiniciar() {
    etapa = ETAPAS.saludo;
    try {
      localStorage.setItem(CLAVE_ETAPA, String(etapa));
    } catch (error) {
      console.warn('[DOMI IA Etapas] No se pudo reiniciar la etapa:', error);
    }
  }

  window.DomiIAEtapas = {
    version: VERSION,
    clasificarConsulta: clasificarConsulta,
    esPreguntaCarrito: esPreguntaCarrito,
    registrarPaso: registrarPaso,
    reiniciar: reiniciar,
    etapaActual: function () { return etapa; }
  };
})();
