// ============================================
// historial.js — Historial de pedidos entregados
// filtros, selección masiva y CSV
// ============================================

async function cargarHistorialPedidos() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getPedidos`);
        const todos = await res.json();
        pedidosEntregadosCache = todos.filter(p => p.estado === 'entregado').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        llenarFiltroDomiciliarios();
        llenarFiltroTiendas();
        aplicarFiltrosHistorial();
    } catch (error) {
        console.error(error);
    }
}

function llenarFiltroTiendas() {
    const select = document.getElementById("filtroTiendaHistorial");
    if (!select) return;

    const tiendasEnHistorial = new Set();
    pedidosEntregadosCache.forEach(p => {
        obtenerTiendasPedido(p).forEach((nombre, id) => {
            tiendasEnHistorial.add(id);
        });
    });

    const opciones = tiendasCache
        .filter(t => tiendasEnHistorial.has(String(t.id)))
        .map(t => `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`)
        .join('');

    select.innerHTML = `<option value="">Todas las tiendas</option>${opciones}`;
}

function llenarFiltroDomiciliarios() {
    const select = document.getElementById("filtroDomiciliarioHistorial");
    if (!select) return;
    const opciones = domiciliariosCache.map(d => `<option value="${d.id}">${escapeQuotes(d.nombre)}</option>`).join('');
    select.innerHTML = `<option value="">Todos los domiciliarios</option><option value="sin-asignar">Sin asignar</option>${opciones}`;
}

function aplicarFiltrosHistorial() {
    const filtroTienda = document.getElementById("filtroTiendaHistorial")?.value || '';
    const filtroDomi = document.getElementById("filtroDomiciliarioHistorial")?.value || '';
    const texto = document.getElementById("buscarHistorial")?.value?.toLowerCase().trim() || '';

    let filtrados = [...pedidosEntregadosCache];

    if (filtroTienda) {
        filtrados = filtrados.filter(p => {
            const tiendas = obtenerTiendasPedido(p);
            return tiendas.has(filtroTienda);
        });
    }

    if (filtroDomi) {
        if (filtroDomi === 'sin-asignar') {
            filtrados = filtrados.filter(p => !p.domiciliarioId);
        } else {
            filtrados = filtrados.filter(p => p.domiciliarioId == filtroDomi);
        }
    }

    if (texto) {
        filtrados = filtrados.filter(p => {
            const tiendasTexto = obtenerTextoTiendas(p).toLowerCase();
            return (
                p.clienteNombre.toLowerCase().includes(texto) ||
                p.clienteTelefono.includes(texto) ||
                p.clienteDireccion.toLowerCase().includes(texto) ||
                p.id.toString().includes(texto) ||
                tiendasTexto.includes(texto)
            );
        });
    }

    renderizarHistorialPedidos(filtrados);
}

function renderizarHistorialPedidos(pedidosFiltrados = null) {
    const tbody = document.querySelector("#tablaHistorialPedidos tbody");
    const contador = document.getElementById("contadorHistorial");
    if (!tbody) return;
    const pedidos = pedidosFiltrados || pedidosEntregadosCache;
    if (contador) contador.textContent = `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`;
    if (pedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">No hay pedidos entregados</td></tr>`;
        return;
    }
    tbody.innerHTML = pedidos.map(p => {
        const domi = domiciliariosCache.find(d => d.id == p.domiciliarioId);
        const tiendasTexto = obtenerTextoTiendas(p);
        const seleccionado = pedidosSeleccionados.has(p.id);
        return `
            <tr data-pedido-id="${p.id}" class="${seleccionado ? 'fila-seleccionada' : ''}">
                <td><input type="checkbox" class="checkbox-pedido" data-id="${p.id}" ${seleccionado ? 'checked' : ''} onchange="toggleSeleccionPedido(${p.id}, this.checked)"></td>
                <td>#${p.id}</td>
                <td><strong>${p.clienteNombre}</strong><br><small>${p.clienteTelefono}</small></td>
                <td>${formatearPrecio(p.total)}</td>
                <td>${renderPropinaBadge(p)}</td>
                <td><span class="tienda-tag-historial"><i class="fas fa-store"></i> ${escapeQuotes(tiendasTexto)}</span></td>
                <td>${domi ? `<span class="domiciliario-tag"><i class="fas fa-user"></i> ${esc(domi.nombre)}</span>` : 'Sin asignar'}</td>
                <td>${formatearFecha(p.fecha)}</td>
                <td><span class="badge badge-entregado">Entregado</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarPedidoHistorial(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    actualizarCheckboxMaestro();
    actualizarBotonesAccionMasiva();
}

function toggleSeleccionPedido(pedidoId, seleccionado) {
    if (seleccionado) pedidosSeleccionados.add(pedidoId);
    else pedidosSeleccionados.delete(pedidoId);
    const fila = document.querySelector(`tr[data-pedido-id="${pedidoId}"]`);
    if (fila) fila.classList.toggle('fila-seleccionada', seleccionado);
    actualizarBotonesAccionMasiva();
    actualizarCheckboxMaestro();
}

function toggleSeleccionarTodos(master) {
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    checkboxes.forEach(cb => {
        const id = parseInt(cb.dataset.id);
        cb.checked = master.checked;
        if (master.checked) pedidosSeleccionados.add(id);
        else pedidosSeleccionados.delete(id);
        const fila = cb.closest('tr');
        if (fila) fila.classList.toggle('fila-seleccionada', master.checked);
    });
    actualizarBotonesAccionMasiva();
}

function actualizarCheckboxMaestro() {
    const master = document.getElementById('checkboxTodos');
    if (!master) return;
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    const total = checkboxes.length;
    const selecionados = Array.from(checkboxes).filter(cb => cb.checked).length;
    master.checked = total > 0 && selecionados === total;
    master.indeterminate = selecionados > 0 && selecionados < total;
}

function actualizarBotonesAccionMasiva() {
    const btnEliminar = document.getElementById('btnEliminarSeleccionados');
    const contador = document.getElementById('contadorSeleccionados');
    const cantidad = pedidosSeleccionados.size;
    if (btnEliminar) btnEliminar.style.display = cantidad > 0 ? 'inline-flex' : 'none';
    if (contador) contador.textContent = cantidad > 0 ? `${cantidad} seleccionado${cantidad !== 1 ? 's' : ''}` : '';
}

async function eliminarPedidoHistorial(pedidoId) {
    if (!confirm(`¿Eliminar pedido #${pedidoId}?`)) return;
    await ejecutarEliminacionPedidos([pedidoId]);
}

async function eliminarPedidosSeleccionados() {
    const cantidad = pedidosSeleccionados.size;
    if (cantidad === 0) return;
    if (!confirm(`¿Eliminar ${cantidad} pedido${cantidad !== 1 ? 's' : ''}?`)) return;
    await ejecutarEliminacionPedidos(Array.from(pedidosSeleccionados));
}

async function ejecutarEliminacionPedidos(ids) {
    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarPedidos`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ids: JSON.stringify(ids) })
        });
        const data = await response.json();
        if (data.success) {
            pedidosEntregadosCache = pedidosEntregadosCache.filter(p => !ids.includes(p.id));
            ids.forEach(id => pedidosSeleccionados.delete(id));
            llenarFiltroTiendas();
            aplicarFiltrosHistorial();
            mostrarNotificacion(`${data.eliminados} pedido${data.eliminados !== 1 ? 's' : ''} eliminado${data.eliminados !== 1 ? 's' : ''}`, "success");
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

function exportarHistorialCSV() {
    const filas = document.querySelectorAll('#tablaHistorialPedidos tbody tr[data-pedido-id]');
    if (filas.length === 0) {
        mostrarNotificacion("No hay pedidos para exportar", "error");
        return;
    }
    let csv = 'ID,Cliente,Teléfono,Dirección,Total,Tienda,Domiciliario,Fecha,Estado\n';
    filas.forEach(fila => {
        const id = fila.dataset.pedidoId;
        const pedido = pedidosEntregadosCache.find(p => p.id == id);
        if (!pedido) return;
        const domi = domiciliariosCache.find(d => d.id == pedido.domiciliarioId);
        const tiendaTexto = obtenerTextoTiendas(pedido);
        csv += [
            pedido.id,
            `"${pedido.clienteNombre.replace(/"/g, '""')}"`,
            pedido.clienteTelefono,
            `"${pedido.clienteDireccion.replace(/"/g, '""')}"`,
            pedido.total,
            `"${tiendaTexto.replace(/"/g, '""')}"`,
            domi ? `"${domi.nombre.replace(/"/g, '""')}"` : 'Sin asignar',
            pedido.fecha,
            pedido.estado
        ].join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    mostrarNotificacion("Exportado a CSV", "success");
}