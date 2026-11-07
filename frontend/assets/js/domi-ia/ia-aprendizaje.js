'use strict';

/* =====================================================================
   DOMI IA · Aprendizaje de clientes (ia-aprendizaje.js)
   Guarda lo que los clientes enseñan al asistente y lo entrega al
   razonamiento para mejorar respuestas. Respaldo local + envío opcional
   al servidor del asistente (cuando exista el endpoint /retroalimentacion).
   ===================================================================== */

(function () {
  const CLAVE = 'domi_ia_aprendizaje_v1';
  const LIMITE_EVENTOS = 300;

  /* Aprendizajes "graduados": revisados por ti, aplican a todos.
     Claves en minúscula y sin tildes (se aplican sobre texto normalizado). */
  const SINONIMOS_SEMILLA = {
    // 'cruda': 'bebida hidratante',
    // 'algo dulce': 'postre'
  };

  function memoriaPorDefecto() {
    return { eventos: [], sinonimos: {}, preferencias: [] };
  }

  function leerMemoria() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (!datos || typeof datos !== 'object') return memoriaPorDefecto();
      if (!Array.isArray(datos.eventos)) datos.eventos = [];
      if (!datos.sinonimos || typeof datos.sinonimos !== 'object') datos.sinonimos = {};
      if (!Array.isArray(datos.preferencias)) datos.preferencias = [];
      return datos;
    } catch (error) {
      return memoriaPorDefecto();
    }
  }

  function guardarMemoria(memoria) {
    try {
      memoria.eventos = memoria.eventos.slice(-LIMITE_EVENTOS);
      localStorage.setItem(CLAVE, JSON.stringify(memoria));
    } catch (error) { /* sin espacio o modo privado: se ignora */ }
  }

  /* Envío opcional al servidor: si el endpoint no existe, falla en silencio */
  function enviarAlServidor(carga) {
    if (typeof window.IA_API_URL !== 'string' || !window.IA_API_URL) return;
    try {
      fetch(window.IA_API_URL.replace(/\/$/, '') + '/retroalimentacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carga),
        keepalive: true
      }).catch(function () { /* sin servidor: el respaldo es localStorage */ });
    } catch (error) { /* silencio */ }
  }

  /* tipo: 'positivo' | 'negativo' | 'conversion' | 'reformulacion' | 'sin_respuesta' */
  function registrarEvento(tipo, consulta, detalle) {
    if (!tipo) return;
    const evento = {
      t: Date.now(),
      tipo: String(tipo).slice(0, 20),
      consulta: String(consulta || '').slice(0, 200),
      detalle: String(detalle || '').slice(0, 120)
    };
    const memoria = leerMemoria();
    memoria.eventos.push(evento);
    guardarMemoria(memoria);
    enviarAlServidor(evento);
  }

  /* Tú le enseñas a la IA: frase del cliente -> término real del catálogo */
  function registrarSinonimo(fraseCliente, terminoReal) {
    const clave = String(fraseCliente || '').trim().toLowerCase();
    if (!clave || !terminoReal) return;
    const memoria = leerMemoria();
    memoria.sinonimos[clave] = String(terminoReal).trim().toLowerCase();
    guardarMemoria(memoria);
  }

  function registrarPreferencia(texto) {
    const clave = String(texto || '').trim().toLowerCase();
    if (!clave) return;
    const memoria = leerMemoria();
    if (memoria.preferencias.indexOf(clave) === -1) {
      memoria.preferencias.push(clave);
      if (memoria.preferencias.length > 20) memoria.preferencias.shift();
    }
    guardarMemoria(memoria);
    enviarAlServidor({ tipo: 'preferencia', consulta: clave, t: Date.now() });
  }

  function aplicarSinonimos(texto) {
    let resultado = String(texto || '');
    const memoria = leerMemoria();
    const diccionario = {};
    Object.keys(SINONIMOS_SEMILLA).forEach(function (clave) {
      diccionario[clave] = SINONIMOS_SEMILLA[clave];
    });
    Object.keys(memoria.sinonimos).forEach(function (clave) {
      diccionario[clave] = memoria.sinonimos[clave];
    });
    Object.keys(diccionario).forEach(function (clave) {
      if (clave.length > 2 && resultado.indexOf(clave) !== -1) {
        resultado = resultado.split(clave).join(diccionario[clave]);
      }
    });
    return resultado;
  }

  function contarConsultas(tipos) {
    const memoria = leerMemoria();
    const conteo = {};
    memoria.eventos.forEach(function (evento) {
      if (tipos.indexOf(evento.tipo) === -1) return;
      const consulta = (evento.consulta || '').trim();
      if (consulta.length > 3) conteo[consulta] = (conteo[consulta] || 0) + 1;
    });
    return Object.keys(conteo).sort(function (a, b) {
      return conteo[b] - conteo[a];
    });
  }

  /* Lo que SÍ funciona: para chips y ejemplos */
  function consultasFrecuentes(limite) {
    return contarConsultas(['positivo', 'conversion']).slice(0, limite || 8);
  }

  /* Lo que FALLA: tu lista de trabajo (FAQ nueva, sinónimos, regex) */
  function preguntasFallidas(limite) {
    return contarConsultas(['negativo', 'reformulacion', 'sin_respuesta']).slice(0, limite || 10);
  }

  function preferencias() {
    return leerMemoria().preferencias.slice(0, 20);
  }

  function exportar() {
    const memoria = leerMemoria();
    const resumen = {
      exportado: new Date().toISOString(),
      consultasFrecuentes: consultasFrecuentes(15),
      preguntasFallidas: preguntasFallidas(15),
      sinonimos: memoria.sinonimos,
      preferencias: memoria.preferencias,
      eventos: memoria.eventos
    };
    const blob = new Blob([JSON.stringify(resumen, null, 2)], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'domi-ia-aprendizaje.json';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  window.DomiIAAprendizaje = {
    registrarEvento: registrarEvento,
    registrarSinonimo: registrarSinonimo,
    registrarPreferencia: registrarPreferencia,
    aplicarSinonimos: aplicarSinonimos,
    consultasFrecuentes: consultasFrecuentes,
    preguntasFallidas: preguntasFallidas,
    preferencias: preferencias,
    exportar: exportar
  };
})();