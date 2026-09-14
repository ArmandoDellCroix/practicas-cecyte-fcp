/* ==========================================================================
   login-form.js — Formulario de acceso
   Monta la validación y el envío sobre CCFormBase.
   ========================================================================== */

(function (global) {
  'use strict';

  function LoginForm(form, opciones) {
    this._base(form, opciones);

    this._vigilarTexto('correo');
    this._vigilarClave('contrasena');
    this._vigilarMostrar('contrasena');

    var self = this;
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.enviar();
    });
  }

  LoginForm.prototype = Object.assign({}, global.CCFormBase, {

    constructor: LoginForm,

    _reglas: function () {
      var self = this;
      var V = global.CCValidacion;

      return [
        ['correo', function () {
          var v = self.valor('correo').trim();
          if (!v) return 'Escribe tu correo o tu usuario.';
          // El administrador entra con usuario (Root32); los alumnos con correo.
          if (v.indexOf('@') === -1) {
            if (v.length < 4) return 'Ese usuario es demasiado corto.';
            return null;
          }
          if (!V.esCorreo(v)) return 'Ese correo está incompleto. Debe verse como nombre@dominio.mx';
          return null;
        }],
        ['contrasena', function () {
          if (!self.valor('contrasena')) return 'Escribe tu contraseña.';
          return null;
        }]
      ];
    },

    enviar: function () {
      if (this.enviando) return;

      var error = this._revisar(this._reglas());
      if (error) {
        this.campos[error].input.focus();
        if (this.avatar) this.avatar.reaccionar('error');
        return;
      }

      if (!this.auth) {
        this._mensaje('No hay un servicio de autenticación conectado.', 'error');
        return;
      }

      var self = this;
      this._mensaje('', null);
      this._cargando(true, 'Entrando', 'Entrar');

      this.auth.iniciarSesion({
        correo: this.valor('correo').trim(),
        contrasena: this.valor('contrasena')
      }).then(function (resultado) {
        self._cargando(false, 'Entrando', 'Entrar');
        self._mensaje('Listo, ' + resultado.usuario.nombre + '. Entrando al portal.', 'exito');

        if (self.avatar) {
          self.avatar.detenerParpadeo();
          self.avatar.destaparOjos();
          self.avatar.reaccionar('exito');
        }

        self._emitir('cc:acceso', { usuario: resultado.usuario, token: resultado.token });
        if (typeof self.opts.alEntrar === 'function') {
          self.opts.alEntrar(resultado.usuario, resultado.token);
        }
      }).catch(function (error) {
        self._cargando(false, 'Entrando', 'Entrar');
        self._mensaje(error.message, 'error');
        if (error.campo) self._marcar(error.campo, ' ');
        if (self.avatar) self.avatar.reaccionar('error');

        var destino = self.campos[error.campo] || self.campos.contrasena;
        destino.input.focus();
        if (destino.input.select) destino.input.select();

        self._emitir('cc:acceso-fallido', { codigo: error.codigo, mensaje: error.message });
      });
    },

    /** Deja escrito un correo (se usa al volver desde el registro). */
    precargarCorreo: function (correo) {
      this.campos.correo.input.value = correo || '';
      this._marcar('correo', '');
    },

    reiniciar: function () {
      this.form.reset();
      this._limpiarTodo();
      this._cargando(false, 'Entrando', 'Entrar');
      this.campos.contrasena.input.type = 'password';
      this._reposar();
    }
  });

  global.LoginForm = LoginForm;
})(window);
