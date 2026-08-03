// ============================================
// fcm-manager.js — Gestión de Tokens FCM (Con Roles)
// ============================================
import { messaging, db } from "./firebase-config.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FCM_TOKEN_KEY = 'domidelis_fcm_token';
const FCM_PROMPT_SHOWN = 'domidelis_fcm_prompt_shown';

// Exponer funciones globalmente
window.obtenerTokenFCMGuardado = function() {
    return localStorage.getItem(FCM_TOKEN_KEY) || null;
};

window.debeMostrarPromptFCM = function() {
    return !localStorage.getItem(FCM_PROMPT_SHOWN) && Notification.permission === 'default';
};

// ★ Acepta rol dinámico ('cliente', 'admin', 'tienda', 'domiciliario'), tiendaId opcional y usuarioId opcional
window.solicitarPermisoFCM = async function(rol = 'cliente', tiendaId = null, usuarioId = null) {
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
            localStorage.setItem(FCM_TOKEN_KEY, token);
            
            const payload = {
                token: token,
                rol: rol, // <--- Aquí se guarda si es 'cliente', 'admin', 'tienda' o 'domiciliario'
                plataforma: 'web',
                creadoEn: serverTimestamp(),
                ultimaActividad: serverTimestamp()
            };

            // Si es tienda, guardamos el tiendaId como número
            if (rol === 'tienda' && tiendaId) {
                payload.tiendaId = Number(tiendaId); 
            }

            // ★ NUEVO: Si es domiciliario, guardamos el usuarioId como número
            if (rol === 'domiciliario' && usuarioId) {
                payload.usuarioId = Number(usuarioId); 
            }

            // Guardamos en Firestore con el rol pasado por parámetro
            await setDoc(doc(db, 'tokens_clientes', token), payload);
            
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