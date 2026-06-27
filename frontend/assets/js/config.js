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
        barandas: { nombre: 'Barandas amarilla', envio: 5000 },
        puente: { nombre: 'B.las pollas', envio: 5000 },
        salida: { nombre: 'B.monseñor', envio: 5000 },
        bomberos: { nombre: 'Bomberos', envio: 5000 },
        calvario: { nombre: 'Calvario', envio: 5000 },
        cdla: { nombre: 'Cdla Chapa', envio: 6000 },
        ccaido: { nombre: 'Cp señor caido', envio: 7000 },       // ★ CORREGIDO: era Ccaido
        diamante: { nombre: 'Diamante', envio: 5000 },
        nogal: { nombre: 'El Nogal', envio: 5000 },
        hospital: { nombre: 'Hospital', envio: 5000 },
        sur: { nombre: 'La chapa', envio: 6000 },
        norte: { nombre: 'La judea', envio: 5000 },
        centro: { nombre: 'P. principal', envio: 4000 },
        portachuelo: { nombre: 'Portachuelo', envio: 6000 },
        bodegas: { nombre: 'Sali Bodegas', envio: 5000 },
        occidente: { nombre: 'Sali marinilla', envio: 5000 },
        señorcaido: { nombre: 'Señor caido', envio: 6000 },
        oriente: { nombre: 'Vargas', envio: 8000 },
        vista: { nombre: 'Vista hermosa', envio: 6000 },
        aguas: { nombre: 'Aguas vivas', envio: 5000 },
        ecoelsa: { nombre: 'Ecoelsa', envio: 4000 },
        carmelo: { nombre: 'El carmelo', envio: 7000 },
        calvario: { nombre: 'el calvario', envio: 5000 },
        esmeralda: { nombre: 'La esmeralda', envio: 5000 },
        valle: { nombre: 'Valle maria', envio: 12000 },
        corazon: { nombre: 'C. de jesus', envio: 6000},
        chorro: { nombre: 'El chorro', envio: 5000},
        arcoiris: { nombre: 'Arcoiris', envio: 6000 },
        copeconsa: { nombre: 'Copeconsa', envio: 5000 },
        aire: { nombre: 'Aire libre', envio: 5000 },
        pobres: { nombre: 'B.los pobres', envio: 5000},
        teneria: { nombre: 'Teneria', envio: 5000 },
        plaza1: { nombre: 'plaza mercado nueva', envio: 5000 },
        plaza2: { nombre: 'Plaza mercado vieja', envio: 5000 },
        vicente: { nombre: 'san vicente', envio: 5000 },
        entrecantos: { nombre: 'entrecantos', envio: 5000 },
        tanque: { nombre: 'El tanque', envio: 5000 }
        // ★ AGREGAR NUEVAS ZONAS AQUÍ ★
        // progreso: { nombre: 'Barrio Progreso', envio: 6000 }
    }
};

// ★★★ NUEVA URL DEL CATÁLOGO ESTÁTICO ★★★
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
// SOCKET.IO — Conexión global compartida
// ============================================
let socketGlobal = null;
let identificacionPendiente = null;

function conectarSocket(rol, id) {
    identificacionPendiente = { rol, id };

    if (socketGlobal && socketGlobal.connected) {
        socketGlobal.emit('identificar', { rol, id });
        console.log(`🔄 Re-identificado: ${rol}/${id}`);
        return socketGlobal;
    }

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

    socketGlobal.on('Disconnect', (reason) => {
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