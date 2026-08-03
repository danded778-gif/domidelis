// ============================================
// checkout.js — Compatible con iOS (WhatsApp sincrónico)
// Blindado contra datos incompletos o erróneos
// Adaptado para Autocompletado de Zona
// ★ ACTUALIZADO: Lógica de descuentos de anuncios
// ★ ACTUALIZADO v2: Soporte para Extras y Complementos dinámicos
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
    // INICIO
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        initZonaCheckout(); // Sincroniza el selector de zona
        renderResumen();    // Muestra los productos y calcula el envío
        initPagoSeleccion();
        initFormSubmit();
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
        const recargo = descripcionRecargo(carrito);

        document.getElementById('resumenSubtotal').textContent = formatearPrecio(subtotal);

        const envioEl = document.getElementById('resumenEnvio');
        if (recargo) {
            envioEl.innerHTML = `${formatearPrecio(envioFinal)} <span style="background:#fff0f0;color:#c62828;font-size:0.72rem;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px;">${recargo}</span>`;
        } else {
            envioEl.textContent = formatearPrecio(envioFinal);
        }

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

                // ★★★ CORREGIDO: Blindado leyendo de fcm-manager o directamente de LocalStorage ★★★
                fcmToken: (window.obtenerTokenFCMGuardado && window.obtenerTokenFCMGuardado()) || localStorage.getItem('domidelis_fcm_token') || ''
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