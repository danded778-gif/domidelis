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
    nombre: 'SOLUVENCON',
    telefonoWhatsApp: '573005005306',
    envioBase: 2000,
    zonaActual: localStorage.getItem('zonaSeleccionada') || 'centro',
    zonas: {
        centro: { nombre: 'Parque principal', envio: 5000 },
        norte: { nombre: 'La judea', envio: 5000 },
        sur: { nombre: 'La chapa', envio: 6000 },
        oriente: { nombre: 'Vargas', envio: 8000 },
        occidente: { nombre: 'Sali marinilla', envio: 5000 },
        salida: { nombre: 'B.monseñor', envio: 5000 },
        puente: { nombre: 'B.las pollas', envio: 5000 },
        cdla: { nombre: 'Cdla Chapa', envio: 6000 },
        bomberos: { nombre: 'Bomberos', envio: 5000 },
        señorcaido: { nombre: 'Señor caido', envio: 5000 },
        calvario: { nombre: 'Calvario', envio: 5000 },
        barandas: { nombre: 'Barandas amarilla', envio: 5000 },
        vista: { nombre: 'Vista hermosa', envio: 6000 },
        hospital: { nombre: 'Hospital', envio: 5000 },
        bodegas: { nombre: 'Sali Bodegas', envio: 6000 }
        
    }
};

// ============================================
// SESIÓN — localStorage (persiste al cerrar pestaña)
// ============================================
function guardarSesion(rol, usuario, id) {
    localStorage.setItem('rol', rol);
    localStorage.setItem('usuario', usuario);
    localStorage.setItem('id', id);
    // Push-manager también lee desde aquí
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
    // Solo borrar sesión, NO el carrito ni historial
    localStorage.removeItem('rol');
    localStorage.removeItem('usuario');
    localStorage.removeItem('id');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

function logout() { cerrarSesion(); }

// ============================================
// CARRITO
// ============================================
function obtenerCarrito() {
    try { return JSON.parse(localStorage.getItem('carrito')) || []; }
    catch (e) { return []; }
}

function guardarCarrito(carrito) {
    localStorage.setItem('carrito', JSON.stringify(carrito));
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

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ============================================
// SOCKET.IO — Conexión global compartida
// ============================================
let socketGlobal = null;
let identificacionPendiente = null;

function conectarSocket(rol, id) {
    identificacionPendiente = { rol, id };

    // Reutilizar si ya está conectado
    if (socketGlobal && socketGlobal.connected) {
        socketGlobal.emit('identificar', { rol, id });
        console.log(`🔄 Re-identificado: ${rol}/${id}`);
        return socketGlobal;
    }

    // Destruir socket viejo si existe
    if (socketGlobal) {
        socketGlobal.removeAllListeners();
        socketGlobal.close();
        socketGlobal = null;
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

    socketGlobal.on('connect', () => {
        console.log(`✅ Socket conectado: ${socketGlobal.id}`);
        if (identificacionPendiente) {
            socketGlobal.emit('identificar', identificacionPendiente);
        }
    });

    socketGlobal.on('disconnect', (reason) => {
        console.warn(`⚠️ Socket desconectado: ${reason}`);
        if (reason === 'io server disconnect') {
            setTimeout(() => socketGlobal.connect(), 1000);
        }
    });

    socketGlobal.on('connect_error', (err) => {
        console.error(`❌ Error socket: ${err.message}`);
    });

    return socketGlobal;
}

function getSocket() { return socketGlobal; }
