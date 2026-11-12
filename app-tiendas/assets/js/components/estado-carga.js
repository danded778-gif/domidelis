window.EstadoCargaTienda = {
    mostrarPedidos(contenedor, tipo, mensaje, alReintentar) {
        const configuracion = {
            cargando: { icono: 'spinner', clase: 'cargando', rol: 'status' },
            vacio: { icono: 'fa-receipt', clase: 'vacio', rol: 'status' },
            error: { icono: 'fa-triangle-exclamation', clase: 'error', rol: 'alert' },
            offline: { icono: 'fa-wifi', clase: 'offline', rol: 'alert' }
        }[tipo];

        if (!configuracion) throw new Error(`Estado de pedidos desconocido: ${tipo}`);

        const estado = document.createElement('div');
        estado.className = `estado-pedidos estado-pedidos--${configuracion.clase}`;
        estado.setAttribute('role', configuracion.rol);
        estado.setAttribute('aria-live', configuracion.rol === 'alert' ? 'assertive' : 'polite');

        const icono = document.createElement('span');
        icono.className = configuracion.icono === 'spinner'
            ? 'spinner estado-pedidos-spinner'
            : `fas ${configuracion.icono} estado-pedidos-icono`;
        icono.setAttribute('aria-hidden', 'true');
        estado.appendChild(icono);

        const texto = document.createElement('p');
        texto.textContent = mensaje;
        estado.appendChild(texto);

        if (alReintentar) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'btn btn-primary estado-pedidos-reintentar';
            boton.textContent = 'Reintentar';
            boton.addEventListener('click', alReintentar);
            estado.appendChild(boton);
        }

        contenedor.replaceChildren(estado);
    },

    mostrarConexion(tipo, mensaje, alReintentar) {
        const contenedor = document.getElementById('estado-conexion-tienda');
        if (!contenedor) return;

        contenedor.replaceChildren();
        contenedor.className = `estado-conexion estado-conexion--${tipo}`;
        contenedor.hidden = !mensaje;
        if (!mensaje) return;

        const texto = document.createElement('span');
        texto.textContent = mensaje;
        contenedor.appendChild(texto);

        if (alReintentar) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'estado-conexion-reintentar';
            boton.textContent = 'Reintentar';
            boton.addEventListener('click', alReintentar);
            contenedor.appendChild(boton);
        }
    }
};
