/**
 * ============================================================================
 * estados-pedido.js — Componente UI reutilizable para badges y botones
 * ============================================================================
 * Centraliza icono + label + clase CSS para cada estado del pedido.
 * Compartido por TODOS los paneles (tienda, admin, domiciliario, etc).
 *
 * COLORES — viven en el CSS, no aquí:
 *   pendiente    .estado-pendiente   amarillo #ffc107 (ya existe)
 *   aceptado     .estado-aceptado    ámbar    #f59e0b  (NUEVO)
 *   listo        .estado-listo       naranja  #F4A261  (NUEVO, = --secondary)
 *   en-camino    .estado-en-camino   cyan     #17a2b8 (ya existe)
 *   entregado    .estado-entregado   verde    #28a745 (ya existe)
 *   cancelado    .estado-cancelado   rojo     #dc3545 (ya existe)
 * ============================================================================
 */
(function (global) {
  'use strict';

  const ESTADOS_PEDIDO = {
    pendiente:   { icon: 'fa-clock',         label: 'Pendiente'  },
    aceptado:    { icon: 'fa-check',         label: 'Aceptado'   },
    listo:       { icon: 'fa-bag-shopping',  label: 'Listo'      },
    'en-camino': { icon: 'fa-motorcycle',    label: 'En camino'  },
    entregado:   { icon: 'fa-circle-check',  label: 'Entregado'  },
    cancelado:   { icon: 'fa-circle-xmark',  label: 'Cancelado'  }
  };

  // El GAS escribe "en camino" (espacio); pedido-card.js lo normaliza
  // a "en-camino" (guion). Aceptamos ambas formas.
  const ALIASES = { 'en camino': 'en-camino' };

  function _normalizarEstado(estado) {
    if (!estado) return '';
    let e = String(estado).toLowerCase().trim();
    if (ALIASES[e]) e = ALIASES[e];
    return e;
  }

  function _escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Devuelve {icon, label, clase} para un estado.
   * Si el estado no está mapeado, fallback con icono de pregunta.
   */
  function getEstadoConfig(estado) {
    const e = _normalizarEstado(estado);
    const cfg = ESTADOS_PEDIDO[e] || { icon: 'fa-circle-question', label: estado || '?' };
    return { icon: cfg.icon, label: cfg.label, clase: 'estado-' + (e || 'otro') };
  }

  /**
   * Devuelve HTML del badge con icono + texto + clase CSS existente.
   * opciones.mayusculas: true → texto en MAYÚSCULAS (modo 'tienda' usa esto)
   */
  function renderBadgeEstado(estado, opciones) {
    const opts = opciones || {};
    const cfg = getEstadoConfig(estado);
    const texto = opts.mayusculas ? cfg.label.toUpperCase() : cfg.label;
    return `<span class="estado-badge ${cfg.clase}"><i class="fas ${cfg.icon}"></i> ${_escHtml(texto)}</span>`;
  }

  /**
   * Devuelve HTML del bloque de botones para el modo 'tienda':
   *   pendiente → [Aceptar]   (cambia a 'aceptado')
   *   aceptado  → [Listo]     (cambia a 'listo')
   *   otros     → ''          (sin botones)
   *
   * Solo renderiza si existe la función global cambiarEstadoPedido()
   * (definida en tiendas.js). Si no existe, devuelve '' (no rompe).
   */
  function renderAccionesTienda(estado, pedidoId) {
    const e = _normalizarEstado(estado);
    if (typeof global.cambiarEstadoPedido !== 'function') return '';
    if (pedidoId === undefined || pedidoId === null) return '';

    if (e === 'pendiente') {
      return `<div class="estado-botones">
        <button class="btn btn-success btn-sm" onclick="cambiarEstadoPedido(${pedidoId}, 'aceptado')">
          <i class="fas fa-check"></i> Aceptar
        </button>
      </div>`;
    }
    if (e === 'aceptado') {
      return `<div class="estado-botones">
        <button class="btn btn-success btn-sm" onclick="cambiarEstadoPedido(${pedidoId}, 'listo')">
          <i class="fas fa-bag-shopping"></i> Listo
        </button>
      </div>`;
    }
    return '';
  }

  // Exportar al global (mismo patrón que toast.js)
  global.ESTADOS_PEDIDO = ESTADOS_PEDIDO;
  global.getEstadoConfig = getEstadoConfig;
  global.renderBadgeEstado = renderBadgeEstado;
  global.renderAccionesTienda = renderAccionesTienda;

})(typeof window !== 'undefined' ? window : this);