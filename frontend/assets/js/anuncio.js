// ============================================
// anuncios.js — Framework de Anuncios Dinámicos
// ============================================

const Anuncios = {
    activos: [],

    init: async function() {
        await this.cargarAnuncios();
        this.renderizar();
    },

    cargarAnuncios: async function() {
        try {
            // Hacemos la petición a Google Apps Script (a través de tu API_URL)
            const res = await fetch(`${API_URL}?action=getAnunciosActivos`);
            const data = await res.json();
            
            if (data.success && Array.isArray(data.anuncios)) {
                // Mezclamos los anuncios (Algoritmo de Fisher-Yates) para rotar por usuario
                this.activos = data.anuncios;
                for (let i = this.activos.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.activos[i], this.activos[j]] = [this.activos[j], this.activos[i]];
                }
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
        }
    },

    renderizar: function() {
        const contenedor = document.getElementById('contenedor-anuncios');
        if (!contenedor) return;

        if (this.activos.length === 0) {
            contenedor.innerHTML = ''; // Si no hay, lo dejamos vacío
            return;
        }

        contenedor.innerHTML = this.activos.map(anuncio => {
            // Si es banner, usa clase distinta
            const claseTamano = anuncio.tamano === 'banner' ? 'anuncio-banner' : 'anuncio-card';
            const tieneDescuentoDomicilio = anuncio.descuento > 0;
            const tienePromoProducto = anuncio.precioPromo > 0;

            let htmlBoton = '';
            if (tienePromoProducto) {
                htmlBoton = `<button class="anuncio-btn" onclick="Anuncios.agregarPromoCarrito(${anuncio.id})">
                    <i class="fas fa-cart-plus"></i> Agregar
                </button>`;
            } else if (tieneDescuentoDomicilio) {
                htmlBoton = `<button class="anuncio-btn" onclick="Anuncios.aplicarDescuentoDomicilio(${anuncio.id})">
                    <i class="fas fa-percentage"></i> Activar Descuento
                </button>`;
            }

            let htmlPrecio = '';
            if (tienePromoProducto) {
                htmlPrecio = `<div class="anuncio-precio">$${Number(anuncio.precioPromo).toLocaleString('es-CO')} 
                    ${anuncio.precioNormal ? `<small>$${Number(anuncio.precioNormal).toLocaleString('es-CO')}</small>` : ''}
                </div>`;
            }

            return `
                <div class="${claseTamano}">
                    <div class="anuncio-imagen" style="background-image: url('${anuncio.imagenUrl || ''}')">
                        ${tieneDescuentoDomicilio ? `<span class="anuncio-badge">${anuncio.descuento}% OFF Domicilio</span>` : ''}
                        ${tienePromoProducto ? `<span class="anuncio-badge">Promo</span>` : ''}
                    </div>
                    <div class="anuncio-contenido">
                        <div>
                            <h3 class="anuncio-titulo">${anuncio.titulo || ''}</h3>
                            <p class="anuncio-subtitulo">${anuncio.subtitulo || ''}</p>
                            ${htmlPrecio}
                        </div>
                        ${htmlBoton}
                    </div>
                </div>
            `;
        }).join('');
    },

    // Lógica para el 2x1 o promo de tienda
    agregarPromoCarrito: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId);
        if (!anuncio) return;

        // Suponemos un producto genérico para la promo
        const productoPromo = {
            id: `promo_${anuncio.id}`,
            nombre: anuncio.titulo,
            descripcion: anuncio.subtitulo,
            precio: parseFloat(anuncio.precioPromo),
            cantidad: 1,
            tiendaId: anuncio.tiendaId || 0,
            esPromo: true
        };

        // Usamos la función de client.js (asumo que se llama agregarAlCarrito)
        if (typeof agregarAlCarrito === 'function') {
            agregarAlCarrito(productoPromo);
            mostrarToast('¡Promoción agregada!', 'Revisa tu carrito', 'success');
        } else {
            console.warn('Función agregarAlCarrito no encontrada en client.js');
        }
    },

    // Lógica para el 20% off en el domicilio
    aplicarDescuentoDomicilio: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId);
        if (!anuncio) return;

        // Guardamos el descuento en localStorage para que checkout.js lo lea
        localStorage.setItem('descuento_domicilio', anuncio.descuento);
        mostrarToast('¡Descuento activado!', `${anuncio.descuento%} off en tu domicilio aplicado`, 'success');
        
        // Redirigimos a la tienda si tiene tiendaId
        if (anuncio.tiendaId && anuncio.tiendaId > 0) {
            window.location.href = `index.html?tienda=${anuncio.tiendaId}`;
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    Anuncios.init();
});