(function () {
    'use strict';

    const FILAS_ID = 'category-schedule-rows';
    const ESTADO_ID = 'category-schedule-status';
    const CLAVE_CACHE = 'domidelis_horarios_categorias_v1';
    let franjas = [];
    let categoriasDisponibles = [];
    let plantillas = [];
    let zonas = [];
    let cargando = false;
    let cargado = false;

    function mostrarEstado(mensaje, error) {
        const elemento = document.getElementById(ESTADO_ID);
        if (!elemento) return;
        elemento.textContent = mensaje;
        elemento.style.color = error ? '#b42318' : 'var(--gray)';
    }

    function leerFranjasDeLaTabla() {
        return Array.from(document.querySelectorAll(`#${FILAS_ID} tr[data-slot-index]`)).map(fila => ({
            inicio: fila.querySelector('[data-field="inicio"]').value,
            fin: fila.querySelector('[data-field="fin"]').value,
            categorias: Array.from(fila.querySelectorAll('[data-priority-category]'))
                .map(elemento => elemento.dataset.priorityCategory)
        }));
    }

    function renderizarFranjas() {
        const tbody = document.getElementById(FILAS_ID);
        if (!tbody) return;

        tbody.innerHTML = franjas.map((franja, indice) => {
            const categoriasSeleccionadas = new Set(franja.categorias);
            const opciones = categoriasDisponibles
                .filter(categoria => !categoriasSeleccionadas.has(categoria))
                .map(categoria => `<option value="${esc(categoria)}">${esc(categoria)}</option>`)
                .join('');
            const prioridades = franja.categorias.map((categoria, posicion) => `
                <div data-priority-category="${esc(categoria)}"
                    style="display:flex;align-items:center;gap:.45rem;margin:.25rem 0;">
                    <span style="flex:1;">${posicion + 1}. ${esc(categoria)}</span>
                    <button class="btn btn-secondary btn-sm" type="button"
                        aria-label="Subir ${esc(categoria)}" title="Subir prioridad"
                        onclick="AdminCategorySchedule.moverCategoria(${indice},${posicion},-1)"
                        ${posicion === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-secondary btn-sm" type="button"
                        aria-label="Bajar ${esc(categoria)}" title="Bajar prioridad"
                        onclick="AdminCategorySchedule.moverCategoria(${indice},${posicion},1)"
                        ${posicion === franja.categorias.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                    <button class="btn btn-danger btn-sm" type="button"
                        aria-label="Quitar ${esc(categoria)}" title="Quitar categoría"
                        onclick="AdminCategorySchedule.quitarCategoria(${indice},${posicion})">
                        <i class="fas fa-times"></i></button>
                </div>`).join('');

            return `<tr data-slot-index="${indice}">
                <td><input data-field="inicio" type="time" value="${esc(franja.inicio)}" aria-label="Hora inicial"></td>
                <td><input data-field="fin" type="time" value="${esc(franja.fin)}" aria-label="Hora final"></td>
                <td>
                    <div>${prioridades || '<span style="color:var(--gray);">Agrega al menos una categoría.</span>'}</div>
                    <div style="display:flex;gap:.4rem;align-items:center;margin-top:.5rem;">
                        <select data-add-category aria-label="Seleccionar categoría para agregar">
                            <option value="">Agregar categoría...</option>${opciones}
                        </select>
                        <button class="btn btn-secondary btn-sm" type="button"
                            onclick="AdminCategorySchedule.incluirCategoria(${indice})"
                            title="Agregar categoría"><i class="fas fa-plus"></i></button>
                    </div>
                </td>
                <td><button class="btn btn-danger btn-sm" type="button"
                    onclick="AdminCategorySchedule.quitarFranja(${indice})" title="Eliminar franja">
                    <i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('');
    }

    function renderizarPlantillas() {
        const select = document.getElementById('category-template-select');
        if (!select) return;
        const seleccionActual = select.value;
        select.innerHTML = '<option value="">Selecciona una plantilla...</option>' +
            plantillas.map(plantilla =>
                `<option value="${esc(plantilla.id)}">${esc(plantilla.nombre)}</option>`
            ).join('');
        if (plantillas.some(plantilla => plantilla.id === seleccionActual)) {
            select.value = seleccionActual;
        }
    }

    function renderizarZonas() {
        const tbody = document.getElementById('delivery-zones-rows');
        if (!tbody) return;
        tbody.innerHTML = zonas.map(zona => `
            <tr data-zone-id="${esc(zona.id)}">
                <td>${esc(zona.id)}</td>
                <td><input data-zone-name type="text" maxlength="80" value="${esc(zona.nombre)}" aria-label="Nombre de ${esc(zona.nombre)}"></td>
                <td><input data-zone-fee type="number" min="0" max="100000" step="1" value="${esc(zona.envio)}" aria-label="Tarifa de ${esc(zona.nombre)}"></td>
                <td><label><input data-zone-active type="checkbox" ${zona.activo ? 'checked' : ''}> Activa</label></td>
            </tr>`).join('');
    }

    function leerZonasDeTabla() {
        const filas = Array.from(document.querySelectorAll('#delivery-zones-rows tr[data-zone-id]'));
        const editadas = new Map(filas.map(fila => [fila.dataset.zoneId, {
            id: fila.dataset.zoneId,
            nombre: fila.querySelector('[data-zone-name]').value.trim(),
            envio: Number(fila.querySelector('[data-zone-fee]').value),
            activo: fila.querySelector('[data-zone-active]').checked
        }]));
        return zonas.map(zona => editadas.get(zona.id) || zona);
    }

    function idDesdeNombre(nombre) {
        const base = nombre.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 60);
        if (!base) return '';
        let id = base;
        let sufijo = 2;
        while (zonas.some(zona => zona.id.toLowerCase() === id.toLowerCase())) {
            const terminacion = `_${sufijo++}`;
            id = base.slice(0, 60 - terminacion.length) + terminacion;
        }
        return id;
    }

    async function leerJson(response) {
        const data = await response.json();
        if (!response.ok || data.success === false) {
            throw new Error(data.error || `Error HTTP ${response.status}`);
        }
        return data;
    }

    async function cargar() {
        if (cargando) return;
        cargando = true;
        mostrarEstado('Cargando categorías y horarios...', false);

        try {
            const [catalogoResponse, horariosResponse] = await Promise.all([
                fetchConToken(`${API_URL}/catalogo`, { cache: 'no-store' }),
                fetchConToken(`${API_URL}/category-schedule`, { cache: 'no-store' })
            ]);
            const [catalogo, horarios] = await Promise.all([
                leerJson(catalogoResponse),
                leerJson(horariosResponse)
            ]);
            let configuracionZonas = null;
            try {
                const configResponse = await fetchConToken(`${API_URL}/app-config`, { cache: 'no-store' });
                configuracionZonas = await leerJson(configResponse);
            } catch (error) {
                console.warn('No se pudieron leer las zonas guardadas; se mostrarán las zonas locales:', error.message);
            }
            const categoriasCatalogo = (catalogo.productosGlobal || [])
                .map(producto => String(producto.categoria || '').trim())
                .filter(Boolean);

            franjas = Array.isArray(horarios.slots) && horarios.slots.length
                ? horarios.slots
                : window.CategoriasHorario.obtenerFranjasPredeterminadas();
            plantillas = Array.isArray(horarios.templates) ? horarios.templates : [];
            renderizarPlantillas();

            const zonasGuardadas = configuracionZonas && Array.isArray(configuracionZonas.zonas)
                ? configuracionZonas.zonas
                : Object.entries(APP_CONFIG.zonas).map(([id, zona]) => ({
                    id,
                    nombre: zona.nombre,
                    envio: zona.envio,
                    activo: zona.activo !== false
                }));
            zonas = zonasGuardadas.map(zona => ({
                id: String(zona.id),
                nombre: String(zona.nombre),
                envio: Number(zona.envio),
                activo: zona.activo !== false
            }));
            renderizarZonas();

            const unicas = new Map();
            [...categoriasCatalogo, ...franjas.flatMap(franja => franja.categorias || [])].forEach(categoria => {
                const nombre = String(categoria || '').trim();
                if (nombre && !unicas.has(nombre.toLocaleLowerCase('es-CO'))) {
                    unicas.set(nombre.toLocaleLowerCase('es-CO'), nombre);
                }
            });
            categoriasDisponibles = [...unicas.values()].sort((a, b) => a.localeCompare(b, 'es'));
            renderizarFranjas();
            cargado = true;
            mostrarEstado(
                `Se encontraron ${categoriasCatalogo.length ? new Set(categoriasCatalogo).size : 0} categorías en el catálogo. Las horas usan la zona horaria de Colombia.`,
                false
            );
        } catch (error) {
            cargado = false;
            mostrarEstado(`No se pudieron cargar los datos: ${error.message}`, true);
        } finally {
            cargando = false;
        }
    }

    function incluirCategoria(indice) {
        franjas = leerFranjasDeLaTabla();
        const fila = document.querySelector(`#${FILAS_ID} tr[data-slot-index="${indice}"]`);
        const seleccion = fila && fila.querySelector('[data-add-category]');
        if (!seleccion || !seleccion.value) return;
        franjas[indice].categorias.push(seleccion.value);
        renderizarFranjas();
    }

    function quitarCategoria(indice, posicion) {
        franjas = leerFranjasDeLaTabla();
        franjas[indice].categorias.splice(posicion, 1);
        renderizarFranjas();
    }

    function moverCategoria(indice, posicion, desplazamiento) {
        franjas = leerFranjasDeLaTabla();
        const destino = posicion + desplazamiento;
        if (destino < 0 || destino >= franjas[indice].categorias.length) return;
        const [categoria] = franjas[indice].categorias.splice(posicion, 1);
        franjas[indice].categorias.splice(destino, 0, categoria);
        renderizarFranjas();
    }

    function agregarFranja() {
        if (!cargado) {
            mostrarEstado('Primero actualiza las categorías y horarios.', true);
            return;
        }
        franjas = leerFranjasDeLaTabla();
        if (franjas.length >= 24) {
            mostrarEstado('No se pueden agregar más de 24 franjas.', true);
            return;
        }
        franjas.push({ inicio: '00:00', fin: '00:00', categorias: [] });
        renderizarFranjas();
    }

    function quitarFranja(indice) {
        franjas = leerFranjasDeLaTabla();
        franjas.splice(indice, 1);
        renderizarFranjas();
    }

    async function guardar() {
        if (!cargado) {
            mostrarEstado('Carga los datos antes de guardar.', true);
            return;
        }

        franjas = leerFranjasDeLaTabla();
        const boton = document.getElementById('category-schedule-save');
        boton.disabled = true;
        mostrarEstado('Guardando horarios...', false);

        try {
            const response = await fetchConToken(`${API_URL}/category-schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots: franjas })
            });
            const data = await leerJson(response);
            franjas = data.slots;
            localStorage.setItem(CLAVE_CACHE, JSON.stringify(franjas));
            renderizarFranjas();
            mostrarEstado('Horarios guardados. Se aplicarán a los clientes cuando actualicen o vuelvan a abrir la aplicación.', false);
        } catch (error) {
            mostrarEstado(`No se pudieron guardar los horarios: ${error.message}`, true);
        } finally {
            boton.disabled = false;
        }
    }

    async function guardarPlantilla() {
        if (!cargado) {
            mostrarEstado('Carga los datos antes de guardar una plantilla.', true);
            return;
        }
        franjas = leerFranjasDeLaTabla();
        const nombre = document.getElementById('category-template-name').value.trim();
        if (!nombre) {
            mostrarEstado('Escribe un nombre para la plantilla.', true);
            return;
        }
        try {
            const response = await fetchConToken(`${API_URL}/category-schedule/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, slots: franjas })
            });
            const data = await leerJson(response);
            plantillas = data.templates;
            document.getElementById('category-template-name').value = '';
            renderizarPlantillas();
            mostrarEstado(`Plantilla “${nombre}” guardada.`, false);
        } catch (error) {
            mostrarEstado(`No se pudo guardar la plantilla: ${error.message}`, true);
        }
    }

    function aplicarPlantilla() {
        const id = document.getElementById('category-template-select').value;
        const plantilla = plantillas.find(item => item.id === id);
        if (!plantilla) {
            mostrarEstado('Selecciona una plantilla para aplicarla.', true);
            return;
        }
        franjas = plantilla.slots.map(franja => ({
            inicio: franja.inicio,
            fin: franja.fin,
            categorias: [...franja.categorias]
        }));
        renderizarFranjas();
        mostrarEstado(`Plantilla “${plantilla.nombre}” aplicada. Guarda los horarios para publicarlos.`, false);
    }

    async function eliminarPlantilla() {
        const select = document.getElementById('category-template-select');
        const id = select.value;
        const plantilla = plantillas.find(item => item.id === id);
        if (!plantilla) {
            mostrarEstado('Selecciona la plantilla que quieres eliminar.', true);
            return;
        }
        if (!window.confirm(`¿Eliminar la plantilla “${plantilla.nombre}”?`)) return;
        try {
            const response = await fetchConToken(
                `${API_URL}/category-schedule/templates/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );
            const data = await leerJson(response);
            plantillas = data.templates;
            renderizarPlantillas();
            mostrarEstado(`Plantilla “${plantilla.nombre}” eliminada.`, false);
        } catch (error) {
            mostrarEstado(`No se pudo eliminar la plantilla: ${error.message}`, true);
        }
    }

    function agregarZona() {
        zonas = leerZonasDeTabla();
        const nombreInput = document.getElementById('delivery-zone-name');
        const tarifaInput = document.getElementById('delivery-zone-fee');
        const nombre = nombreInput.value.trim();
        const envio = Number(tarifaInput.value);
        if (!nombre || !Number.isSafeInteger(envio) || envio < 0 || envio > 100000) {
            mostrarEstadoZonas('Escribe un nombre y una tarifa entera entre 0 y 100000.', true);
            return;
        }
        if (zonas.some(zona => zona.nombre.toLocaleLowerCase('es-CO') === nombre.toLocaleLowerCase('es-CO'))) {
            mostrarEstadoZonas('Ya existe una zona con ese nombre.', true);
            return;
        }
        const id = idDesdeNombre(nombre);
        if (!id) {
            mostrarEstadoZonas('El nombre no permite generar un identificador válido.', true);
            return;
        }
        zonas.push({ id, nombre, envio, activo: true });
        renderizarZonas();
        nombreInput.value = '';
        tarifaInput.value = '';
        mostrarEstadoZonas(`Zona “${nombre}” agregada. Guarda los cambios para publicarla.`, false);
    }

    function mostrarEstadoZonas(mensaje, error) {
        const elemento = document.getElementById('delivery-zones-status');
        if (!elemento) return;
        elemento.textContent = mensaje;
        elemento.style.color = error ? '#b42318' : 'var(--gray)';
    }

    async function guardarZonas() {
        zonas = leerZonasDeTabla();
        if (!zonas.some(zona => zona.activo)) {
            mostrarEstadoZonas('Debe quedar al menos una zona activa.', true);
            return;
        }
        const boton = document.getElementById('delivery-zones-save');
        boton.disabled = true;
        mostrarEstadoZonas('Guardando zonas...', false);
        try {
            const response = await fetchConToken(`${API_URL}/app-config/zones`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zonas })
            });
            const data = await leerJson(response);
            zonas = data.zonas;
            window.aplicarZonasAdministradas(zonas);
            localStorage.setItem('domidelis_zonas_envio_v1', JSON.stringify(zonas));
            renderizarZonas();
            mostrarEstadoZonas('Zonas guardadas. Se aplicarán al actualizar la aplicación; las desactivadas ya no aparecerán en el selector.', false);
        } catch (error) {
            mostrarEstadoZonas(`No se pudieron guardar las zonas: ${error.message}`, true);
        } finally {
            boton.disabled = false;
        }
    }

    window.AdminCategorySchedule = {
        cargar,
        guardar,
        guardarPlantilla,
        aplicarPlantilla,
        eliminarPlantilla,
        agregarFranja,
        quitarFranja,
        incluirCategoria,
        quitarCategoria,
        moverCategoria,
        agregarZona,
        guardarZonas
    };
})();
