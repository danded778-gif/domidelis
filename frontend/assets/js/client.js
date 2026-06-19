// ============================================
// client.js - FUSIÓN DOCUMENTADA Y ACTUALIZADA
// Incluye: Horario JSON (Día por día), Autocomplete, Carrito, Analíticas
// ============================================

let tiendas = [];
let carrito = [];

document.addEventListener("DOMContentLoaded", () => {
    carrito = obtenerCarrito();
    inicializarEventos();
    if (document.getElementById("stores-grid")) cargarTiendas();
});

function inicializarEventos() {
    const closeCart = document.getElementById("close-cart");
    const cartFloat = document.getElementById("cart-float");
    const cartOverlay = document.getElementById("cart-overlay");
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    const mobileMenu = document.getElementById("mobile-menu");
    const navLinks = document.getElementById("nav-links");

    if (closeCart) closeCart.onclick = cerrarCarrito;
    if (cartFloat) cartFloat.onclick = abrirCarrito;
    if (cartOverlay) cartOverlay.onclick = cerrarCarrito;
    if (checkoutBtn) checkoutBtn.onclick = irACheckout;

    if (mobileMenu && navLinks) {
        mobileMenu.onclick = () => {
            navLinks.classList.toggle("active");
            mobileMenu.classList.toggle("active");
        };
    }
    // ★ LÓGICA DEL POPUP - VALIDAR Y GUARDAR CÓDIGO ★
    const popupOverlay = document.getElementById('popupOverlay');
    const popupAnuncio = document.getElementById('popupAnuncio');
    const popupCerrarBtn = document.getElementById('popupCerrarBtn');
    const codigoInput = document.getElementById('popupCodigoInput');
    const validarBtn = document.getElementById('popupValidarBtn');
    const codigoContainer = document.getElementById('popupCodigoContainer');
    const exitoDiv = document.getElementById('popupExito');

    function cerrarPopup() {
        if (popupOverlay) popupOverlay.classList.remove('mostrar');
        if (popupAnuncio) popupAnuncio.classList.remove('mostrar');
        document.body.style.overflow = '';
    }

    if (popupCerrarBtn) popupCerrarBtn.onclick = cerrarPopup;
    if (popupOverlay) popupOverlay.onclick = cerrarPopup;

    if (validarBtn && codigoInput) {
        validarBtn.onclick = function () {
            const CODIGOS_VALIDOS = ["DOMIDELIS50", "JUDEA50", "CHAPA50", "CENTRO50"];
            const codigoIngresado = codigoInput.value.trim().toUpperCase();

            if (CODIGOS_VALIDOS.includes(codigoIngresado)) {
                localStorage.setItem('domidelis_codigo_promo', codigoIngresado);
                codigoContainer.style.display = 'none';
                exitoDiv.style.display = 'block';
                setTimeout(() => cerrarPopup(), 1500);
            } else if (codigoIngresado !== '') {
                codigoInput.classList.add('invalid');
                codigoInput.value = '';
                codigoInput.placeholder = 'Código inválido';
                setTimeout(() => {
                    codigoInput.classList.remove('invalid');
                    codigoInput.placeholder = 'Escribe tu código';
                }, 2000);
            }
        };
        codigoInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); validarBtn.click(); }
        });
    }

    const POPUP_KEY = 'domidelis_popup_visto';
    if (!sessionStorage.getItem(POPUP_KEY) && popupAnuncio) {
        setTimeout(() => {
            popupOverlay.classList.add('mostrar');
            popupAnuncio.classList.add('mostrar');
            document.body.style.overflow = 'hidden';
            sessionStorage.setItem(POPUP_KEY, 'true');
        }, 2500);
    }
}


function abrirCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.add("active");
    if (cartOverlay) cartOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function cerrarCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.remove("active");
    if (cartOverlay) cartOverlay.classList.remove("active");
    document.body.style.overflow = "";
}

// ★★★ FUNCIÓN MEJORADA: Carga desde GitHub en vez de Google Sheets ★★★
async function cargarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    try {
        const res = await fetch(`${CATALOGO_URL}?v=${Date.now()}`);
        const data = await res.json();

        tiendas = data.tiendas || [];

        const tituloPrincipal = document.getElementById('main-title');
        if (tituloPrincipal) {
            tituloPrincipal.innerHTML = `<i class="fas fa-store"></i> Tiendas`;
        }

        renderizarTiendas();
    } catch (error) {
        console.error("Error cargando catálogo estático", error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-slash"></i>
                <p>No hay tiendas disponibles</p>
                <button onclick="cargarTiendas()" class="btn-retry">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ============================================
// renderizarTiendas() - Abiertas primero, luego por rating
// ============================================ 
function renderizarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    tiendas.sort((a, b) => {
        const statusA = checkStoreStatus(a.horario);
        const statusB = checkStoreStatus(b.horario);

        const isOpenA = statusA.isOpen ? 1 : 0;
        const isOpenB = statusB.isOpen ? 1 : 0;

        if (isOpenB !== isOpenA) {
            return isOpenB - isOpenA;
        }

        const ratingA = parseFloat(a.rating) || 0;
        const ratingB = parseFloat(b.rating) || 0;
        return ratingB - ratingA;
    });

    container.className = 'stores-grid';

    if (tiendas.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-store-slash"></i><p>No hay tiendas</p></div>`;
        return;
    }

    container.innerHTML = tiendas.map(tienda => {
        const tieneImagen = tienda.imagen && tienda.imagen.trim() !== '';
        const tieneDesc = tienda.descripcion && String(tienda.descripcion).trim() !== '';
        const rating = tienda.rating || 5;

        const status = checkStoreStatus(tienda.horario);
        const closedClass = !status.isOpen ? 'store-closed' : '';
        const closedOverlay = !status.isOpen ? '<div class="closed-overlay"></div>' : '';
        const closedBadge = !status.isOpen ? `<span class="badge-closed"><i class="fas fa-clock"></i> ${status.nextOpening}</span>` : '';

        return `
        <div class="store-card ${closedClass}" onclick="verMenuTienda(${tienda.id})">
            ${closedOverlay}
            ${closedBadge}
            <div class="store-img" style="${tieneImagen ? `background-image: url('${tienda.imagen}');` : ''}">
                ${!tieneImagen ? '<i class="fas fa-store"></i>' : ''}
                <span class="store-badge">⭐ ${rating}</span>
                <div class="store-img-overlay"></div>
            </div>
            <div class="store-info">
                <h3>${tienda.nombre}</h3>
                ${tieneDesc ? `<p class="store-desc">${tienda.descripcion}</p>` : ''}
                <p><i class="fas fa-map-marker-alt"></i> ${tienda.direccion}</p>
                <p><i class="fas fa-clock"></i> Hoy: ${getHorarioHoy(tienda.horario)}</p>
                <div class="store-rating">${generarEstrellas(rating)}</div>
            </div>
        </div>
    `}).join('');
}

// ★★★ FUNCIÓN MEJORADA: Ya no hace fetch, lee los productos de la memoria ★★★
async function verMenuTienda(tiendaId) {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    container.className = '';
    container.innerHTML = `...`;

    const tienda = tiendas.find(t => t.id == tiendaId);

    const tituloPrincipal = document.getElementById('main-title');
    if (tituloPrincipal && tienda) {
        tituloPrincipal.innerHTML = `<i class="fas fa-utensils"></i> ${tienda.nombre}`;
    }

    // ★ NUEVO: Registrar evento en Google Analytics ★
    if (tienda && typeof gtag === 'function') {
        gtag('event', 'ver_tienda', {
            'event_category': 'engagement',
            'event_label': tienda.nombre || 'tienda_sin_nombre',
            'tienda_id': tienda.id
        });
    }

    if (!tienda) {
        mostrarNotificacion("Tienda no encontrada", "error");
        cargarTiendas();
        return;
    }

    const productos = tienda.productos || [];
    const productosValidos = productos.filter(p => p.id && p.id !== '' && p.nombre);

    if (productosValidos.length === 0) {
        container.innerHTML = `
            <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
            <div class="menu-header">
                <p>${tienda.descripcion || ""}</p>
            </div>
            <div class="empty-state"><i class="fas fa-box-open"></i><p>Esta tienda aún no tiene productos</p></div>
        `;
        return;
    }

    const status = checkStoreStatus(tienda.horario);

    let productosHTML = productosValidos.map(p => {
        p.tiendaId = tienda.id;
        p.tiendaNombre = tienda.nombre;

        const imagenUrl = (p.imagen_url || p.icono || '').trim();
        const tieneImagen = imagenUrl && imagenUrl !== 'null' && imagenUrl !== 'undefined';

        const esAgotado = p.badge && p.badge.toLowerCase() === 'agotado';

        let botonHTML;
        if (!status.isOpen) {
            // 1. La tienda está cerrada
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Esta tienda está cerrada hoy. Horario: ${getHorarioHoy(tienda.horario)}', 'error')">
                <i class="fas fa-clock"></i> Cerrado
            </button>`;
        } else if (esAgotado) {
            // 2. La tienda está abierta PERO el producto está agotado
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Este producto está agotado por el momento', 'error')">
                <i class="fas fa-ban"></i> Agotado
            </button>`;
        } else {
            // 3. La tienda está abierta y el producto está disponible
            botonHTML = `<button class="btn-agregar-unidad" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)">
                <i class="fas fa-plus"></i> Agregar
            </button>`;
        }

        return `
        <div class="product-card">
            <div class="product-img ${tieneImagen ? 'con-imagen' : 'sin-imagen'}" 
                 ${tieneImagen ? `style="background-image: url('${imagenUrl}');"` : ''}>
                ${!tieneImagen ? `<i class="fas fa-utensils"></i>` : ''}
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
            </div>
            <div class="product-info">
                <h4>${p.nombre}</h4>
                <p class="product-desc">${p.descripcion || ''}</p>
                <div class="product-price">${formatearPrecio(p.precio)}</div>
                <div class="precio-unidad-container">
                    ${botonHTML}
                </div>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = `
        <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
        <div class="menu-header">
            <p>${tienda.descripcion || ""}</p>
            <span style="display:inline-block;margin-top:.5rem;background:var(--light);color:var(--gray);padding:.3rem .9rem;border-radius:20px;font-size:.85rem;">
                <i class="fas fa-box"></i> ${productosValidos.length} producto${productosValidos.length !== 1 ? 's' : ''} disponible${productosValidos.length !== 1 ? 's' : ''}
            </span>
        </div>
        <div style="margin:1rem 0;">
            <div style="position:relative;">
                <i class="fas fa-search" style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:var(--gray);"></i>
                <input type="text" id="buscador-productos" placeholder="Buscar producto..." 
                    oninput="filtrarProductos(this.value)"
                    style="width:100%;padding:.8rem 1rem .8rem 2.8rem;border:2px solid #e0e0e0;border-radius:50px;font-family:inherit;font-size:.95rem;outline:none;transition:border-color .2s;"
                    onfocus="this.style.borderColor='var(--primary)'"
                    onblur="this.style.borderColor='#e0e0e0'">
            </div>
            <p id="resultado-busqueda" style="text-align:center;color:var(--gray);font-size:.85rem;margin-top:.5rem;display:none;"></p>
        </div>
        <div class="menu-grid" id="menu-grid-container">${productosHTML}</div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// EXPLOSIÓN DE COMIDA RÁPIDA 🍔🍟🍕
// ============================================
function crearExplosionComida() {
    if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50, 100, 100]);
    }

    const emojisComida = ['🍔', '🍟', '🍕', '🌭', '🍗', '🥪', '🌮', '🍿', '🥤', '🍩'];
    const cantidad = 14;
    const contenedor = document.createElement('div');
    contenedor.className = 'explosion-comida';

    const centroX = window.innerWidth / 2;
    const centroY = window.innerHeight / 2;

    contenedor.style.left = centroX + 'px';
    contenedor.style.top = centroY + 'px';
    document.body.appendChild(contenedor);

    for (let i = 0; i < cantidad; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'emoji-comida';
        emoji.textContent = emojisComida[Math.floor(Math.random() * emojisComida.length)];

        const angulo = (Math.PI * 2 * i) / cantidad + (Math.random() - 0.5) * 0.6;
        const distancia1 = 60 + Math.random() * 50;
        const distancia2 = 140 + Math.random() * 120;

        const x1 = Math.cos(angulo) * distancia1;
        const y1 = Math.sin(angulo) * distancia1 - 60;
        const x2 = Math.cos(angulo) * distancia2;
        const y2 = Math.sin(angulo) * distancia2 + 100;

        const rot1 = Math.random() * 360 - 180;
        const rot2 = rot1 + Math.random() * 360 - 180;

        emoji.style.setProperty('--x1', x1 + 'px');
        emoji.style.setProperty('--y1', y1 + 'px');
        emoji.style.setProperty('--x2', x2 + 'px');
        emoji.style.setProperty('--y2', y2 + 'px');
        emoji.style.setProperty('--r1', rot1 + 'deg');
        emoji.style.setProperty('--r2', rot2 + 'deg');
        emoji.style.animationDelay = (Math.random() * 0.15) + 's';

        contenedor.appendChild(emoji);
    }

    setTimeout(() => contenedor.remove(), 1400);
}

function agregarAlCarrito(producto, cantidadTipo) {
    const tiendaOrigen = tiendas.find(t => t.id == producto.tiendaId);
    if (tiendaOrigen) {
        const status = checkStoreStatus(tiendaOrigen.horario);
        if (!status.isOpen) {
            mostrarNotificacion(`Esta tienda está cerrada hoy. Horario: ${getHorarioHoy(tiendaOrigen.horario)}`, 'error');
            return;
        }
    }

    const carritoVacio = carrito.length === 0;

    // ★★★ EVENTO GOOGLE ANALYTICS: agregar_carrito ★★★
    if (typeof gtag === 'function') {
        gtag('event', 'agregar_carrito', {
            'event_category': 'ecommerce',
            'event_label': producto.nombre || 'producto_sin_nombre',
            'producto_id': producto.id,
            'precio': producto.precio,
            'tienda': producto.tiendaNombre || 'sin_tienda'
        });
    }

    const item = {
        id: producto.id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        cantidadTipo: cantidadTipo,
        cantidad: 1,
        subtotal: producto.precio,
        tiendaId: producto.tiendaId || null,
        tiendaNombre: producto.tiendaNombre || null
    };

    const existente = carrito.find(i => i.id === item.id && i.cantidadTipo === item.cantidadTipo);
    if (existente) {
        existente.cantidad++;
        existente.subtotal = existente.precioUnitario * existente.cantidad;
    } else {
        carrito.push(item);
    }

    guardarCarrito(carrito);
    actualizarCarritoUI();
    mostrarNotificacion(`${producto.nombre} agregado al carrito`);

    if (carritoVacio) {
        crearExplosionComida();
    }

    const botones = document.querySelectorAll('.btn-agregar-unidad');
    botones.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`"id":${producto.id}`)) {
            const textoOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Listo!';
            btn.style.background = '#28a745';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = textoOriginal;
                btn.style.background = '';
                btn.disabled = false;
            }, 1500);
        }
    });

    const cartFloat = document.getElementById("cart-float");
    if (cartFloat) {
        cartFloat.classList.add("pulse");
        if (carritoVacio) {
            cartFloat.classList.add("aparecer-con-fiesta");
            setTimeout(() => cartFloat.classList.remove("aparecer-con-fiesta"), 1000);
        }
        setTimeout(() => cartFloat.classList.remove("pulse"), 500);
    }
}

function actualizarCarritoUI() {
    const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
    const btnVaciar = document.getElementById('btn-vaciar');
    if (btnVaciar) btnVaciar.style.display = totalItems > 0 ? 'block' : 'none';
    const cartFloat = document.getElementById("cart-float");
    const cartCounter = document.getElementById("cart-counter");

    if (totalItems > 0) {
        cartFloat?.classList.add("visible");
        if (cartCounter) cartCounter.innerText = totalItems;
    } else {
        cartFloat?.classList.remove("visible");
    }

    const cartItemsDiv = document.getElementById("cart-items");
    if (cartItemsDiv) {
        if (carrito.length === 0) {
            cartItemsDiv.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-basket"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
        } else {
            cartItemsDiv.innerHTML = carrito.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.nombre}</div>
                        ${item.tiendaNombre ? `<div class="cart-item-detail"><i class="fas fa-store" style="color:var(--secondary);margin-right:4px;font-size:.7rem"></i>${item.tiendaNombre}</div>` : ''}
                        <div class="cart-item-detail">${item.cantidad} unidad${item.cantidad > 1 ? 'es' : ''}</div>
                        <div class="cart-item-detail">${formatearPrecio(item.precioUnitario)} c/u</div>
                    </div>
                    <div class="cart-item-actions">
                        <div class="cart-item-price">${formatearPrecio(item.subtotal)}</div>
                        <div class="cart-item-controls">
                            <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, -1)"><i class="fas fa-minus"></i></button>
                            <span>${item.cantidad}</span>
                            <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, 1)"><i class="fas fa-plus"></i></button>
                            <button class="btn-eliminar" onclick="eliminarDelCarrito(${idx})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
    const envio = calcularEnvio(carrito);
    const total = subtotal + envio;
    const recargo = descripcionRecargo(carrito);

    const totalPriceEl = document.getElementById("cart-total-price");
    if (totalPriceEl) {
        const recargoHtml = recargo
            ? ` <span style="color:var(--primary);font-size:0.75rem;font-weight:600;">${recargo}</span>`
            : '';
        totalPriceEl.innerHTML = `${formatearPrecio(total)} <small>(envío: ${formatearPrecio(envio)})</small>${recargoHtml}`;
    }
}

function cambiarCantidad(index, cambio) {
    const item = carrito[index];
    item.cantidad += cambio;
    if (item.cantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }
    item.subtotal = item.precioUnitario * item.cantidad;
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

function irACheckout() {
    if (carrito.length === 0) {
        mostrarNotificacion("Tu carrito está vacío", "error");
        return;
    }
    window.location.href = "checkout.html";
}

function vaciarCarrito() {
    if (!confirm('¿Vaciar todo el carrito?')) return;
    carrito = [];
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

function filtrarProductos(texto) {
    const termino = texto.toLowerCase().trim();
    const cards = document.querySelectorAll('#menu-grid-container .product-card');
    const resultado = document.getElementById('resultado-busqueda');
    let visibles = 0;

    cards.forEach(card => {
        const nombre = card.querySelector('h4')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.product-desc')?.textContent.toLowerCase() || '';
        const coincide = nombre.includes(termino) || desc.includes(termino);
        card.style.display = coincide ? '' : 'none';
        if (coincide) visibles++;
    });

    if (termino === '') {
        resultado.style.display = 'none';
    } else {
        resultado.style.display = 'block';
        resultado.textContent = visibles === 0
            ? 'No se encontraron productos'
            : `${visibles} resultado${visibles !== 1 ? 's' : ''} para "${texto}"`;
    }
}

// ============================================
// ★ NUEVAS FUNCIONES PARA LEER EL HORARIO JSON ★
// ============================================

// Devuelve la clave del día actual (mon, tue, wed, etc.) basado en hora de Colombia
function getDayKey() {
    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const dayIndex = colombiaTime.getDay(); // 0=Dom, 1=Lun, ...
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[dayIndex];
}

// Devuelve el horario de hoy en texto legible, interpretando el JSON
function getHorarioHoy(horario) {
    if (!horario) return "11:00-22:00"; // Por defecto

    // Si es el formato nuevo (JSON)
    if (typeof horario === 'string' && horario.trim().startsWith('{')) {
        try {
            // Limpiar el JSON por si tiene comillas raras o sin comillas en las claves
            let cleanHorario = horario.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"');
            const obj = JSON.parse(cleanHorario);
            const todayKey = getDayKey();
            return obj[todayKey] || "Cerrado";
        } catch (e) {
            return horario; // Si falla el parseo, mostramos el texto original
        }
    }
    return horario; // Si es formato viejo (ej: "11am - 10pm")
}

// ============================================
// FUNCIÓN DE ESTADO DE TIENDA (ACTUALIZADA PARA JSON)
// ============================================
function checkStoreStatus(horario) {
    const horarioHoy = getHorarioHoy(horario);

    // Si hoy está cerrado
    if (!horarioHoy || horarioHoy.toLowerCase() === 'cerrado' || !horarioHoy.includes('-')) {
        return { isOpen: false, nextOpening: "Cerrado hoy" };
    }

    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const currentHours = colombiaTime.getHours();
    const currentMinutes = colombiaTime.getMinutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    const [startStr, endStr] = horarioHoy.split('-');
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startTimeInMinutes = (startH * 60) + startM;
    const endTimeInMinutes = (endH * 60) + endM;

    let isOpen = false;

    if (endTimeInMinutes > startTimeInMinutes) {
        // Horario normal (ej: 08:00 - 22:00)
        isOpen = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    } else {
        // Cruza medianoche (ej: 20:00 - 06:00)
        isOpen = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
    }

    const nextOpening = isOpen ? "" : `Abre a las ${startStr.trim()}`;
    return { isOpen, nextOpening };
}

// ============================================
// ZONE AUTOCOMPLETE - BUSCADOR DE ZONAS
// ============================================

const ZONAS = Object.entries(APP_CONFIG.zonas).map(([id, data]) => ({
    id: id,
    nombre: data.nombre,
    envio: data.envio
})).sort((a, b) => a.nombre.localeCompare(b.nombre));

let _zonaSeleccionada = null;
let _highlightedIndex = -1;

function _resaltarTexto(texto, termino) {
    if (!termino) return texto;
    var terminoEscapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + terminoEscapado + ')', 'gi');
    return texto.replace(regex, '<mark>$1</mark>');
}

// ============================================
// AUTOCOMPLETE PARA INDEX (Hero)
// ============================================
function initZoneAutocomplete() {
    const input = document.getElementById('zone-input');
    const hiddenInput = document.getElementById('zone-select');
    const dropdown = document.getElementById('zone-dropdown');
    const clearBtn = document.getElementById('zone-clear-btn');

    if (!input || !hiddenInput || !dropdown) return;

    const zonaGuardada = localStorage.getItem('zonaSeleccionada');
    if (zonaGuardada) {
        const zona = ZONAS.find(z => z.id === zonaGuardada);
        if (zona) {
            _seleccionarZona(zona, false);
        }
        if (typeof APP_CONFIG !== 'undefined') {
            APP_CONFIG.zonaActual = zonaGuardada;
        }
    }

    input.addEventListener('focus', function () {
        if (_zonaSeleccionada) {
            input.value = '';
        }
        _mostrarDropdown(input.value);
    });

    input.addEventListener('input', function () {
        _mostrarDropdown(input.value);
    });

    input.addEventListener('blur', function () {
        setTimeout(() => {
            _cerrarDropdown();
            if (_zonaSeleccionada && !input.value.trim()) {
                input.value = '📍 ' + _zonaSeleccionada.nombre + ' - Envío $' + _zonaSeleccionada.envio.toLocaleString('es-CO');
            }
            if (clearBtn) {
                clearBtn.classList.toggle('visible', _zonaSeleccionada !== null);
            }
        }, 200);
    });

    input.addEventListener('keydown', function (e) {
        const options = dropdown.querySelectorAll('.zone-option:not(.zone-no-results)');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _highlightedIndex = Math.min(_highlightedIndex + 1, options.length - 1);
            _actualizarHighlight(options);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            _highlightedIndex = Math.max(_highlightedIndex - 1, 0);
            _actualizarHighlight(options);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (_highlightedIndex >= 0 && options[_highlightedIndex]) {
                options[_highlightedIndex].click();
            }
        } else if (e.key === 'Escape') {
            _cerrarDropdown();
            input.blur();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            _zonaSeleccionada = null;
            input.value = '';
            hiddenInput.value = '';
            if (typeof APP_CONFIG !== 'undefined') {
                APP_CONFIG.zonaActual = '';
            }
            localStorage.removeItem('zonaSeleccionada');
            clearBtn.classList.remove('visible');
            if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
            input.focus();
        });
    }

    document.addEventListener('click', function (e) {
        const autocomplete = document.getElementById('zone-autocomplete');
        if (autocomplete && !autocomplete.contains(e.target)) {
            _cerrarDropdown();
        }
    });

    hiddenInput.addEventListener('change', function (e) {
        if (typeof APP_CONFIG !== 'undefined') {
            APP_CONFIG.zonaActual = e.target.value;
        }
        localStorage.setItem('zonaSeleccionada', e.target.value);
        if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
    });
}

function _mostrarDropdown(termino) {
    const dropdown = document.getElementById('zone-dropdown');
    if (!dropdown) return;

    const terminoLower = termino.toLowerCase().trim();
    let zonasFiltradas = ZONAS;

    if (terminoLower) {
        zonasFiltradas = ZONAS.filter(z =>
            z.nombre.toLowerCase().includes(terminoLower) ||
            z.id.toLowerCase().includes(terminoLower)
        );
    }

    _highlightedIndex = -1;

    if (zonasFiltradas.length === 0) {
        dropdown.innerHTML =
            '<div class="zone-no-results">' +
            '<i class="fas fa-map-marker-alt"></i>' +
            'No hay zonas que coincidan con "' + termino + '"' +
            '</div>';
    } else {
        dropdown.innerHTML = zonasFiltradas.map(function (zona) {
            return '<div class="zone-option" data-zone-id="' + zona.id + '" ' +
                'onclick="_seleccionarZona(ZONAS.find(function(z){return z.id===\'' + zona.id + '\'}), true)">' +
                '<span class="zone-option-name">' + _resaltarTexto(zona.nombre, terminoLower) + '</span>' +
                '<span class="zone-option-price">Envío $' + zona.envio.toLocaleString('es-CO') + '</span>' +
                '</div>';
        }).join('');
    }

    dropdown.classList.add('active');
}

function _cerrarDropdown() {
    const dropdown = document.getElementById('zone-dropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
        _highlightedIndex = -1;
    }
}

function _seleccionarZona(zona, actualizar) {
    const input = document.getElementById('zone-input');
    const hiddenInput = document.getElementById('zone-select');
    const clearBtn = document.getElementById('zone-clear-btn');

    _zonaSeleccionada = zona;

    if (input) {
        input.value = '📍 ' + zona.nombre + ' - Envío $' + zona.envio.toLocaleString('es-CO');
    }
    if (hiddenInput) {
        hiddenInput.value = zona.id;
    }
    if (clearBtn) {
        clearBtn.classList.add('visible');
    }

    if (typeof APP_CONFIG !== 'undefined') {
        APP_CONFIG.zonaActual = zona.id;
    }
    localStorage.setItem('zonaSeleccionada', zona.id);

    _cerrarDropdown();

    if (actualizar) {
        if (hiddenInput) {
            hiddenInput.dispatchEvent(new Event('change'));
        }
        if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
    }
}

function _actualizarHighlight(options) {
    options.forEach(function (opt, idx) {
        if (idx === _highlightedIndex) {
            opt.classList.add('highlighted');
            opt.scrollIntoView({ block: 'nearest' });
        } else {
            opt.classList.remove('highlighted');
        }
    });
}

// ============================================
// AUTOCOMPLETE PARA CHECKOUT
// ============================================

let _checkoutZonaSeleccionada = null;
let _checkoutHighlightedIndex = -1;

function initZoneAutocompleteCheckout() {
    const input = document.getElementById('zona-checkout-input');
    const hiddenInput = document.getElementById('zona-checkout');
    const dropdown = document.getElementById('zone-dropdown-checkout');
    const clearBtn = document.getElementById('zone-clear-btn-checkout');
    const errorMsg = document.getElementById('zona-checkout-error');

    if (!input || !hiddenInput || !dropdown) return;

    const zonaGuardada = localStorage.getItem('zonaSeleccionada');
    if (zonaGuardada) {
        const zona = ZONAS.find(z => z.id === zonaGuardada);
        if (zona) {
            _checkoutZonaSeleccionada = zona;
            input.value = '📍 ' + zona.nombre + ' - Envío $' + zona.envio.toLocaleString('es-CO');
            hiddenInput.value = zona.id;
            if (clearBtn) clearBtn.classList.add('visible');
        }
        if (typeof APP_CONFIG !== 'undefined') {
            APP_CONFIG.zonaActual = zonaGuardada;
        }
    }

    input.addEventListener('focus', function () {
        if (_checkoutZonaSeleccionada) {
            input.value = '';
        }
        if (errorMsg) {
            errorMsg.style.display = 'none';
            input.classList.remove('input-error');
        }
        _mostrarDropdownCheckout(input.value);
    });

    input.addEventListener('input', function () {
        _mostrarDropdownCheckout(input.value);
    });

    input.addEventListener('blur', function () {
        setTimeout(function () {
            dropdown.classList.remove('active');
            _checkoutHighlightedIndex = -1;
            if (_checkoutZonaSeleccionada && !input.value.trim()) {
                input.value = '📍 ' + _checkoutZonaSeleccionada.nombre + ' - Envío $' + _checkoutZonaSeleccionada.envio.toLocaleString('es-CO');
            }
            if (clearBtn) {
                clearBtn.classList.toggle('visible', _checkoutZonaSeleccionada !== null);
            }
        }, 200);
    });

    input.addEventListener('keydown', function (e) {
        const options = dropdown.querySelectorAll('.zone-option:not(.zone-no-results)');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _checkoutHighlightedIndex = Math.min(_checkoutHighlightedIndex + 1, options.length - 1);
            _actualizarHighlightCheckout(options);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            _checkoutHighlightedIndex = Math.max(_checkoutHighlightedIndex - 1, 0);
            _actualizarHighlightCheckout(options);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (_highlightedIndex >= 0 && options[_highlightedIndex]) {
                options[_highlightedIndex].click();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('active');
            input.blur();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            _checkoutZonaSeleccionada = null;
            input.value = '';
            hiddenInput.value = '';
            if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = '';
            localStorage.removeItem('zonaSeleccionada');
            clearBtn.classList.remove('visible');
            if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
            input.focus();
        });
    }

    document.addEventListener('click', function (e) {
        const container = document.getElementById('zone-autocomplete-checkout');
        if (container && !container.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function _mostrarDropdownCheckout(termino) {
    const dropdown = document.getElementById('zone-dropdown-checkout');
    if (!dropdown) return;

    const terminoLower = termino.toLowerCase().trim();
    let zonasFiltradas = ZONAS;

    if (terminoLower) {
        zonasFiltradas = ZONAS.filter(function (z) {
            return z.nombre.toLowerCase().includes(terminoLower) || z.id.toLowerCase().includes(terminoLower);
        });
    }

    _checkoutHighlightedIndex = -1;

    if (zonasFiltradas.length === 0) {
        dropdown.innerHTML =
            '<div class="zone-no-results">' +
            '<i class="fas fa-map-marker-alt"></i>' +
            'No hay zonas que coincidan con "' + termino + '"' +
            '</div>';
    } else {
        dropdown.innerHTML = zonasFiltradas.map(function (zona) {
            return '<div class="zone-option" data-zone-id="' + zona.id + '" ' +
                'onclick="_seleccionarZonaCheckout(\'' + zona.id + '\')">' +
                '<span class="zone-option-name">' + _resaltarTexto(zona.nombre, terminoLower) + '</span>' +
                '<span class="zone-option-price">Envío $' + zona.envio.toLocaleString('es-CO') + '</span>' +
                '</div>';
        }).join('');
    }

    dropdown.classList.add('active');
}

function _actualizarHighlightCheckout(options) {
    options.forEach(function (opt, idx) {
        if (idx === _checkoutHighlightedIndex) {
            opt.classList.add('highlighted');
            opt.scrollIntoView({ block: 'nearest' });
        } else {
            opt.classList.remove('highlighted');
        }
    });
}

function _seleccionarZonaCheckout(zonaId) {
    const input = document.getElementById('zona-checkout-input');
    const hiddenInput = document.getElementById('zona-checkout');
    const dropdown = document.getElementById('zone-dropdown-checkout');
    const clearBtn = document.getElementById('zone-clear-btn-checkout');
    const errorMsg = document.getElementById('zona-checkout-error');

    const zona = ZONAS.find(function (z) { return z.id === zonaId; });
    if (!zona) return;

    _checkoutZonaSeleccionada = zona;
    input.value = '📍 ' + zona.nombre + ' - Envío $' + zona.envio.toLocaleString('es-CO');
    hiddenInput.value = zona.id;

    if (clearBtn) clearBtn.classList.add('visible');
    if (errorMsg) {
        errorMsg.style.display = 'none';
        input.classList.remove('input-error');
    }

    if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = zona.id;
    localStorage.setItem('zonaSeleccionada', zona.id);

    dropdown.classList.remove('active');

    hiddenInput.dispatchEvent(new Event('change'));
    if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
}