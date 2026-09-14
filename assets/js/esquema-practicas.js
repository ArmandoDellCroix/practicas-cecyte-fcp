/* ==========================================================================
   esquema-practicas.js — Definición del expediente de prácticas
   --------------------------------------------------------------------------
   Sigue uno a uno los campos del formato oficial "Anexos - Prácticas
   Profesionales" del plantel. Cada alumno tiene UN expediente que va
   completando a lo largo del semestre; de él salen los ocho documentos del
   paquete (solicitud, oficios, tres reportes, constancia, liberación, carta
   y proyecto).

   De esta única definición se dibujan el formulario del alumno, el editor
   del administrador y se rellena el Word. Agregar un campo es agregar una
   línea aquí y, si debe salir en el Word, su token en la plantilla.

   tipo:      texto | tel | numero | fecha | lista | parrafo | hora | fotos
   ancho:     ocupa todo el renglón
   soloAdmin: la sección solo la ve y edita el administrador
   ========================================================================== */

(function (global) {
  'use strict';

  var TEL = { patron: /^[\d\s()+-]{10,15}$/, error: 'Escribe 10 dígitos, con o sin separadores.' };
  var CP  = { max: 5, modo: 'numeric', patron: /^\d{5}$/, error: 'El código postal lleva 5 dígitos.' };

  function reporte(n, titulo, ayuda) {
    var p = 'r' + n + '_';
    return {
      id: 'reporte' + n,
      titulo: titulo,
      ayuda: ayuda,
      campos: [
        { id: p + 'inicio', etiqueta: 'Periodo del informe, del', tipo: 'fecha' },
        { id: p + 'corte',  etiqueta: 'al (fecha de corte)', tipo: 'fecha' },
        { id: p + 'actividades', etiqueta: 'Actividades realizadas en este periodo', tipo: 'parrafo', ancho: true,
          ejemplo: 'Describe a detalle las actividades realizadas…' },
        { id: p + 'herramientas', etiqueta: 'Herramientas, maquinaria o metodologías utilizadas', tipo: 'parrafo', ancho: true },
        { id: p + 'aprendizajes', etiqueta: 'Aprendizajes o logros obtenidos', tipo: 'parrafo', ancho: true }
      ]
    };
  }

  global.CC_ESQUEMA_PRACTICAS = [
    {
      id: 'solicitante',
      titulo: 'Datos del solicitante',
      campos: [
        { id: 'ape_paterno', etiqueta: 'Apellido paterno', tipo: 'texto', req: true, max: 40 },
        { id: 'ape_materno', etiqueta: 'Apellido materno', tipo: 'texto', req: true, max: 40 },
        { id: 'nombres', etiqueta: 'Nombre(s)', tipo: 'texto', req: true, max: 60 },
        { id: 'edad', etiqueta: 'Edad', tipo: 'numero', req: true, min: 15, max: 60 },
        { id: 'sexo', etiqueta: 'Sexo', tipo: 'lista', req: true, opciones: ['Femenino', 'Masculino'] },
        { id: 'num_control', etiqueta: 'No. de control escolar', tipo: 'texto', req: true, max: 20 },
        {
          id: 'especialidad', etiqueta: 'Especialidad', tipo: 'texto', req: true, max: 80,
          ejemplo: 'Técnico en…',
          sugerencias: [
            'Técnico en Biotecnología', 'Técnico en Informática',
            'Técnico en Producción Industrial de Alimentos', 'Técnico en Electromecánica Industrial',
            'Técnico en Administración de Recursos Humanos', 'Técnico en Enfermería General'
          ]
        },
        { id: 'semestre', etiqueta: 'Semestre', tipo: 'lista', req: true, opciones: ['Tercero', 'Cuarto', 'Quinto', 'Sexto'] }
      ]
    },
    {
      id: 'domicilio',
      titulo: 'Domicilio del solicitante',
      campos: [
        { id: 'calle_alum', etiqueta: 'Calle y cruzamientos', tipo: 'texto', req: true, ancho: true, max: 120 },
        { id: 'colonia_alum', etiqueta: 'Colonia', tipo: 'texto', req: true, max: 80 },
        Object.assign({ id: 'cp_alum', etiqueta: 'Código postal', tipo: 'texto', req: true }, CP),
        { id: 'municipio_alum', etiqueta: 'Municipio', tipo: 'texto', req: true, max: 60, valor: 'Felipe Carrillo Puerto' },
        Object.assign({ id: 'tel_alum', etiqueta: 'Teléfono particular', tipo: 'tel', req: true, max: 15 }, TEL)
      ]
    },
    {
      id: 'empresa',
      titulo: 'Datos de la empresa o institución',
      campos: [
        { id: 'nombre_empresa', etiqueta: 'Nombre de la empresa', tipo: 'texto', req: true, ancho: true, max: 120 },
        { id: 'giro_empresa', etiqueta: 'Giro', tipo: 'lista', req: true, opciones: ['Comercial', 'Servicios', 'Industrial', 'Gubernamental'] },
        { id: 'area_practicas', etiqueta: 'Área o departamento de prácticas', tipo: 'texto', req: true, max: 80 },
        { id: 'calle_empresa', etiqueta: 'Calle', tipo: 'texto', req: true, ancho: true, max: 120 },
        { id: 'colonia_empresa', etiqueta: 'Colonia', tipo: 'texto', req: true, max: 80 },
        Object.assign({ id: 'cp_empresa', etiqueta: 'Código postal', tipo: 'texto', req: true }, CP),
        { id: 'municipio_empresa', etiqueta: 'Municipio', tipo: 'texto', req: true, max: 60 },
        Object.assign({ id: 'tel_empresa', etiqueta: 'Teléfono de la empresa', tipo: 'tel', req: true, max: 15 }, TEL),
        { id: 'fecha_solicitud', etiqueta: 'Fecha de solicitud', tipo: 'fecha', req: true }
      ]
    },
    {
      id: 'representante',
      titulo: 'Representante de la empresa',
      ayuda: 'Es quien firma los oficios de aceptación y terminación y el Vo. Bo. de los reportes.',
      campos: [
        { id: 'rep_nombre', etiqueta: 'Nombre completo', tipo: 'texto', req: true, max: 100 },
        { id: 'rep_cargo', etiqueta: 'Cargo en la empresa', tipo: 'texto', req: true, max: 80, ejemplo: 'Gerente de Recursos Humanos' }
      ]
    },
    {
      id: 'periodo',
      titulo: 'Periodo y horario de las prácticas',
      campos: [
        { id: 'fecha_inicio', etiqueta: 'Fecha de inicio', tipo: 'fecha', req: true },
        { id: 'fecha_termino', etiqueta: 'Fecha de término', tipo: 'fecha', req: true },
        { id: 'horario', etiqueta: 'Horario de entrada y salida', tipo: 'texto', req: true, max: 60, ejemplo: '8:00 a 13:00 horas, lunes a viernes' },
        { id: 'horas', etiqueta: 'Total de horas', tipo: 'numero', min: 1, max: 2000, valor: 400 }
      ]
    },

    reporte(1, 'Reporte mensual 1', 'Se llena al cerrar el primer mes. Si aún no toca, déjalo vacío.'),
    reporte(2, 'Reporte mensual 2', 'Se llena al cerrar el segundo mes.'),
    reporte(3, 'Reporte final', 'Se llena al concluir las prácticas.'),

    {
      id: 'cierre',
      titulo: 'Liberación de prácticas',
      ayuda: 'Resumen general que aparece en la carta de liberación.',
      campos: [
        { id: 'liberacion_actividades', etiqueta: 'Actividades realizadas (resumen general)', tipo: 'parrafo', ancho: true,
          ejemplo: 'Ej. Mantenimiento, procesos administrativos, atención a clientes…' }
      ]
    },
    {
      id: 'proyecto',
      titulo: 'Estructura del proyecto de prácticas',
      ayuda: 'Se redacta al final, enfocado a la empresa donde realizaste tus prácticas.',
      campos: [
        { id: 'proy_titulo', etiqueta: 'Título del proyecto', tipo: 'texto', ancho: true, max: 200 },
        { id: 'proy_introduccion', etiqueta: 'Introducción', tipo: 'parrafo', ancho: true,
          ejemplo: 'Introducción del trabajo que ofrece solución a un problema…' },
        { id: 'proy_planteamiento', etiqueta: 'Planteamiento del problema', tipo: 'parrafo', ancho: true,
          ejemplo: 'El problema actual en la empresa o área…' },
        { id: 'proy_palabras', etiqueta: 'Palabras clave', tipo: 'texto', ancho: true, max: 200, ejemplo: 'Palabra 1, Palabra 2, Palabra 3' },
        { id: 'proy_resumen', etiqueta: 'Resumen ejecutivo', tipo: 'parrafo', ancho: true,
          ejemplo: 'De qué trata la propuesta y cómo beneficia a la empresa…' },
        { id: 'proy_empresa', etiqueta: 'Descripción de la empresa', tipo: 'parrafo', ancho: true,
          ejemplo: 'Giro, ubicación, historia breve…' },
        { id: 'proy_mision', etiqueta: 'Misión, visión y valores', tipo: 'parrafo', ancho: true },
        { id: 'proy_desarrollo', etiqueta: 'Desarrollo / marco práctico', tipo: 'parrafo', ancho: true,
          ejemplo: 'Procesos analizados, manuales desarrollados, reportes técnicos…' }
      ]
    },
    {
      id: 'evidencias',
      titulo: 'Evidencias fotográficas',
      ayuda: 'No forman parte del formato oficial; se entregan como anexo aparte.',
      campos: [
        { id: 'fotos', etiqueta: 'Fotografías de las actividades', tipo: 'fotos', ancho: true }
      ]
    },

    /* --- Solo administración ------------------------------------------- */
    {
      id: 'revision',
      titulo: 'Revisión del plantel',
      soloAdmin: true,
      ayuda: 'El alumno ve el estado y las observaciones en su panel.',
      campos: [
        { id: 'estado', etiqueta: 'Estado del expediente', tipo: 'lista', valor: 'entregado',
          opciones: [
            { valor: 'en_captura', texto: 'En captura' },
            { valor: 'entregado', texto: 'Entregado, pendiente de revisión' },
            { valor: 'observado', texto: 'Con observaciones' },
            { valor: 'aprobado', texto: 'Aprobado' }
          ] },
        { id: 'observaciones', etiqueta: 'Observaciones para el alumno', tipo: 'parrafo', ancho: true }
      ]
    },
    {
      id: 'fechas_oficios',
      titulo: 'Fechas de los oficios',
      soloAdmin: true,
      ayuda: 'Si se dejan vacías, el sistema usa la fecha de solicitud para la presentación, la de inicio para la aceptación y la de término para las demás.',
      campos: [
        { id: 'fecha_presentacion', etiqueta: 'Oficio de presentación', tipo: 'fecha' },
        { id: 'fecha_aceptacion', etiqueta: 'Oficio de aceptación', tipo: 'fecha' },
        { id: 'fecha_terminacion', etiqueta: 'Constancia de terminación', tipo: 'fecha' },
        { id: 'fecha_liberacion', etiqueta: 'Liberación', tipo: 'fecha' },
        { id: 'fecha_agradecimiento', etiqueta: 'Carta de agradecimiento', tipo: 'fecha' }
      ]
    }
  ];

  global.CC_ESTADOS = {
    en_captura: 'En captura',
    entregado: 'Pendiente de revisión',
    observado: 'Con observaciones',
    aprobado: 'Aprobado'
  };
})(window);
