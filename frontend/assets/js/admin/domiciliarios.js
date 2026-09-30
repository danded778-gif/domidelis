// ============================================
// domiciliarios.js — CRUD de domiciliarios
// ============================================

async function cargarDomiciliariosAdmin() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        domiciliariosCache = domiciliarios;

        const badge = document.getElementById('badge-domiciliarios');
        if (badge) {
            badge.textContent = domiciliarios.length;
            badge.style.display = domiciliarios.length > 0 ? 'inline-flex' : 'none';
        }

        const tbody = document.querySelector('#tablaDomiciliarios tbody');
        if (!tbody) return;

        renderTablaDomiciliarios(domiciliarios);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error cargando domiciliarios', 'error');
    }
}

function renderTablaDomiciliarios(domiciliarios) {
    const tbody = document.querySelector('#tablaDomiciliarios tbody');
    if (!tbody) return;
    const lista = domiciliarios || [];
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay domiciliarios registrados</td></tr>';
        return;
    }

    const conteoPedidos = {};
    if (window._infPedidos) {
        window._infPedidos.forEach(p => {
            if (p.domiciliarioId) {
                conteoPedidos[p.domiciliarioId] = (conteoPedidos[p.domiciliarioId] || 0) + 1;
            }
        });
    }

    tbody.innerHTML = lista.map(d => `
            <tr>
                <td>${d.id}</td>
                <td><strong>${esc(d.nombre)}</strong></td>
                <td>${badgePresencia('domiciliario', d.id)}</td>
                <td><i class="fas fa-phone" style="color:var(--accent);margin-right:4px;font-size:.8rem;"></i> ${esc(d.telefono || '—')}</td>
                <td>
                    <code style="background:var(--light);padding:2px 8px;border-radius:6px;font-size:.85rem;">${d.password ? '••••••' : '—'}</code>
                </td>
                <td style="text-align:center;">
                    <span style="background:var(--light);padding:4px 12px;border-radius:20px;font-weight:600;font-size:.85rem;">
                        ${conteoPedidos[d.id] || 0}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarDomiciliario(${d.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarDomiciliario(${d.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
}

function mostrarModalDomiciliario() {
    domiciliarioEditando = null;
    document.getElementById('modalDomiciliarioTitulo').innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Domiciliario';
    document.getElementById('formDomiciliario').reset();
    document.getElementById('domiPassword').type = 'password';
    document.getElementById('domi-eye-icon').className = 'fas fa-eye';
    document.getElementById('modalDomiciliario').classList.add('active');
}

function cerrarModalDomiciliario() {
    document.getElementById('modalDomiciliario').classList.remove('active');
    document.getElementById('formDomiciliario').reset();
    domiciliarioEditando = null;
}

function togglePasswordDomi() {
    const input = document.getElementById('domiPassword');
    const icon = document.getElementById('domi-eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

async function editarDomiciliario(id) {
    const domi = domiciliariosCache.find(d => d.id == id);
    if (!domi) return;

    domiciliarioEditando = id;
    document.getElementById('modalDomiciliarioTitulo').innerHTML = '<i class="fas fa-user-edit"></i> Editar Domiciliario';
    document.getElementById('domiNombre').value = domi.nombre;
    document.getElementById('domiTelefono').value = domi.telefono || '';
    document.getElementById('domiPassword').value = domi.password || '';
    document.getElementById('domiComisionApp').value = domi.comisionApp || 20;
    document.getElementById('domiPassword').type = 'text';
    document.getElementById('domi-eye-icon').className = 'fas fa-eye-slash';
    document.getElementById('modalDomiciliario').classList.add('active');
}

async function guardarDomiciliario() {
    const btn = document.querySelector('#formDomiciliario button[type="submit"]');
    const datos = {
        nombre: document.getElementById('domiNombre').value.trim(),
        telefono: document.getElementById('domiTelefono').value.trim(),
        password: document.getElementById('domiPassword').value.trim(),
        comisionApp: document.getElementById('domiComisionApp').value.trim()
    };

    if (!datos.nombre || !datos.password) {
        mostrarNotificacion('Nombre y contraseña son obligatorios', 'error');
        return;
    }
    if (datos.password.length < 4) {
        mostrarNotificacion('La contraseña debe tener al menos 4 caracteres', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const action = domiciliarioEditando ? 'actualizarDomiciliario' : 'crearDomiciliario';
        if (domiciliarioEditando) datos.id = domiciliarioEditando;

        const response = await fetchConToken(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, ...datos })
        });

        const data = await response.json();

        if (data.success) {
            mostrarNotificacion(domiciliarioEditando ? 'Domiciliario actualizado' : 'Domiciliario creado');
            cerrarModalDomiciliario();
            cargarDomiciliariosAdmin();
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

async function eliminarDomiciliario(id) {
    const domi = domiciliariosCache.find(d => d.id == id);
    if (!domi) return;

    if (!confirm(`¿Eliminar a "${esc(domi.nombre)}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarDomiciliario&id=${id}`);
        const data = await response.json();

        if (data.success) {
            mostrarNotificacion('Domiciliario eliminado');
            cargarDomiciliariosAdmin();
        } else {
            mostrarNotificacion('Error: ' + (data.error || 'No se pudo eliminar'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}