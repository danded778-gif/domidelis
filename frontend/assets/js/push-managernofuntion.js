// ============================================
// push-manager.js — CORREGIDO
// Ahora suscribe AUTOMÁTICAMENTE cuando
// tiene permisos pero no tiene suscripción
// ============================================

class PushNotificationManager {
    constructor() {
        this.subscription = null;
        this.vapidPublicKey = null;
        var esLocal = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('.ngrok-free.dev') ||
            window.location.hostname.includes('.ngrok.io');
        this.apiUrl = esLocal
            ? window.location.origin
            : 'https://prueba-production-b9fb.up.railway.app';
    }

    async init(vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push no soportado');
            return 'no-soportado';
        }

        var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var esPWA = window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;

        if (esIOS && !esPWA) {
            console.warn('iOS requiere PWA instalada');
            return 'ios-sin-pwa';
        }

        try {
            var registration = await navigator.serviceWorker.ready;
            this.subscription = await registration.pushManager.getSubscription();

            if (this.subscription) {
                // Ya tiene suscripción, reenviar al servidor
                await this.saveSubscriptionToServer(this.subscription);
                console.log('✅ [Push] Ya suscrito, reenviado al servidor');
                return 'ya-suscrito';
            }

            // ============================================
            // ★ ESTO ES LO QUE FALTABA ★
            // Tiene permisos PERO no tiene suscripción
            // Suscribir automáticamente
            // ============================================
            if (Notification.permission === 'granted') {
                console.log('🔄 [Push] Tiene permisos pero sin suscripción, creando...');
                var exito = await this.subscribe();
                if (exito) {
                    console.log('✅ [Push] Suscripción automática exitosa');
                    return 'suscrito-automatically';
                } else {
                    console.error('❌ [Push] Falló suscripción automática');
                    return 'error-auto';
                }
            }

            // No tiene permisos ni suscripción
            return 'listo-para-suscribir';

        } catch (error) {
            console.error('Error init push:', error);
            return 'error';
        }
    }

    async subscribe() {
        if (!this.vapidPublicKey) {
            console.error('No hay clave VAPID');
            return false;
        }
        if (!('serviceWorker' in navigator)) return false;

        try {
            var registration = await navigator.serviceWorker.ready;

            var subExistente = await registration.pushManager.getSubscription();
            if (subExistente) {
                console.log('🔄 [Push] Eliminando suscripción anterior...');
                await subExistente.unsubscribe();
            }
            var key = this.urlBase64ToUint8Array(this.vapidPublicKey);

            this.subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: key
            });

            console.log('✅ [Push] Suscripción creada:', this.subscription.endpoint.substring(0, 50) + '...');

            var resultado = await this.saveSubscriptionToServer(this.subscription);

            if (resultado) {
                console.log('✅ [Push] Guardada en servidor');
                return true;
            } else {
                console.error('❌ [Push] No se pudo guardar en servidor');
                return false;
            }

        } catch (error) {
            console.error('❌ [Push] Error al suscribir:', error.message);
            return false;
        }
    }

    async saveSubscriptionToServer(subscription) {
        var usuarioId = 'anon';
        var rol = 'desconocido';

        try {
            const token = localStorage.getItem('token');
            if (token) {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(base64));
                usuarioId = payload.id || 'anon';
                rol = payload.rol || 'desconocido';
            }
        } catch (e) {
            console.warn('No se pudo decodificar token:', e.message);
        }

        try {
            var res = await fetch(this.apiUrl + '/api/suscripciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    usuarioId: usuarioId,
                    rol: rol
                })
            });

            if (!res.ok) {
                console.error('[Push] Servidor respondió ' + res.status);
                return false;
            }

            var result = await res.json();
            console.log('[Push] Total suscripciones en servidor:', result.total);
            return true;

        } catch (error) {
            console.error('[Push] Error de red:', error.message);
            return false;
        }
    }

    async unsubscribe() {
        if (!this.subscription) return;
        await this.subscription.unsubscribe();
        try {
            await fetch(this.apiUrl + '/api/suscripciones/eliminar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: this.subscription.endpoint })
            });
        } catch (e) { }
        this.subscription = null;
    }

    urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var output = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) {
            output[i] = rawData.charCodeAt(i);
        }
        return output;
    }

    getPermisoEstado() {
        if (!('Notification' in window)) return 'no-soportado';
        return Notification.permission;
    }
}

var pushManager = new PushNotificationManager();

// ============================================
// VERIFICAR PERMISOS — Se llama al cargar la página
// ============================================
async function verificarEstadoPermisos() {
    var estado = pushManager.getPermisoEstado();

    if (estado === 'granted') {
        // Ocultar banner
        var banner = document.getElementById('permisos-banner');
        if (banner) banner.style.display = 'none';
        // ★ Aquí init() ahora suscribe automáticamente si no tiene suscripción
        const vapidRes = await fetch(API_URL + '/vapid-public-key');
        const { publicKey } = await vapidRes.json();
        await pushManager.init(publicKey);
        return;
    }

    if (estado === 'denied') {
        var banner = document.getElementById('permisos-banner');
        if (banner) banner.style.display = 'none';
        return;
    }

    // Estado 'default' — mostrar banner
    var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var esPWA = window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

    var banner = document.getElementById('permisos-banner');
    if (!banner) return;

    if (esIOS && !esPWA) {
        banner.innerHTML = '<i class="fas fa-info-circle" style="color:#F4A261;font-size:1.5rem;"></i><div style="flex:1;"><strong style="font-size:.9rem;">Instala la app para alertas sonoras</strong><div style="font-size:.8rem;color:#666;">Toca compartir <i class="fas fa-share-from-square"></i> y "Agregar a pantalla de inicio"</div></div><button onclick="this.parentElement.style.display=\'none\'" style="background:none;border:1px solid #ddd;padding:8px 12px;border-radius:8px;cursor:pointer;">Entendido</button>';
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'flex';
    }
}

// ============================================
// ACTIVAR PERMISOS — Click del botón
// ============================================
async function activarPermisos() {
    var btn = event.target.closest('button');
    var textoOriginal = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
    }

    try {
        var permiso = await Notification.requestPermission();

        if (permiso !== 'granted') {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bell-slash"></i> Denegado'; btn.style.opacity = '0.5'; }
            return;
        }

        if (!pushManager.vapidPublicKey) {
            const vapidRes = await fetch(API_URL + '/vapid-public-key');
            const { publicKey } = await vapidRes.json();
            pushManager.vapidPublicKey = publicKey;
        }
        var exito = await pushManager.subscribe();

        if (exito) {
            var banner = document.getElementById('permisos-banner');
            if (banner) { banner.style.transition = 'all 0.3s ease'; banner.style.opacity = '0'; banner.style.transform = 'translateY(-20px)'; setTimeout(function () { banner.style.display = 'none'; }, 300); }
            if (typeof sonidoExito === 'function') sonidoExito();
            if (typeof mostrarToast === 'function') mostrarToast('Notificaciones activadas', 'Recibirás alertas de nuevos pedidos', 'success', 4000);
        } else {
            if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
            if (typeof mostrarToast === 'function') mostrarToast('Error', 'No se pudo activar', 'error', 4000);
        }

    } catch (error) {
        console.error('Error activando:', error);
        if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
    }
}
