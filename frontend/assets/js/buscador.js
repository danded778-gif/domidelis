/**
 * buscador.js
 * -------------------------------------------------------
 * Buscador global del header (desktop dropdown + panel móvil)
 * Solo se usa en index.html
 */
(function (global) {
    'use strict';

    function inicializarBuscador() {
        const inputDesk = document.getElementById('header-search-input');
        const dropDesk = document.getElementById('header-search-dropdown');
        const clearDesk = document.getElementById('header-search-clear');
        const btnMobile = document.getElementById('header-search-btn');
        const inputMobile = document.getElementById('mobile-search-input');
        const closeSearch = document.getElementById('close-search');
        const overlay = document.getElementById('search-overlay');

        if (inputDesk) {
            inputDesk.addEventListener('input', () => {
                if (clearDesk) clearDesk.style.display = inputDesk.value ? 'block' : 'none';
                renderResultadosBusqueda(inputDesk.value, dropDesk);
            });
            inputDesk.addEventListener('focus', () => {
                if (inputDesk.value.trim()) renderResultadosBusqueda(inputDesk.value, dropDesk);
            });
        }

        if (clearDesk) {
            clearDesk.onclick = () => {
                inputDesk.value = '';
                clearDesk.style.display = 'none';
                if (dropDesk) {
                    dropDesk.classList.remove('active');
                    dropDesk.innerHTML = '';
                }
            };
        }

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('header-search');
            if (wrap && !wrap.contains(e.target) && dropDesk) {
                dropDesk.classList.remove('active');
            }
        });

        if (btnMobile) btnMobile.onclick = abrirBuscadorMovil;
        if (closeSearch) closeSearch.onclick = cerrarBuscadorMovil;
        if (overlay) overlay.onclick = cerrarBuscadorMovil;
        if (inputMobile) {
            inputMobile.addEventListener('input', () => {
                renderResultadosBusqueda(
                    inputMobile.value,
                    document.getElementById('mobile-search-results')
                );
            });
        }
    }

    function abrirBuscadorMovil() {
        document.getElementById('search-panel')?.classList.add('active');
        document.getElementById('search-overlay')?.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 250);
    }

    function cerrarBuscadorMovil() {
        document.getElementById('search-panel')?.classList.remove('active');
        document.getElementById('search-overlay')?.classList.remove('active');
        document.body.style.overflow = '';
    }

    function buscarProductos(texto) {
        const termino = (texto || '').toLowerCase().trim();
        if (termino.length < 2) return [];

        return (productosGlobal || []).filter(p => {
            const nombre = (p.nombre || '').toLowerCase();
            const desc = (p.descripcion || '').toLowerCase();
            const tienda = (p.tiendaNombre || '').toLowerCase();
            return nombre.includes(termino) || desc.includes(termino) || tienda.includes(termino);
        }).slice(0, 20);
    }

    function renderResultadosBusqueda(texto, contenedor) {
        if (!contenedor) return;
        const termino = (texto || '').trim();

        if (termino.length < 2) {
            contenedor.classList.remove('active');
            contenedor.innerHTML = `<p class="search-empty">Escribe al menos 2 letras</p>`;
            return;
        }

        const resultados = buscarProductos(termino);
        contenedor.classList.add('active');

        if (resultados.length === 0) {
            contenedor.innerHTML = `<p class="search-empty">No encontramos "${esc(termino)}"</p>`;
            return;
        }

        resultados.forEach(p => {
            if (!p.tiendaNombre && p.tiendaId) {
                const t = (tiendas || []).find(x => x.id == p.tiendaId);
                if (t) p.tiendaNombre = t.nombre;
            }
        });

        contenedor.innerHTML = `
            <div class="menu-grid">
                ${resultados.map(p => `
                    <div class="search-result" onclick="irAProductoDesdeBuscador('${p.id}')">
                        ${crearTarjetaProducto(p, { mostrarTienda: true })}
                    </div>
                `).join('')}
            </div>
        `;
    }

    async function irAProductoDesdeBuscador(productoId) {
        const prod = (productosGlobal || []).find(p => String(p.id) === String(productoId));
        if (!prod || !prod.tiendaId) {
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('No se encontró la tienda de este producto', 'error');
            }
            return;
        }

        const dropDesk = document.getElementById('header-search-dropdown');
        const resultsMobile = document.getElementById('mobile-search-results');
        if (dropDesk) {
            dropDesk.classList.remove('active');
            dropDesk.innerHTML = '';
        }
        if (resultsMobile) resultsMobile.innerHTML = '';

        cerrarBuscadorMovil();
        await verMenuTienda(prod.tiendaId, productoId);
    }

    global.inicializarBuscador = inicializarBuscador;
    global.irAProductoDesdeBuscador = irAProductoDesdeBuscador;
    global.abrirBuscadorMovil = abrirBuscadorMovil;
    global.cerrarBuscadorMovil = cerrarBuscadorMovil;
})(window);