const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

// ============================================
// ★ v2.4: UNA SOLA fuente de verdad
// Misma URL y MISMA clave que server.js (variables de entorno de Railway)
// ============================================
const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbw2R_nABf0FbpfWf_6F9pz2DmHuMrd3N1Dw9_4v6-oETZ2Kmh4pDSNW9mDV0ObGK-sK/exec';
const JWT_SECRET = process.env.JWT_SECRET;
const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;

if (!JWT_SECRET) {
    console.error('❌ Falta JWT_SECRET');
    process.exit(1);
}
if (!GAS_SECRET_KEY) {
    console.error('❌ Falta GAS_SECRET_KEY (la MISMA variable que usa server.js)');
    process.exit(1);
}

// ★ v2.4: helper — construye URL al GAS SIEMPRE con la clave
function gasUrl(action, extra = {}) {
    const params = new URLSearchParams({ action, key: GAS_SECRET_KEY, ...extra });
    return `${GAS_URL}?${params.toString()}`;
}

// ★ v2.4: helper — POST al GAS SIEMPRE con la clave incluida
async function gasPost(paramsObj) {
    const body = new URLSearchParams({ key: GAS_SECRET_KEY, ...paramsObj }).toString();
    return axios.post(GAS_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
}

// ============================================
// MIDDLEWARE: Verificar Token JWT de Tienda
// ============================================
function verifyTienda(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.rol !== 'tienda') return res.status(403).json({ error: 'Acceso exclusivo para establecimientos.' });
        req.tienda = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

// ============================================
// RUTA: Login Tienda (Genera JWT)
// ★ v2.4: ahora va por POST al GAS (las credenciales ya no viajan en la URL)
// ============================================
router.post('/login', async (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'Credenciales requeridas.' });

    try {
        const response = await gasPost({ action: 'login', nombre, password });
        const data = response.data;

        if (data.success && data.rol === 'tienda') {
            const tiendaData = {
                id: data.id,
                nombre: data.nombre,
                comision: data.comision || 20,
                direccion: data.direccion || '',
                descripcion: data.descripcion || '',
                horario: data.horario || '{"mon":"08:00-22:00","tue":"08:00-22:00","wed":"08:00-22:00","thu":"08:00-22:00","fri":"08:00-22:00","sat":"08:00-22:00","sun":"Cerrado"}'
            };

            const token = jwt.sign({ id: data.id, nombre: data.nombre, rol: 'tienda', comision: data.comision }, JWT_SECRET, { expiresIn: '8h' });
            res.json({ token, tienda: tiendaData });
        } else {
            // ★ v2.4: si el GAS dijo "no autorizado", es un problema de configuración, no de credenciales
            if (data.error && String(data.error).includes('no autorizado')) {
                console.error('🚨 GAS rechazó la clave en login de tienda. Revisa GAS_SECRET_KEY.');
            }
            res.status(401).json({ error: 'Credenciales de establecimiento incorrectas.' });
        }
    } catch (err) {
        console.error('Error en login tienda (GAS):', err.message);
        res.status(500).json({ error: 'Error de conexión con el servidor de datos.' });
    }
});

// ============================================
// RUTA: Obtener Productos (Solo Lectura)
// ============================================
router.get('/productos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(gasUrl('getProductos', { tiendaId: req.tienda.id }));
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo productos.' });
    }
});

// ============================================
// RUTA: Obtener Pedidos de la Tienda
// ============================================
router.get('/pedidos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(gasUrl('getPedidosTienda', { tiendaId: req.tienda.id }));
        // ★ v2.4: blindaje — si el GAS rechazó, responde objeto y no array
        const pedidos = Array.isArray(response.data) ? response.data : [];

        let domiciliarios = [];
        try {
            const domiRes = await axios.get(gasUrl('getDomiciliarios'));
            domiciliarios = Array.isArray(domiRes.data) ? domiRes.data : [];
        } catch (e) {
            console.warn('No se pudieron cargar domiciliarios para enriquecer pedidos');
        }

        const pedidosProcesados = pedidos.map(pedido => {
            let productosDeTienda = [];
            let subtotalTienda = 0;

            try {
                const todosLosProductos = JSON.parse(pedido.productosJson || '[]');
                productosDeTienda = todosLosProductos.filter(p => String(p.tiendaId) === String(req.tienda.id));

                subtotalTienda = productosDeTienda.reduce((suma, p) => {
                    if (p.subtotal !== undefined && p.subtotal !== null) {
                        return suma + parseFloat(p.subtotal);
                    } else {
                        const precio = parseFloat(p.precioUnitario || p.precio || 0);
                        const cantidad = parseInt(p.cantidad || 1);
                        return suma + (precio * cantidad);
                    }
                }, 0);
            } catch (e) {
                productosDeTienda = [];
                subtotalTienda = 0;
            }

            let domiciliarioNombre = null;
            if (pedido.domiciliarioId) {
                const domi = domiciliarios.find(d => String(d.id) === String(pedido.domiciliarioId));
                if (domi) domiciliarioNombre = domi.nombre;
            }

            return {
                ...pedido,
                productosJson: JSON.stringify(productosDeTienda),
                total: subtotalTienda,
                domiciliarioNombre
            };
        });

        res.json(pedidosProcesados);
    } catch (err) {
        console.error('Error obteniendo pedidos de tienda:', err.message);
        res.status(500).json({ error: 'Error obteniendo pedidos.' });
    }
});

// ============================================
// RUTA: Actualizar Perfil (Dirección, Descripción y Horario)
// ============================================
router.put('/perfil', verifyTienda, async (req, res) => {
    try {
        const { descripcion, direccion, horario } = req.body;
        const tiendaId = req.tienda.id;

        const currentRes = await axios.get(gasUrl('getTiendas'));
        const tiendas = Array.isArray(currentRes.data) ? currentRes.data : [];
        const current = tiendas.find(t => String(t.id) === String(tiendaId));

        if (!current) return res.status(404).json({ error: 'Tienda no encontrada en la base de datos.' });

        // ★ v2.4: POST con clave — Y se incluye "promovida" (BUG ANTIGUO CORREGIDO:
        //   antes, cada vez que la tienda editaba su perfil, perdía el estado promovida)
        await gasPost({
            action: 'actualizarTienda',
            id: tiendaId,
            nombre: current.nombre,
            descripcion: descripcion !== undefined ? descripcion : current.descripcion,
            direccion: direccion !== undefined ? direccion : current.direccion,
            horario: horario !== undefined ? horario : current.horario,
            rating: current.rating,
            imagen: current.imagen,
            comision: current.comision,
            promovida: current.promovida || 0
        });

        res.json({
            success: true,
            tienda: {
                id: tiendaId,
                descripcion,
                direccion,
                horario
            }
        });
    } catch (err) {
        console.error('Error actualizando perfil:', err.message);
        res.status(500).json({ error: 'Error actualizando el perfil.' });
    }
});

// ============================================
// RUTA: Cambiar Contraseña
// ============================================
router.post('/cambiar-password', verifyTienda, async (req, res) => {
    try {
        const { passwordActual, passwordNueva } = req.body;
        const tiendaId = req.tienda.id;

        const response = await gasPost({
            action: 'actualizarPasswordTienda',
            id: tiendaId,
            passwordActual: passwordActual,
            passwordNueva: passwordNueva
        });
        const data = response.data;

        if (data.success) {
            res.json({ success: true, mensaje: data.mensaje });
        } else {
            res.status(400).json({ error: data.error || 'No se pudo actualizar la contraseña.' });
        }
    } catch (err) {
        console.error('Error cambiando contraseña:', err.message);
        res.status(500).json({ error: 'Error en el servidor al cambiar contraseña.' });
    }
});

module.exports = router;