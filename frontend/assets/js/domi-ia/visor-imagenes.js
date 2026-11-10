'use strict';

/* =====================================================================
   DOMIDELIS · visor-imagenes.js v1.1 — 2026-11-11
   ---------------------------------------------------------------------
   Visor de imágenes en pantalla completa (estilo CAPAS: un archivo
   nuevo, no toca ningún archivo existente).

   Qué corrige la v1.1 ("el visor no deja abrir las imágenes"):
   - La v1.0 creaba la capa del visor SIN estilos: el div quedaba en el
     flujo normal al final de la página (invisible a simple vista) y el
     toque sobre la foto quedaba bloqueado. Ahora el visor se inyecta
     con su propio <style> y sí es un overlay oscuro a pantalla
     completa, por encima del sitio y del chat (z-index 999999, mayor
     que el 99999 del panel del chat y el 10000 del modal del sitio).
   - Usa la URL resuelta de la foto (currentSrc || src), así funciona
     también con imágenes de carga diferida (loading="lazy").
   - Si el toque cae en el área de la foto (.pc-img / .ia-card-img)
     sin dar justo en el <img>, igual abre el visor.

   Cómo se instala (una línea antes de </body>, en las páginas con
   productos o con el chat):
       <script src="js/visor-imagenes.js?v=2"></script>
   (sube la v a 2 para que el navegador descarte la v1.0 cacheada)

   API pública (por si otro módulo quiere abrirlo directamente):
       window.DomiVisorImagenes.abrir(url, titulo)
       window.DomiVisorImagenes.cerrar()

   Seguridad: si la imagen falla al cargar, el visor se cierra solo;
   nunca rompe la página ni interfiere con el carrito.
   ===================================================================== */

(function () {
  /* Selectores REALES verificados en el código del proyecto:
     - .pc-img img  → plantilla de tarjeta de producto (client.js v4.9.2)
     - .ia-card-img img → tarjeta del chat (asistente-ia.js) */
  const SELECTOR_IMAGENES = '.pc-img img, .ia-card-img img';
  const SELECTOR_ZONA_FOTO = '.pc-img, .ia-card-img';
  const SELECTOR_NOMBRE = '.pc-name, .ia-card-nombre';
  const URL_VALIDA = /^(https?:\/\/|data:image|blob:)/i;
  const ID_ESTILOS = 'domi-visor-estilos';

  /* Estilos propios (CAPAS: solo selectores del visor, colores neutros
     con rgba/#fff, nada de la paleta del sitio). */
  const ESTILOS = [
    '#domi-visor-imagenes{position:fixed;top:0;left:0;width:100%;height:100%;',
    'z-index:999999;background:rgba(0,0,0,.92);display:none;',
    'align-items:center;justify-content:center;flex-direction:column;',
    'padding:24px;}',
    '#domi-visor-imagenes.domi-visor--activa{display:flex;}',
    '#domi-visor-imagenes .domi-visor-foto{max-width:92vw;max-height:78vh;',
    'object-fit:contain;border-radius:10px;user-select:none;',
    '-webkit-user-drag:none;box-shadow:0 10px 40px rgba(0,0,0,.6);}',
    '#domi-visor-imagenes .domi-visor-cerrar{position:absolute;top:14px;right:14px;',
    'width:44px;height:44px;border:none;border-radius:50%;cursor:pointer;',
    'background:rgba(255,255,255,.15);color:#fff;font-size:1.2rem;',
    'display:flex;align-items:center;justify-content:center;}',
    '#domi-visor-imagenes .domi-visor-titulo{color:#fff;margin:14px 0 0;',
    'font-size:.95rem;text-align:center;max-width:92vw;}'
  ].join('');

  let capa = null;
  let imagen = null;
  let titulo = null;
  let abierta = false;

  function crearCapa() {
    if (capa) return;

    if (!document.getElementById(ID_ESTILOS)) {
      const estilo = document.createElement('style');
      estilo.id = ID_ESTILOS;
      estilo.textContent = ESTILOS;
      document.head.appendChild(estilo);
    }

    capa = document.createElement('div');
    capa.id = 'domi-visor-imagenes';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Vista ampliada del producto');

    imagen = document.createElement('img');
    imagen.className = 'domi-visor-foto';
    imagen.alt = '';
    imagen.draggable = false;
    imagen.addEventListener('click', function (evento) {
      /* Tocar la foto grande NO cierra el visor. */
      evento.stopPropagation();
    });
    imagen.addEventListener('error', function () {
      cerrar();
    });

    titulo = document.createElement('p');
    titulo.className = 'domi-visor-titulo';

    const botonCerrar = document.createElement('button');
    botonCerrar.type = 'button';
    botonCerrar.className = 'domi-visor-cerrar';
    botonCerrar.setAttribute('aria-label', 'Cerrar vista ampliada');
    botonCerrar.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    botonCerrar.addEventListener('click', function (evento) {
      evento.stopPropagation();
      cerrar();
    });

    capa.append(botonCerrar, imagen, titulo);
    capa.addEventListener('click', function () {
      /* Tocar el fondo oscuro cierra. */
      cerrar();
    });
    document.body.appendChild(capa);
  }

  function abrir(url, textoTitulo) {
    if (!url || !URL_VALIDA.test(String(url))) return;
    crearCapa();

    imagen.src = String(url);
    imagen.alt = String(textoTitulo || 'Vista ampliada');
    const texto = String(textoTitulo || '').trim();
    titulo.textContent = texto;
    titulo.hidden = !texto;
    capa.setAttribute('aria-label', texto || 'Vista ampliada del producto');

    if (!abierta) {
      capa.classList.add('domi-visor--activa');
      abierta = true;
      document.body.style.overflow = 'hidden';
    }
  }

  function cerrar() {
    if (!abierta || !capa) return;
    abierta = false;
    capa.classList.remove('domi-visor--activa');
    imagen.removeAttribute('src');
    document.body.style.overflow = '';
  }

  function nombreDelProducto(target) {
    const tarjeta = target.closest('.pc-card, .ia-card');
    if (!tarjeta) return '';
    const nombre = tarjeta.querySelector(SELECTOR_NOMBRE);
    return nombre ? String(nombre.textContent || '').trim() : '';
  }

  /* Captura (fase 1): si el toque cae sobre la foto de una tarjeta (o
     dentro de su área .pc-img / .ia-card-img), el visor gana y el clic
     NO llega a otros controles. Si la foto no tiene URL válida, no
     bloquea nada y la página sigue funcionando igual. */
  document.addEventListener('click', function (evento) {
    const destino = evento.target;
    if (!destino || typeof destino.closest !== 'function') return;
    if (abierta) {
      /* El visor ya está abierto: sus propios controles manejan el
         toque; aquí no se corta nada fuera de él. */
      return;
    }
    let foto = destino.closest(SELECTOR_IMAGENES);
    if (!foto) {
      const zona = destino.closest(SELECTOR_ZONA_FOTO);
      foto = zona ? zona.querySelector('img') : null;
    }
    if (!foto) return;
    const url = foto.currentSrc || foto.src || '';
    if (!URL_VALIDA.test(String(url))) return;
    evento.preventDefault();
    evento.stopPropagation();
    abrir(url, nombreDelProducto(foto));
  }, true);

  document.addEventListener('keydown', function (evento) {
    if (abierta && (evento.key === 'Escape' || evento.key === 'Esc')) {
      evento.preventDefault();
      cerrar();
    }
  });

  window.DomiVisorImagenes = { abrir: abrir, cerrar: cerrar };
})();