-- A person has at most one level of manager access in each event.
-- Deliberately fail rather than choose a role if historical conflicts exist.
create unique index event_user_roles_manager_access_unique
  on public.event_user_roles(event_id, user_id)
  where role in ('manager', 'manager_viewer');

-- Removing a leader and recalculating the displayed contact is one transaction.
create or replace function public.remove_operational_role(
  p_actor_user_id uuid, p_user_id uuid, p_role public.app_role,
  p_event_id uuid default null, p_group_id uuid default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event_id uuid;
  v_primary boolean;
  v_count integer;
begin
  if p_actor_user_id is null or p_user_id is null or p_actor_user_id = p_user_id then
    raise exception 'self-role' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin','manager','manager_viewer','accoglienza','capogruppo') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_role = 'capogruppo' then
    select event_id into v_event_id from public.groups where id = p_group_id for update;
    if not found or v_event_id is distinct from p_event_id then
      raise exception 'invalid group' using errcode = '22023';
    end if;
  else
    v_event_id := p_event_id;
    if (p_role = 'admin' and p_event_id is not null) or (p_role <> 'admin' and p_event_id is null) then
      raise exception 'invalid event' using errcode = '22023';
    end if;
  end if;
  -- Lock the effective authorization row until the operation commits.
  perform 1 from public.event_user_roles
    where user_id = p_actor_user_id and
      ((role = 'admin' and event_id is null) or
       (p_role <> 'admin' and role = 'manager' and event_id = v_event_id))
    for share;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_role = 'capogruppo' then
    delete from public.group_memberships
      where user_id = p_user_id and group_id = p_group_id and role = 'capogruppo'
      returning is_primary into v_primary;
    get diagnostics v_count = row_count;
    if v_primary then
      update public.groups set primary_leader_name = (
        select coalesce(nullif(p.full_name,''),p.email)
        from public.group_memberships m left join public.profiles p on p.id = m.user_id
        where m.group_id = p_group_id and m.is_primary
        order by m.created_at, m.id limit 1
      ) where id = p_group_id;
    end if;
  else
    delete from public.event_user_roles where user_id = p_user_id and role = p_role
      and event_id is not distinct from v_event_id;
    get diagnostics v_count = row_count;
  end if;
  if v_count > 0 then
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(v_event_id,p_actor_user_id,'operational_user.role_deleted',
      case when p_role = 'capogruppo' then 'group_memberships' else 'event_user_roles' end,
      p_user_id,jsonb_build_object('role',p_role,'group_id',p_group_id));
  end if;
end $$;
revoke all on function public.remove_operational_role(uuid,uuid,public.app_role,uuid,uuid) from public, anon, authenticated;
grant execute on function public.remove_operational_role(uuid,uuid,public.app_role,uuid,uuid) to service_role;
