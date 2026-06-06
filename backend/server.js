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

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ Faltan JWT_SECRET en el archivo .env');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);

// ============================================
// CORS: true en desarrollo, restringido en producción
// ============================================
const isDev = process.env.NODE_ENV !== 'production';

const io = socketIo(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization'] // <--- AÑADIDO
    }
});

app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'] // <--- AÑADIDO
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
        // 1. Consultar a Google Apps Script
        const url = `${GAS_URL}?action=login&nombre=${encodeURIComponent(nombre)}&password=${encodeURIComponent(password)}`;
        const response = await axios.get(url);
        const data = response.data;

        // 2. Si GAS valida correctamente, generamos el Token
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
// MIDDLEWARE: Verificar Token JWT (Híbrido)
// Permite acceso sin token (clientes), pero 
// bloquea si el token es inválido/expirado.
// ============================================
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null; // No hay token, usuario público
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Token válido, guardamos datos del usuario
        next();
    } catch (error) {
        // Si mandaron token pero está mal/expirado, devolvemos error 403
        // El frontend usará esto para expulsar al usuario
        return res.status(403).json({ success: false, error: 'Token inválido o expirado.' });
    }
}

// ============================================
// SUSCRIPCIONES PUSH
// ============================================
const suscripciones = new Map();

// ============================================
// GOOGLE APPS SCRIPT — URL fija
// ============================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxTFiS-yI38sWf8_0oQuw-bxysVi-JqVeEm57aRHuLw3LaLATabkJw2VUG6Am9eX9JXaw/exec';

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
        icon: '/domidelis/assets/img/icon-192x192.png',
        badge: '/domidelis/assets/img/icon-192x192.png',
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
// FUNCIÓN INTERNA: Enviar push a UN domiciliario
// ============================================
async function enviarPushADomiciliario(domiciliarioId, pedidoId, pedidoDetalle) {
    const cuerpo = pedidoDetalle
        ? `Pedido #${pedidoId} - ${pedidoDetalle.clienteNombre || ''} - $${parseInt(pedidoDetalle.total || 0).toLocaleString('es-CO')}`
        : `Pedido #${pedidoId} asignado`;

    const payload = JSON.stringify({
        title: '🛵 Nuevo pedido asignado',
        body: cuerpo,
        url: '/domiciliario.html',
        tipo: 'asignacion',
        pedidoId: String(pedidoId),
        icon: '/domidelis/assets/img/icon-192x192.png',
        badge: '/domidelis/assets/img/icon-192x192.png',
        tag: `asignacion-${pedidoId}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/domiciliario.html', pedidoId: String(pedidoId), tipo: 'asignacion' }
    });

    for (const [endpoint, subData] of suscripciones) {
        if (String(subData.usuarioId) !== String(domiciliarioId)) continue;
        if (subData.rol !== 'domiciliario') continue;
        try {
            await webpush.sendNotification(subData.subscription, payload);
            console.log(`📱 Push enviado → domiciliario ${domiciliarioId}`);
        } catch (error) {
            console.error(`❌ Push falló → domiciliario ${domiciliarioId}: ${error.message}`);
            if (error.statusCode === 410 || error.statusCode === 404) {
                suscripciones.delete(endpoint);
            }
        }
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
    // 🚀 NUEVO: Servir la App de Tiendas
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

        // ============================================
        // 🔒 PROTECCIÓN DE RUTAS POR ROL
        // ============================================
        const accionesAdmin = ['crearTienda', 'actualizarTienda', 'eliminarTienda', 'crearProducto', 'actualizarProducto', 'eliminarProducto', 'crearDomiciliario', 'actualizarDomiciliario', 'eliminarDomiciliario', 'eliminarPedidos', 'asignarDomiciliario'];
        const accionesDomiciliario = ['actualizarEstado'];
        const accionesAutenticadas = ['getDomiciliarios', 'getPedidos']; // Requieren login, pero cualquier rol

        if (accionesAdmin.includes(action) && req.user?.rol !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de administrador.' });
        }

        if (accionesDomiciliario.includes(action) && !['admin', 'domiciliario'].includes(req.user?.rol)) {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de domiciliario o admin.' });
        }

        if (accionesAutenticadas.includes(action) && !req.user) {
            return res.status(401).json({ success: false, error: 'Debes iniciar sesión para ver esta información.' });
        }

        // Construir URL para GAS
        let gasUrl = `${GAS_URL}?action=${action}`;
        for (const key in req.query) {
            if (key !== 'action') gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
        }

        // Llamar a Google Apps Script
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

        // ===== RESPONDER AL CLIENTE INMEDIATAMENTE =====
        res.json(data);

        // ===== SOCKET.IO + PUSH (después de responder) =====
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
                            icon: '/domidelis/assets/img/icon-192x192.png',
                            badge: '/domidelis/assets/img/icon-192x192.png',
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
const tiendaRoutes = require('./routes/tiendaRoutes'); // <--- RUTAS NUEVAS PARA TIENDAS
app.use('/api/tienda', tiendaRoutes);                 // <--- USAMOS EL NUEVO ROUTER PARA RUTAS DE TIENDAS
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
    console.log(`  📡 Push:    ${suscripciones.size} suscripciones`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    if (isDev) {
        console.log('  ⏳ Abre otra terminal y ejecuta:');
        console.log('     ngrok http 80');
        console.log('');
    }
});