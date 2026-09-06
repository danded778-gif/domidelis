(function () {
  'use strict';

  var filtradoDatos = false;

  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactar(texto) {
    return normalizar(texto).replace(/\s+/g, '');
  }

  function tiendaEstaOculta(tienda) {
    if (!tienda) return false;
    var desc = compactar(tienda.descripcion);
    var nombre = normalizar(tienda.nombre);
    if (desc.indexOf('(oculto)') !== -1) return true;
    if (desc.indexOf('mantenimiento(oculto)') !== -1) return true;
    if (nombre === 'mantenimiento') return true;
    return false;
  }

  function tarjetaDebeOcultarse(card) {
    if (!card || card.getAttribute('data-placeholder') === '1') return false;
    var titulo = card.querySelector('h3');
    var desc = card.querySelector('.store-desc');
    var nombre = normalizar(titulo ? titulo.textContent : '');
    var texto = compactar(
      (titulo ? titulo.textContent : '') + ' ' + (desc ? desc.textContent : '')
    );
    if (texto.indexOf('(oculto)') !== -1) return true;
    if (nombre === 'mantenimiento') return true;
    return false;
  }

  function filtrarDatos() {
    var lista;
    try {
      lista = tiendas;
    } catch (e) {
      return false;
    }
    if (!Array.isArray(lista) || lista.length === 0) return false;

    var ocultas = lista.filter(tiendaEstaOculta);
    if (ocultas.length === 0) return true;

    var ids = {};
    ocultas.forEach(function (t) { ids[String(t.id)] = true; });

    tiendas = lista.filter(function (t) { return !tiendaEstaOculta(t); });

    try {
      if (Array.isArray(productosGlobal)) {
        productosGlobal = productosGlobal.filter(function (p) {
          return !ids[String(p.tiendaId)];
        });
      }
    } catch (e) { /* productosGlobal aún no existe */ }

    filtradoDatos = true;
    return true;
  }

  function ocultarTarjetasPintadas() {
    var cards = document.querySelectorAll('.store-card');
    cards.forEach(function (card) {
      if (tarjetaDebeOcultarse(card)) card.remove();
    });
  }

  function aplicar() {
    if (!filtradoDatos) filtrarDatos();
    ocultarTarjetasPintadas();
  }

  function envolver(nombre) {
    var original = window[nombre];
    if (typeof original !== 'function') return false;
    if (original._tiendaOcultoWrapped) return true;
    var wrapped = function () {
      filtrarDatos();
      var result = original.apply(this, arguments);
      ocultarTarjetasPintadas();
      return result;
    };
    wrapped._tiendaOcultoWrapped = true;
    window[nombre] = wrapped;
    return true;
  }

  function intentarEnvolver() {
    envolver('renderizarTiendas');
    envolver('renderizarProductosDestacados');
    envolver('mostrarProductosPorCategoria');
  }

  intentarEnvolver();
  aplicar();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      intentarEnvolver();
      aplicar();
    });
  }

  window.addEventListener('load', function () {
    intentarEnvolver();
    aplicar();
    setTimeout(aplicar, 800);
    setTimeout(aplicar, 2500);
  });

  var roots = ['stores-grid', 'stores-grid-cerradas', 'productos-destacados-grid'];
  roots.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el || typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () { ocultarTarjetasPintadas(); });
    obs.observe(el, { childList: true, subtree: true });
  });
})();
