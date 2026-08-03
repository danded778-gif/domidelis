// ============================================
// server.js — Backend completo de Domicilios
// 5 funciones: Static + Proxy + Socket.IO + Push + JWT Auth
// ============================================

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const webpush = require('web-push');
require('dotenv').config();

// ★★★ Firebase Admin SDK (API Modular v10+) + Firestore ★★★
const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore } = require("firebase-admin/firestore");

try {
    // Construimos el objeto de credenciales usando variables de entorno
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // El .replace es VITAL para convertir los caracteres '\n' en saltos de línea reales en producción
        privateKey: process.env.FIREBASE_PRIVATE_KEY 
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
            : undefined
    };

    initializeApp({
        credential: cert(serviceAccount)
    });
    console.log("✅ Firebase Admin SDK inicializado correctamente desde variables de entorno.");
} catch (error) {
    console.error("❌ Error al inicializar Firebase Admin:", error.message);
}

const firestoreDb = getFirestore(); // Inicializar Firestore

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ Faltan JWT_SECRET en el archivo .env');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);

// ============================================
// CORS
// ============================================
const isDev = process.env.NODE_ENV !== 'production';

const allowedOrigins = [
    'https://www.domidelis.top',
    'https://domidelis.top',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'https://net-sensation-carol.ngrok-free.dev/'
];

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization']
    }
});

app.use(cors({
    origin: function (origin, callback) {
        if (isDev) {
            return callback(null, true);
        }
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// VAPID — Claves para Web Push
// ============================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('Faltan claves VAPID en el archivo .env');
    process.exit(1);
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ============================================
// AUTENTICACIÓN JWT - LOGIN
// ============================================
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    if (!nombre || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        const url = `${GAS_URL}?action=login&nombre=${encodeURIComponent(nombre)}&password=${encodeURIComponent(password)}`;
        const response = await axios.get(url);
        const data = response.data;

        if (data.success) {
            const payload = {
                id: data.id,
                nombre: data.nombre,
                rol: data.rol
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

            res.json({
                success: true,
                token,
                rol: data.rol,
                nombre: data.nombre,
                id: data.id
            });
        } else {
            res.status(401).json({ success: false, error: data.error || "Credenciales incorrectas" });
        }
    } catch (err) {
        console.error('Error en login:', err.message);
        res.status(500).json({ success: false, error: "Error de conexión con el servidor." });
    }
});

// ============================================
// MIDDLEWARE: Verificar Token JWT
// ============================================
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Token inválido o expirado.' });
    }
}

// ============================================
// SUSCRIPCIONES PUSH (Web Push Estándar)
// ============================================
const suscripciones = new Map();

// ============================================
// GOOGLE APPS SCRIPT — URL fija
// ============================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw8fzrcKzgfhaP0TbKn--5ny8befC47_qKJHb4wLLvoBQJgl7KpyKDaW-4wdxLPPhw_/exec';

// ============================================
// ENDPOINTS DE SUSCRIPCIÓN PUSH
// ============================================
app.post('/api/suscripciones', (req, res) => {
    const { subscription, usuarioId, rol } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Suscripción inválida' });
    }
    suscripciones.set(subscription.endpoint, {
        subscription,
        usuarioId: usuarioId || 'anon',
        rol: rol || 'desconocido',
        fecha: new Date()
    });
    console.log(`✅ Push suscrito: user=${usuarioId} rol=${rol} total=${suscripciones.size}`);
    res.json({ success: true, total: suscripciones.size });
});

app.post('/api/suscripciones/eliminar', (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) suscripciones.delete(endpoint);
    res.json({ success: true });
});

app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/enviar-push', async (req, res) => {
    const { titulo, mensaje, url = '/', tipo = 'general', roles = ['admin'], pedidoId = null } = req.body;
    const payload = JSON.stringify({
        title: titulo, body: mensaje, url, tipo, pedidoId,
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `domicilio-${tipo}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url, pedidoId, tipo }
    });
    const resultados = { exitosos: 0, fallidos: 0, eliminados: 0 };
    for (const [endpoint, data] of suscripciones) {
        if (!roles.includes(data.rol)) continue;
        try {
            await webpush.sendNotification(data.subscription, payload);
            resultados.exitosos++;
        } catch (error) {
            resultados.fallidos++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                suscripciones.delete(endpoint);
                resultados.eliminados++;
            }
        }
    }
    res.json({ success: true, ...resultados, totalActivos: suscripciones.size });
});

// ============================================
// FUNCIÓN GENÉRICA: Enviar push a un usuario por id+rol (Web Push)
// ============================================
async function enviarPushAUsuario(usuarioId, rol, payloadObj) {
    const payload = JSON.stringify(payloadObj);
    for (const [endpoint, subData] of suscripciones) {
        if (String(subData.usuarioId) !== String(usuarioId)) continue;
        if (subData.rol !== rol) continue;
        try {
            await webpush.sendNotification(subData.subscription, payload);
            console.log(`📱 Push Web enviado → ${rol} ${usuarioId}`);
        } catch (error) {
            console.error(`❌ Push Web falló → ${rol} ${usuarioId}: ${error.message}`);
            if (error.statusCode === 410 || error.statusCode === 404) {
                suscripciones.delete(endpoint);
            }
        }
    }
}

// ============================================
// FUNCIÓN INTERNA: Enviar push a UN domiciliario
// ============================================
async function enviarPushADomiciliario(domiciliarioId, pedidoId, pedidoDetalle) {
    const cuerpo = pedidoDetalle
        ? `Pedido #${pedidoId} - ${pedidoDetalle.clienteNombre || ''} - $${parseInt(pedidoDetalle.total || 0).toLocaleString('es-CO')}`
        : `Pedido #${pedidoId} asignado`;

    // 1. Notificación Web Push tradicional (Heredada)
    await enviarPushAUsuario(domiciliarioId, 'domiciliario', {
        title: '🛵 Nuevo pedido asignado',
        body: cuerpo,
        url: '/domiciliario.html',
        tipo: 'asignacion',
        pedidoId: String(pedidoId),
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `asignacion-${pedidoId}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/domiciliario.html', pedidoId: String(pedidoId), tipo: 'asignacion' }
    });

    // 2. ★★★ NUEVO: Notificación push FCM a través de Firestore ★★★
    try {
        const domiId = Number(domiciliarioId);
        // Buscamos tokens correspondientes a este domiciliario (blindado contra string/number)
        const domiSnapshot = await firestoreDb.collection('tokens_clientes')
            .where('rol', '==', 'domiciliario')
            .where('usuarioId', 'in', [domiId, String(domiId), Number(domiId)])
            .get();

        if (!domiSnapshot.empty) {
            console.log(`🔔 Enviando push FCM a domiciliario ID: ${domiId} (${domiSnapshot.size} dispositivos)...`);
            
            const promesasDomi = [];
            domiSnapshot.forEach(docSnap => {
                const domiToken = docSnap.id;
                promesasDomi.push(
                    enviarNotificacionFCM(
                        domiToken,
                        '🛵 ¡Nuevo pedido asignado!',
                        cuerpo,
                        { url: '/domiciliario.html', pedidoId: String(pedidoId) }
                    )
                );
            });
            await Promise.all(promesasDomi); // Despachamos en paralelo
        } else {
            console.log(`⚠️ No se encontraron tokens FCM registrados para el domiciliario ID: ${domiId}`);
        }
    } catch (dbError) {
        console.error("❌ Error domiciliario FCM:", dbError.message);
    }
}

// ============================================
// FUNCIÓN: Enviar push a UNA tienda (Web Push Legacy)
// ============================================
async function enviarPushATienda(tiendaId, pedidoId, pedidoDetalle) {
    const cuerpo = pedidoDetalle
        ? `Pedido #${pedidoId} - ${pedidoDetalle.clienteNombre || ''} - $${parseInt(pedidoDetalle.total || 0).toLocaleString('es-CO')}`
        : `Nuevo pedido #${pedidoId}`;

    await enviarPushAUsuario(tiendaId, 'tienda', {
        title: '🛍️ Nuevo pedido recibido',
        body: cuerpo,
        url: '/app-tiendas/index-tienda.html',
        tipo: 'nuevo-pedido-tienda',
        pedidoId: String(pedidoId),
        icon: '/app-tiendas/assets/img/icon-192x192.png',
        badge: '/app-tiendas/assets/img/icon-192x192.png',
        tag: `pedido-tienda-${pedidoId}-${tiendaId}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/app-tiendas/index-tienda.html', pedidoId: String(pedidoId), tipo: 'nuevo-pedido-tienda' }
    });
}

// ============================================
// ★★★ FUNCIÓN: Enviar notificación FCM a UN TOKEN específico ★★★
// ============================================
async function enviarNotificacionFCM(token, titulo, cuerpo, datosExtra = {}) {
    if (!token) {
        console.warn("⚠️ No se proporcionó token FCM, no se puede enviar notificación.");
        return;
    }

    const message = {
        token: token,
        notification: { title: titulo, body: cuerpo },
        data: datosExtra,
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high' } }
    };

    try {
        const response = await getMessaging().send(message);
        console.log('✅ Notificación FCM enviada con éxito a token individual:', response);
    } catch (error) {
        console.error('❌ Error al enviar notificación FCM individual:', error.message);
    }
}

// ============================================
// ★★★ NUEVA FUNCIÓN: Enviar FCM a TODOS los ADMINISTRADORES ★★★
// ============================================
async function enviarNotificacionAdminsFCM(titulo, cuerpo, datosExtra = {}) {
    try {
        // Buscamos en Firestore todos los documentos donde el rol sea 'admin'
        const tokensRef = firestoreDb.collection('tokens_clientes');
        const snapshot = await tokensRef.where('rol', '==', 'admin').get();

        if (snapshot.empty) {
            console.log('ℹ️ No hay administradores con tokens FCM registrados en Firestore.');
            return;
        }

        const tokens = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) tokens.push(data.token);
        });

        if (tokens.length === 0) return;

        // Usamos sendEachForMulticast (recomendado por Firebase para SDK modernos)
        const message = {
            notification: { title: titulo, body: cuerpo },
            data: datosExtra,
            android: { priority: 'high' },
            webpush: { headers: { Urgency: 'high' } },
            tokens: tokens // <--- Array de tokens
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`✅ Notificación FCM Admins enviada: ${response.successCount} exitosas, ${response.failureCount} fallidas.`);

    } catch (error) {
        console.error('❌ Error al enviar FCM masivo a admins:', error.message);
    }
}

// ============================================
// FUNCIÓN: Obtener pedido completo desde GAS
// ============================================
async function obtenerPedidoPorId(pedidoId) {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidos`);
        const pedidos = response.data;
        if (!Array.isArray(pedidos)) return null;
        return pedidos.find(p => String(p.id) === String(pedidoId));
    } catch (e) {
        console.error('Error obteniendo pedido:', e.message);
        return null;
    }
}

// ============================================
// SERVIR FRONTEND ESTÁTICO — Solo en desarrollo
// ============================================
if (isDev) {
    const frontendPath = path.join(__dirname, '../frontend');
    console.log(`📂 Sirviendo frontend desde: ${frontendPath}`);
    app.use(express.static(frontendPath));

    const tiendasPath = path.join(__dirname, '../app-tiendas');
    console.log(`📂 Sirviendo app-tiendas desde: ${tiendasPath}`);
    app.use('/app-tiendas', express.static(tiendasPath));
}

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', modo: isDev ? 'development' : 'production' });
});

// ============================================
// PROXY PRINCIPAL — Todas las llamadas a /api
// ============================================
app.all('/api', verificarToken, async (req, res) => {
    try {
        const action = req.query.action || req.body.action;
        console.log(`📥 [${req.method}] action=${action} (User: ${req.user ? req.user.nombre : 'Público'})`);

        if (!action) {
            return res.status(400).json({ success: false, error: 'Falta action' });
        }

        // PROTECCIÓN DE RUTAS POR ROL
        const accionesAdmin = ['crearTienda', 'actualizarTienda', 'eliminarTienda', 'crearProducto', 'actualizarProducto', 'eliminarProducto', 'crearDomiciliario', 'actualizarDomiciliario', 'eliminarDomiciliario', 'eliminarPedidos', 'asignarDomiciliario'];
        const accionesDomiciliario = ['actualizarEstado'];
        const accionesAutenticadas = ['getDomiciliarios', 'getPedidos'];

        if (accionesAdmin.includes(action) && req.user?.rol !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de administrador.' });
        }

        if (accionesDomiciliario.includes(action) && !['admin', 'domiciliario'].includes(req.user?.rol)) {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de domiciliario o admin.' });
        }

        if (accionesAutenticadas.includes(action) && !req.user) {
            return res.status(401).json({ success: false, error: 'Debes iniciar sesión para ver esta información.' });
        }

        let gasUrl = `${GAS_URL}?action=${action}`;
        for (const key in req.query) {
            if (key !== 'action') gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
        }

        let response;
        if (req.method === 'GET') {
            response = await axios.get(gasUrl);
        } else {
            const params = new URLSearchParams(req.body).toString();
            response = await axios.post(gasUrl, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        }

        const data = response.data;
        console.log(`📤 GAS: success=${data.success ?? (Array.isArray(data) ? `array[${data.length}]` : '?')}`);

        res.json(data);

        if (!data.success) return;

        try {
            switch (action) {
                case 'crearPedido': {
                    const pedido = await obtenerPedidoPorId(data.id);
                    io.emit('nuevoPedido', {
                        pedido: pedido || { id: data.id },
                        mensaje: `Nuevo pedido #${data.id}`
                    });
                    console.log(`📦 Emitido nuevoPedido #${data.id}`);

                    // 1. Notificación al cliente (FCM)
                    const fcmTokenCliente = req.body.fcmToken;
                    if (fcmTokenCliente) {
                        await enviarNotificacionFCM(
                            fcmTokenCliente,
                            '✅ Pedido Recibido',
                            `Tu pedido #${data.id} ha sido confirmado por Domidelis.`,
                            { url: '/confirmacion.html', pedidoId: String(data.id) }
                        );
                    }

                    // 2. Notificación al admin (FCM Masivo)
                    await enviarNotificacionAdminsFCM(
                        '🛒 ¡NUEVO PEDIDO!',
                        `Cliente: ${pedido?.clienteNombre || 'Desconocido'} - Total: $${parseInt(pedido?.total || 0).toLocaleString('es-CO')}`,
                        { url: '/admin.html', pedidoId: String(data.id) }
                    );

                    // 3. ★★★ CORREGIDO Y BLINDADO: Enviar push FCM a la(s) tienda(s) correspondiente(s) ★★★
                    try {
                        let productos = [];
                        try { productos = JSON.parse((pedido && pedido.productosJson) || '[]'); } catch (e) { productos = []; }
                        const tiendaIds = [...new Set(productos.map(p => p.tiendaId).filter(Boolean))];

                        for (const tId of tiendaIds) {
                            // Socket.IO para tiempo real (si la tienda tiene la pestaña abierta)
                            io.to(`tienda_${tId}`).emit('nuevoPedidoTienda', {
                                pedido: pedido || { id: data.id },
                                mensaje: `Nuevo pedido #${data.id}`
                            });
                            console.log(`📦 Emitido nuevoPedidoTienda → tienda_${tId}`);

                            // ★ Solución contra tipo de dato: Buscamos si en Firestore se guardó como string "1" o número 1 ★
                            const tiendaSnapshot = await firestoreDb.collection('tokens_clientes')
                                .where('rol', '==', 'tienda')
                                .where('tiendaId', 'in', [tId, String(tId), Number(tId)]) 
                                .get();

                            if (!tiendaSnapshot.empty) {
                                console.log(`🔔 Enviando notificaciones push a tienda ID: ${tId} (${tiendaSnapshot.size} dispositivos)...`);
                                
                                const promesasTienda = []; // <-- Array de promesas de tienda
                                tiendaSnapshot.forEach(docSnap => {
                                    const tiendaToken = docSnap.id;
                                    promesasTienda.push( // <--- ¡CORREGIDO AQUÍ! (Antes empujaba a promesasAdmin)
                                        enviarNotificacionFCM(
                                            tiendaToken,
                                            '🛍️ ¡Nuevo pedido para tu tienda!',
                                            `Has recibido el pedido #${data.id}. Revisa los detalles en tu panel.`,
                                            { url: '/app-tiendas/index-tienda.html', pedidoId: String(data.id) }
                                        )
                                    );
                                });
                                await Promise.all(promesasTienda); // <-- Esperamos a que se completen las promesas de la tienda
                            } else {
                                console.log(`⚠️ No se encontraron tokens FCM registrados para la tienda ID: ${tId}`);
                            }
                        }
                    } catch (dbError) {
                        console.error("❌ Error tienda FCM:", dbError.message);
                    }

                    break;
                }

                // ====================================================
                // ★★★ NUEVO BLOQUE ACTUALIZARESTADO (CON FCM AL CLIENTE) ★★★
                // ====================================================
                case 'actualizarEstado': {
                    const pedidoId = (req.body && req.body.pedidoId) || req.query.pedidoId;
                    const nuevoEstado = (req.body && req.body.estado) || req.query.estado;
                    
                    io.emit('estadoActualizado', { pedidoId, nuevoEstado });
                    console.log(`🔄 Emitido estadoActualizado #${pedidoId} → ${nuevoEstado}`);

                    // 1. Notificación existente para el administrador
                    if (nuevoEstado === 'entregado') {
                        const payload = JSON.stringify({
                            title: '✅ Pedido entregado',
                            body: `Pedido #${pedidoId} fue entregado`,
                            url: '/admin.html',
                            icon: '/assets/img/icon-192x192.png',
                            badge: '/assets/img/icon-192x192.png',
                            tag: `entregado-${pedidoId}-${Date.now()}`,
                            requireInteraction: false,
                            data: { url: '/admin.html', pedidoId, tipo: 'entregado' }
                        });

                        for (const [endpoint, subData] of suscripciones) {
                            if (subData.rol !== 'admin') continue;
                            try {
                                await webpush.sendNotification(subData.subscription, payload);
                            } catch (error) {
                                if (error.statusCode === 410 || error.statusCode === 404) {
                                    suscripciones.delete(endpoint);
                                }
                            }
                        }
                    }

                    // 2. ★★★ NUEVO: Enviar push FCM de actualización de estado al Cliente ★★★
                    try {
                        const pedido = await obtenerPedidoPorId(pedidoId);
                        
                        if (pedido && pedido.fcmToken) {
                            let tituloNotif = '';
                            let cuerpoNotif = '';

                            if (nuevoEstado === 'en camino') {
                                tituloNotif = '🛵 ¡Tu pedido va en camino!';
                                cuerpoNotif = `El domiciliario ya lleva tu pedido #${pedidoId}. ¡Prepárate para recibirlo!`;
                            } else if (nuevoEstado === 'entregado') {
                                tituloNotif = '🎉 ¡Pedido Entregado!';
                                cuerpoNotif = `Tu pedido #${pedidoId} ha sido entregado con éxito. ¡Que lo disfrutes!`;
                            } else if (nuevoEstado === 'cancelado') {
                                tituloNotif = '❌ Pedido Cancelado';
                                cuerpoNotif = `Tu pedido #${pedidoId} ha sido cancelado por el sistema.`;
                            }

                            if (tituloNotif && cuerpoNotif) {
                                console.log(`🔔 Enviando push de estado "${nuevoEstado}" al cliente del pedido #${pedidoId}...`);
                                await enviarNotificacionFCM(
                                    pedido.fcmToken,
                                    tituloNotif,
                                    cuerpoNotif,
                                    { url: '/confirmacion.html', pedidoId: String(pedidoId), estado: nuevoEstado }
                                );
                            }
                        } else {
                            console.log(`⚠️ El pedido #${pedidoId} no cuenta con un fcmToken de cliente registrado.`);
                        }
                    } catch (fcmError) {
                        console.error("❌ Error enviando FCM de cambio de estado al cliente:", fcmError.message);
                    }

                    break;
                }

                case 'asignarDomiciliario': {
                    const pedidoId = (req.body && req.body.pedidoId) || req.query.pedidoId;
                    const domiciliarioId = (req.body && req.body.domiciliarioId) || req.query.domiciliarioId;

                    if (!pedidoId || !domiciliarioId) {
                        console.error('❌ Faltan parámetros para asignarDomiciliario');
                        break;
                    }

                    console.log(`🎯 ASIGNAR: pedido #${pedidoId} → domiciliario ${domiciliarioId}`);

                    const pedidoDetalle = await obtenerPedidoPorId(pedidoId);
                    const mensaje = pedidoDetalle
                        ? `Pedido #${pedidoId} asignado - ${pedidoDetalle.clienteNombre || ''}`
                        : `Pedido #${pedidoId} asignado`;

                    const roomName = `domiciliario_${domiciliarioId}`;
                    const roomSockets = io.sockets.adapter.rooms.get(roomName);
                    console.log(`🏠 Room ${roomName}: ${roomSockets ? roomSockets.size : 0} socket(s)`);

                    io.to(roomName).emit('nuevoPedidoAsignado', {
                        pedidoId: String(pedidoId),
                        pedido: pedidoDetalle,
                        mensaje: mensaje
                    });
                    console.log(`✅ Socket emitido → ${roomName}`);

                    await enviarPushADomiciliario(domiciliarioId, pedidoId, pedidoDetalle);

                    io.emit('pedidoAsignado', {
                        pedidoId: String(pedidoId),
                        domiciliarioId: String(domiciliarioId),
                        pedido: pedidoDetalle
                    });

                    break;
                }
            }
        } catch (socketError) {
            console.error('❌ Error Socket/Push (no afecta al cliente):', socketError.message);
        }

    } catch (error) {
        console.error('❌ Error proxy:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// ============================================
// SOCKET.IO — Conexiones y Rooms
// ============================================
io.on('connection', (socket) => {
    console.log(`🔗 Conectado: ${socket.id}`);

    socket.on('identificar', ({ rol, id }) => {
        if (rol === 'domiciliario' && id) {
            socket.join(`domiciliario_${id}`);
            console.log(`✅ ${socket.id} → room domiciliario_${id}`);
        } else if (rol === 'admin') {
            socket.join('admin_room');
            console.log(`✅ ${socket.id} → room admin_room`);
        } else if (rol === 'tienda' && id) {
            socket.join(`tienda_${id}`);
            console.log(`✅ ${socket.id} → room tienda_${id}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`⚠️ Desconectado: ${socket.id}`);
    });
});

app.get('/api/suscripciones/estado', (req, res) => {
    const lista = Array.from(suscripciones.values()).map(s => ({
        usuarioId: s.usuarioId,
        rol: s.rol,
        fecha: s.fecha
    }));
    res.json({ total: suscripciones.size, suscripciones: lista });
});

const tiendaRoutes = require('./routes/tiendaRoutes');
app.use('/api/tienda', tiendaRoutes);
const trabajaRoutes = require('./routes/trabajaRoutes');
app.use('/api/trabaja', trabajaRoutes);

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`  🚀 Servidor en puerto ${PORT}`);
    console.log(`  📍 Local:   http://localhost:${PORT}`);
    console.log(`  🔧 Modo:    ${isDev ? 'DESARROLLO (frontend incluido)' : 'PRODUCCIÓN (solo API)'}`);
    console.log(`  🔐 Auth:    JWT Habilitado`);
    console.log(`  📡 Push:    ${suscripciones.size} suscripciones Web Push`);
    console.log(`  🔥 Firebase: FCM Admin SDK Activo`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    if (isDev) {
        console.log('  ⏳ Abre otra terminal y ejecuta:');
        console.log('     ngrok http 80');
        console.log('');
    }
});