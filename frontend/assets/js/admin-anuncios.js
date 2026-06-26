// ============================================
// admin-anuncios.js — Panel de Administración de Anuncios
// ============================================

const AdminAnuncios = {
    anuncios: [],
    tiendas: [],
    ordenElementos: ['imagen', 'titulo', 'subtitulo', 'precio', 'boton'],
    dragSrcEl: null,

    init: async function() {
        this.configurarDragAndDrop();
        await this.cargarTiendasParaSelect();
    },

    // Cargar lista de tiendas para el <select> del formulario
    cargarTiendasParaSelect: async function() {
        try {
            const res = await fetch(`${API_URL}?action=getTiendas`);
            const data = await res.json();
            if (Array.isArray(data)) {
                this.tiendas = data;
            }
        } catch (error) {
            console.error('Error cargando tiendas para anuncios:', error);
        }
    },

    // Cargar anuncios para la tabla
    cargarAnunciosAdmin: async function() {
        const tbody = document.querySelector('#tablaAnuncios tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando anuncios...</td></tr>';

        try {
            const res = await fetch(`${API_URL}?action=getAnunciosAdmin`);
            const data = await res.json();
            
            if (data.success) {
                this.anuncios = data.anuncios;
                this.renderizarTabla();
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar.</td></tr>';
        }
    },

    renderizarTabla: function() {
        const tbody = document.querySelector('#tablaAnuncios tbody');
        if (!tbody) return;

        if (this.anuncios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay anuncios creados.</td></tr>';
            return;
        }

        tbody.innerHTML = this.anuncios.map(anuncio => {
            const estadoClass = anuncio.estado === 'activo' ? 'badge-activo' : 'badge-borrador';
            let vigencia = 'Indefinido';
            if (anuncio.fechaInicio && anuncio.fechaFin) {
                vigencia = `${anuncio.fechaInicio} al ${anuncio.fechaFin}`;
            } else if (anuncio.fechaFin) {
                vigencia = `Hasta ${anuncio.fechaFin}`;
            }

            return `
                <tr>
                    <td>${anuncio.id}</td>
                    <td>${anuncio.titulo || 'Sin título'}</td>
                    <td>${anuncio.tipo}</td>
                    <td><span class="badge-estado-anuncio ${estadoClass}">${anuncio.estado}</span></td>
                    <td>${vigencia}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="AdminAnuncios.editarAnuncio(${anuncio.id})"><i class="fas fa-edit"></i></button>
                        ${anuncio.estado === 'activo' ? 
                            `<button class="btn btn-warning btn-sm" onclick="AdminAnuncios.toggleEstado(${anuncio.id}, 'inactivo')"><i class="fas fa-pause"></i></button>` :
                            `<button class="btn btn-success btn-sm" onclick="AdminAnuncios.toggleEstado(${anuncio.id}, 'activo')"><i class="fas fa-play"></i></button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Calculadora de Presupuesto
    calcularPresupuesto: function() {
        const input = document.getElementById('calcPresupuestoInput');
        const resultado = document.getElementById('calcPresupuestoResultado');
        const monto = parseInt(input.value) || 0;

        if (monto <= 0) {
            resultado.innerHTML = 'Ingresa un monto para ver la duración estimada.';
            return;
        }

        let dias = 0;
        let sugerencia = '';

        if (monto >= 20000) {
            dias = Math.floor(monto / 666); // aprox 30 dias por 20k
            sugerencia = `Equivalente a <strong>1 mes completo</strong>.`;
        } else if (monto >= 6000) {
            dias = Math.floor(monto / 857); // aprox 7 dias por 6k
            const faltaParaMes = 20000 - monto;
            sugerencia = `Equivalente a <strong>${dias} días</strong>. Si agregas $${faltaParaMes.toLocaleString('es-CO')}, te damos 1 mes completo.`;
        } else {
            dias = Math.floor(monto / 1000);
            const faltaParaSemana = 6000 - monto;
            sugerencia = `Equivalente a <strong>${dias} días</strong>. Si agregas $${faltaParaSemana.toLocaleString('es-CO')}, te damos 1 semana completa.`;
        }

        resultado.innerHTML = `Con <strong>$${monto.toLocaleString('es-CO')}</strong> COP tienes aproximadamente ${dias} días de publicación. ${sugerencia}`;
    },

    // Abrir Modal de Creación
    abrirModalCreacion: function() {
        document.getElementById('modalAnuncioTitulo').innerText = 'Crear Anuncio';
        document.getElementById('formAnuncioContainer').style.display = 'none';
        document.getElementById('tiposAnuncioContainer').style.display = 'grid';
        
        // Limpiar formulario
        document.getElementById('anuncioId').value = '';
        document.getElementById('anuncioTitulo').value = '';
        document.getElementById('anuncioSubtitulo').value = '';
        document.getElementById('anuncioImagenUrl').value = '';
        document.getElementById('anuncioPrecioPromo').value = '';
        document.getElementById('anuncioPrecioNormal').value = '';
        document.getElementById('anuncioDescuento').value = '';
        document.getElementById('anuncioCodigo').value = '';
        document.getElementById('anuncioFechaInicio').value = '';
        document.getElementById('anuncioFechaFin').value = '';

        document.getElementById('modalAnuncio').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    cerrarModal: function() {
        document.getElementById('modalAnuncio').classList.remove('active');
        document.body.style.overflow = '';
    },

    // Seleccionar Tipo de Anuncio
    seleccionarTipo: function(tipo) {
        document.getElementById('anuncioTipo').value = tipo;
        document.getElementById('tiposAnuncioContainer').style.display = 'none';
        document.getElementById('formAnuncioContainer').style.display = 'block';

        // Mostrar/ocultar campos
        document.getElementById('camposTienda').style.display = tipo === 'tienda' ? 'block' : 'none';
        document.getElementById('camposDomicilio').style.display = tipo === 'domicilio' ? 'block' : 'none';
        document.getElementById('camposCodigo').style.display = tipo === 'codigo' ? 'block' : 'none';

        // ★ Si es tipo tienda, inyectar el select de tiendas
        if (tipo === 'tienda') {
            this.inyectarSelectTiendas();
        }

        this.actualizarPreview();
    },

    // Inyectar el select de tiendas dentro del div camposTienda
    inyectarSelectTiendas: function(selectedId = null) {
        const container = document.getElementById('camposTienda');
        if (!container) return;

        // Verificar si ya existe el select para no duplicarlo
        if (document.getElementById('anuncioTiendaId')) return;

        let optionsHtml = '<option value="0">-- Tienda no específica --</option>';
        this.tiendas.forEach(t => {
            optionsHtml += `<option value="${t.id}">${t.nombre} (ID: ${t.id})</option>`;
        });

        const selectHtml = `
            <div class="form-group" id="grupoTiendaSelect">
                <label><i class="fas fa-store"></i> Tienda Vinculada</label>
                <select id="anuncioTiendaId">
                    ${optionsHtml}
                </select>
                <small style="color:var(--gray); font-size:0.8rem;">Selecciona a qué tienda pertenece la promoción.</small>
            </div>
        `;

        container.insertAdjacentHTML('afterbegin', selectHtml);

        if (selectedId) {
            document.getElementById('anuncioTiendaId').value = selectedId;
        }
    },

    // Live Preview
    actualizarPreview: function() {
        const tipo = document.getElementById('anuncioTipo').value;
        if (!tipo) return;

        const titulo = document.getElementById('anuncioTitulo').value || 'Título del Anuncio';
        const subtitulo = document.getElementById('anuncioSubtitulo').value || 'Subtítulo de prueba';
        const imagen = document.getElementById('anuncioImagenUrl').value;
        
        let precioHtml = '';
        let botonHtml = '';

        if (tipo === 'tienda') {
            const promo = document.getElementById('anuncioPrecioPromo').value;
            const normal = document.getElementById('anuncioPrecioNormal').value;
            precioHtml = `<div style="background:var(--primary); height:30px; width:60%; margin:5px auto; border-radius:10px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:12px;">$${promo || '0'} ${normal ? `<span style="text-decoration:line-through; font-size:10px; margin-left:5px; opacity:0.7;">$${normal}</span>` : ''}</div>`;
            botonHtml = `<div style="background:var(--dark); height:35px; width:100%; border-radius:20px; display:flex; align-items:center; justify-content:center; color:white; font-size:11px;">Agregar al Carrito</div>`;
        } else if (tipo === 'domicilio') {
            const desc = document.getElementById('anuncioDescuento').value || '0';
            botonHtml = `<div style="background:var(--accent); height:35px; width:100%; border-radius:20px; display:flex; align-items:center; justify-content:center; color:white; font-size:11px;">Activar ${desc}% Off</div>`;
        } else if (tipo === 'codigo') {
            botonHtml = `<div style="background:var(--secondary); height:35px; width:100%; border-radius:20px; display:flex; align-items:center; justify-content:center; color:white; font-size:11px;">Validar Código</div>`;
        }

        const previewContent = document.getElementById('livePreviewContent');
        if (!previewContent) return;

        previewContent.innerHTML = this.ordenElementos.map(el => {
            if (el === 'titulo') return `<div style="text-align:center; font-weight:bold; color:var(--dark); font-size:14px; margin:5px 0;">${titulo}</div>`;
            if (el === 'subtitulo') return `<div style="text-align:center; font-size:11px; color:var(--gray); margin-bottom:5px;">${subtitulo}</div>`;
            if (el === 'imagen') return imagen ? `<img src="${imagen}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">` : `<div style="height:120px; background:#e0e0e0; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#999; font-size:12px;">Imagen</div>`;
            if (el === 'precio') return precioHtml;
            if (el === 'boton') return botonHtml;
            return '';
        }).join('');
    },

    // Drag & Drop Config
    configurarDragAndDrop: function() {
        const list = document.getElementById('dragList');
        if (!list) return;

        const items = list.querySelectorAll('.drag-item');
        items.forEach(item => {
            item.addEventListener('dragstart', this.handleDragStart.bind(this));
            item.addEventListener('dragover', this.handleDragOver.bind(this));
            item.addEventListener('drop', this.handleDrop.bind(this));
            item.addEventListener('dragend', this.handleDragEnd.bind(this));
        });
    },

    handleDragStart: function(e) {
        this.dragSrcEl = e.target.closest('.drag-item');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.dragSrcEl.innerHTML);
        this.dragSrcEl.classList.add('dragging');
    },

    handleDragOver: function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    },

    handleDrop: function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const targetEl = e.target.closest('.drag-item');
        if (this.dragSrcEl !== targetEl) {
            const list = document.getElementById('dragList');
            const children = Array.from(list.children);
            const srcIndex = children.indexOf(this.dragSrcEl);
            const targetIndex = children.indexOf(targetEl);
            
            if (srcIndex < targetIndex) {
                targetEl.parentNode.insertBefore(this.dragSrcEl, targetEl.nextSibling);
            } else {
                targetEl.parentNode.insertBefore(this.dragSrcEl, targetEl);
            }
            
            this.ordenElementos = Array.from(list.children).map(child => child.dataset.el);
            this.actualizarPreview();
        }
        return false;
    },

    handleDragEnd: function() {
        if (this.dragSrcEl) this.dragSrcEl.classList.remove('dragging');
    },

    // Guardar Anuncio
    guardarAnuncio: async function(estado) {
        const id = document.getElementById('anuncioId').value;
        const tipo = document.getElementById('anuncioTipo').value;
        const titulo = document.getElementById('anuncioTitulo').value;
        const subtitulo = document.getElementById('anuncioSubtitulo').value;
        const imagenUrl = document.getElementById('anuncioImagenUrl').value;
        const fechaInicio = document.getElementById('anuncioFechaInicio').value;
        const fechaFin = document.getElementById('anuncioFechaFin').value;

        if (!titulo) return mostrarToast('Error', 'El título es obligatorio', 'error');

        const params = new URLSearchParams();
        params.append('action', 'guardarAnuncio');
        params.append('id', id || '');
        params.append('tipo', tipo);
        params.append('titulo', titulo);
        params.append('subtitulo', subtitulo);
        params.append('imagenUrl', imagenUrl);
        params.append('ordenElementos', JSON.stringify(this.ordenElementos));
        params.append('estado', estado);
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);

        if (tipo === 'tienda') {
            const tiendaSelect = document.getElementById('anuncioTiendaId');
            params.append('tiendaId', tiendaSelect ? tiendaSelect.value : 0);
            params.append('precioPromo', document.getElementById('anuncioPrecioPromo').value || 0);
            params.append('precioNormal', document.getElementById('anuncioPrecioNormal').value || 0);
        } else if (tipo === 'domicilio') {
            params.append('descuentoDomicilio', document.getElementById('anuncioDescuento').value || 0);
        } else if (tipo === 'codigo') {
            params.append('codigoPromo', document.getElementById('anuncioCodigo').value || '');
        }

        try {
            const res = await fetch(API_URL, { method: 'POST', body: params });
            const data = await res.json();

            if (data.success) {
                mostrarToast('Éxito', `Anuncio guardado como ${estado}`, 'success');
                this.cerrarModal();
                this.cargarAnunciosAdmin();
            } else {
                mostrarToast('Error', data.error || 'No se pudo guardar', 'error');
            }
        } catch (error) {
            mostrarToast('Error', 'Fallo de conexión', 'error');
        }
    },

    // Activar/Desactivar
    toggleEstado: async function(id, nuevoEstado) {
        const params = new URLSearchParams();
        params.append('action', 'cambiarEstadoAnuncio');
        params.append('id', id);
        params.append('estado', nuevoEstado);

        try {
            const res = await fetch(API_URL, { method: 'POST', body: params });
            const data = await res.json();
            if (data.success) {
                mostrarToast('Actualizado', `Anuncio ${nuevoEstado}`, 'success');
                this.cargarAnunciosAdmin();
            }
        } catch (error) {
            mostrarToast('Error', 'Fallo de conexión', 'error');
        }
    },

    // Editar (Cargar datos en el modal)
    editarAnuncio: function(id) {
        const anuncio = this.anuncios.find(a => a.id == id);
        if (!anuncio) return;

        this.abrirModalCreacion();
        this.seleccionarTipo(anuncio.tipo);
        
        document.getElementById('modalAnuncioTitulo').innerText = 'Editar Anuncio';
        document.getElementById('anuncioId').value = anuncio.id;
        document.getElementById('anuncioTitulo').value = anuncio.titulo || '';
        document.getElementById('anuncioSubtitulo').value = anuncio.subtitulo || '';
        document.getElementById('anuncioImagenUrl').value = anuncio.imagenUrl || '';
        document.getElementById('anuncioFechaInicio').value = anuncio.fechaInicio || '';
        document.getElementById('anuncioFechaFin').value = anuncio.fechaFin || '';

        if (anuncio.tipo === 'tienda') {
            // Inyectar select y luego asignarle el valor guardado
            this.inyectarSelectTiendas(anuncio.tiendaId || 0);
            document.getElementById('anuncioPrecioPromo').value = anuncio.precioPromo || '';
            document.getElementById('anuncioPrecioNormal').value = anuncio.precioNormal || '';
        } else if (anuncio.tipo === 'domicilio') {
            document.getElementById('anuncioDescuento').value = anuncio.descuentoDomicilio || '';
        } else if (anuncio.tipo === 'codigo') {
            document.getElementById('anuncioCodigo').value = anuncio.codigoPromo || '';
        }

        // Restaurar orden de elementos
        try {
            const ordenGuardado = JSON.parse(anuncio.ordenElementos);
            if (Array.isArray(ordenGuardado) && ordenGuardado.length > 0) {
                this.ordenElementos = ordenGuardado;
                const list = document.getElementById('dragList');
                this.ordenElementos.forEach(el => {
                    const node = list.querySelector(`[data-el="${el}"]`);
                    if (node) list.appendChild(node);
                });
            }
        } catch (e) {}

        this.actualizarPreview();
    }
};

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    AdminAnuncios.init();
});