-- =============================================================================
-- esquema.sql — Base de datos del Sistema de Prácticas Profesionales
-- CECyTE Campeche · Plantel Felipe Carrillo Puerto
--
-- Se pega completo en Supabase → SQL Editor → Run. Se puede volver a correr
-- sin romper nada: todo está escrito para ser idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfiles: extiende auth.users con nombre, matrícula y rol.
-- -----------------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null default '',
  matricula   text not null default '',
  partes      jsonb,                      -- { ape_paterno, ape_materno, nombres }
  rol         text not null default 'estudiante'
              check (rol in ('estudiante', 'admin')),
  creado      timestamptz not null default now()
);

-- El perfil se crea solo en cuanto alguien se registra.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, matricula, partes)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'matricula', ''),
    new.raw_user_meta_data -> 'partes'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- -----------------------------------------------------------------------------
-- 2. Expedientes: UN renglón por alumno con todo el formato de anexos.
--    Lo que se filtra u ordena va en columnas; los campos del formulario
--    (solicitud, reportes, proyecto, fechas de oficios, observaciones…)
--    viajan en jsonb, así se pueden agregar campos sin migrar la tabla.
-- -----------------------------------------------------------------------------
create table if not exists public.expedientes (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null unique references auth.users(id) on delete cascade,
  alumno_nombre  text not null default '',
  alumno_correo  text not null default '',
  estado         text not null default 'entregado'
                 check (estado in ('en_captura', 'entregado', 'observado', 'aprobado')),
  datos          jsonb not null default '{}'::jsonb,
  fotos          jsonb not null default '[]'::jsonb,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);

create index if not exists expedientes_estado_idx      on public.expedientes (estado);
create index if not exists expedientes_actualizado_idx on public.expedientes (actualizado desc);
-- Búsqueda por empresa, control, especialidad o representante sin escanear
-- toda la tabla.
create index if not exists expedientes_datos_idx       on public.expedientes using gin (datos);

-- Si vienes de la versión anterior (tabla practicas), esto la retira sin
-- tocar los perfiles. Es seguro correrlo aunque no exista.
drop table if exists public.practicas;

-- -----------------------------------------------------------------------------
-- 3. Seguridad por fila. Sin esto, cualquiera con la clave pública podría
--    leer todo. Con esto, el alumno solo ve lo suyo y el administrador ve todo.
-- -----------------------------------------------------------------------------
alter table public.perfiles  enable row level security;
alter table public.expedientes enable row level security;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Perfiles ---------------------------------------------------------------
drop policy if exists "perfil propio visible" on public.perfiles;
create policy "perfil propio visible" on public.perfiles
  for select using (id = auth.uid() or public.es_admin());

drop policy if exists "perfil propio editable" on public.perfiles;
create policy "perfil propio editable" on public.perfiles
  for update using (id = auth.uid() or public.es_admin());

-- Expedientes ------------------------------------------------------------
drop policy if exists "expediente visible" on public.expedientes;
create policy "expediente visible" on public.expedientes
  for select using (alumno_id = auth.uid() or public.es_admin());

drop policy if exists "expediente propio insertable" on public.expedientes;
create policy "expediente propio insertable" on public.expedientes
  for insert with check (alumno_id = auth.uid() or public.es_admin());

drop policy if exists "expediente propio editable" on public.expedientes;
create policy "expediente propio editable" on public.expedientes
  for update using (alumno_id = auth.uid() or public.es_admin());

-- Solo administración borra expedientes.
drop policy if exists "expediente borrable" on public.expedientes;
create policy "expediente borrable" on public.expedientes
  for delete using (public.es_admin());

-- El alumno puede editar su expediente pero no cambiar el estado ni las
-- observaciones: esas columnas/llaves las custodia este disparador.
create or replace function public.proteger_revision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    new.estado := case when old.estado = 'en_captura' then 'entregado' else old.estado end;
    new.datos  := new.datos
      || jsonb_build_object('observaciones', old.datos -> 'observaciones')
      || jsonb_build_object(
           'fecha_presentacion',   old.datos -> 'fecha_presentacion',
           'fecha_aceptacion',     old.datos -> 'fecha_aceptacion',
           'fecha_terminacion',    old.datos -> 'fecha_terminacion',
           'fecha_liberacion',     old.datos -> 'fecha_liberacion',
           'fecha_agradecimiento', old.datos -> 'fecha_agradecimiento');
    new.datos := jsonb_strip_nulls(new.datos);
  end if;
  return new;
end;
$$;

drop trigger if exists al_editar_expediente on public.expedientes;
create trigger al_editar_expediente
  before update on public.expedientes
  for each row execute function public.proteger_revision();

-- La fecha de actualización se pone sola.
create or replace function public.marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_expediente on public.expedientes;
create trigger al_actualizar_expediente
  before update on public.expedientes
  for each row execute function public.marcar_actualizado();

-- =============================================================================
-- 4. Administrador
--    Primero crea el usuario root32@cecytecampeche.edu.mx desde
--    Authentication → Users → Add user (marca "Auto Confirm User")
--    con la contraseña CtrlAdminFCP. Después corre esto:
-- =============================================================================
update public.perfiles
set rol = 'admin', nombre = 'Administración del plantel'
where id = (select id from auth.users where email = 'root32@cecytecampeche.edu.mx');

-- Comprobación rápida:
-- select p.nombre, p.rol, u.email from public.perfiles p join auth.users u on u.id = p.id;
