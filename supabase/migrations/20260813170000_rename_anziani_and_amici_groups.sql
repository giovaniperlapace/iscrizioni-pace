begin;

create temporary table group_name_renames (
  group_id uuid primary key,
  event_id uuid not null,
  old_name text not null,
  new_name text not null
) on commit drop;

insert into group_name_renames (group_id, event_id, old_name, new_name)
select
  id,
  event_id,
  name,
  case
    when name like 'W gli anziani - %'
      then regexp_replace(name, '^W gli anziani - ', 'Anziani - ')
    when name = 'Movimento "Gli amici" - San Bartolomeo'
      then 'Amici San Bartolomeo'
    when name = 'Movimento "Gli amici" - Sant''Egidio'
      then 'Amici Sant''Egidio'
  end
from public.groups
where name like 'W gli anziani - %'
   or name in (
     'Movimento "Gli amici" - San Bartolomeo',
     'Movimento "Gli amici" - Sant''Egidio'
   );

do $$
declare
  anziani_count integer;
  san_bartolomeo_count integer;
  sant_egidio_count integer;
begin
  select count(*)
  into anziani_count
  from group_name_renames
  where old_name like 'W gli anziani - %';

  select count(*)
  into san_bartolomeo_count
  from group_name_renames
  where old_name = 'Movimento "Gli amici" - San Bartolomeo';

  select count(*)
  into sant_egidio_count
  from group_name_renames
  where old_name = 'Movimento "Gli amici" - Sant''Egidio';

  if anziani_count <> 17
    or san_bartolomeo_count <> 1
    or sant_egidio_count <> 1 then
    raise exception
      'Unexpected source group counts: anziani %, San Bartolomeo %, Sant''Egidio %',
      anziani_count,
      san_bartolomeo_count,
      sant_egidio_count;
  end if;

  if exists (
    select 1
    from group_name_renames rename
    join public.groups existing
      on existing.event_id = rename.event_id
     and existing.name = rename.new_name
     and existing.id <> rename.group_id
  ) then
    raise exception 'A target group name already exists for the same event';
  end if;
end
$$;

update public.group_registration_links links
set
  public_label = renames.new_name,
  updated_at = now()
from group_name_renames renames
where links.group_id = renames.group_id
  and links.revoked_at is null
  and links.public_label = renames.old_name;

update public.groups groups
set
  name = renames.new_name,
  public_label = case
    when groups.public_label = renames.old_name then renames.new_name
    else groups.public_label
  end,
  updated_at = now()
from group_name_renames renames
where groups.id = renames.group_id;

insert into public.audit_logs (
  event_id,
  action,
  entity_table,
  entity_id,
  metadata
)
select
  event_id,
  'group.renamed',
  'groups',
  group_id,
  jsonb_build_object(
    'old_name', old_name,
    'new_name', new_name,
    'reason', 'production_group_name_cleanup'
  )
from group_name_renames;

notify pgrst, 'reload schema';

commit;
