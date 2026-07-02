// ============================================
// client.js - FUSIÓN DOCUMENTADA Y ACTUALIZADA
// Incluye: Horario JSON, Autocomplete, Carrito, Analíticas, Categorías
// ★ ACTUALIZADO: Menú deslizable filtra productos globales por categoría
// ★ CORREGIDO: Íconos dinámicos según el nombre de la categoría
// ★ MEJORADO: Categorías con orden prioritario y "Otras" al final
// ============================================

let tiendas = [];
let carrito = [];

// ★ VARIABLES GLOBALES DE CATEGORÍAS Y PRODUCTOS ★
let categoriaActiva = 'Todas';
let productosGlobal = []; // Lista plana de todos los productos (viene del JSON)

document.addEventListener("DOMContentLoaded", () => {
    carrito = obtenerCarrito();
    inicializarEventos();
    if (document.getElementById("stores-grid")) cargarTiendas();

    // ★ Inicializar flechas del menú de categorías ★
    const scrollLeft = document.getElementById('scroll-left');
    const scrollRight = document.getElementById('scroll-right');
    const scrollContainer = document.getElementById('categories-scroll');
    if(scrollLeft) scrollLeft.addEventListener('click', () => scrollContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    if(scrollRight) scrollRight.addEventListener('click', () => scrollContainer.scrollBy({ left: 200, behavior: 'smooth' }));
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

// ★★★ FUNCIÓN MEJORADA: Carga con Reintentos Silenciosos y Categorías ★★★
async function cargarTiendas(reintentos = 3) {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    if (reintentos === 3) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="spinner" style="margin: 0 auto 1rem;"></div>
                <p style="color: var(--gray);">Conectando con las tiendas...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(`${CATALOGO_URL}?v=${Date.now()}`);
        if (!res.ok) throw new Error("Error en la red");
        
        const data = await res.json();
        tiendas = data.tiendas || [];
        
        // ★ NUEVO: Cargar productos globales y categorías ★
        productosGlobal = data.productosGlobal || [];
        const catsEnJSON = [...new Set(productosGlobal.map(p => p.categoria).filter(c => c && c.trim() !== ''))];
        renderizarCategorias(catsEnJSON);

        // ★ Restablecer la vista principal ★
        resetMainViewUI();

        renderizarTiendas();
    } catch (error) {
        console.error("Error cargando catálogo estático", error);
        if (reintentos > 0) {
            setTimeout(() => cargarTiendas(reintentos - 1), 1500);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store-slash"></i>
                    <p>No hay conexión con el servidor.</p>
                    <button onclick="cargarTiendas()" class="btn-retry">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

// ★ NUEVO: Restablecer la interfaz a la vista de tiendas ★
function resetMainViewUI() {
    const categoriesWrapper = document.getElementById('categories-wrapper');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const storesGrid = document.getElementById('stores-grid');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const tituloPrincipal = document.getElementById('main-title');

    if (categoriesWrapper) categoriesWrapper.style.display = 'flex';
    if (contenedorAnuncios) contenedorAnuncios.style.display = 'grid';
    if (storesGrid) storesGrid.style.display = '';
    if (catProductosGrid) catProductosGrid.style.display = 'none';
    if (tituloPrincipal) tituloPrincipal.innerHTML = `<i class="fas fa-store"></i> Tiendas`;
}

// ============================================
// SISTEMA DE CATEGORÍAS (CON ORDEN PRIORITARIO Y "OTRAS" AL FINAL)
// ============================================
function renderizarCategorias(categoriasDesdeJSON) {
    const contenedor = document.getElementById('categories-scroll');
    if (!contenedor) return;

    // 1. DEFINIR EL ORDEN DE PRIORIDAD (Puedes modificar este orden a tu gusto)
    const prioridad = [
        'Comida', 
        'Almuerzo', 
        'Bebidas', 
        'Licores', 
        'Cervezas', 
        'Farmacia'
    ];

    // 2. SEPARAR "Otras" de las demás
    let categoriaOtras = null;
    let categoriasRestantes = [];

    categoriasDesdeJSON.forEach(cat => {
        if (cat.toLowerCase().trim() === 'otras') {
            categoriaOtras = cat; // La guardamos aparte
        } else {
            categoriasRestantes.push(cat);
        }
    });

    // 3. ORDENAR: Agregamos las prioritarias que existan, luego las que no están en la lista
    let categoriasOrdenadas = [];

    // Añadir las prioritarias (si vienen del JSON)
    prioridad.forEach(prio => {
        const encontrada = categoriasRestantes.find(cat => cat.toLowerCase() === prio.toLowerCase());
        if (encontrada) {
            categoriasOrdenadas.push(encontrada);
        }
    });

    // Añadir las categorías del JSON que no estaban en la lista de prioridad
    categoriasRestantes.forEach(cat => {
        if (!categoriasOrdenadas.includes(cat)) {
            categoriasOrdenadas.push(cat);
        }
    });

    // 4. PONER "Otras" AL FINAL (si existió)
    if (categoriaOtras) {
        categoriasOrdenadas.push(categoriaOtras);
    }

    // 5. AGREGAR "TODAS" AL INICIO y construir el HTML
    let listaFinal = ['Todas', ...categoriasOrdenadas];

    contenedor.innerHTML = listaFinal.map(cat => {
        // Lógica para el nombre del ícono (minúsculas, sin espacios ni tildes)
        let nombreArchivo = cat.toLowerCase()
                               .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                               .replace(/\s+/g, ''); 
        
        let iconoUrl = `assets/img/categorias/${nombreArchivo}.png`; 

        const claseActiva = cat === categoriaActiva ? 'active' : '';
        
        return `
        <div class="category-item ${claseActiva}" onclick="filtrarPorCategoria('${cat}', this)">
            <div class="category-icon">
                <img src="${iconoUrl}" alt="${cat}" onerror="this.onerror=null; this.src='assets/img/tienda-error.png';">
            </div>
            <span>${cat}</span>
        </div>`;
    }).join('');
}

function filtrarPorCategoria(nombreCategoria, elemento) {
    categoriaActiva = nombreCategoria;
    
    // Actualizar clase activa visual
    document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
    if (elemento) elemento.classList.add('active');

    if (categoriaActiva === 'Todas') {
        volverATiendas();
    } else {
        mostrarProductosPorCategoria();
    }
}

function mostrarProductosPorCategoria() {
    const storesGrid = document.getElementById('stores-grid');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const tituloPrincipal = document.getElementById('main-title');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');

    // Ocultar tiendas y anuncios, mostrar productos
    if(storesGrid) storesGrid.style.display = 'none';
    if(contenedorAnuncios) contenedorAnuncios.style.display = 'none';
    if(catProductosGrid) catProductosGrid.style.display = 'block';
    
    // Cambiar título
    if(tituloPrincipal) tituloPrincipal.innerHTML = `<i class="fas fa-utensils"></i> ${categoriaActiva}`;

    // Filtrar productos de todas las tiendas
    const productosFiltrados = productosGlobal.filter(p => p.categoria === categoriaActiva);

    const container = document.getElementById('productos-por-categoria-container');
    if (!container) return;

    if (productosFiltrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos en esta categoría</p></div>`;
        return;
    }

    container.innerHTML = productosFiltrados.map(p => {
        const imagenUrl = (p.imagen_url || '').trim();
        const tieneImagen = imagenUrl && imagenUrl !== 'null' && imagenUrl !== 'undefined';
        const esAgotado = p.badge && p.badge.toLowerCase() === 'agotado';

        let botonHTML = `<button class="btn-agregar-unidad" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)"><i class="fas fa-plus"></i> Agregar</button>`;
        if (esAgotado) {
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Este producto está agotado por el momento', 'error')"><i class="fas fa-ban"></i> Agotado</button>`;
        }

        return `
        <div class="product-card">
            <div class="product-img ${tieneImagen ? 'con-imagen' : 'sin-imagen'}" ${tieneImagen ? `style="background-image: url('${imagenUrl}');"` : ''}>
                ${!tieneImagen ? `<i class="fas fa-utensils"></i>` : ''}
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
            </div>
            <div class="product-info">
                <h4> ${esc(p.nombre)}</h4>
                <p class="product-desc" style="color: var(--accent); font-weight: 600; font-size: 0.8rem; margin-bottom: 0.3rem;">
                    <i class="fas fa-store" style="font-size: 0.7rem;"></i> ${p.tiendaNombre || 'Sin tienda'}
                </p>
                <p class="product-desc">${p.descripcion || ''}</p>
                <div class="product-price">${formatearPrecio(p.precio)}</div>
                <div class="precio-unidad-container">${botonHTML}</div>
            </div>
        </div>`;
    }).join('');

        // ★ ARREGLO DE SCROLL: Sube justo hasta el menú de categorías, no hasta el logo
    requestAnimationFrame(() => {
        const targetElement = document.getElementById('categories-wrapper') || document.getElementById('main-title');
        if (targetElement) {
            const headerOffset = 85; // Altura del header fijo para que no lo tape
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
}

function volverATiendas() {
    const storesGrid = document.getElementById('stores-grid');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const tituloPrincipal = document.getElementById('main-title');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');

    // Mostrar tiendas y anuncios, ocultar productos
    if(storesGrid) storesGrid.style.display = '';
    if(contenedorAnuncios) contenedorAnuncios.style.display = 'grid';
    if(catProductosGrid) catProductosGrid.style.display = 'none';

    // Restablecer título
    if(tituloPrincipal) tituloPrincipal.innerHTML = `<i class="fas fa-store"></i> Tiendas`;

    // Restablecer categoría a Todas en el menú
    categoriaActiva = 'Todas';
    document.querySelectorAll('.category-item').forEach(item => {
        if(item.querySelector('span').innerText === 'Todas') item.classList.add('active');
        else item.classList.remove('active');
    });
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
        if (isOpenB !== isOpenA) return isOpenB - isOpenA;
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
                <h3> ${esc(tienda.nombre)}</h3>
                ${tieneDesc ? `<p class="store-desc"> ${esc(tienda.descripcion)}</p>` : ''}
                <p><i class="fas fa-map-marker-alt"></i>  ${esc(tienda.direccion)}</p>
                <p><i class="fas fa-clock"></i> Hoy: ${getHorarioHoy(tienda.horario)}</p>
                <div class="store-rating">${generarEstrellas(rating)}</div>
            </div>
        </div>
    `}).join('');
}

// ★★★ FUNCIÓN MEJORADA: Carga suave y sin saltos ★★★
async function verMenuTienda(tiendaId) {
    const container = document.getElementById("stores-grid");
    if (!container) return;

    // ★ Ocultar Categorías y Anuncios al ver el menú de la tienda ★
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const categoriesWrapper = document.getElementById('categories-wrapper');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    
    if (contenedorAnuncios) contenedorAnuncios.style.display = 'none';
    if (categoriesWrapper) categoriesWrapper.style.display = 'none';
    if (catProductosGrid) catProductosGrid.style.display = 'none';

    container.className = '';
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <p style="color: var(--gray);">Cargando menú...</p>
        </div>
    `;

    const tienda = tiendas.find(t => t.id == tiendaId);

    const tituloPrincipal = document.getElementById('main-title');
    if (tituloPrincipal && tienda) {
        tituloPrincipal.innerHTML = `<i class="fas fa-utensils"></i>  ${esc(tienda.nombre)}`;
    }

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
            <div class="menu-header"><p>${tienda.descripcion || ""}</p></div>
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
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Esta tienda está cerrada hoy. Horario: ${getHorarioHoy(tienda.horario)}', 'error')"><i class="fas fa-clock"></i> Cerrado</button>`;
        } else if (esAgotado) {
            botonHTML = `<button class="btn-agregar-unidad btn-cerrado-menu" onclick="event.stopPropagation(); mostrarNotificacion('Este producto está agotado por el momento', 'error')"><i class="fas fa-ban"></i> Agotado</button>`;
        } else {
            botonHTML = `<button class="btn-agregar-unidad" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)"><i class="fas fa-plus"></i> Agregar</button>`;
        }

        return `
        <div class="product-card">
            <div class="product-img ${tieneImagen ? 'con-imagen' : 'sin-imagen'}" ${tieneImagen ? `style="background-image: url('${imagenUrl}');"` : ''}>
                ${!tieneImagen ? `<i class="fas fa-utensils"></i>` : ''}
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
            </div>
            <div class="product-info">
                <h4> ${esc(p.nombre)}</h4>
                <p class="product-desc">${p.descripcion || ''}</p>
                <div class="product-price">${formatearPrecio(p.precio)}</div>
                <div class="precio-unidad-container">${botonHTML}</div>
            </div>
        </div>`;
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
                <input type="text" id="buscador-productos" placeholder="Buscar producto..." oninput="filtrarProductos(this.value)" style="width:100%;padding:.8rem 1rem .8rem 2.8rem;border:2px solid #e0e0e0;border-radius:50px;font-family:inherit;font-size:.95rem;outline:none;transition:border-color .2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e0e0e0'">
            </div>
            <p id="resultado-busqueda" style="text-align:center;color:var(--gray);font-size:.85rem;margin-top:.5rem;display:none;"></p>
        </div>
        <div class="menu-grid" id="menu-grid-container">${productosHTML}</div>
    `;

    // ★ ARREGLO DE SCROLL
    requestAnimationFrame(() => {
        const targetElement = document.getElementById('main-title');
        if (targetElement) {
            const headerOffset = 85;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
}

// ============================================
// EXPLOSIÓN DE COMIDA RÁPIDA 🍔🍟🍕
// ============================================
function crearExplosionComida() {
    if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100, 100]);

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
    mostrarNotificacion(` ${esc(producto.nombre)} agregado al carrito`);

    if (carritoVacio) crearExplosionComida();

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
            cartItemsDiv.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-basket"></i><p>Tu carrito está vacío</p></div>`;
        } else {
            cartItemsDiv.innerHTML = carrito.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name"> ${esc(item.nombre)}</div>
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
        const recargoHtml = recargo ? ` <span style="color:var(--primary);font-size:0.75rem;font-weight:600;">${recargo}</span>` : '';
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
        resultado.textContent = visibles === 0 ? 'No se encontraron productos' : `${visibles} resultado${visibles !== 1 ? 's' : ''} para "${texto}"`;
    }
}

// ============================================
// HORARIO JSON
// ============================================
function getDayKey() {
    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const dayIndex = colombiaTime.getDay();
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[dayIndex];
}

function getHorarioHoy(horario) {
    if (!horario) return "11:00-22:00";
    if (typeof horario === 'string' && horario.trim().startsWith('{')) {
        try {
            let cleanHorario = horario.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"');
            const obj = JSON.parse(cleanHorario);
            const todayKey = getDayKey();
            return obj[todayKey] || "Cerrado";
        } catch (e) {
            return horario;
        }
    }
    return horario;
}

function checkStoreStatus(horario) {
    const horarioHoy = getHorarioHoy(horario);
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
        isOpen = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    } else {
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

function initZoneAutocomplete() {
    const input = document.getElementById('zone-input');
    const hiddenInput = document.getElementById('zone-select');
    const dropdown = document.getElementById('zone-dropdown');
    const clearBtn = document.getElementById('zone-clear-btn');

    if (!input || !hiddenInput || !dropdown) return;

    const zonaGuardada = localStorage.getItem('zonaSeleccionada');
    if (zonaGuardada) {
        const zona = ZONAS.find(z => z.id === zonaGuardada);
        if (zona) _seleccionarZona(zona, false);
        if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = zonaGuardada;
    }

    input.addEventListener('focus', function () {
        if (_zonaSeleccionada) input.value = '';
        _mostrarDropdown(input.value);
    });

    input.addEventListener('input', function () { _mostrarDropdown(input.value); });

    input.addEventListener('blur', function () {
        setTimeout(() => {
            _cerrarDropdown();
            if (_zonaSeleccionada && !input.value.trim()) {
                input.value = '📍 ' + _zonaSeleccionada.nombre + ' - Envío $' + _zonaSeleccionada.envio.toLocaleString('es-CO');
            }
            if (clearBtn) clearBtn.classList.toggle('visible', _zonaSeleccionada !== null);
        }, 200);
    });

    input.addEventListener('keydown', function (e) {
        const options = dropdown.querySelectorAll('.zone-option:not(.zone-no-results)');
        if (e.key === 'ArrowDown') { e.preventDefault(); _highlightedIndex = Math.min(_highlightedIndex + 1, options.length - 1); _actualizarHighlight(options); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); _highlightedIndex = Math.max(_highlightedIndex - 1, 0); _actualizarHighlight(options); }
        else if (e.key === 'Enter') { e.preventDefault(); if (_highlightedIndex >= 0 && options[_highlightedIndex]) options[_highlightedIndex].click(); }
        else if (e.key === 'Escape') { _cerrarDropdown(); input.blur(); }
    });

    if (clearBtn) {
        clearBtn.addEventListener('mousedown', function (e) {
            e.preventDefault(); _zonaSeleccionada = null; input.value = ''; hiddenInput.value = '';
            if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = '';
            localStorage.removeItem('zonaSeleccionada'); clearBtn.classList.remove('visible');
            if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI(); input.focus();
        });
    }

    document.addEventListener('click', function (e) {
        const autocomplete = document.getElementById('zone-autocomplete');
        if (autocomplete && !autocomplete.contains(e.target)) _cerrarDropdown();
    });

    hiddenInput.addEventListener('change', function (e) {
        if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = e.target.value;
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
        zonasFiltradas = ZONAS.filter(z => z.nombre.toLowerCase().includes(terminoLower) || z.id.toLowerCase().includes(terminoLower));
    }
    _highlightedIndex = -1;
    if (zonasFiltradas.length === 0) {
        dropdown.innerHTML = '<div class="zone-no-results"><i class="fas fa-map-marker-alt"></i>No hay zonas que coincidan con "' + termino + '"</div>';
    } else {
        dropdown.innerHTML = zonasFiltradas.map(function (zona) {
            return '<div class="zone-option" data-zone-id="' + zona.id + '" onclick="_seleccionarZona(ZONAS.find(function(z){return z.id===\'' + zona.id + '\'}), true)"><span class="zone-option-name">' + _resaltarTexto(zona.nombre, terminoLower) + '</span><span class="zone-option-price">Envío $' + zona.envio.toLocaleString('es-CO') + '</span></div>';
        }).join('');
    }
    dropdown.classList.add('active');
}

function _cerrarDropdown() {
    const dropdown = document.getElementById('zone-dropdown');
    if (dropdown) { dropdown.classList.remove('active'); _highlightedIndex = -1; }
}

function _seleccionarZona(zona, actualizar) {
    const input = document.getElementById('zone-input');
    const hiddenInput = document.getElementById('zone-select');
    const clearBtn = document.getElementById('zone-clear-btn');
    _zonaSeleccionada = zona;
    if (input) input.value = '📍 ' + zona.nombre + ' - Envío $' + zona.envio.toLocaleString('es-CO');
    if (hiddenInput) hiddenInput.value = zona.id;
    if (clearBtn) clearBtn.classList.add('visible');
    if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = zona.id;
    localStorage.setItem('zonaSeleccionada', zona.id);
    _cerrarDropdown();
    if (actualizar) {
        if (hiddenInput) hiddenInput.dispatchEvent(new Event('change'));
        if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
    }
}

function _actualizarHighlight(options) {
    options.forEach(function (opt, idx) {
        if (idx === _highlightedIndex) { opt.classList.add('highlighted'); opt.scrollIntoView({ block: 'nearest' }); }
        else { opt.classList.remove('highlighted'); }
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
        if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = zonaGuardada;
    }

    input.addEventListener('focus', function () {
        if (_checkoutZonaSeleccionada) input.value = '';
        if (errorMsg) { errorMsg.style.display = 'none'; input.classList.remove('input-error'); }
        _mostrarDropdownCheckout(input.value);
    });

    input.addEventListener('input', function () { _mostrarDropdownCheckout(input.value); });

    input.addEventListener('blur', function () {
        setTimeout(function () {
            dropdown.classList.remove('active'); _checkoutHighlightedIndex = -1;
            if (_checkoutZonaSeleccionada && !input.value.trim()) input.value = '📍 ' + _checkoutZonaSeleccionada.nombre + ' - Envío $' + _checkoutZonaSeleccionada.envio.toLocaleString('es-CO');
            if (clearBtn) clearBtn.classList.toggle('visible', _checkoutZonaSeleccionada !== null);
        }, 200);
    });

    input.addEventListener('keydown', function (e) {
        const options = dropdown.querySelectorAll('.zone-option:not(.zone-no-results)');
        if (e.key === 'ArrowDown') { e.preventDefault(); _checkoutHighlightedIndex = Math.min(_checkoutHighlightedIndex + 1, options.length - 1); _actualizarHighlightCheckout(options); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); _checkoutHighlightedIndex = Math.max(_checkoutHighlightedIndex - 1, 0); _actualizarHighlightCheckout(options); }
        else if (e.key === 'Enter') { e.preventDefault(); if (_highlightedIndex >= 0 && options[_highlightedIndex]) options[_highlightedIndex].click(); }
        else if (e.key === 'Escape') { dropdown.classList.remove('active'); input.blur(); }
    });

    if (clearBtn) {
        clearBtn.addEventListener('mousedown', function (e) {
            e.preventDefault(); _checkoutZonaSeleccionada = null; input.value = ''; hiddenInput.value = '';
            if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = '';
            localStorage.removeItem('zonaSeleccionada'); clearBtn.classList.remove('visible');
            if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI(); input.focus();
        });
    }

    document.addEventListener('click', function (e) {
        const container = document.getElementById('zone-autocomplete-checkout');
        if (container && !container.contains(e.target)) dropdown.classList.remove('active');
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
        dropdown.innerHTML = '<div class="zone-no-results"><i class="fas fa-map-marker-alt"></i>No hay zonas que coincidan con "' + termino + '"</div>';
    } else {
        dropdown.innerHTML = zonasFiltradas.map(function (zona) {
            return '<div class="zone-option" data-zone-id="' + zona.id + '" onclick="_seleccionarZonaCheckout(\'' + zona.id + '\')"><span class="zone-option-name">' + _resaltarTexto(zona.nombre, terminoLower) + '</span><span class="zone-option-price">Envío $' + zona.envio.toLocaleString('es-CO') + '</span></div>';
        }).join('');
    }
    dropdown.classList.add('active');
}

function _actualizarHighlightCheckout(options) {
    options.forEach(function (opt, idx) {
        if (idx === _checkoutHighlightedIndex) { opt.classList.add('highlighted'); opt.scrollIntoView({ block: 'nearest' }); }
        else { opt.classList.remove('highlighted'); }
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
    if (errorMsg) { errorMsg.style.display = 'none'; input.classList.remove('input-error'); }

    if (typeof APP_CONFIG !== 'undefined') APP_CONFIG.zonaActual = zona.id;
    localStorage.setItem('zonaSeleccionada', zona.id);

    dropdown.classList.remove('active');
    hiddenInput.dispatchEvent(new Event('change'));
    if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
}