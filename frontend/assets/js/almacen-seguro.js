'use strict';

(function () {
  const NOMBRE_DB = 'domidelis_almacen_seguro';
  const VERSION_DB = 1;
  const ALMACEN_CLAVES = 'claves';
  const ID_CLAVE = 'datos-cliente';
  const SUFIJO_CIFRADO = ':cifrado';
  let baseDatos;
  let promesaBaseDatos;
  let promesaClave;
  let colaEscrituras = Promise.resolve();

  function abrirBaseDatos() {
    if (promesaBaseDatos) return promesaBaseDatos;
    if (!window.indexedDB) {
      return Promise.reject(new Error('Este navegador no permite proteger los datos guardados.'));
    }

    promesaBaseDatos = new Promise(function (resolve, reject) {
      const solicitud = window.indexedDB.open(NOMBRE_DB, VERSION_DB);
      solicitud.onupgradeneeded = function () {
        const db = solicitud.result;
        if (!db.objectStoreNames.contains(ALMACEN_CLAVES)) {
          db.createObjectStore(ALMACEN_CLAVES);
        }
      };
      solicitud.onsuccess = function () {
        baseDatos = solicitud.result;
        baseDatos.onversionchange = function () {
          baseDatos.close();
          baseDatos = null;
          promesaBaseDatos = null;
          promesaClave = null;
        };
        resolve(baseDatos);
      };
      solicitud.onerror = function () {
        promesaBaseDatos = null;
        reject(solicitud.error || new Error('No se pudo abrir el almacenamiento seguro.'));
      };
      solicitud.onblocked = function () {
        promesaBaseDatos = null;
        reject(new Error('El almacenamiento seguro está bloqueado por otra pestaña.'));
      };
    });
    return promesaBaseDatos;
  }

  async function leerClave(db) {
    return new Promise(function (resolve, reject) {
      const transaccion = db.transaction(ALMACEN_CLAVES, 'readonly');
      const solicitud = transaccion.objectStore(ALMACEN_CLAVES).get(ID_CLAVE);
      solicitud.onsuccess = function () { resolve(solicitud.result || null); };
      solicitud.onerror = function () {
        reject(solicitud.error || new Error('No se pudo recuperar la clave de cifrado.'));
      };
      transaccion.onabort = function () {
        reject(transaccion.error || new Error('No se pudo recuperar la clave de cifrado.'));
      };
    });
  }

  async function obtenerClave() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Este navegador no ofrece cifrado seguro para proteger tus datos.');
    }
    if (promesaClave) return promesaClave;
    promesaClave = (async function () {
      const db = await abrirBaseDatos();
      const existente = await leerClave(db);
      if (existente) return existente;

      const nueva = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      try {
        await new Promise(function (resolve, reject) {
          const transaccion = db.transaction(ALMACEN_CLAVES, 'readwrite');
          transaccion.objectStore(ALMACEN_CLAVES).add(nueva, ID_CLAVE);
          transaccion.oncomplete = resolve;
          transaccion.onerror = function () {
            reject(transaccion.error || new Error('No se pudo guardar la clave de cifrado.'));
          };
          transaccion.onabort = function () {
            reject(transaccion.error || new Error('No se pudo guardar la clave de cifrado.'));
          };
        });
      } catch (error) {
        if (error.name !== 'ConstraintError') throw error;
      }
      const claveGuardada = await leerClave(db);
      if (!claveGuardada) throw new Error('No se pudo inicializar la clave de cifrado.');
      return claveGuardada;
    })().catch(function (error) {
      promesaClave = null;
      throw error;
    });
    return promesaClave;
  }

  function codificarBase64(bytes) {
    let binario = '';
    bytes.forEach(function (byte) { binario += String.fromCharCode(byte); });
    return window.btoa(binario);
  }

  function decodificarBase64(texto) {
    const binario = window.atob(texto);
    const bytes = new Uint8Array(binario.length);
    for (let indice = 0; indice < binario.length; indice += 1) {
      bytes[indice] = binario.charCodeAt(indice);
    }
    return bytes;
  }

  async function cifrar(valor) {
    const clave = await obtenerClave();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const datos = new TextEncoder().encode(JSON.stringify(valor));
    const cifrado = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      clave,
      datos
    );
    return JSON.stringify({
      version: 1,
      iv: codificarBase64(iv),
      datos: codificarBase64(new Uint8Array(cifrado))
    });
  }

  async function descifrar(texto) {
    const sobre = JSON.parse(texto);
    if (!sobre || sobre.version !== 1 || typeof sobre.iv !== 'string' ||
        typeof sobre.datos !== 'string') {
      throw new Error('El formato de los datos cifrados no es válido.');
    }
    const clave = await obtenerClave();
    const plano = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodificarBase64(sobre.iv) },
      clave,
      decodificarBase64(sobre.datos)
    );
    return JSON.parse(new TextDecoder().decode(plano));
  }

  async function leer(almacen, clave) {
    const claveCifrada = clave + SUFIJO_CIFRADO;
    const cifrado = almacen.getItem(claveCifrada);
    if (cifrado !== null) return descifrar(cifrado);

    const legado = almacen.getItem(clave);
    if (legado === null) return null;
    let valor;
    try {
      valor = JSON.parse(legado);
    } catch (error) {
      almacen.removeItem(clave);
      console.error('[DOMI IA] Se eliminó un dato anterior ilegible que estaba sin cifrar:', error);
      throw new Error('Los datos guardados anteriormente no se pueden leer como JSON.');
    }
    try {
      const nuevoCifrado = await cifrar(valor);
      almacen.setItem(claveCifrada, nuevoCifrado);
      almacen.removeItem(clave);
    } catch (error) {
      almacen.removeItem(clave);
      console.error('[DOMI IA] Falló la migración del dato anterior:', error);
      throw new Error('No se pudieron cifrar los datos anteriores; se eliminó la copia en texto plano.');
    }
    return valor;
  }

  async function guardar(almacen, clave, valor) {
    const operacion = colaEscrituras.catch(function () {}).then(async function () {
      const textoCifrado = await cifrar(valor);
      almacen.setItem(clave + SUFIJO_CIFRADO, textoCifrado);
      almacen.removeItem(clave);
    });
    colaEscrituras = operacion;
    return operacion;
  }

  function eliminar(almacen, clave) {
    almacen.removeItem(clave);
    almacen.removeItem(clave + SUFIJO_CIFRADO);
  }

  window.DomiAlmacenSeguro = Object.freeze({
    guardarLocal: function (clave, valor) { return guardar(window.localStorage, clave, valor); },
    leerLocal: function (clave) { return leer(window.localStorage, clave); },
    eliminarLocal: function (clave) { eliminar(window.localStorage, clave); },
    guardarSesion: function (clave, valor) { return guardar(window.sessionStorage, clave, valor); },
    leerSesion: function (clave) { return leer(window.sessionStorage, clave); },
    eliminarSesion: function (clave) { eliminar(window.sessionStorage, clave); }
  });
})();
