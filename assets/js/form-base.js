/* ==========================================================================
   form-base.js — Cimiento común de los formularios de acceso y registro
   --------------------------------------------------------------------------
   Evita duplicar en dos archivos el mapeo de campos, el marcado de errores,
   el estado de carga, el aviso de Bloq Mayús y todo el diálogo con el avatar.
   LoginForm y SignupForm se montan encima de este objeto.

   Convención de marcado que espera:
     <div class="cc-campo" data-grupo="correo">
       <input data-campo="correo">
       <p data-nota="correo"></p>
     </div>
   ========================================================================== */

(function (global) {
  'use strict';

  var RE_CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  /* --- Validaciones puras, reutilizables --------------------------------- */

  var Validacion = {
    esCorreo: function (valor) {
      return RE_CORREO.test(String(valor).trim());
    },

    /**
     * Regla del plantel: la contraseña del alumno es de exactamente
     * 8 caracteres alfanuméricos, con al menos una letra y un número.
     */
    RE_CLAVE: /^[A-Za-z0-9]{8}$/,
    LARGO_CLAVE: 8,

    /** Devuelve el texto del error, o null si la contraseña es válida. */
    revisarClave: function (valor) {
      var v = String(valor || '');
      if (!v) return 'Crea tu contraseña.';
      if (/[^A-Za-z0-9]/.test(v)) return 'Solo letras y números, sin espacios ni signos.';
      if (v.length !== 8) return 'Debe tener exactamente 8 caracteres (llevas ' + v.length + ').';
      if (!/[A-Za-z]/.test(v) || /^\d+$/.test(v)) return 'Combina al menos una letra y un número.';
      if (!/\d/.test(v)) return 'Combina al menos una letra y un número.';
      return null;
    },

    /** Fuerza de 0 a 4, medida dentro de la regla de 8 alfanuméricos. */
    fuerza: function (valor) {
      var v = String(valor || '');
      if (!v) return 0;
      var puntos = 0;
      if (v.length === 8 && /^[A-Za-z0-9]+$/.test(v)) puntos++;
      if (/[A-Za-z]/.test(v) && /\d/.test(v)) puntos++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) puntos++;
      if (!/(.)\1\1/.test(v) && !/(012|123|234|345|456|567|678|789|abc|xyz)/i.test(v)) puntos++;
      return Math.min(puntos, 4);
    },

    ETIQUETAS_FUERZA: ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy buena']
  };

  /* --- Métodos compartidos ------------------------------------------------ */

  var FormBase = {

    /** Arranque común. Cada formulario lo llama desde su constructor. */
    _base: function (form, opciones) {
      this.form = typeof form === 'string' ? document.querySelector(form) : form;
      if (!this.form) throw new Error('Formulario no encontrado.');

      this.opts = opciones || {};
      this.avatar = this.opts.avatar || null;
      this.auth = this.opts.auth || null;

      this.foco = null;
      this.clicEnMostrar = false;
      this.enviando = false;

      this._mapearCampos();

      var q = this.form.querySelector.bind(this.form);
      this.el = {
        mensaje: q('[data-mensaje]'),
        boton: q('[data-accion="entrar"], [data-accion="registrar"]'),
        textoBoton: q('[data-texto-boton]')
      };
    },

    /** Descubre los campos por sus atributos data-*, sin listas a mano. */
    _mapearCampos: function () {
      var campos = {};
      var grupos = this.form.querySelectorAll('[data-grupo]');

      Array.prototype.forEach.call(grupos, function (grupo) {
        var clave = grupo.getAttribute('data-grupo');
        campos[clave] = {
          grupo: grupo,
          input: grupo.querySelector('[data-campo]'),
          nota: grupo.querySelector('[data-nota]')
        };
      });

      this.campos = campos;
    },

    valor: function (clave) {
      var c = this.campos[clave];
      return c && c.input ? c.input.value : '';
    },

    /* --- Errores y mensajes ---------------------------------------------- */

    _marcar: function (clave, texto) {
      var c = this.campos[clave];
      if (!c) return;

      if (texto) {
        c.grupo.setAttribute('data-estado', 'error');
        c.input.setAttribute('aria-invalid', 'true');
        c.nota.textContent = texto;
      } else {
        c.grupo.removeAttribute('data-estado');
        c.input.removeAttribute('aria-invalid');
        c.nota.textContent = '';
      }
    },

    _limpiarTodo: function () {
      var self = this;
      Object.keys(this.campos).forEach(function (k) { self._marcar(k, ''); });
      this._mensaje('', null);
    },

    _mensaje: function (texto, tipo) {
      if (!this.el.mensaje) return;
      this.el.mensaje.textContent = texto || '';
      if (tipo) this.el.mensaje.setAttribute('data-tipo', tipo);
      else this.el.mensaje.removeAttribute('data-tipo');
    },

    _cargando: function (activo, textoActivo, textoReposo) {
      this.enviando = activo;
      this.el.boton.disabled = activo;
      this.el.boton.setAttribute('data-cargando', activo ? 'true' : 'false');
      this.el.textoBoton.textContent = activo ? textoActivo : textoReposo;
    },

    /**
     * Corre una lista de validaciones [clave, fn]. Devuelve la primera clave
     * con error, o null si todo está bien. Marca todos los campos.
     */
    _revisar: function (reglas) {
      var self = this;
      var primerError = null;

      reglas.forEach(function (regla) {
        var texto = regla[1]();
        self._marcar(regla[0], texto || '');
        if (texto && !primerError) primerError = regla[0];
      });

      return primerError;
    },

    /* --- Enlace con el avatar -------------------------------------------- */

    /** Campo de texto visible: el avatar sigue el cursor. */
    _vigilarTexto: function (clave) {
      var self = this;
      var input = this.campos[clave].input;

      function seguir() {
        if (!self.avatar) return;
        self.avatar.seguirCursor(input);
        self.avatar.actualizarBoca(input.value);
      }

      input.addEventListener('focus', function () { self.foco = clave; seguir(); });
      input.addEventListener('click', seguir);
      input.addEventListener('input', function () {
        self._marcar(clave, '');
        self._mensaje('', null);
        seguir();
      });
      input.addEventListener('keyup', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) !== -1) seguir();
      });
      input.addEventListener('blur', function () {
        self.foco = null;
        setTimeout(function () {
          if (self.foco) return;
          if (self.avatar) self.avatar.reposar();
        }, 100);
      });
    },

    /** Campo de contraseña: el avatar se tapa los ojos. */
    _vigilarClave: function (clave, opciones) {
      var self = this;
      var conf = opciones || {};
      var input = this.campos[clave].input;
      var aviso = this.campos[clave].grupo.querySelector('[data-aviso="mayus"]');

      input.addEventListener('focus', function () {
        self.foco = clave;
        if (self.avatar) self.avatar.taparOjos();
      });
      input.addEventListener('input', function () {
        self._marcar(clave, '');
        self._mensaje('', null);
        if (conf.alEscribir) conf.alEscribir(input.value);
      });
      input.addEventListener('blur', function () {
        self.foco = null;
        if (aviso) aviso.setAttribute('data-visible', 'false');
        setTimeout(function () { self._quizasDestapar(); }, 100);
      });

      function mayus(e) {
        if (!aviso || typeof e.getModifierState !== 'function') return;
        aviso.setAttribute('data-visible', e.getModifierState('CapsLock') ? 'true' : 'false');
      }
      input.addEventListener('keydown', mayus);
      input.addEventListener('keyup', mayus);
    },

    /** Casilla "Mostrar": separa los dedos del avatar y cambia el type. */
    _vigilarMostrar: function (clave) {
      var self = this;
      var grupo = this.campos[clave].grupo;
      var input = this.campos[clave].input;
      var casilla = grupo.querySelector('[data-accion="mostrar"]');
      var etiqueta = grupo.querySelector('[data-etiqueta="mostrar"]');
      if (!casilla) return;

      casilla.addEventListener('focus', function () {
        self.foco = 'mostrar';
        if (self.avatar) self.avatar.taparOjos();
      });
      casilla.addEventListener('blur', function () {
        self.foco = null;
        if (!self.clicEnMostrar) setTimeout(function () { self._quizasDestapar(); }, 100);
      });
      casilla.addEventListener('change', function (e) {
        input.type = e.target.checked ? 'text' : 'password';
        if (!self.avatar) return;
        if (e.target.checked) self.avatar.abrirDedos();
        else self.avatar.cerrarDedos();
      });

      if (etiqueta) {
        etiqueta.addEventListener('pointerdown', function () { self.clicEnMostrar = true; });
        etiqueta.addEventListener('pointerup', function () { self.clicEnMostrar = false; });
      }
    },

    _quizasDestapar: function () {
      if (this.foco && this.foco !== 'correo' && this.foco !== 'nombre') return;
      if (this.avatar) this.avatar.destaparOjos();
    },

    /** Devuelve el avatar y los campos al estado inicial. */
    _reposar: function () {
      if (!this.avatar) return;
      this.avatar.reposar();
      this.avatar.destaparOjos();
      this.avatar.actualizarBoca('');
    },

    /** Muestra un mensaje en el formulario desde fuera del módulo. */
    mostrarMensaje: function (texto, tipo) {
      this._mensaje(texto, tipo);
    },

    _emitir: function (nombre, detalle) {
      this.form.dispatchEvent(new CustomEvent(nombre, { bubbles: true, detail: detalle }));
    }
  };

  global.CCValidacion = Validacion;
  global.CCFormBase = FormBase;
})(window);
