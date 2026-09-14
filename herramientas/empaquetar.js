/* Genera sistema-en-un-archivo.html a partir del proyecto modular.
   Se ejecuta con: node herramientas/empaquetar.js
   No hace falta para usar el sistema; solo para regenerar el archivo único
   después de tocar el código. */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const CSS = ['tokens', 'base', 'acceso', 'panel']
  .map((n) => `/* ===== assets/css/${n}.css ===== */\n` + leer(`assets/css/${n}.css`))
  .join('\n\n');

const JS = [
  'config', 'almacen', 'datos', 'yeti-avatar', 'form-base', 'login-form',
  'signup-form', 'auth-card', 'esquema-practicas', 'practicas-form',
  'plantilla-docx', 'documento', 'acceso', 'alumno', 'admin'
].map((n) => `/* ===== assets/js/${n}.js ===== */\n` + leer(`assets/js/${n}.js`)).join('\n\n');

/** Saca el contenedor <div data-pantalla="..."> de cada página. */
function pantalla(archivo) {
  const html = leer(archivo);
  const i = html.indexOf('<div class="cc-pantalla');
  const j = html.lastIndexOf('</div>') + '</div>'.length;
  return html.slice(i, j);
}

const ROUTER = `
<script>
/* Enrutador de la versión de un solo archivo -------------------------------
   Muestra una pantalla a la vez y corre su arranque la primera vez que se
   abre. Sustituye a la navegación entre archivos .html. */
(function () {
  'use strict';

  var iniciadas = {};

  function pantallas() {
    return document.querySelectorAll('[data-pantalla]');
  }

  function mostrar(nombre) {
    var encontrada = false;

    Array.prototype.forEach.call(pantallas(), function (p) {
      var suya = p.getAttribute('data-pantalla') === nombre;
      p.hidden = !suya;
      if (suya) encontrada = true;
    });

    if (!encontrada) { mostrar('acceso'); return; }

    document.body.className = nombre === 'acceso' ? 'cc-fondo-acceso' : 'cc-fondo-panel';
    window.scrollTo(0, 0);

    // Al volver al acceso (cerrar sesión, botón atrás) no debe quedar nada
    // escrito del usuario anterior.
    if (nombre === 'acceso' && iniciadas.acceso && window.ccAcceso) {
      window.ccAcceso.limpiar();
      if (window.ccAcceso.tarjeta) window.ccAcceso.tarjeta.mostrar('acceso', { foco: false });
    }

    if (!iniciadas[nombre] && window.CC_PANTALLAS[nombre]) {
      iniciadas[nombre] = true;
      try {
        window.CC_PANTALLAS[nombre]();
      } catch (e) {
        iniciadas[nombre] = false;
        console.error('Error al abrir la pantalla ' + nombre, e);
      }
    }
  }

  // La navegación deja de recargar archivos y solo cambia el hash.
  window.CCRuta.ir = function (nombre) {
    var destino = '#/' + (this.destinos[nombre] ? nombre : 'acceso');
    if (location.hash === destino) actual();
    else location.hash = destino;
  };

  function actual() {
    mostrar((location.hash || '').replace('#/', '') || 'acceso');
  }

  window.addEventListener('hashchange', actual);
  document.addEventListener('DOMContentLoaded', actual);
  if (document.readyState !== 'loading') actual();
})();
<\/script>`;

const HTML = `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sistema de Prácticas Profesionales · CECyTE Campeche</title>
<meta name="description" content="Sistema de Prácticas Profesionales del CECyTE Campeche, plantel Felipe Carrillo Puerto.">
<meta name="theme-color" content="#8e1250">

<!-- ==========================================================================
     VERSIÓN DE UN SOLO ARCHIVO
     Todo el sistema (estilos, código y las tres pantallas) va aquí dentro.
     Se abre con doble clic, sin carpetas ni servidor. Generada desde el
     proyecto modular con herramientas/empaquetar.js
     ========================================================================== -->

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">

<style>
${CSS}

/* --- Propios de la versión de un solo archivo --- */
body { margin: 0; }
body.cc-fondo-acceso { background-color: var(--cc-fondo); }
body.cc-fondo-panel { background-color: var(--cc-panel); }
</style>
</head>
<body class="cc-fondo-acceso">

${pantalla('index.html')}

${pantalla('alumno.html')}

${pantalla('admin.html')}

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/MorphSVGPlugin.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\/script>

<script>window.CC_UNA_PAGINA = true;<\/script>
<script>
${JS}
<\/script>
${ROUTER}
</body>
</html>
`;

fs.writeFileSync(path.join(RAIZ, 'sistema-en-un-archivo.html'), HTML);
console.log('Generado sistema-en-un-archivo.html — ' + (HTML.length / 1024).toFixed(1) + ' KB');
