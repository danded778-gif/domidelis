// ============================================
// informe-financiero.js — Informes del panel admin
// Chart.js + lógica financiera
// ============================================

let informeCargado = false;
let chartsInstancias = {};

const PALETA = [
    '#E63946', '#2A9D8F', '#F4A261', '#264653', '#E76F51',
    '#457B9D', '#606C38', '#8338EC', '#BC6C25', '#06D6A0'
];

const COLORES_METODO = {
    'Efectivo': { bg: '#28a745', clase: 'efectivo' },
    'Nequi': { bg: '#8338EC', clase: 'nequi' },
    'Daviplata': { bg: '#E63946', clase: 'daviplata' },
    'Transferencia': { bg: '#457B9D', clase: 'transferencia' }
};

// ─── ENTRADA PRINCIPAL ─────────────────────
async function cargarInformes() {
    const loading = document.getElementById('inf-loading');
    const contenido = document.getElementById('inf-contenido');
    if (!loading || !contenido) return;

    loading.style.display = 'block';
    contenido.style.display = 'none';

    try {
        // Obtener pedidos entregados y tiendas
        const [resPedidos, resTiendas] = await Promise.all([
            fetchConToken(`${API_URL}?action=getPedidos`),
            fetchConToken(`${API_URL}?action=getTiendas`)
        ]);
        const todosPedidos = await resPedidos.json();
        const tiendas = await resTiendas.json();

        // Guardar para filtros
        window._infPedidos = todosPedidos.filter(p => p.estado === 'entregado');
        window._infTiendas = Array.isArray(tiendas) ? tiendas : [];

        // Llenar select de tienda en filtros
        llenarSelectTiendaInforme();

        // Calcular y renderizar con filtro "todos"
        renderizarInforme(window._infPedidos);

        informeCargado = true;
        loading.style.display = 'none';
        contenido.style.display = 'block';
    } catch (error) {
        console.error('Error cargando informes:', error);
        loading.innerHTML = `<div class="inf-vacio"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar</h3><p>No se pudieron obtener los datos</p><button class="btn btn-primary" onclick="cargarInformes()"><i class="fas fa-sync-alt"></i> Reintentar</button></div>`;
    }
}

// ─── LLENAR SELECT DE TIENDA ────────────────
function llenarSelectTiendaInforme() {
    const select = document.getElementById('inf-tienda');
    if (!select || !window._infTiendas) return;
    select.innerHTML = '<option value="">Todas</option>' +
        window._infTiendas.map(t =>
            `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`
        ).join('');
}

// ─── FILTROS ────────────────────────────────
function establecerPeriodo(periodo, btn) {
    document.querySelectorAll('.inf-preset-btn')
        .forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const desde = document.getElementById('inf-fecha-desde');
    const hasta = document.getElementById('inf-fecha-hasta');
    
    const hoy = hoyEnColombia();

    switch (periodo) {
        case 'hoy':
            desde.value = hoy;
            hasta.value = hoy;
            break;
        case 'ayer': {
            const ayer = new Date(hoy);
            ayer.setDate(hoy.getDate() - 1);
            desde.value = fmt(ayer);
            hasta.value = fmt(ayer);
            break;
        }
        case 'semana': {
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() - hoy.getDay());
            lunes.setHours(0, 0, 0, 0);
            desde.value = fmt(lunes);
            hasta.value = fmt(hoy);
            break;
        }
        case 'mes':
            desde.value = fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
            hasta.value = fmt(hoy);
            break;
        case 'todos':
        default:
            desde.value = '';
            hasta.value = '';
            break;
    }
    aplicarFiltrosInforme();
}

function aplicarFiltrosInforme() {
    if (!window._infPedidos) return;

    const desde = document.getElementById('inf-fecha-desde').value;
    const hasta = document.getElementById('inf-fecha-hasta').value;
    const tiendaId = document.getElementById('inf-tienda').value;
    const metodo = document.getElementById('inf-metodo').value;

    document.querySelectorAll('.inf-preset-btn').forEach(b => b.classList.remove('active'));

    let filtrados = [...window._infPedidos];

    if (desde) {
        const d = new Date(desde + 'T00:00:00');
        filtrados = filtrados.filter(p => new Date(p.fecha) >= d);
    }
    if (hasta) {
        const d = new Date(hasta + 'T23:59:59');
        filtrados = filtrados.filter(p => new Date(p.fecha) <= d);
    }
    if (metodo) {
        filtrados = filtrados.filter(p => (p.metodoPago || '') === metodo);
    }

    if (tiendaId) {
        filtrados = filtrados
            .map(p => {
                let productos = [];
                try { productos = JSON.parse(p.productosJson || '[]'); } catch (e) { }

                const productosFiltrados = productos.filter(
                    pr => String(pr.tiendaId) === tiendaId
                );

                if (productosFiltrados.length === 0) return null;

                const nuevoTotal = productosFiltrados.reduce(
                    (s, pr) => s + (parseFloat(pr.subtotal) || 0), 0
                );

                return {
                    ...p,
                    productosJson: JSON.stringify(productosFiltrados),
                    total: nuevoTotal
                };
            })
            .filter(Boolean);
    }

    renderizarInforme(filtrados);
}

// ─── CÁLCULOS FINANCIEROS ──────────────────
function calcularDatos(pedidos) {
    let totalIngresos = 0;   // Suma de domicilios (tu ganancia)
    let totalEgresos = 0;    // Suma de productos (devuelves a tiendas)
    let totalCobrado = 0;    // Lo que pagó el cliente (productos + domicilio)
    let tiendasMap = new Map(); // { tiendaId: { nombre, total, metodos: {}, pedidos: Set } }
    let metodosGlobal = {};   // { 'Efectivo': total, 'Nequi': total, ... }

    pedidos.forEach(pedido => {
        let productos = [];
        try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { }

        // Calcular subtotal productos y envío
        const subtotalProductos = productos.reduce((s, pr) => s + (parseFloat(pr.subtotal) || 0), 0);
        const envio = parseFloat(pedido.total) - subtotalProductos;
        const totalPedido = parseFloat(pedido.total) || 0;
        const metodo = pedido.metodoPago || 'Efectivo';

        // Acumular globales
        totalIngresos += Math.max(0, envio);
        totalEgresos += subtotalProductos;
        totalCobrado += totalPedido;
        metodosGlobal[metodo] = (metodosGlobal[metodo] || 0) + totalPedido;

        // Acumular por tienda
        const tiendasEnPedido = new Map();
        productos.forEach(pr => {
            const tid = String(pr.tiendaId || 'sin-tienda');
            const tnombre = pr.tiendaNombre || obtenerNombreTienda(tid) || `Tienda #${tid}`;
            const monto = parseFloat(pr.subtotal) || 0;

            if (!tiendasEnPedido.has(tid)) {
                tiendasEnPedido.set(tid, { nombre: tnombre, monto: 0 });
            }
            tiendasEnPedido.get(tid).monto += monto;
        });

        tiendasEnPedido.forEach((info, tid) => {
            if (!tiendasMap.has(tid)) {
                tiendasMap.set(tid, {
                    nombre: info.nombre,
                    total: 0,
                    metodos: {},
                    pedidos: new Set()
                });
            }
            const td = tiendasMap.get(tid);
            td.total += info.monto;
            td.metodos[metodo] = (td.metodos[metodo] || 0) + info.monto;
            td.pedidos.add(pedido.id);
        });
    });

    return {
        totalIngresos,
        totalEgresos,
        totalCobrado,
        balance: totalIngresos - totalEgresos,
        cantidadPedidos: pedidos.length,
        tiendas: tiendasMap,
        metodos: metodosGlobal
    };
}

function obtenerNombreTienda(tid) {
    if (!window._infTiendas) return null;
    const t = window._infTiendas.find(t => String(t.id) === String(tid));
    return t ? t.nombre : null;
}

// ─── RENDERIZAR TODO ────────────────────────
function renderizarInforme(pedidos) {
    const datos = calcularDatos(pedidos);

    renderKPIs(datos);
    renderFlujo(datos);
    renderDestacada(datos);
    renderChartBarras(datos);
    renderChartDonutTiendas(datos);
    renderChartMetodos(datos);
    renderResumenMetodos(datos);
    renderTablaDesglose(datos);
}

// ─── KPIs ───────────────────────────────────
function renderKPIs(datos) {
    const elIngresos = document.getElementById('inf-kpi-ingresos');
    const elEgresos = document.getElementById('inf-kpi-egresos');
    const elBalance = document.getElementById('inf-kpi-balance');
    const elBalanceCard = document.getElementById('inf-kpi-balance-card');
    const elBalanceSub = document.getElementById('inf-kpi-balance-sub');
    const elPedidos = document.getElementById('inf-kpi-pedidos');

    animarValor(elIngresos, datos.totalIngresos);
    animarValor(elEgresos, datos.totalEgresos);
    animarValor(elBalance, datos.balance);
    elPedidos.textContent = datos.cantidadPedidos;

    if (datos.balance < 0) {
        elBalanceCard.classList.add('negativo');
        elBalanceSub.textContent = 'Pérdida neta';
    } else {
        elBalanceCard.classList.remove('negativo');
        elBalanceSub.textContent = 'Tu ganancia neta';
    }
}

function animarValor(elemento, valorFinal) {
    if (!elemento) return;
    const duracion = 800;
    const inicio = performance.now();

    function actualizar(now) {
        const progreso = Math.min((now - inicio) / duracion, 1);
        const ease = 1 - Math.pow(1 - progreso, 3);
        const actual = Math.round(valorFinal * ease);
        elemento.textContent = formatearPesos(actual);
        if (progreso < 1) requestAnimationFrame(actualizar);
    }
    requestAnimationFrame(actualizar);
}

function formatearPesos(n) {
    return '$' + Math.round(n).toLocaleString('es-CO');
}

// ─── FLUJO DE DINERO ────────────────────────
function renderFlujo(datos) {
    const elCliente = document.getElementById('inf-flujo-cliente');
    const elRetienes = document.getElementById('inf-flujo-retienes');
    const elDevuelves = document.getElementById('inf-flujo-devuelves');

    if (elCliente) elCliente.textContent = formatearPesos(datos.totalCobrado);
    if (elRetienes) elRetienes.textContent = formatearPesos(datos.totalIngresos);
    if (elDevuelves) elDevuelves.textContent = formatearPesos(datos.totalEgresos);
}

// ─── TIENDA DESTACADA ───────────────────────
function renderDestacada(datos) {
    const el = document.getElementById('inf-destacada');
    if (!el) return;

    if (datos.tiendas.size === 0) {
        el.style.display = 'none';
        return;
    }

    let topTienda = null;
    let topMonto = 0;
    datos.tiendas.forEach((td, tid) => {
        if (td.total > topMonto) {
            topMonto = td.total;
            topTienda = { nombre: td.nombre, total: td.total, pedidos: td.pedidos.size };
        }
    });

    if (!topTienda) { el.style.display = 'none'; return; }

    el.style.display = 'flex';
    document.getElementById('inf-destacada-nombre').textContent = topTienda.nombre;
    document.getElementById('inf-destacada-stats').textContent =
        `${topTienda.pedidos} pedidos · ${formatearPesos(topTienda.total)} en productos`;
}

// ─── CHART: BARRAS (Ingresos vs Egresos) ────
function renderChartBarras(datos) {
    destruirChart('chartBarras');

    const canvas = document.getElementById('chartBarras');
    if (!canvas) return;

    const labels = [];
    const datosIngresos = [];
    const datosEgresos = [];

    datos.tiendas.forEach((td) => {
        labels.push(td.nombre.length > 18 ? td.nombre.substring(0, 18) + '…' : td.nombre);
        // El ingreso por tienda = proporción de envíos
        // Como el envío es por pedido y un pedido puede tener varias tiendas,
        // repartimos el envío proporcionalmente al monto de productos
        datosEgresos.push(td.total);
        datosIngresos.push(0); // Se calcula abajo
    });

    // Calcular ingreso proporcional por tienda
    if (datos.totalEgresos > 0) {
        datos.tiendas.forEach((td, i) => {
            const proporcion = td.total / datos.totalEgresos;
            datosIngresos[i] = Math.round(datos.totalIngresos * proporcion);
        });
    }

    chartsInstancias['chartBarras'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Ingresos (Domicilios)',
                    data: datosIngresos,
                    backgroundColor: 'rgba(42, 157, 143, 0.8)',
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Egresos (Productos)',
                    data: datosEgresos,
                    backgroundColor: 'rgba(230, 57, 70, 0.8)',
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { family: 'Poppins', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': ' + formatearPesos(ctx.raw)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v),
                        font: { family: 'Poppins', size: 11 }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { font: { family: 'Poppins', size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ─── CHART: DONUT TIENDAS ──────────────────
function renderChartDonutTiendas(datos) {
    destruirChart('chartDonutTiendas');

    const canvas = document.getElementById('chartDonutTiendas');
    if (!canvas) return;

    const labels = [];
    const valores = [];
    const colores = [];

    datos.tiendas.forEach((td, i) => {
        labels.push(td.nombre);
        valores.push(td.total);
        colores.push(PALETA[i % PALETA.length]);
    });

    if (valores.length === 0) {
        labels.push('Sin datos');
        valores.push(1);
        colores.push('#e0e0e0');
    }

    chartsInstancias['chartDonutTiendas'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: colores,
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, font: { family: 'Poppins', size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + formatearPesos(ctx.raw) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ─── CHART: DONUT MÉTODOS DE PAGO ──────────
function renderChartMetodos(datos) {
    destruirChart('chartDonutMetodos');

    const canvas = document.getElementById('chartDonutMetodos');
    if (!canvas) return;

    const labels = [];
    const valores = [];
    const colores = [];

    Object.keys(datos.metodos).forEach(metodo => {
        labels.push(metodo);
        valores.push(datos.metodos[metodo]);
        colores.push((COLORES_METODO[metodo] || {}).bg || '#999');
    });

    if (valores.length === 0) {
        labels.push('Sin datos');
        valores.push(1);
        colores.push('#e0e0e0');
    }

    chartsInstancias['chartDonutMetodos'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: colores,
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + formatearPesos(ctx.raw) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ─── RESUMEN MÉTODOS DE PAGO (texto) ───────
function renderResumenMetodos(datos) {
    const contenedor = document.getElementById('inf-metodos-resumen');
    if (!contenedor) return;

    const totalMetodos = Object.values(datos.metodos).reduce((a, b) => a + b, 0);

    if (totalMetodos === 0) {
        contenedor.innerHTML = '<p style="color:var(--gray);text-align:center;padding:2rem;">Sin datos en este período</p>';
        return;
    }

    // Ordenar de mayor a menor
    const ordenados = Object.entries(datos.metodos)
        .sort((a, b) => b[1] - a[1]);

    contenedor.innerHTML = ordenados.map(([metodo, monto]) => {
        const pct = ((monto / totalMetodos) * 100).toFixed(1);
        const color = (COLORES_METODO[metodo] || {}).bg || '#999';
        return `
            <div class="inf-metodo-item">
                <div class="inf-metodo-dot" style="background:${color};"></div>
                <div class="inf-metodo-nombre">${metodo}</div>
                <div class="inf-metodo-valor">${formatearPesos(monto)}</div>
                <div class="inf-metodo-pct">${pct}%</div>
            </div>
        `;
    }).join('');
}

// ─── TABLA DESGLOSE POR TIENDA ─────────────
function renderTablaDesglose(datos) {
    const tbody = document.querySelector('#inf-tabla-desglose tbody');
    if (!tbody) return;

    if (datos.tiendas.size === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gray);">Sin datos en este período</td></tr>';
        return;
    }

    let htmlFilas = '';
    let totalGeneral = 0;
    let totalEfectivo = 0, totalNequi = 0, totalDaviplata = 0, totalTransferencia = 0;
    let totalPedidos = 0;

    datos.tiendas.forEach((td) => {
        const efectivo = td.metodos['Efectivo'] || 0;
        const nequi = td.metodos['Nequi'] || 0;
        const daviplata = td.metodos['Daviplata'] || 0;
        const transferencia = td.metodos['Transferencia'] || 0;

        totalGeneral += td.total;
        totalEfectivo += efectivo;
        totalNequi += nequi;
        totalDaviplata += daviplata;
        totalTransferencia += transferencia;
        totalPedidos += td.pedidos.size;

        htmlFilas += `
            <tr>
                <td><strong>${escapeQuotes(td.nombre)}</strong></td>
                <td style="text-align:center;">${td.pedidos.size}</td>
                <td><strong style="color:var(--danger);">${formatearPesos(td.total)}</strong></td>
                <td>${efectivo > 0 ? `<span class="inf-metodo-tag efectivo">${formatearPesos(efectivo)}</span>` : '—'}</td>
                <td>${nequi > 0 ? `<span class="inf-metodo-tag nequi">${formatearPesos(nequi)}</span>` : '—'}</td>
                <td>${daviplata > 0 ? `<span class="inf-metodo-tag daviplata">${formatearPesos(daviplata)}</span>` : '—'}</td>
                <td>${transferencia > 0 ? `<span class="inf-metodo-tag transferencia">${formatearPesos(transferencia)}</span>` : '—'}</td>
            </tr>
        `;
    });

    // Fila de totales
    htmlFilas += `
        <tr class="total-row">
            <td><strong>TOTAL</strong></td>
            <td style="text-align:center;"><strong>${totalPedidos}</strong></td>
            <td><strong style="color:var(--danger);">${formatearPesos(totalGeneral)}</strong></td>
            <td>${totalEfectivo > 0 ? `<span class="inf-metodo-tag efectivo">${formatearPesos(totalEfectivo)}</span>` : '—'}</td>
            <td>${totalNequi > 0 ? `<span class="inf-metodo-tag nequi">${formatearPesos(totalNequi)}</span>` : '—'}</td>
            <td>${totalDaviplata > 0 ? `<span class="inf-metodo-tag daviplata">${formatearPesos(totalDaviplata)}</span>` : '—'}</td>
            <td>${totalTransferencia > 0 ? `<span class="inf-metodo-tag transferencia">${formatearPesos(totalTransferencia)}</span>` : '—'}</td>
        </tr>
    `;

    tbody.innerHTML = htmlFilas;
}

// ─── UTILIDADES CHART ───────────────────────
function destruirChart(id) {
    if (chartsInstancias[id]) {
        chartsInstancias[id].destroy();
        delete chartsInstancias[id];
    }
}
function hoyEnColombia() {
    return new Date().toLocaleDateString('en-CA', { 
        timeZone: 'America/Bogota' 
    });
}

function formatearFechaColombiana(fecha) {
    return fecha.toLocaleDateString('en-CA', { 
        timeZone: 'America/Bogota' 
    });
}

function fechaColombiaADate(fechaStr, esFinDeDia = false) {
    const hora = esFinDeDia ? 'T23:59:59' : 'T00:00:00';
    return new Date(fechaStr + hora + '-05:00');
}