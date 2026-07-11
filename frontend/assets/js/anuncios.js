// ============================================
// anuncios.js — Framework de Anuncios (App Cliente)
// ★ ACTUALIZADO: Términos y Condiciones + Badge Personalizable
// ============================================

const Anuncios = {
    activos: [],
    anuncioDestacado: null,
    SEIS_HORAS_MS: 6 * 60 * 60 * 1000,
    CLAIM_KEY: 'domidelis_claim_timestamp',

        init: async function() {
        await this.cargarAnuncios();
        if (this.anuncioDestacado) {
            this.renderizarCard(); // ★ ESTA LÍNEA FALTA EN TU CÓDIGO, ES VITAL
        }
    },

    estaBloqueado: function() {
        const ultimoCanje = localStorage.getItem(this.CLAIM_KEY);
        if (!ultimoCanje) return false;
        const tiempoPasado = Date.now() - parseInt(ultimoCanje, 10);
        return tiempoPasado < this.SEIS_HORAS_MS;
    },

    cargarAnuncios: async function() {
        try {
            const res = await fetch(`${API_URL}?action=getAnunciosActivos`);
            const data = await res.json();
            if (data.success && Array.isArray(data.anuncios) && data.anuncios.length > 0) {
                this.activos = data.anuncios;
                for (let i = this.activos.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.activos[i], this.activos[j]] = [this.activos[j], this.activos[i]];
                }
                this.anuncioDestacado = this.activos[0];
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
        }
    },

    renderizarCard: function() {
        const contenedor = document.getElementById('contenedor-anuncios');
        if (!contenedor || !this.anuncioDestacado) return;

        const anuncio = this.anuncioDestacado;
        // ★ Badge personalizado o default
        const badgeTexto = anuncio.badgeTexto || (anuncio.tipo === 'tienda' ? 'Oferta' : (anuncio.tipo === 'domicilio' ? 'Descuento' : 'Promo'));
        
        let precioHtml = '';
        if (anuncio.tipo === 'tienda' && anuncio.precioPromo > 0) {
            precioHtml = `<div class="anuncio-card-price">$${Number(anuncio.precioPromo).toLocaleString('es-CO')} 
                ${anuncio.precioNormal ? `<small>$${Number(anuncio.precioNormal).toLocaleString('es-CO')}</small>` : ''}
            </div>`;
        } else if (anuncio.tipo === 'domicilio') {
            precioHtml = `<div class="anuncio-card-price" style="font-size: 1rem; color: var(--accent);">${anuncio.descuentoDomicilio}% OFF Envío</div>`;
        } else if (anuncio.tipo === 'codigo') {
            precioHtml = `<div class="anuncio-card-price" style="font-size: 1rem; color: var(--secondary);">¡Ingresa y Gana!</div>`;
        }

        contenedor.innerHTML = `
            <div class="anuncio-card" onclick="Anuncios.abrirPopup(${anuncio.id})">
                <div class="anuncio-card-img" style="background-image: url('${anuncio.imagenUrl || ''}')">
                    <span class="anuncio-badge-card">${badgeTexto}</span>
                </div>
                <div class="anuncio-card-content">
                    <div>
                        <h3 class="anuncio-card-title">${anuncio.titulo || ''}</h3>
                        <p class="anuncio-card-subtitle">${anuncio.subtitulo || ''}</p>
                    </div>
                    <div class="anuncio-card-footer">
                        ${precioHtml}
                        <button class="anuncio-card-btn" onclick="event.stopPropagation(); Anuncios.abrirPopup(${anuncio.id})">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    mostrarPopupAutomatico: function() {
        const POPUP_KEY = 'domidelis_popup_timestamp';
        const AHORA = Date.now();
        const ultimaVezVisto = localStorage.getItem(POPUP_KEY);
        if (ultimaVezVisto && (AHORA - parseInt(ultimaVezVisto, 10) < this.SEIS_HORAS_MS)) return; 
        if (!this.anuncioDestacado) return;

        setTimeout(() => {
            this.abrirPopup(this.anuncioDestacado.id);
            localStorage.setItem(POPUP_KEY, AHORA.toString());
        }, 2500);
    },

    abrirPopup: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId) || this.anuncioDestacado;
        if (!anuncio) return;

        const existing = document.getElementById('anuncioPopupOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'anuncio-popup-overlay';
        overlay.id = 'anuncioPopupOverlay';
        
        const bloqueado = this.estaBloqueado();
        const badgeTexto = anuncio.badgeTexto || (anuncio.tipo === 'domicilio' ? 'Descuento' : 'Promoción');

        let htmlInterno = `
            <div class="popup-anuncio">
                <div class="popup-header-bar"></div>
                <button class="popup-cerrar" onclick="Anuncios.cerrarPopup()"><i class="fas fa-times"></i></button>
                
                <div class="popup-imagen-wrap">
                    ${anuncio.imagenUrl ? `<img src="${anuncio.imagenUrl}" alt="${anuncio.titulo}">` : '<div class="popup-emoji-grande">🍔🥃</div>'}
                    <span class="popup-badge">${badgeTexto}</span>
                </div>
                
                <div class="popup-contenido">
                    <div class="popup-subtitulo">${anuncio.subtitulo || 'Oferta Exclusiva'}</div>
                    <h2>${anuncio.titulo || ''}</h2>
        `;

        if (bloqueado) {
            htmlInterno += `
                <p>Ya has canjeado una promoción recientemente. ¡Vuelve pronto para más ofertas!</p>
                <button class="popup-btn" disabled style="background:#ccc; cursor:not-allowed; box-shadow:none;">
                    <i class="fas fa-clock"></i> Promo Canjeada (6h)
                </button>
            `;
        } else {
            if (anuncio.tipo === 'tienda' && anuncio.precioPromo > 0) {
                const carritoActual = typeof obtenerCarrito === 'function' ? obtenerCarrito() : [];
                const enCarrito = carritoActual.some(item => item.id === `promo_${anuncio.id}`);

                if (enCarrito) {
                    htmlInterno += `
                        <div class="popup-precio">$${Number(anuncio.precioPromo).toLocaleString('es-CO')}</div>
                        <button class="popup-btn" disabled style="background:#ccc; cursor:not-allowed; box-shadow:none;">
                            <i class="fas fa-check-circle"></i> Promo en el carrito
                        </button>
                    `;
                } else {
                    htmlInterno += `
                        <div class="popup-precio">$${Number(anuncio.precioPromo).toLocaleString('es-CO')} 
                            ${anuncio.precioNormal ? `<span>$${Number(anuncio.precioNormal).toLocaleString('es-CO')}</span>` : ''}
                        </div>
                        <button class="popup-btn" onclick="Anuncios.agregarPromoCarrito(${anuncio.id})">
                            <i class="fas fa-cart-plus"></i> Agregar al Carrito
                        </button>
                    `;
                }
            } else if (anuncio.tipo === 'domicilio' && anuncio.descuentoDomicilio > 0) {
                htmlInterno += `
                    <p>Activa este descuento y obtén <strong>${anuncio.descuentoDomicilio}% OFF</strong> en el costo de tu domicilio.</p>
                    <button class="popup-btn" onclick="Anuncios.aplicarDescuentoDomicilio(${anuncio.id})">
                        <i class="fas fa-percentage"></i> Activar Descuento
                    </button>
                `;
            } else if (anuncio.tipo === 'codigo') {
                htmlInterno += `
                    <p>¿Viste nuestro anuncio? Escribe el código aquí y obtén beneficios en tu pedido.</p>
                    <input type="text" id="popupInputCodigo" class="popup-input-codigo" placeholder="Escribe tu código">
                    <button class="popup-btn" onclick="Anuncios.validarCodigo(${anuncio.id})">
                        <i class="fas fa-check"></i> Validar Código
                    </button>
                `;
            } else {
                 htmlInterno += `<button class="popup-btn" onclick="Anuncios.cerrarPopup()">Cerrar</button>`;
            }
        }

        // ★ Lógica de Términos y Condiciones
        let terminosHtml = '';
        if (anuncio.urlTerminos) {
            terminosHtml = `<a href="${anuncio.urlTerminos}" target="_blank" style="display:block; margin-top:10px; font-size:11px; color:var(--gray); text-decoration:underline;">Aplican Términos y Condiciones</a>`;
        }

        htmlInterno += `
                    <p class="popup-nota">El código se aplicará al finalizar tu compra.</p>
                    ${terminosHtml}
                </div>
            </div>
        `;

        overlay.innerHTML = htmlInterno;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        void overlay.offsetWidth;
        overlay.classList.add('active');
    },

    cerrarPopup: function() {
        const overlay = document.getElementById('anuncioPopupOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => overlay.remove(), 400);
        }
    },

    agregarPromoCarrito: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId) || this.anuncioDestacado;
        if (!anuncio) return;

        if (this.estaBloqueado()) {
            return mostrarToast && mostrarToast('Lo sentimos', 'Ya canjeaste una promo en las últimas 6 horas', 'error');
        }

        const productoPromo = {
            id: `promo_${anuncio.id}`,
            nombre: anuncio.titulo,
            descripcion: anuncio.subtitulo,
            precio: parseFloat(anuncio.precioPromo),
            tiendaId: anuncio.tiendaId || 0,
            tiendaNombre: 'Promoción'
        };

        if (typeof agregarAlCarrito === 'function') {
            agregarAlCarrito(productoPromo, 1);
            localStorage.setItem(this.CLAIM_KEY, Date.now().toString());
        }
        this.cerrarPopup();
    },

    aplicarDescuentoDomicilio: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId) || this.anuncioDestacado;
        if (!anuncio) return;

        if (this.estaBloqueado()) {
            this.cerrarPopup();
            return;
        }

        localStorage.setItem('descuento_domicilio', anuncio.descuentoDomicilio);
        localStorage.setItem(this.CLAIM_KEY, Date.now().toString());
        
        if (typeof mostrarToast === 'function') {
            mostrarToast('¡Descuento activado!', `${anuncio.descuentoDomicilio}% off en tu domicilio`, 'success');
        }
        this.cerrarPopup();
    },

    validarCodigo: function(anuncioId) {
        const anuncio = this.activos.find(a => a.id === anuncioId) || this.anuncioDestacado;
        if (!anuncio) return;

        if (this.estaBloqueado()) {
            return mostrarToast && mostrarToast('Lo sentimos', 'Ya canjeaste una promo en las últimas 6 horas', 'error');
        }

        const input = document.getElementById('popupInputCodigo');
        const codigoIngresado = input.value.trim().toUpperCase();
        
        if (codigoIngresado === anuncio.codigoPromo.toUpperCase()) {
            localStorage.setItem('domidelis_codigo_promo', codigoIngresado);
            localStorage.setItem(this.CLAIM_KEY, Date.now().toString());

            if (typeof mostrarToast === 'function') {
                mostrarToast('¡Código guardado!', 'Se aplicará en tu compra', 'success');
            }
            this.cerrarPopup();
        } else if (codigoIngresado !== '') {
            input.classList.add('invalid');
            input.value = '';
            input.placeholder = 'Código inválido';
            setTimeout(() => {
                input.classList.remove('invalid');
                input.placeholder = 'Escribe tu código';
            }, 2000);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    Anuncios.init();
});