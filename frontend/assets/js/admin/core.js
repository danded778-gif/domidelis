// ============================================
// core.js — Núcleo del panel de administración
// ============================================

// ─── VARIABLES DE ESTADO GLOBALES (compartidas) ───
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

// ★ USUARIOS TIENDA
let usuariosTiendaCache = [];
let usuarioTiendaEditando = null;

// ★ COMPLEMENTOS
let complementosCache = [];

// ★ DOMICILIARIOS
let domiciliarioEditando = null;

// ★ DEDUP DE CARGA INICIAL ─────────────────────
// Evita peticiones GET duplicadas (ej: getDomiciliarios pedido por
// pedidos.js Y por domiciliarios.js, getPedidos por pedidos.js Y historial.js).
// Solo activo durante cargarAdminData(); el tiempo real NUNCA se cachea.
let __enCargaInicial = false;
const __cacheGET = new Map(); // url → Promise<string> (texto de la respuesta)

// ─── FETCH SEGURO CON JWT ───
async function fetchConToken(url, opciones = {}) {
    const metodo = (opciones.method || 'GET').toUpperCase();
    const esDedup = __enCargaInicial && metodo === 'GET';

    // ★ HIT: esta URL ya se pidió en esta carga inicial →
    // devolvemos un Response NUEVO construido desde el texto cacheado
    // (cada consumidor puede hacer .json() sin conflicto)
    if (esDedup && __cacheGET.has(url)) {
        console.log('♻️ Dedup carga inicial:', url);
        const texto = await __cacheGET.get(url);
        return new Response(texto, {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    const token = localStorage.getItem('token');
    if (!token) {
        cerrarSesion();
        throw new Error('Sesión expirada');
    }

    opciones.headers = opciones.headers || {};
    if (opciones.headers instanceof Headers) {
        opciones.headers.append('Authorization', `Bearer ${token}`);
    } else {
        opciones.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, opciones);

    if (response.status === 401 || response.status === 403) {
        alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.');
        cerrarSesion();
        throw new Error('No autorizado');
    }

    // ★ MISS: si estamos en carga inicial y la respuesta es exitosa,
    // leemos el body UNA vez, lo cacheamos como texto y devolvemos
    // un Response nuevo con body intacto para el consumidor actual
    if (esDedup && response.ok) {
        const texto = await response.text();
        __cacheGET.set(url, Promise.resolve(texto));
        return new Response(texto, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }

    // ★ Si falla o no es dedup → comportamiento original intacto
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

// ─── PRESENCIA (helpers compartidos) ───
function aplicarListaPresencia(lista) {
    window.__presenciaMap = {};
    (lista || []).forEach(p => {
        if (!p || p.id == null) return;
        window.__presenciaMap[`${p.rol}:${String(p.id)}`] = p;
    });
    pintarPresenciaEnUI();
}

function escucharPresenciaAdmin(socket) {
    if (!socket || socket.__presenciaAdminBound) return;
    socket.__presenciaAdminBound = true;
    socket.on('presencia:lista', aplicarListaPresencia);

    // Si ya llegó una lista antes de enganchar el listener
    if (Array.isArray(window.__presenciaUltimaLista)) {
        aplicarListaPresencia(window.__presenciaUltimaLista);
    }
}

async function pedirSnapshotPresencia() {
    try {
        const res = await fetchConToken(`${API_URL}/presencia`);
        const data = await res.json();
        if (data && Array.isArray(data.presencia)) {
            aplicarListaPresencia(data.presencia);
        }
    } catch (e) {
        console.warn('No se pudo leer /api/presencia', e.message);
    }
}

function estadoPresencia(rol, id) {
    const p = (window.__presenciaMap || {})[`${rol}:${String(id)}`];
    return (p && p.estado) || 'offline';
}

function badgePresencia(rol, id) {
    const estado = estadoPresencia(rol, id);
    const label = estado === 'online' ? 'Conectado' : estado === 'away' ? 'En reposo' : 'Desconectado';
    const key = `${rol}:${id}`;
    return `<span class="presence-wrap" data-presence-key="${key}">
        <span class="presence-dot presence-${estado}" title="${label}" aria-label="${label}"></span>
        <span class="presence-label presence-${estado}">${label}</span>
    </span>`;
}

/**
 * Solo actualiza badges existentes en el DOM.
 * NO re-renderiza tablas ni listas (evita romper la UI).
 */
function pintarPresenciaEnUI() {
    document.querySelectorAll('[data-presence-key]').forEach(el => {
        const key = el.getAttribute('data-presence-key');
        const p = (window.__presenciaMap || {})[key];
        const estado = (p && p.estado) || 'offline';
        const label = estado === 'online' ? 'Conectado' : estado === 'away' ? 'En reposo' : 'Desconectado';

        el.querySelectorAll('.presence-dot, .presence-label').forEach(n => {
            n.classList.remove('presence-online', 'presence-away', 'presence-offline');
            n.classList.add('presence-' + estado);
        });

        const lab = el.querySelector('.presence-label');
        if (lab) lab.textContent = label;

        const dot = el.querySelector('.presence-dot');
        if (dot) {
            dot.title = label;
            dot.setAttribute('aria-label', label);
        }

        el.closest('.domiciliario-item')?.classList.toggle('is-offline', estado === 'offline');
    });
}

// Al reconectar el socket (bfcache o caída de red) → refrescar presencia
window.addEventListener('socket:reconectado', () => {
    console.log('🔄 [ADMIN] Socket reconectado — refrescando presencia');
    pedirSnapshotPresencia();
    pintarPresenciaEnUI();
});

// ═══════════════════════════════════════════════
// CARGA INICIAL
// ═══════════════════════════════════════════════
async function cargarAdminData() {
    // ★ Activar dedup solo durante esta función.
    // Al terminar (aunque haya errores) se desactiva y se limpia:
    // los eventos de socket y recargas manuales SIEMPRE van a la red real.
    __enCargaInicial = true;
    __cacheGET.clear();

    try {
        // Esperamos de forma segura a que fcm-manager.js se inicialice
        const fcmInterval = setInterval(() => {
            if (typeof window.solicitarPermisoFCM === 'function') {
                clearInterval(fcmInterval);
                console.log("⚙️ Solicitando y registrando token FCM de Administrador...");

                window.solicitarPermisoFCM('admin')
                    .then(token => {
                        if (token) console.log("✅ Token de admin registrado en Firestore:", token);
                    })
                    .catch(err => console.error("❌ Error registrando token FCM de admin:", err));
            }
        }, 150);

        const sesionAdmin = (typeof obtenerSesion === 'function') ? obtenerSesion() : {};
        const socket = conectarSocket('admin', sesionAdmin.id);
        escucharPresenciaAdmin(socket);

        await cargarTiendasAdmin();
        await cargarDomiciliarios();
        await cargarDomiciliariosAdmin();
        await cargarUsuariosTiendaAdmin();
        await cargarPedidosAdmin();
        await cargarHistorialPedidos();
        pintarPresenciaEnUI();
        pedirSnapshotPresencia();

        socket.on('nuevoPedido', (data) => {
            console.log('🛎️ [ADMIN] nuevoPedido:', data);
            if (typeof reproducirSonidoNuevoPedido === 'function') {
                reproducirSonidoNuevoPedido();
            }
            mostrarToast(
                '¡Nuevo pedido!',
                `#${data.pedido.id} - ${data.pedido.clienteNombre} - ${formatearPrecio(data.pedido.total)}`,
                'pedido',
                10000
            );
            if (typeof notificarPushAdmin === 'function') {
                notificarPushAdmin('Nuevo pedido recibido', {
                    body: `Cliente: ${data.pedido.clienteNombre}`,
                    url: 'admin.html'
                });
            }
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
    } finally {
        // ★ Nunca dejar cache residual: el tiempo real sigue igual que siempre
        __enCargaInicial = false;
        __cacheGET.clear();
    }
}

// Activación de audio con el primer click (una sola vez)
document.addEventListener('click', function handler() {
    if (!audioActivado && audioContext?.state === 'suspended') {
        if (typeof activarAudio === 'function') {
            activarAudio();
        }
    }
    document.removeEventListener('click', handler);
}, { once: true });

// ═══════════════════════════════════════════════
// PERMISOS
// ═══════════════════════════════════════════════
async function activarPermisos() {
    if (typeof initAudio === 'function') {
        initAudio();
    }
    if (audioContext?.state === 'suspended') {
        try { await audioContext.resume(); } catch (e) { }
    }

    let permiso = false;
    if (typeof window.solicitarPermisoFCM === 'function') {
        permiso = await window.solicitarPermisoFCM('admin');
    } else if (typeof solicitarPermisoNotificaciones === 'function') {
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
        if (audioContext?.state === 'running' && typeof reproducirBeep === 'function') {
            reproducirBeep(880, 0.1, 'sine');
            setTimeout(() => reproducirBeep(1109, 0.2, 'sine'), 150);
        }
    } else {
        mostrarToast('Audio activado', 'Notificaciones del sistema bloqueadas.', 'warning', 6000);
    }
}

// Cierre de modales al hacer click fuera
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};