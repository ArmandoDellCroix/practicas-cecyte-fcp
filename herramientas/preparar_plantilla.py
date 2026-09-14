# -*- coding: utf-8 -*-
"""Convierte el formato oficial en una plantilla con tokens {{...}} que el
navegador puede rellenar. Quita las fuentes incrustadas (2.3 MB de Arial y
Georgia, que todo equipo ya tiene) para que quepa embebida en el sistema."""
import re, os, shutil, glob, zipfile

RAIZ = 'plantilla_x'
shutil.rmtree(RAIZ, ignore_errors=True)
with zipfile.ZipFile('plantilla.docx') as z: z.extractall(RAIZ)
import subprocess; subprocess.run(['python3','/mnt/skills/public/docx/scripts/merge_runs.py',RAIZ],check=True)
doc_path = os.path.join(RAIZ, 'word', 'document.xml')
x = open(doc_path, encoding='utf-8').read()

# ---------- 1. quitar fuentes incrustadas ----------
shutil.rmtree(os.path.join(RAIZ, 'word', 'fonts'), ignore_errors=True)
rels = os.path.join(RAIZ, 'word', '_rels', 'fontTable.xml.rels')
if os.path.exists(rels): os.remove(rels)
ft = os.path.join(RAIZ, 'word', 'fontTable.xml')
t = open(ft, encoding='utf-8').read()
t = re.sub(r'<w:embed(Regular|Bold|Italic|BoldItalic)[^>]*/>', '', t)
open(ft, 'w', encoding='utf-8').write(t)
st = os.path.join(RAIZ, 'word', 'settings.xml')
t = open(st, encoding='utf-8').read()
t = re.sub(r'<w:(embedTrueTypeFonts|saveSubsetFonts|embedSystemFonts)[^>]*/>', '', t)
open(st, 'w', encoding='utf-8').write(t)
ct = os.path.join(RAIZ, '[Content_Types].xml')
t = open(ct, encoding='utf-8').read()
t = re.sub(r'<Default Extension="odttf"[^>]*/>', '', t)
open(ct, 'w', encoding='utf-8').write(t)

# ---------- 2. tokens por marcador y por sección ----------
SECCIONES = [
    ('SOLICITUD DE PR', 'solicitud'),
    ('DATOS DE LA EMPRESA', 'empresa'),
    ('OFICIO DE PRESENTACI', 'presentacion'),
    ('OFICIO DE ACEPTACI', 'aceptacion'),
    ('REPORTES MENSUALES', 'reportes'),
    ('CONSTANCIA DE TERMINACI', 'terminacion'),
    ('LIBERACI', 'liberacion'),
    ('CARTA DE AGRADECIMIENTO', 'agradecimiento'),
    ('ESTRUCTURA DEL PROYECTO', 'proyecto'),
]
FECHA_DE = {'solicitud': 'fecha_solicitud', 'empresa': 'fecha_solicitud',
            'presentacion': 'fecha_presentacion', 'aceptacion': 'fecha_aceptacion',
            'terminacion': 'fecha_terminacion', 'liberacion': 'fecha_liberacion',
            'agradecimiento': 'fecha_agradecimiento', 'reportes': 'fecha_reporte',
            'proyecto': 'fecha_proyecto'}

FIJOS = {
    '[Escriba su apellido paterno]': 'ape_paterno',
    '[Escriba su apellido materno]': 'ape_materno',
    '[Escriba su nombre(s)]': 'nombres',
    '[Edad]': 'edad',
    '[Femenino / Masculino]': 'sexo',
    '[Número de control]': 'num_control', '[Número]': 'num_control', '[Número de Control]': 'num_control',
    '[Especialidad]': 'especialidad',
    '[Semestre]': 'semestre',
    '[Número de teléfono]': 'tel_alum',
    '[Nombre completo de la empresa]': 'nombre_empresa', '[Nombre de la Empresa]': 'nombre_empresa',
    '[NOMBRE DE LA EMPRESA]': 'nombre_empresa', '[Nombre de la empresa]': 'nombre_empresa',
    '[Comercial / Servicios / Industrial]': 'giro_empresa',
    '[Teléfono de la empresa]': 'tel_empresa',
    '[Departamento o área asignada]': 'area_practicas', '[Área de prácticas]': 'area_practicas',
    '[Nombre completo del alumno]': 'nombre_alumno', '[Nombre completo]': 'nombre_alumno',
    '[Nombre del alumno]': 'nombre_alumno', '[Nombre del Alumno]': 'nombre_alumno',
    '[NOMBRE DEL REPRESENTANTE DE LA EMPRESA]': 'rep_nombre',
    '[Nombre del Representante de la Empresa]': 'rep_nombre',
    '[CARGO DEL REPRESENTANTE EN LA EMPRESA]': 'rep_cargo', '[CARGO DEL REPRESENTANTE]': 'rep_cargo',
    '[Fecha de término]': 'fecha_termino',
    '[Fecha de corte]': 'r_periodo_corte',
    '[Horario de entrada y salida]': 'horario',
    '[Reporte 1 / Reporte 2 / Reporte Final]': 'r_tipo',
    '[Describa a detalle las actividades realizadas en este periodo...]': 'r_actividades',
    '[Describa las herramientas, maquinaria o metodologías utilizadas...]': 'r_herramientas',
    '[Describa el aprendizaje o logros obtenidos...]': 'r_aprendizajes',
    '[Escribir el título]': 'proy_titulo',
    '[Redactar la introducción del trabajo que ofrece solución a un problema...]': 'proy_introduccion',
    '[Describir el problema actual en la empresa o área...]': 'proy_planteamiento',
    '[Palabra 1, Palabra 2, Palabra 3...]': 'proy_palabras',
    '[Resumen de lo que tratará la propuesta y cómo beneficia a la empresa...]': 'proy_resumen',
    '[Giro, ubicación, historia breve...]': 'proy_empresa',
    '[Transcribir o proponer la misión, visión y valores de la empresa donde estuviste...]': 'proy_mision',
    '[Procesos analizados, manuales desarrollados, reportes técnicos...]': 'proy_desarrollo',
}
POR_SECCION = {  # marcador → token según sección
    '[Calle]':         {'empresa': 'calle_empresa',     'otro': 'calle_alum'},
    '[Colonia]':       {'empresa': 'colonia_empresa',   'otro': 'colonia_alum'},
    '[Código Postal]': {'empresa': 'cp_empresa',        'otro': 'cp_alum'},
    '[Municipio]':     {'empresa': 'municipio_empresa', 'otro': 'municipio_alum'},
    '[Fecha de inicio]': {'reportes': 'r_periodo_inicio', 'otro': 'fecha_inicio'},
}
VACIAR_PREFIJO = ('[Nota para el estudiante', '[Resumen general de las actividades')
LITERALES = [
    ('ING. FERNANDO MARIN BARRIOS', '{{director}}'),
    ('DIRECTOR DEL CECYTEC PLANTEL FELIPE CARRILLO PUERTO', '{{director_cargo}}'),
    ('Felipe Carrillo Puerto', '{{plantel}}'),
    ('04ETC0008V', '{{clave_plantel}}'),
    ('400 hrs', '{{horas}} hrs'),
    ('400 horas', '{{horas}} horas'),
]

seccion = 'solicitud'
usados = {}
salida = []
pos = 0
for m in re.finditer(r'<w:p[ >].*?</w:p>', x, re.S):
    p = m.group(0)
    texto = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', p)).strip().upper()
    for clave, nombre in SECCIONES:
        if texto.startswith(clave):
            seccion = nombre
    if texto.startswith('NOTA: UTILICE ESTE FORMATO'):
        p = re.sub(r'(<w:t(?: [^>]*)?>)[^<]*(</w:t>)', r'\1{{nota_reportes}}\2', p, count=1)
        p = re.sub(r'<w:r>(?:(?!</w:r>).)*<w:t(?: [^>]*)?>[^<]*</w:t></w:r>', lambda r: r.group(0) if '{{' in r.group(0) else '', p)

    def sustituir(mt):
        t = mt.group(2)
        orig = t
        for pref in VACIAR_PREFIJO:
            if t.strip().startswith(pref):
                tok = 'liberacion_actividades' if 'Resumen general' in t else 'nota_proyecto'
                usados[tok] = usados.get(tok, 0) + 1
                return mt.group(1) + '{{' + tok + '}}' + mt.group(3)
        def marcador(mm):
            ph = mm.group(0)
            if ph in FIJOS:
                tok = FIJOS[ph]
            elif ph in POR_SECCION:
                tok = POR_SECCION[ph].get(seccion, POR_SECCION[ph]['otro'])
            elif ph in ('[Día]', '[Mes]', '[Año]'):
                base = FECHA_DE[seccion]
                tok = base + {'[Día]': '_dia', '[Mes]': '_mes', '[Año]': '_anio'}[ph]
            else:
                raise SystemExit('Marcador sin token: ' + ph + ' (sección ' + seccion + ')')
            usados[tok] = usados.get(tok, 0) + 1
            return '{{' + tok + '}}'
        t = re.sub(r'\[[^\]]+\]', marcador, t)
        for lit, tok in LITERALES:
            if lit in t:
                t = t.replace(lit, tok)
                usados[tok.strip('{}')] = usados.get(tok.strip('{}'), 0) + 1
        return mt.group(1) + t + mt.group(3)

    p = re.sub(r'(<w:t(?: [^>]*)?>)([^<]*)(</w:t>)', sustituir, p)
    salida.append(x[pos:m.start()]); salida.append(p); pos = m.end()
salida.append(x[pos:])
x = ''.join(salida)

# ---------- 2b. cada documento empieza en hoja nueva ----------
# El original dependía de siete títulos vacíos como "espaciadores" para
# empujar el siguiente oficio a otra página. Con texto real eso se desacomoda
# y produce hojas en blanco. Se quitan y en su lugar cada título de sección
# lleva salto de página antes (menos el primero, que va bajo la portada).
primero = True
def ajustar_titulo(m):
    global primero
    p = m.group(0)
    if 'w:val="Ttulo2"' not in p: return p
    texto = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', p)).strip()
    if not texto: return ''
    if primero:
        primero = False
        return p
    return p.replace('<w:pStyle w:val="Ttulo2"/>', '<w:pStyle w:val="Ttulo2"/><w:pageBreakBefore/>', 1)
x = re.sub(r'<w:p[ >].*?</w:p>', ajustar_titulo, x, flags=re.S)

# ---------- 3. marcadores de repetición del bloque de reportes ----------
def parrafo_marcador(tok):
    return '<w:p><w:r><w:t>' + tok + '</w:t></w:r></w:p>'
m = re.search(r'<w:p[ >](?:(?!</w:p>).)*REPORTES MENSUALES(?:(?!</w:p>).)*</w:p>', x, re.S)
assert m, 'no se encontró el encabezado de reportes'
x = x[:m.start()] + parrafo_marcador('{{#reportes}}') + x[m.start():]
# fin: después de la tabla que contiene "Vo. Bo."
i = x.index('Vo. Bo.')
j = x.index('</w:tbl>', i) + len('</w:tbl>')
x = x[:j] + parrafo_marcador('{{/reportes}}') + x[j:]

open(doc_path, 'w', encoding='utf-8').write(x)

restantes = re.findall(r'\[[^\]]+\]', re.sub(r'<[^>]+>', '', x))
print('marcadores sin convertir:', restantes)
print('tokens distintos:', len(usados))
for k in sorted(usados): print('  ', k, usados[k])

# ---------- 4. empaquetar ----------
if os.path.exists('plantilla-preparada.docx'): os.remove('plantilla-preparada.docx')
with zipfile.ZipFile('plantilla-preparada.docx', 'w', zipfile.ZIP_DEFLATED) as z:
    for carpeta, _, archivos in os.walk(RAIZ):
        for a in archivos:
            ruta = os.path.join(carpeta, a)
            z.write(ruta, os.path.relpath(ruta, RAIZ))
print('tamaño:', os.path.getsize('plantilla-preparada.docx') // 1024, 'KB')
