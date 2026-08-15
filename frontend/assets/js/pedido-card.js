/**
 * pedido-card.js
 * -------------------------------------------------------
 * Componente reutilizable de tarjetas de pedido
 * Usado por: Panel Domiciliario + Panel Tiendas
 *
 * Uso:
 *   crearTarjetaPedido(pedido, { modo: 'domiciliario' | 'tienda' | 'historial' })
 * -------------------------------------------------------
 */
(function (global) {
  'use strict';

  function _fmt(valor) {
    if (typeof formatearPrecio === 'function') return formatearPrecio(valor);
    return '$' + Number(valor || 0).toLocaleString('es-CO');
  }

  function _esc(str) {
    if (str === null || str === undefined) return '';
    if (typeof esc === 'function') return esc(str);
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function _escapeQuotes(str) {
    return String(str || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;');
  }

  function _obtenerTiendasTexto(pedido) {
    let productos = [];
    try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { productos = []; }
    const tiendas = new Set();
    productos.forEach(p => {
      if (p.tiendaNombre) tiendas.add(p.tiendaNombre);
    });
    return tiendas.size > 0 ? Array.from(tiendas).join(', ') : '';
  }

  function _parseProductos(pedido) {
    try { return JSON.parse(pedido.productosJson || '[]'); } catch (e) { return []; }
  }

  /**
   * Crea el HTML de una tarjeta de pedido
   * @param {Object} pedido
   * @param {Object} [options]
   * @param {'domiciliario'|'tienda'|'historial'} [options.modo='tienda']
   * @returns {string} HTML
   */
  function crearTarjetaPedido(pedido, options = {}) {
    const modo = options.modo || 'tienda';
    const productos = _parseProductos(pedido);
    const estadoRaw = (pedido.estado || '').toLowerCase().trim();
    const estado = estadoRaw.replace(/\s+/g, '-');
    const esPendiente = estadoRaw === 'pendiente';
    const esHistorial = modo === 'historial';
    const tiendasTexto = _obtenerTiendasTexto(pedido);
    const propina = parseFloat(pedido.propina) || 0;

    let headerHtml = '';

    if (esHistorial) {
      const fe = new Date(pedido.fechaEntregaLocal || pedido.fecha);
      const fechaTexto = fe.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
      headerHtml = `
                <div class="pedido-header">
                    <h3>Pedido #${pedido.id}</h3>
                    <span class="fecha-entrega"><i class="fas fa-calendar-check"></i> ${fechaTexto}</span>
                </div>`;
    } else if (modo === 'tienda') {
      headerHtml = `
                <div class="pedido-header">
                    <span class="pedido-id">#${pedido.id}</span>
                    <span class="estado-badge estado-${estado}">${_esc(pedido.estado).toUpperCase()}</span>
                </div>`;
    } else {
      headerHtml = `
                <div class="pedido-header">
                    <h3>Pedido #${pedido.id}</h3>
                    <span class="estado-badge estado-${estado}">${_esc(pedido.estado)}</span>
                </div>`;
    }

    let bodyHtml = '';

    if (modo === 'tienda') {
      const productosStr = productos.length
        ? productos.map(pr => `${pr.cantidad || 1}x ${_esc(pr.nombre || 'Producto')}`).join(', ')
        : 'Sin detalles';

      bodyHtml = `
                <div class="pedido-detalles">
                    <p><strong>Cliente:</strong> ${_esc(pedido.clienteNombre)}</p>
                    <p><strong>Método Pago:</strong> ${_esc(pedido.metodoPago || 'Efectivo')}</p>
                </div>
                <div class="pedido-productos">${productosStr}</div>
                <div style="text-align:right; margin-top:10px; font-weight:bold; font-size:1.1rem; color:var(--primary);">
                    Total: ${_fmt(pedido.total)}
                </div>`;
    } else {
      let info = '';

      if (tiendasTexto) {
        info += `<p><strong><i class="fas fa-store" style="color:var(--secondary);margin-right:4px"></i>Tienda:</strong> ${_esc(tiendasTexto)}</p>`;
      }
      info += `<p><strong>Cliente:</strong> ${_esc(pedido.clienteNombre)}</p>`;

      if (!esHistorial) {
        info += `<p><strong>Dirección:</strong> ${_esc(pedido.clienteDireccion)}</p>`;
        info += `<p><strong>Teléfono:</strong> ${_esc(pedido.clienteTelefono)}</p>`;
      }

      info += `<p><strong>Total:</strong> ${_fmt(pedido.total)}</p>`;

      if (propina > 0) {
        info += `<p style="color:#2A9D8F;font-weight:700;"><i class="fas fa-hand-holding-heart"></i> Propina: ${_fmt(propina)}</p>`;
      } else {
        info += `<p style="color:var(--gray);"><i class="fas fa-hand-holding-heart"></i> Propina: No</p>`;
      }

      if (!esHistorial) {
        info += `<p><strong>Pago:</strong> ${_esc(pedido.metodoPago || 'Efectivo')}</p>`;
      }

      const max = esHistorial ? 99 : 3;
      const lista = productos.slice(0, max)
        .map(x => `<li>${x.cantidad}x ${_esc(x.nombre)}</li>`)
        .join('');
      const mas = productos.length > max ? `<li>... y ${productos.length - max} más</li>` : '';

      info += `
                <div class="productos-resumen">
                    <strong>${esHistorial ? 'Entregados' : 'Productos'}:</strong>
                    <ul>${lista}${mas}</ul>
                </div>`;

      bodyHtml = `<div class="pedido-info">${info}</div>`;
    }

    let accionesHtml = '';

    if (modo === 'domiciliario' && !esHistorial) {
      const btnEstado = esPendiente
        ? `<button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${pedido.id},'en camino')"><i class="fas fa-motorcycle"></i> En camino</button>`
        : `<button class="btn btn-success btn-sm" onclick="marcarEntregado(${pedido.id})"><i class="fas fa-check"></i> Entregado</button>`;

      const dirEscapada = _escapeQuotes(pedido.clienteDireccion);

      accionesHtml = `
                <div class="estado-botones">
                    ${btnEstado}
                    <button class="btn btn-info btn-sm" onclick="verMapa('${dirEscapada}')"><i class="fas fa-map"></i> Mapa</button>
                    <button class="btn btn-secondary btn-sm" onclick="verDetallePedidoDomiciliario(${pedido.id})"><i class="fas fa-eye"></i> Detalle</button>
                </div>`;
    } else if (esHistorial) {
      const fe = new Date(pedido.fechaEntregaLocal || pedido.fecha);
      const diff = Date.now() - fe.getTime();
      const min = Math.floor(diff / 60000);
      let tiempoTexto = 'ahora';
      if (min >= 1 && min < 60) tiempoTexto = `hace ${min} min`;
      else if (min >= 60) {
        const h = Math.floor(min / 60);
        if (h < 24) tiempoTexto = `hace ${h} h`;
        else {
          const d = Math.floor(h / 24);
          tiempoTexto = d === 1 ? 'ayer' : `hace ${d} días`;
        }
      }

      accionesHtml = `
                <div class="historial-acciones">
                    <span class="tiempo-entrega"><i class="fas fa-clock"></i> ${tiempoTexto}</span>
                </div>`;
    }

    let cardClass = '';
    if (modo === 'tienda') {
      cardClass = `pedido-card-tienda ${estado}`;
    } else {
      cardClass = `panel-card pedido-card ${estado}`;
      if (esHistorial) cardClass += ' historial-card entregado';
    }

    return `
            <div class="${cardClass}">
                ${headerHtml}
                ${bodyHtml}
                ${accionesHtml}
            </div>`;
  }

  global.crearTarjetaPedido = crearTarjetaPedido;

})(typeof window !== 'undefined' ? window : this);