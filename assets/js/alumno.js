/* ==========================================================================
   alumno.js — Panel del alumno
   Un solo expediente por alumno, que se va completando durante el semestre.
   ========================================================================== */

CCPantalla('alumno', function () {
  'use strict';

  var usuario = CCSesion.exigir('estudiante');
  if (!usuario) return;

  var raiz = CCRaiz('alumno');
  var $ = function (sel) { return raiz.querySelector(sel); };

  $('[data-nombre-sesion]').textContent = usuario.nombre;
  $('[data-plantel]').textContent = 'Plantel ' + (CC_CONFIG.plantel || '');

  var mensaje = $('[data-mensaje]');
  var boton = $('[data-accion="guardar"]');
  var textoBoton = $('[data-texto-boton]');
  var vistaDocs = $('[data-documentos]');

  var expediente = null;   // lo que hay guardado en la base

  var formulario = new FormPracticas($('[data-formulario-practicas]'), {
    usuario: usuario,
    rol: 'estudiante',
    borradorClave: 'cc:borrador:' + usuario.id
  });

  /* --- Pestañas ----------------------------------------------------------- */

  var pestanas = raiz.querySelectorAll('[data-pestana]');
  function mostrarVista(nombre) {
    Array.prototype.forEach.call(pestanas, function (p) {
      p.setAttribute('aria-selected', String(p.getAttribute('data-pestana') === nombre));
    });
    raiz.querySelectorAll('[data-vista]').forEach(function (v) {
      v.hidden = v.getAttribute('data-vista') !== nombre;
    });
    if (nombre === 'documentos') pintarDocumentos();
  }
  Array.prototype.forEach.call(pestanas, function (p) {
    p.addEventListener('click', function () { mostrarVista(p.getAttribute('data-pestana')); });
  });

  /* --- Mensajes ----------------------------------------------------------- */

  function avisar(texto, tipo) {
    mensaje.textContent = texto || '';
    if (tipo) mensaje.setAttribute('data-tipo', tipo);
    else mensaje.removeAttribute('data-tipo');
    if (texto && mensaje.scrollIntoView) mensaje.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function cargando(activo) {
    boton.disabled = activo;
    boton.setAttribute('data-cargando', activo ? 'true' : 'false');
    textoBoton.textContent = activo ? 'Guardando' : 'Guardar expediente';
  }

  /* --- Carga inicial ------------------------------------------------------ */

  function cargarExpediente() {
    return CCDatos.listarExpedientes({ alumnoId: usuario.id }).then(function (lista) {
      expediente = lista[0] || null;

      if (expediente) {
        formulario.llenar(expediente);
        // Si hay un borrador más reciente que lo guardado, se prefiere.
        var borrador = CCAlmacen.leer('cc:borrador:' + usuario.id, null);
        if (borrador && borrador._momento && borrador._momento > (expediente.actualizado || '')) {
          formulario.llenar(Object.assign({}, expediente, borrador));
          avisar('Recuperamos cambios que no habías guardado.', 'aviso');
        }
      } else if (formulario.recuperarBorrador()) {
        avisar('Recuperamos lo que habías escrito la vez pasada.', 'aviso');
      }

      formulario.precargarDeCuenta(usuario);
      pintarEstado();
    }).catch(function (err) {
      avisar(err.message, 'error');
    });
  }

  function pintarEstado() {
    var caja = $('[data-estado-expediente]');
    if (!caja) return;
    if (!expediente) {
      caja.innerHTML = '<span class="cc-etiqueta" data-tipo="en_captura">Sin guardar todavía</span>';
      return;
    }
    caja.innerHTML = '<span class="cc-etiqueta" data-tipo="' + (expediente.estado || 'entregado') + '">' +
      CCDocumento.estadoTexto(expediente) + '</span>' +
      ' <span class="cc-ayuda" style="display:inline">Última actualización: ' +
      CCDocumento.fecha(expediente.actualizado) + '</span>';
  }

  /* --- Guardar ------------------------------------------------------------ */

  $('[data-formulario-envoltura]').addEventListener('submit', function (e) {
    e.preventDefault();

    var error = formulario.validar();
    if (error) {
      avisar('Faltan datos por completar. Revisa lo marcado en rojo.', 'error');
      formulario.enfocar(error);
      return;
    }

    // Se conserva lo que el alumno no ve (estado, observaciones, fechas de
    // oficios) y encima van sus cambios.
    var registro = Object.assign({}, expediente || {}, formulario.leer());
    registro.alumno_id = usuario.id;
    registro.alumno_nombre = usuario.nombre;
    registro.alumno_correo = usuario.correo;
    if (!registro.estado || registro.estado === 'en_captura') registro.estado = 'entregado';

    avisar('', null);
    cargando(true);

    CCDatos.guardarExpediente(registro).then(function (guardado) {
      cargando(false);
      expediente = guardado;
      formulario.registroId = guardado.id;
      formulario.borrarBorrador();
      pintarEstado();
      avisar('Expediente guardado. En "Mis documentos" puedes descargar el paquete de anexos.', 'exito');
    }).catch(function (err) {
      cargando(false);
      avisar(err.message, 'error');
    });
  });

  /* --- Documentos --------------------------------------------------------- */

  function pintarDocumentos() {
    if (!expediente) {
      vistaDocs.innerHTML = '<div class="cc-vacio"><strong>Todavía no has guardado tu expediente</strong>' +
        '<p>Complétalo y guárdalo en la pestaña anterior; aquí aparecerán tus documentos.</p></div>';
      return;
    }

    var n = CCDocumento.reportesLlenos(expediente);
    var obs = expediente.observaciones ? '<div class="cc-mensaje" data-tipo="aviso"><strong>Observaciones del plantel:</strong><br>' +
      escapar(expediente.observaciones) + '</div>' : '';

    vistaDocs.innerHTML =
      obs +
      '<div class="cc-cifras">' +
        '<div class="cc-cifra"><b>' + n + ' de 3</b><span>reportes llenados</span></div>' +
        '<div class="cc-cifra"><b>' + (expediente.fotos || []).length + '</b><span>fotografías</span></div>' +
        '<div class="cc-cifra"><b>' + (expediente.proy_titulo ? 'Sí' : 'No') + '</b><span>proyecto redactado</span></div>' +
      '</div>' +
      '<div class="cc-tabla-caja"><table class="cc-tabla"><thead><tr><th>Documento</th><th>Contenido</th><th>Descarga</th></tr></thead><tbody>' +
        '<tr><td data-titulo="Documento"><strong>Paquete de anexos</strong></td>' +
          '<td data-titulo="Contenido">Solicitud, oficios de presentación y aceptación, ' +
          (n ? n + ' reporte' + (n > 1 ? 's' : '') : 'formato de reporte') +
          ', constancia, liberación, carta y proyecto. Es el formato oficial del plantel, ya con tus datos.</td>' +
          '<td><button type="button" class="cc-boton cc-boton--chico" data-descargar="paquete">Word (.docx)</button></td></tr>' +
        '<tr><td data-titulo="Documento"><strong>Anexo fotográfico</strong></td>' +
          '<td data-titulo="Contenido">Tus evidencias en un documento aparte, para adjuntar al paquete.</td>' +
          '<td><button type="button" class="cc-boton cc-boton--chico cc-boton--fantasma" data-descargar="fotos"' +
          ((expediente.fotos || []).length ? '' : ' disabled') + '>Word (.doc)</button></td></tr>' +
      '</tbody></table></div>';

    vistaDocs.querySelector('[data-descargar="paquete"]').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      CCDocumento.paquete(expediente).catch(function (err) { avisar(err.message, 'error'); })
        .then(function () { b.disabled = false; });
    });
    vistaDocs.querySelector('[data-descargar="fotos"]').addEventListener('click', function () {
      CCDocumento.anexoFotos(expediente);
    });
  }

  function escapar(t) {
    return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* --- Salir -------------------------------------------------------------- */

  $('[data-accion="salir"]').addEventListener('click', function () {
    formulario.guardarBorrador();
    CCDatos.cerrarSesion().then(function () {
      CCSesion.cerrar();
      CCRuta.ir('acceso', true);
    });
  });

  mostrarVista('captura');
  cargarExpediente();
});
