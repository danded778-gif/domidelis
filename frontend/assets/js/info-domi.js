// ============================================
// infodomi.js — Informes de Domiciliarios (Panel admin)
// Chart.js + lógica financiera de domicilios
// ============================================

let infodomiCargado = false;
let chartsDomiInstancias = {};

const PALETA_DOMI = [
    '#2A9D8F', '#E76F51', '#457B9D', '#F4A261', '#264653',
    '#8338EC', '#606C38', '#BC6C25', '#06D6A0', '#E63946'
];

// ─── ENTRADA PRINCIPAL ─────────────────────
async function cargarInfoDomiciliarios() {
    const loading = document.getElementById('infodomi-loading');
    const contenido = document.getElementById('infodomi-contenido');
    if (!loading || !contenido) return;

    loading.style.display = 'block';
    contenido.style.display = 'none';

    try {
        const [resPedidos, resDomiciliarios] = await Promise.all([
            fetchConToken(`${API_URL}?action=getPedidos`),
            fetchConToken(`${API_URL}?action=getDomiciliarios`)
        ]);
        const todosPedidos = await resPedidos.json();
        const domiciliarios = await resDomiciliarios.json();

        // Solo pedidos entregados y que tengan domiciliario asignado
        window._infodomiPedidos = todosPedidos.filter(p => p.estado === 'entregado' && p.domiciliarioId);
        window._infodomiDomiciliarios = Array.isArray(domiciliarios) ? domiciliarios : [];

        llenarSelectDomiFiltro();
        renderizarInfoDomi(window._infodomiPedidos);

        infodomiCargado = true;
        loading.style.display = 'none';
        contenido.style.display = 'block';
    } catch (error) {
        console.error('Error cargando info domiciliarios:', error);
        loading.innerHTML = `<div class="inf-vacio"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar</h3><p>No se pudieron obtener los datos</p><button class="btn btn-primary" onclick="cargarInfoDomiciliarios()"><i class="fas fa-sync-alt"></i> Reintentar</button></div>`;
    }
}

// ─── LLENAR SELECT FILTRO ──────────────────
function llenarSelectDomiFiltro() {
    const select = document.getElementById('infodomi-select');
    if (!select || !window._infodomiDomiciliarios) return;
    select.innerHTML = '<option value="">Todos</option>' +
        window._infodomiDomiciliarios.map(d =>
            `<option value="${d.id}">${escapeQuotes(d.nombre)}</option>`
        ).join('');
}

// ─── FILTROS ────────────────────────────────
function establecerPeriodoDomi(periodo, btn) {
    document.querySelectorAll('.inf-preset-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const desde = document.getElementById('infodomi-fecha-desde');
    const hasta = document.getElementById('infodomi-fecha-hasta');
    const hoy = hoyEnColombia();

    switch (periodo) {
        case 'hoy': desde.value = hoy; hasta.value = hoy; break;
        case 'ayer': {
            const ayer = new Date(hoy + 'T12:00:00-05:00');
            ayer.setDate(ayer.getDate() - 1);
            desde.value = formatearFechaColombiana(ayer);
            hasta.value = formatearFechaColombiana(ayer);
            break;
        }
        case 'semana': {
            const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
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
        case 'todos': default: desde.value = ''; hasta.value = ''; break;
    }
    aplicarFiltrosDomi();
}

function aplicarFiltrosDomi() {
    if (!window._infodomiPedidos) return;

    const desde = document.getElementById('infodomi-fecha-desde').value;
    const hasta = document.getElementById('infodomi-fecha-hasta').value;
    const domiId = document.getElementById('infodomi-select').value;

    document.querySelectorAll('.inf-preset-btn').forEach(b => b.classList.remove('active'));

    let filtrados = [...window._infodomiPedidos];

    if (desde) {
        const desdeFecha = fechaColombiaADate(desde, false);
        filtrados = filtrados.filter(p => new Date(p.fecha) >= desdeFecha);
    }
    if (hasta) {
        const hastaFecha = fechaColombiaADate(hasta, true);
        filtrados = filtrados.filter(p => new Date(p.fecha) <= hastaFecha);
    }
    if (domiId) {
        filtrados = filtrados.filter(p => String(p.domiciliarioId) === domiId);
    }

    renderizarInfoDomi(filtrados);
}

// ─── UTILIDADES DOMICILIARIOS ───────────────
function obtenerComisionAppDomi(domiId) {
    if (!window._infodomiDomiciliarios) return 0;
    const d = window._infodomiDomiciliarios.find(d => String(d.id) === String(domiId));
    return d && d.comisionApp ? parseFloat(d.comisionApp) : 0;
}

function obtenerNombreDomi(domiId) {
    if (!window._infodomiDomiciliarios) return `Domiciliario #${domiId}`;
    const d = window._infodomiDomiciliarios.find(d => String(d.id) === String(domiId));
    return d ? d.nombre : `Domiciliario #${domiId}`;
}

// ─── CÁLCULOS FINANCIEROS DOMICILIARIOS ─────
function calcularDatosDomi(pedidos) {
    let totalDomiciliosCobrados = 0; // Lo que se cobró de envío en total
    let totalComisionApp = 0;       // Lo que se queda la app de esos envíos
    let totalPagarDomiciliarios = 0;// Lo que se le paga al domiciliario
    let totalPedidos = 0;
    let totalPropinas = 0;

    let domisMap = new Map();

    pedidos.forEach(pedido => {
        let productos = [];
        try { productos = JSON.parse(pedido.productosJson || '[]'); } catch (e) { }

        const subtotalProductos = productos.reduce((s, pr) => s + (parseFloat(pr.subtotal) || 0), 0);
        const envio = Math.max(0, parseFloat(pedido.total) - subtotalProductos);
        const domiId = String(pedido.domiciliarioId);
        const comisionPct = obtenerComisionAppDomi(domiId);
        const propina = parseFloat(pedido.propina) || 0;

        const gananciaApp = envio * (comisionPct / 100);
        const pagoDomi = envio - gananciaApp;

        totalDomiciliosCobrados += envio;
        totalComisionApp += gananciaApp;
        totalPagarDomiciliarios += pagoDomi;
        totalPedidos++;

        if (!domisMap.has(domiId)) {
            domisMap.set(domiId, {
                nombre: obtenerNombreDomi(domiId),
                totalEnvios: 0,
                gananciaApp: 0,
                pagoDomi: 0,
                pedidos: 0,
                propinas: 0
            });
        }
        const d = domisMap.get(domiId);
        d.totalEnvios += envio;
        d.gananciaApp += gananciaApp;
        d.pagoDomi += pagoDomi;
        d.pedidos++;
        d.propinas += propina;
    });

    return {
        totalDomiciliosCobrados,
        totalComisionApp,
        totalPagarDomiciliarios,
        totalPedidos,
        totalPropinas,
        domiciliarios: domisMap
    };
}

// ─── RENDERIZAR TODO ────────────────────────
function renderizarInfoDomi(pedidos) {
    const datos = calcularDatosDomi(pedidos);
    renderKPIsDomi(datos);
    renderFlujoDomi(datos);
    renderDestacadoDomi(datos);
    renderChartBarrasDomi(datos);
    renderChartDonutDomi(datos);
    renderTablaDesgloseDomi(datos);
}

// ─── KPIs DOMICILIARIOS ─────────────────────
function renderKPIsDomi(datos) {
    const elCobrados = document.getElementById('infodomi-kpi-cobrados');
    const elComision = document.getElementById('infodomi-kpi-comision');
    const elPagar = document.getElementById('infodomi-kpi-pagar');
    const elPedidos = document.getElementById('infodomi-kpi-pedidos');

    animarValor(elCobrados, datos.totalDomiciliosCobrados);
    animarValor(elComision, datos.totalComisionApp);
    animarValor(elPagar, datos.totalPagarDomiciliarios);
    if (elPedidos) elPedidos.textContent = datos.totalPedidos;
}

// ─── FLUJO DE CAJA DOMICILIARIOS ────────────
function renderFlujoDomi(datos) {
    const elCobra = document.getElementById('infodomi-flujo-cobra');
    const elRetiene = document.getElementById('infodomi-flujo-retiene');
    const elPaga = document.getElementById('infodomi-flujo-paga');

    if (elCobra) elCobra.textContent = formatearPesos(datos.totalDomiciliosCobrados);
    if (elRetiene) elRetiene.textContent = formatearPesos(datos.totalComisionApp);
    if (elPaga) elPaga.textContent = formatearPesos(datos.totalPagarDomiciliarios);
}

// ─── DOMICILIARIO DESTACADO ─────────────────
function renderDestacadoDomi(datos) {
    const el = document.getElementById('infodomi-destacada');
    if (!el) return;

    if (datos.domiciliarios.size === 0) {
        el.style.display = 'none';
        return;
    }

    let topDomi = null;
    let topPedidos = 0;
    datos.domiciliarios.forEach((d) => {
        if (d.pedidos > topPedidos) {
            topPedidos = d.pedidos;
            topDomi = d;
        }
    });

    if (!topDomi) { el.style.display = 'none'; return; }

    el.style.display = 'flex';
    document.getElementById('infodomi-destacada-nombre').textContent = topDomi.nombre;
    document.getElementById('infodomi-destacada-stats').textContent =
        `${topDomi.pedidos} domicilios · ${formatearPesos(topDomi.pagoDomi)} ganados`;
}

// ─── CHART: BARRAS DOMICILIARIOS ────────────
function renderChartBarrasDomi(datos) {
    if (chartsDomiInstancias['chartDomiBarras']) {
        chartsDomiInstancias['chartDomiBarras'].destroy();
        delete chartsDomiInstancias['chartDomiBarras'];
    }

    const canvas = document.getElementById('chartDomiBarras');
    if (!canvas) return;

    const labels = [];
    const datosApp = [];
    const datosPagar = [];

    datos.domiciliarios.forEach((d) => {
        labels.push(d.nombre.length > 15 ? d.nombre.substring(0, 15) + '…' : d.nombre);
        datosApp.push(d.gananciaApp);
        datosPagar.push(d.pagoDomi);
    });

    chartsDomiInstancias['chartDomiBarras'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Retiene App (Comisión)',
                    data: datosApp,
                    backgroundColor: 'rgba(42, 157, 143, 0.8)',
                    borderRadius: 6
                },
                {
                    label: 'Pagar Domiciliario',
                    data: datosPagar,
                    backgroundColor: 'rgba(244, 162, 97, 0.8)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Poppins', size: 11 } } } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}

// ─── CHART: DONUT DOMICILIARIOS ─────────────
function renderChartDonutDomi(datos) {
    if (chartsDomiInstancias['chartDomiDonut']) {
        chartsDomiInstancias['chartDomiDonut'].destroy();
        delete chartsDomiInstancias['chartDomiDonut'];
    }

    const canvas = document.getElementById('chartDomiDonut');
    if (!canvas) return;

    const labels = [];
    const valores = [];
    const colores = [];

    datos.domiciliarios.forEach((d, i) => {
        labels.push(d.nombre);
        valores.push(d.pedidos);
        colores.push(PALETA_DOMI[i % PALETA_DOMI.length]);
    });

    if (valores.length === 0) { labels.push('Sin datos'); valores.push(1); colores.push('#e0e0e0'); }

    chartsDomiInstancias['chartDomiDonut'] = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: valores, backgroundColor: colores, borderWidth: 3, borderColor: '#fff' }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Poppins', size: 11 } } },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw + ' domicilios' } }
            }
        }
    });
}

// ─── TABLA DESGLOSE DOMICILIARIOS ───────────
function renderTablaDesgloseDomi(datos) {
    const tbody = document.querySelector('#infodomi-tabla tbody');
    if (!tbody) return;

    if (datos.domiciliarios.size === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray);">Sin datos en este período</td></tr>';
        return;
    }

    let html = '';
    let totalEnviosG = 0, totalAppG = 0, totalPagarG = 0, totalPedidosG = 0, totalPropinasG = 0; // NUEVO

    const ordenados = Array.from(datos.domiciliarios.values()).sort((a, b) => b.pagoDomi - a.pagoDomi);

    ordenados.forEach(d => {
        totalEnviosG += d.totalEnvios;
        totalAppG += d.gananciaApp;
        totalPagarG += d.pagoDomi;
        totalPedidosG += d.pedidos;
        totalPropinasG += d.propinas;

        const comisionPct = obtenerComisionAppDomi(Object.keys(datos.domiciliarios).find(id => datos.domiciliarios.get(id).nombre === d.nombre) || '');

        html += `
            <tr>
                <td><strong><i class="fas fa-motorcycle" style="color:var(--accent);"></i> ${escapeQuotes(d.nombre)}</strong></td>
                <td style="text-align:center;">${d.pedidos}</td>
                <td>${formatearPesos(d.totalEnvios)}</td>
                <td style="color:var(--success);"><strong>${formatearPesos(d.gananciaApp)}</strong> <small style="color:var(--gray);">(${comisionPct}%)</small></td>
                <td style="color:var(--accent);"><strong>${formatearPesos(d.pagoDomi)}</strong></td>
                <td style="color:#E63946;font-weight:700;">${d.propinas > 0 ? formatearPesos(d.propinas) : '—'}</td>
            </tr>
        `;
    });

    html += `
        <tr class="total-row">
            <td><strong>TOTALES</strong></td>
            <td style="text-align:center;"><strong>${totalPedidosG}</strong></td>
            <td><strong>${formatearPesos(totalEnviosG)}</strong></td>
            <td style="color:var(--success);"><strong>${formatearPesos(totalAppG)}</strong></td>
            <td style="color:var(--accent);"><strong>${formatearPesos(totalPagarG)}</strong></td>
            <td style="color:#E63946;"><strong>${totalPropinasG > 0 ? formatearPesos(totalPropinasG) : '—'}</strong></td>
        </tr>
    `;

    tbody.innerHTML = html;
}