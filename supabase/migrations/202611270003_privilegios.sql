create table public.uso_ia (
  uso_id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(organizacion_id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  creada_el timestamptz not null default now()
);

create index uso_ia_usuario_fecha_idx
  on public.uso_ia (usuario_id, creada_el desc);

alter table public.uso_ia enable row level security;

create or replace function public.registrar_uso_ia()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := (select auth.uid());
  organizacion uuid;
  cantidad integer;
begin
  if usuario is null then
    return false;
  end if;

  select miembros.organizacion_id
    into organizacion
    from public.miembros
    where miembros.usuario_id = usuario
    order by miembros.organizacion_id
    limit 1;

  if organizacion is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(usuario::text), hashtext('uso_ia'));

  delete from public.uso_ia
    where usuario_id = usuario
      and creada_el < now() - interval '1 hour';

  select count(*)::integer
    into cantidad
    from public.uso_ia
    where usuario_id = usuario
      and creada_el >= now() - interval '1 hour';

  if cantidad >= 20 then
    return false;
  end if;

  insert into public.uso_ia (organizacion_id, usuario_id)
    values (organizacion, usuario);
  return true;
end;
$$;

revoke all on function public.registrar_uso_ia() from public, anon;
grant execute on function public.registrar_uso_ia() to authenticated;

revoke truncate, references, trigger on table
  public.organizaciones,
  public.miembros,
  public.cuentas,
  public.plantillas_banco,
  public.reglas,
  public.conciliaciones,
  public.uso_ia
from authenticated;

revoke all on table public.uso_ia from anon, authenticated;
