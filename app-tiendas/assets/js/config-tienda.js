// Detectar si estamos en local, ngrok o producción
const esLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.ngrok-free.dev');

// Si es local, apunta a tu servidor local. Si es Railway, apunta a Railway.
const API_URL = esLocal
    ? window.location.origin + '/api/tienda'
    : 'https://prueba-production-b9fb.up.railway.app/api/tienda';

// Sesión exclusiva para la tienda (Guarda el JWT)
function guardarSesionTienda(token, tienda) {
    localStorage.setItem('tienda_token', token);
    localStorage.setItem('tienda_id', tienda.id);
    localStorage.setItem('tienda_nombre', tienda.nombre);
}

function obtenerSesionTienda() {
    return {
        token: localStorage.getItem('tienda_token'),
        id: localStorage.getItem('tienda_id'),
        nombre: localStorage.getItem('tienda_nombre')
    };
}

function cerrarSesionTienda() {
    localStorage.removeItem('tienda_token');
    localStorage.removeItem('tienda_id');
    localStorage.removeItem('tienda_nombre');
    // RUTA ACTUALIZADA: Redirige al nuevo nombre del login
    window.location.href = 'login-tienda.html';
}

// Utilidad para pasar el token en las peticiones fetch
function authHeaders() {
    const sesion = obtenerSesionTienda();
    return { 'Authorization': `Bearer ${sesion.token}` };
}

function formatearPrecio(precio) { return '$' + parseInt(precio).toLocaleString('es-CO'); }
function escapeQuotes(str) { if (!str) return ''; return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }