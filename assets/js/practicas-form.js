/* ==========================================================================
   practicas-form.js — Formulario de prácticas profesionales
   --------------------------------------------------------------------------
   Se dibuja solo a partir de CC_ESQUEMA_PRACTICAS, así que el alumno y el
   administrador usan exactamente el mismo formulario y las mismas reglas.

   Extras respecto al formulario original:
     · Las fotografías se comprimen en el navegador antes de guardarse.
       Una foto de celular pasa de ~4 MB a ~200 KB sin perder legibilidad.
     · Borrador automático: si se cierra la pestaña a media captura, al
       volver está todo escrito.
     · Rejilla fluida: se acomoda sola de una a tres columnas.
   ========================================================================== */

(function (global) {
  'use strict';

  var CFG = global.CC_CONFIG || {};

  function escapar(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function FormPracticas(contenedor, opciones) {
    this.raiz = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
    if (!this.raiz) throw new Error('FormPracticas: contenedor no encontrado.');

    this.opts = Object.assign({
      usuario: null,
      rol: 'estudiante',     // 'admin' muestra además las secciones soloAdmin
      borradorClave: null,   // si se pasa, guarda borrador automáticamente
      soloLectura: false
    }, opciones || {});

    var rol = this.opts.rol;
    this.esquema = global.CC_ESQUEMA_PRACTICAS.filter(function (s) {
      return !s.soloAdmin || rol === 'admin';
    });
    this.fotos = [];
    this.registroId = null;

    this._dibujar();
    this._enlazar();
    this.llenar({});   // aplica los valores por defecto del esquema
  }

  /* --- Dibujado ----------------------------------------------------------- */

  FormPracticas.prototype._dibujar = function () {
    var html = this.esquema.map(function (seccion) {
      return '<fieldset class="cc-seccion" data-seccion="' + seccion.id + '">' +
        '<legend class="cc-seccion__titulo">' + escapar(seccion.titulo) + '</legend>' +
        (seccion.ayuda ? '<p class="cc-seccion__ayuda">' + escapar(seccion.ayuda) + '</p>' : '') +
        '<div class="cc-rejilla">' +
          seccion.campos.map(campoHTML).join('') +
        '</div></fieldset>';
    }).join('');

    this.raiz.innerHTML = html;
    this.campos = {};

    var self = this;
    this.esquema.forEach(function (seccion) {
      seccion.campos.forEach(function (campo) {
        if (campo.tipo === 'fotos') return;
        self.campos[campo.id] = {
          def: campo,
          grupo: self.raiz.querySelector('[data-grupo="' + campo.id + '"]'),
          input: self.raiz.querySelector('[data-campo="' + campo.id + '"]'),
          nota: self.raiz.querySelector('[data-nota="' + campo.id + '"]')
        };
      });
    });

    this.zonaFotos = this.raiz.querySelector('[data-fotos]');
    this.entradaFotos = this.raiz.querySelector('[data-fotos-input]');
    this.listaFotos = this.raiz.querySelector('[data-fotos-lista]');
    this.contadorFotos = this.raiz.querySelector('[data-fotos-cuenta]');
  };

  function campoHTML(campo) {
    var clases = 'cc-campo' + (campo.ancho ? ' cc-campo--ancho' : '');
    var req = campo.req ? ' <span class="cc-req" aria-hidden="true">*</span>' : '';
    var id = 'cp-' + campo.id;

    if (campo.tipo === 'fotos') {
      return '<div class="' + clases + '" data-grupo="' + campo.id + '">' +
        '<label for="' + id + '">' + escapar(campo.etiqueta) + '</label>' +
        '<label class="cc-soltar" data-fotos>' +
          '<strong>Toca para elegir fotografías</strong>' +
          '<span>JPG o PNG. También puedes arrastrarlas aquí. ' +
          'Se comprimen solas antes de guardarse.</span>' +
          '<input id="' + id + '" type="file" accept="image/png,image/jpeg" multiple data-fotos-input>' +
        '</label>' +
        '<p class="cc-ayuda" data-fotos-cuenta></p>' +
        '<ul class="cc-evidencias" data-fotos-lista></ul>' +
        '<p class="cc-nota" data-nota="' + campo.id + '"></p>' +
      '</div>';
    }

    var control;

    if (campo.tipo === 'lista') {
      var opciones = (campo.opciones || []).map(function (o) {
        var valor = typeof o === 'string' ? o : o.valor;
        var texto = typeof o === 'string' ? o : o.texto;
        return '<option value="' + escapar(valor) + '">' + escapar(texto) + '</option>';
      }).join('');
      control = '<select id="' + id + '" data-campo="' + campo.id + '">' +
        '<option value="">Selecciona…</option>' + opciones + '</select>';

    } else if (campo.tipo === 'parrafo') {
      control = '<textarea id="' + id + '" data-campo="' + campo.id + '" rows="5"' +
        (campo.ejemplo ? ' placeholder="' + escapar(campo.ejemplo) + '"' : '') + '></textarea>';

    } else {
      var tipoHTML = campo.tipo === 'numero' ? 'number'
                   : campo.tipo === 'fecha' ? 'date'
                   : campo.tipo === 'tel' ? 'tel' : 'text';
      var attrs = '';
      if (campo.tipo === 'numero') {
        if (campo.min !== undefined) attrs += ' min="' + campo.min + '"';
        if (campo.max !== undefined) attrs += ' max="' + campo.max + '"';
      } else if (campo.max) {
        attrs += ' maxlength="' + campo.max + '"';
      }
      if (campo.modo) attrs += ' inputmode="' + campo.modo + '"';
      if (campo.ejemplo) attrs += ' placeholder="' + escapar(campo.ejemplo) + '"';
      if (campo.sugerencias) attrs += ' list="lista-' + campo.id + '"';

      control = '<input id="' + id + '" type="' + tipoHTML + '" data-campo="' + campo.id + '"' + attrs + '>';

      if (campo.sugerencias) {
        control += '<datalist id="lista-' + campo.id + '">' +
          campo.sugerencias.map(function (s) { return '<option value="' + escapar(s) + '">'; }).join('') +
          '</datalist>';
      }
    }

    return '<div class="' + clases + '" data-grupo="' + campo.id + '">' +
      '<label for="' + id + '">' + escapar(campo.etiqueta) + req + '</label>' +
      control +
      (campo.ayuda ? '<p class="cc-ayuda">' + escapar(campo.ayuda) + '</p>' : '') +
      '<p class="cc-nota" data-nota="' + campo.id + '"></p>' +
    '</div>';
  }

  /* --- Eventos ------------------------------------------------------------ */

  FormPracticas.prototype._enlazar = function () {
    var self = this;

    Object.keys(this.campos).forEach(function (clave) {
      var campo = self.campos[clave];
      campo.input.addEventListener('input', function () {
        self.marcar(clave, '');
        self._programarBorrador();
      });
      campo.input.addEventListener('change', function () { self._programarBorrador(); });
    });

    if (this.entradaFotos) {
      this.entradaFotos.addEventListener('change', function (e) {
        self.agregarFotos(e.target.files);
        e.target.value = '';
      });

      ['dragenter', 'dragover'].forEach(function (ev) {
        self.zonaFotos.addEventListener(ev, function (e) {
          e.preventDefault();
          self.zonaFotos.setAttribute('data-encima', 'true');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        self.zonaFotos.addEventListener(ev, function (e) {
          e.preventDefault();
          self.zonaFotos.removeAttribute('data-encima');
        });
      });
      self.zonaFotos.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) self.agregarFotos(e.dataTransfer.files);
      });
    }
  };

  /* --- Fotografías -------------------------------------------------------- */

  FormPracticas.prototype.agregarFotos = function (archivos) {
    var self = this;
    var limite = CFG.fotosMaximas || 12;
    var lista = Array.prototype.slice.call(archivos || []).filter(function (a) {
      return /^image\/(png|jpe?g)$/i.test(a.type);
    });

    if (!lista.length) return Promise.resolve();

    if (this.fotos.length + lista.length > limite) {
      lista = lista.slice(0, Math.max(0, limite - this.fotos.length));
      this.marcar('fotos', 'El máximo son ' + limite + ' fotografías por reporte.');
    }

    return Promise.all(lista.map(comprimir)).then(function (imagenes) {
      imagenes.filter(Boolean).forEach(function (img) { self.fotos.push(img); });
      self._pintarFotos();
      self._programarBorrador();
    });
  };

  /** Reduce la imagen a un lado máximo y la convierte a JPEG. */
  function comprimir(archivo) {
    return new Promise(function (resolver) {
      if (typeof FileReader === 'undefined') { resolver(null); return; }

      var lector = new FileReader();
      lector.onerror = function () { resolver(null); };
      lector.onload = function () {
        var origen = String(lector.result);
        var img = new Image();

        img.onerror = function () { resolver({ nombre: archivo.name, datos: origen }); };
        img.onload = function () {
          try {
            var maxLado = CFG.fotoMaxLado || 1280;
            var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
            var lienzo = document.createElement('canvas');
            lienzo.width = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
            resolver({
              nombre: archivo.name,
              datos: lienzo.toDataURL('image/jpeg', CFG.fotoCalidad || 0.72)
            });
          } catch (e) {
            resolver({ nombre: archivo.name, datos: origen });
          }
        };
        img.src = origen;
      };
      lector.readAsDataURL(archivo);
    });
  }

  FormPracticas.prototype.quitarFoto = function (indice) {
    this.fotos.splice(indice, 1);
    this._pintarFotos();
    this._programarBorrador();
  };

  FormPracticas.prototype._pintarFotos = function () {
    if (!this.listaFotos) return;
    var self = this;

    this.listaFotos.innerHTML = this.fotos.map(function (foto, i) {
      return '<li class="cc-evidencia">' +
        '<img src="' + foto.datos + '" alt="' + escapar(foto.nombre || ('Evidencia ' + (i + 1))) + '">' +
        (self.opts.soloLectura ? '' :
          '<button type="button" data-quitar="' + i + '" aria-label="Quitar esta fotografía">&times;</button>') +
      '</li>';
    }).join('');

    if (this.contadorFotos) {
      this.contadorFotos.textContent = this.fotos.length
        ? this.fotos.length + ' de ' + (CFG.fotosMaximas || 12) + ' fotografías adjuntas.'
        : '';
    }

    Array.prototype.forEach.call(this.listaFotos.querySelectorAll('[data-quitar]'), function (b) {
      b.addEventListener('click', function () {
        self.quitarFoto(parseInt(b.getAttribute('data-quitar'), 10));
      });
    });
  };

  /* --- Leer, llenar y validar --------------------------------------------- */

  FormPracticas.prototype.leer = function () {
    var datos = { fotos: this.fotos.slice() };
    if (this.registroId) datos.id = this.registroId;

    Object.keys(this.campos).forEach(function (clave) {
      datos[clave] = this.campos[clave].input.value.trim();
    }, this);

    return datos;
  };

  FormPracticas.prototype.llenar = function (registro) {
    var datos = registro || {};
    this.registroId = datos.id || null;

    Object.keys(this.campos).forEach(function (clave) {
      var campo = this.campos[clave];
      var valor = datos[clave];
      if (valor === undefined || valor === null || valor === '') {
        valor = campo.def.valor !== undefined ? campo.def.valor : '';
      }
      campo.input.value = valor;
      this.marcar(clave, '');
    }, this);

    this.fotos = Array.isArray(datos.fotos) ? datos.fotos.slice() : [];
    this._pintarFotos();
  };

  /** Llena lo que ya se sabe de la cuenta del alumno. */
  FormPracticas.prototype.precargarDeCuenta = function (usuario) {
    if (!usuario) return;
    var partes = usuario.partes || {};
    var mapa = {
      ape_paterno: partes.ape_paterno,
      ape_materno: partes.ape_materno,
      nombres: partes.nombres,
      num_control: usuario.matricula
    };
    Object.keys(mapa).forEach(function (clave) {
      var campo = this.campos[clave];
      if (campo && mapa[clave] && !campo.input.value) campo.input.value = mapa[clave];
    }, this);
  };

  FormPracticas.prototype.marcar = function (clave, texto) {
    var campo = this.campos[clave];
    var grupo = campo ? campo.grupo : this.raiz.querySelector('[data-grupo="' + clave + '"]');
    var nota = campo ? campo.nota : this.raiz.querySelector('[data-nota="' + clave + '"]');
    if (!grupo) return;

    if (texto) {
      grupo.setAttribute('data-estado', 'error');
      if (campo) campo.input.setAttribute('aria-invalid', 'true');
      if (nota) nota.textContent = texto;
    } else {
      grupo.removeAttribute('data-estado');
      if (campo) campo.input.removeAttribute('aria-invalid');
      if (nota) nota.textContent = '';
    }
  };

  /** @returns {string|null} id del primer campo con problema */
  FormPracticas.prototype.validar = function () {
    var primero = null;

    Object.keys(this.campos).forEach(function (clave) {
      var campo = this.campos[clave];
      var def = campo.def;
      var valor = campo.input.value.trim();
      var error = null;

      if (def.req && !valor) {
        error = 'Este dato es obligatorio.';
      } else if (valor && def.patron && !def.patron.test(valor)) {
        error = def.error || 'El formato no es válido.';
      } else if (valor && def.tipo === 'numero') {
        var n = Number(valor);
        if (isNaN(n)) error = 'Escribe un número.';
        else if (def.min !== undefined && n < def.min) error = 'El mínimo es ' + def.min + '.';
        else if (def.max !== undefined && n > def.max) error = 'El máximo es ' + def.max + '.';
      }

      this.marcar(clave, error || '');
      if (error && !primero) primero = clave;
    }, this);

    // Pares de fechas: solo se revisan si se escribieron las dos.
    var pares = [['fecha_inicio', 'fecha_termino'], ['r1_inicio', 'r1_corte'],
                 ['r2_inicio', 'r2_corte'], ['r3_inicio', 'r3_corte']];
    pares.forEach(function (par) {
      var a = this.campos[par[0]], b = this.campos[par[1]];
      if (!a || !b) return;
      if (a.input.value && b.input.value && a.input.value > b.input.value) {
        this.marcar(par[1], 'La fecha final es anterior a la inicial.');
        if (!primero) primero = par[1];
      }
    }, this);

    // Un reporte a medias: si escribió actividades, necesita su periodo.
    [1, 2, 3].forEach(function (n) {
      var act = this.campos['r' + n + '_actividades'];
      var ini = this.campos['r' + n + '_inicio'];
      var fin = this.campos['r' + n + '_corte'];
      if (act && act.input.value.trim() && ini && fin && (!ini.input.value || !fin.input.value)) {
        var clave = !ini.input.value ? 'r' + n + '_inicio' : 'r' + n + '_corte';
        this.marcar(clave, 'Indica el periodo de este reporte.');
        if (!primero) primero = clave;
      }
    }, this);

    return primero;
  };

  FormPracticas.prototype.enfocar = function (clave) {
    var campo = this.campos[clave];
    if (!campo) return;
    campo.input.focus();
    if (campo.input.scrollIntoView) {
      campo.input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  /* --- Borrador ----------------------------------------------------------- */

  FormPracticas.prototype._programarBorrador = function () {
    if (!this.opts.borradorClave) return;
    var self = this;
    clearTimeout(this._temporizador);
    this._temporizador = setTimeout(function () { self.guardarBorrador(); }, 800);
  };

  FormPracticas.prototype.guardarBorrador = function () {
    if (!this.opts.borradorClave) return;
    var borrador = this.leer();
    borrador._momento = new Date().toISOString();
    global.CCAlmacen.guardar(this.opts.borradorClave, borrador);
  };

  FormPracticas.prototype.recuperarBorrador = function () {
    if (!this.opts.borradorClave) return false;
    var borrador = global.CCAlmacen.leer(this.opts.borradorClave, null);
    if (!borrador) return false;
    this.llenar(borrador);
    return true;
  };

  FormPracticas.prototype.borrarBorrador = function () {
    if (this.opts.borradorClave) global.CCAlmacen.borrar(this.opts.borradorClave);
  };

  FormPracticas.prototype.limpiar = function () {
    this.llenar({});
    this.registroId = null;
  };

  global.FormPracticas = FormPracticas;
})(window);
