/* ============================================
   confirmar-pedido.js — Confirmación consciente del pedido
   Ubicación: /frontend/assets/js/cliente/confirmar-pedido.js
   ★ Solo se incluye en checkout.html (después de checkout.js)

   ★ QUÉ HACE (sin tocar checkout.js ni el wizard)
   1. Aviso fijo en el paso 3: advierte la irreversibilidad
      cuando el cliente ve el total por primera vez.
   2. Envuelve window.procesarPedido: al tocar "Confirmar por
      WhatsApp" aparece un pop-up con el resumen final
      (tiendas, total, dirección, zona, pago, propina) y dos
      botones. Solo [Sí, enviar] ejecuta el flujo original.
   3. Si faltan datos (pago, dirección...), NO muestra el pop-up:
      deja pasar la llamada original para que aparezcan los
      mensajes de error de siempre, con sus focus.

   ★ REGLAS
   - Sin timer: se cierra solo con los botones.
   - Anti doble-envío: mientras el pop-up está abierto o el pedido
     viaja, se ignora cualquier llamada extra.
   - Autocontenido: inyecta sus propios estilos (prefijo cpd-*).
     Si se quita el archivo y su <script>, todo vuelve a como estaba.
   ============================================ */

(function () {
    'use strict';

    if (window.ConfirmarPedido) return; // protección anti-doble-carga

    let modalAbierto = false;
    let enviando = false;

    // ─── ESTILOS (prefijo propio cpd-*, inyectados UNA vez) ───
    function inyectarEstilos() {
        if (document.getElementById('estilos-confirmar-pedido')) return;
        const style = document.createElement('style');
        style.id = 'estilos-confirmar-pedido';
        style.textContent = `
            /* Aviso fijo del paso 3 */
            .cpd-aviso {
                display:flex; gap:8px; align-items:flex-start;
                background:#FFF8E1; border:1px solid #E0C9A6;
                border-radius:10px; padding:8px 12px;
                font-size:.78rem; color:#7A5C00; line-height:1.4;
                margin-top:.75rem;
            }
            .cpd-aviso i { color:#F9A825; margin-top:2px; flex-shrink:0; }

            /* Pop-up de confirmación */
            .cpd-overlay {
                display:none; position:fixed; inset:0;
                background:rgba(0,0,0,.6); z-index:11000;
                align-items:center; justify-content:center; padding:20px;
            }
            .cpd-overlay.abierto { display:flex; }
            .cpd-modal {
                background:#fff; border-radius:20px; padding:24px;
                max-width:380px; width:100%;
                font-family:'Poppins',sans-serif;
                animation:cpdAparecer .25s ease;
                max-height:85vh; overflow-y:auto;
            }
            @keyframes cpdAparecer { from { transform:scale(.9); opacity:0; } to { transform:scale(1); opacity:1; } }

            .cpd-modal h3 {
                color:#3E2723; font-size:1.05rem; margin-bottom:14px;
                display:flex; align-items:center; gap:8px;
            }
            .cpd-modal h3 i { color:#E63946; }

            .cpd-datos {
                background:#F7F7F7; border-radius:12px;
                padding:12px 14px; margin-bottom:14px;
            }
            .cpd-fila {
                display:flex; justify-content:space-between; gap:10px;
                font-size:.85rem; padding:4px 0; color:#3E2723;
            }
            .cpd-fila span:first-child { color:#666; flex-shrink:0; }
            .cpd-fila span:last-child { font-weight:600; text-align:right; }
            .cpd-fila.cpd-total { border-top:1px dashed #ccc; margin-top:6px; padding-top:8px; }
            .cpd-fila.cpd-total span:last-child { color:#E63946; font-size:1rem; }

            .cpd-advertencia {
                background:#FFF0F0; border:1px solid #F8C9C9;
                border-radius:12px; padding:10px 12px; margin-bottom:16px;
                font-size:.8rem; color:#8B2635; line-height:1.45;
                display:flex; gap:8px; align-items:flex-start;
            }
            .cpd-advertencia i { color:#E63946; margin-top:2px; flex-shrink:0; }

            .cpd-botones { display:flex; gap:10px; }
            .cpd-btn-volver {
                flex:1; background:#fff; color:#666;
                border:2px solid #e0e0e0; border-radius:25px; padding:11px;
                font-size:.9rem; font-weight:600; font-family:inherit; cursor:pointer;
                min-height:44px;
            }
            .cpd-btn-volver:hover { border-color:#999; }
            .cpd-btn-enviar {
                flex:1.4; background:#25D366; color:#fff;
                border:none; border-radius:25px; padding:11px;
                font-size:.9rem; font-weight:700; font-family:inherit; cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:7px;
                min-height:44px;
            }
            .cpd-btn-enviar:hover { background:#128C7E; }
        `;
        document.head.appendChild(style);
    }

    // ─── AVISO FIJO EN EL PASO 3 ──────────────
    function insertarAvisoPaso3() {
        if (document.getElementById('cpd-aviso-paso3')) return;
        const form = document.getElementById('formPaso3');
        if (!form) return;

        const acciones = form.querySelector('.checkout-acciones');
        const aviso = document.createElement('div');
        aviso.id = 'cpd-aviso-paso3';
        aviso.className = 'cpd-aviso';
        aviso.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
            <span><strong>Ojo:</strong> al confirmar por WhatsApp tu pedido entra a preparación
            y ya no se puede cancelar desde la app. Revísalo bien antes de enviar.</span>`;

        if (acciones && acciones.parentNode) {
            acciones.parentNode.insertBefore(aviso, acciones);
        } else {
            form.appendChild(aviso);
        }
    }

    // ─── ¿DATOS COMPLETOS? (solo la "condición de puerta" —
    //     los mensajes de error reales siguen viviendo en
    //     procesarPedido, que es el único que valida de verdad) ───
    function datosCompletos() {
        const nombre = (document.getElementById('nombre')?.value || '').trim();
        const telefono = (document.getElementById('telefono')?.value || '').trim();
        const direccion = (document.getElementById('direccion')?.value || '').trim();
        const zona = document.getElementById('zona-checkout')?.value || '';
        const pago = document.querySelector('.opcion-pago.selected');
        const carrito = (typeof obtenerCarrito === 'function') ? obtenerCarrito() : [];

        return nombre.length >= 3 && /^[0-9]{10}$/.test(telefono) &&
            direccion !== '' && zona !== '' && !!pago && carrito.length > 0;
    }

    // ─── LEER DATOS PARA EL RESUMEN DEL POP-UP ───
    function recolectarResumen() {
        const carrito = (typeof obtenerCarrito === 'function') ? obtenerCarrito() : [];
        const tiendas = [...new Set(carrito.map(i => i.tiendaNombre || 'Sin tienda'))];

        const zonaHidden = document.getElementById('zona-checkout')?.value || '';
        let zonaNombre = zonaHidden;
        if (typeof ZONAS !== 'undefined') {
            const z = ZONAS.find(z => z.id === zonaHidden);
            if (z) zonaNombre = z.nombre;
        }

        return {
            tiendas: tiendas.join(', '),
            total: document.getElementById('resumenTotal')?.textContent || '$0',
            direccion: (document.getElementById('direccion')?.value || '').trim(),
            zona: zonaNombre,
            pago: document.querySelector('.opcion-pago.selected')?.dataset.metodo || '',
            propina: (document.getElementById('resumenPropinaRow')?.style.display !== 'none')
                ? document.getElementById('resumenPropinaValor')?.textContent
                : null
        };
    }

    // ─── POP-UP ───────────────────────────────
    function construirModal() {
        if (document.getElementById('cpd-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'cpd-overlay';
        overlay.className = 'cpd-overlay';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrarModal(); // toque fuera = volver
        });
    }

    function abrirModal(alConfirmar) {
        construirModal();
        const overlay = document.getElementById('cpd-overlay');
        const r = recolectarResumen();

        overlay.innerHTML = `
            <div class="cpd-modal" role="dialog" aria-modal="true" aria-labelledby="cpd-titulo">
                <h3 id="cpd-titulo"><i class="fas fa-clipboard-check"></i> Revisa tu pedido</h3>
                <div class="cpd-datos">
                    <div class="cpd-fila"><span>🏪 Tienda(s)</span><span>${esc(r.tiendas)}</span></div>
                    <div class="cpd-fila"><span>📍 Zona</span><span>${esc(r.zona)}</span></div>
                    <div class="cpd-fila"><span>🏠 Dirección</span><span>${esc(r.direccion)}</span></div>
                    <div class="cpd-fila"><span>💳 Pago</span><span>${esc(r.pago)}</span></div>
                    ${r.propina ? `<div class="cpd-fila"><span>🩵 Propina</span><span>${esc(r.propina)}</span></div>` : ''}
                    <div class="cpd-fila cpd-total"><span>Total</span><span>${esc(r.total)}</span></div>
                </div>
                <div class="cpd-advertencia">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Al enviarlo por WhatsApp, tu pedido queda <strong>confirmado</strong> y
                    entra a preparación. Ya no se puede cancelar desde la app.</span>
                </div>
                <div class="cpd-botones">
                    <button type="button" class="cpd-btn-volver" id="cpd-btn-volver">
                        Volver y revisar
                    </button>
                    <button type="button" class="cpd-btn-enviar" id="cpd-btn-enviar">
                        <i class="fab fa-whatsapp"></i> Sí, enviar
                    </button>
                </div>
            </div>
        `;

        modalAbierto = true;
        document.body.style.overflow = 'hidden';
        overlay.classList.add('abierto');

        document.getElementById('cpd-btn-volver').addEventListener('click', cerrarModal);
        document.getElementById('cpd-btn-enviar').addEventListener('click', () => {
            cerrarModal();
            enviando = true;
            const btn = document.getElementById('btnConfirmar');
            if (btn) btn.disabled = true; // anti doble-envío
            alConfirmar();
        });
    }

    function cerrarModal() {
        const overlay = document.getElementById('cpd-overlay');
        if (overlay) overlay.classList.remove('abierto');
        modalAbierto = false;
        document.body.style.overflow = '';
    }

    // ─── ENVOLTURA DE window.procesarPedido ───
    function instalarWrapper() {
        const original = window.procesarPedido;
        if (typeof original !== 'function') return; // checkout.js no cargó → todo queda como hoy

        window.procesarPedido = function () {
            if (modalAbierto || enviando) return;   // re-entrada: ignorar
            if (!datosCompletos()) { original(); return; } // faltan datos → errores de siempre

            abrirModal(function alConfirmar() {
                original(); // ★ el flujo real, intacto: valida, WhatsApp, pedido, redirect
            });
        };

        window.ConfirmarPedido = { version: '1.0' };
    }

    // ─── ARRANQUE ─────────────────────────────
    function iniciar() {
        inyectarEstilos();
        insertarAvisoPaso3();
        instalarWrapper();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();