// ============================================
// anuncios.js — Framework de Anuncios (App Cliente)
// ★ ACTUALIZADO: Carrusel Promocional + AutoPlay + Botón CTA Dinámico
// ★ MEJORA UX: Popup automático desactivado (Cero fricción)
// ★ BLINDAJE: Protección contra errores 404 de la API
// ★ FIX RACE CONDITION: El carrusel respeta el estado de visibilidad del contenedor
// ★ FIX v2: Validación de tienda cerrada en anuncios de tipo "tienda"
// ============================================

const Anuncios = {
    activos: [],
    anuncioDestacado: null,
    SEIS_HORAS_MS: 6 * 60 * 60 * 1000,
    CLAIM_KEY: 'domidelis_claim_timestamp',
    autoScrollInterval: null, 

    init: async function() {
        await this.cargarAnuncios();
        if (this.anuncioDestacado) {
            this.renderizarCard();
            this.mostrarPopupAutomatico(); 
        }
    },

    estaBloqueado: function() {
        const ultimoCanje = localStorage.getItem(this.CLAIM_KEY);
        if (!ultimoCanje) return false;
        const tiempoPasado = Date.now() - parseInt(ultimoCanje, 10);
        return tiempoPasado < this.SEIS_HORAS_MS;
    },

    cargarAnuncios: async function() {
        const contenedor = document.getElementById('contenedor-anuncios');
        
        // ★ INYECTAR ESTADO DE CARGA (HAMBURGUESA) ★
        if (contenedor) {
            contenedor.style.display = 'flex';
            contenedor.innerHTML = `<div class="loader-carrusel"><span>🍔</span></div>`;
        }

        try {
            const res = await fetch(`${API_URL}?action=getAnunciosActivos`);
            
            // ★ BLINDAJE: Si la respuesta no es OK (ej. 404), detenemos todo
            if (!res.ok) {
                console.error(`Error ${res.status}: No se pudieron cargar los anuncios desde la API.`);
                if (contenedor) contenedor.style.display = 'none';
                return;
            }

            const data = await res.json();
            
            if (data.success && Array.isArray(data.anuncios) && data.anuncios.length > 0) {
                this.activos = data.anuncios;
                for (let i = this.activos.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.activos[i], this.activos[j]] = [this.activos[j], this.activos[i]];
                }
                this.anuncioDestacado = this.activos[0];
            } else {
                if (contenedor) contenedor.style.display = 'none';
            }
        } catch (error) {
            console.error('Error procesando anuncios:', error);
            if (contenedor) {
                contenedor.style.display = 'none';
                contenedor.innerHTML = '';
            }
        }
    },

    // ★ FUNCIÓN ACTUALIZADA CON FIX DE RACE CONDITION ★
    renderizarCard: function() {
        const contenedor = document.getElementById('contenedor-anuncios');
        if (!contenedor) return;

        if (!this.activos || this.activos.length === 0) {
            contenedor.style.display = 'none';
            return;
        }

        // ★ FIX RACE CONDITION: solo forzamos 'flex' si la vista actual
        // NO tiene el contenedor oculto. La respuesta de la API llega
        // async y puede llegar DESPUÉS de que el usuario ya entró a una
        // categoría o al menú de una tienda (client.js ya puso
        // display:'none'). Pisar ese valor re-mostraba el carrusel
        // sobre los productos. Regla: este módulo respeta el estado
        // de visibilidad que encuentre en 'none'; solo sube a 'flex'
        // cuando estaba visible o sin estado definido.
        if (contenedor.style.display !== 'none') {
            contenedor.style.display = 'flex';
        }

        // Iteramos TODOS los anuncios activos
        contenedor.innerHTML = this.activos.map(anuncio => {
            const badgeTexto = anuncio.badgeTexto || (anuncio.tipo === 'tienda' ? 'Oferta' : (anuncio.tipo === 'domicilio' ? 'Envío' : 'Promo'));
            const tieneImagen = anuncio.imagenUrl && anuncio.imagenUrl.trim() !== '';

            // ★ NUEVA LÓGICA: Botón (CTA) dinámico según el tipo de anuncio
            let ctaHTML = '';
            if (anuncio.tipo === 'tienda') {
                ctaHTML = `<div class="promo-slide-cta"><i class="fas fa-cart-plus"></i> ¡Pídelo ya!</div>`;
            } else if (anuncio.tipo === 'domicilio') {
                ctaHTML = `<div class="promo-slide-cta"><i class="fas fa-percentage"></i> Activar ${anuncio.descuentoDomicilio || 0}% Off</div>`;
            } else if (anuncio.tipo === 'codigo') {
                ctaHTML = `<div class="promo-slide-cta"><i class="fas fa-ticket-alt"></i> Ingresar Código</div>`;
            } else {
                ctaHTML = `<div class="promo-slide-cta"><i class="fas fa-eye"></i> Ver oferta</div>`;
            }

            return `
                <div class="promo-slide" onclick="Anuncios.abrirPopup(${anuncio.id})">
                    <div class="promo-slide-img" style="background-image: url('${tieneImagen ? anuncio.imagenUrl : ''}')"></div>
                    <span class="promo-slide-badge">${badgeTexto}</span>
                    <div class="promo-slide-overlay">
                        <div class="promo-slide-title">${anuncio.titulo || 'Promoción'}</div>
                        <div class="promo-slide-subtitle">${anuncio.subtitulo || ''}</div>
                        ${ctaHTML}
                    </div>
                </div>
            `;
        }).join('');

        this.iniciarCarruselPromos(contenedor);
    },

    iniciarCarruselPromos: function(contenedor) {
        if (this.autoScrollInterval) clearInterval(this.autoScrollInterval);
        if (this.activos.length <= 1) return;

        this.autoScrollInterval = setInterval(() => {
            if (contenedor.matches(':hover')) return;

            const maxScrollLeft = contenedor.scrollWidth - contenedor.clientWidth;
            
            if (contenedor.scrollLeft >= maxScrollLeft - 10) {
                contenedor.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                const slideWidth = contenedor.querySelector('.promo-slide')?.offsetWidth || 300;
                contenedor.scrollBy({ left: slideWidth, behavior: 'smooth' });
            }
        }, 4000); 
    },

    mostrarPopupAutomatico: function() {
        return; // ★ DESACTIVADO: Evitar fricción al abrir la app.
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

                // ★ NUEVA VALIDACIÓN: Verificar si la tienda vinculada está abierta
                let tiendaCerrada = false;
                if (anuncio.tiendaId && typeof tiendas !== 'undefined' && typeof checkStoreStatus === 'function') {
                    const tienda = tiendas.find(t => t.id == anuncio.tiendaId);
                    if (tienda) {
                        const status = checkStoreStatus(tienda.horario);
                        tiendaCerrada = !status.isOpen;
                    }
                }

                if (enCarrito) {
                    htmlInterno += `
                        <div class="popup-precio">$${Number(anuncio.precioPromo).toLocaleString('es-CO')}</div>
                        <button class="popup-btn" disabled style="background:#ccc; cursor:not-allowed; box-shadow:none;">
                            <i class="fas fa-check-circle"></i> Promo en el carrito
                        </button>
                    `;
                } else if (tiendaCerrada) {
                    // ★ SI ESTÁ CERRADA, MOSTRAMOS BOTÓN DE BLOQUEO
                    htmlInterno += `
                        <div class="popup-precio">$${Number(anuncio.precioPromo).toLocaleString('es-CO')} 
                            ${anuncio.precioNormal ? `<span>$${Number(anuncio.precioNormal).toLocaleString('es-CO')}</span>` : ''}
                        </div>
                        <button class="popup-btn" disabled style="background:#b0b0b0; cursor:not-allowed; box-shadow:none;">
                            <i class="fas fa-clock"></i> Tienda Cerrada
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
            // ★ CAPTURAMOS EL RETORNO DE agregarAlCarrito
            const exito = agregarAlCarrito(productoPromo, 1);
            
            // Si devuelve false, significa que la tienda está cerrada. 
            // ¡No bloqueamos al usuario y salimos!
            if (!exito) {
                return;
            }
            
            // Solo si fue exitoso, guardamos el bloqueo de 6 horas
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