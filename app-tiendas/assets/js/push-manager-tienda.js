// ============================================
// push-manager-tienda.js — Notificaciones Push para Tiendas
// Adaptado de push-manager.js, pero usa la sesión de tienda
// (tienda_token / tienda_info) en lugar del token admin/domi
// ============================================

class PushNotificationManagerTienda {
    constructor() {
        this.subscription = null;
        this.vapidPublicKey = null;
    }

    async init(vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[Push Tienda] No soportado en este navegador');
            return 'no-soportado';
        }

        var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var esPWA = window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;

        if (esIOS && !esPWA) {
            console.warn('[Push Tienda] iOS requiere PWA instalada');
            return 'ios-sin-pwa';
        }

        try {
            var registration = await navigator.serviceWorker.ready;
            this.subscription = await registration.pushManager.getSubscription();

            if (this.subscription) {
                await this.saveSubscriptionToServer(this.subscription);
                console.log('✅ [Push Tienda] Ya suscrito, reenviado al servidor');
                return 'ya-suscrito';
            }

            if (Notification.permission === 'granted') {
                console.log('🔄 [Push Tienda] Tiene permisos pero sin suscripción, creando...');
                var exito = await this.subscribe();
                return exito ? 'suscrito-automatically' : 'error-auto';
            }

            return 'listo-para-suscribir';
        } catch (error) {
            console.error('[Push Tienda] Error init:', error);
            return 'error';
        }
    }

    async subscribe() {
        if (!this.vapidPublicKey) {
            console.error('[Push Tienda] No hay clave VAPID');
            return false;
        }
        if (!('serviceWorker' in navigator)) return false;

        try {
            var registration = await navigator.serviceWorker.ready;
            var subExistente = await registration.pushManager.getSubscription();
            if (subExistente) await subExistente.unsubscribe();

            var key = this.urlBase64ToUint8Array(this.vapidPublicKey);
            this.subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: key
            });

            return await this.saveSubscriptionToServer(this.subscription);
        } catch (error) {
            console.error('❌ [Push Tienda] Error al suscribir:', error.message);
            return false;
        }
    }

    async saveSubscriptionToServer(subscription) {
        const sesion = obtenerSesionTienda();
        const usuarioId = sesion.info ? sesion.info.id : 'anon';

        try {
            var res = await fetch(BASE_API_URL + '/api/suscripciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    usuarioId: usuarioId,
                    rol: 'tienda'
                })
            });
            if (!res.ok) return false;
            var result = await res.json();
            console.log('[Push Tienda] Total suscripciones en servidor:', result.total);
            return true;
        } catch (error) {
            console.error('[Push Tienda] Error de red:', error.message);
            return false;
        }
    }

    urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var output = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
        return output;
    }

    getPermisoEstado() {
        if (!('Notification' in window)) return 'no-soportado';
        return Notification.permission;
    }
}

var pushManagerTienda = new PushNotificationManagerTienda();