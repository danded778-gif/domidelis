// ============================================
// admin.js — Panel de administración
// ============================================

let tiendasCache = [];
let productosCache = [];
let domiciliariosCache = [];
let pedidoEditando = null;
let tiendaEditando = null;
let productoEditando = null;
let pedidoIdAsignar = null;
let audioContext = null;
let audioActivado = false;
let pedidosEntregadosCache = [];
let pedidosSeleccionados = new Set();

// ★ NUEVAS VARIABLES PARA USUARIOS TIENDA
let usuariosTiendaCache = [];
let usuarioTiendaEditando = null;

// ★ NUEVAS VARIABLES PARA COMPLEMENTOS
let complementosCache = [];

// ─── NUEVA FUNCIÓN: FETCH SEGURO CON JWT ───
async function fetchConToken(url, opciones = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        cerrarSesion(); // Si no hay token, lo sacamos
        throw new Error('Sesión expirada');
    }

    opciones.headers = opciones.headers || {};
    if (opciones.headers instanceof Headers) {
        opciones.headers.append('Authorization', `Bearer ${token}`);
    } else {
        opciones.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, opciones);

    // Si el servidor rechaza el token (401 No autorizado o 403 Prohibido)
    if (response.status === 401 || response.status === 403) {
        alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.');
        cerrarSesion();
        throw new Error('No autorizado');
    }

    return response;
}

// ─── UTILIDADES ─────────────────────────────
function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    return new Date(fechaStr).toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
function renderPropinaBadge(p) {
    const propina = parseFloat(p.propina) || 0;
    if (propina > 0) {
        return `<span class="badge" style="background:#2A9D8F;color:#fff;"><i class="fas fa-hand-holding-heart"></i> Sí — ${formatearPrecio(propina)}</span>`;
    }
    return `<span class="badge" style="background:#e0e0e0;color:#666;">No</span>`;
}

// ─── AUDIO ───
function initAudio() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { }
}

async function activarAudio() {
    initAudio();
    if (!audioContext) return false;
    try {
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (audioContext.state === 'running') {
            audioActivado = true;
            await reproducirBeep(800, 0.1, 'sine');
            return true;
        }
    } catch (e) { }
    return false;
}

async function reproducirBeep(frecuencia = 800, duracion = 0.1, tipo = 'sine') {
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, audioContext.currentTime);
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracion);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duracion);
}

function reproducirSonidoNuevoPedido() {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    if (!audioContext || audioContext.state !== 'running') return;
    try {
        const now = audioContext.currentTime;
        [
            { t: 0, f: 880, d: 0.15 },
            { t: 0.2, f: 880, d: 0.15 },
            { t: 0.4, f: 1109, d: 0.4 }
        ].forEach(({ t, f, d }) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now + t);
            gain.gain.setValueAtTime(0, now + t);
            gain.gain.linearRampToValueAtTime(0.4, now + t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
            osc.start(now + t);
            osc.stop(now + t + d);
        });
    } catch (e) { }
}

async function notificarPushAdmin(titulo, opciones = {}) {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(titulo, {
            body: opciones.body || '',
            icon: opciones.icon || '/assets/img/icon-192x192.png',
            badge: opciones.badge || '/assets/img/icon-192x192.png',
            tag: opciones.tag || 'admin-pedido',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: {
                url: opciones.url || window.location.href,
                pedidoId: opciones.pedidoId || null
            }
        });
    } catch (e) { }
}

// ═══════════════════════════════════════════════
// CARGA INICIAL
// ═══════════════════════════════════════════════
async function cargarAdminData() {
    await cargarTiendasAdmin();
    await cargarDomiciliarios();
    await cargarDomiciliariosAdmin();
    await cargarUsuariosTiendaAdmin();
    await cargarPedidosAdmin();
    await cargarHistorialPedidos();

    const socket = conectarSocket('admin', null);

    socket.on('nuevoPedido', (data) => {
        console.log('🛎️ [ADMIN] nuevoPedido:', data);
        reproducirSonidoNuevoPedido();
        mostrarToast(
            '¡Nuevo pedido!',
            `#${data.pedido.id} - ${data.pedido.clienteNombre} - ${formatearPrecio(data.pedido.total)}`,
            'pedido',
            10000
        );
        notificarPushAdmin('Nuevo pedido recibido', {
            body: `Cliente: ${data.pedido.clienteNombre}`,
            url: 'admin.html'
        });
        cargarPedidosAdmin();
        cargarHistorialPedidos();
    });

    socket.on('estadoActualizado', (data) => {
        console.log('🔄 [ADMIN] estadoActualizado:', data);
        mostrarToast(`Pedido #${data.pedidoId}`, `Cambió a: ${data.nuevoEstado}`, 'info');
        cargarPedidosAdmin();
        if (data.nuevoEstado === 'entregado') cargarHistorialPedidos();
    });

    socket.on('pedidoAsignado', (data) => {
        console.log('📢 [ADMIN] pedidoAsignado:', data);
        mostrarToast('Asignación', `Pedido #${data.pedidoId} asignado`, 'success');
        cargarPedidosAdmin();
    });
}

document.addEventListener('click', function handler() {
    if (!audioActivado && audioContext?.state === 'suspended') {
        activarAudio();
    }
    document.removeEventListener('click', handler);
}, { once: true });

// ═══════════════════════════════════════════════
// PERMISOS
// ═══════════════════════════════════════════════
async function activarPermisos() {
    initAudio();
    if (audioContext?.state === 'suspended') {
        try { await audioContext.resume(); } catch (e) { }
    }

    let permiso = false;
    if (typeof solicitarPermisoNotificaciones === 'function') {
        permiso = await solicitarPermisoNotificaciones();
    } else if ('Notification' in window) {
        permiso = (await Notification.requestPermission()) === 'granted';
    }

    const banner = document.getElementById('permisos-banner');
    if (banner) banner.style.display = 'none';

    if (permiso && typeof pushManager !== 'undefined') {
        const vapidRes = await fetchConToken(`${API_URL}/api/vapid-public-key`);
        const { publicKey } = await vapidRes.json();
        await pushManager.init(publicKey);
    }

    if (permiso) {
        mostrarToast('¡Listo!', 'Notificaciones activadas completamente.', 'success', 6000);
        if (audioContext?.state === 'running') {
            reproducirBeep(880, 0.1, 'sine');
            setTimeout(() => reproducirBeep(1109, 0.2, 'sine'), 150);
        }
    } else {
        mostrarToast('Audio activado', 'Notificaciones del sistema bloqueadas.', 'warning', 6000);
    }
}

// ============================================
// TIENDAS
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
    const checkbox = document.getElementById('tiendaPromovida') || { checked: false };

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

// ============================================
// PRODUCTOS
// ============================================
async function cargarProductosPorTienda(tiendaId) {
    if (!tiendaId) {
        document.getElementById("listaProductosTienda").style.display = "none";
        return;
    }
    const tienda = tiendasCache.find(t => t.id == tiendaId);
    document.getElementById("nombreTiendaSeleccionada").textContent = tienda ? tienda.nombre : '';
    document.getElementById("listaProductosTienda").style.display = "block";
    try {
        const res = await fetchConToken(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        productosCache = productos;
        const tbody = document.querySelector("#tablaProductosTienda tbody");
        if (productos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Sin productos</td></tr>";
            return;
        }
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><i class="fas ${p.icono || 'fa-utensils'}"></i> ${esc(p.nombre)}</td>
                <td>${p.descripcion || '-'}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalComplementos(${p.id})" title="Gestionar Complementos"><i class="fas fa-sliders-h"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        mostrarNotificacion("Error cargando productos", "error");
    }
}

function verProductosTienda(tiendaId) {
    const select = document.getElementById("selectTiendaProductos");
    select.value = tiendaId;
    cargarProductosPorTienda(tiendaId);
    select.scrollIntoView({ behavior: 'smooth' });
}

function mostrarModalProducto() {
    if (tiendasCache.length === 0) {
        mostrarNotificacion("Crea al menos una tienda primero", "error");
        return;
    }
    productoEditando = null;
    document.getElementById("modalProductoTitulo").textContent = "Nuevo Producto";
    document.getElementById("formProducto").reset();
    document.getElementById("comision-calculo-box").style.display = "none";
    document.getElementById("modalProducto").classList.add("active");
}

function cerrarModalProducto() {
    document.getElementById("modalProducto").classList.remove("active");
    document.getElementById("formProducto").reset();
    productoEditando = null;
}

async function guardarProducto() {
    const btn = document.querySelector("#formProducto button[type='submit']");
    const tiendaId = document.getElementById("productoTiendaId").value;
    if (!tiendaId) {
        mostrarNotificacion("Selecciona una tienda", "error");
        return;
    }

    const datos = {
        tiendaId: tiendaId,
        nombre: document.getElementById("productoNombre").value.trim(),
        descripcion: document.getElementById("productoDescripcion").value.trim(),
        precio: document.getElementById("productoPrecio").value,
        imagen_url: document.getElementById("productoImagen").value.trim(),
        badge: document.getElementById("productoBadge").value.trim()
    };

    if (!datos.nombre || !datos.precio) {
        mostrarNotificacion("Nombre y precio obligatorios", "error");
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        const action = productoEditando ? "actualizarProducto" : "crearProducto";
        if (productoEditando) datos.id = productoEditando;
        const response = await fetchConToken(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...datos })
        });
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(productoEditando ? "Producto actualizado" : "Producto creado");
            cerrarModalProducto();
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            if (tiendaSeleccionada == tiendaId) cargarProductosPorTienda(tiendaId);
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
    }
}

async function editarProducto(id) {
    const producto = productosCache.find(p => p.id == id);
    if (!producto) return;
    productoEditando = id;
    document.getElementById("modalProductoTitulo").textContent = "Editar Producto";
    document.getElementById("productoTiendaId").value = producto.tiendaId;
    document.getElementById("productoNombre").value = producto.nombre;
    document.getElementById("productoDescripcion").value = producto.descripcion || '';
    document.getElementById("productoPrecio").value = producto.precio;
    document.getElementById("productoImagen").value = producto.imagen_url || '';
    document.getElementById("productoBadge").value = producto.badge || '';
    calcularComisionProducto();
    document.getElementById("modalProducto").classList.add("active");
}

async function eliminarProducto(id) {
    if (!confirm("¿Eliminar producto?")) return;
    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarProducto&id=${id}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion("Producto eliminado");
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            cargarProductosPorTienda(tiendaSeleccionada);
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

// ============================================
// ★ NUEVO: COMPLEMENTOS Y EXTRAS
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
        productoId: productoId,
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
        const response = await fetchConToken(`${API_URL}?action=eliminarComplemento&id=${id}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion('Complemento eliminado');
            await cargarComplementos(productoId);
        } else {
            mostrarNotificacion('Error al eliminar', 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

// ============================================
// DOMICILIARIOS
// ============================================
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
// PEDIDOS ACTIVOS — CON COLUMNA TIENDA
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
                    <td>${domi ? `<i class="fas fa-user"></i> ${esc(domi.nombre)}` : "— Sin asignar —"}</td>
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
// ASIGNACIÓN DOMICILIARIOS
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
    contenedor.innerHTML = domiciliarios.map(d => `
        <div class="domiciliario-item" onclick="confirmarAsignacion(${d.id}, '${escapeQuotes(d.nombre)}')"
             style="display: flex; align-items: center; padding: 16px; margin-bottom: 12px; background: #fff; border: 2px solid #e0e0e0; border-radius: 16px; cursor: pointer;">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--dark), var(--accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.3rem; margin-right: 16px;">
                ${d.nombre.charAt(0).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${esc(d.nombre)}</div>
                <div style="font-size: 0.85rem; color: var(--gray);"><i class="fas fa-phone"></i> ${d.telefono || 'Sin teléfono'} | ID: ${d.id}</div>
            </div>
            <div style="color: var(--primary);"><i class="fas fa-chevron-right"></i></div>
        </div>
    `).join('');
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
                <p><strong>Propina:</strong> ${renderPropinaBadge(pedido)}</p>
                <p><strong>Fecha:</strong> ${formatearFecha(pedido.fecha)}</p>
                <p><strong>Estado:</strong> <span class="badge badge-${pedido.estado.replace(/\s/g, '-')}">${pedido.estado}</span></p>
                <h4>Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `<div class="producto-item"><span>${prod.cantidad}x ${esc(prod.nombre)} (${prod.cantidadTipo} UND)</span><span>${formatearPrecio(prod.subtotal)}</span></div>`).join('')}
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
// HISTORIAL DE PEDIDOS ENTREGADOS
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
            method: 'POST',
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

// ============================================
// DOMICILIARIOS — CRUD
// ============================================
let domiciliarioEditando = null;

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

        if (domiciliarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay domiciliarios registrados</td></tr>';
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

        tbody.innerHTML = domiciliarios.map(d => `
            <tr>
                <td>${d.id}</td>
                <td><strong>${escapeQuotes(d.nombre)}</strong></td>
                <td><i class="fas fa-phone" style="color:var(--accent);margin-right:4px;font-size:.8rem;"></i> ${d.telefono || '—'}</td>
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
    } catch (error) {
        console.error(error);
        mostrarNotificacion('Error cargando domiciliarios', 'error');
    }
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

// ============================================
// ★ CALCULADORA DE COMISIONES PARA PRODUCTOS
// ============================================

function calcularComisionProducto() {
    const tiendaId = document.getElementById('productoTiendaId').value;
    const precioStr = document.getElementById('productoPrecio').value;
    const box = document.getElementById('comision-calculo-box');

    if (!tiendaId || !precioStr) {
        box.style.display = 'none';
        return;
    }

    const precio = parseFloat(precioStr);
    if (precio <= 0) {
        box.style.display = 'none';
        return;
    }

    const tienda = tiendasCache.find(t => String(t.id) === String(tiendaId));
    const comisionPct = tienda ? parseFloat(tienda.comision || 20) : 20;

    const gananciaTienda = precio - (precio * (comisionPct / 100));

    document.getElementById('tiendaRecibe').textContent = formatearPrecio(gananciaTienda);
    document.getElementById('comisionPctDisplay').textContent = comisionPct;
    box.style.display = 'block';
}

function calcularPrecioDesdeGanancia() {
    const tiendaId = document.getElementById('productoTiendaId').value;
    const gananciaStr = document.getElementById('gananciaDeseadaInput').value;

    if (!tiendaId || !gananciaStr) {
        mostrarNotificacion("Selecciona la tienda y escribe la ganancia deseada", "error");
        return;
    }

    const gananciaDeseada = parseFloat(gananciaStr);
    const tienda = tiendasCache.find(t => String(t.id) === String(tiendaId));
    const comisionPct = tienda ? parseFloat(tienda.comision || 20) : 20;

    if (comisionPct >= 100) {
        mostrarNotificacion("La comisión no puede ser 100% o más", "error");
        return;
    }

    const precioSugerido = gananciaDeseada / (1 - (comisionPct / 100));

    document.getElementById('productoPrecio').value = Math.ceil(precioSugerido);
    calcularComisionProducto();
    mostrarNotificacion(`Precio sugerido: ${formatearPrecio(precioSugerido)}`, "success");
}


// ============================================
// ★ USUARIOS TIENDA — CRUD
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

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) event.target.classList.remove('active');
};