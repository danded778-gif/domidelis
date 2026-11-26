/* =====================================================================
   DOMIDELIS · marca-agua.js v1.2 — sello automático en las fotos
   CAPAS: módulo nuevo. No toca ningún archivo existente del proyecto.

   QUÉ HACE
   - Cuando una foto del catálogo aparece en pantalla, le dibuja encima
     el sello "DOMIDELIS + WhatsApp" repetido en diagonal.
   - FUNCIONA SOLO AL MOSTRAR: tus archivos originales nunca cambian.
     Sigues procesando y subiendo fotos 1 por 1 como siempre, y todas
     salen selladas automáticamente (las viejas y las nuevas).
   - En tu propio teléfono puedes ver las fotos limpias (ver abajo).

   MODO PROPIETARIO (ver fotos limpias en un dispositivo)
   - Una sola vez, abre:   index.html?marca-off=DOMIDELIS-2026
     El sello se apaga SOLO en ese dispositivo (queda guardado).
   - Para volver a sellar: index.html?marca-on=DOMIDELIS-2026
   - Después de activar o desactivar, recarga la página.

   LÍMITE HONESTO
   - El sello es una marca visible y un disuasorio: no es una muralla.
     Quien sepa de tecnología podría intentar quitarlo. El sello en
     diagonal completa hace que limpiarlo cueste más que crear las
     propias fotos, y que cada foto robada anuncie tu marca.
   ===================================================================== */

(function () {
  'use strict';

  /* ════════════════ CONFIGURACIÓN FÁCIL ════════════════ */

  /* Texto principal del sello (tu marca). */
  const TEXTO_MARCA = 'DOMIDELIS';

  /* Línea pequeña debajo: tu WhatsApp. Déjalo vacío ('') si no quieres teléfono. */
  const TELEFONO_MARCA = 'WhatsApp 300 500 5306';

  /* Cómo se ve el número: 'negro' = oscuro con borde blanco, se lee bien en
     fotos claras Y oscuras (recomendado, idea de Estiven). 'blanco' = igual
     que la marca. */
  const ESTILO_NUMERO = 'negro';

  /* Qué tan marcado va el número cuando es negro: 0.55 = bien legible (7/10). */
  const OPACIDAD_NUMERO = 0.55;

  /* Qué tan visible (escala de 1 a 10):
     0.22 = suave (2/10) · 0.32 = medio-bajo (4/10)
     0.42 = medio-fuerte (6/10, ACTUAL) · 0.52 = fuerte (8/10) */
  const OPACIDAD = 0.42;

  /* Tamaño de letra y separación de las rayas (mosaico fino).
     Para el estilo "3-4 rayitas grandes" (muestra E) usa:
     0.085, 14 y 10. */
  const ESCALA_LETRA = 0.052;
  const SEPARACION_X = 10;
  const SEPARACION_Y = 7;

  /* Llave para activar/desactivar el sello en tu dispositivo. Cámbiala cuando quieras. */
  const CLAVE_CONFIG = 'DOMIDELIS-2026';

  /* Dónde se sella: fotos de tarjetas de producto y de destacados. */
  const SELECTOR_FOTOS = '.pc-img img';
  const SELECTOR_DESTACADOS = '.destacado-card-img';

  /* ═════════════════════════════════════════════════════ */

  const LLAVE_LOCAL = 'domi_marca_agua';

  /* ── Encender / apagar por URL (queda guardado en el dispositivo) ── */
  function procesarUrl() {
    let off = null;
    let on = null;
    try {
      const params = new URLSearchParams(window.location.search);
      off = params.get('marca-off');
      on = params.get('marca-on');
    } catch (e) { return; }
    if (!off && !on) return;
    try {
      if (off && off === CLAVE_CONFIG) localStorage.setItem(LLAVE_LOCAL, 'OFF');
      if (on && on === CLAVE_CONFIG) localStorage.removeItem(LLAVE_LOCAL);
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
    try {
      window.history.replaceState(null, '', window.location.origin + window.location.pathname);
    } catch (e) { /* sin historial: no pasa nada */ }
  }

  function estaApagada() {
    try { return localStorage.getItem(LLAVE_LOCAL) === 'OFF'; } catch (e) { return false; }
  }

  /* ── Dibuja el sello en un lienzo (canvas) ── */
  function sellarLienzo(lienzo, ancho, alto) {
    const ctx = lienzo.getContext('2d');
    const base = Math.max(ancho, alto);
    const letra = Math.max(15, Math.round(base * ESCALA_LETRA));
    const letraTel = Math.max(12, Math.round(letra * 0.6));
    const pasoX = Math.round(letra * SEPARACION_X);
    const pasoY = Math.round(letra * SEPARACION_Y);
    const angulo = (-25 * Math.PI) / 180;
    const numeroOscuro = ESTILO_NUMERO === 'negro';
    const lineaTel = Math.max(1, Math.round(letraTel * 0.1));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(ancho / 2, alto / 2);
    ctx.rotate(angulo);
    for (let y = -alto; y < alto; y += pasoY) {
      for (let x = -ancho; x < ancho; x += pasoX) {
        ctx.globalAlpha = OPACIDAD;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(30,30,30,0.45)';
        ctx.lineWidth = Math.max(1, Math.round(letra * 0.07));
        ctx.font = '700 ' + letra + 'px Arial, Helvetica, sans-serif';
        ctx.strokeText(TEXTO_MARCA, x, y - letra * 0.38);
        ctx.fillText(TEXTO_MARCA, x, y - letra * 0.38);
        if (TELEFONO_MARCA) {
          ctx.globalAlpha = numeroOscuro ? OPACIDAD_NUMERO : OPACIDAD;
          ctx.font = '600 ' + letraTel + 'px Arial, Helvetica, sans-serif';
          if (numeroOscuro) {
            ctx.fillStyle = '#1a1a1a';
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = lineaTel;
          }
          ctx.strokeText(TELEFONO_MARCA, x, y + letra * 0.5);
          ctx.fillText(TELEFONO_MARCA, x, y + letra * 0.5);
        }
      }
    }
    ctx.restore();
  }

  /* Devuelve dataURL sellado de una imagen ya cargada. */
  function imagenSellada(url) {
    return new Promise(function (resolver) {
      const img = new Image();
      /* Las fotos viven en el CDN (jsDelivr): pedimos permiso CORS
         para poder dibujarlas y sellarlas sin bloqueos del navegador. */
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          const ancho = img.naturalWidth || img.width;
          const alto = img.naturalHeight || img.height;
          if (ancho < 120 || alto < 120) { resolver(null); return; }
          const lienzo = document.createElement('canvas');
          lienzo.width = ancho;
          lienzo.height = alto;
          const ctx = lienzo.getContext('2d');
          /* Fondo blanco de seguridad (evita negro en PNG con transparencia) */
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, ancho, alto);
          ctx.drawImage(img, 0, 0, ancho, alto);
          sellarLienzo(lienzo, ancho, alto);
          resolver(lienzo.toDataURL('image/jpeg', 0.9));
        } catch (e) { resolver(null); }
      };
      img.onerror = function () { resolver(null); };
      img.src = url;
    });
  }

  /* Imágenes con promesa en vuelo (permite reintentos si una carga falla) */
  const enProceso = new WeakSet();

  /* ── Fotos <img> del catálogo ── */
  function sellarImg(img) {
    if (!img || !img.src) return;
    const src = img.src;
    if (src.indexOf('data:') === 0) return;             /* ya sellada */
    if (enProceso.has(img)) return;                     /* ya va en camino */
    enProceso.add(img);
    imagenSellada(src).then(function (sello) {
      enProceso.delete(img);                            /* si falló, se reintenta */
      if (sello && img.src === src) img.src = sello;
    });
  }

  /* ── Fotos de fondo de los destacados ── */
  const enProcesoFondo = new WeakSet();
  function sellarFondo(el) {
    const fondo = el.style.backgroundImage || '';
    const coincidencia = /url\(["']?([^"')]+)["']?\)/.exec(fondo);
    if (!coincidencia) return;
    const url = coincidencia[1];
    if (url.indexOf('data:') === 0 || enProcesoFondo.has(el)) return;
    enProcesoFondo.add(el);
    imagenSellada(url).then(function (sello) {
      enProcesoFondo.delete(el);
      if (sello) el.style.backgroundImage = 'url("' + sello + '")';
    });
  }

  /* ── Revisa un elemento y sus descendientes ── */
  function revisar(raiz) {
    if (estaApagada()) return;
    if (!raiz || !raiz.querySelectorAll) {
      if (raiz && raiz.matches) {
        if (raiz.matches(SELECTOR_FOTOS)) sellarImg(raiz);
        if (raiz.matches(SELECTOR_DESTACADOS)) sellarFondo(raiz);
      }
      return;
    }
    const fotos = raiz.querySelectorAll(SELECTOR_FOTOS);
    for (let i = 0; i < fotos.length; i++) sellarImg(fotos[i]);
    const destacados = raiz.querySelectorAll(SELECTOR_DESTACADOS);
    for (let j = 0; j < destacados.length; j++) sellarFondo(destacados[j]);
  }

  /* ── Vigilante: cualquier tarjeta nueva o refrescada se sella sola ── */
  let programado = false;
  function vigilar() {
    const observador = new MutationObserver(function () {
      if (programado) return;
      programado = true;
      requestAnimationFrame(function () {
        programado = false;
        if (estaApagada()) return;
        revisar(document);
      });
    });
    observador.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'src']
    });
  }

  /* ── Arranque ── */
  procesarUrl();
  if (estaApagada()) return;

  function arrancar() {
    revisar(document);
    vigilar();
    /* Segunda pasada por si las fotos tardaron en cargar */
    setTimeout(function () { revisar(document); }, 1500);
    setTimeout(function () { revisar(document); }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar, { once: true });
  } else {
    arrancar();
  }
})();