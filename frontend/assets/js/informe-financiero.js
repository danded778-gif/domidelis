// ============================================
// informe-financiero.js — Informes del panel admin
// Chart.js + lógica financiera (Con comisiones)
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
            const ayer = new Date(hoy + 'T12:00:00-05:00');
            ayer.setDate(ayer.getDate() - 1);
            const ayerStr = formatearFechaColombiana(ayer);
            desde.value = ayerStr;
            hasta.value = ayerStr;
            break;
        }

        case 'semana': {
            const ahora = new Date(new Date().toLocaleString(
                'en-US', { timeZone: 'America/Bogota' }
            ));
            const diaSemana = ahora.getDay();
            const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
            ahora.setDate(ahora.getDate() - diasHastaLunes);
            desde.value = formatearFechaColombiana(ahora);
            hasta.value = hoy;
            break;
        }

        case 'mes': {
            const [anio, mes] = hoy.split('-');
            desde.value = `${anio}-${mes}-01`;
            hasta.value = hoy;
            break;
        }

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

    document.querySelectorAll('.inf-preset-btn')
        .forEach(b => b.classList.remove('active'));

    let filtrados = [...window._infPedidos];

    if (desde) {
        const desdeFecha = fechaColombiaADate(desde, false);
        filtrados = filtrados.filter(p => new Date(p.fecha) >= desdeFecha);
    }

    if (hasta) {
        const hastaFecha = fechaColombiaADate(hasta, true);
        filtrados = filtrados.filter(p => new Date(p.fecha) <= hastaFecha);
    }

    if (tiendaId) {
        filtrados = filtrados.filter(p => {
            let productos = [];
            try { productos = JSON.parse(p.productosJson || '[]'); } catch (e) {}
            return productos.some(pr => String(pr.tiendaId) === tiendaId);
        });
    }

    if (metodo) {
        filtrados = filtrados.filter(p => (p.metodoPago || '') === metodo);
    }

    renderizarInforme(filtrados);
}

// ─── CÁLCULOS FINANCIEROS (CON COMISIONES) ──────────────────
function obtenerComisionTienda(tid) {
    if (!window._infTiendas) return 20; // Por defecto 20% si no hay datos
    const t = window._infTiendas.find(t => String(t.id) === String(tid));
    return t && t.comision ? parseFloat(t.comision) : 20; // Si la tienda no tiene, asume 20%
}

function calcularDatos(pedidos) {
    let totalDomicilios = 0;    // Lo que cobras por envío
    let totalProductos = 0;     // Valor total vendido en productos
    let totalComisiones = 0;    // Tu ganancia por porcentaje sobre productos
    let totalPagarTiendas = 0;  // Lo que realmente le transfieres a las tiendas
    let totalCobrado = 0;       // Lo que pagó el cliente en total (productos + envío)
    
    let tiendasMap = new Map();
    let metodosGlobal = {};

    pedidos.forEach(pedido => {
        let productos = [];
        try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { }

        const subtotalProductos = productos.reduce((s, pr) => s + (parseFloat(pr.subtotal) || 0), 0);
        const envio = parseFloat(pedido.total) - subtotalProductos;
        const totalPedido = parseFloat(pedido.total) || 0;
        const metodo = pedido.metodoPago || 'Efectivo';

        totalDomicilios += Math.max(0, envio);
        totalProductos += subtotalProductos;
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
            // CÁLCULO DE COMISIÓN
            const comisionPct = obtenerComisionTienda(tid);
            const montoComision = info.monto * (comisionPct / 100);
            const montoPagar = info.monto - montoComision;

            totalComisiones += montoComision;
            totalPagarTiendas += montoPagar;

            if (!tiendasMap.has(tid)) {
                tiendasMap.set(tid, {
                    nombre: info.nombre,
                    total: 0,        // Total vendido por la tienda
                    comision: 0,     // Lo que te quedas tú
                    aPagar: 0,       // Lo que le pagas a la tienda
                    metodos: {},
                    pedidos: new Set()
                });
            }
            const td = tiendasMap.get(tid);
            td.total += info.monto;
            td.comision += montoComision;
            td.aPagar += montoPagar;
            td.metodos[metodo] = (td.metodos[metodo] || 0) + info.monto;
            td.pedidos.add(pedido.id);
        });
    });

    // Ingreso Neto de la App = Domicilios cobrados + Comisiones cobradas
    const totalIngresosApp = totalDomicilios + totalComisiones;

    return {
        totalCobrado,
        totalProductos,
        totalDomicilios,
        totalComisiones,
        totalIngresosApp,       // Tu ganancia real
        totalPagarTiendas,     // Lo que le debes a las tiendas
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

    animarValor(elIngresos, datos.totalIngresosApp); // Tu ganancia real (Envíos + Comisiones)
    animarValor(elEgresos, datos.totalPagarTiendas); // Lo que le pagas a las tiendas
    animarValor(elBalance, datos.totalComisiones);   // Destacamos la comisión ganada
    elPedidos.textContent = datos.cantidadPedidos;

    elBalanceCard.classList.remove('negativo');
    elBalanceSub.textContent = 'Ganancia por comisiones';
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
    if (elRetienes) elRetienes.textContent = formatearPesos(datos.totalIngresosApp); // Domicilios + Comisiones
    if (elDevuelves) elDevuelves.textContent = formatearPesos(datos.totalPagarTiendas); // Solo lo de las tiendas
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
        `${topTienda.pedidos} pedidos · ${formatearPesos(topTienda.total)} en ventas`;
}

// ─── CHART: BARRAS (Ganancia App vs Pago Tienda) ────
function renderChartBarras(datos) {
    destruirChart('chartBarras');

    const canvas = document.getElementById('chartBarras');
    if (!canvas) return;

    const labels = [];
    const datosGananciaApp = [];
    const datosPagoTiendas = [];

    datos.tiendas.forEach((td) => {
        labels.push(td.nombre.length > 18 ? td.nombre.substring(0, 18) + '…' : td.nombre);
        
        // Ingreso de la app por esta tienda: su comisión + su proporción del domicilio
        let domicilioProporcional = 0;
        if (datos.totalProductos > 0) {
            const proporcion = td.total / datos.totalProductos;
            domicilioProporcional = Math.round(datos.totalDomicilios * proporcion);
        }
        
        datosGananciaApp.push(td.comision + domicilioProporcional);
        datosPagoTiendas.push(td.aPagar); // Esto ya es el total menos la comisión
    });

    chartsInstancias['chartBarras'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Tu Ganancia (Comisión + Envío)',
                    data: datosGananciaApp,
                    backgroundColor: 'rgba(42, 157, 143, 0.8)',
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'A Pagar a Tienda',
                    data: datosPagoTiendas,
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

// ─── TABLA DESGLOSE POR TIENDA (CON COMISIONES) ─────────────
function renderTablaDesglose(datos) {
    const tbody = document.querySelector('#inf-tabla-desglose tbody');
    if (!tbody) return;

    if (datos.tiendas.size === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--gray);">Sin datos en este período</td></tr>';
        return;
    }

    let htmlFilas = '';
    let totalGeneral = 0, totalComisiones = 0, totalPagar = 0;
    let totalEfectivo = 0, totalNequi = 0, totalDaviplata = 0, totalTransferencia = 0;
    let totalPedidos = 0;

    datos.tiendas.forEach((td) => {
        const efectivo = td.metodos['Efectivo'] || 0;
        const nequi = td.metodos['Nequi'] || 0;
        const daviplata = td.metodos['Daviplata'] || 0;
        const transferencia = td.metodos['Transferencia'] || 0;

        totalGeneral += td.total;
        totalComisiones += td.comision;
        totalPagar += td.aPagar;
        totalEfectivo += efectivo;
        totalNequi += nequi;
        totalDaviplata += daviplata;
        totalTransferencia += transferencia;
        totalPedidos += td.pedidos.size;

        htmlFilas += `
            <tr>
                <td><strong>${escapeQuotes(td.nombre)}</strong></td>
                <td style="text-align:center;">${td.pedidos.size}</td>
                <td>${formatearPesos(td.total)}</td>
                <td style="color:var(--success);"><strong>${formatearPesos(td.comision)}</strong></td>
                <td style="color:var(--danger);"><strong>${formatearPesos(td.aPagar)}</strong></td>
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
            <td><strong>${formatearPesos(totalGeneral)}</strong></td>
            <td style="color:var(--success);"><strong>${formatearPesos(totalComisiones)}</strong></td>
            <td style="color:var(--danger);"><strong>${formatearPesos(totalPagar)}</strong></td>
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