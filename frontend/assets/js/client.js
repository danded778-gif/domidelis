// ============================================
// client.js - FUSIÓN DOCUMENTADA Y ACTUALIZADA v4.2
// Incluye: Horario JSON, Autocomplete, Carrito, Analíticas, Categorías
// ★ ACTUALIZADO: Menú deslizable filtra productos globales por categoría
// ★ CORREGIDO: Íconos dinámicos según el nombre de la categoría
// ★ MEJORADO: Categorías con orden prioritario y "Otras" al final
// ★ NUEVO v3: Modal de personalización con grupos dinámicos y Stepper (Cantidades)
// ★ CORREGIDO v4 (orden de categorías): Todas → Menú → Almuerzo → ... (todo scrollable)
//
// ★★★ NUEVO v4: TARJETA DE PRODUCTO HORIZONTAL ★★★
// - §4.1 NUEVA: crearTarjetaProducto() — plantilla ÚNICA que reemplaza
//   las 2 plantillas duplicadas (vista categoría + menú de tienda).
//   Clases pc-* → estilos en assets/css/product-card.css.
// - §4 y §5.1 ahora delegan el render de productos a esa función.
// - §6 agregarAlCarrito ahora RETORNA true/false (retrocompatible:
//   nadie usaba su retorno). Lo consume pcAgregar() para el
//   feedback "✓ Agregado" del botón.
// - INTACTO: tiendas, carrusel, destacados, paginador, carrito,
//   modal de personalización, zonas, horarios.
//
// ★★★ v4.2 — OPCIÓN B: DESCRIPCIÓN SOLO TRAS BOTÓN "INFO" ★★★
// - La descripción YA NO se muestra en la tarjeta. En su lugar hay
//   un botón "ⓘ Info" que la revela EN SITIO (pcToggleDesc).
// - Tarjetas 100% uniformes y compactas: el botón está presente
//   siempre que el producto tenga descripción (sin lógica de
//   ocultado por longitud → no existe pcAjustarBotonesInfo).
// - Producto SIN descripción → no se renderiza ni botón ni bloque.
// ============================================

let tiendas = [];
let carrito = [];

// ★ VARIABLES GLOBALES DE CATEGORÍAS Y PRODUCTOS ★
let categoriaActiva = 'Todas';
let productosGlobal = [];
let complementosGlobal = [];

// ★ VARIABLES GLOBALES PARA EL PAGINADOR ★
let currentPaginator = null;
let currentStoreProducts = [];

// Variable para el intervalo de scroll automático
let autoScrollTiendasInterval;

// ============================================
// 1. INICIALIZACIÓN PRINCIPAL Y ORDEN DE CARGA
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    carrito = obtenerCarrito();
    actualizarCarritoUI();
    inicializarEventos();

    const scrollLeft = document.getElementById('scroll-left');
    const scrollRight = document.getElementById('scroll-right');
    const scrollContainer = document.getElementById('categories-scroll');
    if (scrollLeft) scrollLeft.addEventListener('click', () => scrollContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    if (scrollRight) scrollRight.addEventListener('click', () => scrollContainer.scrollBy({ left: 200, behavior: 'smooth' }));

    if (document.getElementById("stores-grid")) {
        cargarTiendas();
    }
});

// ============================================
// 2. EVENTOS GLOBALES UI
// ============================================
function inicializarEventos() {
    const closeCart = document.getElementById("close-cart");
    const headerCart = document.getElementById("header-cart");
    const cartOverlay = document.getElementById("cart-overlay");
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    const mobileMenu = document.getElementById("mobile-menu");
    const navLinks = document.getElementById("nav-links");

    if (closeCart) closeCart.onclick = cerrarCarrito;
    if (headerCart) headerCart.onclick = abrirCarrito;
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

// ============================================
// 3. CARGA DE DATOS (CATÁLOGO ESTÁTICO)
// ============================================
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

        productosGlobal = data.productosGlobal || [];
        complementosGlobal = data.complementosGlobal || [];

        const catsEnJSON = [...new Set(productosGlobal.map(p => p.categoria).filter(c => c && c.trim() !== ''))];
        renderizarCategorias(catsEnJSON);

        resetMainViewUI();
        renderizarTiendas();
        renderizarProductosDestacados();
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

function resetMainViewUI() {
    const categoriesWrapper = document.getElementById('categories-wrapper');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const storesGrid = document.getElementById('stores-grid');
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    const tituloPrincipal = document.getElementById('main-title');

    if (categoriesWrapper) categoriesWrapper.style.display = 'flex';
    if (contenedorAnuncios) contenedorAnuncios.style.display = 'flex';
    if (storesGrid) {
        storesGrid.className = 'stores-grid-horizontal';
        storesGrid.style.display = 'flex';
        storesGrid.style.overflow = 'auto';
    }
    if (storesGridCerradas) storesGridCerradas.style.display = 'block';
    if (catProductosGrid) catProductosGrid.style.display = 'none';
    if (productosDestacadosGrid) productosDestacadosGrid.style.display = 'grid';
    if (tituloPrincipal) tituloPrincipal.innerHTML = ` 🔥 Populares en El Santuario`;
}

// ============================================
// 4. SISTEMA DE CATEGORÍAS (CON ORDEN CORREGIDO)
// ============================================
function renderizarCategorias(categoriasDesdeJSON) {
    const contenedor = document.getElementById('categories-scroll');
    if (!contenedor) return;

    // ★ NUEVA PRIORIDAD: Todas es la primera (se agrega manualmente), luego "Menú", "Almuerzo", etc.
    const prioridad = ['Menu', 'Almuerzo', 'Comida', 'Bebidas', 'Licores', 'Cervezas', 'Farmacia'];
    const normalizarCategoria = categoria => String(categoria)
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    let categoriaOtras = null;
    let categoriasRestantes = [];

    categoriasDesdeJSON.forEach(cat => {
        if (normalizarCategoria(cat) === 'otras') {
            categoriaOtras = cat;
        } else {
            categoriasRestantes.push(cat);
        }
    });

    // Ordenar las categorías según prioridad
    let categoriasOrdenadas = [];
    prioridad.forEach(prio => {
        const encontrada = categoriasRestantes.find(cat => normalizarCategoria(cat) === normalizarCategoria(prio));
        if (encontrada) {
            categoriasOrdenadas.push(encontrada);
            // Eliminar para que no se repita
            categoriasRestantes = categoriasRestantes.filter(cat => cat !== encontrada);
        }
    });

    // El resto de categorías (no priorizadas) se añaden al final (excepto "Otras")
    categoriasRestantes.forEach(cat => {
        if (normalizarCategoria(cat) !== 'otras') {
            categoriasOrdenadas.push(cat);
        }
    });

    // "Otras" al final del todo
    if (categoriaOtras) categoriasOrdenadas.push(categoriaOtras);

    // ★ CONSTRUIR LA LISTA FINAL: "Todas" al PRINCIPIO
    let listaFinal = ['Todas', ...categoriasOrdenadas];

    // ★ RENDERIZAR TODOS LOS ÍTEMS EN UN SOLO CONTENEDOR SCROLLABLE (SIN ELEMENTOS FIJOS)
    contenedor.innerHTML = listaFinal.map(cat => {
        let nombreArchivo = cat.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '');

        let iconoUrl = `assets/img/categorias/${nombreArchivo}.png`;
        const claseActiva = cat === categoriaActiva ? 'active' : '';

        return `
        <div class="category-item ${claseActiva}" onclick="filtrarPorCategoria('${cat}', event)">
            <div class="category-icon">
                <img src="${iconoUrl}" alt="${cat}" onerror="this.onerror=null; this.src='assets/img/tienda-error.png';">
            </div>
            <span>${cat}</span>
        </div>`;
    }).join('');

    // Asegurar que el contenedor sea scrollable horizontalmente
    contenedor.style.display = 'flex';
    contenedor.style.overflowX = 'auto';
    contenedor.style.gap = '0.5rem';
    contenedor.style.scrollBehavior = 'smooth';
    contenedor.style.webkitOverflowScrolling = 'touch';
}

function filtrarPorCategoria(nombreCategoria, e) {
    const elemento = e.currentTarget;
    categoriaActiva = nombreCategoria;

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
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    const tituloPrincipal = document.getElementById('main-title');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');

    if (storesGrid) {
        storesGrid.style.display = 'none';
        storesGrid.className = '';
    }
    if (storesGridCerradas) storesGridCerradas.style.display = 'none';
    if (productosDestacadosGrid) productosDestacadosGrid.style.display = 'none';
    if (contenedorAnuncios) contenedorAnuncios.style.display = 'none';

    if (catProductosGrid) catProductosGrid.style.display = 'block';

    if (tituloPrincipal) tituloPrincipal.innerHTML = `<i class="fas fa-utensils"></i> ${categoriaActiva}`;

    const productosFiltrados = productosGlobal.filter(p => p.categoria === categoriaActiva);
    const container = document.getElementById('productos-por-categoria-container');
    if (!container) return;

    if (productosFiltrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos en esta categoría</p></div>`;
        return;
    }

    // ★ v4: fallback de tiendaNombre — si el catálogo no trae el nombre,
    // se resuelve por tiendaId (mismo patrón que renderizarProductosDestacados).
    productosFiltrados.forEach(p => {
        if (!p.tiendaNombre && p.tiendaId) {
            const tienda = tiendas.find(t => t.id == p.tiendaId);
            if (tienda) p.tiendaNombre = tienda.nombre;
        }
    });

    // ★ v4: plantilla única (antes había una plantilla inline duplicada aquí).
    // mostrarTienda: true → en esta vista se mezclan productos de varias
    // tiendas, el chip con el nombre es información clave para el usuario.
    container.innerHTML = productosFiltrados
        .map(p => crearTarjetaProducto(p, { mostrarTienda: true }))
        .join('');

    requestAnimationFrame(() => {
        const targetElement = document.getElementById('categories-wrapper') || document.getElementById('main-title');
        if (targetElement) {
            const headerOffset = 85;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    });
}

function volverATiendas() {
    const storesGrid = document.getElementById('stores-grid');
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    const tituloPrincipal = document.getElementById('main-title');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');

    if (storesGrid) {
        storesGrid.className = 'stores-grid-horizontal';
        storesGrid.style.display = 'flex';
        storesGrid.style.overflow = 'auto';
    }
    if (storesGridCerradas) storesGridCerradas.style.display = 'block';
    if (productosDestacadosGrid) productosDestacadosGrid.style.display = 'grid';
    if (contenedorAnuncios) contenedorAnuncios.style.display = 'flex';

    if (catProductosGrid) catProductosGrid.style.display = 'none';

    if (tituloPrincipal) tituloPrincipal.innerHTML = ` 🔥 Populares en El Santuario`;

    categoriaActiva = 'Todas';
    document.querySelectorAll('.category-item').forEach(item => {
        if (item.querySelector('span').innerText === 'Todas') item.classList.add('active');
        else item.classList.remove('active');
    });

    if (autoScrollTiendasInterval) clearInterval(autoScrollTiendasInterval);
    if (storesGrid) {
        storesGrid.scrollLeft = 0;
        iniciarAutoScrollTiendas();
    }
}

// ============================================
// 4.1 TARJETA DE PRODUCTO HORIZONTAL (clases pc-*)
// ============================================
// Fuente de estilos: assets/css/product-card.css
//
// ★ QUÉ HACE ESTA SECCIÓN ★
// Una ÚNICA plantilla para las 2 vistas de producto:
//   · Vista por categoría  → crearTarjetaProducto(p, { mostrarTienda: true })
//   · Menú de tienda       → crearTarjetaProducto(p, { mostrarTienda: false,
//                               tiendaAbierta: status.isOpen, ... })
//
// ★ DEPENDENCIAS ★
//   - esc() / formatearPrecio() / mostrarNotificacion() → definidas
//     en archivos globales previos (toast.js / config.js)
//   - DomiModal (modal-personalizacion.js) — se chequea en tiempo
//     de render con window.DomiModal, igual que el código anterior
//
// ★ NO TOCAR SIN LEER ★
//   - id="prod-${p.id}": verProductoDestacado() hace scroll y
//     resaltado hacia ese id. Si se elimina, se rompe la navegación
//     desde la vitrina de destacados.
//   - El patrón onclick inline con JSON.stringify + &quot; es el
//     mismo que usaba el código anterior. Funciona porque el
//     navegador decodifica las entidades del atributo antes de
//     ejecutar el JS.
//
// ★ v4.2 — OPCIÓN B: estructura de la columna de info ★
//   <h4 class="pc-name">
//   [chip tienda — solo vista por categoría]
//   <div class="pc-desc-wrap">
//     <button class="pc-info-btn">ⓘ Info</button>  ← siempre visible
//     <p class="pc-desc">…texto…</p>               ← display:none;
//   </div>                                            se revela con
//   <div class="pc-footer">                          .pc-desc-expandida
//   El texto revelado NO tiene límite de líneas (revelación
//   deliberada del usuario). Ver §5.1 de product-card.css.
// ============================================

// ★ MAPA DE BADGES — ESPEJO EXACTO de la sección 4 de product-card.css ★
// El valor del campo "badge" del catálogo se normaliza
// (minúsculas, sin acentos, sin espacios) y se busca aquí.
//
// | valor normalizado | clase CSS           | color         | comportamiento           |
// |-------------------|---------------------|---------------|--------------------------|
// | agotado           | pc-badge--agotado   | gris          | BLOQUEA botón + img gris |
// | popular           | pc-badge--popular   | naranja (2do) | solo visual              |
// | masvendido        | pc-badge--vendido   | naranja (2do) | solo visual              |
// | nuevo             | pc-badge--nuevo     | verde (acc.)  | solo visual              |
// | (cualquier otro)  | pc-badge--default   | rojo (prim.)  | solo visual              |
//
// ★ PARA AGREGAR UN BADGE NUEVO (ej: "oferta"):
//   1. En product-card.css §4 → crear .pc-badge--oferta { background: ... }
//   2. Aquí abajo → agregar entrada: 'oferta': { clase: 'pc-badge--oferta' }
//   Son exactamente 2 pasos, documentados en ambos lados.
const PC_BADGES = {
    'agotado':    { clase: 'pc-badge--agotado' },
    'popular':    { clase: 'pc-badge--popular' },
    'masvendido': { clase: 'pc-badge--vendido' },
    'nuevo':      { clase: 'pc-badge--nuevo' }
    // Otros valores → fallback 'pc-badge--default' (rojo)
};

// Normaliza el valor del badge para el lookup del mapa.
// "Más Vendido" / "MAS VENDIDO" / "mas vendido" → "masvendido"
function pcNormalizarBadge(valor) {
    return String(valor || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // quita acentos
        .replace(/\s+/g, '');              // quita espacios
}

// Devuelve la clase CSS del badge según el mapa; 'default' si no existe.
function pcResolverClaseBadge(valor) {
    const clave = pcNormalizarBadge(valor);
    return (PC_BADGES[clave] && PC_BADGES[clave].clase) || 'pc-badge--default';
}

// ★ PLANTILLA ÚNICA DE TARJETA DE PRODUCTO ★
// p: producto con { id, nombre, descripcion, precio, imagen_url, icono,
//                   badge, tiendaId, tiendaNombre }
// opciones:
//   mostrarTienda  (bool, default false) → muestra chip con nombre de
//                   tienda (solo vista por categoría)
//   tiendaAbierta  (bool, default true)  → false = botón "Cerrado"
//                   (solo menú de tienda; en vista categoría NO se pasa
//                   y agregarAlCarrito valida el horario internamente,
//                   igual que el comportamiento anterior)
//   horarioTienda  (string)              → texto para la notificación
//                   del botón "Cerrado"
function crearTarjetaProducto(p, opciones = {}) {
    const mostrarTienda = opciones.mostrarTienda === true;
    const tiendaAbierta = opciones.tiendaAbierta !== false;
    const horarioTienda = opciones.horarioTienda || '';

    // Imagen: unificado con el menú de tienda — si no hay imagen_url,
    // se intenta con icono como fallback (antes solo el menú lo hacía).
    const imagenUrl = (p.imagen_url || p.icono || '').trim();
    const tieneImagen = imagenUrl && imagenUrl !== 'null' && imagenUrl !== 'undefined';

    // Badge: "agotado" normalizado es ESTADO FUNCIONAL (bloquea botón).
    // El resto de badges son solo visuales.
    const esAgotado = pcNormalizarBadge(p.badge) === 'agotado';

    const badgeHTML = p.badge
        ? `<span class="pc-badge ${pcResolverClaseBadge(p.badge)}">${esc(p.badge)}</span>`
        : '';

    // Chip de tienda — solo en vista por categoría (en el menú de la
    // propia tienda sería redundante)
    const tiendaChipHTML = mostrarTienda
        ? `<p class="pc-store"><i class="fas fa-store"></i><span>${esc(p.tiendaNombre || 'Sin tienda')}</span></p>`
        : '';

    // ★ v4.2 (Opción B): la descripción NO se muestra directamente en la
    // tarjeta. Se renderiza un botón "ⓘ Info" que la revela en sitio
    // (pcToggleDesc). Producto SIN descripción → ni botón ni bloque.
    const tieneDesc = p.descripcion && String(p.descripcion).trim() !== '';
    const descHTML = tieneDesc ? `
        <div class="pc-desc-wrap">
            <button type="button" class="pc-info-btn"
                    onclick="event.stopPropagation(); pcToggleDesc(this)"
                    title="Ver descripción del producto"
                    aria-label="Ver descripción del producto">
                <i class="fas fa-circle-info"></i> Info
            </button>
            <p class="pc-desc">${esc(p.descripcion)}</p>
        </div>` : '';

    // ★ BOTÓN — 4 estados (misma prioridad que el código anterior) ★
    // 1. Tienda cerrada (solo menú de tienda)
    // 2. Producto agotado
    // 3. Con complementos → abre DomiModal
    // 4. Normal → pcAgregar (agrega + feedback "✓ Agregado")
    const productoAttr = JSON.stringify(p).replace(/"/g, '&quot;');

    let botonHTML;
    if (!tiendaAbierta) {
        botonHTML = `<button class="pc-btn pc-btn--cerrado" onclick="event.stopPropagation(); mostrarNotificacion('Esta tienda está cerrada hoy. Horario: ${horarioTienda}', 'error')"><i class="fas fa-clock"></i> Cerrado</button>`;
    } else if (esAgotado) {
        botonHTML = `<button class="pc-btn pc-btn--agotado" onclick="event.stopPropagation(); mostrarNotificacion('Este producto está agotado por el momento', 'error')"><i class="fas fa-ban"></i> Agotado</button>`;
    } else {
        const tieneComplementos = (window.DomiModal && window.DomiModal.tieneComplementos(p.id));
        if (tieneComplementos) {
            botonHTML = `<button class="pc-btn" onclick="event.stopPropagation(); DomiModal.abrir(${productoAttr})"><i class="fas fa-plus"></i> Agregar</button>`;
        } else {
            botonHTML = `<button class="pc-btn" onclick="event.stopPropagation(); pcAgregar(this, ${productoAttr})"><i class="fas fa-plus"></i> Agregar</button>`;
        }
    }

    return `
    <div class="pc-card${esAgotado ? ' pc-agotado' : ''}" id="prod-${p.id}">
        <div class="pc-img ${tieneImagen ? 'pc-con-imagen' : 'pc-sin-imagen'}" ${tieneImagen ? `style="background-image: url('${imagenUrl}');"` : ''}>
            ${!tieneImagen ? '<i class="fas fa-utensils"></i>' : ''}
            ${badgeHTML}
        </div>
        <div class="pc-info">
            <h4 class="pc-name">${esc(p.nombre)}</h4>
            ${tiendaChipHTML}
            ${descHTML}
            <div class="pc-footer">
                <span class="pc-price">${formatearPrecio(p.precio)}</span>
                ${botonHTML}
            </div>
        </div>
    </div>`;
}

// ★ FEEDBACK DEL BOTÓN "+ Agregar" ★
// Llama a agregarAlCarrito(); SOLO si el producto se agregó (retorna
// true) muestra el estado verde "✓ Agregado" por 700ms y restaura el
// botón. Si la tienda estaba cerrada, agregarAlCarrito ya muestra la
// notificación y el botón NO cambia (evita feedback engañoso).
function pcAgregar(boton, producto) {
    if (!agregarAlCarrito(producto, 1)) return;

    const htmlOriginal = boton.innerHTML;
    boton.classList.add('is-added');
    boton.innerHTML = '<i class="fas fa-check"></i> Agregado';

    setTimeout(() => {
        boton.classList.remove('is-added');
        boton.innerHTML = htmlOriginal;
    }, 700);
}

// ★ v4.2 (Opción B): BOTÓN "INFO" ★
// Revela/oculta la descripción EN SITIO: alterna la clase
// .pc-desc-expandida en la tarjeta contenedora (ver §5.1 de
// product-card.css) y cambia la etiqueta: "Info" ↔ "Ver menos".
// NOTA: se expande en sitio (no tooltip/popover) porque .pc-card
// tiene overflow:hidden por las esquinas redondeadas y recortaría
// cualquier elemento flotante.
function pcToggleDesc(boton) {
    const tarjeta = boton.closest('.pc-card');
    if (!tarjeta) return;

    const expandida = tarjeta.classList.toggle('pc-desc-expandida');

    boton.innerHTML = expandida
        ? '<i class="fas fa-chevron-up"></i> Ver menos'
        : '<i class="fas fa-circle-info"></i> Info';
}

// ============================================
// 5. RENDERIZADO DE TIENDAS Y MENÚ 
// (★ v4: esta sección quedó INTACTA — las tiendas siguen iguales)
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
        const promovidaA = (a.promovida == 1 || a.promovida === true) ? 1 : 0;
        const promovidaB = (b.promovida == 1 || b.promovida === true) ? 1 : 0;
        if (promovidaB !== promovidaA) return promovidaB - promovidaA;

        const ratingA = parseFloat(a.rating) || 0;
        const ratingB = parseFloat(b.rating) || 0;
        return ratingB - ratingA;
    });

    const tiendasAbiertas = tiendas.filter(t => checkStoreStatus(t.horario).isOpen);
    const tiendasCerradas = tiendas.filter(t => !checkStoreStatus(t.horario).isOpen);

    container.className = 'stores-grid-horizontal';
    container.style.display = 'flex';
    container.style.overflow = 'auto';

    if (tiendasAbiertas.length === 0) {
        container.innerHTML = `
            <div class="store-card" style="flex: 0 0 300px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem 1.5rem; background: var(--white); border-radius: var(--border-radius);">
                <i class="fas fa-bed" style="font-size: 3rem; color: var(--secondary); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--dark); margin-bottom: 0.5rem;">¡Estamos descansando!</h3>
                <p style="color: var(--gray); font-size: 0.9rem;">Por el momento todas nuestras tiendas están cerradas. ¡Vuelve pronto!</p>
            </div>
        `;
    } else {
        container.innerHTML = tiendasAbiertas.map(tienda => {
            const tieneImagen = tienda.imagen && tienda.imagen.trim() !== '';
            const tieneDesc = tienda.descripcion && String(tienda.descripcion).trim() !== '';
            const rating = tienda.rating || 5;

            return `
            <div class="store-card" onclick="verMenuTienda(${tienda.id})">
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
                    <button class="btn-ver-menu-tienda" style="margin-top: 12px; width: 100%; background: rgba(230,57,70,0.1); color: var(--primary); border: none; padding: 10px; border-radius: 8px; font-family: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: 0.2s;">
                        Ver menú <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
        iniciarAutoScrollTiendas();
    }

    const closedContainer = document.getElementById('stores-grid-cerradas');
    if (!closedContainer) return;

    if (tiendasCerradas.length > 0) {
        closedContainer.style.display = 'block';
        closedContainer.innerHTML = `
            <h3 style="margin-top: 3rem; margin-bottom: 1.5rem; color: var(--gray); text-align: center; font-size: 1.2rem;">
                <i class="fas fa-clock"></i> Otras Tiendas (Cerradas ahora)
            </h3>
            <div class="stores-grid" style="display: grid;">
                ${tiendasCerradas.map(tienda => {
            const tieneImagen = tienda.imagen && tienda.imagen.trim() !== '';
            const tieneDesc = tienda.descripcion && String(tienda.descripcion).trim() !== '';
            const rating = tienda.rating || 5;
            const status = checkStoreStatus(tienda.horario);

            return `
                    <div class="store-card" onclick="verMenuTienda(${tienda.id})" style="cursor: pointer;">
                        <span class="badge-closed"><i class="fas fa-clock"></i> ${status.nextOpening}</span>
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
                            <button class="btn-ver-menu-tienda" style="margin-top: 12px; width: 100%; background: rgba(230,57,70,0.1); color: var(--primary); border: none; padding: 10px; border-radius: 8px; font-family: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: 0.2s;">
                                Ver menú <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>`;
        }).join('')}
            </div>
        `;
    } else {
        closedContainer.innerHTML = '';
        closedContainer.style.display = 'none';
    }
}

function renderizarProductosDestacados() {
    const contenedor = document.getElementById('productos-destacados-grid');
    if (!contenedor) return;

    let productosConImagen = productosGlobal.filter(p =>
        p.imagen_url && p.imagen_url.trim() !== '' &&
        p.imagen_url !== 'null' && p.imagen_url !== 'undefined' &&
        !(p.badge && p.badge.toLowerCase() === 'agotado')
    );

    if (productosConImagen.length === 0) {
        contenedor.style.display = 'none';
        return;
    }

// ============================================
// 5.1 while (productosDestacados.length < 4 && productosConImagen.length > 0)  aca se cambia la cantidad de productos destacados que se muestran en la pagina principal 
// ============================================
    let productosDestacados = [];
    while (productosDestacados.length < 4 && productosConImagen.length > 0) {
        const randomIndex = Math.floor(Math.random() * productosConImagen.length);
        productosDestacados.push(productosConImagen.splice(randomIndex, 1)[0]);
    }

    contenedor.innerHTML = productosDestacados.map(p => {
        const tienda = tiendas.find(t => t.id == p.tiendaId);
        const tiendaNombre = tienda ? tienda.nombre : '';
        p.tiendaNombre = tiendaNombre;

        return `
        <div class="destacado-card" onclick="verProductoDestacado('${p.id}')">
            <div class="destacado-card-img" style="background-image: url('${p.imagen_url}')"></div>
            <div class="destacado-card-overlay">
                <h4>${esc(p.nombre)}</h4>
                <div class="destacado-precio">${formatearPrecio(p.precio)}</div>
                <span class="destacado-tienda">${esc(tiendaNombre)}</span>
            </div>
        </div>`;
    }).join('');
}

async function verProductoDestacado(productoId) {
    const prod = productosGlobal.find(p => String(p.id) === String(productoId));
    if (!prod) {
        mostrarNotificacion("Producto no encontrado", "error");
        return;
    }

    if (!prod.tiendaId) {
        const tiendaConProducto = tiendas.find(t => t.productos && t.productos.some(p => String(p.id) === String(productoId)));
        if (tiendaConProducto) {
            prod.tiendaId = tiendaConProducto.id;
            prod.tiendaNombre = tiendaConProducto.nombre;
        }
    }

    if (!prod.tiendaId) {
        mostrarNotificacion("No se encontró la tienda de este producto", "error");
        return;
    }

    const tieneComplementos = (window.DomiModal && window.DomiModal.tieneComplementos(prod.id));

    if (tieneComplementos) {
        DomiModal.abrir(prod);
    } else {
        await verMenuTienda(prod.tiendaId, productoId);

        setTimeout(() => {
            const productCard = document.getElementById(`prod-${productoId}`);
            if (productCard) {
                const headerOffset = 85;
                const elementPosition = productCard.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

                productCard.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
                productCard.style.boxShadow = '0 0 0 3px var(--primary), 0 10px 30px rgba(230,57,70,0.3)';
                productCard.style.transform = 'scale(1.02)';

                setTimeout(() => {
                    productCard.style.boxShadow = '';
                    productCard.style.transform = '';
                }, 2500);
            }
        }, 600);
    }
}

function iniciarAutoScrollTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container || container.className !== 'stores-grid-horizontal') return;

    if (autoScrollTiendasInterval) clearInterval(autoScrollTiendasInterval);

    autoScrollTiendasInterval = setInterval(() => {
        if (container.matches(':hover')) return;

        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        if (container.scrollLeft >= maxScrollLeft - 5) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            const cardWidth = container.querySelector('.store-card')?.offsetWidth || 250;
            container.scrollBy({ left: cardWidth + 16, behavior: 'smooth' });
        }
    }, 3000);
}

// ============================================
// 5.1 MENÚ DE TIENDA CON PAGINADOR
// (★ v4: solo cambió renderMenuProducts → usa crearTarjetaProducto.
//  Paginador, buscador, scroll y resaltado: INTACTOS)
// ============================================
async function verMenuTienda(tiendaId, productoIdDestacado = null) {
    const container = document.getElementById("stores-grid");
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    if (!container) return;

    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const categoriesWrapper = document.getElementById('categories-wrapper');
    const catProductosGrid = document.getElementById('categoria-productos-grid');

    if (contenedorAnuncios) contenedorAnuncios.style.display = 'none';
    if (categoriesWrapper) categoriesWrapper.style.display = 'none';
    if (catProductosGrid) catProductosGrid.style.display = 'none';
    if (storesGridCerradas) storesGridCerradas.style.display = 'none';
    if (productosDestacadosGrid) productosDestacadosGrid.style.display = 'none';

    if (autoScrollTiendasInterval) clearInterval(autoScrollTiendasInterval);

    container.className = '';
    container.style.display = 'block';
    container.style.overflow = 'visible';

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

    if (!tienda) {
        mostrarNotificacion("Tienda no encontrada", "error");
        cargarTiendas();
        return;
    }

    const productos = tienda.productos || [];
    const productosValidos = productos.filter(p => p.id && p.id !== '' && p.nombre);

    currentStoreProducts = productosValidos.map(p => {
        p.tiendaId = tienda.id;
        p.tiendaNombre = tienda.nombre;
        return p;
    });

    const status = checkStoreStatus(tienda.horario);

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
        </div>
        <div class="menu-grid" id="menu-grid-container"></div>
        <div id="menu-paginator-container" style="margin-top: 2rem;"></div>
    `;

    // ★ v4: renderMenuProducts delega en la plantilla única.
    // mostrarTienda: false → dentro del menú no hace falta el chip.
    // tiendaAbierta: false → todas las tarjetas salen con botón
    // "Cerrado" (misma prioridad que el código anterior).
    const renderMenuProducts = (productsToRender) => {
        const gridContainer = document.getElementById('menu-grid-container');
        if (!gridContainer) return;

        if (productsToRender.length === 0) {
            gridContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><i class="fas fa-box-open"></i><p>No se encontraron productos</p></div>`;
            return;
        }

        gridContainer.innerHTML = productsToRender.map(p => crearTarjetaProducto(p, {
            mostrarTienda: false,
            tiendaAbierta: status.isOpen,
            horarioTienda: getHorarioHoy(tienda.horario)
        })).join('');
    };

    if (currentPaginator) {
        currentPaginator.destroy();
    }

    const ITEMS_PER_PAGE = 3;
    let skipInitialTitleScroll = !!productoIdDestacado;

    currentPaginator = new Paginator({
        items: currentStoreProducts,
        itemsPerPage: ITEMS_PER_PAGE,
        containerId: 'menu-paginator-container',
        renderCallback: renderMenuProducts,
        onPageChange: function () {
            if (skipInitialTitleScroll) {
                skipInitialTitleScroll = false;
                return;
            }

            const titleElement = document.getElementById('main-title');
            if (titleElement) {
                const headerOffset = 85;
                const elementPosition = titleElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }
    });

    if (productoIdDestacado) {
        const index = currentStoreProducts.findIndex(p => String(p.id) === String(productoIdDestacado));

        if (index !== -1) {
            const targetPage = Math.floor(index / ITEMS_PER_PAGE) + 1;

            if (targetPage > 1) {
                currentPaginator.goToPage(targetPage);
            }

            setTimeout(() => {
                const productCard = document.getElementById(`prod-${productoIdDestacado}`);
                if (productCard) {
                    const headerOffset = 85;
                    const elementPosition = productCard.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

                    productCard.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
                    productCard.style.boxShadow = '0 0 0 3px var(--primary), 0 10px 30px rgba(230,57,70,0.3)';
                    productCard.style.transform = 'scale(1.02)';

                    setTimeout(() => {
                        productCard.style.boxShadow = '';
                        productCard.style.transform = '';
                    }, 2500);
                }
            }, 150);
        }
    } else {
        requestAnimationFrame(() => {
            const targetElement = document.getElementById('main-title');
            if (targetElement) {
                const headerOffset = 85;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    }
}

function filtrarProductos(texto) {
    if (!currentPaginator) return;

    const termino = texto.toLowerCase().trim();
    let filtered = currentStoreProducts;

    if (termino !== '') {
        filtered = currentStoreProducts.filter(p => {
            const nombre = (p.nombre || '').toLowerCase();
            const desc = (p.descripcion || '').toLowerCase();
            return nombre.includes(termino) || desc.includes(termino);
        });
    }

    currentPaginator.updateItems(filtered);
}

// ============================================
// 6. EFECTOS VISUALES Y CARRO DE COMPRAS
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

// ★ v4: ahora RETORNA true si el producto se agregó al carrito,
// false si fue bloqueado (tienda cerrada). Retrocompatible: ninguna
// parte del código usaba el retorno antes. Lo consume pcAgregar()
// para decidir si mostrar el feedback "✓ Agregado" del botón.
function agregarAlCarrito(producto, cantidadTipo, selecciones, extrasVacios) {
    selecciones = selecciones || {};
    extrasVacios = extrasVacios || [];

    const tiendaOrigen = tiendas.find(t => t.id == producto.tiendaId);
    if (tiendaOrigen) {
        const status = checkStoreStatus(tiendaOrigen.horario);
        if (!status.isOpen) {
            mostrarNotificacion(`Esta tienda está cerrada hoy. Horario: ${getHorarioHoy(tiendaOrigen.horario)}`, 'error');
            return false; // ★ v4
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

    const precioBase = parseFloat(producto.precio) || 0;
    let complementosTotal = 0;

    Object.values(selecciones).forEach(items => {
        items.forEach(item => {
            complementosTotal += (parseFloat(item.precio) || 0) * (item.cantidad || 1);
        });
    });

    const precioUnitario = precioBase + complementosTotal;

    const item = {
        id: producto.id,
        nombre: producto.nombre,
        precioUnitario: precioUnitario,
        precioBase: precioBase,
        cantidadTipo: cantidadTipo,
        cantidad: 1,
        subtotal: precioUnitario,
        tiendaId: producto.tiendaId || null,
        tiendaNombre: producto.tiendaNombre || null,
        selecciones: selecciones
    };

    const seleccionesKey = Object.keys(selecciones)
        .sort()
        .map(grupo => {
            const nombres = (selecciones[grupo] || [])
                .map(s => `${s.nombre}(x${s.cantidad || 1})`)
                .sort()
                .join('|');
            return `${grupo}=${nombres}`;
        })
        .join('||');

    const existente = carrito.find(i => {
        if (i.id !== item.id || i.cantidadTipo !== item.cantidadTipo) return false;
        const otraKey = Object.keys(i.selecciones || {})
            .sort()
            .map(grupo => {
                const nombres = (i.selecciones[grupo] || [])
                    .map(s => `${s.nombre}(x${s.cantidad || 1})`)
                    .sort()
                    .join('|');
                return `${grupo}=${nombres}`;
            })
            .join('||');
        return otraKey === seleccionesKey;
    });

    if (existente) {
        existente.cantidad++;
        existente.subtotal = existente.precioUnitario * existente.cantidad;
    } else {
        carrito.push(item);
    }

    guardarCarrito(carrito);
    actualizarCarritoUI();

    let msg = ` ${esc(producto.nombre)} agregado al carrito`;
    mostrarNotificacion(msg);

    if (carritoVacio) crearExplosionComida();

    const headerCart = document.getElementById("header-cart");
    if (headerCart) {
        headerCart.classList.add("pulse");
        setTimeout(() => headerCart.classList.remove("pulse"), 500);
    }

    if (window.debeMostrarPromptFCM && window.debeMostrarPromptFCM()) {
        const prompt = document.getElementById('fcm-soft-prompt');
        if (prompt) {
            setTimeout(() => { prompt.style.display = 'block'; }, 1500);
        }
    }

    return true; // ★ v4
}

function actualizarCarritoUI() {
    const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
    const btnVaciar = document.getElementById('btn-vaciar');
    if (btnVaciar) btnVaciar.style.display = totalItems > 0 ? 'block' : 'none';

    const cartCounter = document.getElementById("cart-counter");
    if (cartCounter) {
        cartCounter.innerText = totalItems;
        cartCounter.style.display = 'flex';
    }

    const headerCart = document.getElementById("header-cart");
    if (headerCart) {
        if (totalItems > 0) {
            headerCart.classList.add("has-items");
            headerCart.classList.remove("empty");
        } else {
            headerCart.classList.add("empty");
            headerCart.classList.remove("has-items");
        }
    }

    const cartItemsDiv = document.getElementById("cart-items");
    if (cartItemsDiv) {
        if (carrito.length === 0) {
            cartItemsDiv.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-basket"></i><p>Tu carrito está vacío</p></div>`;
        } else {
            cartItemsDiv.innerHTML = carrito.map((item, idx) => {
                let complementosHtml = '';

                if (item.selecciones && Object.keys(item.selecciones).length > 0) {
                    Object.keys(item.selecciones).forEach(grupo => {
                        const itemsGrupo = item.selecciones[grupo];
                        if (itemsGrupo && itemsGrupo.length > 0) {
                            const nombres = itemsGrupo.map(s => {
                                const p = parseFloat(s.precio) || 0;
                                const c = s.cantidad || 1;
                                const nombreStr = c > 1 ? `${c}x ${esc(s.nombre)}` : esc(s.nombre);
                                return p > 0 ? `${nombreStr} (+${formatearPrecio(p)})` : nombreStr;
                            }).join(', ');
                            complementosHtml += `<div class="cart-item-detail"><i class="fas fa-pepper-hot" style="color:var(--secondary);margin-right:4px;font-size:.7rem"></i>${esc(grupo)}: ${nombres}</div>`;
                        }
                    });
                }

                return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name"> ${esc(item.nombre)}</div>
                        ${item.tiendaNombre ? `<div class="cart-item-detail"><i class="fas fa-store" style="color:var(--secondary);margin-right:4px;font-size:.7rem"></i>${item.tiendaNombre}</div>` : ''}
                        ${complementosHtml}
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
                </div>`;
            }).join('');
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

// ============================================
// 7. HORARIO JSON
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
// 8. ZONE AUTOCOMPLETE - BUSCADOR DE ZONAS
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
// 9. AUTOCOMPLETE PARA CHECKOUT
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