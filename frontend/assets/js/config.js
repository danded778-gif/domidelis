/* ============================================
// config.js — Configuración global
// Detecta automáticamente el entorno
// ============================================ */

// ¿Estamos en local o ngrok?
const esLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.ngrok-free.dev') ||
    window.location.hostname.includes('.ngrok.io');

// En local: misma origen (Express sirve todo por puerto 3000)
// En producción: frontend en GitHub Pages, API en Railway
const API_URL = esLocal
    ? window.location.origin + '/api'
    : 'https://prueba-production-b9fb.up.railway.app/api';

const SOCKET_URL = esLocal
    ? window.location.origin
    : 'https://prueba-production-b9fb.up.railway.app';

console.log(`⚙️ Entorno: ${esLocal ? 'LOCAL/NGROK' : 'PRODUCCIÓN'}`);
console.log(`⚙️ API:  ${API_URL}`);
console.log(`⚙️ Socket: ${SOCKET_URL}`);

// ============================================
// CONFIGURACIÓN DE LA APP
// ============================================
const APP_CONFIG = {
    nombre: 'DOMIDELIS',
    telefonoWhatsApp: '573005005306',
    envioBase: 2000,
    zonaActual: localStorage.getItem('zonaSeleccionada') || 'centro',
    zonas: {
        aguas: { nombre: 'Aguas vivas', envio: 4000 },
        aire: { nombre: 'Aire libre', envio: 5000 },
        arcoiris: { nombre: 'Arcoiris', envio: 5000 },
        barandas: { nombre: 'Barandas amarilla', envio: 5000 },
        bomberos: { nombre: 'Bomberos', envio: 5000 },
        puente: { nombre: 'B. Las Pollas', envio: 5000 },
        pobres: { nombre: 'B. Los Pobres', envio: 5000 },
        cdla: { nombre: 'Cdla Chapa', envio: 6000 },
        corazon: { nombre: 'C. de Jesus', envio: 6000 },
        calvario: { nombre: 'Calvario', envio: 5000 },
        ccaido: { nombre: 'Cp Señor Caido', envio: 7000 },
        copeconsa: { nombre: 'Copeconsa', envio: 6000 },
        diamante: { nombre: 'Diamante', envio: 5000 },
        chorro: { nombre: 'El Chorro', envio: 5000 },
        carmelo: { nombre: 'El Carmelo', envio: 7000 },
        nogal: { nombre: 'El Nogal', envio: 5000 },
        tanque: { nombre: 'El Tanque', envio: 4000 },
        entrecantos: { nombre: 'Entrecantos', envio: 5000 },
        ecoelsa: { nombre: 'Ecoelsa', envio: 4000 },
        hospital: { nombre: 'Hospital', envio: 5000 },
        sur: { nombre: 'La Chapa', envio: 6000 },
        esmeralda: { nombre: 'La Esmeralda', envio: 5000 },
        norte: { nombre: 'La Judea', envio: 5000 },
        centro: { nombre: 'P. Principal', envio: 4000 },
        plaza1: { nombre: 'Plaza Mercado Nueva', envio: 6000 },
        plaza2: { nombre: 'Plaza Mercado Vieja', envio: 5000 },
        portachuelo: { nombre: 'Portachuelo', envio: 6000 },
        bodegas: { nombre: 'Sali Bodegas', envio: 5000 },
        occidente: { nombre: 'Sali Marinilla', envio: 5000 },
        vicente: { nombre: 'San Vicente', envio: 5000 },
        señorcaido: { nombre: 'Señor Caido', envio: 6000 },
        teneria: { nombre: 'Teneria', envio: 5000 },
        valle: { nombre: 'Valle Maria', envio: 12000 },
        oriente: { nombre: 'Vargas', envio: 7000 },
        vista: { nombre: 'Vista Hermosa', envio: 6000 },
        calera: { nombre: 'La calera', envio: 15000 },
        undido: { nombre: 'B. hundido', envio: 5000 },

        lourdes: { nombre: 'V.lourdes', envio: 8000 },
        pantanillo: { nombre: 'Pantanillo', envio: 6000 },
        potrerio: { nombre: 'Potrerito', envio: 9000 },
        villas: { nombre: 'Villas del poli', envio: 5000 },
        saladito: { nombre: 'V. Saladito', envio: 6000 },
        otro_santuario: { nombre: 'Otro barrio/vereda Santuario', envio: 6000 },
        cataleya: { nombre: 'Cataleya', envio: 6000 },
        yamaha: { nombre: 'yamaha', envio: 5000 },
        miraflores: { nombre: 'Miraflores', envio: 5000 },
        // ★ AGREGAR NUEVAS ZONAS AQUÍ ★
        // progreso: { nombre: 'Barrio Progreso', envio: 6000 }
    }
};

// ★★★ URL DEL CATÁLOGO ESTÁTICO ★★★
const CATALOGO_URL = 'https://www.domidelis.top/data/catalogo.json';

// ============================================
// SESIÓN — localStorage (persiste al cerrar pestaña)
// ============================================
function guardarSesion(rol, usuario, id) {
    localStorage.setItem('rol', rol);
    localStorage.setItem('usuario', usuario);
    localStorage.setItem('id', id);
    localStorage.setItem('user', JSON.stringify({ rol, usuario, id }));
}

function obtenerSesion() {
    return {
        rol: localStorage.getItem('rol'),
        usuario: localStorage.getItem('usuario'),
        id: localStorage.getItem('id')
    };
}

function cerrarSesion() {
    localStorage.removeItem('rol');
    localStorage.removeItem('usuario');
    localStorage.removeItem('id');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

function logout() { cerrarSesion(); }

// ============================================
// CARRITO (Con expiración automática de 24 horas)
// ============================================
function guardarCarrito(nuevoCarrito) {
    const ahora = new Date().getTime();
    const data = {
        items: nuevoCarrito,
        timestamp: ahora
    };
    localStorage.setItem('carrito', JSON.stringify(data));
}

function obtenerCarrito() {
    const dataStr = localStorage.getItem('carrito');
    if (!dataStr) return [];

    try {
        const data = JSON.parse(dataStr);

        // Compatibilidad: carrito viejo (solo array)
        if (Array.isArray(data)) {
            localStorage.removeItem('carrito');
            return [];
        }

        const ahora = new Date().getTime();
        const horas24 = 24 * 60 * 60 * 1000;

        if (ahora - data.timestamp > horas24) {
            console.log("⏰ El carrito tiene más de 24h. Vaciando...");
            localStorage.removeItem('carrito');
            return [];
        }

        return data.items || [];
    } catch (e) {
        console.error("Error leyendo el carrito", e);
        return [];
    }
}

function limpiarCarrito() {
    localStorage.removeItem('carrito');
}

// ============================================
// UTILIDADES
// ============================================
function formatearPrecio(precio) {
    return '$' + parseInt(precio).toLocaleString('es-CO');
}

function generarEstrellas(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) s += '<i class="fas fa-star"></i>';
        else if (i - 0.5 <= rating) s += '<i class="fas fa-star-half-alt"></i>';
        else s += '<i class="far fa-star"></i>';
    }
    return s;
}

// ============================================
// SEGURIDAD ANTI-XSS (Escapar HTML)
// ============================================
function esc(str) {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function calcularEnvio(carritoItems) {
    const zona = APP_CONFIG.zonas[APP_CONFIG.zonaActual] || APP_CONFIG.zonas.centro;
    const base = zona.envio;

    const tiendas = new Set(
        carritoItems
            .filter(item => item.tiendaId)
            .map(item => String(item.tiendaId))
    );
    const n = tiendas.size || 1;

    const factor = Math.min(1 + 0.3 * (n - 1), 2.0);
    return Math.round(base * factor);
}

function descripcionRecargo(carritoItems) {
    const tiendas = new Set(
        carritoItems
            .filter(item => item.tiendaId)
            .map(item => String(item.tiendaId))
    );
    const n = tiendas.size || 1;
    if (n <= 1) return null;
    const pct = Math.round(Math.min(0.3 * (n - 1), 1.0) * 100);
    return `+${pct}% aplicado por ${n} tiendas`;
}

// ============================================
// DESGLOSE DEL RECARGO MULTI-TIENDA
// Le entrega al modal "¿Por qué?" los números reales:
// cuántas tiendas, % del recargo, base y final.
// Devuelve null si hay 0 o 1 tienda (nada que explicar).
// USA LA MISMA MATEMÁTICA de calcularEnvio() — nunca puede
// mostrar números diferentes a los que se cobran.
// ============================================
function desgloseRecargo(carritoItems) {
    const zona = APP_CONFIG.zonas[APP_CONFIG.zonaActual] || APP_CONFIG.zonas.centro;
    const base = zona.envio;

    const tiendas = new Set(
        carritoItems
            .filter(item => item.tiendaId)
            .map(item => String(item.tiendaId))
    );
    const n = tiendas.size;
    if (n <= 1) return null;

    const factor = Math.min(1 + 0.3 * (n - 1), 2.0);
    const final = Math.round(base * factor);
    const pct = Math.round(Math.min(0.3 * (n - 1), 1.0) * 100);

    return { tiendas: n, base: base, final: final, delta: final - base, pct: pct };
}

// ============================================
// SOCKET.IO — Conexión global compartida
// ============================================
let socketGlobal = null;
let identificacionPendiente = null;

// ★ FIX: ¿Esta página ya tuvo al menos una conexión exitosa?
// Sirve para distinguir PRIMERA conexión de RECONEXIÓN real
window.__socketConectoAlgunaVez = false;

function payloadIdentificar(rol, id) {
    let nombre = '';
    try {
        if (typeof obtenerSesion === 'function') {
            const s = obtenerSesion();
            nombre = (s && (s.nombre || s.usuario)) || '';
        }
    } catch (e) { }
    return { rol, id, nombre };
}

function avisarReconexionSocket() {
    // Evento limpio para que admin (u otras páginas) reaccionen
    window.dispatchEvent(new CustomEvent('socket:reconectado', {
        detail: {
            socketId: socketGlobal ? socketGlobal.id : null,
            identificacion: identificacionPendiente
        }
    }));
}

function conectarSocket(rol, id) {
    identificacionPendiente = payloadIdentificar(rol, id);

    // Si ya hay socket conectado → solo re-identificar
    if (socketGlobal && socketGlobal.connected) {
        identificacionPendiente = payloadIdentificar(rol, id);
        socketGlobal.emit('identificar', identificacionPendiente);
        console.log(`🔄 Re-identificado: ${rol}/${id}`);
        iniciarPresenciaCliente();
        return socketGlobal;
    }

    // Si existe socket viejo → limpiar
    if (socketGlobal) {
        socketGlobal.removeAllListeners();
        socketGlobal.close();
        socketGlobal = null;
        window.__presenciaIniciada = false;
    }

    console.log(`🔗 Conectando socket → ${SOCKET_URL}`);

    socketGlobal = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true
    });

    // Guardar última lista de presencia (para recuperar si el admin aún no escuchaba)
    socketGlobal.on('presencia:lista', (lista) => {
        window.__presenciaUltimaLista = lista || [];
    });

    socketGlobal.on('connect', () => {
        console.log(`✅ Socket conectado: ${socketGlobal.id}`);

        // 1) Re-identificar SIEMPRE (el servidor ve cada connect como cliente nuevo)
        if (identificacionPendiente) {
            identificacionPendiente = payloadIdentificar(
                identificacionPendiente.rol,
                identificacionPendiente.id
            );
            socketGlobal.emit('identificar', identificacionPendiente);
        }

        // 2) Presencia
        iniciarPresenciaCliente();

        // ★ FIX: avisar reconexión SOLO si ya habíamos conectado antes.
        // La primera conexión NO es reconexión → no se emite el evento.
        // Así core.js puede escuchar 'socket:reconectado' sin duplicar cargas.
        if (window.__socketConectoAlgunaVez) {
            console.log('🔌 Reconexión real → emitiendo socket:reconectado');
            avisarReconexionSocket();
        }
        window.__socketConectoAlgunaVez = true;
    });

    socketGlobal.on('disconnect', (reason) => {
        console.warn(`⚠️ Socket desconectado: ${reason}`);
        if (reason === 'io server disconnect') {
            setTimeout(() => {
                if (socketGlobal) socketGlobal.connect();
            }, 1000);
        }
    });

    socketGlobal.on('connect_error', (err) => {
        console.error(`❌ Error socket: ${err.message}`);
    });

    return socketGlobal;
}

function getSocket() {
    return socketGlobal;
}

// ============================================
// PRESENCIA — heartbeat + idle (Teams-like)
// Verde = actividad, Amarillo = reposo, Gris = sin socket
// ============================================
const PRESENCIA_IDLE_MS = 2 * 60 * 1000;
const PRESENCIA_PING_MS = 25 * 1000;

function iniciarPresenciaCliente() {
    const socket = getSocket();
    if (!socket || window.__presenciaIniciada) return;
    window.__presenciaIniciada = true;

    let lastActivity = Date.now();
    let awayEnviado = false;

    const marcarActividad = () => {
        lastActivity = Date.now();
        if (awayEnviado && socket.connected) {
            socket.emit('presencia:ping');
            awayEnviado = false;
        }
    };

    ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(ev => {
        document.addEventListener(ev, marcarActividad, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (!socket.connected) return;
        if (document.hidden) {
            socket.emit('presencia:away');
            awayEnviado = true;
        } else {
            marcarActividad();
            socket.emit('presencia:ping');
        }
    });

    window.addEventListener('beforeunload', () => {
        try { socket.emit('presencia:away'); } catch (e) { }
    });

    setInterval(() => {
        if (!socket.connected) return;
        if (document.hidden || Date.now() - lastActivity >= PRESENCIA_IDLE_MS) {
            if (!awayEnviado) {
                socket.emit('presencia:away');
                awayEnviado = true;
            } else {
                socket.emit('presencia:ping');
            }
        } else {
            socket.emit('presencia:ping');
        }
    }, PRESENCIA_PING_MS);
}

// ============================================
// RECUPERACIÓN DESDE BACK-FORWARD CACHE
// Cuando el navegador restaura la pestaña, el WebSocket
// suele estar cerrado. Aquí se reconecta y re-identifica.
// ============================================
window.addEventListener('pageshow', (event) => {
    // event.persisted = true → página restaurada desde bfcache
    if (!event.persisted) return;

    console.log('🔄 Página restaurada desde bfcache — revisando socket...');

    const socket = getSocket();

    if (!socket) return;

    if (!socket.connected) {
        console.log('🔗 Socket caído tras bfcache — reconectando...');
        socket.connect();
        // Al conectar, el handler 'connect' emitirá socket:reconectado
        // automáticamente (porque __socketConectoAlgunaVez ya es true)
        return;
    }

    // Socket sigue "vivo" pero conviene re-identificar
    if (identificacionPendiente) {
        socket.emit('identificar', payloadIdentificar(
            identificacionPendiente.rol,
            identificacionPendiente.id
        ));
        iniciarPresenciaCliente();
        avisarReconexionSocket();
    }
});

// ============================================
// ★ FIX HEADER: mide la altura real del header
// fijo y ajusta --header-height para que el main
// NUNCA quede tapado (todas las páginas).
// ============================================
(function () {
    function ajustarAlturaHeader() {
        var header = document.querySelector('header');
        if (!header) return;
        var altura = header.offsetHeight;
        if (altura > 0) {
            document.documentElement.style.setProperty('--header-height', altura + 'px');
        }
    }
    window.addEventListener('load', ajustarAlturaHeader);
    window.addEventListener('resize', ajustarAlturaHeader);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(ajustarAlturaHeader);
    }
    ajustarAlturaHeader();
})();