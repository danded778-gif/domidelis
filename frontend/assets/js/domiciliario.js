// ============================================
// domiciliario.js — Panel del domiciliario
// Socket.IO (tiempo real) + Push (segundo plano)
// ============================================

let pedidosActivosCache = [];
let pedidosHistorialCache = [];
let filtroHistorialActual = 'todos';
let HISTORIAL_KEY = 'domiciliario_historial';
let miDomiciliarioId = null;

// ─── Helper: Extraer texto de tiendas de un pedido ───
function obtenerTiendasTextoDomi(pedido) {
    let productos = [];
    try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { productos = []; }
    const tiendas = new Set();
    productos.forEach(p => {
        if (p.tiendaNombre) tiendas.add(p.tiendaNombre);
    });
    return tiendas.size > 0 ? Array.from(tiendas).join(', ') : '';
}

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
// ============================================
// CARGA INICIAL
// ============================================
async function cargarDomiciliarioData() {
    const sesion = obtenerSesion();
    if (!sesion.id) return;
    miDomiciliarioId = sesion.id;

    const el = document.getElementById('user-display');
    if (el && sesion.usuario) el.innerHTML = `<i class="fas fa-user-circle"></i> ${sesion.usuario}`;


    HISTORIAL_KEY = `domiciliario_historial_${miDomiciliarioId}`;

    cargarHistorialLocal();
    await cargarPedidosDomiciliario(sesion.id);

    const socket = conectarSocket('domiciliario', sesion.id);

    socket.on('connect', () => console.log(`✅ [DOMI] Socket: ${socket.id}`));

    socket.on('nuevoPedidoAsignado', (data) => {
        console.log('🔔 [DOMI] nuevoPedidoAsignado:', data);
        notificarNuevoPedidoAsignado(data);
    });

    socket.on('pedidoAsignado', (data) => {
        if (String(data.domiciliarioId) === String(miDomiciliarioId)) {
            cargarPedidosDomiciliario(miDomiciliarioId);
        }
    });

    socket.on('estadoActualizado', () => {
        cargarPedidosDomiciliario(miDomiciliarioId);
    });
}

// ============================================
// NOTIFICACIÓN AL DOMICILIARIO
// ============================================
function notificarNuevoPedidoAsignado(data) {
    const pedidoId = data.pedidoId || (data.pedido ? data.pedido.id : '?');
    const mensaje = data.mensaje || `Pedido #${pedidoId} asignado`;

    if (typeof sonidoAsignacion === 'function') sonidoAsignacion();
    else reproducirSonidoFallback();

    mostrarToast('🛵 Nueva Asignación', mensaje, 'pedido', 10000);

    enviarNotificacionNavegador('Nuevo pedido asignado', {
        body: mensaje,
        icon: '/domidelis/assets/img/icon-192x192.png',
        badge: '/domidelis/assets/img/icon-192x192.png',
        tag: `pedido-${pedidoId}`,
        requireInteraction: true,
        data: { url: '/domiciliario.html', pedidoId }
    });

    cargarPedidosDomiciliario(miDomiciliarioId);
}

function reproducirSonidoFallback() {
    try {
        if (typeof audioCtx !== 'undefined' && audioCtx?.state === 'running') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        } else {
            new Audio('/assets/sounds/alerta.mp3').play().catch(() => { });
        }
    } catch (e) { }
}

// ============================================
// CARGAR PEDIDOS
// ============================================
async function cargarPedidosDomiciliario(domiciliarioId) {
    try {
        const res = await fetchConToken(`${API_URL}?action=getPedidos&domiciliario=${domiciliarioId}`);
        const pedidos = await res.json();
        pedidosActivosCache = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
        pedidos
            .filter(p =>
                p.estado === 'entregado' &&
                String(p.domiciliarioId) === String(domiciliarioId)
            )
            .forEach(p => agregarAHistorialLocal(p));
        guardarHistorialLocal();
        renderizarPedidosActivos();
        renderizarHistorial();
        actualizarBadges();
    } catch (error) {
        const c = document.getElementById('pedidos-activos');
        if (c) c.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error cargando</h3><button onclick="cargarDomiciliarioData()" class="btn btn-secondary"><i class="fas fa-sync-alt"></i> Reintentar</button></div>`;
    }
}

// ============================================
// HISTORIAL LOCAL
// ============================================
function cargarHistorialLocal() {
    try { pedidosHistorialCache = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || '[]'); }
    catch (e) { pedidosHistorialCache = []; }
}
function guardarHistorialLocal() {
    if (pedidosHistorialCache.length > 100) pedidosHistorialCache = pedidosHistorialCache.slice(0, 100);
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(pedidosHistorialCache));
}
function agregarAHistorialLocal(p) {
    if (!pedidosHistorialCache.some(h => h.id === p.id)) {
        p.fechaEntregaLocal = p.fecha;
        pedidosHistorialCache.unshift(p);
    }
}

// ============================================
// RENDERIZAR ACTIVOS
// ============================================
function renderizarPedidosActivos() {
    const c = document.getElementById('pedidos-activos');
    if (!c) return;
    if (pedidosActivosCache.length === 0) {
        c.innerHTML = `<div class="empty-state"><i class="fas fa-motorcycle"></i><h3>Sin pedidos activos</h3><p>Aparecerán aquí automáticamente</p><button onclick="cargarDomiciliarioData()" class="btn btn-secondary"><i class="fas fa-sync-alt"></i> Actualizar</button></div>`;
        return;
    }
    const pendientes = pedidosActivosCache.filter(p => p.estado === 'pendiente');
    const enCamino = pedidosActivosCache.filter(p => p.estado === 'en camino');
    let html = '';
    if (pendientes.length) { html += `<h3 class="estado-seccion"><i class="fas fa-clock"></i> Pendientes (${pendientes.length})</h3><div class="pedidos-grid">${renderCards(pendientes)}</div>`; }
    if (enCamino.length) { html += `<h3 class="estado-seccion"><i class="fas fa-shipping-fast"></i> En Camino (${enCamino.length})</h3><div class="pedidos-grid">${renderCards(enCamino)}</div>`; }
    c.innerHTML = html;
}

function renderCards(pedidos) {
    return pedidos.map(p => {
        let productos = [];
        try { productos = JSON.parse(p.productosJson); } catch (e) { }
        const esPendiente = p.estado === 'pendiente';
        const tiendasTexto = obtenerTiendasTextoDomi(p);
        return `<div class="panel-card pedido-card ${p.estado.replace(/\s/g, '-')}">
            <div class="pedido-header"><h3>Pedido #${p.id}</h3><span class="estado-badge estado-${p.estado.replace(/\s/g, '-')}">${p.estado}</span></div>
            <div class="pedido-info">
                ${tiendasTexto ? `<p><strong><i class="fas fa-store" style="color:var(--secondary);margin-right:4px"></i>Tienda:</strong> ${tiendasTexto}</p>` : ''}
                <p><strong>Cliente:</strong> ${p.clienteNombre}</p>
                <p><strong>Dirección:</strong> ${p.clienteDireccion}</p>
                <p><strong>Teléfono:</strong> ${p.clienteTelefono}</p>
                <p><strong>Total:</strong> ${formatearPrecio(p.total)}</p>
                <p><strong>Pago:</strong> ${p.metodoPago || 'Efectivo'}</p>
                <div class="productos-resumen"><strong>Productos:</strong><ul>${productos.slice(0, 3).map(x => `<li>${x.cantidad}x ${x.nombre}</li>`).join('')}${productos.length > 3 ? `<li>... y ${productos.length - 3} más</li>` : ''}</ul></div>
            </div>
            <div class="estado-botones">
                ${esPendiente ? `<button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${p.id},'en camino')"><i class="fas fa-motorcycle"></i> En camino</button>` : `<button class="btn btn-success btn-sm" onclick="marcarEntregado(${p.id})"><i class="fas fa-check"></i> Entregado</button>`}
                <button class="btn btn-info btn-sm" onclick="verMapa('${escapeQuotes(p.clienteDireccion)}')"><i class="fas fa-map"></i> Mapa</button>
                <button class="btn btn-secondary btn-sm" onclick="verDetallePedidoDomiciliario(${p.id})"><i class="fas fa-eye"></i> Detalle</button>
            </div></div>`;
    }).join('');
}

// ============================================
// RENDERIZAR HISTORIAL
// ============================================
function renderizarHistorial() {
    const c = document.getElementById('pedidos-historial');
    if (!c) return;
    let filtrados = [...pedidosHistorialCache];

    filtrados.sort((a, b) =>
        new Date(b.fechaEntregaLocal || b.fecha) -
        new Date(a.fechaEntregaLocal || a.fecha)
    );

    const ahora = new Date();

    if (filtroHistorialActual === 'hoy') {
        filtrados = filtrados.filter(p => new Date(p.fechaEntregaLocal || p.fecha).toDateString() === ahora.toDateString());
    } else if (filtroHistorialActual === 'ayer') {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        filtrados = filtrados.filter(p => new Date(p.fechaEntregaLocal || p.fecha).toDateString() === ayer.toDateString());
    } else if (filtroHistorialActual === 'semana') {
        const ini = new Date(ahora);
        ini.setDate(ahora.getDate() - ahora.getDay());
        ini.setHours(0, 0, 0, 0);
        filtrados = filtrados.filter(p => new Date(p.fechaEntregaLocal || p.fecha) >= ini);
    }

    actualizarEstadisticas(filtrados);

    if (!filtrados.length) {
        c.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>Sin pedidos en este período</h3></div>`;
        return;
    }
    c.innerHTML = filtrados.map(p => {
        let productos = []; try { productos = JSON.parse(p.productosJson); } catch (e) { }
        const fe = new Date(p.fechaEntregaLocal || p.fecha);

        const fechaTexto = fe.toLocaleDateString('es-CO', {
            timeZone: 'America/Bogota'
        });


        const tiendasTexto = obtenerTiendasTextoDomi(p);
        return `<div class="panel-card pedido-card entregado historial-card">
            <div class="pedido-header"><h3>Pedido #${p.id}</h3><span class="fecha-entrega"><i class="fas fa-calendar-check"></i>${fechaTexto}</span></div>
            <div class="pedido-info">
                ${tiendasTexto ? `<p><strong><i class="fas fa-store" style="color:var(--secondary);margin-right:4px"></i>Tienda:</strong> ${tiendasTexto}</p>` : ''}
                <p><strong>Cliente:</strong> ${p.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatearPrecio(p.total)}</p>
                <div class="productos-resumen"><strong>Entregados:</strong><ul>${productos.map(x => `<li>${x.cantidad}x ${x.nombre}</li>`).join('')}</ul></div>
            </div>
            <div class="historial-acciones"><span class="tiempo-entrega"><i class="fas fa-clock"></i> ${formatearTiempo(fe)}</span></div></div>`;
    }).join('');
}

function actualizarEstadisticas(pedidos) {
    const el1 = document.getElementById('total-entregados');
    const el2 = document.getElementById('total-ganado');
    if (el1) el1.textContent = pedidos.length;
    if (el2) el2.textContent = formatearPrecio(
        pedidos.reduce((s, p) => s + parseFloat(p.total || 0), 0)
    );
}
// ============================================
// ACCIONES
// ============================================
async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    let btn = null, orig = '';
    try {
        btn = event.target.closest('button'); orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const r = await fetchConToken(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        const d = await r.json();
        if (d.success) { mostrarToast('Actualizado', `Pedido → ${nuevoEstado}`, 'success'); await cargarPedidosDomiciliario(miDomiciliarioId); }
        else { mostrarToast('Error', 'No se pudo actualizar', 'error'); btn.disabled = false; btn.innerHTML = orig; }
    } catch (e) { if (btn) { btn.disabled = false; btn.innerHTML = orig; } mostrarToast('Error', 'Conexión fallida', 'error'); }
}

function marcarEntregado(id) { if (confirm('¿Confirmas entrega?')) cambiarEstadoPedido(id, 'entregado'); }
function verMapa(dir) { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`, '_blank'); }

function verDetallePedidoDomiciliario(id) {
    const p = pedidosActivosCache.find(x => x.id === id);
    if (!p) return;
    let productos = []; try { productos = JSON.parse(p.productosJson); } catch (e) { }
    const tiendasTexto = obtenerTiendasTextoDomi(p);
    const m = document.createElement('div');
    m.className = 'modal active modal-domiciliario';
    m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><h3><i class="fas fa-clipboard-list"></i> Pedido #${p.id}</h3><button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button></div>
    <div class="detalle-pedido">
        ${tiendasTexto ? `<p><strong><i class="fas fa-store" style="color:var(--secondary);margin-right:4px"></i>Tienda:</strong> <span class="tienda-tag-detalle">${tiendasTexto}</span></p>` : ''}
        <p><strong>Cliente:</strong> ${p.clienteNombre}</p>
        <p><strong>Teléfono:</strong> <a href="tel:${p.clienteTelefono}">${p.clienteTelefono}</a></p>
        <p><strong>Dirección:</strong> ${p.clienteDireccion}</p>
        <p><strong>Pago:</strong> ${p.metodoPago || 'Efectivo'}</p>
        <p><strong>Ref:</strong> ${p.referencias || 'Ninguna'}</p>
    <h4 style="margin-top:1rem">Productos:</h4>
        <div class="productos-lista">
        ${(() => {
            const tiendas = {};
            productos.forEach(x => {
                const key = x.tiendaNombre || 'Sin tienda';
                if (!tiendas[key]) tiendas[key] = [];
                tiendas[key].push(x);
            });
            return Object.entries(tiendas).map(([tienda, prods]) => `
                <div style="margin-bottom:0.8rem;">
                    <div style="font-size:0.8rem;font-weight:600;color:var(--secondary);
                                padding:0.3rem 0.6rem;background:var(--light);
                                border-radius:6px;margin-bottom:0.4rem;
                                display:flex;align-items:center;gap:0.4rem;">
                        <i class="fas fa-store"></i> ${tienda}
                    </div>
                    ${prods.map(x => `
                        <div class="producto-item">
                            <span>${x.cantidad}x ${x.nombre}</span>
                            <span>${formatearPrecio(x.subtotal)}</span>
                        </div>`).join('')}
                </div>`).join('');
        })()}
    </div>
    <div class="total-pedido"><strong>Total: ${formatearPrecio(p.total)}</strong></div>
    <div style="margin-top:1rem;display:flex;gap:.5rem"><button class="btn btn-success" style="flex:1" onclick="marcarEntregado(${p.id});this.closest('.modal').remove()"><i class="fas fa-check"></i> Entregado</button><button class="btn btn-info" style="flex:1" onclick="verMapa('${escapeQuotes(p.clienteDireccion)}')"><i class="fas fa-map"></i> Mapa</button></div></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

// ============================================
// TABS, FILTROS, BADGES
// ============================================
function cambiarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`seccion-${tab}`).classList.add('active');
    if (tab === 'historial') renderizarHistorial();
}
function actualizarBadges() {
    const b1 = document.getElementById('badge-activos');
    const b2 = document.getElementById('badge-historial');
    if (b1) b1.textContent = pedidosActivosCache.length;
    if (b2) b2.textContent = pedidosHistorialCache.length;
}
function filtrarHistorial(periodo) {
    filtroHistorialActual = periodo;
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderizarHistorial();
}
function formatearTiempo(fecha) {
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
}

// ============================================
// PERMISOS
// ============================================
function verificarEstadoPermisos() {
    const b = document.getElementById('permisos-banner');
    if (!b) return;
    const ok = ('Notification' in window) && Notification.permission === 'granted';
    b.style.display = ok ? 'none' : 'flex';
}

async function activarPermisos() {
    if (typeof initAudio === 'function') initAudio();
    if (audioCtx?.state === 'suspended') try { await audioCtx.resume(); } catch (e) { }

    let permiso = false;
    if (typeof solicitarPermisoNotificaciones === 'function') permiso = await solicitarPermisoNotificaciones();
    else if ('Notification' in window) permiso = (await Notification.requestPermission()) === 'granted';

    const b = document.getElementById('permisos-banner');
    if (b) b.style.display = 'none';

    if (permiso && typeof pushManager !== 'undefined') {
        const vapidRes = await fetch(`${API_URL}/vapid-public-key`);
        const { publicKey } = await vapidRes.json();
        await pushManager.init(publicKey);
    }

    if (permiso) { mostrarToast('¡Listo!', 'Notificaciones activadas. Recibirás alertas aunque cierres la pestaña.', 'success', 6000); if (typeof sonidoExito === 'function') sonidoExito(); }
    else mostrarToast('Audio activado', 'Notificaciones del sistema bloqueadas, pero el audio funciona.', 'warning', 6000);
}

// Polling de respaldo cada 30s
setInterval(() => {
    if (miDomiciliarioId && document.getElementById('seccion-activos')?.classList.contains('active')) cargarPedidosDomiciliario(miDomiciliarioId);
}, 30000);

// ============================================
// KEEP ALIVE & RESUME (Mantener sesión viva)
// Evita que el celular "mate" la app y
// reconecta si el domiciliario minimizó la PWA
// ============================================

// 1. DETECTAR CUANDO EL USUARIO VOLVIÓ A LA APP
document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        console.log('📱 [DOMI] App volvió a primer plano');

        // Forzar recarga de datos por si llegaron pedidos mientras estaba minimizado
        if (miDomiciliarioId) {
            cargarPedidosDomiciliario(miDomiciliarioId);
        }
    }
});

// Cuando la ventana gana foco (ej: vuelve desde otra app)
window.addEventListener('focus', function () {
    if (miDomiciliarioId) {
        cargarPedidosDomiciliario(miDomiciliarioId);
    }
});

// 2. ANTI-SUSPENSIÓN (Wake Lock)
// Evita que el celular apague la pestaña si el domiciliario 
// deja el celular encendido pero sin tocar la pantalla (ej: en el soporte de la moto)
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 [DOMI] Wake Lock activo (Pantalla no se dormirá)');

            wakeLock.addEventListener('release', () => {
                console.log('🔓 [DOMI] Wake Lock liberado');
                // Si se libera sola, intentamos reacquirerla si sigue en primer plano
                if (!document.hidden) {
                    setTimeout(requestWakeLock, 1000);
                }
            });
        }
    } catch (err) {
        console.log('⚠️ Wake Lock no soportado o bloqueado:', err.message);
    }
}

// Reactivar Wake Lock si la app vuelve a primer plano
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && !wakeLock) {
        await requestWakeLock();
    }
});

// Iniciar cuando cargue
window.addEventListener('load', () => {
    setTimeout(requestWakeLock, 2000); // Delay para no interferir con la carga inicial
});


// 3. TIMER INVISIBLE (Keep Alive de la pestaña)
// Los navegadores pausan los Timers si la pestaña está inactiva.
// Este pequeño truco de audio evita que Chrome duerma la pestaña completamente.
// (Solo funciona si la app está abierta en primer plano)
let keepAliveInterval;

function startKeepAlive() {
    // Usamos un AudioContext silencioso para engañar al navegador 
    // y que no considere la pestaña como "inactiva"
    if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running') {
        keepAliveInterval = setInterval(() => {
            if (!document.hidden && audioCtx.state === 'running') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                gain.gain.setValueAtTime(0, audioCtx.currentTime); // Volumen 0 (SILENCIOSO)
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.01);
            }
        }, 15000); // Cada 15 segundos
    }
}

// Iniciar Keep Alive después de que el domiciliario active permisos
// Observamos el banner de permisos
const observerPermisos = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.target.id === 'permisos-banner' && mutation.target.style.display === 'none') {
            setTimeout(startKeepAlive, 1000);
            observerPermisos.disconnect(); // Dejar de observar
        }
    });
});

const permBanner = document.getElementById('permisos-banner');
if (permBanner) {
    observerPermisos.observe(permBanner, { attributes: true, attributeFilter: ['style'] });
} else {
    // Si no hay banner, iniciar de todas formas
    setTimeout(startKeepAlive, 5000);
}