/* ============================================
   DOMIDELIS - Modal de Personalización v2
   - Extras: Stepper (+/-)
   - Opciones únicas: Radio (Círculo)
   - Opciones múltiples (incluidas): Checkbox (Chulito)
   ============================================ */

(function () {
    'use strict';

    const state = {
        producto: null,
        grupos: [],
        selecciones: {},
    };

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const escHtml = (str) => {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    };

    const precio = window.formatearPrecio
        ? window.formatearPrecio
        : (n) => '$' + parseInt(n || 0).toLocaleString('es-CO');

    function iconoParaGrupo(nombreGrupo) {
        const g = (nombreGrupo || '').toLowerCase().trim();
        const mapa = {
            'salsa': 'fa-pepper-hot', 'salsas': 'fa-pepper-hot',
            'proteina': 'fa-drumstick-bite', 'proteínas': 'fa-drumstick-bite',
            'acompañamiento': 'fa-bowl-rice', 'acompanamiento': 'fa-bowl-rice',
            'sopa': 'fa-bowl-food', 'sopas': 'fa-bowl-food',
            'borde': 'fa-circle-notch', 'bordes': 'fa-circle-notch',
            'tamaño': 'fa-ruler', 'tamano': 'fa-ruler',
            'ingredientes': 'fa-bacon', 'toppings': 'fa-bacon',
            'extras': 'fa-plus-circle', 'extra': 'fa-plus-circle',
            'adiciones': 'fa-plus-circle', 'adición': 'fa-plus-circle',
            'bebida': 'fa-mug-hot', 'bebidas': 'fa-mug-hot',
            'postre': 'fa-ice-cream', 'postres': 'fa-ice-cream',
            'guarnicion': 'fa-seedling', 'guarnición': 'fa-seedling',
            'vegetales': 'fa-carrot', 'vegetal': 'fa-carrot',
        };
        return mapa[g] || 'fa-utensils';
    }

    let toastTimer = null;
    function mostrarToast(msg) {
        let toast = $('#domi-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'domi-toast';
            toast.className = 'domi-toast';
            toast.innerHTML = '<i class="fas fa-info-circle"></i><span></span>';
            document.body.appendChild(toast);
        }
        toast.querySelector('span').textContent = msg;
        toast.classList.add('domi-show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('domi-show'), 2200);
    }

    function obtenerGruposComplementos(productoId) {
        if (typeof complementosGlobal === 'undefined' || !Array.isArray(complementosGlobal)) return [];
        const comps = complementosGlobal.filter(c => String(c.id_producto) === String(productoId));
        if (comps.length === 0) return [];

        const normalizados = comps.map(c => {
            const max = (c.max !== undefined && c.max !== null) ? c.max : c.max_salsas;
            const min = c.min !== undefined ? c.min : 0;
            const grupo = c.grupo !== undefined ? c.grupo : '';
            return {
                nombre: String(c.nombre || '').trim(),
                precio: parseFloat(c.precio) || 0,
                tipo: String(c.tipo || '').trim().toLowerCase(),
                grupo: String(grupo || '').trim(),
                max: max, min: parseInt(min) || 0
            };
        }).filter(c => c.nombre !== '');

        const mapaGrupos = {};
        normalizados.forEach(c => {
            let nombreGrupo = c.grupo;
            if (!nombreGrupo) {
                if (c.tipo === 'salsa') nombreGrupo = 'Salsas';
                else if (c.tipo === 'extra') nombreGrupo = 'Extras';
                else nombreGrupo = 'Opciones';
            }
            if (!mapaGrupos[nombreGrupo]) {
                mapaGrupos[nombreGrupo] = { nombre: nombreGrupo, min: c.min, max: c.max, tipo: c.tipo, opciones: [] };
            } else {
                if (c.min > mapaGrupos[nombreGrupo].min) mapaGrupos[nombreGrupo].min = c.min;
                if (mapaGrupos[nombreGrupo].max === null && c.max !== null) mapaGrupos[nombreGrupo].max = c.max;
            }
            mapaGrupos[nombreGrupo].opciones.push(c);
        });

        const grupos = Object.values(mapaGrupos);
        grupos.sort((a, b) => (a.min > 0 && b.min === 0) ? -1 : (a.min === 0 && b.min > 0) ? 1 : 0);
        return grupos;
    }

    function calcularTotal() {
        if (!state.producto) return 0;
        const base = parseFloat(state.producto.precio) || 0;
        let complementosTotal = 0;
        Object.values(state.selecciones).forEach(items => {
            items.forEach(item => {
                complementosTotal += (parseFloat(item.precio) || 0) * (item.cantidad || 1);
            });
        });
        return base + complementosTotal;
    }

    function validarObligatorios() {
        const faltantes = [];
        state.grupos.forEach(grupo => {
            if (grupo.min > 0) {
                const count = (state.selecciones[grupo.nombre] || []).reduce((acc, item) => acc + (item.cantidad || 1), 0);
                if (count < grupo.min) faltantes.push(grupo.nombre);
            }
        });
        return faltantes;
    }

    function actualizarUI() {
        const totalEl = $('#domi-btn-add-price');
        if (totalEl) {
            const nuevo = precio(calcularTotal());
            if (totalEl.textContent !== nuevo) {
                totalEl.textContent = nuevo;
                const btn = $('#domi-btn-add');
                if (btn) { btn.classList.remove('domi-pulse'); void btn.offsetWidth; btn.classList.add('domi-pulse'); }
            }
        }

        const faltantes = validarObligatorios();
        const btn = $('#domi-btn-add');
        const btnLabel = $('#domi-btn-add-label');
        if (btn && btnLabel) {
            if (faltantes.length > 0) {
                btn.classList.add('domi-disabled');
                btn.setAttribute('disabled', 'true');
                btnLabel.textContent = faltantes.length === 1 ? `Falta: ${faltantes[0]}` : `Faltan ${faltantes.length} opciones`;
            } else {
                btn.classList.remove('domi-disabled');
                btn.removeAttribute('disabled');
                btnLabel.textContent = 'Agregar';
            }
        }
    }

    // Lógica para los botones + y - (Solo Extras)
    function cambiarCantidadOpcion(grupoNombre, opcionNombre, precioVal, delta) {
        const grupo = state.grupos.find(g => g.nombre === grupoNombre);
        if (!grupo) return;

        const seleccionesGrupo = state.selecciones[grupoNombre] || [];
        const idx = seleccionesGrupo.findIndex(s => s.nombre === opcionNombre);
        let nuevaCantidad = idx === -1 ? 0 : (seleccionesGrupo[idx].cantidad || 1);
        nuevaCantidad += delta;

        if (nuevaCantidad <= 0) {
            if (idx !== -1) state.selecciones[grupoNombre].splice(idx, 1);
        } else {
            let totalSeleccionado = state.selecciones[grupoNombre].reduce((acc, item) => acc + (item.cantidad || 1), 0);
            if (delta > 0 && grupo.max !== null && totalSeleccionado >= grupo.max) {
                mostrarToast(`Máximo ${grupo.max} en ${grupoNombre}`);
                return;
            }

            if (idx === -1) {
                state.selecciones[grupoNombre].push({ nombre: opcionNombre, precio: precioVal || 0, cantidad: nuevaCantidad });
            } else {
                state.selecciones[grupoNombre][idx].cantidad = nuevaCantidad;
            }
        }

        renderGrupo(grupo);
        actualizarUI();
    }

    // Lógica para Radio (1 opción) y Checkbox (Multiples incluidos)
    function toggleOpcion(grupoNombre, opcionNombre, precioVal, esSinSalsas) {
        const grupo = state.grupos.find(g => g.nombre === grupoNombre);
        if (!grupo) return;

        const realNombre = esSinSalsas ? 'Sin salsas' : opcionNombre;
        const seleccionesGrupo = state.selecciones[grupoNombre] || [];
        const idx = seleccionesGrupo.findIndex(s => s.nombre === realNombre);
        const estaSeleccionada = idx !== -1;

        if (esSinSalsas) {
            if (estaSeleccionada) return;
            state.selecciones[grupoNombre] = [{ nombre: 'Sin salsas', precio: 0, cantidad: 1 }];
        } else {
            // Es un Radio (max=1)
            if (grupo.max === 1) {
                if (estaSeleccionada) {
                    if (grupo.min > 0) {
                        mostrarToast(`${grupoNombre} es obligatorio`);
                        return;
                    }
                    state.selecciones[grupoNombre] = [];
                } else {
                    state.selecciones[grupoNombre] = [{ nombre: realNombre, precio: precioVal || 0, cantidad: 1 }];
                }
            }
            // Es Checkbox (Multiple incluido, max > 1 o null)
            else {
                if (estaSeleccionada) {
                    state.selecciones[grupoNombre].splice(idx, 1);
                    if (state.selecciones[grupoNombre].length === 0 && grupo.tipo === 'salsa' && grupo.min === 0) {
                        state.selecciones[grupoNombre].push({ nombre: 'Sin salsas', precio: 0, cantidad: 1 });
                    }
                } else {
                    let totalSeleccionado = state.selecciones[grupoNombre].reduce((acc, item) => acc + (item.cantidad || 1), 0);
                    if (grupo.max !== null && totalSeleccionado >= grupo.max) {
                        mostrarToast(`Máximo ${grupo.max} en ${grupoNombre}`);
                        return;
                    }
                    state.selecciones[grupoNombre] = (state.selecciones[grupoNombre] || []).filter(s => s.nombre !== 'Sin salsas');
                    state.selecciones[grupoNombre].push({ nombre: realNombre, precio: precioVal || 0, cantidad: 1 });
                }
            }
        }

        renderGrupo(grupo);
        actualizarUI();
    }

    function renderGrupo(grupo) {
        const cont = $(`#domi-grupo-${CSS.escape(grupo.nombre)}`);
        if (!cont) return;

        const seleccionesGrupo = state.selecciones[grupo.nombre] || [];

        // Determinar si este grupo usa Stepper (Solo Extras)
        const esGrupoExtra = grupo.tipo === 'extra' || grupo.nombre.toLowerCase() === 'extras' || grupo.nombre.toLowerCase() === 'adiciones';
        const esRadio = grupo.max === 1;

        let opciones = [...grupo.opciones];
        if (grupo.tipo === 'salsa' && grupo.min === 0) {
            const tieneSin = opciones.some(o => o.nombre.toLowerCase() === 'sin salsas');
            if (!tieneSin) opciones.unshift({ nombre: '__sin_salsas__', precio: 0, _esSinSalsas: true });
        }

        const items = opciones.map(o => {
            const esSinSalsas = o._esSinSalsas === true;
            const realNombre = esSinSalsas ? 'Sin salsas' : o.nombre;
            const selData = seleccionesGrupo.find(s => s.nombre === realNombre);
            const sel = !!selData;
            const cantidad = sel ? (selData.cantidad || 1) : 0;
            const priceHtml = o.precio > 0 ? `<div class="domi-row__price">+ ${precio(o.precio)}</div>` : '';

            // 1. Si es Extra, dibujar Stepper (+/-)
            if (esGrupoExtra) {
                let controlHtml = '';
                if (cantidad === 0) {
                    controlHtml = `<button class="domi-stepper__btn domi-stepper__add" data-action="cambiar-cantidad" data-delta="1" data-grupo="${escHtml(grupo.nombre)}" data-nombre="${escHtml(o.nombre)}" data-precio="${o.precio}"><i class="fas fa-plus"></i></button>`;
                } else {
                    controlHtml = `
                        <div class="domi-stepper">
                            <button class="domi-stepper__btn domi-stepper__minus" data-action="cambiar-cantidad" data-delta="-1" data-grupo="${escHtml(grupo.nombre)}" data-nombre="${escHtml(o.nombre)}" data-precio="${o.precio}"><i class="fas fa-minus"></i></button>
                            <span class="domi-stepper__qty">${cantidad}</span>
                            <button class="domi-stepper__btn domi-stepper__plus" data-action="cambiar-cantidad" data-delta="1" data-grupo="${escHtml(grupo.nombre)}" data-nombre="${escHtml(o.nombre)}" data-precio="${o.precio}"><i class="fas fa-plus"></i></button>
                        </div>
                    `;
                }
                return `
                    <div class="domi-extra-row ${cantidad > 0 ? 'domi-is-selected' : ''}">
                        <div class="domi-extra-row__label">${escHtml(o.nombre)}</div>
                        ${priceHtml}
                        ${controlHtml}
                    </div>
                `;
            }

            // 2. Si es Opción Única (Radio), dibujar Círculo
            if (esRadio || esSinSalsas) {
                const claseSinSalsas = esSinSalsas ? 'domi-is-none' : '';
                return `
                    <div class="domi-sauce-row ${claseSinSalsas} ${sel ? 'domi-is-selected' : ''}"
                         data-grupo="${escHtml(grupo.nombre)}"
                         data-nombre="${esSinSalsas ? '__sin_salsas__' : escHtml(o.nombre)}"
                         data-precio="${o.precio}"
                         data-essinsalsas="${esSinSalsas}"
                         data-action="toggle-opcion"
                         role="radio" aria-checked="${sel}" tabindex="0">
                        <div class="domi-sauce-row__circle"></div>
                        <div class="domi-sauce-row__label">${escHtml(realNombre)}</div>
                        ${priceHtml}
                    </div>
                `;
            }

            // 3. Si es Múltiple incluido (Checkbox), dibujar Cuadro con Chulito
            return `
                <div class="domi-check-row ${sel ? 'domi-is-selected' : ''}"
                     data-grupo="${escHtml(grupo.nombre)}"
                     data-nombre="${escHtml(o.nombre)}"
                     data-precio="${o.precio}"
                     data-essinsalsas="false"
                     data-action="toggle-opcion"
                     role="checkbox" aria-checked="${sel}" tabindex="0">
                    <div class="domi-check-row__box"></div>
                    <div class="domi-check-row__label">${escHtml(realNombre)}</div>
                    ${priceHtml}
                </div>
            `;
        }).join('');

        cont.innerHTML = items;

        // Accesibilidad
        $$('[data-action="toggle-opcion"]', cont).forEach(row => {
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
            });
        });
    }

    function badgeGrupo(grupo) {
        const esObligatorio = grupo.min > 0;
        const min = grupo.min || 0;
        const max = grupo.max;
        const clase = esObligatorio ? 'domi-is-required' : 'domi-is-optional';
        let texto = '';

        if (esObligatorio) {
            if (max === 1) texto = 'Obligatorio (Elige 1)';
            else if (max !== null && max > 1) texto = `Obligatorio (Elige ${min} a ${max})`;
            else texto = `Obligatorio (Mínimo ${min})`;
        } else {
            if (max === 1) texto = 'Opcional (Elige 1)';
            else if (max !== null && max > 1) texto = `Opcional (Hasta ${max})`;
            else texto = 'Opcional';
        }
        return `<span class="domi-modal__limit-badge ${clase}">${texto}</span>`;
    }

    function construirModal() {
        if ($('#domi-modal-overlay')) return;
        const html = `
        <div class="domi-modal-overlay" id="domi-modal-overlay" aria-hidden="true">
            <div class="domi-modal" id="domi-modal" role="dialog" aria-modal="true">
                <div class="domi-modal__handle" id="domi-modal-handle"></div>
                <header class="domi-modal__header">
                    <img id="domi-modal-img" class="domi-modal__img" alt="" src="" />
                    <div class="domi-modal__title-wrap">
                        <h3 class="domi-modal__title" id="domi-modal-title">Producto</h3>
                        <span class="domi-modal__price" id="domi-modal-price">$0</span>
                    </div>
                    <button class="domi-modal__close" id="domi-modal-close" aria-label="Cerrar" data-action="cerrar-modal"><i class="fas fa-times"></i></button>
                </header>
                <div class="domi-modal__body" id="domi-modal-body"></div>
                <footer class="domi-modal__footer">
                    <button class="domi-modal__btn-add" id="domi-btn-add" data-action="confirmar-modal">
                        <i class="fas fa-shopping-cart"></i>
                        <span id="domi-btn-add-label">Agregar</span>
                        <span class="domi-btn-price" id="domi-btn-add-price">$0</span>
                    </button>
                </footer>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        bindEventos();
    }

        /* ==================================================
       ABRIR MODAL
       ================================================== */
    function abrir(producto) {
        if (!producto || !producto.id) return;
        construirModal();

        state.producto = producto;
        state.grupos = obtenerGruposComplementos(producto.id);
        state.selecciones = {};

        if (state.grupos.length === 0) {
            if (typeof window.agregarAlCarrito === 'function') window.agregarAlCarrito(producto, 'UND', {}, []);
            return;
        }

        state.grupos.forEach(grupo => {
            if (grupo.tipo === 'salsa' && grupo.min === 0) state.selecciones[grupo.nombre] = [{ nombre: 'Sin salsas', precio: 0, cantidad: 1 }];
            else state.selecciones[grupo.nombre] = [];
        });

        // ★ ARREGLO: Restaurar la etiqueta img si fue destruida en una apertura anterior
        let img = $('#domi-modal-img');
        if (!img) {
            const placeholder = $('.domi-modal__img.domi-no-img');
            if (placeholder) {
                const newImg = document.createElement('img');
                newImg.id = 'domi-modal-img';
                newImg.className = 'domi-modal__img';
                placeholder.replaceWith(newImg);
                img = newImg;
            }
        }

        if (img) {
            const imgSrc = (producto.imagen_url || producto.imagen || '').trim();
            if (imgSrc && imgSrc !== 'null' && imgSrc !== 'undefined') {
                img.src = imgSrc;
                img.classList.remove('domi-no-img');
                img.style.display = 'block';
                img.onerror = () => {
                    const p = document.createElement('div'); p.className = 'domi-modal__img domi-no-img'; p.innerHTML = '<i class="fas fa-utensils"></i>';
                    img.replaceWith(p);
                };
            } else {
                const p = document.createElement('div'); p.className = 'domi-modal__img domi-no-img'; p.innerHTML = '<i class="fas fa-utensils"></i>';
                img.replaceWith(p);
            }
        }

        $('#domi-modal-title').textContent = producto.nombre || 'Producto';
        $('#domi-modal-price').textContent = precio(producto.precio);

        const body = $('#domi-modal-body');
        let sectionsHtml = state.grupos.map(grupo => `
            <section class="domi-modal__section">
                <div class="domi-modal__section-head">
                    <h4 class="domi-modal__section-title"><i class="fas ${iconoParaGrupo(grupo.nombre)}"></i> ${escHtml(grupo.nombre)}</h4>
                    ${badgeGrupo(grupo)}
                </div>
                <div id="domi-grupo-${CSS.escape(grupo.nombre)}"></div>
            </section>
        `).join('');

        body.innerHTML = `<div class="domi-modal__instruction"><i class="fas fa-hand-pointer"></i> Selecciona tus opciones</div> ${sectionsHtml}`;
        state.grupos.forEach(grupo => renderGrupo(grupo));
        actualizarUI();

        const overlay = $('#domi-modal-overlay');
        overlay.classList.add('domi-is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

        function cerrar() {
        const overlay = $('#domi-modal-overlay');
        if (!overlay) return;
        
        // ★ CORRECCIÓN: Quitar el foco de cualquier elemento interno antes de ocultar el modal
        if (document.activeElement && overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        overlay.classList.remove('domi-is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function confirmar() {
        if (!state.producto) return;
        const faltantes = validarObligatorios();
        if (faltantes.length > 0) { mostrarToast(`Falta seleccionar: ${faltantes.join(', ')}`); return; }

        const seleccionesFinal = {};
        Object.keys(state.selecciones).forEach(grupoNombre => {
            seleccionesFinal[grupoNombre] = (state.selecciones[grupoNombre] || []).filter(s => s.nombre !== 'Sin salsas');
        });

        if (typeof window.agregarAlCarrito === 'function') window.agregarAlCarrito(state.producto, 'UND', seleccionesFinal, []);
        cerrar();
    }

    function bindSwipeDown() {
        const handle = $('#domi-modal-handle');
        const overlay = $('#domi-modal-overlay');
        const modal = $('#domi-modal');
        if (!handle || !modal) return;

        let startY = 0, currentY = 0, dragging = false;
        const onStart = (y) => { dragging = true; startY = y; currentY = y; modal.style.transition = 'none'; };
        const onMove = (y) => {
            if (!dragging) return; currentY = y;
            const delta = Math.max(0, y - startY); modal.style.transform = `translateY(${delta}px)`;
            const opacity = 1 - Math.min(delta / 300, 0.5); overlay.style.background = `rgba(93, 64, 55, ${0.55 * opacity})`;
        };
        const onEnd = () => {
            if (!dragging) return; dragging = false; modal.style.transition = ''; overlay.style.background = '';
            if (currentY - startY > 100) { cerrar(); modal.style.transform = ''; } else { modal.style.transform = ''; }
        };
        handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
        handle.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
        handle.addEventListener('touchend', onEnd);
        handle.addEventListener('mousedown', (e) => { onStart(e.clientY); e.preventDefault(); });
        document.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientY); });
        document.addEventListener('mouseup', onEnd);
    }

    function bindEventos() {
        const overlay = $('#domi-modal-overlay');
        if (!overlay) return;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) return cerrar();

            const trigger = e.target.closest('[data-action]');
            if (!trigger) return;
            const action = trigger.dataset.action;

            if (action === 'cerrar-modal') cerrar();
            else if (action === 'toggle-opcion') {
                toggleOpcion(trigger.dataset.grupo, trigger.dataset.nombre, parseFloat(trigger.dataset.precio) || 0, trigger.dataset.essinsalsas === 'true');
            } else if (action === 'cambiar-cantidad') {
                cambiarCantidadOpcion(trigger.dataset.grupo, trigger.dataset.nombre, parseFloat(trigger.dataset.precio) || 0, parseInt(trigger.dataset.delta));
            } else if (action === 'confirmar-modal') confirmar();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('domi-is-open')) cerrar();
        });
        bindSwipeDown();
    }

    window.DomiModal = {
        abrir: abrir,
        cerrar: cerrar,
        tieneComplementos: (productoId) => obtenerGruposComplementos(productoId).length > 0
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construirModal);
    else construirModal();

})();