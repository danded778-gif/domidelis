// ============================================
// usuarios-tienda.js — CRUD de usuarios de tienda
// ============================================

async function cargarUsuariosTiendaAdmin() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getUsuariosTienda`);
        const usuarios = await res.json();
        usuariosTiendaCache = usuarios;

        const tbody = document.querySelector('#tablaUsuariosTienda tbody');
        if (!tbody) return;

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay usuarios de tienda registrados</td></tr>';
            return;
        }

        tbody.innerHTML = usuarios.map(u => {
            const tienda = tiendasCache.find(t => t.id == u.id);
            const nombreTienda = tienda ? tienda.nombre : 'Tienda eliminada';
            return `
                <tr>
                    <td>${u.id}</td>
                    <td><strong>${escapeQuotes(nombreTienda)}</strong></td>
                    <td>${escapeQuotes(u.nombre)}</td>
                    <td><code style="background:var(--light);padding:2px 8px;border-radius:6px;font-size:.85rem;">${u.password ? '••••••' : '—'}</code></td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="editarUsuarioTienda(${u.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarUsuarioTienda(${u.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error cargando usuarios tienda', 'error');
    }
}

function mostrarModalUsuarioTienda() {
    if (tiendasCache.length === 0) {
        mostrarNotificacion("Crea al menos una tienda primero", "error");
        return;
    }
    usuarioTiendaEditando = null;
    document.getElementById('modalUsuarioTiendaTitulo').innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Usuario Tienda';
    document.getElementById('formUsuarioTienda').reset();

    const select = document.getElementById('usuarioTiendaId');
    select.innerHTML = '<option value="">-- Selecciona una tienda --</option>' +
        tiendasCache.map(t => `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`).join('');
    select.disabled = false;

    document.getElementById('modalUsuarioTienda').classList.add('active');
}

function cerrarModalUsuarioTienda() {
    document.getElementById('modalUsuarioTienda').classList.remove('active');
    document.getElementById('formUsuarioTienda').reset();
    usuarioTiendaEditando = null;
}

async function editarUsuarioTienda(id) {
    const usuario = usuariosTiendaCache.find(u => u.id == id);
    if (!usuario) return;

    usuarioTiendaEditando = id;
    document.getElementById('modalUsuarioTiendaTitulo').innerHTML = '<i class="fas fa-user-edit"></i> Editar Usuario Tienda';

    const select = document.getElementById('usuarioTiendaId');
    const tienda = tiendasCache.find(t => t.id == usuario.id);
    const nombreTienda = tienda ? tienda.nombre : 'Tienda eliminada';
    select.innerHTML = `<option value="${usuario.id}" selected>${escapeQuotes(nombreTienda)}</option>`;
    select.disabled = true;

    document.getElementById('usuarioTiendaNombre').value = usuario.nombre;
    document.getElementById('usuarioTiendaPassword').value = usuario.password;
    document.getElementById('modalUsuarioTienda').classList.add('active');
}

async function guardarUsuarioTienda() {
    const btn = document.querySelector('#formUsuarioTienda button[type="submit"]');
    const datos = {
        tiendaId: document.getElementById('usuarioTiendaId').value,
        nombre: document.getElementById('usuarioTiendaNombre').value.trim(),
        password: document.getElementById('usuarioTiendaPassword').value.trim()
    };

    if (!datos.tiendaId || !datos.nombre || !datos.password) {
        mostrarNotificacion('Todos los campos son obligatorios', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const action = usuarioTiendaEditando ? 'actualizarUsuarioTienda' : 'crearUsuarioTienda';
        if (usuarioTiendaEditando) datos.id = usuarioTiendaEditando;

        const response = await fetchConToken(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, ...datos })
        });

        const data = await response.json();

        if (data.success) {
            mostrarNotificacion(usuarioTiendaEditando ? 'Usuario actualizado' : 'Usuario creado con éxito');
            cerrarModalUsuarioTienda();
            cargarUsuariosTiendaAdmin();
        } else {
            mostrarNotificacion('Error: ' + (data.error || 'No se pudo guardar'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

async function eliminarUsuarioTienda(id) {
    if (!confirm(`¿Eliminar el usuario de esta tienda? La tienda seguirá existiendo pero ya no podrá iniciar sesión.`)) return;
    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarUsuarioTienda&id=${id}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion('Usuario eliminado');
            cargarUsuariosTiendaAdmin();
        } else {
            mostrarNotificacion('Error: ' + (data.error || 'No se pudo eliminar'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}