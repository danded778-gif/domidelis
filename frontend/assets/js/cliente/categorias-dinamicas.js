// ============================================
// categorias-dinamicas.js — v1.0
// Módulo de priorización inteligente por horario (Colombia, GMT-5)
//
// ★ Carga SIEMPRE antes de client.js
//
// Funciones expuestas globalmente:
//   - obtenerHoraColombia()               → hora decimal actual en Colombia
//   - obtenerPrioridadesPorHorario()      → categorías prioritarias del momento
//   - obtenerProductosEstrellaPriorizados(productos, limite) → vitrina estrella
// ============================================

// 1. Obtiene la hora decimal exacta en Colombia (GMT-5)
//    Ej: 14:30 → 14.5
function obtenerHoraColombia() {
    const coStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
    const fecha = new Date(coStr);
    return fecha.getHours() + (fecha.getMinutes() / 60);
}

// 2. Retorna las categorías prioritarias según el bloque horario:
//    06:00–10:30 → Desayunos + Bebidas + Farmacia
//    10:30–15:00 → Almuerzos + Bebidas acompañantes
//    15:00–16:00 → Detalles y snacks de la tarde
//    16:00–17:00 → Bienestar / Farmacia
//    17:00–21:00 → Comidas rápidas + Bebidas
//    21:00–23:00 → Licores y cervezas para la noche
//    23:00–06:00 → Modo dinámico base (nocturno/madrugada)
function obtenerPrioridadesPorHorario() {
    const hora = obtenerHoraColombia();
    if (hora >= 6.0 && hora < 10.5) return ['Menu', 'Bebidas', 'Farmacia'];
    if (hora >= 10.5 && hora < 15.0) return ['Almuerzo', 'Bebidas', 'Menu'];
    if (hora >= 15.0 && hora < 16.0) return ['Detalles', 'Bebidas'];
    if (hora >= 16.0 && hora < 17.0) return ['Farmacia', 'Bebidas'];
    if (hora >= 17.0 && hora < 21.0) return ['Menu', 'Bebidas'];
    if (hora >= 21.0 && hora < 23.0) return ['Licores', 'Cervezas', 'Bebidas'];
    return ['Menu', 'Almuerzo', 'Licores', 'Cervezas', 'Bebidas'];
}

// 3. Filtra y prioriza los productos destacados de la vitrina estrella.
//    Los productos de la categoría ideal de la hora actual van primero.
//
//    ★ Nota defensiva: además de imagen válida y no-agotado, se mantienen
//      las protecciones del filtro original de client.js (strings 'null'/
//      'undefined' descartados y badge "Agotado" detectado sin distinción
//      de mayúsculas/minúsculas).
function obtenerProductosEstrellaPriorizados(productos, limite = 4) {
    const prioridad = obtenerPrioridadesPorHorario();
    const catPrincipal = prioridad[0]; // La categoría ideal de la hora actual

    const validos = (productos || []).filter(p =>
        p.imagen_url &&
        p.imagen_url.trim() !== '' &&
        p.imagen_url !== 'null' &&
        p.imagen_url !== 'undefined' &&
        !(p.badge && String(p.badge).toLowerCase() === 'agotado')
    );

    const prioritarios = validos.filter(p => p.categoria === catPrincipal);
    const otros = validos.filter(p => p.categoria !== catPrincipal);

    // Los de la categoría del momento al inicio, el resto después
    return [...prioritarios, ...otros].slice(0, limite);
}