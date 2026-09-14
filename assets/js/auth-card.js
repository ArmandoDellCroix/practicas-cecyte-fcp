/* ==========================================================================
   auth-card.js — Tarjeta de dos caras (acceso / registro)
   --------------------------------------------------------------------------
   Se encarga de tres cosas que suelen romperse en las tarjetas que voltean:

   1. Altura: las dos caras están superpuestas, así que el contenedor toma la
      altura de la cara visible y la anima. Un ResizeObserver la mantiene al
      día si el contenido crece (un mensaje de error, por ejemplo).
   2. Foco: la cara oculta recibe `inert`, de modo que no se puede llegar a
      ella con el tabulador ni la leen los lectores de pantalla.
   3. Continuidad: al voltear se avisa a quien lo pida, para poder arrastrar
      datos de una cara a otra (el correo recién registrado, por ejemplo).
   ========================================================================== */

(function (global) {
  'use strict';

  function AuthCard(raiz, opciones) {
    this.raiz = typeof raiz === 'string' ? document.querySelector(raiz) : raiz;
    if (!this.raiz) throw new Error('AuthCard: no se encontró la tarjeta.');

    this.opts = Object.assign({ inicial: 'acceso', alVoltear: null }, opciones || {});
    this.giro = this.raiz.querySelector('[data-giro]');
    this.caras = {};

    var self = this;
    Array.prototype.forEach.call(this.raiz.querySelectorAll('[data-cara]'), function (cara) {
      self.caras[cara.getAttribute('data-cara')] = cara;
    });

    this.actual = null;

    // botones que piden voltear: <button data-voltear="registro">
    Array.prototype.forEach.call(document.querySelectorAll('[data-voltear]'), function (boton) {
      boton.addEventListener('click', function () {
        self.mostrar(boton.getAttribute('data-voltear'));
      });
    });

    // la altura se recalcula sola cuando cambia el contenido
    if (global.ResizeObserver) {
      this.observador = new ResizeObserver(function () { self._ajustarAlto(); });
      Object.keys(this.caras).forEach(function (k) {
        self.observador.observe(self.caras[k]);
      });
    } else {
      global.addEventListener('resize', function () { self._ajustarAlto(); });
    }

    this.mostrar(this.opts.inicial, { foco: false });
  }

  AuthCard.prototype.mostrar = function (nombre, opciones) {
    var conf = Object.assign({ foco: true }, opciones || {});
    if (!this.caras[nombre] || this.actual === nombre) return;

    var anterior = this.actual;
    this.actual = nombre;

    var self = this;
    Object.keys(this.caras).forEach(function (k) {
      var cara = self.caras[k];
      var oculta = k !== nombre;
      cara.inert = oculta;
      if (oculta) cara.setAttribute('aria-hidden', 'true');
      else cara.removeAttribute('aria-hidden');
    });

    this.giro.setAttribute('data-cara-visible', nombre);
    this._ajustarAlto();

    if (conf.foco) {
      var espera = this._sinMovimiento() ? 0 : 380;
      setTimeout(function () {
        var campo = self.caras[nombre].querySelector('input:not([type="checkbox"])');
        if (campo) campo.focus();
      }, espera);
    }

    if (anterior && typeof this.opts.alVoltear === 'function') {
      this.opts.alVoltear(nombre, anterior);
    }
    if (anterior) {
      this.raiz.dispatchEvent(new CustomEvent('cc:cara', {
        bubbles: true,
        detail: { cara: nombre, anterior: anterior }
      }));
    }
  };

  AuthCard.prototype.alternar = function () {
    this.mostrar(this.actual === 'acceso' ? 'registro' : 'acceso');
  };

  AuthCard.prototype._ajustarAlto = function () {
    var cara = this.caras[this.actual];
    if (!cara) return;
    this.raiz.style.height = cara.offsetHeight + 'px';
  };

  AuthCard.prototype._sinMovimiento = function () {
    return global.matchMedia &&
           global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  AuthCard.prototype.destruir = function () {
    if (this.observador) this.observador.disconnect();
  };

  global.AuthCard = AuthCard;
})(window);
