// ============================================
// core.js — Núcleo del panel de administración
// ★ v2.3 TURBO (FINAL): carga inicial PARALELIZADA
//   - fetchConToken: dedup por PROMESA — dos llamadas simultáneas a la
//     misma URL comparten UN solo viaje de red.
//   - cargarAdminData: 6 esperas en fila → 2 oleadas en paralelo
//     + prefetch del viaje más pesado (getPedidos)
//   - OLEADA 1 = catálogos BASE (tiendas, domiciliarios)
//     OLEADA 2 = los que PINTAN usando esos catálogos (pedidos,
//     historial, usuarios-tienda ← v2.2: fix del "Tienda eliminada")
//   - Sockets registrados ANTES de cargar: el panel ya no está sordo
//     durante la carga
//   - v2.3: estadoPresencia corregido (String(id) — bug de transcripción
//     que rompía la tabla de domiciliarios)
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
// ★ v2 TURBO: el mapa guarda la PROMESA del viaje desde el instante en que
// parte → el dedup también funciona con llamadas SIMULTÁNEAS (paralelo).
let __enCargaInicial = false;
const __cacheGET = new Map(); // url → Promise<string> (texto de la respuesta)

// ★ v2 TURBO: con la carga en paralelo, varias peticiones pueden fallar con
// 401/403 al mismo tiempo — un solo aviso y un solo cierre de sesión.
let __sesionCerrandose = false;
function avisarSesionInvalida() {
    if (__sesionCerrandose) return;
    __sesionCerrandose = true;
    alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.');
    cerrarSesion();
}

// ─── FETCH SEGURO CON JWT ───
async function fetchConToken(url, opciones = {}) {
    const metodo = (opciones.method || 'GET').toUpperCase();
    const esDedup = __enCargaInicial && metodo === 'GET';

    // ★ HIT: este viaje ya está en el aire (o ya aterrizó) → engancharse a él.
    // Cada consumidor recibe un Response NUEVO (cada uno puede hacer .json()).
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

    // ★ Tiempo real (fuera de la carga inicial) → comportamiento original intacto
    if (!esDedup) {
        const response = await fetch(url, opciones);
        if (response.status === 401 || response.status === 403) {
            avisarSesionInvalida();
            throw new Error('No autorizado');
        }
        return response;
    }

    // ★ v2 TURBO — MISS: registrar la PROMESA ANTES de esperarla. Si otra
    // llamada llega mientras este viaje está en el aire, hará HIT arriba
    // y compartirá exactamente este mismo resultado (un solo viaje).
    const promesaTexto = (async () => {
        const response = await fetch(url, opciones);
        if (response.status === 401 || response.status === 403) {
            throw { __sinAutorizacion: true };
        }
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.text();
    })();

    __cacheGET.set(url, promesaTexto);

    try {
        const texto = await promesaTexto;
        return new Response(texto, {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    } catch (err) {
        __cacheGET.delete(url); // no dejar viajes rotos cacheados
        if (err && err.__sinAutorizacion) {
            avisarSesionInvalida();
            throw new Error('No autorizado');
        }
        throw err; // error de red / HTTP → el catch de cada pantalla lo maneja como siempre
    }
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
// CARGA INICIAL — ★ v2.3 TURBO (paralela)
// ═══════════════════════════════════════════════

// ★ TURBO: si un pedido cambia MIENTRAS la carga inicial sigue en curso,
// se descarta la copia en vuelo de getPedidos para que el refresco traiga
// ESTE pedido y no la foto de hace dos segundos.
function invalidarCacheGetPedidos() {
    if (__enCargaInicial) {
        __cacheGET.delete(`${API_URL}?action=getPedidos`);
    }
}

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

        // ★ TURBO: los sockets se registran ANTES de cargar. Antes, durante
        // los ~9s de carga el panel estaba "sordo": un pedido que llegara en
        // esa ventana no sonaba ni notificaba. Ahora sí.
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
            invalidarCacheGetPedidos(); // ★ TURBO
            cargarPedidosAdmin();
            cargarHistorialPedidos();
        });

        socket.on('estadoActualizado', (data) => {
            console.log('🔄 [ADMIN] estadoActualizado:', data);
            mostrarToast(`Pedido #${data.pedidoId}`, `Cambió a: ${data.nuevoEstado}`, 'info');
            invalidarCacheGetPedidos(); // ★ TURBO
            cargarPedidosAdmin();
            if (data.nuevoEstado === 'entregado') cargarHistorialPedidos();
        });

        socket.on('pedidoAsignado', (data) => {
            console.log('📢 [ADMIN] pedidoAsignado:', data);
            mostrarToast('Asignación', `Pedido #${data.pedidoId} asignado`, 'success');
            invalidarCacheGetPedidos(); // ★ TURBO
            cargarPedidosAdmin();
        });

        // ★ TURBO — PREFETCH: el viaje más pesado (getPedidos) parte YA,
        // en paralelo con la oleada 1. Cuando la oleada 2 lo necesite,
        // ya estará en el aire (o resuelto) en el dedup → cero espera extra.
        fetchConToken(`${API_URL}?action=getPedidos`).catch(() => { });

        // ★ v2.3 — OLEADA 1: catálogos BASE. Nada aquí consulta variables
        // de otras funciones al pintar. Llena tiendasCache y domiciliariosCache.
        await Promise.allSettled([
            cargarTiendasAdmin(),
            cargarDomiciliarios(),
            cargarDomiciliariosAdmin()
        ]);

        // ★ v2.3 — OLEADA 2: lo que PINTA usando datos de la oleada 1.
        // - pedidos e historial: necesitan tiendasCache + domiciliariosCache
        // - usuarios-tienda: necesita tiendasCache para el nombre de la tienda
        await Promise.allSettled([
            cargarPedidosAdmin(),
            cargarHistorialPedidos(),
            cargarUsuariosTiendaAdmin()
        ]);

        pintarPresenciaEnUI();
        pedirSnapshotPresencia();
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

// ─── DRAG-TO-SCROLL para tablas (mouse fluido, táctil ya es nativo) ───
(function () {
    document.querySelectorAll('.tabla-historial-container, .tabla-scroll').forEach(c => {
        c.style.cursor = 'grab';
        let down = false, startX = 0, scrollLeft = 0, moved = false;

        c.addEventListener('mousedown', e => {
            down = true; moved = false;
            startX = e.pageX - c.offsetLeft;
            scrollLeft = c.scrollLeft;
            c.style.cursor = 'grabbing';
        });
        c.addEventListener('mouseleave', () => { down = false; c.style.cursor = 'grab'; });
        c.addEventListener('mouseup', () => { down = false; c.style.cursor = 'grab'; });
        c.addEventListener('mousemove', e => {
            if (!down) return;
            const x = e.pageX - c.offsetLeft;
            if (Math.abs(x - startX) > 5) moved = true;   // umbral anti-clic
            c.scrollLeft = scrollLeft - (x - startX);
        });
        // Si arrastró, cancela el click que siga (para no borrar/editar sin querer)
        c.addEventListener('click', e => {
            if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
        }, true);
    });
})();