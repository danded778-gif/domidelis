// Detectar si estamos en local, ngrok o producción
const esLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.ngrok-free.dev');

// Si es local, apunta a tu servidor local. Si es Railway, apunta a Railway.
const API_URL = esLocal
    ? window.location.origin + '/api/tienda'
    : 'https://prueba-production-b9fb.up.railway.app/api/tienda';

// Sesión exclusiva para la tienda (Guarda el JWT y la Info) - ★ ACTUALIZADO
function guardarSesionTienda(token, tienda) {
    localStorage.setItem('tienda_token', token);
    // ★ Guardamos todo el objeto tienda como un JSON string
    localStorage.setItem('tienda_info', JSON.stringify(tienda));
}

function obtenerSesionTienda() {
    const token = localStorage.getItem('tienda_token');
    let info = null;
    try {
        info = JSON.parse(localStorage.getItem('tienda_info'));
    } catch (e) { info = null; }
    return { token, info };
}

function cerrarSesionTienda() {
    localStorage.removeItem('tienda_token');
    localStorage.removeItem('tienda_info');
    window.location.href = 'login-tienda.html';
}

// Utilidad para pasar el token en las peticiones fetch
function authHeaders() {
    const sesion = obtenerSesionTienda();
    return { 
        'Authorization': `Bearer ${sesion.token}`,
        'Content-Type': 'application/json'
    };
}

function formatearPrecio(precio) { return '$' + parseInt(precio).toLocaleString('es-CO'); }
function escapeQuotes(str) { if (!str) return ''; return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }