// ============================================
// checkout.js — Compatible con iOS (WhatsApp sincrónico)
// Blindado contra datos incompletos o erróneos
// Adaptado para Autocompletado de Zona
// ★ ACTUALIZADO: Lógica de descuentos de anuncios
// ============================================
(function () {
    'use strict';

    let metodoPagoSeleccionado = '';

    // ============================================
    // HELPER: OBTENER DESCUENTO DE DOMICILIO ACTIVO
    // ============================================
    function obtenerDescuentoDomicilio() {
        const desc = localStorage.getItem('descuento_domicilio');
        return desc ? parseFloat(desc) : 0;
    }

    // ============================================
    // INICIO
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        initZonaCheckout(); // Sincroniza el selector de zona
        renderResumen();    // Muestra los productos y calcula el envío
        initPagoSeleccion();
        initFormSubmit();
        limpiarErroresAlEscribir();
        
        // ★ MOSTRAR CÓDIGO PROMO SI EXISTE EN LA MEMORIA ★
        const codigoGuardado = localStorage.getItem('domidelis_codigo_promo');
        const grupoCodigo = document.getElementById('grupo-codigo-promo');
        const inputCodigo = document.getElementById('codigoPromoCheckout');

        if (codigoGuardado && grupoCodigo && inputCodigo) {
            grupoCodigo.style.display = 'block';
            inputCodigo.value = codigoGuardado;
        }
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
            zonaInput.addEventListener('input', function() {
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
                <i class="fas fa-store"></i> ${tienda.nombre}
            </div>
            <div class="resumen-tienda-productos">`;

            tienda.items.forEach(item => {
                html += `<div class="resumen-producto">
                <div class="resumen-prod-info">
                    <span class="resumen-prod-nombre">${escapeQuotes(item.nombre)}</span>
                    <span class="resumen-prod-detalle">
                        ${item.cantidad}x — ${formatearPrecio(item.precioUnitario)} c/u
                    </span>
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
        const recargo = descripcionRecargo(carrito);

        document.getElementById('resumenSubtotal').textContent = formatearPrecio(subtotal);

        const envioEl = document.getElementById('resumenEnvio');
        if (recargo) {
            envioEl.innerHTML = `${formatearPrecio(envioFinal)} <span style="background:#fff0f0;color:#c62828;font-size:0.72rem;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px;">${recargo}</span>`;
        } else {
            envioEl.textContent = formatearPrecio(envioFinal);
        }

        // ★ Mostrar el badge verde de descuento aplicado
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
    // CAPTURAR SUBMIT DEL FORMULARIO
    // ============================================
    function initFormSubmit() {
        const form = document.getElementById('formCheckout');
        const btn = document.getElementById('btnConfirmar');

        if (!form || !btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            procesarPedido();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            procesarPedido();
        });
    }

    // ============================================
    // PROCESAR PEDIDO (VALIDACIONES BLINDADAS)
    // ============================================
    function procesarPedido() {
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
        // ★ MURO DE SEGURIDAD ★
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
        
        // ★ Cálculo con descuento para el servidor y WhatsApp ★
        const envioBase = calcularEnvio(carrito);
        const descuentoPct = obtenerDescuentoDomicilio();
        let descuentoValor = 0;
        let envioFinal = envioBase;

        if (descuentoPct > 0) {
            descuentoValor = Math.round((envioBase * descuentoPct) / 100);
            envioFinal = envioBase - descuentoValor;
        }

        const total = subtotal + envioFinal;

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
                subtotal, total, items: carrito
            });
            // ★ Limpiar promociones usadas
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
            tiendas[key].push(`${item.cantidad}x ${item.nombre}`);
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
        msg += `👤 *Cliente:* ${data.nombre}\n`;
        msg += `📱 *Teléfono:* ${data.telefono}\n`;
        msg += `📍 *Dirección:* ${data.direccion}`;
        if (data.barrio) msg += ` - ${data.barrio}`;
        msg += `\n`;
        if (data.referencias) msg += `📝 *Ref:* ${data.referencias}\n`;
        msg += `\n`;

        Object.values(tiendas).forEach(tienda => {
            msg += `🏪 *${tienda.nombre}*\n`;
            msg += `─────────────────\n`;
            tienda.items.forEach(item => {
                const cantTipo = item.cantidadTipo || 'UND';
                msg += `• ${item.cant}x ${item.nombre} (${cantTipo}) — ${formatearPrecio(item.sub)}\n`;
            });
            msg += `   Subtotal tienda: ${formatearPrecio(tienda.subtotal)}\n\n`;
        });

        msg += `━━━━━━━━━━━━━━━━━━\n`;
        msg += `💵 *Subtotal:* ${formatearPrecio(data.subtotal)}\n`;
        
        // ★ Lógica de descuento en el mensaje de WhatsApp ★
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
            total: data.total.toString(), // ★ Ya viene con el descuento aplicado
            metodoPago: data.metodoPago,
            zona: data.zona,
            referencias: data.referencias || '',
            fecha: fechaColombia
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

})();