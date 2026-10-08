// ============================================
// pedidos.js — Pedidos activos, asignación y detalle
// ============================================

// Carga simple de domiciliarios (para el cache usado en asignación)
async function cargarDomiciliarios() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        domiciliariosCache = domiciliarios;
    } catch (error) {
        console.error(error);
    }
}

// ============================================
// PEDIDOS ACTIVOS
// ============================================
async function cargarPedidosAdmin() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const tbody = document.querySelector("#tablaPedidos tbody");
        if (!tbody) return;
        const activos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');

        const badge = document.getElementById('badge-pedidos-activos');
        if (badge) {
            badge.textContent = activos.length;
            badge.style.display = activos.length > 0 ? 'inline-flex' : 'none';
        }

        if (activos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='9' class='text-center'>No hay pedidos activos</td></tr>";
            return;
        }
        tbody.innerHTML = activos.map(p => {
            const domi = domiciliariosCache.find(d => d.id == p.domiciliarioId);
            const tiendasTexto = obtenerTextoTiendas(p);
            return `
                <tr>
                    <td>#${p.id}</td>
                    <td><strong>${p.clienteNombre}</strong><br><small><i class="fas fa-phone"></i> ${p.clienteTelefono}</small></td>
                    <td><span class="tienda-tag-historial"><i class="fas fa-store"></i> ${escapeQuotes(tiendasTexto)}</span></td>
                    <td>${formatearPrecio(p.total)}</td>
                    <td>${renderPropinaBadge(p)}</td>
                    <td><span class="badge badge-${p.estado.replace(/\s/g, '-')}">${p.estado}</span></td>
                    <td>${domi ? `<i class="fas fa-user"></i> ${esc(domi.nombre)} ${badgePresencia('domiciliario', domi.id)}` : "— Sin asignar —"}</td>
                    <td>${formatearFecha(p.fecha)}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-primary btn-sm" onclick="asignarDomiciliario(${p.id})"><i class="fas fa-user-plus"></i></button>
                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedidoAdmin(${p.id})"><i class="fas fa-exchange-alt"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error cargando pedidos", "error");
    }
}

// ============================================
// ASIGNACIÓN DE DOMICILIARIOS
// ============================================
function asignarDomiciliario(pedidoId) {
    if (domiciliariosCache.length === 0) {
        mostrarNotificacion("No hay domiciliarios", "error");
        return;
    }
    pedidoIdAsignar = pedidoId;
    document.getElementById("asignarPedidoId").textContent = pedidoId;
    document.getElementById("buscarDomiciliario").value = "";
    renderizarDomiciliarios(domiciliariosCache);
    document.getElementById("modalAsignarDomiciliario").classList.add("active");
}

function cerrarModalAsignarDomiciliario() {
    document.getElementById("modalAsignarDomiciliario").classList.remove("active");
    pedidoIdAsignar = null;
}

function renderizarDomiciliarios(domiciliarios) {
    const contenedor = document.getElementById("listaDomiciliarios");
    const sinResultados = document.getElementById("sinResultados");
    if (!contenedor) return;
    if (domiciliarios.length === 0) {
        contenedor.innerHTML = "";
        if (sinResultados) sinResultados.style.display = "block";
        return;
    }
    if (sinResultados) sinResultados.style.display = "none";
    const orden = { online: 0, away: 1, offline: 2 };
    const ordenados = [...domiciliarios].sort((a, b) =>
        (orden[estadoPresencia('domiciliario', a.id)] ?? 2) - (orden[estadoPresencia('domiciliario', b.id)] ?? 2)
    );
    contenedor.innerHTML = ordenados.map(d => {
        const estado = estadoPresencia('domiciliario', d.id);
        return `
        <div class="domiciliario-item ${estado === 'offline' ? 'is-offline' : ''}" onclick="confirmarAsignacion(${d.id}, '${escapeQuotes(d.nombre)}')"
             style="display: flex; align-items: center; padding: 16px; margin-bottom: 12px; background: #fff; border: 2px solid #e0e0e0; border-radius: 16px; cursor: pointer;">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--dark), var(--accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.3rem; margin-right: 16px; position: relative;">
                ${esc(String(d.nombre || '?').charAt(0).toUpperCase())}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${esc(d.nombre)}
                    ${badgePresencia('domiciliario', d.id)}
                </div>
                <div style="font-size: 0.85rem; color: var(--gray);"><i class="fas fa-phone"></i> ${esc(d.telefono || 'Sin teléfono')} | ID: ${d.id}</div>
            </div>
            <div style="color: var(--primary);"><i class="fas fa-chevron-right"></i></div>
        </div>`;
    }).join('');
}

function filtrarDomiciliarios() {
    const busqueda = document.getElementById("buscarDomiciliario").value.toLowerCase().trim();
    const filtrados = domiciliariosCache.filter(d =>
        d.nombre.toLowerCase().includes(busqueda) ||
        d.id.toString().includes(busqueda) ||
        (d.telefono && d.telefono.includes(busqueda))
    );
    renderizarDomiciliarios(filtrados);
}

async function confirmarAsignacion(domiciliarioId, domiciliarioNombre) {
    if (!pedidoIdAsignar) return;
    if (!confirm(`¿Asignar pedido #${pedidoIdAsignar} a ${domiciliarioNombre}?`)) return;
    try {
        const response = await fetchConToken(`${API_URL}?action=asignarDomiciliario&pedidoId=${pedidoIdAsignar}&domiciliarioId=${domiciliarioId}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(`✅ Pedido #${pedidoIdAsignar} asignado a ${domiciliarioNombre}`);
            cerrarModalAsignarDomiciliario();
            await cargarPedidosAdmin();
        } else {
            mostrarNotificacion("Error al asignar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

async function cambiarEstadoPedidoAdmin(pedidoId) {
    const estados = ["pendiente", "en camino", "entregado", "cancelado"];
    const nuevoEstado = prompt(`Nuevo estado (${estados.join(', ')}):`);
    if (!nuevoEstado || !estados.includes(nuevoEstado)) {
        mostrarNotificacion("Estado no válido", "error");
        return;
    }
    try {
        const response = await fetchConToken(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion("Estado actualizado");
            if (nuevoEstado === 'entregado') await cargarHistorialPedidos();
            await cargarPedidosAdmin();
        } else {
            mostrarNotificacion("Error al actualizar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

async function verDetallePedido(pedidoId) {
    try {
        const res = await fetchConToken(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const pedido = pedidos.find(p => p.id == pedidoId);
        if (!pedido) return;
        let productos = [];
        try { productos = JSON.parse(pedido.productosJson); } catch (e) { }
        const tiendasTexto = obtenerTextoTiendas(pedido);
        const contenido = document.getElementById("detallePedidoContenido");
        contenido.innerHTML = `
            <div class="detalle-pedido">
                <p><strong>Cliente:</strong> ${pedido.clienteNombre}</p>
                <p><strong>Dirección:</strong> ${pedido.clienteDireccion}</p>
                <p><strong>Teléfono:</strong> ${pedido.clienteTelefono}</p>
                <p><strong>Tienda:</strong> <span class="tienda-tag-detalle"><i class="fas fa-store"></i> ${tiendasTexto}</span></p>
                <p><strong>Pago:</strong> ${esc(pedido.metodoPago || '—')}</p>
                ${pedido.referencias ? `<p><strong>Referencias:</strong> ${esc(pedido.referencias)}</p>` : ''}
                <p><strong>Propina:</strong> ${renderPropinaBadge(pedido)}</p>
                <p><strong>Fecha:</strong> ${formatearFecha(pedido.fecha)}</p>
                <p><strong>Estado:</strong> <span class="badge badge-${pedido.estado.replace(/\s/g, '-')}">${pedido.estado}</span></p>
                <h4>Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `
                        <div class="producto-item" style="flex-direction:column; align-items:stretch; gap:4px;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>${prod.cantidad}x ${esc(prod.nombre)} (${prod.cantidadTipo || 'UND'})</span>
                                <span>${formatearPrecio(prod.subtotal)}</span>
                            </div>
                            ${formatearComplementosDetalle(prod.complementos)}
                        </div>
                    `).join('')}
                </div>
                <div class="total-pedido"><strong>Total: ${formatearPrecio(pedido.total)}</strong></div>
            </div>
        `;
        document.getElementById("modalPedido").classList.add("active");
    } catch (error) {
        mostrarNotificacion("Error al cargar detalle", "error");
    }
}

function cerrarModalPedido() {
    document.getElementById("modalPedido").classList.remove("active");
}

// ============================================
// HELPERS DE TIENDAS EN PEDIDOS (usados también por historial)
// ============================================
function obtenerTiendasPedido(pedido) {
    let productos = [];
    try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { productos = []; }

    const tiendasMap = new Map();

    productos.forEach(p => {
        if (p.tiendaId) {
            const id = String(p.tiendaId);
            const nombre = p.tiendaNombre || tiendasCache.find(t => t.id == p.tiendaId)?.nombre || `Tienda #${p.tiendaId}`;
            tiendasMap.set(id, nombre);
        }
    });

    if (pedido.tiendaId) {
        const id = String(pedido.tiendaId);
        const nombre = pedido.tiendaNombre || tiendasCache.find(t => t.id == pedido.tiendaId)?.nombre || `Tienda #${pedido.tiendaId}`;
        tiendasMap.set(id, nombre);
    }

    return tiendasMap;
}

function obtenerTextoTiendas(pedido) {
    const tiendas = obtenerTiendasPedido(pedido);
    if (tiendas.size === 0) return '—';
    return Array.from(tiendas.values()).join(', ');
}

// ============================================
// HELPER: COMPLEMENTOS EN DETALLE DE PEDIDO
// El texto llega como: "✦ Grupo: A, B | ✦ Grupo2: C"
// (así lo arma getExtrasTexto del checkout). Se parte por "|"
// y se pinta cada línea debajo del producto.
// ============================================
function formatearComplementosDetalle(textoComplementos) {
    if (!textoComplementos || String(textoComplementos).trim() === '') return '';

    const lineas = String(textoComplementos)
        .split('|')
        .map(l => l.trim())
        .filter(l => l !== '');

    if (lineas.length === 0) return '';

    return `
        <div style="font-size:0.8rem; color:var(--gray); padding:4px 10px; border-left:2px solid var(--accent); margin:2px 0 4px 0; line-height:1.5;">
            ${lineas.map(l => `<div>✔ ${esc(l)}</div>`).join('')}
        </div>
    `;
}