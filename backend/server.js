// ============================================
// server.js — Backend completo de Domicilios
// 5 funciones: Static + Proxy + Socket.IO + Push + JWT Auth
// ★ v2.4: Blindaje de acceso (Fase 1)
// ============================================

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const webpush = require('web-push');
require('dotenv').config();

// ★★★ Firebase Admin SDK — opcional en local ★★★
// Si no hay credenciales válidas, el server arranca igual.
// FCM/Firestore se saltan; Socket.IO, JWT, proxy GAS y presencia siguen.
const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore } = require("firebase-admin/firestore");

let firestoreDb = null;
let firebaseOk = false;

function privateKeyPareceValida(key) {
    if (!key || typeof key !== 'string') return false;
    const k = key.replace(/\\n/g, '\n').trim();
    return k.includes('BEGIN PRIVATE KEY') && k.includes('END PRIVATE KEY');
}

try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyPareceValida(privateKeyRaw)) {
        console.warn("⚠️ Firebase desactivado: faltan credenciales válidas (normal en local).");
    } else {
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: privateKeyRaw.replace(/\\n/g, '\n')
            })
        });
        firestoreDb = getFirestore();
        firebaseOk = true;
        console.log("✅ Firebase Admin SDK inicializado correctamente desde variables de entorno.");
    }
} catch (error) {
    firestoreDb = null;
    firebaseOk = false;
    console.warn("⚠️ Firebase desactivado:", error.message);
}

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ Faltan JWT_SECRET en el archivo .env');
    process.exit(1);
}

// ============================================
// ★ v2.4: CONFIGURACIÓN DEL GAS + CLAVE SECRETA
// ============================================
// GAS_URL ahora es opcional por .env (si no está, usa la URL actual).
const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbw2R_nABf0FbpfWf_6F9pz2DmHuMrd3N1Dw9_4v6-oETZ2Kmh4pDSNW9mDV0ObGK-sK/exec';

// Clave compartida con el Apps Script. OBLIGATORIA: sin ella el GAS rechaza todo.
const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;
if (!GAS_SECRET_KEY) {
    console.error('❌ Falta GAS_SECRET_KEY en las variables de entorno (.env / Railway)');
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
    'https://net-sensation-carol.ngrok-free.dev' // ★ v2.4: sin "/" final (los navegadores envían el origen sin slash)
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
// ★ v2.4: ahora envía las credenciales al GAS por POST (ya no viajan en la URL)
//   y adjunta la clave secreta.
// ============================================
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    if (!nombre || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        const body = new URLSearchParams({
            action: 'login',
            nombre: nombre,
            password: password,
            key: GAS_SECRET_KEY
        }).toString();

        const response = await axios.post(GAS_URL, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
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
// PRESENCIA (admin + domiciliario) en memoria
// Verde = online, Amarillo = away, Gris = offline
// ============================================
const presencia = new Map();

function clavePresencia(rol, id) {
    return `${rol}:${String(id)}`;
}

function snapshotPresencia() {
    return Array.from(presencia.values()).map(p => ({
        rol: p.rol,
        id: String(p.id),
        nombre: p.nombre || '',
        estado: p.estado,
        lastSeen: p.lastSeen,
        sockets: p.sockets ? p.sockets.size : 0
    }));
}

function emitirPresencia() {
    io.to('admin_room').emit('presencia:lista', snapshotPresencia());
}

function upsertPresencia(rol, id, patch) {
    const key = clavePresencia(rol, id);
    const prev = presencia.get(key) || {
        rol,
        id,
        nombre: '',
        estado: 'offline',
        lastSeen: Date.now(),
        sockets: new Set(),
        _offlineTimer: null
    };
    Object.assign(prev, patch);
    presencia.set(key, prev);
    emitirPresencia();
    return prev;
}


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

// ★ v2.4: enviar-push ahora exige token de ADMIN (antes era de acceso libre)
app.post('/api/enviar-push', verificarToken, async (req, res) => {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de administrador.' });
    }

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

    if (!firestoreDb) return;

    try {
        const domiId = Number(domiciliarioId);
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
            await Promise.all(promesasDomi);
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
// FUNCIÓN: Enviar notificación FCM a UN TOKEN específico
// ============================================
async function enviarNotificacionFCM(token, titulo, cuerpo, datosExtra = {}) {
    if (!firebaseOk) return;
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
// FUNCIÓN: Enviar FCM a TODOS los ADMINISTRADORES
// ============================================
async function enviarNotificacionAdminsFCM(titulo, cuerpo, datosExtra = {}) {
    if (!firestoreDb) return;
    try {
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

        const message = {
            notification: { title: titulo, body: cuerpo },
            data: datosExtra,
            android: { priority: 'high' },
            webpush: { headers: { Urgency: 'high' } },
            tokens: tokens
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`✅ Notificación FCM Admins enviada: ${response.successCount} exitosas, ${response.failureCount} fallidas.`);

    } catch (error) {
        console.error('❌ Error al enviar FCM masivo a admins:', error.message);
    }
}

// ============================================
// FUNCIÓN: Obtener pedido completo desde GAS
// ★ v2.4: adjunta la clave secreta
// ============================================
async function obtenerPedidoPorId(pedidoId) {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidos&key=${encodeURIComponent(GAS_SECRET_KEY)}`);
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
// ★ v2.4: MATRIZ DE PERMISOS DEL PROXY
// Por defecto TODO requiere sesión. Solo lo listado como público es abierto.
// ============================================
const ACCIONES_PUBLICAS = new Set([
    'login', 'crearPedido', 'getAnunciosActivos', 'getCatalogo',
    'getTiendas', 'getProductos', 'getComplementos' // datos públicos (idénticos al catálogo estático)
]);

const ACCIONES_SOLO_ADMIN = new Set([
    'crearTienda', 'actualizarTienda', 'eliminarTienda',
    'crearProducto', 'actualizarProducto', 'eliminarProducto',
    'crearDomiciliario', 'actualizarDomiciliario', 'eliminarDomiciliario',
    'eliminarPedido', 'eliminarPedidos', 'asignarDomiciliario',
    'getDomiciliarios', 'getUsuariosTienda', 'crearUsuarioTienda', 'actualizarUsuarioTienda', 'eliminarUsuarioTienda',
    'guardarAnuncio', 'cambiarEstadoAnuncio', 'getAnunciosAdmin',
    'crearComplemento', 'eliminarComplemento', 'eliminarComplementos'
]);

const ACCIONES_DOMI_O_ADMIN = new Set([
    'actualizarEstado', 'getPedidos',
    'getPerfilDomiciliario', 'actualizarPerfilDomiciliario'
]);

const ACCIONES_TIENDA_O_ADMIN = new Set([
    'getPedidosTienda', 'actualizarPasswordTienda'
]);

// ★ v2.4: límite simple anti-spam de pedidos (por IP, 5 pedidos cada 10 min)
const registroPedidosPorIP = new Map();
function limitePedidosAlcanzado(ip) {
    const ahora = Date.now();
    const ventana = 10 * 60 * 1000;
    const marcas = (registroPedidosPorIP.get(ip) || []).filter(t => ahora - t < ventana);
    if (marcas.length >= 5) {
        registroPedidosPorIP.set(ip, marcas);
        return true;
    }
    marcas.push(ahora);
    registroPedidosPorIP.set(ip, marcas);
    return false;
}

// ============================================
// PROXY PRINCIPAL — Todas las llamadas a /api
// ============================================
app.all('/api', verificarToken, async (req, res) => {
    try {
        const action = req.query.action || req.body.action;
        console.log(`📥 [${req.method}] action=${action} (User: ${req.user ? `${req.user.nombre} [${req.user.rol}]` : 'Público'})`);

        if (!action) {
            return res.status(400).json({ success: false, error: 'Falta action' });
        }

        // ─────────────────────────────────────────────
        // ★ v2.4: CONTROL DE ACCESO POR DEFECTO CERRADO
        // ─────────────────────────────────────────────
        if (!req.user) {
            if (!ACCIONES_PUBLICAS.has(action)) {
                return res.status(401).json({ success: false, error: 'Debes iniciar sesión para realizar esta acción.' });
            }
        } else {
            const rol = req.user.rol;
            const esAdmin = rol === 'admin';

            if (ACCIONES_SOLO_ADMIN.has(action) && !esAdmin) {
                return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de administrador.' });
            }
            if (ACCIONES_DOMI_O_ADMIN.has(action) && rol !== 'domiciliario' && !esAdmin) {
                return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de domiciliario o administrador.' });
            }
            if (ACCIONES_TIENDA_O_ADMIN.has(action) && rol !== 'tienda' && !esAdmin) {
                return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de tienda o administrador.' });
            }
        }

        // ★ v2.4: anti-spam solo para crearPedido
        if (action === 'crearPedido') {
            const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'desconocida';
            if (limitePedidosAlcanzado(ip)) {
                return res.status(429).json({ success: false, error: 'Demasiados pedidos desde esta conexión. Intenta más tarde.' });
            }
        }

        // ─────────────────────────────────────────────
        // ★ v2.4: CADA QUIEN SOLO SUS PROPIOS DATOS
        // (si el rol es tienda/domiciliario, se fuerza el id del token,
        //  ignorando el que venga en la petición)
        // ─────────────────────────────────────────────
        if (req.user) {
            const uid = String(req.user.id);

            if (req.user.rol === 'tienda') {
                if (action === 'getPedidosTienda') {
                    req.query.tiendaId = uid;
                    if (req.body) req.body.tiendaId = uid;
                }
                if (action === 'actualizarPasswordTienda') {
                    if (req.body) req.body.id = uid;
                    req.query.id = uid;
                }
            }

            if (req.user.rol === 'domiciliario') {
                if (action === 'getPedidos') {
                    req.query.domiciliario = uid;
                }
                if (action === 'getPerfilDomiciliario' || action === 'actualizarPerfilDomiciliario') {
                    req.query.id = uid;
                    if (req.body) req.body.id = uid;
                }
            }
        }

        // ─────────────────────────────────────────────
        // REENVÍO AL GAS (ahora siempre con la clave secreta)
        // ─────────────────────────────────────────────
        let gasUrl = `${GAS_URL}?action=${encodeURIComponent(action)}&key=${encodeURIComponent(GAS_SECRET_KEY)}`;
        for (const key in req.query) {
            if (key !== 'action' && key !== 'key') gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
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

        let data = response.data;
        console.log(`📤 GAS: success=${data.success ?? (Array.isArray(data) ? `array[${data.length}]` : '?')}`);

        // ★ v2.4: si la llamada es anónima, se oculta la comisión de cada tienda
        // (dato comercial sensible). Usuarios con sesión sí la reciben.
        if (action === 'getTiendas' && !req.user && Array.isArray(data)) {
            data = data.map(t => {
                const copia = { ...t };
                delete copia.comision;
                return copia;
            });
        }

        res.json(data);

        if (!data.success) return;

        // ─────────────────────────────────────────────
        // EVENTOS SOCKET / PUSH (sin cambios funcionales)
        // ─────────────────────────────────────────────
        try {
            switch (action) {
                case 'crearPedido': {
                    const pedido = await obtenerPedidoPorId(data.id);
                    io.emit('nuevoPedido', {
                        pedido: pedido || { id: data.id },
                        mensaje: `Nuevo pedido #${data.id}`
                    });
                    console.log(`📦 Emitido nuevoPedido #${data.id}`);

                    const fcmTokenCliente = req.body.fcmToken;
                    if (fcmTokenCliente) {
                        await enviarNotificacionFCM(
                            fcmTokenCliente,
                            '✅ Pedido Recibido',
                            `Tu pedido #${data.id} ha sido confirmado por Domidelis.`,
                            { url: '/confirmacion.html', pedidoId: String(data.id) }
                        );
                    }

                    await enviarNotificacionAdminsFCM(
                        '🛒 ¡NUEVO PEDIDO!',
                        `Cliente: ${pedido?.clienteNombre || 'Desconocido'} - Total: $${parseInt(pedido?.total || 0).toLocaleString('es-CO')}`,
                        { url: '/admin.html', pedidoId: String(data.id) }
                    );

                    try {
                        let productos = [];
                        try { productos = JSON.parse((pedido && pedido.productosJson) || '[]'); } catch (e) { productos = []; }
                        const tiendaIds = [...new Set(productos.map(p => p.tiendaId).filter(Boolean))];

                        for (const tId of tiendaIds) {
                            io.to(`tienda_${tId}`).emit('nuevoPedidoTienda', {
                                pedido: pedido || { id: data.id },
                                mensaje: `Nuevo pedido #${data.id}`
                            });
                            console.log(`📦 Emitido nuevoPedidoTienda → tienda_${tId}`);

                            if (!firestoreDb) continue;
                            const tiendaSnapshot = await firestoreDb.collection('tokens_clientes')
                                .where('rol', '==', 'tienda')
                                .where('tiendaId', 'in', [tId, String(tId), Number(tId)]) 
                                .get();

                            if (!tiendaSnapshot.empty) {
                                console.log(`🔔 Enviando notificaciones push a tienda ID: ${tId} (${tiendaSnapshot.size} dispositivos)...`);
                                
                                const promesasTienda = [];
                                tiendaSnapshot.forEach(docSnap => {
                                    const tiendaToken = docSnap.id;
                                    promesasTienda.push(
                                        enviarNotificacionFCM(
                                            tiendaToken,
                                            '🛍️ ¡Nuevo pedido para tu tienda!',
                                            `Has recibido el pedido #${data.id}. Revisa los detalles en tu panel.`,
                                            { url: '/app-tiendas/index-tienda.html', pedidoId: String(data.id) }
                                        )
                                    );
                                });
                                await Promise.all(promesasTienda);
                            } else {
                                console.log(`⚠️ No se encontraron tokens FCM registrados para la tienda ID: ${tId}`);
                            }
                        }
                    } catch (dbError) {
                        console.error("❌ Error tienda FCM:", dbError.message);
                    }

                    break;
                }

                case 'actualizarEstado': {
                    const pedidoId = (req.body && req.body.pedidoId) || req.query.pedidoId;
                    const nuevoEstado = (req.body && req.body.estado) || req.query.estado;
                    
                    io.emit('estadoActualizado', { pedidoId, nuevoEstado });
                    console.log(`🔄 Emitido estadoActualizado #${pedidoId} → ${nuevoEstado}`);

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

    socket.on('identificar', ({ rol, id, nombre }) => {
        if (!rol) return;

        socket.data.rol = rol;
        socket.data.id = id;
        socket.data.nombre = nombre || '';

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

        if ((rol === 'admin' || rol === 'domiciliario') && id != null && id !== '') {
            const key = clavePresencia(rol, id);
            const prev = presencia.get(key) || {
                rol, id, nombre: nombre || '', estado: 'offline',
                lastSeen: Date.now(), sockets: new Set(), _offlineTimer: null
            };
            if (nombre) prev.nombre = nombre;
            prev.sockets.add(socket.id);
            prev.estado = 'online';
            prev.lastSeen = Date.now();
            if (prev._offlineTimer) {
                clearTimeout(prev._offlineTimer);
                prev._offlineTimer = null;
            }
            presencia.set(key, prev);
            emitirPresencia();
        }

        if (rol === 'admin') {
            socket.emit('presencia:lista', snapshotPresencia());
        }
    });

    socket.on('presencia:ping', () => {
        const { rol, id } = socket.data || {};
        if (!rol || id == null || id === '') return;
        const rec = presencia.get(clavePresencia(rol, id));
        if (!rec) return;
        rec.estado = 'online';
        rec.lastSeen = Date.now();
        presencia.set(clavePresencia(rol, id), rec);
        emitirPresencia();
    });

    socket.on('presencia:away', () => {
        const { rol, id } = socket.data || {};
        if (!rol || id == null || id === '') return;
        const rec = presencia.get(clavePresencia(rol, id));
        if (!rec || rec.sockets.size === 0) return;
        rec.estado = 'away';
        rec.lastSeen = Date.now();
        presencia.set(clavePresencia(rol, id), rec);
        emitirPresencia();
    });

    socket.on('disconnect', () => {
        console.log(`⚠️ Desconectado: ${socket.id}`);
        const { rol, id } = socket.data || {};
        if (!rol || id == null || id === '') return;
        const key = clavePresencia(rol, id);
        const rec = presencia.get(key);
        if (!rec) return;
        rec.sockets.delete(socket.id);
        if (rec.sockets.size === 0) {
            rec._offlineTimer = setTimeout(() => {
                if (rec.sockets.size === 0) {
                    rec.estado = 'offline';
                    rec.lastSeen = Date.now();
                    presencia.set(key, rec);
                    emitirPresencia();
                }
            }, 10000);
        }
        presencia.set(key, rec);
    });
});

app.get('/api/presencia', verificarToken, (req, res) => {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ success: false, error: 'Solo admin' });
    }
    res.json({ success: true, presencia: snapshotPresencia() });
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
    console.log(`  🛡️  v2.4:   Proxy por defecto cerrado + clave GAS`);
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