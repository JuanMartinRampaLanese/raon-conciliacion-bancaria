create or replace function private.es_owner(organizacion uuid)
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
      and rol = 'owner'
  );
$$;

revoke all on function private.es_owner(uuid) from public;
grant execute on function private.es_owner(uuid) to authenticated;

drop policy if exists miembros_insert on public.miembros;
drop policy if exists miembros_update on public.miembros;
drop policy if exists miembros_delete on public.miembros;
revoke insert, update, delete on table public.miembros from authenticated;

drop policy if exists organizaciones_insert on public.organizaciones;
drop policy if exists organizaciones_update on public.organizaciones;
drop policy if exists organizaciones_delete on public.organizaciones;
revoke insert, delete on table public.organizaciones from authenticated;

create policy organizaciones_update_owner on public.organizaciones
  for update to authenticated
  using ((select private.es_owner(organizacion_id)))
  with check ((select private.es_owner(organizacion_id)));

drop policy if exists conciliaciones_update on public.conciliaciones;
drop policy if exists conciliaciones_delete on public.conciliaciones;
revoke update on table public.conciliaciones from authenticated;

create policy conciliaciones_delete_owner on public.conciliaciones
  for delete to authenticated
  using ((select private.es_owner(organizacion_id)));
