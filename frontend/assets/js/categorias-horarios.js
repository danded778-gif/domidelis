(function () {
    'use strict';

    const FRANJAS_PREDETERMINADAS = [
        { inicio: '06:00', fin: '10:30', categorias: ['Menu', 'Bebidas', 'Farmacia'] },
        { inicio: '10:30', fin: '15:00', categorias: ['Almuerzo', 'Bebidas', 'Menu'] },
        { inicio: '15:00', fin: '16:00', categorias: ['Detalles', 'Bebidas'] },
        { inicio: '16:00', fin: '17:00', categorias: ['Farmacia', 'Bebidas'] },
        { inicio: '17:00', fin: '21:00', categorias: ['Menu', 'Bebidas'] },
        { inicio: '21:00', fin: '23:00', categorias: ['Licores', 'Cervezas', 'Bebidas'] },
        { inicio: '23:00', fin: '06:00', categorias: ['Menu', 'Almuerzo', 'Licores', 'Cervezas', 'Bebidas'] }
    ];

    function obtenerFranjasPredeterminadas() {
        return FRANJAS_PREDETERMINADAS.map(franja => ({
            inicio: franja.inicio,
            fin: franja.fin,
            categorias: [...franja.categorias]
        }));
    }

    function aMinutos(hora) {
        if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    }

    function obtenerHoraActualMinutos() {
        const partes = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date());
        const hora = Number(partes.find(parte => parte.type === 'hour')?.value);
        const minuto = Number(partes.find(parte => parte.type === 'minute')?.value);
        return hora * 60 + minuto;
    }

    function obtenerPrioridades(franjas) {
        const minutoActual = obtenerHoraActualMinutos();
        const lista = Array.isArray(franjas) ? franjas : [];
        const franjaActual = lista.find(franja => {
            const inicio = aMinutos(franja.inicio);
            const fin = aMinutos(franja.fin);
            if (inicio === null || fin === null || inicio === fin) return false;
            return inicio < fin
                ? minutoActual >= inicio && minutoActual < fin
                : minutoActual >= inicio || minutoActual < fin;
        });

        return franjaActual && Array.isArray(franjaActual.categorias)
            ? franjaActual.categorias.filter(categoria => typeof categoria === 'string' && categoria.trim())
            : obtenerFranjasPredeterminadas().find(franja => {
                const inicio = aMinutos(franja.inicio);
                const fin = aMinutos(franja.fin);
                return inicio < fin
                    ? minutoActual >= inicio && minutoActual < fin
                    : minutoActual >= inicio || minutoActual < fin;
            }).categorias;
    }

    window.CategoriasHorario = {
        obtenerFranjasPredeterminadas,
        obtenerPrioridades,
        aMinutos
    };
})();
