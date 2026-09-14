/* ==========================================================================
   acceso.js — Arranque de index.html
   ========================================================================== */

CCPantalla('acceso', function () {
  'use strict';

  var raiz = CCRaiz('acceso');

  // Si ya hay sesión abierta, no tiene caso mostrar el acceso.
  var abierta = CCSesion.leer();
  if (abierta) { CCSesion.irASuPanel(abierta); return; }

  var avatar = new YetiAvatar(raiz.querySelector('[data-avatar]'));
  var formAcceso = raiz.querySelector('[data-formulario="acceso"]');
  var formRegistro = raiz.querySelector('[data-formulario="registro"]');

  // Ningún dato del último usuario debe quedar visible: ni al recargar la
  // página (algunos navegadores restauran lo escrito) ni al regresar con el
  // botón "atrás" (la página vuelve desde caché con los campos llenos).
  function limpiarAcceso() {
    formAcceso.reset();
    formRegistro.reset();
    if (window.ccAcceso) {
      window.ccAcceso.acceso.reiniciar();
      window.ccAcceso.registro.reiniciar();
    }
  }
  limpiarAcceso();
  window.addEventListener('pageshow', function (e) { if (e.persisted) limpiarAcceso(); });

  var tarjeta;

  var acceso = new LoginForm(formAcceso, {
    avatar: avatar,
    auth: CCDatos,
    alEntrar: function (usuario) {
      var recordar = formAcceso.querySelector('[data-accion="recordar"]');
      CCSesion.guardar(usuario, !!(recordar && recordar.checked));
      setTimeout(function () { CCSesion.irASuPanel(usuario); }, 650);
    }
  });

  var registro = new SignupForm(formRegistro, {
    avatar: avatar,
    auth: CCDatos,
    alRegistrar: function (usuario) {
      acceso.precargarCorreo(usuario.correo);
      setTimeout(function () {
        tarjeta.mostrar('acceso');
        acceso.mostrarMensaje('Tu cuenta quedó lista. Escribe tu contraseña para entrar.', 'exito');
        registro.reiniciar();
      }, 1200);
    }
  });

  tarjeta = new AuthCard(raiz.querySelector('[data-tarjeta]'), {
    inicial: 'acceso',
    alVoltear: function (cara) {
      avatar.reposar();
      avatar.destaparOjos();
      avatar.actualizarBoca(cara === 'acceso' ? acceso.valor('correo') : '');
    }
  });

  // Aviso cuando el sistema corre sin base de datos en línea.
  if (CCDatos.modo === 'local') {
    var aviso = raiz.querySelector('[data-aviso-modo]');
    if (aviso) aviso.hidden = false;
  }

  window.ccAcceso = { avatar: avatar, acceso: acceso, registro: registro, tarjeta: tarjeta, limpiar: limpiarAcceso };
});
