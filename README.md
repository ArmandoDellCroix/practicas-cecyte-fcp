# Sistema de Prácticas Profesionales

CECyTE Campeche · Plantel Felipe Carrillo Puerto · Clave 04ETC0008V

Sistema web con tres piezas: acceso y registro de alumnos, panel del alumno
para capturar su expediente de prácticas, y panel de administración para
revisarlo, corregirlo y descargar el paquete de anexos en Word.

Cada alumno tiene **un expediente**, con la misma estructura que el formato
oficial "Anexos - Prácticas Profesionales" del plantel: datos del solicitante,
domicilio, empresa, representante, periodo, los tres reportes, la liberación y
el proyecto. De ese expediente sale el paquete completo de ocho documentos.

Todo es HTML, CSS y JavaScript sin compilar: se sube tal cual a GitHub Pages
y funciona. No hay paso de build, ni `npm install`, ni servidor propio.

---

## Probarlo ahora mismo

Hay dos formas, las dos funcionan con doble clic y sin servidor:

**A. Un solo archivo.** Abre `sistema-en-un-archivo.html`. Trae todo dentro
(estilos, código y las tres pantallas) y no depende de ninguna carpeta, así
que funciona aunque lo muevas o lo mandes por WhatsApp. Es la opción segura si
algo falló al descargar.

**B. El proyecto completo.** Descomprime el ZIP **sin sacar los archivos de su
carpeta** y abre `index.html`. Es la versión que se sube a GitHub Pages.

> Si abres `index.html` y la página sale sin colores ni botones, es que los
> archivos quedaron sueltos en la misma carpeta. El HTML busca sus estilos en
> `assets/css/` y su código en `assets/js/`; si esa estructura no existe, no
> carga nada. Descomprime el ZIP completo o usa la versión de un solo archivo.

Las dos arrancan en **modo local**: las cuentas y los registros se guardan en
el navegador de quien lo abre. Sirve para conocer el sistema, no para operarlo
— para eso está el modo Supabase, más abajo.

**Administrador:** usuario `Root32`, contraseña `CtrlAdminFCP`

**Alumno:** crea una cuenta con el botón `+`. La contraseña debe tener
exactamente 8 caracteres alfanuméricos, con al menos una letra y un número
(por ejemplo `Camp3che`). El sistema no deja escribir más de 8.

---

## Estructura

```
cecyte-practicas/
├── sistema-en-un-archivo.html   todo junto, para abrir sin carpetas
├── index.html              acceso y registro
├── alumno.html             panel del alumno
├── admin.html              panel de administración
├── db/esquema.sql          base de datos (se pega en Supabase)
├── herramientas/
│   ├── empaquetar.js            regenera el archivo único (opcional, con Node)
│   ├── preparar_plantilla.py    convierte el formato oficial en plantilla (opcional, con Python)
│   └── formato-oficial.docx     el formato del plantel tal como se recibió
└── assets/
    ├── css/
    │   ├── tokens.css      paleta y tipografía   ← capa de tema
    │   ├── base.css        campos, botones, mensajes
    │   ├── acceso.css      pantalla de acceso
    │   └── panel.css       paneles y tablas
    └── js/
        ├── config.js            ← lo único que se edita al desplegar
        ├── almacen.js           guardado local y sesión
        ├── datos.js             cuentas y registros (local o Supabase)
        ├── esquema-practicas.js definición del expediente (sigue el formato oficial)
        ├── practicas-form.js    dibuja y valida el formulario
        ├── plantilla-docx.js    el formato oficial, con tokens, embebido
        ├── documento.js         rellena el Word oficial, arma el anexo de fotos y el CSV
        ├── yeti-avatar.js       avatar animado del acceso
        ├── form-base.js         cimiento común de los formularios
        ├── login-form.js        acceso
        ├── signup-form.js       alta de cuenta
        ├── auth-card.js         tarjeta que voltea
        ├── acceso.js            arranque de index.html
        ├── alumno.js            arranque de alumno.html
        └── admin.js             arranque de admin.html
```

Las dos versiones comparten exactamente el mismo código. La de un solo archivo
se arma con `node herramientas/empaquetar.js` cada vez que cambies algo; la
diferencia es que en vez de saltar entre archivos `.html` cambia de pantalla
con el enrutador interno (`#/acceso`, `#/alumno`, `#/admin`).

---

## Base de datos: Supabase

GitHub Pages solo entrega archivos, no ejecuta nada del lado del servidor, así
que la base de datos tiene que vivir aparte. Supabase es la mejor opción para
este caso: es Postgres de verdad, tiene plan gratuito suficiente para un
plantel (500 MB de base y 50 000 usuarios activos al mes), y se consulta
directamente desde el navegador con seguridad por fila.

### Paso 1 — Crear el proyecto

1. Entra a `supabase.com` y crea una cuenta.
2. **New project**. Anota la contraseña de la base que te pida.
3. Elige la región más cercana (`us-east-1` o `us-west-1` para el sureste).

### Paso 2 — Crear las tablas

1. Menú lateral → **SQL Editor** → **New query**.
2. Pega completo el contenido de `db/esquema.sql` y presiona **Run**.

Eso crea las tablas `perfiles` y `expedientes`, los índices, los disparadores
y las políticas de seguridad. Un disparador impide que el alumno cambie desde
su panel el estado, las observaciones o las fechas de los oficios: eso solo lo
escribe administración, aunque el alumno vuelva a guardar su expediente.

Si ya habías corrido la versión anterior del esquema, vuelve a pegarlo
completo: retira la tabla `practicas` y crea `expedientes` sin tocar las
cuentas.

### Paso 3 — Crear al administrador

1. **Authentication → Users → Add user**.
2. Correo `root32@cecytecampeche.edu.mx`, contraseña `CtrlAdminFCP`.
3. Marca **Auto Confirm User**.
4. Vuelve al SQL Editor y corre la última instrucción de `esquema.sql`
   (el `update ... set rol = 'admin'`).

El alumno seguirá escribiendo `Root32` en la pantalla de acceso: el sistema
traduce ese usuario al correo por dentro.

### Paso 4 — Registro de alumnos sin confirmar correo

En **Authentication → Sign In / Providers → Email**, desactiva
**Confirm email**. Si lo dejas activo, cada alumno tendrá que abrir un correo
antes de poder entrar, y muchos usan cuentas que no revisan.

### Paso 5 — Conectar el sistema

En **Project Settings → API** copia *Project URL* y la clave *anon public*, y
pégalas en `assets/js/config.js`:

```js
modo: 'supabase',
supabase: {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'
}
```

Listo. A partir de ahí el administrador ve los registros de todos los alumnos
desde cualquier dispositivo con internet.

### Sobre la clave `anon`

Esa clave es pública por diseño y no hay problema en que quede en el
repositorio: por sí sola no da acceso a nada. Quien protege los datos son las
políticas de seguridad por fila del `esquema.sql`, que solo dejan a cada alumno
ver lo suyo y al administrador ver todo.

Lo que **nunca** debe subirse a GitHub es la clave `service_role`. Si algún día
la copias por error, regenérala desde **Project Settings → API**.

---

## Publicar en GitHub Pages

1. Crea un repositorio, por ejemplo `practicas-cecyte-fcp`.
2. Sube el contenido de esta carpeta a la rama `main`. Si no usas Git, en
   **Add file → Upload files** puedes arrastrar la carpeta completa: GitHub
   respeta las subcarpetas. Lo que no funciona es subir los archivos sueltos,
   porque se pierde `assets/`.
3. **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama
   `main`, carpeta `/ (root)`. Guarda.
4. En un par de minutos queda en
   `https://TU-USUARIO.github.io/practicas-cecyte-fcp/`.

Comparte esa dirección con los alumnos. Si más adelante el plantel consigue un
dominio propio, se conecta en esa misma pantalla de Pages.

---

## El paquete de Word

El botón **Word (.docx)** entrega el formato oficial del plantel con los datos
del alumno donde iban los corchetes. No es una imitación: es el archivo
"Plantilla Limpia - Formato de Prácticas Profesionales CECYTEC.docx" abierto
en el navegador, rellenado y vuelto a guardar. Mismas tablas, mismos textos,
misma tipografía, y se edita en Word o Google Docs sin ninguna restricción.

Contiene, en este orden: solicitud, oficio de presentación, oficio de
aceptación, reportes mensuales y final (uno por cada reporte que el alumno
haya llenado; si no hay ninguno, el formato en blanco), constancia de
terminación, liberación, carta de agradecimiento y estructura del proyecto.

Tres cosas que se ajustaron del formato original para que salga bien:

- El original separaba los oficios con siete títulos vacíos que empujaban el
  siguiente a otra hoja. Con texto real eso se desacomoda y deja páginas en
  blanco. Se quitaron, y cada documento lleva un salto de página propio: sale
  siempre al inicio de su hoja, sin hojas vacías entre uno y otro.
- Las fuentes venían incrustadas en el archivo (2.3 MB). Son Arial y
  Georgia, que cualquier equipo ya tiene, así que se quitaron y la plantilla
  pesa 15 KB.
- El nombre del director y su cargo salen de `config.js`, no están fijos en
  el archivo. Si cambia la dirección del plantel, se cambia ahí.

Las fechas de los oficios las puede fijar el administrador al revisar el
expediente. Si las deja vacías, el sistema usa la fecha de solicitud para la
presentación, la de inicio para la aceptación y la de término para la
constancia, la liberación y la carta.

Las fotografías no forman parte del formato oficial; se descargan aparte con
el botón **Fotos** como anexo, y el CSV sigue disponible para concentrados.

### Si el plantel cambia el formato

1. Sustituye `herramientas/formato-oficial.docx` por el nuevo, conservando
   los mismos textos entre corchetes.
2. Corre `python3 herramientas/preparar_plantilla.py` (necesita Python 3).
3. Corre `node herramientas/empaquetar.js` para regenerar el archivo único.

Si el nuevo formato trae un campo que antes no existía, se agrega su línea en
`esquema-practicas.js` y su token en `preparar_plantilla.py`.

## Acceso: limpieza de credenciales

La pantalla de acceso nunca conserva lo que escribió el usuario anterior. El
formulario lleva `autocomplete="off"` (algunos navegadores restauran lo
escrito al recargar si no se les indica lo contrario), se vacía al cargar la
página, al cerrar sesión y al volver con el botón "atrás". Lo único que el
sistema no puede impedir es que el usuario haya guardado su contraseña en el
administrador de contraseñas del navegador: esa es una decisión suya.

## Qué se optimizó del formulario original

| Antes | Ahora |
|---|---|
| Los 30 campos escritos a mano en el HTML | Declarados una vez en `esquema-practicas.js`; de ahí salen el formulario del alumno, el editor del administrador y el Word |
| Tres puntos de quiebre con `grid-template-columns` fijos | Rejilla fluida `auto-fit`: se acomoda sola de una a tres columnas en cualquier pantalla |
| Fotos subidas tal cual (4 MB cada una) | Se comprimen en el navegador a 1280 px y JPEG: ~200 KB, sin perder legibilidad |
| Sin validación real | Código postal de 5 dígitos, teléfono de 10, edad entre 15 y 60, fechas coherentes, campos obligatorios marcados |
| "Periodo" como texto libre | Fechas reales, que en el Word salen como "21 de septiembre de 2026" |
| Un registro suelto por reporte | Un expediente por alumno con los tres reportes dentro, como en el formato oficial |
| Sin flujo de revisión | Estado del expediente (pendiente, con observaciones, aprobado) y observaciones que el alumno ve en su panel |
| El alumno reescribía su nombre en cada reporte | Se toma de su cuenta y se precarga |
| Si se cerraba la pestaña, se perdía todo | Borrador automático cada vez que deja de escribir |
| `enctype="multipart/form-data"` hacia un servidor inexistente | Los datos van a la base de datos por la API de Supabase |

---

## Límites que conviene tener presentes

**Modo local.** Los datos viven en el navegador de cada quien. Dos alumnos en
la misma computadora comparten almacenamiento; el mismo alumno en dos
dispositivos no ve lo mismo. Es un modo de prueba.

**Contraseñas de 8 caracteres.** La regla la pediste y así quedó, pero ocho
caracteres alfanuméricos son pocos. En modo Supabase las contraseñas las
guarda y cifra Supabase Auth, que además limita los intentos, así que el riesgo
está acotado. En modo local no hay esa protección.

**La contraseña del administrador en `config.js`.** Solo se usa en modo local.
Cuando pases a Supabase, esa línea deja de tener efecto: la contraseña real
vive en Supabase Auth y el archivo solo guarda la equivalencia
`Root32 → root32@cecytecampeche.edu.mx`. Aun así conviene cambiarla desde
Supabase una vez en producción.

**Fotografías.** Se guardan dentro del expediente, en la base. Doce fotos
comprimidas rondan los 2.5 MB; con 500 MB del plan gratuito caben unos 200
expedientes con fotos, o varios miles sin ellas. Si el plantel crece, el siguiente
paso natural es mover las imágenes a Supabase Storage y dejar solo el enlace.

---

## Dependencias

Se cargan desde CDN, nada se instala:

- **GSAP 3.13** y **MorphSVG** — animación del avatar. Gratuitos desde 2025,
  incluido el uso comercial.
- **supabase-js 2** — cliente de la base de datos.
- **JSZip 3.10** — abre y vuelve a guardar el .docx en el navegador.
- **Archivo** (Google Fonts) — tipografía, licencia SIL Open Font.

El avatar animado del acceso está basado en el *pen* de Darin Senneff,
reescrito como componente y recoloreado con la paleta institucional.
