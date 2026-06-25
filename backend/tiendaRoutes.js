const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyyVoC5d-TLinBgdywos9DbVAUWXvaA1p74oFoextgxpHCxMP8iygTpnh4NQ-vnjC4o2g/exec';
const JWT_SECRET = process.env.JWT_SECRET;

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
// RUTA: Login Tienda (Genera JWT) - ★ ACTUALIZADO
// ============================================
router.post('/login', async (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'Credenciales requeridas.' });

    try {
        const response = await axios.get(`${GAS_URL}?action=login&nombre=${encodeURIComponent(nombre)}&password=${encodeURIComponent(password)}`);
        const data = response.data;

        if (data.success && data.rol === 'tienda') {
            // ★ Incluimos comision, direccion y descripcion en el token y la respuesta
            const tiendaData = {
                id: data.id,
                nombre: data.nombre,
                comision: data.comision || 20,
                direccion: data.direccion || '',
                descripcion: data.descripcion || ''
            };
            const token = jwt.sign({ id: data.id, nombre: data.nombre, rol: 'tienda', comision: data.comision }, JWT_SECRET, { expiresIn: '8h' });
            res.json({ token, tienda: tiendaData });
        } else {
            res.status(401).json({ error: 'Credenciales de establecimiento incorrectas.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error de conexión con el servidor de datos.' });
    }
});

// ============================================
// RUTA: Obtener Productos (Solo Lectura)
// ============================================
router.get('/productos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(`${GAS_URL}?action=getProductos&tiendaId=${req.tienda.id}`);
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo productos.' });
    }
});

// ============================================
// RUTA: Obtener Pedidos de la Tienda (Calculando Subtotal)
// ============================================
router.get('/pedidos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidosTienda&tiendaId=${req.tienda.id}`);
        const pedidos = response.data;

        const pedidosProcesados = pedidos.map(pedido => {
            let productosDeTienda = [];
            let subtotalTienda = 0;

            try {
                const todosLosProductos = JSON.parse(pedido.productosJson);
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

            return {
                ...pedido,
                productosJson: JSON.stringify(productosDeTienda),
                total: subtotalTienda
            };
        });

        res.json(pedidosProcesados);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo pedidos.' });
    }
});

// ============================================
// ★ NUEVA RUTA: Actualizar Perfil (Dirección, Descripción)
// ============================================
router.put('/perfil', verifyTienda, async (req, res) => {
    try {
        const { descripcion, direccion } = req.body;
        const tiendaId = req.tienda.id;

        // Obtenemos datos actuales para no sobrescribir lo que no se cambia
        const currentRes = await axios.get(`${GAS_URL}?action=getTiendas`);
        const tiendas = currentRes.data;
        const current = tiendas.find(t => String(t.id) === String(tiendaId));
        
        if (!current) return res.status(404).json({ error: 'Tienda no encontrada en la base de datos.' });

        // Mandamos a actualizar a Google Sheets
        const updateParams = new URLSearchParams({
            action: 'actualizarTienda',
            id: tiendaId,
            nombre: current.nombre,
            descripcion: descripcion !== undefined ? descripcion : current.descripcion,
            direccion: direccion !== undefined ? direccion : current.direccion,
            horario: current.horario,
            rating: current.rating,
            imagen: current.imagen,
            comision: current.comision
        });

        await axios.post(`${GAS_URL}`, updateParams.toString());
        
        res.json({ success: true, tienda: { id: tiendaId, descripcion, direccion } });
    } catch (err) {
        console.error('Error actualizando perfil:', err.message);
        res.status(500).json({ error: 'Error actualizando el perfil.' });
    }
});

// ============================================
// ★ NUEVA RUTA: Cambiar Contraseña
// ============================================
router.post('/cambiar-password', verifyTienda, async (req, res) => {
    try {
        const { passwordActual, passwordNueva } = req.body;
        const tiendaId = req.tienda.id;
        
        const params = new URLSearchParams({
            action: 'actualizarPasswordTienda',
            id: tiendaId,
            passwordActual: passwordActual,
            passwordNueva: passwordNueva
        });

        const response = await axios.post(GAS_URL, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
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