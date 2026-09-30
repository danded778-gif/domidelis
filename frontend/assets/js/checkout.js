// ============================================
// checkout.js — Compatible con iOS (WhatsApp sincrónico)
// Blindado contra datos incompletos o erróneos
// Adaptado para Autocompletado de Zona
// ★ ACTUALIZADO: Lógica de descuentos de anuncios
// ★ ACTUALIZADO v2: Soporte para Extras y Complementos dinámicos
// ★ ACTUALIZADO v3: Compatible con wizard de 4 pasos (sin eventos propios)
// ★ ACTUALIZADO v4: Badge "+30%..." reemplazado por botón "¿Por qué?"
//                   + modal explicativo (autocontenido: no requiere
//                   cambios en config.js ni styles.css)
// ============================================
(function () {
    'use strict';

    let metodoPagoSeleccionado = '';
    let propinaSeleccionada = 0;

    // ============================================
    // HELPER: OBTENER DESCUENTO DE DOMICILIO ACTIVO
    // ============================================
    function obtenerDescuentoDomicilio() {
        const desc = localStorage.getItem('descuento_domicilio');
        return desc ? parseFloat(desc) : 0;
    }

    // ============================================
    // HELPER v2: FORMATEAR EXTRAS PARA PANTALLA (HTML)
    // ============================================
    function getExtrasHtml(selecciones) {
        if (!selecciones || Object.keys(selecciones).length === 0) return '';
        let html = '<div class="resumen-prod-extras" style="font-size: 0.8rem; color: var(--gray); margin-top: 4px; padding-left: 15px; border-left: 2px solid #eee;">';
        Object.keys(selecciones).forEach(grupo => {
            const itemsGrupo = selecciones[grupo];
            if (itemsGrupo && itemsGrupo.length > 0) {
                const nombres = itemsGrupo.map(s => {
                    const c = s.cantidad || 1;
                    return c > 1 ? `${c}x ${s.nombre}` : s.nombre;
                }).join(', ');
                html += `<div style="margin-bottom: 2px;"><i class="fas fa-check" style="color: var(--success); margin-right: 5px; font-size: 0.7rem;"></i><strong>${esc(grupo)}:</strong> ${esc(nombres)}</div>`;
            }
        });
        html += '</div>';
        return html;
    }

    // ============================================
    // HELPER v2: FORMATEAR EXTRAS PARA WHATSAPP/SERVIDOR (TEXTO)
    // ============================================
    function getExtrasTexto(selecciones) {
        if (!selecciones || Object.keys(selecciones).length === 0) return '';
        let texto = '\n';
        Object.keys(selecciones).forEach(grupo => {
            const itemsGrupo = selecciones[grupo];
            if (itemsGrupo && itemsGrupo.length > 0) {
                const nombres = itemsGrupo.map(s => {
                    const c = s.cantidad || 1;
                    return c > 1 ? `${c}x ${s.nombre}` : s.nombre;
                }).join(', ');
                texto += `   ✦ ${esc(grupo)}: ${esc(nombres)}\n`;
            }
        });
        return texto;
    }

    // ============================================
    // ★ NUEVO v4: DESGLOSE DEL RECARGO MULTI-TIENDA
    // Misma matemática que calcularEnvio() (config.js):
    // factor = 1 + 0.3 × (n-1), tope ×2.0
    // Devuelve null si hay 0 o 1 tienda (nada que explicar)
    // ============================================
    function calcularDesgloseRecargo(carritoItems) {
        const zona = APP_CONFIG.zonas[APP_CONFIG.zonaActual] || APP_CONFIG.zonas.centro;
        const base = zona.envio;

        const tiendas = new Set(
            carritoItems
                .filter(item => item.tiendaId)
                .map(item => String(item.tiendaId))
        );
        const n = tiendas.size;
        if (n <= 1) return null;

        const factor = Math.min(1 + 0.3 * (n - 1), 2.0);
        const final = Math.round(base * factor);
        const pct = Math.round(Math.min(0.3 * (n - 1), 1.0) * 100);

        return { tiendas: n, base, final, delta: final - base, pct };
    }

    // ============================================
    // ★ NUEVO v4: BOTÓN "¿POR QUÉ?" junto al envío
    // Se crea solo si hay 2+ tiendas. Se elimina solo si
    // el carrito vuelve a 1 tienda.
    // ============================================
    function actualizarBotonPorQue(envioEl, desglose) {
        let btn = document.getElementById('btn-porque-envio');

        if (!desglose) {
            if (btn) btn.remove();
            return;
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-porque-envio';
            btn.className = 'btn-porque';
            btn.type = 'button';
            btn.textContent = '¿Por qué?';
            // onclick como atributo (sobrevive a los innerHTML += del descuento)
            btn.setAttribute('onclick', 'window.abrirModalEnvio()');
            envioEl.appendChild(btn);
        }
    }

    // ============================================
    // ★ NUEVO v4: MODAL "¿POR QUÉ SUBE EL ENVÍO?"
    // Ventanita explicativa con el desglose. Se crea la
    // primera vez que se necesita y se reutiliza.
    // ============================================
    function abrirModalEnvio() {
        const carrito = obtenerCarrito();
        const desglose = calcularDesgloseRecargo(carrito);
        if (!desglose) return;

        inyectarEstilosModalEnvio();

        let overlay = document.getElementById('modal-envio-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-envio-overlay';
            overlay.className = 'me-overlay';
            document.body.appendChild(overlay);
        }

        const notaExtra = obtenerDescuentoDomicilio() > 0
            ? '<div class="me-tip"><i class="fas fa-tag"></i><span>El descuento promo se aplica después sobre este envío.</span></div>'
            : '<div class="me-tip"><i class="fas fa-lightbulb"></i><span>Tip: si pides todo en una sola tienda, pagas el envío normal.</span></div>';

        overlay.innerHTML = `
            <div class="me-modal">
                <h3><i class="fas fa-motorcycle"></i> ¿Por qué sube el envío?</h3>
                <p>Tu pedido incluye productos de <strong>${desglose.tiendas} tiendas</strong>. El domiciliario hace más paradas para recoger todo, por eso el envío aumenta:</p>
                <div class="me-desglose">
                    <div class="me-fila"><span>Envío base</span><span>${formatearPrecio(desglose.base)}</span></div>
                    <div class="me-fila"><span>Recargo ${desglose.tiendas} tiendas (+${desglose.pct}%)</span><span>+${formatearPrecio(desglose.delta)}</span></div>
                    <div class="me-fila me-total"><span>Envío final</span><span>${formatearPrecio(desglose.final)}</span></div>
                </div>
                ${notaExtra}
                <button class="me-btn" onclick="document.getElementById('modal-envio-overlay').classList.remove('abierto')">Entendido</button>
            </div>
        `;

        overlay.classList.add('abierto');

        // Cerrar al tocar fuera de la ventanita
        overlay.onclick = function (e) {
            if (e.target === overlay) overlay.classList.remove('abierto');
        };
    }

    // Exponer globalmente (el botón usa onclick="window.abrirModalEnvio()")
    window.abrirModalEnvio = abrirModalEnvio;

    // ============================================
    // ★ NUEVO v4: ESTILOS DEL BOTÓN Y DEL MODAL
    // Se inyectan una sola vez en <head> — por eso este
    // archivo NO necesita cambios en styles.css
    // ============================================
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
    // INICIO
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        initZonaCheckout(); // Sincroniza el selector de zona
        renderResumen();    // Muestra los productos y calcula el envío
        initPagoSeleccion();
        // initFormSubmit();  // ← ELIMINADO: ya no se usa con wizard
        limpiarErroresAlEscribir();
        initPropina();

        // ★ MOSTRAR CÓDIGO PROMO SI EXISTE EN LA MEMORIA ★
        const codigoGuardado = localStorage.getItem('domidelis_codigo_promo');
        const grupoCodigo = document.getElementById('grupo-codigo-promo');
        const inputCodigo = document.getElementById('codigoPromoCheckout');

        if (codigoGuardado && grupoCodigo && inputCodigo) {
            grupoCodigo.style.display = 'block';
            inputCodigo.value = codigoGuardado;
        }

        // ★ Exponer procesarPedido globalmente para el wizard ★
        window.procesarPedido = procesarPedido;
    });

    // ============================================
    // SINCRONIZAR SELECTOR DE ZONA EN CHECKOUT
    // ============================================
    function initZonaCheckout() {
        const hiddenInput = document.getElementById('zona-checkout');
        if (!hiddenInput) return;

        hiddenInput.addEventListener('change', (e) => {
            APP_CONFIG.zonaActual = e.target.value;
            localStorage.setItem('zonaSeleccionada', e.target.value);

            const zonaInput = document.getElementById('zona-checkout-input');
            const zonaError = document.getElementById('zona-checkout-error');
            if (zonaInput) zonaInput.classList.remove('input-error');
            if (zonaError) zonaError.style.display = 'none';

            renderResumen();
        });
    }

    // ============================================
    // LIMPIAR ERRORES VISUALES AL ESCRIBIR
    // ============================================
    function limpiarErroresAlEscribir() {
        const zonaInput = document.getElementById('zona-checkout-input');
        if (zonaInput) {
            zonaInput.addEventListener('input', function () {
                this.classList.remove('input-error');
                const zonaError = document.getElementById('zona-checkout-error');
                if (zonaError) zonaError.style.display = 'none';
            });
        }
    }

    // ============================================
    // RENDER RESUMEN DEL CARRITO
    // ============================================
    function renderResumen() {
        const carrito = obtenerCarrito();
        const container = document.getElementById('resumenItems');
        if (!container) return;

        if (carrito.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">No hay productos en el carrito</p>';
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            return;
        }

        const tiendas = {};
        let subtotal = 0;

        carrito.forEach(item => {
            const tiendaKey = item.tiendaId || 'sin-tienda';
            const tiendaNombre = item.tiendaNombre || 'Sin tienda';

            if (!tiendas[tiendaKey]) {
                tiendas[tiendaKey] = { nombre: tiendaNombre, items: [] };
            }

            const cantidad = parseInt(item.cantidad) || 1;
            const precioUnitario = parseInt(item.precioUnitario) || parseInt(item.precio) || 0;
            const subtotalItem = parseInt(item.subtotal) || (precioUnitario * cantidad);
            subtotal += subtotalItem;

            tiendas[tiendaKey].items.push({ ...item, subtotalItem, precioUnitario, cantidad });
        });

        let html = '';
        const tiendaKeys = Object.keys(tiendas);

        tiendaKeys.forEach((key, idx) => {
            const tienda = tiendas[key];
            html += `<div class="resumen-tienda-bloque">
            <div class="resumen-tienda-header">
                <i class="fas fa-store"></i> ${esc(tienda.nombre)}
            </div>
            <div class="resumen-tienda-productos">`;

            tienda.items.forEach(item => {
                // ★ NUEVO v2: Agregar HTML de los extras seleccionados
                const extrasHtml = getExtrasHtml(item.selecciones);

                html += `<div class="resumen-producto">
                    <div class="resumen-prod-info">
                        <span class="resumen-prod-nombre">${escapeQuotes(item.nombre)}</span>
                        <span class="resumen-prod-detalle">
                            ${item.cantidad}x — ${formatearPrecio(item.precioUnitario)} c/u
                        </span>
                        ${extrasHtml}
                    </div>
                    <span class="resumen-prod-precio">${formatearPrecio(item.subtotalItem)}</span>
                </div>`;
            });

            html += `</div></div>`;

            if (idx < tiendaKeys.length - 1) {
                html += `<hr class="resumen-divider">`;
            }
        });

        container.innerHTML = html;

        // ★ LÓGICA DE ENVÍO Y DESCUENTO ★
        const envioBase = calcularEnvio(carrito);
        const descuentoPct = obtenerDescuentoDomicilio();
        let envioFinal = envioBase;
        let descuentoValor = 0;

        if (descuentoPct > 0) {
            descuentoValor = Math.round((envioBase * descuentoPct) / 100);
            envioFinal = envioBase - descuentoValor;
        }

        const total = subtotal + envioFinal;

        document.getElementById('resumenSubtotal').textContent = formatearPrecio(subtotal);

        const envioEl = document.getElementById('resumenEnvio');

        // ★ v4: ANTES aquí iba el badge rojo "+30% aplicado por 2 tiendas"
        // AHORA: precio limpio + botón "¿Por qué?" (solo si hay 2+ tiendas)
        const desglose = calcularDesgloseRecargo(carrito);
        envioEl.textContent = formatearPrecio(envioFinal);
        actualizarBotonPorQue(envioEl, desglose);

        if (descuentoPct > 0) {
            envioEl.innerHTML += ` <span style="color:var(--success); font-weight:700; font-size:0.8rem;">(-${descuentoPct}%)</span>`;
        }

        document.getElementById('resumenTotal').textContent = formatearPrecio(total);
    }

    // ============================================
    // SELECCION METODO DE PAGO
    // ============================================
    function initPagoSeleccion() {
        const opciones = document.querySelectorAll('.opcion-pago');
        opciones.forEach(op => {
            op.addEventListener('click', () => {
                opciones.forEach(o => o.classList.remove('selected'));
                op.classList.add('selected');
                metodoPagoSeleccionado = op.dataset.metodo;
                document.getElementById('metodoPago').value = metodoPagoSeleccionado;
            });
        });
    }

    // ============================================
    // ★ PROCESAR PEDIDO (ahora invocable desde el wizard)
    // ============================================
    function procesarPedido() {
        // --- Leer datos directamente del DOM (igual que antes) ---
        const nombre = document.getElementById('nombre').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const direccion = document.getElementById('direccion').value.trim();
        const referencias = document.getElementById('referencias').value.trim();
        const metodoPago = metodoPagoSeleccionado;
        const carrito = obtenerCarrito();

        const zonaHidden = document.getElementById('zona-checkout');
        const zonaInput = document.getElementById('zona-checkout-input');
        const zonaError = document.getElementById('zona-checkout-error');
        const zonaValue = zonaHidden ? zonaHidden.value : '';

        // ============================================================
        // ★ MURO DE SEGURIDAD (validaciones redundantes, por si acaso)
        // ============================================================
        if (!nombre || nombre.length < 3) {
            mostrarNotificacion('Ingresa tu nombre completo', 'error');
            document.getElementById('nombre').focus();
            return;
        }

        const telefonoValido = /^[0-9]{10}$/.test(telefono);
        if (!telefonoValido) {
            mostrarNotificacion('El teléfono debe tener exactamente 10 números', 'error');
            document.getElementById('telefono').focus();
            return;
        }

        if (!direccion) {
            mostrarNotificacion('Ingresa la dirección de entrega', 'error');
            document.getElementById('direccion').focus();
            return;
        }

        if (!zonaValue) {
            if (zonaInput) zonaInput.classList.add('input-error');
            if (zonaError) zonaError.style.display = 'block';
            if (zonaInput) zonaInput.focus();
            mostrarNotificacion('Selecciona tu zona de envío', 'error');
            return;
        }

        if (!metodoPago) {
            mostrarNotificacion('Selecciona un método de pago', 'error');
            return;
        }

        if (carrito.length === 0) {
            mostrarNotificacion('El carrito está vacío', 'error');
            return;
        }

        // ============================================================
        // SI LLEGA HASTA AQUÍ, TODOS LOS DATOS SON CORRECTOS
        // ============================================================

        const zonaObj = (typeof ZONAS !== 'undefined') ? ZONAS.find(z => z.id === zonaValue) : null;
        const barrio = zonaObj ? zonaObj.nombre : zonaValue;
        const zonaNombre = barrio;

        APP_CONFIG.zonaActual = zonaValue;

        let subtotal = 0;
        carrito.forEach(item => {
            const precio = parseInt(item.precioUnitario) || parseInt(item.precio) || 0;
            const cant = parseInt(item.cantidad) || 1;
            subtotal += (item.subtotal) ? parseInt(item.subtotal) : (precio * cant);
        });
        const envioBase = calcularEnvio(carrito);
        const descuentoPct = obtenerDescuentoDomicilio();
        let descuentoValor = 0;
        let envioFinal = envioBase;

        if (descuentoPct > 0) {
            descuentoValor = Math.round((envioBase * descuentoPct) / 100);
            envioFinal = envioBase - descuentoValor;
        }

        const total = subtotal + envioFinal;
        const propina = propinaSeleccionada > 0 ? propinaSeleccionada : 0;

        const pedidoId = Date.now().toString(36).toUpperCase() +
            Math.random().toString(36).substring(2, 5).toUpperCase();

        const mensaje = construirMensaje({
            pedidoId, nombre, telefono, direccion,
            barrio, referencias, metodoPago,
            zonaNombre, envio: envioFinal, envioBase, descuentoPct, descuentoValor, subtotal, total,
            items: carrito
        });

        sessionStorage.setItem('ultimoPedido', JSON.stringify({
            pedidoId, nombre, total, metodoPago
        }));

        abrirWhatsAppiOS(mensaje);

        setTimeout(() => {
            guardarPedidoServidor({
                pedidoId, nombre, telefono, direccion,
                barrio, referencias, metodoPago,
                zona: zonaValue, envio: envioFinal,
                subtotal, total, propina, items: carrito,
                fcmToken: (window.obtenerTokenFCMGuardado && window.obtenerTokenFCMGuardado()) || localStorage.getItem('domidelis_fcm_token') || ''
            });
            localStorage.removeItem('domidelis_codigo_promo');
            localStorage.removeItem('descuento_domicilio');
        }, 500);
        setTimeout(() => {
            window.location.href = 'confirmacion.html';
        }, 800);
    }

    // ============================================
    // ABRIR WHATSAPP — Maxima compatibilidad iOS/Android/PC
    // ============================================
    function abrirWhatsAppiOS(mensaje) {
        const telefono = APP_CONFIG.telefonoWhatsApp.replace(/\D/g, '');
        const urlBase = 'https://wa.me/' + telefono;

        let msg = mensaje;
        const urlCompleta = urlBase + '?text=' + encodeURIComponent(msg);

        if (urlCompleta.length > 3800) {
            msg = compactarMensaje(mensaje);
        }

        const url = urlBase + '?text=' + encodeURIComponent(msg);

        const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const esStandalone = window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;

        if (esIOS) {
            const oldLink = document.getElementById('wa-link-temp');
            if (oldLink) oldLink.remove();

            const link = document.createElement('a');
            link.id = 'wa-link-temp';
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';

            if (esStandalone) {
                link.href = 'whatsapp://send?phone=' + telefono + '&text=' + encodeURIComponent(msg);
                setTimeout(() => {
                    const fallbackLink = document.createElement('a');
                    fallbackLink.href = url;
                    fallbackLink.target = '_blank';
                    fallbackLink.rel = 'noopener noreferrer';
                    fallbackLink.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
                    document.body.appendChild(fallbackLink);
                    fallbackLink.click();
                    setTimeout(() => fallbackLink.remove(), 1000);
                }, 1000);
            }

            document.body.appendChild(link);
            const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
            link.dispatchEvent(event);
            link.click();
            setTimeout(() => { if (link.parentNode) link.remove(); }, 2000);

        } else {
            window.open(url, '_blank');
        }
    }

    // ============================================
    // COMPACTAR MENSAJE (Si se pasa de largo)
    // ============================================
    function compactarMensaje(mensajeCompleto) {
        const carrito = obtenerCarrito();
        const pedidoData = (() => {
            try { return JSON.parse(sessionStorage.getItem('ultimoPedido')) || {}; }
            catch (e) { return {}; }
        })();

        const nombre = document.getElementById('nombre')?.value.trim() || '';
        const telefono = document.getElementById('telefono')?.value.trim() || '';
        const direccion = document.getElementById('direccion')?.value.trim() || '';
        const total = document.getElementById('resumenTotal')?.textContent || '';
        const pago = metodoPagoSeleccionado || '';

        const tiendas = {};
        carrito.forEach(item => {
            const key = item.tiendaNombre || 'Sin tienda';
            if (!tiendas[key]) tiendas[key] = [];
            let line = `${item.cantidad}x ${esc(item.nombre)}`;
            // ★ Incluir extras en el mensaje compactado
            if (item.selecciones) {
                const ext = getExtrasTexto(item.selecciones).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                if (ext) line += ` (${ext})`;
            }
            tiendas[key].push(line);
        });

        let msg = `*PEDIDO #${pedidoData.pedidoId || ''}*\n`;
        msg += `Cliente: ${nombre} | Tel: ${telefono}\n`;
        msg += `Dir: ${direccion}\n`;
        msg += `Pago: ${pago} | Total: ${total}\n`;
        msg += `─────────────\n`;

        Object.entries(tiendas).forEach(([tienda, items]) => {
            msg += `*${tienda}:*\n`;
            items.forEach(i => { msg += `• ${i}\n`; });
        });

        return msg;
    }

    // ============================================
    // CONSTRUIR MENSAJE WHATSAPP
    // ============================================
    function construirMensaje(data) {
        const tiendas = {};
        data.items.forEach(item => {
            const key = item.tiendaId || 'sin-tienda';
            const nombre = item.tiendaNombre || 'Sin tienda';
            if (!tiendas[key]) tiendas[key] = { nombre, items: [], subtotal: 0 };
            const precio = parseInt(item.precioUnitario) || parseInt(item.precio) || 0;
            const cant = parseInt(item.cantidad) || 1;
            const sub = parseInt(item.subtotal) || (precio * cant);
            tiendas[key].items.push({ ...item, precio, cant, sub });
            tiendas[key].subtotal += sub;
        });

        let msg = `🛒 *NUEVO PEDIDO #${data.pedidoId}*\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `👤 *Cliente:* ${esc(data.nombre)}\n`;
        msg += `📱 *Teléfono:* ${data.telefono}\n`;
        msg += `📍 *Dirección:* ${esc(data.direccion)}`;
        if (data.barrio) msg += ` - ${data.barrio}`;
        msg += `\n`;
        if (data.referencias) msg += `📝 *Ref:* ${data.referencias}\n`;
        msg += `\n`;

        Object.values(tiendas).forEach(tienda => {
            msg += `🏪 *${esc(tienda.nombre)}*\n`;
            msg += `─────────────────\n`;
            tienda.items.forEach(item => {
                const cantTipo = item.cantidadTipo || 'UND';
                const extrasTxt = getExtrasTexto(item.selecciones); // ★ NUEVO v2
                // Si tiene extras, los pega debajo del nombre del producto
                if (extrasTxt) {
                    msg += `• ${item.cant}x ${esc(item.nombre)} (${cantTipo}) — ${formatearPrecio(item.sub)}\n${extrasTxt}`;
                } else {
                    msg += `• ${item.cant}x ${esc(item.nombre)} (${cantTipo}) — ${formatearPrecio(item.sub)}\n`;
                }
            });
            msg += `   Subtotal tienda: ${formatearPrecio(tienda.subtotal)}\n\n`;
        });

        msg += `━━━━━━━━━━━━━━━━━━\n`;
        msg += `💵 *Subtotal:* ${formatearPrecio(data.subtotal)}\n`;

        if (data.descuentoPct > 0) {
            msg += `🏍️ *Envío Base (${data.zonaNombre}):* ${formatearPrecio(data.envioBase)}\n`;
            msg += `📉 *Descuento Promo (${data.descuentoPct}%):* -${formatearPrecio(data.descuentoValor)}\n`;
            msg += `🏍️ *Envío Final:* ${formatearPrecio(data.envio)}\n`;
        } else {
            msg += `🏍️ *Envío (${data.zonaNombre}):* ${formatearPrecio(data.envio)}\n`;
        }

        msg += `💰 *TOTAL:* ${formatearPrecio(data.total)}\n\n`;
        msg += `💳 *Pago:* ${data.metodoPago}\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;

        const codigoPromo = localStorage.getItem('domidelis_codigo_promo');
        if (codigoPromo) {
            msg += `\n🎟️ *CÓDIGO DE PROMOCIÓN:* ${codigoPromo}\n`;
            msg += `_(Validar y aplicar descuento manualmente)_\n`;
        }
        msg += `⏰ ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`;

        return msg;
    }

    // ============================================
    // GUARDAR EN SERVIDOR
    // ============================================
    function guardarPedidoServidor(data) {
        const productosJson = JSON.stringify(data.items.map(item => ({
            id: item.id || '',
            nombre: item.nombre,
            cantidadTipo: item.cantidadTipo || 'UND',
            cantidad: parseInt(item.cantidad) || 1,
            precioUnitario: parseInt(item.precioUnitario) || parseInt(item.precio) || 0,
            subtotal: parseInt(item.subtotal) || 0,
            tiendaId: item.tiendaId || '',
            tiendaNombre: item.tiendaNombre || '',
            // ★ NUEVO v2: Enviar complementos como texto al servidor
            complementos: getExtrasTexto(item.selecciones).trim().replace(/\n/g, ' | ')
        })));

        const fechaColombia = new Date().toLocaleString('sv-SE', {
            timeZone: 'America/Bogota'
        });

        const params = new URLSearchParams({
            action: 'crearPedido',
            clienteNombre: data.nombre,
            clienteDireccion: data.direccion + (data.barrio ? ' - ' + data.barrio : ''),
            clienteTelefono: data.telefono,
            productosJson: productosJson,
            total: data.total.toString(),
            metodoPago: data.metodoPago,
            zona: data.zona,
            referencias: data.referencias || '',
            propina: (data.propina || 0).toString(),
            fecha: fechaColombia,
            // ★★★ CORREGIDO: Enviamos el token blindado a la API ★★★
            fcmToken: data.fcmToken || ''
        });

        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })
            .then(res => res.json())
            .then(resp => {
                console.log('Pedido guardado:', resp);
                limpiarCarrito();
            })
            .catch(err => {
                console.warn('No se guardo en servidor, pedido llego por WhatsApp:', err.message);
                limpiarCarrito();
            });
    }

    // ============================================
    // PROPINA PARA EL DOMICILIARIO (Dropdown bonito)
    // ============================================
    function initPropina() {
        const checkbox = document.getElementById('propinaCheckbox');
        const panel = document.getElementById('propinaPanel');
        const dropdown = document.getElementById('propinaDropdown');
        const trigger = document.getElementById('propinaDropdownTrigger');
        const menu = document.getElementById('propinaDropdownMenu');
        const textoTrigger = document.getElementById('propinaDropdownTexto');
        const items = document.querySelectorAll('.propina-dropdown-item');
        const otroGroup = document.getElementById('propinaOtroGroup');
        const otroInput = document.getElementById('propinaOtroInput');
        const resumenMini = document.getElementById('propinaResumenMini');
        const resumenMiniValor = document.getElementById('propinaResumenMiniValor');

        if (!checkbox) return;

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                panel.classList.remove('hidden-propina');
            } else {
                panel.classList.add('hidden-propina');
                resetearPropina();
            }
        });

        function resetearPropina() {
            propinaSeleccionada = 0;
            dropdown.classList.remove('active');
            items.forEach(i => i.classList.remove('selected'));
            otroGroup.classList.add('hidden-propina');
            resumenMini.classList.add('hidden-propina');
            if (otroInput) otroInput.value = '';
            textoTrigger.innerHTML = '<i class="fas fa-hand-holding-heart" style="color:var(--gray);"></i> Selecciona un motivo';
            actualizarResumenPropina();
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        items.forEach(item => {
            item.addEventListener('click', () => {
                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');

                const valor = item.dataset.valor;
                const label = item.dataset.label;
                const icono = item.querySelector('.propina-item-icon').textContent;

                if (valor === 'otro') {
                    textoTrigger.innerHTML = `<span>${icono}</span> ${label}`;
                    otroGroup.classList.remove('hidden-propina');
                    resumenMini.classList.add('hidden-propina');
                    propinaSeleccionada = parseInt(otroInput.value) || 0;
                    setTimeout(() => otroInput.focus(), 150);
                } else {
                    textoTrigger.innerHTML = `<span>${icono}</span> ${label} — ${formatearPrecio(valor)}`;
                    otroGroup.classList.add('hidden-propina');
                    propinaSeleccionada = parseInt(valor) || 0;
                    mostrarResumenMini();
                }

                dropdown.classList.remove('active');
                actualizarResumenPropina();
            });
        });

        if (otroInput) {
            otroInput.addEventListener('input', () => {
                propinaSeleccionada = parseInt(otroInput.value) || 0;
                if (propinaSeleccionada > 0) {
                    mostrarResumenMini();
                } else {
                    resumenMini.classList.add('hidden-propina');
                }
                actualizarResumenPropina();
            });
        }

        function mostrarResumenMini() {
            resumenMini.classList.remove('hidden-propina');
            resumenMiniValor.textContent = formatearPrecio(propinaSeleccionada);
        }
    }

    // ============================================
    // ACTUALIZAR RESUMEN DE PROPINA
    // ============================================
    function actualizarResumenPropina() {
        const row = document.getElementById('resumenPropinaRow');
        const valorEl = document.getElementById('resumenPropinaValor');
        if (!row || !valorEl) return;
        if (propinaSeleccionada > 0) {
            row.style.display = 'flex';
            valorEl.textContent = formatearPrecio(propinaSeleccionada);
        } else {
            row.style.display = 'none';
        }

        const resumenMiniValor = document.getElementById('propinaResumenMiniValor');
        if (resumenMiniValor && propinaSeleccionada > 0) {
            resumenMiniValor.textContent = formatearPrecio(propinaSeleccionada);
        }
    }

})();