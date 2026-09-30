// ============================================
// complementos.js — Modal de salsas / extras
// ============================================

async function abrirModalComplementos(productoId) {
    const producto = productosCache.find(p => p.id == productoId);
    if (!producto) return;

    document.getElementById('complementoProductoId').value = productoId;
    document.getElementById('complementoProductoNombre').textContent = producto.nombre;
    document.getElementById('formComplemento').reset();

    document.getElementById('modalComplementos').classList.add('active');
    await cargarComplementos(productoId);
}

function cerrarModalComplementos() {
    document.getElementById('modalComplementos').classList.remove('active');
}

async function cargarComplementos(productoId) {
    const container = document.getElementById('listaComplementosContainer');
    container.innerHTML = '<p style="text-align:center; color:#999;">Cargando...</p>';

    try {
        const res = await fetchConToken(`${API_URL}?action=getComplementos&productoId=${productoId}`);
        const data = await res.json();

        if (data.success && data.complementos) {
            complementosCache = data.complementos;
            if (data.complementos.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#999;">Este producto no tiene complementos aún.</p>';
                return;
            }

            container.innerHTML = data.complementos.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid #eee; border-radius:8px; margin-bottom:8px;">
                    <div>
                        <strong>${esc(c.nombre)}</strong> <small>(${esc(c.grupo || c.tipo)})</small><br>
                        <small>Precio: ${formatearPrecio(c.precio)} | ${c.min > 0 ? 'Obligatorio' : 'Opcional'} | Max: ${c.max || '∞'}</small>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="eliminarComplemento(${c.id})"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align:center; color:#999;">No hay complementos.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p style="text-align:center; color:red;">Error al cargar.</p>';
    }
}

async function guardarComplemento() {
    const btn = document.querySelector("#formComplemento button[type='submit']");
    const productoId = document.getElementById('complementoProductoId').value;

    const datos = {
        action: 'crearComplemento',
        id_producto: productoId,
        grupo: document.getElementById('complementoGrupo').value.trim(),
        tipo: document.getElementById('complementoTipo').value,
        nombre: document.getElementById('complementoNombre').value.trim(),
        precio: document.getElementById('complementoPrecio').value || 0,
        min: document.getElementById('complementoObligatorio').value,
        max: document.getElementById('complementoMaximo').value
    };

    if (!datos.nombre) {
        mostrarNotificacion('El nombre es obligatorio', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const response = await fetchConToken(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(datos)
        });
        const data = await response.json();

        if (data.success) {
            mostrarNotificacion('Complemento agregado');
            document.getElementById('formComplemento').reset();
            await cargarComplementos(productoId);
        } else {
            mostrarNotificacion('Error: ' + (data.error || 'No se pudo guardar'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Agregar Complemento';
    }
}

async function eliminarComplemento(id) {
    if (!confirm('¿Eliminar este complemento?')) return;
    const productoId = document.getElementById('complementoProductoId').value;

    try {
        // Al estar en el bloque doPost del servidor, se envía por POST
        const response = await fetchConToken(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: 'eliminarComplemento',
                id: id
            })
        });
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion('Complemento eliminado');
            await cargarComplementos(productoId);
        } else {
            mostrarNotificacion('Error al eliminar: ' + (data.error || 'No se pudo completar'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}