// ============================================
// notificaciones-tienda.js
// Toasts + sonido para el panel de Tiendas
// (Versión independiente del panel admin/domiciliario)
// ============================================

let audioCtxTienda = null;

function initAudioTienda() {
    if (audioCtxTienda) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxTienda = new AC();
    } catch (e) { /* navegador no soporta */ }
}

async function sonidoNuevoPedidoTienda() {
    if (!audioCtxTienda || audioCtxTienda.state !== 'running') return;
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    const now = audioCtxTienda.currentTime;
    [
        { t: 0, f: 880, d: 0.2 }, { t: 0.2, f: 880, d: 0.2 }, { t: 0.4, f: 1109, d: 0.4 }
    ].forEach(({ t, f, d }) => {
        const osc = audioCtxTienda.createOscillator();
        const gain = audioCtxTienda.createGain();
        osc.connect(gain); gain.connect(audioCtxTienda.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.4, now + t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.start(now + t); osc.stop(now + t + d);
    });
}

function mostrarToastTienda(titulo, mensaje, tipo = 'info', duracion = 8000) {
    let contenedor = document.getElementById('toast-container-tienda');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container-tienda';
        contenedor.style.cssText = 'position:fixed;top:90px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;max-width:350px;';
        document.body.appendChild(contenedor);
    }
    const colores = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8', pedido: '#E63946' };
    const iconos = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle', pedido: 'fa-bell' };
    const toast = document.createElement('div');
    toast.style.cssText = `background:white;border-left:4px solid ${colores[tipo] || colores.info};border-radius:8px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:start;gap:12px;animation:slideInRightTienda .3s ease;cursor:pointer;font-family:'Poppins',sans-serif;`;
    toast.innerHTML = `
        <i class="fas ${iconos[tipo] || iconos.info}" style="color:${colores[tipo]};font-size:1.2rem;margin-top:2px;"></i>
        <div style="flex:1">
            <div style="font-weight:600;color:#333;margin-bottom:4px;font-size:.95rem">${titulo}</div>
            <div style="font-size:.85rem;color:#666;line-height:1.4">${mensaje}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#999;cursor:pointer;font-size:1.2rem"><i class="fas fa-times"></i></button>`;
    contenedor.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all .3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, duracion);
}

if (!document.getElementById('toast-anim-style-tienda')) {
    const s = document.createElement('style');
    s.id = 'toast-anim-style-tienda';
    s.textContent = '@keyframes slideInRightTienda{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(s);
}

document.addEventListener('click', function handler() {
    if (!audioCtxTienda) { initAudioTienda(); if (audioCtxTienda?.state === 'suspended') audioCtxTienda.resume(); }
    document.removeEventListener('click', handler);
}, { once: true });