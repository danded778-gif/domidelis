// ============================================
// audio-notificaciones.js — Audio y notificaciones push del admin
// ============================================

// ─── AUDIO ───
function initAudio() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { }
}

async function activarAudio() {
    initAudio();
    if (!audioContext) return false;
    try {
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (audioContext.state === 'running') {
            audioActivado = true;
            await reproducirBeep(800, 0.1, 'sine');
            return true;
        }
    } catch (e) { }
    return false;
}

async function reproducirBeep(frecuencia = 800, duracion = 0.1, tipo = 'sine') {
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, audioContext.currentTime);
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracion);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duracion);
}

function reproducirSonidoNuevoPedido() {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    if (!audioContext || audioContext.state !== 'running') return;
    try {
        const now = audioContext.currentTime;
        [
            { t: 0, f: 880, d: 0.15 },
            { t: 0.2, f: 880, d: 0.15 },
            { t: 0.4, f: 1109, d: 0.4 }
        ].forEach(({ t, f, d }) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now + t);
            gain.gain.setValueAtTime(0, now + t);
            gain.gain.linearRampToValueAtTime(0.4, now + t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
            osc.start(now + t);
            osc.stop(now + t + d);
        });
    } catch (e) { }
}

async function notificarPushAdmin(titulo, opciones = {}) {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(titulo, {
            body: opciones.body || '',
            icon: opciones.icon || '/assets/img/icon-192x192.png',
            badge: opciones.badge || '/assets/img/icon-192x192.png',
            tag: opciones.tag || 'admin-pedido',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: {
                url: opciones.url || window.location.href,
                pedidoId: opciones.pedidoId || null
            }
        });
    } catch (e) { }
}