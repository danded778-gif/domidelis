// ============================================
// domiciliario.js — Panel del domiciliario
// Socket.IO (tiempo real) + Push (segundo plano)
// ============================================

let pedidosActivosCache = [];
let pedidosHistorialCache = [];
let filtroHistorialActual = 'todos';
let HISTORIAL_KEY = 'domiciliario_historial';
let miDomiciliarioId = null;

// ★ VARIABLE GLOBAL PARA EL SONIDO REAL ★
let audioAlerta = null;

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
    if (!sesion || !sesion.id) return;
    miDomiciliarioId = sesion.id;

    // ★ SOLUCIÓN: Buscamos el nombre en cualquiera de las variables donde pueda estar guardado
    const nombreUsuario = sesion.usuario || sesion.nombre || sesion.user || 'Domiciliario';

    const el = document.getElementById('user-display');
    if (el) el.innerHTML = `<i class="fas fa-user-circle"></i> ${nombreUsuario}`;

    // Actualizar nombre arriba y en configuración
    const elTop = document.getElementById('nombre-usuario-top');
    if (elTop) elTop.textContent = nombreUsuario;
    
    const elConfigNombre = document.getElementById('config-nombre');
    if (elConfigNombre) elConfigNombre.value = nombreUsuario;

    HISTORIAL_KEY = `domiciliario_historial_${miDomiciliarioId}`;

    // PRECARGAR EL SONIDO
    if (!audioAlerta) {
        audioAlerta = new Audio('assets/sounds/alerta.aac');
        audioAlerta.volume = 1.0;
    }

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

    reproducirSonidoAlerta();
    
    if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 500]);
    }

    mostrarToast('🛵 Nueva Asignación', mensaje, 'pedido', 10000);

    enviarNotificacionNavegador('Nuevo pedido asignado', {
        body: mensaje,
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `pedido-${pedidoId}`,
        requireInteraction: true,
        silent: true,
        vibrate: [300, 100, 300, 100, 500],
        data: { url: '/domiciliario.html', pedidoId }
    });

    cargarPedidosDomiciliario(miDomiciliarioId);
}

function reproducirSonidoAlerta() {
    try {
        if (!audioAlerta) {
            audioAlerta = new Audio('assets/sounds/alerta.aac');
            audioAlerta.volume = 1.0;
        }
        audioAlerta.currentTime = 0;
        audioAlerta.play().catch(e => {
            console.warn('⚠️ Navegador bloqueó el audio automático.');
            const desbloquearAudio = () => {
                audioAlerta.play().catch(() => {});
                document.removeEventListener('click', desbloquearAudio);
                document.removeEventListener('touchstart', desbloquearAudio);
            };
            document.addEventListener('click', desbloquearAudio, { once: true });
            document.addEventListener('touchstart', desbloquearAudio, { once: true });
        });
    } catch (e) {
        console.error('Error al reproducir alerta.aac:', e);
    }
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
            .filter(p => p.estado === 'entregado' && String(p.domiciliarioId) === String(domiciliarioId))
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

    filtrados.sort((a, b) => new Date(b.fechaEntregaLocal || b.fecha) - new Date(a.fechaEntregaLocal || a.fecha));

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
        const fechaTexto = fe.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
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
    if (el2) el2.textContent = formatearPrecio(pedidos.reduce((s, p) => s + parseFloat(p.total || 0), 0));
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
                    <div style="font-size:0.8rem;font-weight:600;color:var(--secondary);padding:0.3rem 0.6rem;background:var(--light);border-radius:6px;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.4rem;">
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
// ★ NUEVO: GUARDAR PERFIL Y CONTRASEÑA ★
// ============================================
async function guardarPerfilDomiciliario(event) {
    event.preventDefault();
    const sesion = obtenerSesion();
    if (!sesion.id) return;

    const nuevoNombre = document.getElementById('config-nombre').value.trim();
    const passActual = document.getElementById('config-pass-actual').value;
    const passNueva = document.getElementById('config-pass-nueva').value;
    const passConfirmar = document.getElementById('config-pass-confirmar').value;

    if (!nuevoNombre) {
        mostrarToast('Error', 'El nombre de usuario no puede estar vacío.', 'error');
        return;
    }

    let requiereCambioPass = false;
    if (passNueva || passActual || passConfirmar) {
        requiereCambioPass = true;
        
        if (!passActual) {
            mostrarToast('Error', 'Debes ingresar tu contraseña actual.', 'error');
            return;
        }
        if (passNueva.length < 6) {
            mostrarToast('Error', 'La nueva contraseña debe tener mínimo 6 caracteres.', 'error');
            return;
        }
        if (!/[A-Z]/.test(passNueva)) {
            mostrarToast('Error', 'La nueva contraseña debe tener al menos una mayúscula.', 'error');
            return;
        }
        if (passNueva !== passConfirmar) {
            mostrarToast('Error', 'Las contraseñas nuevas no coinciden.', 'error');
            return;
        }
    }

    try {
        const params = new URLSearchParams();
        params.append('action', 'actualizarPerfilDomiciliario');
        params.append('id', sesion.id);
        params.append('nombre', nuevoNombre);
        
        if (requiereCambioPass) {
            params.append('passwordActual', passActual);
            params.append('passwordNueva', passNueva);
        }

        const res = await fetchConToken(API_URL, {
            method: 'POST',
            body: params
        });
        
        const data = await res.json();

                if (data.success) {
            mostrarToast('Éxito', data.mensaje || 'Perfil actualizado correctamente', 'success');
            
            // Actualizar el nombre en la sesión local
            if (sesion) {
                sesion.usuario = nuevoNombre;
                localStorage.setItem('sesion', JSON.stringify(sesion));
            }

            // Actualizar la interfaz a la fuerza
            const elTop = document.getElementById('nombre-usuario-top');
            if (elTop) {
                elTop.textContent = nuevoNombre;
                console.log("✅ Nombre actualizado en pantalla a:", nuevoNombre);
            } else {
                console.warn("⚠️ No se encontró el elemento 'nombre-usuario-top' en el HTML");
            }
            
            const elUser = document.getElementById('user-display');
            if (elUser) elUser.innerHTML = `<i class="fas fa-user-circle"></i> ${nuevoNombre}`;
            
            // Limpiar campos de contraseña
            document.getElementById('config-pass-actual').value = '';
            document.getElementById('config-pass-nueva').value = '';
            document.getElementById('config-pass-confirmar').value = '';
        } else {
            mostrarToast('Error', data.error || 'No se pudo actualizar el perfil', 'error');
        }
    } catch (e) {
        console.error('Error guardando perfil:', e);
        mostrarToast('Error', 'Fallo de conexión al guardar', 'error');
    }
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

// ============================================
// HELPERS
// ============================================
function escapeQuotes(str) {
    return String(str || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatearPrecio(valor) {
    return '$' + Number(valor || 0).toLocaleString('es-CO');
}