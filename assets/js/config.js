/* ==========================================================================
   config.js — Lo único que se edita al desplegar
   ========================================================================== */

window.CC_CONFIG = {

  plantel: 'Felipe Carrillo Puerto',
  clavePlantel: '04ETC0008V',

  // Quien firma los oficios del plantel. Se imprime tal cual en el Word.
  director: {
    nombre: 'ING. FERNANDO MARIN BARRIOS',
    cargo: 'DIRECTOR DEL CECYTEC PLANTEL FELIPE CARRILLO PUERTO'
  },

  // Horas que exige el plantel; el alumno puede cambiarlas en su expediente.
  horasPractica: 400,

  /**
   * 'local'    — todo vive en el navegador de cada persona. Sirve para probar
   *              y para que el sistema funcione en GitHub Pages sin configurar
   *              nada, pero cada quien ve solo sus propios datos.
   * 'supabase' — base de datos en línea compartida. Es el modo real: el
   *              administrador ve los registros de todos los alumnos desde
   *              cualquier dispositivo. Ver README.
   */
  modo: 'supabase',

  supabase: {
    url: 'https://cryxabbwsohnwzopdspq.supabase.co/rest/v1/',      // https://xxxxxxxx.supabase.co
    anonKey: 'sb_publishable_No3PSkjenvhMciCaB9K6OQ_Og5uvxnY'   // clave "anon public" del proyecto
  },

  administrador: {
    usuario: 'Root32',
    // En modo supabase el usuario Root32 se traduce a este correo para
    // iniciar sesión contra Supabase Auth, donde vive la contraseña real.
    correo: 'root32@cecytecampeche.edu.mx',
    // Solo se usa en modo 'local'. En modo 'supabase' este valor se ignora:
    // la contraseña la guarda y verifica Supabase, no el navegador.
    contrasenaLocal: ''
  },

  // Tamaño máximo por fotografía después de comprimirla, en píxeles.
  fotoMaxLado: 1280,
  fotoCalidad: 0.72,
  fotosMaximas: 12
};
