// ============================================
// productos.js — CRUD de productos + calculadora de comisiones
// ============================================

async function cargarProductosPorTienda(tiendaId) {
    if (!tiendaId) {
        document.getElementById("listaProductosTienda").style.display = "none";
        return;
    }
    const tienda = tiendasCache.find(t => t.id == tiendaId);
    document.getElementById("nombreTiendaSeleccionada").textContent = tienda ? tienda.nombre : '';
    document.getElementById("listaProductosTienda").style.display = "block";
    try {
        const res = await fetchConToken(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        productosCache = productos;
        const tbody = document.querySelector("#tablaProductosTienda tbody");
        if (productos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Sin productos</td></tr>";
            return;
        }
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><i class="fas ${p.icono || 'fa-utensils'}"></i> ${esc(p.nombre)}</td>
                <td>${p.descripcion || '-'}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalComplementos(${p.id})" title="Gestionar Complementos"><i class="fas fa-sliders-h"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        mostrarNotificacion("Error cargando productos", "error");
    }
}

function verProductosTienda(tiendaId) {
    const select = document.getElementById("selectTiendaProductos");
    select.value = tiendaId;
    cargarProductosPorTienda(tiendaId);
    select.scrollIntoView({ behavior: 'smooth' });
}

function mostrarModalProducto() {
    if (tiendasCache.length === 0) {
        mostrarNotificacion("Crea al menos una tienda primero", "error");
        return;
    }
    productoEditando = null;
    document.getElementById("modalProductoTitulo").textContent = "Nuevo Producto";
    document.getElementById("formProducto").reset();
    document.getElementById("comision-calculo-box").style.display = "none";
    document.getElementById("modalProducto").classList.add("active");
}

function cerrarModalProducto() {
    document.getElementById("modalProducto").classList.remove("active");
    document.getElementById("formProducto").reset();
    productoEditando = null;
}

async function guardarProducto() {
    const btn = document.querySelector("#formProducto button[type='submit']");
    const tiendaId = document.getElementById("productoTiendaId").value;
    if (!tiendaId) {
        mostrarNotificacion("Selecciona una tienda", "error");
        return;
    }

    const datos = {
        tiendaId: tiendaId,
        nombre: document.getElementById("productoNombre").value.trim(),
        descripcion: document.getElementById("productoDescripcion").value.trim(),
        precio: document.getElementById("productoPrecio").value,
        imagen_url: document.getElementById("productoImagen").value.trim(),
        badge: document.getElementById("productoBadge").value.trim()
    };

    if (!datos.nombre || !datos.precio) {
        mostrarNotificacion("Nombre y precio obligatorios", "error");
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        const action = productoEditando ? "actualizarProducto" : "crearProducto";
        if (productoEditando) datos.id = productoEditando;
        const response = await fetchConToken(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...datos })
        });
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(productoEditando ? "Producto actualizado" : "Producto creado");
            cerrarModalProducto();
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            if (tiendaSeleccionada == tiendaId) cargarProductosPorTienda(tiendaId);
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
    }
}

async function editarProducto(id) {
    const producto = productosCache.find(p => p.id == id);
    if (!producto) return;
    productoEditando = id;
    document.getElementById("modalProductoTitulo").textContent = "Editar Producto";
    document.getElementById("productoTiendaId").value = producto.tiendaId;
    document.getElementById("productoNombre").value = producto.nombre;
    document.getElementById("productoDescripcion").value = producto.descripcion || '';
    document.getElementById("productoPrecio").value = producto.precio;
    document.getElementById("productoImagen").value = producto.imagen_url || '';
    document.getElementById("productoBadge").value = producto.badge || '';
    calcularComisionProducto();
    document.getElementById("modalProducto").classList.add("active");
}

async function eliminarProducto(id) {
    if (!confirm("¿Eliminar producto?")) return;
    try {
        const response = await fetchConToken(`${API_URL}?action=eliminarProducto&id=${id}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion("Producto eliminado");
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            cargarProductosPorTienda(tiendaSeleccionada);
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

// ============================================
// CALCULADORA DE COMISIONES PARA PRODUCTOS
// ============================================

function calcularComisionProducto() {
    const tiendaId = document.getElementById('productoTiendaId').value;
    const precioStr = document.getElementById('productoPrecio').value;
    const box = document.getElementById('comision-calculo-box');

    if (!tiendaId || !precioStr) {
        box.style.display = 'none';
        return;
    }

    const precio = parseFloat(precioStr);
    if (precio <= 0) {
        box.style.display = 'none';
        return;
    }

    const tienda = tiendasCache.find(t => String(t.id) === String(tiendaId));
    const comisionPct = tienda ? parseFloat(tienda.comision || 20) : 20;

    const gananciaTienda = precio - (precio * (comisionPct / 100));

    document.getElementById('tiendaRecibe').textContent = formatearPrecio(gananciaTienda);
    document.getElementById('comisionPctDisplay').textContent = comisionPct;
    box.style.display = 'block';
}

function calcularPrecioDesdeGanancia() {
    const tiendaId = document.getElementById('productoTiendaId').value;
    const gananciaStr = document.getElementById('gananciaDeseadaInput').value;

    if (!tiendaId || !gananciaStr) {
        mostrarNotificacion("Selecciona la tienda y escribe la ganancia deseada", "error");
        return;
    }

    const gananciaDeseada = parseFloat(gananciaStr);
    const tienda = tiendasCache.find(t => String(t.id) === String(tiendaId));
    const comisionPct = tienda ? parseFloat(tienda.comision || 20) : 20;

    if (comisionPct >= 100) {
        mostrarNotificacion("La comisión no puede ser 100% o más", "error");
        return;
    }

    const precioSugerido = gananciaDeseada / (1 - (comisionPct / 100));

    document.getElementById('productoPrecio').value = Math.ceil(precioSugerido);
    calcularComisionProducto();
    mostrarNotificacion(`Precio sugerido: ${formatearPrecio(precioSugerido)}`, "success");
}