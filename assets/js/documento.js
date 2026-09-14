/* ==========================================================================
   documento.js — Paquete de anexos en Word, anexo fotográfico y CSV
   --------------------------------------------------------------------------
   El paquete se produce a partir del formato oficial del plantel embebido en
   plantilla-docx.js: se abre el .docx en el navegador (es un ZIP), se
   sustituyen los tokens {{...}} dentro de word/document.xml y se vuelve a
   comprimir. El resultado es el mismo archivo del plantel, con los datos del
   alumno donde iban los corchetes: mismas tablas, mismos textos, misma
   tipografía. Se abre en Word, LibreOffice y Google Docs como un .docx
   normal y se edita sin restricciones.

   El bloque "Reportes mensuales y final" se repite una vez por cada reporte
   que el alumno haya llenado (1, 2 o 3). Si no hay ninguno, sale en blanco
   una sola vez, como en el formato original.
   ========================================================================== */

(function (global) {
  'use strict';

  var CFG = global.CC_CONFIG || {};
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* --- Ayudas de texto ---------------------------------------------------- */

  function partesFecha(iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3 || !p[0]) return null;
    return { dia: String(parseInt(p[2], 10)), mes: MESES[parseInt(p[1], 10) - 1] || '', anio: p[0] };
  }

  /** 19/09/2026 */
  function fecha(iso) {
    var f = partesFecha(iso);
    return f ? ('0' + f.dia).slice(-2) + '/' + ('0' + (MESES.indexOf(f.mes) + 1)).slice(-2) + '/' + f.anio : '';
  }

  /** 19 de septiembre de 2026 */
  function fechaLarga(iso) {
    var f = partesFecha(iso);
    return f ? f.dia + ' de ' + f.mes + ' de ' + f.anio : '';
  }

  function nombreCompleto(r) {
    return [r.nombres, r.ape_paterno, r.ape_materno].filter(Boolean).join(' ').trim();
  }

  function periodo(r) {
    if (r.fecha_inicio && r.fecha_termino) return 'Del ' + fecha(r.fecha_inicio) + ' al ' + fecha(r.fecha_termino);
    if (r.fecha_inicio) return 'A partir del ' + fecha(r.fecha_inicio);
    return 'Sin periodo';
  }

  /** Cuántos reportes tienen contenido (0 a 3). */
  function reportesLlenos(r) {
    return [1, 2, 3].filter(function (n) { return String(r['r' + n + '_actividades'] || '').trim(); }).length;
  }

  function estadoTexto(r) {
    return (global.CC_ESTADOS || {})[r.estado] || 'Pendiente de revisión';
  }

  function limpiarNombreArchivo(t) {
    return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  }

  function escaparXML(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --- Valores para los tokens de la plantilla ---------------------------- */

  var VACIO = '________';

  function tokens(r) {
    var v = {};
    var t = {
      plantel: CFG.plantel || '',
      clave_plantel: CFG.clavePlantel || '',
      director: (CFG.director && CFG.director.nombre) || '',
      director_cargo: (CFG.director && CFG.director.cargo) || '',
      nombre_alumno: nombreCompleto(r),
      horas: r.horas || CFG.horasPractica || 400,
      fecha_inicio: fechaLarga(r.fecha_inicio),
      fecha_termino: fechaLarga(r.fecha_termino),
      nota_reportes: '',
      nota_proyecto: ''
    };

    ['ape_paterno', 'ape_materno', 'nombres', 'edad', 'sexo', 'num_control', 'especialidad', 'semestre',
     'calle_alum', 'colonia_alum', 'cp_alum', 'municipio_alum', 'tel_alum',
     'nombre_empresa', 'giro_empresa', 'calle_empresa', 'colonia_empresa', 'cp_empresa',
     'municipio_empresa', 'tel_empresa', 'area_practicas', 'rep_nombre', 'rep_cargo', 'horario',
     'liberacion_actividades', 'proy_titulo', 'proy_introduccion', 'proy_planteamiento',
     'proy_palabras', 'proy_resumen', 'proy_empresa', 'proy_mision', 'proy_desarrollo'
    ].forEach(function (k) { t[k] = r[k] || ''; });

    // Fechas de los oficios: si administración no las fijó, se derivan.
    var fechas = {
      fecha_solicitud: r.fecha_solicitud,
      fecha_presentacion: r.fecha_presentacion || r.fecha_solicitud,
      fecha_aceptacion: r.fecha_aceptacion || r.fecha_inicio,
      fecha_terminacion: r.fecha_terminacion || r.fecha_termino,
      fecha_liberacion: r.fecha_liberacion || r.fecha_termino,
      fecha_agradecimiento: r.fecha_agradecimiento || r.fecha_termino
    };
    Object.keys(fechas).forEach(function (k) {
      var f = partesFecha(fechas[k]);
      t[k + '_dia'] = f ? f.dia : VACIO;
      t[k + '_mes'] = f ? f.mes : VACIO;
      t[k + '_anio'] = f ? f.anio : VACIO;
    });

    Object.keys(t).forEach(function (k) { v[k] = t[k]; });
    return v;
  }

  function tokensReporte(r, n) {
    var p = 'r' + n + '_';
    return {
      r_tipo: n === 3 ? 'Reporte Final' : 'Reporte ' + n,
      r_periodo_inicio: fechaLarga(r[p + 'inicio']),
      r_periodo_corte: fechaLarga(r[p + 'corte']),
      r_actividades: r[p + 'actividades'] || '',
      r_herramientas: r[p + 'herramientas'] || '',
      r_aprendizajes: r[p + 'aprendizajes'] || ''
    };
  }

  /* --- Sustitución dentro del XML de Word --------------------------------- */

  function sustituir(xml, valores) {
    return xml.replace(/\{\{(\w+)\}\}/g, function (todo, clave) {
      var valor = Object.prototype.hasOwnProperty.call(valores, clave) ? valores[clave] : '';
      var lineas = String(valor === null || valor === undefined ? '' : valor).split(/\r?\n/);
      // Un salto de línea en el texto se vuelve un <w:br/> dentro del mismo run.
      return lineas.map(escaparXML).join('</w:t><w:br/><w:t xml:space="preserve">');
    });
  }

  /** Devuelve {inicio, fin} del párrafo que contiene el texto. */
  function parrafoCon(xml, texto) {
    var i = xml.indexOf(texto);
    if (i === -1) return null;
    var inicio = xml.lastIndexOf('<w:p>', i);
    var inicio2 = xml.lastIndexOf('<w:p ', i);
    inicio = Math.max(inicio, inicio2);
    var fin = xml.indexOf('</w:p>', i) + '</w:p>'.length;
    return { inicio: inicio, fin: fin };
  }

  function rellenarXML(xml, r) {
    // Todo <w:t> conserva espacios: un valor que empiece o termine en espacio
    // no se recorta al abrirlo.
    xml = xml.replace(/<w:t>/g, '<w:t xml:space="preserve">');

    var base = tokens(r);

    var ini = parrafoCon(xml, '{{#reportes}}');
    var fin = parrafoCon(xml, '{{/reportes}}');
    if (ini && fin) {
      var bloque = xml.slice(ini.fin, fin.inicio);
      var llenos = [1, 2, 3].filter(function (n) { return String(r['r' + n + '_actividades'] || '').trim(); });
      if (!llenos.length) llenos = [1];

      var copias = llenos.map(function (n) {
        var valores = Object.assign({}, base, tokensReporte(r, n));
        if (!String(r['r' + n + '_actividades'] || '').trim()) {
          valores.r_tipo = 'Reporte 1 / Reporte 2 / Reporte Final';
        }
        return sustituir(bloque, valores);
      });

      xml = xml.slice(0, ini.inicio) + copias.join('') + xml.slice(fin.fin);
    }

    return sustituir(xml, base);
  }

  /* --- Descargas ----------------------------------------------------------- */

  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function base64ABytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /**
   * Genera el paquete de anexos como Blob .docx.
   * @returns {Promise<Blob>}
   */
  function armarPaquete(r) {
    if (!global.JSZip) return Promise.reject(new Error('No se cargó JSZip; revisa la conexión.'));
    if (!global.CC_PLANTILLA_DOCX) return Promise.reject(new Error('Falta la plantilla del formato oficial.'));

    return global.JSZip.loadAsync(base64ABytes(global.CC_PLANTILLA_DOCX)).then(function (zip) {
      return zip.file('word/document.xml').async('string').then(function (xml) {
        zip.file('word/document.xml', rellenarXML(xml, r));
        return zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          compression: 'DEFLATE'
        });
      });
    });
  }

  /* --- Anexo fotográfico (fuera del formato oficial) ---------------------- */

  function escaparHTML(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function armarAnexoFotos(r) {
    var fotos = r.fotos || [];
    var celdas = fotos.map(function (foto, i) {
      return '<td class="foto"><img src="' + foto.datos + '" width="300"><p class="pie">Evidencia ' + (i + 1) + '</p></td>';
    });
    var renglones = '';
    for (var i = 0; i < celdas.length; i += 2) {
      renglones += '<tr class="evitar">' + celdas[i] + (celdas[i + 1] || '<td></td>') + '</tr>';
    }

    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>Anexo fotográfico</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->' +
      '<style>' +
      '@page WordSection1 { size: 21.59cm 27.94cm; margin: 2.54cm; } div.WordSection1 { page: WordSection1; }' +
      'body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; }' +
      'h1 { font-size: 15pt; text-align: center; color: #34495e; margin: 0 0 4pt; }' +
      'p.sub { text-align: center; font-size: 9pt; color: #666; margin: 0 0 14pt; }' +
      'table { width: 100%; border-collapse: collapse; } td { width: 50%; padding: 6pt; text-align: center; vertical-align: top; }' +
      'img { max-width: 7.5cm; } p.pie { margin: 3pt 0 0; font-size: 8.5pt; color: #666; }' +
      '.evitar { page-break-inside: avoid; }' +
      '</style></head><body><div class="WordSection1">' +
      '<h1>ANEXO FOTOGRÁFICO - PRÁCTICAS PROFESIONALES</h1>' +
      '<p class="sub">' + escaparHTML(nombreCompleto(r)) + ' · No. de control ' + escaparHTML(r.num_control || '') +
        ' · ' + escaparHTML(r.nombre_empresa || '') + '</p>' +
      (renglones ? '<table><tbody>' + renglones + '</tbody></table>' : '<p>Sin fotografías adjuntas.</p>') +
      '</div></body></html>';
  }

  /* --- Interfaz pública ---------------------------------------------------- */

  var Documento = {

    nombreArchivo: function (r, sufijo, ext) {
      return ['Practicas', limpiarNombreArchivo(r.ape_paterno + '_' + r.nombres) || 'Alumno', sufijo]
        .filter(Boolean).join('_') + '.' + ext;
    },

    /** Paquete completo de anexos, en el formato oficial (.docx). */
    paquete: function (r) {
      var self = this;
      return armarPaquete(r).then(function (blob) {
        descargar(blob, self.nombreArchivo(r, 'Anexos', 'docx'));
      });
    },

    /** Fotografías como documento aparte (.doc). */
    anexoFotos: function (r) {
      var blob = new Blob(['\ufeff', armarAnexoFotos(r)], { type: 'application/msword' });
      descargar(blob, this.nombreArchivo(r, 'Fotografias', 'doc'));
    },

    /** Hoja de cálculo con los expedientes, sin fotografías. */
    csv: function (lista) {
      var columnas = ['ape_paterno', 'ape_materno', 'nombres', 'num_control', 'especialidad', 'semestre',
        'edad', 'sexo', 'tel_alum', 'nombre_empresa', 'giro_empresa', 'area_practicas', 'rep_nombre',
        'municipio_empresa', 'tel_empresa', 'fecha_inicio', 'fecha_termino', 'horario', 'horas',
        'reportes', 'estado', 'actualizado'];

      function celda(v) {
        return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
      }

      var texto = columnas.join(';') + '\r\n' + lista.map(function (r) {
        return columnas.map(function (c) {
          if (c === 'reportes') return celda(reportesLlenos(r) + ' de 3');
          if (c === 'estado') return celda(estadoTexto(r));
          if (c === 'actualizado' || c === 'fecha_inicio' || c === 'fecha_termino') return celda(fecha(r[c]));
          return celda(r[c]);
        }).join(';');
      }).join('\r\n');

      descargar(new Blob(['\ufeff', texto], { type: 'text/csv' }),
        'expedientes_' + new Date().toISOString().slice(0, 10) + '.csv');
    },

    // Para pruebas y para otros módulos
    rellenarXML: rellenarXML,
    tokens: tokens,
    fecha: fecha,
    fechaLarga: fechaLarga,
    nombreCompleto: nombreCompleto,
    periodo: periodo,
    reportesLlenos: reportesLlenos,
    estadoTexto: estadoTexto
  };

  global.CCDocumento = Documento;
})(window);
