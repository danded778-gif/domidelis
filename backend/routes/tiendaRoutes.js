const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwIiA3LB_C1mITpOFMH7IhGglOr7I0oQF20i24BrSmCdOLYttbmDXbnwnl4kEXr6F3f2Q/exec'; // Asegúrate de usar tu URL correcta
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
        req.tienda = decoded; // id, nombre, rol
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

// ============================================
// RUTA: Login Tienda (Genera JWT)
// ============================================
router.post('/login', async (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'Credenciales requeridas.' });

    try {
        const response = await axios.get(`${GAS_URL}?action=login&nombre=${encodeURIComponent(nombre)}&password=${encodeURIComponent(password)}`);
        const data = response.data;

        if (data.success && data.rol === 'tienda') {
            const token = jwt.sign({ id: data.id, nombre: data.nombre, rol: 'tienda' }, JWT_SECRET, { expiresIn: '8h' });
            res.json({ token, tienda: { id: data.id, nombre: data.nombre } });
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
// RUTA: Obtener Pedidos de la Tienda (Con cálculo de subtotal)
// ============================================
router.get('/pedidos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidosTienda&tiendaId=${req.tienda.id}`);
        const pedidos = response.data;

        // 🚀 MAGIA: Procesar cada pedido para ocultar domicilio y productos ajenos
        const pedidosProcesados = pedidos.map(pedido => {
            let productosDeTienda = [];
            let subtotalTienda = 0;

            try {
                const todosLosProductos = JSON.parse(pedido.productosJson);
                
                // 1. Filtrar SOLO los productos que le pertenecen a esta tienda
                productosDeTienda = todosLosProductos.filter(p => String(p.tiendaId) === String(req.tienda.id));
                
                // 2. Calcular el subtotal (Sumar precio * cantidad de SUS productos)
                subtotalTienda = productosDeTienda.reduce((suma, p) => {
                    const precio = parseFloat(p.precio) || 0;
                    const cantidad = parseInt(p.cantidad) || 1;
                    return suma + (precio * cantidad);
                }, 0);

            } catch (e) {
                // Si el JSON está malo, lo dejamos vacío para no romper la app
                productosDeTienda = [];
                subtotalTienda = 0;
            }

            // 3. Devolver el pedido modificado
            return {
                ...pedido,
                productosJson: JSON.stringify(productosDeTienda), // Reescribimos el JSON solo con sus productos
                total: subtotalTienda // Sobreescribimos el total. Ahora es SUBTOTAL (sin domicilio ni otros)
            };
        });

        res.json(pedidosProcesados);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo pedidos.' });
    }
});

module.exports = router;