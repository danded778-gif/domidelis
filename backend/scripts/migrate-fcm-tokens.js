require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const COLECCION_ORIGEN = 'tokens_clientes';
const COLECCIONES_POR_ROL = {
    tienda: 'tokens_tiendas',
    admin: 'tokens_usuarios',
    domiciliario: 'tokens_domiciliarios'
};

function privateKeyPareceValida(key) {
    if (!key || typeof key !== 'string') return false;
    const normalizada = key.replace(/\\n/g, '\n').trim();
    return normalizada.includes('BEGIN PRIVATE KEY') && normalizada.includes('END PRIVATE KEY');
}

function codigoYaExiste(error) {
    return error.code === 6 || error.code === 'already-exists';
}

async function migrarTokens() {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !privateKeyPareceValida(FIREBASE_PRIVATE_KEY)) {
        throw new Error('Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.');
    }

    initializeApp({
        credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });

    const firestore = getFirestore();
    const aplicar = process.argv.includes('--apply');
    const snapshot = await firestore.collection(COLECCION_ORIGEN).get();
    const resumen = {
        encontrados: snapshot.size,
        clientesSinMover: 0,
        destinos: Object.fromEntries(
            Object.values(COLECCIONES_POR_ROL).map(coleccion => [
                coleccion,
                { porMigrar: 0, yaExistian: 0, verificados: 0 }
            ])
        ),
        omitidos: 0,
        errores: 0
    };

    for (const tokenDoc of snapshot.docs) {
        const datos = tokenDoc.data();
        const rol = String(datos.rol || '').toLowerCase();

        if (rol === 'cliente') {
            resumen.clientesSinMover++;
            continue;
        }

        const coleccionDestino = COLECCIONES_POR_ROL[rol];
        if (!coleccionDestino) {
            resumen.omitidos++;
            console.warn(`Se encontró un rol FCM no reconocido; se conserva en ${COLECCION_ORIGEN}.`);
            continue;
        }

        const resumenDestino = resumen.destinos[coleccionDestino];
        resumenDestino.porMigrar++;
        if (!aplicar) continue;

        const destino = firestore.collection(coleccionDestino).doc(tokenDoc.id);
        const datosMigrados = { ...datos, token: datos.token || tokenDoc.id, rol };

        try {
            await destino.create(datosMigrados);
        } catch (error) {
            if (!codigoYaExiste(error)) {
                resumen.errores++;
                console.error(`No se pudo copiar un documento a ${coleccionDestino}:`, error.message);
                continue;
            }
            resumenDestino.yaExistian++;
        }

        const verificacion = await destino.get();
        const datosDestino = verificacion.data();
        if (!verificacion.exists || datosDestino.rol !== rol || datosDestino.token !== tokenDoc.id) {
            resumen.errores++;
            console.error(`Falló la verificación de un documento en ${coleccionDestino}.`);
        } else {
            resumenDestino.verificados++;
        }
    }

    console.log(aplicar ? 'Migración de tokens Firestore:' : 'Simulación (no se escribió ningún dato):');
    console.log(JSON.stringify(resumen, null, 2));
    console.log(`La colección ${COLECCION_ORIGEN} no se eliminó ni se modificó.`);

    if (resumen.errores > 0) process.exitCode = 1;
}

migrarTokens().catch(error => {
    console.error('Error en la migración de tokens FCM:', error.message);
    process.exitCode = 1;
});
