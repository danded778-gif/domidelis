// ============================================
// catalogoRoutes.js — Catálogo fresco para el cliente (Tema 2)
// Ubicación: backend/routes/catalogoRoutes.js
//
// ★ QUÉ HACE
// - Lee tiendas + productos + complementos del GAS (3 llamadas
//   EXISTENTES, sin productoId/tiendaId = todos) y los ensambla
//   en el MISMO formato que catalogo.json (el cliente no cambia
//   su forma de leer).
// - Caché en memoria de 60s: 20 clientes que abren a la vez
//   = 1 sola visita al GAS (que tarda 1-3s).
// - Si el GAS falla: sirve la última copia en memoria.
// - La comisión de cada tienda NUNCA viaja al cliente
//   (mismo criterio que ya aplica tu proxy para getTiendas).
// ============================================

const express = require('express');
const axios = require('axios');
const router = express.Router();

const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbyAYydmeZX4Ae1SJfvad3K4EI7WTAX9cxjVvYVF7ERQy027sPEzNP8DYJXu6oSzARe4/exec';
const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;

function gasUrl(action, extra = {}) {
    const params = new URLSearchParams({ action, key: GAS_SECRET_KEY, ...extra });
    return `${GAS_URL}?${params.toString()}`;
}

// ─── Caché en memoria ─────────────────────
let cache = { data: null, timestamp: 0 };
const TTL_MS = 60_000; // 1 minuto

router.get('/', async (req, res) => {
    try {
        if (cache.data && Date.now() - cache.timestamp < TTL_MS) {
            return res.json(cache.data);
        }

        // ★ Sin tiendaId → TODOS los productos.
        // ★ Sin productoId → TODOS los complementos.
        const [tiendasRes, productosRes, complementosRes] = await Promise.all([
            axios.get(gasUrl('getTiendas')),
            axios.get(gasUrl('getProductos')),
            axios.get(gasUrl('getComplementos')).catch(() => null)
        ]);

        // ★ Blindaje: el GAS SIEMPRE responde 200, incluso rechazando la clave.
        //   Si llega {success:false,...} en vez de array, es configuración rota:
        //   mejor error visible que un catálogo VACIO servido como válido.
        if (!Array.isArray(tiendasRes.data)) {
            throw new Error('GAS/getTiendas respondió: ' + JSON.stringify(tiendasRes.data).slice(0, 120));
        }
        if (!Array.isArray(productosRes.data)) {
            throw new Error('GAS/getProductos respondió: ' + JSON.stringify(productosRes.data).slice(0, 120));
        }

        const productos = productosRes.data;
        const complementos = (complementosRes && complementosRes.data && Array.isArray(complementosRes.data.complementos))
            ? complementosRes.data.complementos
            : [];

        // ─── Ensamblar el formato de catalogo.json ───
        const tiendas = tiendasRes.data.map(t => {
            const { comision, ...publica } = t; // ★ comisión fuera del cliente
            publica.activo = true;
            publica.productos = productos
                .filter(p => String(p.tiendaId) === String(t.id))
                .map(p => ({
                    ...p,
                    cantidadTipo: 'UND',
                    activo: true,
                    tiendaId: String(t.id),
                    tiendaNombre: t.nombre
                }));
            return publica;
        });

        const productosGlobal = productos.map(p => {
            const tienda = tiendas.find(t => String(t.id) === String(p.tiendaId));
            return {
                ...p,
                cantidadTipo: 'UND',
                activo: true,
                tiendaId: String(p.tiendaId || ''),
                tiendaNombre: tienda ? tienda.nombre : 'Sin tienda'
            };
        });

        const data = {
            tiendas,
            productosGlobal,
            complementosGlobal: complementos
        };

        cache = { data, timestamp: Date.now() };

        res.set('Cache-Control', 'no-store'); // el offline lo maneja el SW del cliente
        return res.json(data);

    } catch (err) {
        console.error('❌ /api/catalogo:', err.message);
        if (cache.data) return res.json(cache.data); // datos de hace 1 min > error
        return res.status(502).json({ success: false, error: 'No se pudo obtener el catálogo' });
    }
});

module.exports = router;