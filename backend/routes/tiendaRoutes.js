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
        req.tienda = decoded;
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
// RUTA: Obtener Pedidos de la Tienda (Calculando Subtotal)
// ============================================
router.get('/pedidos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidosTienda&tiendaId=${req.tienda.id}`);
        const pedidos = response.data;

        // Procesar cada pedido
        const pedidosProcesados = pedidos.map(pedido => {
            let productosDeTienda = [];
            let subtotalTienda = 0;

            try {
                const todosLosProductos = JSON.parse(pedido.productosJson);
                
                // 1. Filtrar SOLO los productos que le pertenecen a esta tienda
                productosDeTienda = todosLosProductos.filter(p => String(p.tiendaId) === String(req.tienda.id));
                
                // 2. Calcular el subtotal de la tienda
                subtotalTienda = productosDeTienda.reduce((suma, p) => {
                    /* 
                       ★ CORRECCIÓN KEY ★
                       client.js ya calcula y guarda 'subtotal' por cada item.
                       Si existe p.subtotal, lo usamos directo.
                       Si no existe (datos viejos), multiplicamos precioUnitario * cantidad
                    */
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

            // 3. Devolver el pedido modificado
            return {
                ...pedido,
                productosJson: JSON.stringify(productosDeTienda), // Solo sus productos
                total: subtotalTienda // Sobreescribimos el total con el SUBTOTAL de la tienda
            };
        });

        res.json(pedidosProcesados);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo pedidos.' });
    }
});

module.exports = router;