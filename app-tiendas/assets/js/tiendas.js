// ============================================
// LÓGICA PRINCIPAL - PWA TIENDA (COMPLETO)
// ============================================

// --- UTILIDADES ---
function formatearPesosTienda(n) {
    return '$' + Math.round(n).toLocaleString('es-CO');
}

function getMiComision() {
    const sesion = obtenerSesionTienda();
    return sesion.info && sesion.info.comision ? parseFloat(sesion.info.comision) : 20;
}

// --- TABS ---
function cambiarTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tab).classList.add('active');
    event.currentTarget.classList.add('active');

    // Cargar datos dinámicos al cambiar de tab
    if(tab === 'productos') cargarProductos();
    if(tab === 'pedidos') cargarPedidos();
    if(tab === 'comision') cargarDatosComision();
    if(tab === 'configuracion') cargarConfiguracion();
}

// ============================================
// LÓGICA PARA LA PESTAÑA DE PRODUCTOS
// ============================================
async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL}/productos`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Error cargando productos');
        const productos = await res.json();
        
        const grid = document.getElementById('lista-productos');
        if (!grid) return;

        if (productos.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:var(--gray); grid-column:1/-1; padding:2rem;">No tienes productos registrados.</p>';
            return;
        }

        grid.innerHTML = productos.map(p => `
            <div class="product-admin-card">
                <div class="product-admin-img" style="background-image: url('${escapeQuotes(p.imagen_url || '')}');">
                    ${!p.imagen_url ? '<i class="fas fa-box-open default-icon"></i>' : ''}
                </div>
                <div class="product-admin-info">
                    <h4>${escapeQuotes(p.nombre)}</h4>
                    ${p.badge ? `<span class="product-admin-badge">${escapeQuotes(p.badge)}</span>` : ''}
                    <p class="product-admin-price">${formatearPrecio(p.precio)}</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error cargando productos:', err);
    }
}

// ============================================
// LÓGICA PARA LA PESTAÑA DE PEDIDOS
// ============================================
async function cargarPedidos() {
    try {
        const res = await fetch(`${API_URL}/pedidos`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Error cargando pedidos');
        const pedidos = await res.json();
        
        const grid = document.getElementById('lista-pedidos');
        if (!grid) return;

        if (pedidos.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:var(--gray); padding:2rem;">No tienes pedidos aún.</p>';
            return;
        }

        grid.innerHTML = pedidos.map(p => {
            let estadoClass = p.estado === 'pendiente' ? 'pendiente' : p.estado === 'en-camino' ? 'en-camino' : 'entregado';
            let productosHtml = '';
            try {
                const prods = JSON.parse(p.productosJson);
                productosHtml = prods.map(pr => `${pr.cantidad || 1}x ${pr.nombre || 'Producto'}`).join(', ');
            } catch(e) { productosHtml = 'Sin detalles'; }

            return `
                <div class="pedido-card-tienda ${estadoClass}">
                    <div class="pedido-header">
                        <span class="pedido-id">#${p.id}</span>
                        <span class="estado-badge estado-${estadoClass}">${p.estado.toUpperCase()}</span>
                    </div>
                    <div class="pedido-detalles">
                        <p><strong>Cliente:</strong> ${escapeQuotes(p.clienteNombre)}</p>
                        <p><strong>Método Pago:</strong> ${p.metodoPago || 'Efectivo'}</p>
                    </div>
                    <div class="pedido-productos">${productosHtml}</div>
                    <div style="text-align:right; margin-top:10px; font-weight:bold; font-size:1.1rem; color:var(--primary);">
                        Total: ${formatearPrecio(p.total)}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error cargando pedidos:', err);
    }
}

// ============================================
// LÓGICA PARA LA PESTAÑA DE COMISIONES
// ============================================
async function cargarDatosComision() {
    const comisionPct = getMiComision();
    
    const pctText = document.getElementById('comision-pct-text');
    if (pctText) pctText.innerText = comisionPct;

    try {
        const res = await fetch(`${API_URL}/pedidos`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Error cargando pedidos');
        const todosPedidos = await res.json();
        
        const pedidosEntregados = todosPedidos.filter(p => p.estado === 'entregado');

        let totalVentas = 0;
        let totalComision = 0;
        let totalNeto = 0;
        let filasHTML = '';

        pedidosEntregados.forEach(pedido => {
            const subtotalPedido = parseFloat(pedido.total) || 0; 
            const comisionPedido = subtotalPedido * (comisionPct / 100);
            const netoPedido = subtotalPedido - comisionPedido;

            totalVentas += subtotalPedido;
            totalComision += comisionPedido;
            totalNeto += netoPedido;

            const fechaFormateada = new Date(pedido.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
            filasHTML += `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <td style="padding: 10px; text-align: center;">${pedido.id}</td>
                    <td style="padding: 10px; text-align: center;">${fechaFormateada}</td>
                    <td style="padding: 10px; text-align: center;">${pedido.metodoPago || 'N/A'}</td>
                    <td style="padding: 10px; text-align: right;">${formatearPesosTienda(subtotalPedido)}</td>
                    <td style="padding: 10px; text-align: right; color: #F4A261;">- ${formatearPesosTienda(comisionPedido)}</td>
                    <td style="padding: 10px; text-align: right; color: #2A9D8F; font-weight: bold;">${formatearPesosTienda(netoPedido)}</td>
                </tr>
            `;
        });

        const elVentas = document.getElementById('comision-ventas-total');
        const elDescontada = document.getElementById('comision-descontada');
        const elNeta = document.getElementById('comision-ganancia-neta');
        
        if(elVentas) elVentas.innerText = formatearPesosTienda(totalVentas);
        if(elDescontada) elDescontada.innerText = `- ${formatearPesosTienda(totalComision)}`;
        if(elNeta) elNeta.innerText = formatearPesosTienda(totalNeto);

        const tbody = document.getElementById('tbody-comisiones');
        if (tbody) {
            if (totalVentas === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Aún no tienes pedidos entregados.</td></tr>`;
            } else {
                filasHTML += `
                    <tr style="background: #5D4037; color: white; font-weight: bold; border-top: 2px solid #E63946;">
                        <td colspan="3" style="padding: 12px; text-align: right;">TOTALES:</td>
                        <td style="padding: 12px; text-align: right;">${formatearPesosTienda(totalVentas)}</td>
                        <td style="padding: 12px; text-align: right;">- ${formatearPesosTienda(totalComision)}</td>
                        <td style="padding: 12px; text-align: right;">${formatearPesosTienda(totalNeto)}</td>
                    </tr>
                `;
                tbody.innerHTML = filasHTML;
            }
        }
    } catch (error) {
        console.error('Error cargando comisiones:', error);
    }
}

// ============================================
// LÓGICA PARA LA PESTAÑA DE CONFIGURACIÓN
// ============================================
async function cargarConfiguracion() {
    try {
        const sesion = obtenerSesionTienda();
        const info = sesion.info;
        
        // Seguridad: verificar si los elementos existen antes de usarlos
        const elNombre = document.getElementById('conf-nombre');
        const elComision = document.getElementById('conf-comision');
        const elDescripcion = document.getElementById('conf-descripcion');
        const elDireccion = document.getElementById('conf-direccion');

        if (info) {
            if(elNombre) elNombre.textContent = info.nombre || 'Sin nombre';
            if(elComision) elComision.textContent = (info.comision || 20) + '%';
            if(elDescripcion) elDescripcion.value = info.descripcion || '';
            if(elDireccion) elDireccion.value = info.direccion || '';
        } else {
            if(elNombre) elNombre.textContent = 'Error al cargar';
        }
    } catch (e) {
        console.error('Error cargando configuración:', e);
    }
}

async function guardarDatosTienda(event) {
    event.preventDefault();
    const sesion = obtenerSesionTienda();
    const elDireccion = document.getElementById('conf-direccion');
    const elDescripcion = document.getElementById('conf-descripcion');
    
    const direccion = elDireccion ? elDireccion.value : '';
    const descripcion = elDescripcion ? elDescripcion.value : '';

    try {
        const res = await fetch(`${API_URL}/perfil`, { 
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ descripcion, direccion })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ Datos actualizados correctamente');
            sesion.info.direccion = direccion;
            sesion.info.descripcion = descripcion;
            guardarSesionTienda(sesion.token, sesion.info);
        } else {
            alert('❌ Error: ' + (data.error || 'No se pudo actualizar'));
        }
    } catch (e) {
        alert('❌ Error de conexión');
    }
}

async function cambiarPasswordTienda(event) {
    event.preventDefault();
    const actual = document.getElementById('conf-pass-actual').value;
    const nueva = document.getElementById('conf-pass-nueva').value;
    const confirmar = document.getElementById('conf-pass-confirmar').value;

    if (nueva !== confirmar) return alert('❌ Las contraseñas nuevas no coinciden.');
    if (nueva.length < 4) return alert('❌ La contraseña debe tener al menos 4 caracteres.');

    try {
        const res = await fetch(`${API_URL}/cambiar-password`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ Contraseña actualizada correctamente');
            document.getElementById('form-password-tienda').reset();
        } else {
            alert('❌ Error: ' + (data.error || 'No se pudo actualizar'));
        }
    } catch (e) {
        alert('❌ Error de conexión');
    }
}

// ============================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Cargar la información de la tienda en el título
    const sesion = obtenerSesionTienda();
    const titulo = document.getElementById('titulo-tienda');
    if (titulo && sesion.info && sesion.info.nombre) {
        titulo.innerHTML = `<i class="fas fa-store"></i> ${sesion.info.nombre}`;
    }

    // Cargar los productos por defecto (La pestaña activa)
    cargarProductos();
});