/* ==========================================================================
   almacen.js — Guardado en el navegador y sesión
   --------------------------------------------------------------------------
   localStorage no está disponible en todos lados (modo privado, vistas
   previas dentro de otras páginas), así que si falla se cae a memoria y el
   sistema sigue funcionando durante la visita.
   ========================================================================== */

(function (global) {
  'use strict';

  var memoria = {};
  var hayLocal = (function () {
    try {
      var k = '__cc_prueba__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var haySesion = (function () {
    try {
      var k = '__cc_prueba__';
      global.sessionStorage.setItem(k, '1');
      global.sessionStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function leerCrudo(almacen, clave) {
    try {
      if (almacen === 'local' && hayLocal) return global.localStorage.getItem(clave);
      if (almacen === 'sesion' && haySesion) return global.sessionStorage.getItem(clave);
    } catch (e) { /* sigue a memoria */ }
    return Object.prototype.hasOwnProperty.call(memoria, clave) ? memoria[clave] : null;
  }

  function escribirCrudo(almacen, clave, texto) {
    memoria[clave] = texto;
    try {
      if (almacen === 'local' && hayLocal) global.localStorage.setItem(clave, texto);
      else if (almacen === 'sesion' && haySesion) global.sessionStorage.setItem(clave, texto);
      return true;
    } catch (e) {
      return false; // cupo lleno: queda en memoria
    }
  }

  function borrarCrudo(clave) {
    delete memoria[clave];
    try { if (hayLocal) global.localStorage.removeItem(clave); } catch (e) {}
    try { if (haySesion) global.sessionStorage.removeItem(clave); } catch (e) {}
  }

  var Almacen = {
    persistente: hayLocal,

    leer: function (clave, valorPorDefecto) {
      var texto = leerCrudo('local', clave);
      if (texto === null) return valorPorDefecto;
      try { return JSON.parse(texto); } catch (e) { return valorPorDefecto; }
    },

    guardar: function (clave, valor) {
      return escribirCrudo('local', clave, JSON.stringify(valor));
    },

    borrar: borrarCrudo,

    /** Identificador corto y único para registros y cuentas. */
    id: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
  };

  /* --- Sesión ------------------------------------------------------------- */

  var CLAVE_SESION = 'cc:sesion';

  var Sesion = {
    guardar: function (usuario, recordar) {
      var texto = JSON.stringify({ usuario: usuario, desde: Date.now() });
      borrarCrudo(CLAVE_SESION);
      escribirCrudo(recordar ? 'local' : 'sesion', CLAVE_SESION, texto);
      memoria[CLAVE_SESION] = texto;
    },

    leer: function () {
      var texto = leerCrudo('sesion', CLAVE_SESION) || leerCrudo('local', CLAVE_SESION);
      if (!texto) return null;
      try { return JSON.parse(texto).usuario; } catch (e) { return null; }
    },

    cerrar: function () { borrarCrudo(CLAVE_SESION); },

    /**
     * Protege una página. Si no hay sesión o el rol no corresponde, manda
     * de vuelta al acceso y devuelve null.
     * @param {string|string[]} roles
     */
    exigir: function (roles) {
      var usuario = this.leer();
      var permitidos = [].concat(roles);
      if (!usuario || permitidos.indexOf(usuario.rol) === -1) {
        Ruta.ir('acceso', true);
        return null;
      }
      return usuario;
    },

    /** Manda a cada rol a su panel. */
    irASuPanel: function (usuario) {
      Ruta.ir(usuario.rol === 'admin' ? 'admin' : 'alumno');
    }
  };

  /* --- Navegación ---------------------------------------------------------
     Se concentra aquí para que la versión de un solo archivo pueda cambiar
     de pantalla sin recargar, sobrescribiendo únicamente Ruta.ir.
     ------------------------------------------------------------------------ */

  var Ruta = {
    destinos: { acceso: 'index.html', alumno: 'alumno.html', admin: 'admin.html' },

    ir: function (nombre, reemplazar) {
      var url = this.destinos[nombre] || this.destinos.acceso;
      if (reemplazar) global.location.replace(url);
      else global.location.assign(url);
    }
  };

  /* --- Registro de pantallas ----------------------------------------------
     En el sitio de varias páginas cada arranque corre al cargar su HTML.
     En la versión de un solo archivo quedan guardados y el enrutador los
     llama cuando toca. Los dos modos usan el mismo código.
     ------------------------------------------------------------------------ */

  global.CC_PANTALLAS = {};

  global.CCPantalla = function (nombre, arranque) {
    global.CC_PANTALLAS[nombre] = arranque;
    if (global.CC_UNA_PAGINA) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arranque);
    } else {
      arranque();
    }
  };

  /** Raíz donde buscar los elementos de una pantalla. */
  global.CCRaiz = function (nombre) {
    return document.querySelector('[data-pantalla="' + nombre + '"]') || document;
  };

  global.CCAlmacen = Almacen;
  global.CCSesion = Sesion;
  global.CCRuta = Ruta;
})(window);
