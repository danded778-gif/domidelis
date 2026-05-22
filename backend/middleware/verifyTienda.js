const jwt = require('jsonwebtoken');

function verifyTienda(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. No hay token' });

    const token = authHeader.split(' ')[1]; // Quita la palabra "Bearer"
    if (!token) return res.status(401).json({ error: 'Token malformado' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.rol !== 'tienda') return res.status(403).json({ error: 'Acceso exclusivo para tiendas' });
        
        req.tienda = verified; // Inyecta los datos de la tienda en la petición
        next();
    } catch (err) {
        res.status(400).json({ error: 'Token inválido o expirado' });
    }
}

module.exports = verifyTienda;