// ============================================
// client.js - FUSIÓN DOCUMENTADA
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
        // Añadimos ?v=timestamp para evitar que el navegador cachee el JSON viejo estrictamente
        const res = await fetch(`${CATALOGO_URL}?v=${Date.now()}`);
        const data = await res.json();

        // El JSON tiene la estructura { version: "...", tiendas: [...] }
        tiendas = data.tiendas || [];

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
// renderizarTiendas() - Ajustado para rating y estado (Abierto/Cerrado)
// ============================================ 
// ============================================
// renderizarTiendas() - Ajustado: Abiertas primero, luego por rating
// ============================================ 
function renderizarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    // ★ NUEVA LÓGICA DE ORDENAMIENTO ★
    tiendas.sort((a, b) => {
        const statusA = checkStoreStatus(a.horario);
        const statusB = checkStoreStatus(b.horario);

        // 1 significa abierta, 0 significa cerrada
        const isOpenA = statusA.isOpen ? 1 : 0;
        const isOpenB = statusB.isOpen ? 1 : 0;

        // Si una está abierta y la otra cerrada, la abierta (1) va primero
        if (isOpenB !== isOpenA) {
            return isOpenB - isOpenA;
        }

        // Si ambas están abiertas o ambas están cerradas, ordenamos por rating
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

        // ★ LÓGICA DE TIENDA CERRADA ★
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
                <p><i class="fas fa-clock"></i> ${tienda.horario || "11:00-22:00"}</p>
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
    container.innerHTML = `
        <div style="text-align:center; padding: 4rem 0; width:100%;">
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <p style="color: var(--gray);">Cargando el Menú...</p>
        </div>
    `;

    // Buscamos la tienda y sus productos directamente en la variable global (cero peticiones)
    const tienda = tiendas.find(t => t.id == tiendaId);

    if (!tienda) {
        mostrarNotificacion("Tienda no encontrada", "error");
        cargarTiendas();
        return;
    }

    // Los productos ya vienen anidados dentro de la tienda en el JSON
    const productos = tienda.productos || [];

    // Filtro: quita objetos vacíos
    const productosValidos = productos.filter(p => p.id && p.id !== '' && p.nombre);

    if (productosValidos.length === 0) {
        container.innerHTML = `
            <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
            <div class="menu-header"><h2>${tienda.nombre}</h2></div>
            <div class="empty-state"><i class="fas fa-box-open"></i><p>Esta tienda aún no tiene productos</p></div>
        `;
        return;
    }

    // ★ Obtener el estado de la tienda para bloquear el botón si está cerrada ★
    const status = checkStoreStatus(tienda.horario);

    let productosHTML = productosValidos.map(p => {
        // ★ INYECTAR tiendaId y tiendaNombre para el carrito (ya que no vienen en el JSON anidado)
        p.tiendaId = tienda.id;
        p.tiendaNombre = tienda.nombre;

        const imagenUrl = (p.imagen_url || p.icono || '').trim();
        const tieneImagen = imagenUrl && imagenUrl !== 'null' && imagenUrl !== 'undefined';

        // ★ LÓGICA DE BOTÓN SEGÚN ESTADO ★
        let botonHTML;
        if (!status.isOpen) {
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Esta tienda está cerrada. Horario: ${tienda.horario}', 'error')">
                <i class="fas fa-clock"></i> Cerrado
            </button>`;
        } else {
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
            <h2>${tienda.nombre}</h2>
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
    // ★ SEGURIDAD: Verificar si la tienda está cerrada antes de agregar ★
    const tiendaOrigen = tiendas.find(t => t.id == producto.tiendaId);
    if (tiendaOrigen) {
        const status = checkStoreStatus(tiendaOrigen.horario);
        if (!status.isOpen) {
            mostrarNotificacion(`Esta tienda está cerrada. Horario: ${tiendaOrigen.horario}`, 'error');
            return; // Bloquea la inserción al carrito
        }
    }

    const carritoVacio = carrito.length === 0;

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
// FUNCIÓN DE ESTADO DE TIENDA (ABIERTA/CERRADA)
// ============================================
function checkStoreStatus(horario) {
    if (!horario || !horario.includes('-')) {
        return { isOpen: true, nextOpening: "" }; // Si no hay horario, asumimos abierta
    }

    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const currentHours = colombiaTime.getHours();
    const currentMinutes = colombiaTime.getMinutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    const [startStr, endStr] = horario.split('-');
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startTimeInMinutes = (startH * 60) + startM;
    const endTimeInMinutes = (endH * 60) + endM;

    let isOpen = false;

    if (endTimeInMinutes > startTimeInMinutes) {
        isOpen = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    } else {
        isOpen = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
    }

    const nextOpening = isOpen ? "" : `Abre a las ${startStr}`;

    return { isOpen, nextOpening };
}