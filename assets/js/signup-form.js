/* ==========================================================================
   signup-form.js — Alta de cuenta del alumno
   El nombre se captura en tres campos desde el registro: así los documentos
   que genera el sistema salen con el nombre exacto y el alumno no lo vuelve
   a teclear en cada reporte.
   ========================================================================== */

(function (global) {
  'use strict';

  function SignupForm(form, opciones) {
    this._base(form, opciones);

    this.el.fuerza = this.form.querySelector('[data-fuerza]');
    this.el.fuerzaTexto = this.form.querySelector('[data-fuerza-texto]');
    this.el.aviso = this.form.querySelector('[data-accion="aviso"]');
    this.el.notaAviso = this.form.querySelector('[data-nota="aviso"]');

    var self = this;

    ['ape_paterno', 'ape_materno', 'nombres', 'matricula', 'correo'].forEach(function (c) {
      if (self.campos[c]) self._vigilarTexto(c);
    });

    this._vigilarClave('contrasena', {
      alEscribir: function (valor) { self._pintarFuerza(valor); }
    });
    this._vigilarClave('confirmar');
    this._vigilarMostrar('contrasena');

    if (this.el.aviso) {
      this.el.aviso.addEventListener('change', function () {
        if (self.el.notaAviso) self.el.notaAviso.textContent = '';
      });
    }

    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.enviar();
    });
  }

  SignupForm.prototype = Object.assign({}, global.CCFormBase, {

    constructor: SignupForm,

    _pintarFuerza: function (valor) {
      if (!this.el.fuerza) return;
      var V = global.CCValidacion;

      if (!valor) {
        this.el.fuerza.setAttribute('data-nivel', '');
        this.el.fuerzaTexto.textContent = '';
        return;
      }
      var nivel = V.fuerza(valor);
      this.el.fuerza.setAttribute('data-nivel', String(nivel));
      this.el.fuerzaTexto.textContent = V.ETIQUETAS_FUERZA[nivel];
    },

    _reglas: function () {
      var self = this;
      var V = global.CCValidacion;

      function texto(clave, etiqueta) {
        return [clave, function () {
          var v = self.valor(clave).trim();
          if (!v) return 'Escribe ' + etiqueta + '.';
          if (v.length < 2) return 'Ese dato parece incompleto.';
          if (/[0-9]/.test(v)) return 'Los nombres no llevan números.';
          return null;
        }];
      }

      return [
        texto('ape_paterno', 'tu apellido paterno'),
        texto('ape_materno', 'tu apellido materno'),
        texto('nombres', 'tu nombre o nombres'),
        ['matricula', function () {
          var v = self.valor('matricula').trim();
          if (!v) return 'Escribe tu número de control escolar.';
          if (!/^[A-Za-z0-9-]{4,20}$/.test(v)) return 'Usa solo letras, números o guiones.';
          return null;
        }],
        ['correo', function () {
          var v = self.valor('correo').trim();
          if (!v) return 'Escribe tu correo.';
          if (!V.esCorreo(v)) return 'Ese correo está incompleto. Debe verse como nombre@dominio.mx';
          return null;
        }],
        ['contrasena', function () { return V.revisarClave(self.valor('contrasena')); }],
        ['confirmar', function () {
          var v = self.valor('confirmar');
          if (!v) return 'Repite la contraseña.';
          if (v !== self.valor('contrasena')) return 'Las dos contraseñas no coinciden.';
          return null;
        }]
      ];
    },

    _revisarAviso: function () {
      if (!this.el.aviso) return true;
      if (this.el.aviso.checked) {
        if (this.el.notaAviso) this.el.notaAviso.textContent = '';
        return true;
      }
      if (this.el.notaAviso) {
        this.el.notaAviso.textContent = 'Necesitas aceptar el aviso de privacidad para continuar.';
      }
      return false;
    },

    enviar: function () {
      if (this.enviando) return;

      var error = this._revisar(this._reglas());
      var avisoOk = this._revisarAviso();

      if (error || !avisoOk) {
        if (error) this.campos[error].input.focus();
        else this.el.aviso.focus();
        if (this.avatar) this.avatar.reaccionar('error');
        return;
      }

      var self = this;
      var partes = {
        ape_paterno: this.valor('ape_paterno').trim(),
        ape_materno: this.valor('ape_materno').trim(),
        nombres: this.valor('nombres').trim()
      };

      this._mensaje('', null);
      this._cargando(true, 'Creando cuenta', 'Crear cuenta');

      this.auth.registrar({
        nombre: partes.nombres + ' ' + partes.ape_paterno + ' ' + partes.ape_materno,
        partes: partes,
        matricula: this.valor('matricula').trim(),
        correo: this.valor('correo').trim(),
        contrasena: this.valor('contrasena')
      }).then(function (resultado) {
        self._cargando(false, 'Creando cuenta', 'Crear cuenta');
        self._mensaje('Cuenta creada. Ya puedes entrar con tu correo.', 'exito');
        if (self.avatar) self.avatar.reaccionar('exito');

        self._emitir('cc:registro', { usuario: resultado.usuario });
        if (typeof self.opts.alRegistrar === 'function') self.opts.alRegistrar(resultado.usuario);
      }).catch(function (err) {
        self._cargando(false, 'Creando cuenta', 'Crear cuenta');
        self._mensaje(err.message, 'error');
        if (err.campo && self.campos[err.campo]) {
          self._marcar(err.campo, ' ');
          self.campos[err.campo].input.focus();
        }
        if (self.avatar) self.avatar.reaccionar('error');
        self._emitir('cc:registro-fallido', { codigo: err.codigo, mensaje: err.message });
      });
    },

    reiniciar: function () {
      this.form.reset();
      this._limpiarTodo();
      this._pintarFuerza('');
      if (this.el.notaAviso) this.el.notaAviso.textContent = '';
      this._cargando(false, 'Creando cuenta', 'Crear cuenta');
      this.campos.contrasena.input.type = 'password';
      this._reposar();
    }
  });

  global.SignupForm = SignupForm;
})(window);
