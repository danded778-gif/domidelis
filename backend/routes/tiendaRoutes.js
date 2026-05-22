const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzWPItJZZ-UK2CcPbi0v5BqQiv_WR5-DAxCE2HAW3VWx5Kv5Yfs9nPPXc_UyCm_eSv6Eg/exec';
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
// RUTA: Obtener Pedidos de la Tienda
// ============================================
router.get('/pedidos', verifyTienda, async (req, res) => {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidosTienda&tiendaId=${req.tienda.id}`);
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo pedidos.' });
    }
});

module.exports = router;