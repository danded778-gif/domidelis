// ============================================
// fcm-manager.js — Gestión de Tokens FCM (Con Roles)
// ============================================
import { messaging } from "./firebase-config.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const FCM_TOKEN_KEY = 'domidelis_fcm_token';
const FCM_PROMPT_SHOWN = 'domidelis_fcm_prompt_shown';
const API_BASE_URL = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.ngrok-free.dev') ||
    window.location.hostname.includes('.ngrok.io')
    ? window.location.origin
    : 'https://prueba-production-b9fb.up.railway.app';
const ROLES_FCM = new Set(['cliente', 'tienda', 'admin', 'domiciliario']);

// Exponer funciones globalmente
window.obtenerTokenFCMGuardado = function() {
    return localStorage.getItem(FCM_TOKEN_KEY) || null;
};

window.debeMostrarPromptFCM = function() {
    return !localStorage.getItem(FCM_PROMPT_SHOWN) && Notification.permission === 'default';
};

// ★ Acepta rol dinámico ('cliente', 'admin', 'tienda', 'domiciliario'), tiendaId opcional y usuarioId opcional
window.solicitarPermisoFCM = async function(rol = 'cliente', tiendaId = null, usuarioId = null) {
    if (!ROLES_FCM.has(rol)) {
        console.error(`Rol FCM no reconocido: ${rol}`);
        return null;
    }

    localStorage.setItem(FCM_PROMPT_SHOWN, 'true'); 
    
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        if (!('serviceWorker' in navigator)) {
            console.error("Los Service Workers no son compatibles con este navegador.");
            return null;
        }

        const registration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, { 
            vapidKey: "BAK5B51b_sZ_rCcK9poNUpHxtI6iFwGruV3XsgEfuC9rC5O6kanXVkPPALLBtvItw8D78nv7ZL2dw5cMwefuFI0",
            serviceWorkerRegistration: registration
        });

        if (token) {
            const credencial = rol === 'tienda'
                ? localStorage.getItem('tienda_token')
                : localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (rol !== 'cliente' && credencial) {
                headers.Authorization = `Bearer ${credencial}`;
            }

            const response = await fetch(`${API_BASE_URL}/api/fcm/token`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ token, rol, tiendaId, usuarioId })
            });
            const resultado = await response.json();
            if (!response.ok || !resultado.success) {
                throw new Error(resultado.error || 'No se pudo registrar el token FCM.');
            }

            localStorage.setItem(FCM_TOKEN_KEY, token);
            
            return token;
        }
        return null;
    } catch (error) {
        console.error('Error FCM:', error);
        return null;
    }
};

// Escuchar notificaciones en primer plano
onMessage(messaging, (payload) => {
    console.log('Notificación recibida en primer plano:', payload);
    if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion(payload.notification?.body || 'Tienes una nueva notificación', 'success');
    }
});