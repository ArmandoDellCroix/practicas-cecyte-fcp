/* ==========================================================================
   admin.js — Panel del administrador
   ========================================================================== */

CCPantalla('admin', function () {
  'use strict';

  var usuario = CCSesion.exigir('admin');
  if (!usuario) return;

  var raiz = CCRaiz('admin');
  var $ = function (sel) { return raiz.querySelector(sel); };

  $('[data-nombre-sesion]').textContent = CC_CONFIG.administrador.usuario;
  $('[data-plantel]').textContent = 'Plantel ' + (CC_CONFIG.plantel || '');

  var tabla = $('[data-tabla]');
  var cifras = $('[data-cifras]');
  var mensaje = $('[data-mensaje]');
  var dialogo = $('[data-dialogo]');
  var editor = null;

  var todos = [];
  var visibles = [];

  var filtro = {
    texto: $('[data-filtro="texto"]'),
    estado: $('[data-filtro="estado"]'),
    semestre: $('[data-filtro="semestre"]')
  };

  function avisar(texto, tipo) {
    mensaje.textContent = texto || '';
    if (tipo) mensaje.setAttribute('data-tipo', tipo);
    else mensaje.removeAttribute('data-tipo');
  }

  /* --- Carga y filtrado --------------------------------------------------- */

  function cargar() {
    tabla.innerHTML = '<p class="cc-ayuda">Consultando la base de datos…</p>';

    CCDatos.listarExpedientes().then(function (lista) {
      todos = lista;
      pintarCifras();
      aplicarFiltros();
    }).catch(function (err) {
      tabla.innerHTML = '';
      avisar(err.message, 'error');
    });
  }

  function pintarCifras() {
    var empresas = {};
    var pendientes = 0, aprobados = 0, finales = 0;

    todos.forEach(function (r) {
      if (r.nombre_empresa) empresas[r.nombre_empresa.toLowerCase()] = true;
      if (!r.estado || r.estado === 'entregado') pendientes++;
      if (r.estado === 'aprobado') aprobados++;
      if (CCDocumento.reportesLlenos(r) === 3) finales++;
    });

    cifras.innerHTML = [
      ['Expedientes', todos.length],
      ['Pendientes de revisar', pendientes],
      ['Con reporte final', finales],
      ['Aprobados', aprobados],
      ['Empresas', Object.keys(empresas).length]
    ].map(function (c) {
      return '<div class="cc-cifra"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>';
    }).join('');
  }

  function aplicarFiltros() {
    var texto = (filtro.texto.value || '').trim().toLowerCase();
    var estado = filtro.estado.value;
    var semestre = filtro.semestre.value;

    visibles = todos.filter(function (r) {
      if (estado && (r.estado || 'entregado') !== estado) return false;
      if (semestre && r.semestre !== semestre) return false;
      if (!texto) return true;
      return [r.alumno_nombre, CCDocumento.nombreCompleto(r), r.num_control,
              r.nombre_empresa, r.especialidad, r.rep_nombre]
        .filter(Boolean).join(' ').toLowerCase().indexOf(texto) !== -1;
    });

    pintarTabla();
  }

  Object.keys(filtro).forEach(function (k) {
    filtro[k].addEventListener('input', aplicarFiltros);
    filtro[k].addEventListener('change', aplicarFiltros);
  });

  /* --- Tabla -------------------------------------------------------------- */

  function pintarTabla() {
    if (!visibles.length) {
      tabla.innerHTML = '<div class="cc-vacio"><strong>Sin expedientes que mostrar</strong>' +
        '<p>' + (todos.length ? 'Prueba con otro filtro.' :
          'En cuanto los alumnos guarden su expediente aparecerá aquí.') + '</p></div>';
      return;
    }

    tabla.innerHTML = '<div class="cc-tabla-caja"><table class="cc-tabla"><thead><tr>' +
      '<th>Alumno</th><th>Control</th><th>Especialidad</th><th>Empresa</th>' +
      '<th>Periodo</th><th>Reportes</th><th>Estado</th><th>Acciones</th>' +
      '</tr></thead><tbody>' +
      visibles.map(function (r, i) {
        var n = CCDocumento.reportesLlenos(r);
        return '<tr>' +
          '<td data-titulo="Alumno"><strong>' + (CCDocumento.nombreCompleto(r) || r.alumno_nombre || '—') + '</strong></td>' +
          '<td data-titulo="Control">' + (r.num_control || '—') + '</td>' +
          '<td data-titulo="Especialidad">' + (r.especialidad || '—') + (r.semestre ? ' · ' + r.semestre : '') + '</td>' +
          '<td data-titulo="Empresa">' + (r.nombre_empresa || '—') + '</td>' +
          '<td data-titulo="Periodo">' + CCDocumento.periodo(r) + '</td>' +
          '<td data-titulo="Reportes">' + n + ' de 3</td>' +
          '<td data-titulo="Estado"><span class="cc-etiqueta" data-tipo="' + (r.estado || 'entregado') + '">' +
            CCDocumento.estadoTexto(r) + '</span></td>' +
          '<td><div class="cc-tabla__acciones">' +
            '<button type="button" class="cc-boton cc-boton--chico" data-word="' + i + '">Word</button>' +
            '<button type="button" class="cc-boton cc-boton--chico cc-boton--fantasma" data-fotos="' + i + '"' +
              ((r.fotos || []).length ? '' : ' disabled') + '>Fotos</button>' +
            '<button type="button" class="cc-boton cc-boton--chico cc-boton--fantasma" data-editar="' + i + '">Revisar</button>' +
            '<button type="button" class="cc-boton cc-boton--chico cc-boton--peligro" data-borrar="' + i + '">Borrar</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';

    tabla.querySelectorAll('[data-word]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        CCDocumento.paquete(visibles[+b.getAttribute('data-word')])
          .catch(function (err) { avisar(err.message, 'error'); })
          .then(function () { b.disabled = false; });
      });
    });
    tabla.querySelectorAll('[data-fotos]').forEach(function (b) {
      b.addEventListener('click', function () { CCDocumento.anexoFotos(visibles[+b.getAttribute('data-fotos')]); });
    });
    tabla.querySelectorAll('[data-editar]').forEach(function (b) {
      b.addEventListener('click', function () { abrirEditor(visibles[+b.getAttribute('data-editar')]); });
    });
    tabla.querySelectorAll('[data-borrar]').forEach(function (b) {
      b.addEventListener('click', function () { borrar(visibles[+b.getAttribute('data-borrar')]); });
    });
  }

  function borrar(registro) {
    var quien = CCDocumento.nombreCompleto(registro) || registro.alumno_nombre || 'este alumno';
    if (!confirm('¿Borrar el expediente de ' + quien + '? Se pierden sus reportes y fotografías. No se puede deshacer.')) return;

    CCDatos.borrarExpediente(registro.id).then(function () {
      avisar('Expediente eliminado.', 'exito');
      cargar();
    }).catch(function (err) { avisar(err.message, 'error'); });
  }

  /* --- Editor ------------------------------------------------------------- */

  // <dialog> es estándar, pero se guarda un respaldo por si el navegador
  // es antiguo: entonces se abre y cierra con el atributo "open".
  function abrirDialogo() {
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', 'open');
  }
  function cerrarDialogo() {
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  }

  function abrirEditor(registro) {
    if (!editor) {
      editor = new FormPracticas($('[data-editor]'), { rol: 'admin' });
      $('[data-accion="guardar-edicion"]').addEventListener('click', guardarEdicion);
      $('[data-accion="cerrar"]').addEventListener('click', cerrarDialogo);
    }

    editor.llenar(registro);
    editor._registroOriginal = registro;
    $('[data-editor-titulo]').textContent =
      CCDocumento.nombreCompleto(registro) || registro.alumno_nombre || 'Expediente';

    abrirDialogo();
  }

  function guardarEdicion() {
    var error = editor.validar();
    if (error) { editor.enfocar(error); return; }

    var registro = Object.assign({}, editor._registroOriginal, editor.leer());

    CCDatos.guardarExpediente(registro).then(function () {
      cerrarDialogo();
      avisar('Cambios guardados.', 'exito');
      cargar();
    }).catch(function (err) { avisar(err.message, 'error'); });
  }

  /* --- Descargas masivas --------------------------------------------------- */

  $('[data-accion="csv"]').addEventListener('click', function () {
    if (!visibles.length) { avisar('No hay expedientes que exportar.', 'aviso'); return; }
    CCDocumento.csv(visibles);
  });

  $('[data-accion="word-todos"]').addEventListener('click', function () {
    if (!visibles.length) { avisar('No hay expedientes que descargar.', 'aviso'); return; }
    if (visibles.length > 8 &&
        !confirm('Se descargarán ' + visibles.length + ' paquetes de Word, uno por alumno. ¿Continuar?')) return;

    // En serie, para no saturar el navegador.
    var cola = visibles.slice();
    avisar('Generando ' + cola.length + ' paquetes…', 'exito');
    (function siguiente() {
      var r = cola.shift();
      if (!r) { avisar('Listo: se descargaron todos los paquetes.', 'exito'); return; }
      CCDocumento.paquete(r).catch(function () {}).then(function () { setTimeout(siguiente, 400); });
    })();
  });

  $('[data-accion="recargar"]').addEventListener('click', cargar);

  $('[data-accion="salir"]').addEventListener('click', function () {
    CCDatos.cerrarSesion().then(function () {
      CCSesion.cerrar();
      CCRuta.ir('acceso', true);
    });
  });

  if (CCDatos.modo === 'local') {
    avisar('El sistema está en modo local: solo ves los expedientes capturados en este navegador. ' +
           'Configura Supabase para verlos todos desde cualquier dispositivo.', 'aviso');
  }

  cargar();
});
