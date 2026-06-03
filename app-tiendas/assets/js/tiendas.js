// ============================================
// UTILIDAD: Extraer nombre del Token JWT si hace falta
// ============================================
function obtenerNombreDesdeToken() {
    const token = localStorage.getItem('tienda_token');
    if (!token) return 'Mi Tienda';
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const datosToken = JSON.parse(jsonPayload);
        return datosToken.nombre || 'Mi Tienda';
    } catch (e) {
        return 'Mi Tienda';
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
const sesion = obtenerSesionTienda();

// CORRECCIÓN 1: Ya no busca 'panel.html', simplemente verifica si hay sesión y si estamos en la página correcta
if (sesion && sesion.token) {
    document.addEventListener('DOMContentLoaded', () => {
        const tituloElement = document.getElementById('titulo-tienda');
        if (tituloElement) {
            // CORRECCIÓN 2: Si el nombre no se guardó en localStorage, lo sacamos directo del Token
            const nombreTienda = sesion.nombre || obtenerNombreDesdeToken();
            tituloElement.innerHTML = `<i class="fas fa-store"></i> ${nombreTienda}`;
        }
        
        // CORRECCIÓN 3: Esto ahora sí se ejecutará automáticamente al entrar
        cargarProductos(); 
    });
}

// --- PESTAÑAS ---
function cambiarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(cont => cont.classList.remove('active'));
    
    // CORRECCIÓN 4: Se eliminó 'event.currentTarget' porque causa errores silenciosos en algunos navegadores
    // Buscamos el botón directamente por su atributo onclick
    const botonActivo = document.querySelector(`.tab-btn[onclick*="${tab}"]`);
    if (botonActivo) botonActivo.classList.add('active');
    
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    if (tab === 'pedidos') cargarPedidos();
    if (tab === 'productos') cargarProductos();
}

// --- PRODUCTOS (SOLO LECTURA) ---
async function cargarProductos() {
    const contenedor = document.getElementById('lista-productos');
    contenedor.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
    try {
        const res = await fetch(`${API_URL}/productos`, { headers: authHeaders() });
        if (res.status === 401 || res.status === 403) return cerrarSesionTienda();
        const productos = await res.json();
        renderizarProductos(productos);
    } catch (error) { 
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error de conexión.</p>`; 
    }
}

function renderizarProductos(productos) {
    const contenedor = document.getElementById('lista-productos');
    contenedor.innerHTML = '';
    if (productos.length === 0) {
        contenedor.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--gray); grid-column:1/-1;"><i class="fas fa-box-open" style="font-size:3rem;"></i><p>Aún no tienes productos.</p></div>`;
        return;
    }
    productos.forEach(p => {
        const badgeHTML = p.badge ? `<span class="product-admin-badge">${p.badge}</span>` : '';
        const imgStyle = p.imagen_url ? `background-image: url('${p.imagen_url}');` : ``;
        const iconHTML = !p.imagen_url ? `<i class="fas fa-image default-icon"></i>` : '';
        contenedor.innerHTML += `
            <div class="product-admin-card">
                <div class="product-admin-img" style="${imgStyle}">${iconHTML}</div>
                <div class="product-admin-info">
                    ${badgeHTML}
                    <h4>${p.nombre}</h4>
                    <p class="product-admin-price">${formatearPrecio(p.precio)}</p>
                </div>
            </div>`;
    });
}

// --- PEDIDOS ---
async function cargarPedidos() {
    const contenedor = document.getElementById('lista-pedidos');
    contenedor.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
    try {
        const res = await fetch(`${API_URL}/pedidos`, { headers: authHeaders() });
        if (res.status === 401 || res.status === 403) return cerrarSesionTienda();
        const pedidos = await res.json();
        renderizarPedidos(pedidos);
    } catch (error) { 
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error de conexión.</p>`; 
    }
}

function renderizarPedidos(pedidos) {
    const contenedor = document.getElementById('lista-pedidos');
    contenedor.innerHTML = '';
    if (pedidos.length === 0) {
        contenedor.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--gray);"><i class="fas fa-receipt" style="font-size:3rem;"></i><p>No tienes pedidos aún.</p></div>`;
        return;
    }
    pedidos.forEach(pedido => {
        let productosLista = '';
        try {
            const prods = JSON.parse(pedido.productosJson);
            productosLista = prods.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
        } catch (e) { productosLista = 'Error al leer'; }

        const fecha = new Date(pedido.fecha).toLocaleString('es-CO', {
            timeZone: 'America/Bogota'
        });
        const estadoClass = pedido.estado ? pedido.estado.toLowerCase().replace(/ /g, '-') : 'pendiente';

        contenedor.innerHTML += `
            <div class="pedido-card-tienda ${estadoClass}">
                <div class="pedido-header">
                    <span class="pedido-id">Pedido #${pedido.id}</span>
                    <span class="estado-badge estado-${estadoClass}">${pedido.estado || 'Pendiente'}</span>
                </div>
                <div class="pedido-detalles">
                    <p><strong>Cliente:</strong> ${pedido.clienteNombre}</p>
                    <p><strong>Dirección:</strong> ${pedido.clienteDireccion}</p>
                    <p><strong>Pago:</strong> ${pedido.metodoPago || 'Efectivo'}</p>
                    <div class="pedido-productos"><i class="fas fa-utensils"></i> ${productosLista}</div>
                    <p style="margin-top:0.8rem; font-size:1.2rem; color:var(--primary); font-weight:700;"><strong>Total:</strong> ${formatearPrecio(pedido.total)}</p>
                    <p style="font-size:0.8rem; color:var(--gray); margin-top:0.5rem;"><i class="fas fa-clock"></i> ${fecha}</p>
                </div>
            </div>`;
    });
}