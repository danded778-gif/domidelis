// ============================================
// client.js - FUSIÓN DOCUMENTADA Y ACTUALIZADA v4.9.2
// Incluye: Horario JSON, Autocomplete, Carrito, Analíticas, Categorías
// ★ ACTUALIZADO: Menú deslizable filtra productos globales por categoría
// ★ CORREGIDO: Íconos dinámicos según el nombre de la categoría
// ★ MEJORADO: Categorías con orden prioritario y "Otras" al final
// ★ NUEVO v3: Modal de personalización con grupos dinámicos y Stepper
// ★ CORREGIDO v4: Orden de categorías (Todas → Menú → Almuerzo → …)
//
// ★★★ v4: TARJETA DE PRODUCTO HORIZONTAL ★★★
// - crearTarjetaProducto() — plantilla única (clases pc-*)
// - agregarAlCarrito retorna true/false (pcAgregar feedback)
//
// ★★★ v4.2 — DESCRIPCIÓN SOLO TRAS BOTÓN "INFO" ★★★
//
// ★★★ v4.3 — LAZY LOAD + PAGINACIÓN CATEGORÍAS ★★★
//
// ★★★ v4.5 — DOTS ESTILO INSTAGRAM EN EL CARRUSEL ★★★
//
// ★★★ v4.6 — BOTÓN "¿POR QUÉ?" + MODAL DE ENVÍO EN EL CARRITO ★★★
// - El texto "+30% aplicado por N tiendas" (maluco) fue ELIMINADO
// - En su lugar: botón rojo "¿Por qué?" junto al total (solo si 2+ tiendas)
// - Modal autocontenido (trae sus propios estilos, no requiere
//   cambios en styles.css ni config.js)
//
// ★★★ v4.7 — CATEGORÍAS DINÁMICAS POR HORARIO ★★★
//
// ★★★ v4.7.1 — CORRECCIÓN 404 ★★★
// - Funciones del módulo embebidas en la SECCIÓN 0 (sin archivo externo)
//
// ★★★ v4.8 — ROTACIÓN DE PRODUCTOS EN CADA RECARGA ★★★
// - Si una categoría tiene muchos productos, la vitrina estrella ROTA:
//   cada recarga muestra productos distintos (barajado Fisher-Yates)
// - Aplica a la categoría principal, a Bebidas y al relleno general
// - Bebidas (2ª prioridad del horario) rellena la vitrina ANTES que
//   cualquier otra categoría cuando la principal no alcanza los 4
//
// ★★★ v4.9 — SOPORTE DEL BOTÓN ATRÁS (domi-back.js) ★★★
// - navegar() en volverATiendas / mostrarProductosPorCategoria / verMenuTienda / cargarTiendas
// - renderDesdeAtras() + marcarChipCategoria() para restauración instantánea
// - capaAbierta / capaCerrada en carrito, modal-envio y menú hamburguesa
// - Botón "Volver a tiendas" usa DomiBack.atras() (sin re-fetch)
//
// ★★★ v4.9.1 — FIX categories-wrapper + dots al volver ★★★
//
// ★★★ v4.9.2 — irACheckout sin carrera con DomiBack ★★★
// - Cierre visual del carrito SIN capaCerrada (evita history.back diferido)
// - location.replace("checkout.html") en vez de location.href
// ============================================

// ============================================
// 0. CATEGORÍAS DINÁMICAS POR HORARIO ★ v4.8
// (embebidas desde v4.7.1 — ya NO se requiere archivo externo)
//
// ★ NUEVO v4.8 — ROTACIÓN DE PRODUCTOS EN CADA RECARGA:
//   Antes: si la categoría prioritaria tenía muchos productos, SIEMPRE
//   se mostraban los mismos primeros 4 (los primeros del JSON).
//   Ahora: los productos se BARAJAN (Fisher-Yates) dentro de cada grupo,
//   así cada recarga de página rota la vitrina con productos distintos
//   de la misma categoría. Aplica para la categoría principal, para
//   Bebidas y para todo el relleno de otras categorías.
// ============================================

// 0.0 Baraja (mezcla aleatoria) una lista SIN mutar la original.
//     Algoritmo Fisher-Yates: distribución uniforme, sin sesgos.
function barajarArray(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

// 0.1 Obtiene la hora decimal exacta en Colombia (GMT-5). Ej: 14:30 → 14.5
function obtenerHoraColombia() {
    const coStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
    const fecha = new Date(coStr);
    return fecha.getHours() + (fecha.getMinutes() / 60);
}

// 0.2 Retorna las categorías prioritarias según el bloque horario:
//     06:00–10:30 → Menú + Bebidas + Farmacia (desayunos)
//     10:30–15:00 → Almuerzo + Bebidas + Menú
//     15:00–16:00 → Detalles + Bebidas (snacks de tarde)
//     16:00–17:00 → Farmacia + Bebidas (bienestar)
//     17:00–21:00 → Menú + Bebidas (comidas rápidas)
//     21:00–23:00 → Licores + Cervezas + Bebidas (noche)
//     23:00–06:00 → Modo dinámico base
function obtenerPrioridadesPorHorario() {
    const hora = obtenerHoraColombia();
    if (hora >= 6.0 && hora < 10.5) return ['Menu', 'Bebidas', 'Farmacia'];
    if (hora >= 10.5 && hora < 15.0) return ['Almuerzo', 'Bebidas', 'Menu'];
    if (hora >= 15.0 && hora < 16.0) return ['Detalles', 'Bebidas'];
    if (hora >= 16.0 && hora < 17.0) return ['Farmacia', 'Bebidas'];
    if (hora >= 17.0 && hora < 21.0) return ['Menu', 'Bebidas'];
    if (hora >= 21.0 && hora < 23.0) return ['Licores', 'Cervezas', 'Bebidas'];
    return ['Menu', 'Almuerzo', 'Licores', 'Cervezas', 'Bebidas'];
}

// 0.3 Filtra, BARAJA y prioriza los productos de la vitrina estrella.
//     ★ v4.8: dentro de cada grupo el orden es aleatorio en cada recarga,
//     pero la regla de prioridad se mantiene intacta:
//       1º) productos de la categoría ideal de la hora (ej: Almuerzo al mediodía)
//       2º) productos de la 2ª categoría del horario (ej: Bebidas) — rotan
//       3º) el resto de productos — también barajados
//     Se conservan las protecciones originales (imágenes 'null'/'undefined'
//     descartadas y badge "Agotado" detectado sin importar mayúsculas).
function obtenerProductosEstrellaPriorizados(productos, limite = 4) {
    const prioridad = obtenerPrioridadesPorHorario();
    const catPrincipal = prioridad[0];   // La categoría ideal de la hora actual
    const catSecundaria = prioridad[1];  // ★ v4.8: 2ª prioridad (ej: Bebidas)

    const validos = (productos || []).filter(p =>
        p.imagen_url &&
        p.imagen_url.trim() !== '' &&
        p.imagen_url !== 'null' &&
        p.imagen_url !== 'undefined' &&
        !(p.badge && String(p.badge).toLowerCase() === 'agotado')
    );

    // ★ v4.8: Barajamos DENTRO de cada grupo (rotación por recarga)
    const prioritarios = barajarArray(validos.filter(p => p.categoria === catPrincipal));

    const secundarios = (catSecundaria && catSecundaria !== catPrincipal)
        ? barajarArray(validos.filter(p => p.categoria === catSecundaria))
        : [];

    const otros = barajarArray(validos.filter(p =>
        p.categoria !== catPrincipal &&
        p.categoria !== catSecundaria
    ));

    // Prioridad de categorías intacta: principal → secundaria (Bebidas) → resto
    return [...prioritarios, ...secundarios, ...otros].slice(0, limite);
}

let tiendas = [];
let carrito = [];

let categoriaActiva = 'Todas';
let productosGlobal = [];
let complementosGlobal = [];

let currentPaginator = null;
let currentStoreProducts = [];
let currentCategoriaPaginator = null;

let autoScrollTiendasInterval;

// Observer reutilizable para background-image diferido (tiendas + destacados)
let lazyBgObserver = null;

function ensureLazyBgObserver() {
    if (lazyBgObserver) return lazyBgObserver;
    lazyBgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const bg = el.dataset.bg;
            if (bg) {
                el.style.backgroundImage = `url('${bg}')`;
                el.removeAttribute('data-bg');
            }
            lazyBgObserver.unobserve(el);
        });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
    return lazyBgObserver;
}

function observeLazyBg(container) {
    if (!container) return;
    const observer = ensureLazyBgObserver();
    container.querySelectorAll('[data-bg]').forEach(el => observer.observe(el));
}

// ============================================
// 1. INICIALIZACIÓN
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

    // ★ v4.5: dots del carrusel — se recalculan al deslizar
    //   y al redimensionar (rotar el teléfono).
    //   { passive: true } = no bloquea el deslizamiento táctil.
    const categoriesWrapper = document.getElementById('categories-wrapper');
    if (scrollContainer && categoriesWrapper) {
        scrollContainer.addEventListener('scroll', actualizarIndicadorCarrusel, { passive: true });
        window.addEventListener('resize', actualizarIndicadorCarrusel);
    }

    if (document.getElementById("stores-grid")) {
        cargarTiendas();
    }
});

// ============================================
// 1.1 DOTS ESTILO INSTAGRAM ★ v4.5
// ============================================

function construirDotsCategorias() {
    const scroller = document.getElementById('categories-scroll');
    if (!scroller) return;

    let dotsContainer = document.getElementById('categories-dots');
    if (!dotsContainer) {
        dotsContainer = document.createElement('div');
        dotsContainer.id = 'categories-dots';
        dotsContainer.className = 'categories-dots';
        scroller.parentNode.appendChild(dotsContainer);
    }

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;

    if (maxScroll <= 5) {
        dotsContainer.classList.add('vacio');
        dotsContainer.innerHTML = '';
        return;
    }

    dotsContainer.classList.remove('vacio');

    const numPaginas = Math.ceil(scroller.scrollWidth / scroller.clientWidth);

    dotsContainer.innerHTML = Array.from({ length: numPaginas }, (_, i) =>
        `<button type="button" class="cat-dot${i === 0 ? ' active' : ''}" data-pagina="${i}" aria-label="Ir a página ${i + 1} de categorías"></button>`
    ).join('');

    dotsContainer.querySelectorAll('.cat-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const pagina = parseInt(dot.dataset.pagina);
            const max = scroller.scrollWidth - scroller.clientWidth;
            const total = dotsContainer.querySelectorAll('.cat-dot').length;
            if (total <= 1) return;
            scroller.scrollTo({ left: (max * pagina) / (total - 1), behavior: 'smooth' });
        });
    });
}

function actualizarDotsCategorias() {
    const scroller = document.getElementById('categories-scroll');
    const dotsContainer = document.getElementById('categories-dots');
    if (!scroller || !dotsContainer) return;

    const dots = dotsContainer.querySelectorAll('.cat-dot');
    if (dots.length === 0) return;

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) return;

    const progreso = scroller.scrollLeft / maxScroll;
    const indiceActivo = Math.round(progreso * (dots.length - 1));

    dots.forEach((d, i) => d.classList.toggle('active', i === indiceActivo));
}

function actualizarIndicadorCarrusel() {
    actualizarDotsCategorias();
}

// ============================================
// 2. EVENTOS UI
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

    // ★ v4.9 — menú hamburguesa con capa DomiBack
    if (mobileMenu && navLinks) {
        mobileMenu.onclick = () => {
            if (navLinks.classList.contains("active")) {
                cerrarMenuHamburguesa();                        // ★ v4.9
            } else {
                navLinks.classList.add("active");
                mobileMenu.classList.add("active");
                window.DomiBack?.capaAbierta('menu');           // ★ v4.9
            }
        };
    }

    if (typeof inicializarBuscador === 'function') {
        inicializarBuscador();
    }
}

// ★ v4.9 — cierre del menú hamburguesa (lo usan el toggle y el botón atrás)
function cerrarMenuHamburguesa() {
    const navLinks = document.getElementById("nav-links");
    const mobileMenu = document.getElementById("mobile-menu");
    if (navLinks) navLinks.classList.remove("active");
    if (mobileMenu) mobileMenu.classList.remove("active");
    window.DomiBack?.capaCerrada('menu');
}

function abrirCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.add("active");
    if (cartOverlay) cartOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
    window.DomiBack?.capaAbierta('carrito');  // ★ v4.9
}

function cerrarCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.remove("active");
    if (cartOverlay) cartOverlay.classList.remove("active");
    document.body.style.overflow = "";
    window.DomiBack?.capaCerrada('carrito');  // ★ v4.9
}

// ============================================
// 3. CARGA DE DATOS
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
        // ★ v4.10 — catálogo fresco (módulo cliente/catalogo-fresco.js):
        // 1º backend Railway, 2º salvavidas local. Sin ?v=: una sola
        // entrada en la caché del SW → el offline vuelve a funcionar.
        let data;
        if (window.CatalogoFresco) {
            data = await window.CatalogoFresco.obtenerCatalogo();
        } else {
            const res = await fetch(CATALOGO_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error("Error en la red");
            data = await res.json();
        }
        tiendas = data.tiendas || [];
      //aca seguimos 
        productosGlobal = data.productosGlobal || [];
        complementosGlobal = data.complementosGlobal || [];

        const catsEnJSON = [...new Set(productosGlobal.map(p => p.categoria).filter(c => c && c.trim() !== ''))];
        renderizarCategorias(catsEnJSON);

        resetMainViewUI();
        renderizarTiendas();
        renderizarProductosDestacados();
        window.DomiBack?.navegar('principal', {});  // ★ v4.9
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

    const domidelisIntro = document.getElementById('domidelis-intro');
    if (domidelisIntro) domidelisIntro.style.display = 'flex';

    requestAnimationFrame(actualizarIndicadorCarrusel);
}

// ============================================
// 4. CATEGORÍAS
// ============================================
function renderizarCategorias(categoriasDesdeJSON) {
    const contenedor = document.getElementById('categories-scroll');
    if (!contenedor) return;

    // ★ v4.7: Prioridad DINÁMICA según horario (funciones en la SECCIÓN 0
    //   de este archivo). Antes: array estático
    //   ['Menu', 'Almuerzo', 'Comida', 'Bebidas', 'Licores', 'Cervezas', 'Farmacia'].
    //   Ahora: el carrusel se ordena según la hora actual en Colombia
    //   (ej: a las 12pm "Almuerzo" queda primero; a las 10pm "Licores").
    //   Las categorías del JSON que no estén en la prioridad del momento
    //   conservan su posición natural, y "Otras" sigue quedando al final.
    const prioridad = obtenerPrioridadesPorHorario();

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

    let categoriasOrdenadas = [];
    prioridad.forEach(prio => {
        const encontrada = categoriasRestantes.find(cat => normalizarCategoria(cat) === normalizarCategoria(prio));
        if (encontrada) {
            categoriasOrdenadas.push(encontrada);
            categoriasRestantes = categoriasRestantes.filter(cat => cat !== encontrada);
        }
    });

    categoriasRestantes.forEach(cat => {
        if (normalizarCategoria(cat) !== 'otras') {
            categoriasOrdenadas.push(cat);
        }
    });

    if (categoriaOtras) categoriasOrdenadas.push(categoriaOtras);

    let listaFinal = ['Todas', ...categoriasOrdenadas];

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

    contenedor.style.display = 'flex';
    contenedor.style.overflowX = 'auto';
    contenedor.style.gap = '0.5rem';
    contenedor.style.scrollBehavior = 'smooth';
    contenedor.style.webkitOverflowScrolling = 'touch';

    requestAnimationFrame(() => {
        construirDotsCategorias();
        actualizarIndicadorCarrusel();
    });
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
    window.DomiBack?.navegar('categoria', { nombre: categoriaActiva }); // ★ v4.9

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

    const domidelisIntro = document.getElementById('domidelis-intro');
    if (domidelisIntro) domidelisIntro.style.display = 'none';

    if (tituloPrincipal) tituloPrincipal.innerHTML = `<i class="fas fa-utensils"></i> ${categoriaActiva}`;

    const productosFiltrados = productosGlobal.filter(p => p.categoria === categoriaActiva);
    const container = document.getElementById('productos-por-categoria-container');
    if (!container) return;

    if (productosFiltrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos en esta categoría</p></div>`;
        if (currentCategoriaPaginator) {
            currentCategoriaPaginator.destroy();
            currentCategoriaPaginator = null;
        }
        return;
    }

    productosFiltrados.forEach(p => {
        if (!p.tiendaNombre && p.tiendaId) {
            const tienda = tiendas.find(t => t.id == p.tiendaId);
            if (tienda) p.tiendaNombre = tienda.nombre;
        }
    });

    const renderCategoriaProducts = (productsToRender) => {
        container.innerHTML = productsToRender
            .map(p => crearTarjetaProducto(p, { mostrarTienda: true }))
            .join('');
    };

    if (currentCategoriaPaginator) {
        currentCategoriaPaginator.destroy();
        currentCategoriaPaginator = null;
    }

    let paginatorEl = document.getElementById('categoria-paginator-container');
    if (!paginatorEl) {
        paginatorEl = document.createElement('div');
        paginatorEl.id = 'categoria-paginator-container';
        paginatorEl.style.marginTop = '2rem';
        if (container.parentNode) {
            container.parentNode.insertBefore(paginatorEl, container.nextSibling);
        }
    }

    const ITEMS_PER_PAGE_CAT = 6;

    currentCategoriaPaginator = new Paginator({
        items: productosFiltrados,
        itemsPerPage: ITEMS_PER_PAGE_CAT,
        containerId: 'categoria-paginator-container',
        renderCallback: renderCategoriaProducts,
        onPageChange: function () {
            const targetElement = document.getElementById('categories-wrapper') || document.getElementById('main-title');
            if (targetElement) {
                const headerOffset = 85;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }
    });

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
    window.DomiBack?.navegar('principal', {}); // ★ v4.9

    const storesGrid = document.getElementById('stores-grid');
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const catProductosGrid = document.getElementById('categoria-productos-grid');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    const tituloPrincipal = document.getElementById('main-title');
    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const categoriesWrapper = document.getElementById('categories-wrapper'); // ★ v4.9.1

    if (categoriesWrapper) categoriesWrapper.style.display = 'flex'; // ★ v4.9.1 — EL FIX del bug
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

    const domidelisIntro = document.getElementById('domidelis-intro');
    if (domidelisIntro) domidelisIntro.style.display = 'flex';
    document.querySelectorAll('.category-item').forEach(item => {
        if (item.querySelector('span').innerText === 'Todas') item.classList.add('active');
        else item.classList.remove('active');
    });

    if (currentCategoriaPaginator) {
        currentCategoriaPaginator.destroy();
        currentCategoriaPaginator = null;
    }

    if (autoScrollTiendasInterval) clearInterval(autoScrollTiendasInterval);
    if (storesGrid) {
        storesGrid.scrollLeft = 0;
        iniciarAutoScrollTiendas();
    }

    requestAnimationFrame(actualizarIndicadorCarrusel); // ★ v4.9.1 — puntitos del carrusel al día
}

// ============================================
// 4.2 ★ v4.9 — SOPORTE DEL BOTÓN ATRÁS (domi-back.js)
// ============================================
// Marca el chip activo del carrusel de categorías
function marcarChipCategoria(nombre) {
    document.querySelectorAll('.category-item').forEach(item => {
        const span = item.querySelector('span');
        item.classList.toggle('active', !!(span && span.innerText === nombre));
    });
}
// Punto único de render cuando el botón atrás pide una pantalla.
// Lo llama domi-back.js. Restaura desde memoria: SIN red, instantáneo.
function renderDesdeAtras(vista, params, scroll) {
    if (vista === 'tienda') {
        verMenuTienda(params.id);
    } else if (vista === 'categoria') {
        categoriaActiva = params.nombre;
        marcarChipCategoria(params.nombre);
        mostrarProductosPorCategoria();
    } else {
        volverATiendas();
        renderizarTiendas();
    }
    // Doble rAF: le gana a los scrolls internos de cada render
    requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo(0, scroll || 0);
    }));
}

// ============================================
// 4.1 TARJETA DE PRODUCTO (pc-*)
// ============================================
const PC_BADGES = {
    'agotado': { clase: 'pc-badge--agotado' },
    'popular': { clase: 'pc-badge--popular' },
    'masvendido': { clase: 'pc-badge--vendido' },
    'nuevo': { clase: 'pc-badge--nuevo' }
};

function pcNormalizarBadge(valor) {
    return String(valor || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '');
}

function pcResolverClaseBadge(valor) {
    const clave = pcNormalizarBadge(valor);
    return (PC_BADGES[clave] && PC_BADGES[clave].clase) || 'pc-badge--default';
}

function crearTarjetaProducto(p, opciones = {}) {
    const mostrarTienda = opciones.mostrarTienda === true;
    const tiendaAbierta = opciones.tiendaAbierta !== false;
    const horarioTienda = opciones.horarioTienda || '';

    const imagenUrl = (p.imagen_url || p.icono || '').trim();
    const tieneImagen = imagenUrl !== '' &&
        imagenUrl !== 'null' && imagenUrl !== 'undefined' &&
        (/^(https?:\/\/|data:image)/i.test(imagenUrl) ||
            /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(imagenUrl));

    const esAgotado = pcNormalizarBadge(p.badge) === 'agotado';

    const badgeHTML = p.badge
        ? `<span class="pc-badge ${pcResolverClaseBadge(p.badge)}">${esc(p.badge)}</span>`
        : '';

    const tiendaChipHTML = mostrarTienda
        ? `<p class="pc-store"><i class="fas fa-store"></i><span>${esc(p.tiendaNombre || 'Sin tienda')}</span></p>`
        : '';

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
        <div class="pc-img ${tieneImagen ? 'pc-con-imagen' : 'pc-sin-imagen'}">
            ${tieneImagen
            ? `<img src="${imagenUrl}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.style.display='none';">`
            : '<i class="fas fa-utensils"></i>'}
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

function pcToggleDesc(boton) {
    const tarjeta = boton.closest('.pc-card');
    if (!tarjeta) return;

    const expandida = tarjeta.classList.toggle('pc-desc-expandida');

    boton.innerHTML = expandida
        ? '<i class="fas fa-chevron-up"></i> Ver menos'
        : '<i class="fas fa-circle-info"></i> Info';
}

// ============================================
// 5. TIENDAS Y DESTACADOS
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
                <div class="store-img"${tieneImagen ? ` data-bg="${tienda.imagen}"` : ''}>
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
        observeLazyBg(container);
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
                        <div class="store-img"${tieneImagen ? ` data-bg="${tienda.imagen}"` : ''}>
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
        observeLazyBg(closedContainer);
    } else {
        closedContainer.innerHTML = '';
        closedContainer.style.display = 'none';
    }
}

// ★ v4.8 — Vitrina estrella con priorización por horario + ROTACIÓN.
//   Antes: selección ALEATORIA simple (v4.6) o fija por orden del JSON (v4.7).
//   Ahora: los productos de la categoría de la hora van primero pero ROTAN
//   en cada recarga (barajado Fisher-Yates), Bebidas rellena como 2ª
//   prioridad (también rotando) y el resto completa barajado.
function renderizarProductosDestacados() {
    const contenedor = document.getElementById('productos-destacados-grid');
    if (!contenedor) return;

    // ★ v4.7/v4.8: Priorización inteligente por horario + rotación
    let productosDestacados = obtenerProductosEstrellaPriorizados(productosGlobal, 4);

    if (productosDestacados.length === 0) {
        contenedor.style.display = 'none';
        return;
    }

    contenedor.innerHTML = productosDestacados.map(p => {
        const tienda = tiendas.find(t => t.id == p.tiendaId);
        const tiendaNombre = tienda ? tienda.nombre : '';
        p.tiendaNombre = tiendaNombre;

        return `
        <div class="destacado-card" onclick="verProductoDestacado('${p.id}')">
            <div class="destacado-card-img" data-bg="${p.imagen_url}"></div>
            <div class="destacado-card-overlay">
                <h4>${esc(p.nombre)}</h4>
                <div class="destacado-precio">${formatearPrecio(p.precio)}</div>
                <span class="destacado-tienda">${esc(tiendaNombre)}</span>
            </div>
        </div>`;
    }).join('');

    observeLazyBg(contenedor);
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
// ============================================
async function verMenuTienda(tiendaId, productoIdDestacado = null) {
    const container = document.getElementById("stores-grid");
    const storesGridCerradas = document.getElementById('stores-grid-cerradas');
    const productosDestacadosGrid = document.getElementById('productos-destacados-grid');
    if (!container) return;

    window.DomiBack?.navegar('tienda', { id: tiendaId }); // ★ v4.9

    const contenedorAnuncios = document.getElementById('contenedor-anuncios');
    const categoriesWrapper = document.getElementById('categories-wrapper');
    const catProductosGrid = document.getElementById('categoria-productos-grid');

    if (contenedorAnuncios) contenedorAnuncios.style.display = 'none';
    if (categoriesWrapper) categoriesWrapper.style.display = 'none';

    const domidelisIntro = document.getElementById('domidelis-intro');
    if (domidelisIntro) domidelisIntro.style.display = 'none';
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
    if (typeof gtag === 'function') {
        gtag('event', 'ver_tienda', {
            'event_category': 'engagement',
            'event_label': tienda.nombre,
            'tienda_id': tienda.id
        });
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
        <button class="back-button" onclick="window.DomiBack ? DomiBack.atras() : cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
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
// 6. CARRO DE COMPRAS
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

function agregarAlCarrito(producto, cantidadTipo, selecciones, extrasVacios) {
    selecciones = selecciones || {};
    extrasVacios = extrasVacios || [];

    const tiendaOrigen = tiendas.find(t => t.id == producto.tiendaId);
    if (tiendaOrigen) {
        const status = checkStoreStatus(tiendaOrigen.horario);
        if (!status.isOpen) {
            mostrarNotificacion(`Esta tienda está cerrada hoy. Horario: ${getHorarioHoy(tiendaOrigen.horario)}`, 'error');
            return false;
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

    return true;
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

    const totalPriceEl = document.getElementById("cart-total-price");
    if (totalPriceEl) {
        // ★ v4.6: total limpio + botón ¿Por qué? (solo si hay 2+ tiendas)
        totalPriceEl.innerHTML = `${formatearPrecio(total)} <small>(envío: ${formatearPrecio(envio)})</small>`;
        actualizarBotonPorQueCarrito(totalPriceEl, carrito);
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
    // ★ v4.9.2 — Cierre visual SIN avisar a DomiBack:
    // estamos por SALIR de la página. Si avisáramos, el guardián
    // programaría su history.back() diferido, que ABORTARÍA esta
    // navegación (la carrera que rompía el checkout).
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.remove("active");
    if (cartOverlay) cartOverlay.classList.remove("active");
    document.body.style.overflow = "";
    // ★ v4.9.2 — location.replace: en vez de apilar checkout ENCIMA del
    // guardián (historial sucio), REEMPLAZA la entrada del guardián.
    // Volver desde el checkout queda limpio: una sola página atrás.
    window.location.replace("checkout.html");
}

function vaciarCarrito() {
    if (!confirm('¿Vaciar todo el carrito?')) return;
    carrito = [];
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

// ============================================
// 6.1 ★ NUEVO v4.6: BOTÓN "¿POR QUÉ?" + MODAL DE ENVÍO (CARRITO)
// Mismo diseño que el del checkout. Autocontenido: trae sus
// propios estilos para no depender de styles.css.
// ============================================

// Calculadora del recargo — misma matemática que calcularEnvio()
// (config.js): factor = 1 + 0.3 × (n-1), tope ×2.0
function calcularDesgloseRecargoCarrito(carritoItems) {
    const zona = APP_CONFIG.zonas[APP_CONFIG.zonaActual] || APP_CONFIG.zonas.centro;
    const base = zona.envio;

    const tiendasSet = new Set(
        carritoItems
            .filter(item => item.tiendaId)
            .map(item => String(item.tiendaId))
    );
    const n = tiendasSet.size;
    if (n <= 1) return null;

    const factor = Math.min(1 + 0.3 * (n - 1), 2.0);
    const final = Math.round(base * factor);
    const pct = Math.round(Math.min(0.3 * (n - 1), 1.0) * 100);

    return { tiendas: n, base, final, delta: final - base, pct };
}

// Crea/quita el botón "¿Por qué?" junto al total del carrito
function actualizarBotonPorQueCarrito(totalPriceEl, carritoItems) {
    let btn = document.getElementById('btn-porque-envio-carrito');
    const desglose = calcularDesgloseRecargoCarrito(carritoItems);

    // 1 tienda o menos → no hay nada que explicar → quitar botón
    if (!desglose) {
        if (btn) btn.remove();
        return;
    }

    if (!btn) {
        inyectarEstilosModalEnvio(); // garantiza estilos desde el primer render
        btn = document.createElement('button');
        btn.id = 'btn-porque-envio-carrito';
        btn.className = 'btn-porque';
        btn.type = 'button';
        btn.textContent = '¿Por qué?';
        btn.setAttribute('onclick', 'window.abrirModalEnvioCarrito()');
        totalPriceEl.appendChild(btn);
    }
}

// Abre la ventanita explicativa con el desglose real
function abrirModalEnvioCarrito() {
    const desglose = calcularDesgloseRecargoCarrito(carrito);
    if (!desglose) return;

    inyectarEstilosModalEnvio();

    let overlay = document.getElementById('modal-envio-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-envio-overlay';
        overlay.className = 'me-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="me-modal">
            <h3><i class="fas fa-motorcycle"></i> ¿Por qué sube el envío?</h3>
            <p>Tu pedido incluye productos de <strong>${desglose.tiendas} tiendas</strong>. El domiciliario hace más paradas para recoger todo, por eso el envío aumenta:</p>
            <div class="me-desglose">
                <div class="me-fila"><span>Envío base</span><span>${formatearPrecio(desglose.base)}</span></div>
                <div class="me-fila"><span>Recargo ${desglose.tiendas} tiendas (+${desglose.pct}%)</span><span>+${formatearPrecio(desglose.delta)}</span></div>
                <div class="me-fila me-total"><span>Envío final</span><span>${formatearPrecio(desglose.final)}</span></div>
            </div>
            <div class="me-tip">
                <i class="fas fa-lightbulb"></i>
                <span>Tip: si pides todo en una sola tienda, pagas el envío normal.</span>
            </div>
            <button class="me-btn" onclick="cerrarModalEnvioCarrito()">Entendido</button>
        </div>
    `;

    overlay.classList.add('abierto');
    window.DomiBack?.capaAbierta('modal-envio'); // ★ v4.9

    // Cerrar al tocar fuera de la ventanita
    overlay.onclick = function (e) {
        if (e.target === overlay) cerrarModalEnvioCarrito(); // ★ v4.9
    };
}

// ★ v4.9 — cierre único del modal de envío (botón, toque fuera y botón atrás)
function cerrarModalEnvioCarrito() {
    const overlay = document.getElementById('modal-envio-overlay');
    if (overlay) overlay.classList.remove('abierto');
    window.DomiBack?.capaCerrada('modal-envio');
}
window.cerrarModalEnvioCarrito = cerrarModalEnvioCarrito;

// Exponer globalmente (el botón del carrito la llama con onclick)
window.abrirModalEnvioCarrito = abrirModalEnvioCarrito;

// Estilos del botón y del modal — se inyectan UNA sola vez.
// Usa las mismas clases (.me-*) que el modal del checkout, así
// en checkout.html (que carga este archivo Y checkout.js) no se
// duplican estilos: quien llegue primero inyecta, el otro se da cuenta.
function inyectarEstilosModalEnvio() {
    if (document.getElementById('estilos-modal-envio')) return;

    const style = document.createElement('style');
    style.id = 'estilos-modal-envio';
    style.textContent = `
        .btn-porque {
            background:#FFF0F0; color:#E63946;
            border:1px solid #F8C9C9; border-radius:20px;
            padding:3px 10px; font-size:.72rem; font-weight:600;
            font-family:inherit; cursor:pointer; margin-left:8px;
            transition:.2s; vertical-align:middle;
        }
        .btn-porque:hover { background:#E63946; color:#fff; }

        .me-overlay {
            display:none; position:fixed; inset:0;
            background:rgba(0,0,0,.55); z-index:10000;
            align-items:center; justify-content:center; padding:20px;
        }
        .me-overlay.abierto { display:flex; }

        .me-modal {
            background:#fff; border-radius:20px; padding:24px;
            max-width:360px; width:100%;
            font-family:'Poppins',sans-serif;
            animation:meAparecer .25s ease;
        }
        @keyframes meAparecer { from { transform:scale(.9); opacity:0; } to { transform:scale(1); opacity:1; } }

        .me-modal h3 {
            color:#3E2723; font-size:1.05rem; margin-bottom:12px;
            display:flex; align-items:center; gap:8px;
        }
        .me-modal h3 i { color:#E63946; }
        .me-modal p { color:#666; font-size:.88rem; line-height:1.5; margin-bottom:14px; }

        .me-desglose { background:#FFF8E1; border-radius:12px; padding:12px 14px; margin-bottom:14px; }
        .me-fila { display:flex; justify-content:space-between; font-size:.85rem; padding:3px 0; color:#3E2723; }
        .me-fila span:last-child { font-weight:600; }
        .me-fila.me-total { border-top:1px dashed #E0C9A6; margin-top:6px; padding-top:8px; font-weight:700; color:#E63946; }

        .me-tip { font-size:.8rem; color:#666; display:flex; gap:6px; align-items:flex-start; margin-bottom:18px; }
        .me-tip i { color:#F9A825; margin-top:2px; }

        .me-btn {
            width:100%; background:#E63946; color:#fff;
            border:none; border-radius:25px; padding:12px;
            font-size:.95rem; font-weight:700; font-family:inherit; cursor:pointer;
        }
        .me-btn:hover { background:#c1121f; }
    `;
    document.head.appendChild(style);
}

// ============================================
// 7. HORARIO
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
// 8. ZONE AUTOCOMPLETE
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
// 9. AUTOCOMPLETE CHECKOUT
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