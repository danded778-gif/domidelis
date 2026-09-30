// ============================================
// tiendas.js — CRUD de tiendas + promovida
// ============================================

async function cargarTiendasAdmin() {
    try {
        const res = await fetchConToken(`${API_URL}?action=getTiendas`);
        const tiendas = await res.json();
        tiendasCache = tiendas;
        const tbody = document.querySelector("#tablaTiendas tbody");
        if (!tbody) return;
        if (tiendas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No hay tiendas</td></tr>";
            return;
        }
        tbody.innerHTML = tiendas.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><img src="${t.imagen || 'https://via.placeholder.com/50'}" class="store-img-thumb" alt="${escapeQuotes(t.nombre)}"></td>
                <td><strong>${esc(t.nombre)}</strong><br><small>${t.descripcion || ''}</small></td>
                <td>${esc(t.direccion)}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verProductosTienda(${t.id})"><i class="fas fa-box"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="editarTienda(${t.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarTienda(${t.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        llenarSelectsTiendas(tiendas);
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error cargando tiendas", "error");
    }
}

function llenarSelectsTiendas(tiendas) {
    const selectVer = document.getElementById("selectTiendaProductos");
    const selectProducto = document.getElementById("productoTiendaId");
    const opciones = tiendas.map(t => `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`).join('');
    if (selectVer) selectVer.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
    if (selectProducto) {
        selectProducto.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
        selectProducto.setAttribute('onchange', 'calcularComisionProducto()');
    }
}

function mostrarModalTienda() {
    tiendaEditando = null;
    document.getElementById("modalTiendaTitulo").textContent = "Nueva Tienda";
    document.getElementById("formTienda").reset();
    const toggle = document.getElementById('promovida-toggle');
    const knob = document.getElementById('promovida-knob');
    const label = document.getElementById('promovida-label');
    if (toggle) toggle.style.background = '#e9ecef';
    if (knob) knob.style.left = '3px';
    if (label) { label.textContent = 'No promovida'; label.style.color = '#6c757d'; }
    let hidden = document.getElementById('tiendaPromovida');
    if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'tiendaPromovida';
        hidden.value = '0';
        document.getElementById('formTienda').appendChild(hidden);
    }
    hidden.value = '0';
    document.getElementById("modalTienda").classList.add("active");
}

function cerrarModalTienda() {
    document.getElementById("modalTienda").classList.remove("active");
    document.getElementById("formTienda").reset();
    tiendaEditando = null;
}

async function guardarTienda() {
    const btn = document.querySelector("#formTienda button[type='submit']");

    const horarioJSON = JSON.stringify({
        mon: document.getElementById("horario-mon").value.trim(),
        tue: document.getElementById("horario-tue").value.trim(),
        wed: document.getElementById("horario-wed").value.trim(),
        thu: document.getElementById("horario-thu").value.trim(),
        fri: document.getElementById("horario-fri").value.trim(),
        sat: document.getElementById("horario-sat").value.trim(),
        sun: document.getElementById("horario-sun").value.trim()
    });

    const datos = {
        nombre: document.getElementById("tiendaNombre").value.trim(),
        descripcion: document.getElementById("tiendaDescripcion").value.trim(),
        direccion: document.getElementById("tiendaDireccion").value.trim(),
        horario: horarioJSON,
        imagen: document.getElementById("tiendaImagen").value.trim(),
        rating: document.getElementById("tiendaRating").value || 5,
        comision: document.getElementById("tiendaComision").value || 20,
        promovida: document.getElementById('tiendaPromovida') ? document.getElementById('tiendaPromovida').value : '0',
    };

    if (!datos.nombre || !datos.direccion) {
        mostrarNotificacion("Nombre y dirección obligatorios", "error");
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        const action = tiendaEditando ? "actualizarTienda" : "crearTienda";
        if (tiendaEditando) datos.id = tiendaEditando;
        const response = await fetchConToken(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...datos })
        });
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(tiendaEditando ? "Tienda actualizada" : "Tienda creada");
            cerrarModalTienda();
            cargarTiendasAdmin();
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

function togglePromovidaTienda() {
    const toggle = document.getElementById('promovida-toggle');
    const knob = document.getElementById('promovida-knob');
    const label = document.getElementById('promovida-label');

    let hiddenInput = document.getElementById('tiendaPromovida');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'tiendaPromovida';
        hiddenInput.value = '0';
        document.getElementById('formTienda').appendChild(hiddenInput);
    }

    const isPromoted = hiddenInput.value === '1';

    if (!isPromoted) {
        toggle.style.background = 'linear-gradient(135deg, #F4A261, #E63946)';
        knob.style.left = '27px';
        knob.style.boxShadow = '0 3px 10px rgba(230,57,70,.4)';
        label.textContent = '¡Promovida!';
        label.style.color = '#E63946';
        hiddenInput.value = '1';
    } else {
        toggle.style.background = '#e9ecef';
        knob.style.left = '3px';
        knob.style.boxShadow = '0 3px 8px rgba(0,0,0,.2)';
        label.textContent = 'No promovida';
        label.style.color = '#6c757d';
        hiddenInput.value = '0';
    }
}

async function editarTienda(id) {
    const tienda = tiendasCache.find(t => t.id == id);
    if (!tienda) return;
    tiendaEditando = id;
    document.getElementById("modalTiendaTitulo").textContent = "Editar Tienda";
    document.getElementById("tiendaNombre").value = tienda.nombre;
    document.getElementById("tiendaDescripcion").value = tienda.descripcion || '';
    document.getElementById("tiendaDireccion").value = tienda.direccion;
    const promovida = tienda.promovida == 1 || tienda.promovida === true;
    const toggle = document.getElementById('promovida-toggle');
    const knob = document.getElementById('promovida-knob');
    const label = document.getElementById('promovida-label');

    let hidden = document.getElementById('tiendaPromovida');
    if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'tiendaPromovida';
        document.getElementById('formTienda').appendChild(hidden);
    }

    hidden.value = promovida ? '1' : '0';

    if (promovida && toggle && knob && label) {
        toggle.style.background = 'linear-gradient(135deg, #F4A261, #E63946)';
        knob.style.left = '27px';
        knob.style.boxShadow = '0 3px 10px rgba(230,57,70,.4)';
        label.textContent = '¡Promovida!';
        label.style.color = '#E63946';
    } else if (toggle && knob && label) {
        toggle.style.background = '#e9ecef';
        knob.style.left = '3px';
        label.textContent = 'No promovida';
        label.style.color = '#6c757d';
    }

    let horarioObj = {};
    try {
        if (tienda.horario && tienda.horario.startsWith('{')) {
            horarioObj = JSON.parse(tienda.horario);
        } else {
            const horarioViejo = tienda.horario || '08:00-22:00';
            horarioObj = { mon: horarioViejo, tue: horarioViejo, wed: horarioViejo, thu: horarioViejo, fri: horarioViejo, sat: horarioViejo, sun: 'Cerrado' };
        }
    } catch (e) {
        horarioObj = { mon: '08:00-22:00', tue: '08:00-22:00', wed: '08:00-22:00', thu: '08:00-22:00', fri: '08:00-22:00', sat: '08:00-22:00', sun: 'Cerrado' };
    }

    document.getElementById("horario-mon").value = horarioObj.mon || '08:00-22:00';
    document.getElementById("horario-tue").value = horarioObj.tue || '08:00-22:00';
    document.getElementById("horario-wed").value = horarioObj.wed || '08:00-22:00';
    document.getElementById("horario-thu").value = horarioObj.thu || '08:00-22:00';
    document.getElementById("horario-fri").value = horarioObj.fri || '08:00-22:00';
    document.getElementById("horario-sat").value = horarioObj.sat || '08:00-22:00';
    document.getElementById("horario-sun").value = horarioObj.sun || 'Cerrado';

    document.getElementById("tiendaImagen").value = tienda.imagen || '';
    document.getElementById("tiendaRating").value = tienda.rating || 5;
    document.getElementById("tiendaComision").value = tienda.comision || 20;
    document.getElementById("modalTienda").classList.add("active");
}

async function eliminarTienda(id) {
    if (!confirm("¿Eliminar tienda? También se eliminarán sus productos.")) return;
    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarTienda&id=${id}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion("Tienda eliminada");
            cargarTiendasAdmin();
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}