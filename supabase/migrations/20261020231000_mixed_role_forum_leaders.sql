-- Explicit leader membership grants Forum access even when the user also has an operational role.
-- Manager/Viewer alone still grant no group booking scope.
begin;
create or replace function app.leader_panel_group_scope_for_user(p_event_id uuid,p_user_id uuid)
returns setof uuid language sql stable security definer
set search_path = public, pg_temp as $$
  with recursive scope as (
    select g.id from public.groups g
    join public.group_memberships m on m.group_id = g.id
    where m.user_id = p_user_id and m.role = 'capogruppo'
      and g.event_id = p_event_id and g.is_active
      and exists (select 1 from public.events e where e.id = p_event_id and e.is_current)

    union
    select g.id from public.groups g join scope s on g.parent_group_id = s.id
    where g.event_id = p_event_id and g.is_active
  ) select id from scope;
$$;
commit;
