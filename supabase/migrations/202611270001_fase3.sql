create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizaciones (
  organizacion_id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  creada_el timestamptz not null default now()
);

create table public.miembros (
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('owner', 'miembro')),
  creado_el timestamptz not null default now(),
  primary key (organizacion_id, usuario_id)
);

create table public.cuentas (
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  cuenta_id uuid not null default gen_random_uuid(),
  banco text not null check (length(trim(banco)) > 0),
  moneda text not null check (moneda in ('UYU', 'USD', 'ARS', 'EUR')),
  alias text not null check (length(trim(alias)) > 0),
  creada_el timestamptz not null default now(),
  primary key (organizacion_id, cuenta_id),
  unique (organizacion_id, banco, moneda)
);

create table public.plantillas_banco (
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  plantilla_id text not null,
  banco text not null check (length(trim(banco)) > 0),
  mapeo jsonb not null check (jsonb_typeof(mapeo) = 'object'),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now(),
  primary key (organizacion_id, plantilla_id)
);

create table public.reglas (
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  regla_id text not null,
  patron text not null check (length(trim(patron)) > 0),
  accion text not null check (accion in ('asignar_cliente', 'gasto_bancario')),
  cliente text,
  origen text not null check (origen in ('por_defecto', 'manual', 'revision')),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now(),
  primary key (organizacion_id, regla_id),
  check (accion <> 'asignar_cliente' or (cliente is not null and length(trim(cliente)) > 0))
);

create table public.conciliaciones (
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  conciliacion_id uuid not null default gen_random_uuid(),
  cuenta_id uuid not null,
  periodo text not null check (length(trim(periodo)) > 0),
  cantidad_banco integer not null check (cantidad_banco >= 0),
  cantidad_planilla integer not null check (cantidad_planilla >= 0),
  conciliados integer not null check (conciliados >= 0),
  dudosos integer not null check (dudosos >= 0),
  solo_banco integer not null check (solo_banco >= 0),
  solo_planilla integer not null check (solo_planilla >= 0),
  gastos_bancarios integer not null check (gastos_bancarios >= 0),
  porcentaje_conciliado_cantidad double precision not null check (porcentaje_conciliado_cantidad between 0 and 1),
  porcentaje_conciliado_monto double precision not null check (porcentaje_conciliado_monto between 0 and 1),
  totales_por_estado jsonb not null default '{}'::jsonb check (jsonb_typeof(totales_por_estado) = 'object'),
  cierre_ok boolean,
  creada_por uuid not null references auth.users(id),
  creada_el timestamptz not null default now(),
  primary key (organizacion_id, conciliacion_id),
  foreign key (organizacion_id, cuenta_id)
    references public.cuentas(organizacion_id, cuenta_id) on delete restrict
);

comment on table public.conciliaciones is
  'Sólo metadatos y totales agregados. Nunca contiene archivos ni movimientos bancarios.';

create index miembros_por_usuario on public.miembros(usuario_id, organizacion_id);
create index cuentas_por_organizacion on public.cuentas(organizacion_id);
create index plantillas_por_organizacion on public.plantillas_banco(organizacion_id);
create index reglas_por_organizacion on public.reglas(organizacion_id);
create index conciliaciones_historial on public.conciliaciones(organizacion_id, creada_el desc);

create or replace function private.es_miembro(organizacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros
    where organizacion_id = organizacion
      and usuario_id = (select auth.uid())
  );
$$;

revoke all on function private.es_miembro(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.es_miembro(uuid) to authenticated;

alter table public.organizaciones enable row level security;
alter table public.miembros enable row level security;
alter table public.cuentas enable row level security;
alter table public.plantillas_banco enable row level security;
alter table public.reglas enable row level security;
alter table public.conciliaciones enable row level security;

create policy organizaciones_select on public.organizaciones
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy organizaciones_insert on public.organizaciones
  for insert to authenticated
  with check ((select private.es_miembro(organizacion_id)));
create policy organizaciones_update on public.organizaciones
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy organizaciones_delete on public.organizaciones
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

create policy miembros_select on public.miembros
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy miembros_insert on public.miembros
  for insert to authenticated
  with check ((select private.es_miembro(organizacion_id)));
create policy miembros_update on public.miembros
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy miembros_delete on public.miembros
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

create policy cuentas_select on public.cuentas
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy cuentas_insert on public.cuentas
  for insert to authenticated
  with check ((select private.es_miembro(organizacion_id)));
create policy cuentas_update on public.cuentas
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy cuentas_delete on public.cuentas
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

create policy plantillas_select on public.plantillas_banco
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy plantillas_insert on public.plantillas_banco
  for insert to authenticated
  with check ((select private.es_miembro(organizacion_id)));
create policy plantillas_update on public.plantillas_banco
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy plantillas_delete on public.plantillas_banco
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

create policy reglas_select on public.reglas
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy reglas_insert on public.reglas
  for insert to authenticated
  with check ((select private.es_miembro(organizacion_id)));
create policy reglas_update on public.reglas
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy reglas_delete on public.reglas
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

create policy conciliaciones_select on public.conciliaciones
  for select to authenticated
  using ((select private.es_miembro(organizacion_id)));
create policy conciliaciones_insert on public.conciliaciones
  for insert to authenticated
  with check (
    (select private.es_miembro(organizacion_id))
    and creada_por = (select auth.uid())
  );
create policy conciliaciones_update on public.conciliaciones
  for update to authenticated
  using ((select private.es_miembro(organizacion_id)))
  with check ((select private.es_miembro(organizacion_id)));
create policy conciliaciones_delete on public.conciliaciones
  for delete to authenticated
  using ((select private.es_miembro(organizacion_id)));

revoke all on table public.organizaciones, public.miembros, public.cuentas,
  public.plantillas_banco, public.reglas, public.conciliaciones from anon;
grant select, insert, update, delete on table public.organizaciones, public.miembros,
  public.cuentas, public.plantillas_banco, public.reglas, public.conciliaciones to authenticated;

create or replace function private.crear_organizacion_en_primer_ingreso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nueva_organizacion uuid;
  nombre_organizacion text;
begin
  if new.last_sign_in_at is null then
    return new;
  end if;

  if exists (select 1 from public.miembros where usuario_id = new.id) then
    return new;
  end if;

  nombre_organizacion := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'organizacion'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Mi organización'
  );

  insert into public.organizaciones (nombre)
  values (nombre_organizacion)
  returning organizacion_id into nueva_organizacion;

  insert into public.miembros (organizacion_id, usuario_id, rol)
  values (nueva_organizacion, new.id, 'owner');

  insert into public.reglas (organizacion_id, regla_id, patron, accion, origen)
  values
    (nueva_organizacion, 'RG-01', 'COMISION', 'gasto_bancario', 'por_defecto'),
    (nueva_organizacion, 'RG-02', 'IVA COMISION', 'gasto_bancario', 'por_defecto'),
    (nueva_organizacion, 'RG-03', 'GASTOS BANCARIOS', 'gasto_bancario', 'por_defecto'),
    (nueva_organizacion, 'RG-04', 'MANTENIMIENTO DE CUENTA', 'gasto_bancario', 'por_defecto'),
    (nueva_organizacion, 'RG-05', 'IMPUESTO', 'gasto_bancario', 'por_defecto');

  return new;
end;
$$;

revoke all on function private.crear_organizacion_en_primer_ingreso() from public;

create trigger crear_organizacion_usuario_insertado
  after insert on auth.users
  for each row execute function private.crear_organizacion_en_primer_ingreso();

create trigger crear_organizacion_usuario_ingresado
  after update of last_sign_in_at on auth.users
  for each row execute function private.crear_organizacion_en_primer_ingreso();
