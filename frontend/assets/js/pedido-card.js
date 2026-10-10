/**
 * pedido-card.js
 * -------------------------------------------------------
 * Componente reutilizable de tarjetas de pedido
 * Usado por: Panel Domiciliario + Panel Tiendas
 *
 * Uso:
 *   crearTarjetaPedido(pedido, { modo: 'domiciliario' | 'tienda' | 'historial' })
 *
 * ★★★ v1.6 — COMPLEMENTOS VISIBLES EN MODO TIENDA ★★★
 * - Antes: los productos se pintaban como string plano
 *   ("2x Producto, 1x Otro") — los complementos viajaban en el
 *   JSON pero no se mostraban.
 * - Ahora: bloque producto-por-producto con:
 *     • cantidad x nombre (tipo UND/KG) + precio a la derecha
 *     • debajo, SI el producto tiene, el detalle de complementos
 *       en gris pequeño con barrita verde (mismo estilo del
 *       detalle del admin: formatearComplementosDetalle en
 *       admin/pedidos.js — texto "✦ Grupo: ítem | ✦ Grupo2: ítem")
 * - El total YA incluye complementos (vienen sumados en cada
 *   p.subtotal que arma tiendaRoutes.js) — solo presentación.
 * - Datos sucios cubiertos: cantidadTipo numérico (ej: 1) → "UND",
 *   complementos vacíos → no se pinta nada.
 * - Modos 'domiciliario' e 'historial': SIN CAMBIOS.
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

  // ============================================
  // ★ v1.6 — COMPLEMENTOS DE UN PRODUCTO
  // El texto llega como: "✦ Grupo: A, B | ✦ Grupo2: C"
  // (así lo arma el checkout). Se parte por "|" y cada
  // línea se pinta con ✔ — mismo estilo del detalle del
  // admin (formatearComplementosDetalle en admin/pedidos.js),
  // pero con implementación local para no depender de que
  // ese archivo esté cargado en este panel.
  // Estilos inline → cero cambios en tiendas.css.
  // ============================================
  function _complementosHtml(textoComplementos) {
    if (!textoComplementos || String(textoComplementos).trim() === '') return '';

    const lineas = String(textoComplementos)
      .split('|')
      .map(l => l.trim())
      .filter(l => l !== '');

    if (lineas.length === 0) return '';

    return `
        <div style="font-size:0.78rem; color:var(--gray); padding:4px 10px; border-left:2px solid var(--accent); margin:4px 0 6px 12px; line-height:1.5;">
            ${lineas.map(l => `<div>✔ ${_esc(l)}</div>`).join('')}
        </div>`;
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
      // ============================================
      // ★ v1.6 — BLOQUE DE PRODUCTOS REESTRUCTURADO
      // Producto por producto: cantidad x nombre (tipo) +
      // precio a la derecha, y debajo (si tiene) su detalle
      // de complementos en gris. Antes era un string plano
      // separado por comas sin precios ni complementos.
      // ============================================
      const productosBloque = productos.length
        ? productos.map(pr => {
            const cant = parseInt(pr.cantidad) || 1;
            const nombre = _esc(pr.nombre || 'Producto');
            // Datos sucios: cantidadTipo puede venir como número (ej: 1)
            const tipo = (typeof pr.cantidadTipo === 'string' && pr.cantidadTipo.trim() !== '')
              ? pr.cantidadTipo.trim()
              : 'UND';
            // Precio del producto: subtotal si viene; si no, precioUnitario*cantidad
            const precioProd = (pr.subtotal !== undefined && pr.subtotal !== null)
              ? parseFloat(pr.subtotal)
              : (parseFloat(pr.precioUnitario || pr.precio || 0) * cant);

            return `
            <div style="margin-bottom:6px;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                    <span style="font-weight:500; color:var(--dark);">${cant}x ${nombre} <small style="color:var(--gray); font-size:0.72rem;">(${_esc(tipo)})</small></span>
                    <span style="font-weight:600; color:var(--dark); white-space:nowrap;">${_fmt(precioProd)}</span>
                </div>
                ${_complementosHtml(pr.complementos)}
            </div>`;
          }).join('')
        : '<p style="color:var(--gray); margin:0;">Sin detalles</p>';

      const nombreDomi = pedido.domiciliarioNombre || pedido.nombreDomiciliario || null;

      bodyHtml = `
                <div class="pedido-detalles">
            <p><strong>Cliente:</strong> ${_esc(pedido.clienteNombre)}</p>
            <p><strong>Método Pago:</strong> ${_esc(pedido.metodoPago || 'Efectivo')}</p>
            ${nombreDomi
          ? `<p><strong><i class="fas fa-motorcycle" style="color:var(--secondary);margin-right:4px"></i>Domiciliario:</strong> ${_esc(nombreDomi)}</p>`
          : `<p style="color:var(--gray);"><i class="fas fa-motorcycle" style="margin-right:4px"></i>Domiciliario: Sin asignar</p>`
        }
        </div>
        <div class="pedido-productos">${productosBloque}</div>
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