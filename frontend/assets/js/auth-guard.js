// ============================================
// auth-guard.js - Protección de rutas con JWT
// ============================================

// Función auxiliar para decodificar el payload del JWT
function decodificarToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null; // Token inválido, corrupto o malformado
    }
}

// Obtener sesión leyendo directamente del Token (NUNCA del localStorage suelto)
function obtenerSesion() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        return { rol: null, nombre: null, id: null };
    }

    const datos = decodificarToken(token);
    
    if (!datos) {
        // Si el token está corrupto, limpiamos todo
        cerrarSesion();
        return { rol: null, nombre: null, id: null };
    }

    // Verificar si el token ha expirado (el backend le puso 8h)
    const ahora = Math.floor(Date.now() / 1000);
    if (datos.exp && datos.exp < ahora) {
        alert("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        cerrarSesion();
        return { rol: null, nombre: null, id: null };
    }

    // Retornamos los datos que firmó el backend de forma segura
    return { 
        rol: datos.rol, 
        nombre: datos.nombre, 
        id: datos.id 
    };
}

function protegerRuta(rolRequerido) {
    const sesion = obtenerSesion();
    
    // Si no hay sesión (token ausente, inválido o expirado)
    if (!sesion.rol) {
        window.location.href = "login.html";
        return false;
    }
    
    // Si el rol del token no coincide con el requerido por la página (ej. domiciliario intentando entrar a admin.html)
    if (sesion.rol !== rolRequerido) {
        if (sesion.rol === "admin") {
            window.location.href = "admin.html";
        } else if (sesion.rol === "domiciliario") {
            window.location.href = "domiciliario.html";
        } else {
            window.location.href = "index.html";
        }
        return false;
    }
    
    // Mostrar nombre de usuario en el header (obtenido del token de forma segura)
    const userDisplay = document.getElementById("user-display");
    if (userDisplay && sesion.nombre) {
        userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${esc(sesion.nombre)}`;
    }
    
    return true;
}

function verificarSesion() {
    const sesion = obtenerSesion();
    return sesion.rol !== null;
}

function redirigirSegunRol() {
    const sesion = obtenerSesion();
    if (sesion.rol === "admin") {
        window.location.href = "admin.html";
    } else if (sesion.rol === "domiciliario") {
        window.location.href = "domiciliario.html";
    }
}