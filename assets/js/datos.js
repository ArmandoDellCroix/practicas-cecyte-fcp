/* ==========================================================================
   datos.js — Cuentas y registros de prácticas
   --------------------------------------------------------------------------
   Una sola interfaz, dos implementaciones:

     modo 'local'    → localStorage del navegador. Cero configuración.
     modo 'supabase' → Postgres en línea vía supabase-js. Es el modo real.

   El resto del sistema no sabe cuál está activo: llama siempre a CCDatos.
   ========================================================================== */

(function (global) {
  'use strict';

  var CFG = global.CC_CONFIG || {};
  var CLAVE_CUENTAS = 'cc:cuentas';
  var CLAVE_EXPEDIENTES = 'cc:expedientes';

  var MENSAJES = {
    CREDENCIALES:   'El usuario o la contraseña no coinciden. Revísalos e inténtalo otra vez.',
    SIN_CUENTA:     'No hay ninguna cuenta registrada con ese correo.',
    CORREO_OCUPADO: 'Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.',
    SIN_PERMISO:    'Tu cuenta no tiene permiso para esta operación.',
    RED:            'No hay conexión con la base de datos. Revisa tu red e inténtalo de nuevo.',
    SERVIDOR:       'La base de datos respondió con un error. Inténtalo más tarde.'
  };

  function fallo(codigo, mensaje, campo) {
    var e = new Error(mensaje || MENSAJES[codigo] || 'Error');
    e.name = 'ErrorDatos';
    e.codigo = codigo;
    e.campo = campo || null;
    return e;
  }

  /* --- Huella de contraseña (solo modo local) ----------------------------- */

  function huella(texto) {
    var cripto = global.crypto && global.crypto.subtle;
    if (cripto && global.isSecureContext !== false) {
      var datos = new TextEncoder().encode('cecyte:' + texto);
      return cripto.digest('SHA-256', datos).then(function (buffer) {
        return Array.prototype.map
          .call(new Uint8Array(buffer), function (b) { return ('0' + b.toString(16)).slice(-2); })
          .join('');
      }).catch(function () { return respaldoHuella(texto); });
    }
    return Promise.resolve(respaldoHuella(texto));
  }

  // Respaldo cuando el navegador no ofrece criptografía (por ejemplo al abrir
  // el archivo con doble clic en vez de servirlo). No es seguro; en modo
  // supabase esto no se usa nunca.
  function respaldoHuella(texto) {
    var h = 5381;
    for (var i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
    return 'db' + h.toString(16);
  }

  function normaliza(correo) {
    return String(correo || '').trim().toLowerCase();
  }

  /** ¿El texto escrito corresponde al usuario administrador? */
  function esAdmin(entrada) {
    var admin = CFG.administrador || {};
    var v = normaliza(entrada);
    return v === normaliza(admin.usuario) || v === normaliza(admin.correo);
  }

  /* ======================================================================
     Adaptador local
     ====================================================================== */

  var Local = {
    cuentas: function () { return global.CCAlmacen.leer(CLAVE_CUENTAS, []); },
    expedientes: function () { return global.CCAlmacen.leer(CLAVE_EXPEDIENTES, []); },

    iniciar: function () { return Promise.resolve(); },

    iniciarSesion: function (datos) {
      var admin = CFG.administrador || {};

      if (esAdmin(datos.correo)) {
        if (datos.contrasena !== admin.contrasenaLocal) {
          return Promise.reject(fallo('CREDENCIALES', null, 'contrasena'));
        }
        return Promise.resolve({
          usuario: {
            id: 'admin',
            nombre: 'Administración del plantel',
            correo: normaliza(admin.correo),
            rol: 'admin'
          },
          token: 'local'
        });
      }

      var correo = normaliza(datos.correo);
      var cuenta = this.cuentas().filter(function (c) { return c.correo === correo; })[0];
      if (!cuenta) return Promise.reject(fallo('SIN_CUENTA', null, 'correo'));

      return huella(datos.contrasena).then(function (h) {
        if (h !== cuenta.huella) throw fallo('CREDENCIALES', null, 'contrasena');
        return {
          usuario: {
            id: cuenta.id,
            nombre: cuenta.nombre,
            correo: cuenta.correo,
            matricula: cuenta.matricula || '',
            partes: cuenta.partes || null,
            rol: cuenta.rol
          },
          token: 'local'
        };
      });
    },

    registrar: function (datos) {
      var correo = normaliza(datos.correo);
      var cuentas = this.cuentas();

      if (esAdmin(correo) || cuentas.some(function (c) { return c.correo === correo; })) {
        return Promise.reject(fallo('CORREO_OCUPADO', null, 'correo'));
      }

      return huella(datos.contrasena).then(function (h) {
        var cuenta = {
          id: global.CCAlmacen.id(),
          nombre: String(datos.nombre || '').trim(),
          matricula: String(datos.matricula || '').trim(),
          partes: datos.partes || null,
          correo: correo,
          huella: h,
          rol: 'estudiante',
          creada: new Date().toISOString()
        };
        cuentas.push(cuenta);
        global.CCAlmacen.guardar(CLAVE_CUENTAS, cuentas);
        return {
          usuario: {
            id: cuenta.id,
            nombre: cuenta.nombre,
            correo: cuenta.correo,
            matricula: cuenta.matricula,
            partes: cuenta.partes,
            rol: cuenta.rol
          }
        };
      });
    },

    listarExpedientes: function (filtro) {
      var lista = this.expedientes();
      if (filtro && filtro.alumnoId) {
        lista = lista.filter(function (r) { return r.alumno_id === filtro.alumnoId; });
      }
      lista.sort(function (a, b) { return (b.actualizado || '').localeCompare(a.actualizado || ''); });
      return Promise.resolve(lista);
    },

    guardarExpediente: function (registro) {
      var lista = this.expedientes();
      var ahora = new Date().toISOString();
      var copia = Object.assign({}, registro);

      // Un expediente por alumno: si ya tiene uno, se actualiza ese.
      if (!copia.id && copia.alumno_id) {
        var previo = lista.filter(function (r) { return r.alumno_id === copia.alumno_id; })[0];
        if (previo) copia.id = previo.id;
      }

      if (copia.id) {
        var i = lista.findIndex(function (r) { return r.id === copia.id; });
        if (i === -1) return Promise.reject(fallo('SERVIDOR', 'El expediente ya no existe.'));
        copia.creado = lista[i].creado;
        copia.actualizado = ahora;
        lista[i] = copia;
      } else {
        copia.id = global.CCAlmacen.id();
        copia.creado = ahora;
        copia.actualizado = ahora;
        lista.push(copia);
      }

      var ok = global.CCAlmacen.guardar(CLAVE_EXPEDIENTES, lista);
      if (!ok) {
        return Promise.reject(fallo('SERVIDOR',
          'No cupo en el navegador. Quita algunas fotografías o cambia el sistema a modo en línea.'));
      }
      return Promise.resolve(copia);
    },

    borrarExpediente: function (id) {
      var lista = this.expedientes().filter(function (r) { return r.id !== id; });
      global.CCAlmacen.guardar(CLAVE_EXPEDIENTES, lista);
      return Promise.resolve(true);
    },

    cerrarSesion: function () { return Promise.resolve(); }
  };

  /* ======================================================================
     Adaptador Supabase
     ====================================================================== */

  /* El resto del sistema trabaja con un objeto plano. En Postgres se guardan
     como columnas solo los datos por los que se busca o se ordena; el resto
     viaja en una columna jsonb, así agregar campos al formulario no obliga a
     migrar la tabla. */
  var COLUMNAS = ['id', 'alumno_id', 'alumno_nombre', 'alumno_correo',
                  'estado', 'creado', 'actualizado'];

  function aFila(plano) {
    var fila = { datos: {}, fotos: plano.fotos || [] };
    Object.keys(plano).forEach(function (k) {
      if (k === 'fotos') return;
      if (COLUMNAS.indexOf(k) !== -1) fila[k] = plano[k];
      else fila.datos[k] = plano[k];
    });
    if (!fila.id) delete fila.id;
    return fila;
  }

  function aPlano(fila) {
    if (!fila) return fila;
    var plano = Object.assign({}, fila.datos || {});
    COLUMNAS.forEach(function (k) { if (fila[k] !== undefined) plano[k] = fila[k]; });
    plano.fotos = fila.fotos || [];
    return plano;
  }

  var Nube = {
    cliente: null,

    iniciar: function () {
      if (this.cliente) return Promise.resolve();
      if (!global.supabase || !CFG.supabase.url || !CFG.supabase.anonKey) {
        return Promise.reject(fallo('SERVIDOR',
          'Falta configurar Supabase en assets/js/config.js.'));
      }
      this.cliente = global.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
      return Promise.resolve();
    },

    _perfil: function (sesion) {
      var cliente = this.cliente;
      return cliente.from('perfiles').select('nombre, rol, matricula, partes').eq('id', sesion.user.id).single()
        .then(function (r) {
          var perfil = r.data || {};
          return {
            usuario: {
              id: sesion.user.id,
              correo: sesion.user.email,
              nombre: perfil.nombre || sesion.user.email,
              matricula: perfil.matricula || '',
              partes: perfil.partes || null,
              rol: perfil.rol || 'estudiante'
            },
            token: sesion.access_token
          };
        });
    },

    iniciarSesion: function (datos) {
      var self = this;
      var correo = esAdmin(datos.correo)
        ? normaliza((CFG.administrador || {}).correo)
        : normaliza(datos.correo);

      return this.iniciar().then(function () {
        return self.cliente.auth.signInWithPassword({ email: correo, password: datos.contrasena });
      }).then(function (r) {
        if (r.error) throw fallo('CREDENCIALES', null, 'contrasena');
        return self._perfil(r.data.session);
      });
    },

    registrar: function (datos) {
      var self = this;
      var correo = normaliza(datos.correo);

      return this.iniciar().then(function () {
        return self.cliente.auth.signUp({
          email: correo,
          password: datos.contrasena,
          options: {
            data: {
              nombre: String(datos.nombre || '').trim(),
              matricula: String(datos.matricula || '').trim(),
              partes: datos.partes || null
            }
          }
        });
      }).then(function (r) {
        if (r.error) {
          var texto = String(r.error.message || '').toLowerCase();
          if (texto.indexOf('already') !== -1 || texto.indexOf('registered') !== -1) {
            throw fallo('CORREO_OCUPADO', null, 'correo');
          }
          throw fallo('SERVIDOR', r.error.message);
        }
        return {
          usuario: {
            id: r.data.user ? r.data.user.id : null,
            nombre: String(datos.nombre || '').trim(),
            matricula: String(datos.matricula || '').trim(),
            partes: datos.partes || null,
            correo: correo,
            rol: 'estudiante'
          }
        };
      });
    },

    listarExpedientes: function (filtro) {
      var self = this;
      return this.iniciar().then(function () {
        var consulta = self.cliente.from('expedientes').select('*').order('actualizado', { ascending: false });
        if (filtro && filtro.alumnoId) consulta = consulta.eq('alumno_id', filtro.alumnoId);
        return consulta;
      }).then(function (r) {
        if (r.error) throw fallo('SERVIDOR', r.error.message);
        return (r.data || []).map(aPlano);
      });
    },

    guardarExpediente: function (registro) {
      var self = this;
      var fila = aFila(registro);
      fila.actualizado = new Date().toISOString();
      if (!fila.creado) fila.creado = fila.actualizado;

      return this.iniciar().then(function () {
        return self.cliente.from('expedientes')
          .upsert(fila, { onConflict: fila.id ? 'id' : 'alumno_id' }).select().single();
      }).then(function (r) {
        if (r.error) throw fallo('SERVIDOR', r.error.message);
        return aPlano(r.data);
      });
    },

    borrarExpediente: function (id) {
      var self = this;
      return this.iniciar().then(function () {
        return self.cliente.from('expedientes').delete().eq('id', id);
      }).then(function (r) {
        if (r.error) throw fallo('SERVIDOR', r.error.message);
        return true;
      });
    },

    cerrarSesion: function () {
      var self = this;
      return this.iniciar().then(function () { return self.cliente.auth.signOut(); })
        .catch(function () { return true; });
    }
  };

  /* ======================================================================
     Fachada
     ====================================================================== */

  var adaptador = CFG.modo === 'supabase' ? Nube : Local;

  var Datos = {
    modo: CFG.modo === 'supabase' ? 'supabase' : 'local',
    MENSAJES: MENSAJES,

    iniciar: function () { return adaptador.iniciar(); },
    iniciarSesion: function (d) { return adaptador.iniciarSesion(d); },
    registrar: function (d) { return adaptador.registrar(d); },
    listarExpedientes: function (f) { return adaptador.listarExpedientes(f); },
    guardarExpediente: function (r) { return adaptador.guardarExpediente(r); },
    borrarExpediente: function (id) { return adaptador.borrarExpediente(id); },
    cerrarSesion: function () { return adaptador.cerrarSesion(); }
  };

  global.CCDatos = Datos;
})(window);
