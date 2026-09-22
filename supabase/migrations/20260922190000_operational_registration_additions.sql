-- Operational additions share the same current assignment/event authorization.
begin;
create function public.lock_operational_registration(p_registration_id uuid, p_actor_user_id uuid)
returns public.registrations language plpgsql security invoker set search_path = '' as $$
declare registration public.registrations%rowtype;
begin
  select * into registration from public.registrations where id = p_registration_id for update;
  if not found or registration.deleted_at is not null then
    raise exception 'Registration unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_user_roles where user_id = p_actor_user_id
      and ((role = 'admin' and event_id is null) or (role = 'manager' and event_id = registration.event_id)))
    and not exists (
      with recursive scope as (
        select g.id from public.groups g
          join public.group_memberships m on m.group_id = g.id
          join public.events e on e.id = g.event_id
        where m.user_id = p_actor_user_id and m.role = 'capogruppo'
          and e.is_current and g.event_id = registration.event_id and g.is_active
        union
        select g.id from public.groups g join scope s on g.parent_group_id = s.id
          where g.event_id = registration.event_id and g.is_active
      ) select 1 from public.participant_group_assignments a join scope s on s.id = a.group_id
        where a.registration_id = registration.id and a.is_current
    ) then raise exception 'Registration outside scope' using errcode = '42501';
  end if;
  return registration;
end;
$$;
revoke all on function public.lock_operational_registration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lock_operational_registration(uuid, uuid) to service_role;

create function public.add_operational_child(p_registration_id uuid, p_actor_user_id uuid, p_child_id uuid, p_child jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
 registration public.registrations%rowtype;
 child public.registration_children%rowtype;
 next_position smallint;
 birthday date;
begin
 registration := public.lock_operational_registration(p_registration_id, p_actor_user_id);
 if p_child_id is null or jsonb_typeof(p_child) is distinct from 'object'
   or jsonb_typeof(p_child->'first_name') is distinct from 'string'
   or jsonb_typeof(p_child->'last_name') is distinct from 'string'
   or jsonb_typeof(p_child->'birth_date') is distinct from 'string'
   or char_length(btrim(p_child->>'first_name')) not between 1 and 120
   or char_length(btrim(p_child->>'last_name')) not between 1 and 120
   or (p_child->>'birth_date') !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'Invalid child' using errcode = '22023';
 end if;
 birthday := (p_child->>'birth_date')::date;
 if birthday > (now() at time zone 'UTC')::date then
   raise exception 'Future birth date' using errcode = '22023';
 end if;
 -- The same request ID can be retried after a lost response without duplication.
 select * into child from public.registration_children where id = p_child_id;
 if found then
   if child.registration_id = registration.id and child.first_name = btrim(p_child->>'first_name')
      and child.last_name = btrim(p_child->>'last_name') and child.birth_date = birthday then return; end if;
   raise exception 'Child request already used' using errcode = 'PT409';
 end if;
 select n into next_position from generate_series(1,10) n
   where not exists(select 1 from public.registration_children c where c.registration_id = registration.id and c.position = n)
   order by n limit 1;
 if next_position is null then raise exception 'Maximum children reached' using errcode = '22023'; end if;
 insert into public.registration_children(id,registration_id,position,first_name,last_name,birth_date)
 values(p_child_id,registration.id,next_position,btrim(p_child->>'first_name'),btrim(p_child->>'last_name'),birthday)
 returning * into child;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(registration.event_id,p_actor_user_id,'registration_child.created','registration_children',child.id,
   jsonb_build_object('registration_id',registration.id,'before',null,'after',to_jsonb(child)));
end;
$$;
revoke all on function public.add_operational_child(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.add_operational_child(uuid,uuid,uuid,jsonb) to service_role;

create function public.get_operational_accessibility(p_registration_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
 perform public.lock_operational_registration(p_registration_id,p_actor_user_id);
 return (select jsonb_build_object('answers',washington_group_answers,'version',updated_at)
   from public.accessibility_needs where registration_id=p_registration_id);
end;
$$;
revoke all on function public.get_operational_accessibility(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_operational_accessibility(uuid,uuid) to service_role;

create function public.update_operational_accessibility(p_registration_id uuid,p_actor_user_id uuid,p_expected jsonb,p_answers jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 registration public.registrations%rowtype;
 previous public.accessibility_needs%rowtype;
 current_data jsonb;
 new_answers jsonb;
begin
 registration := public.lock_operational_registration(p_registration_id,p_actor_user_id);
 select * into previous from public.accessibility_needs where registration_id=registration.id for update;
 if found then current_data := jsonb_build_object('answers',previous.washington_group_answers,'version',previous.updated_at); end if;
 if p_expected is distinct from current_data then
   raise exception 'Accessibility changed; reload before saving' using errcode='PT409';
 end if;
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers' using errcode='22023'; end if;
 if (p_answers - array['hearing','walkingOrSteps','wheelchairOrMobilityAid']) <> '{}'::jsonb
   or (select count(*) from jsonb_each(p_answers)) <> 3
   or exists(select 1 from jsonb_each(p_answers) where jsonb_typeof(value) <> 'boolean') then
   raise exception 'Invalid answers' using errcode='22023';
 end if;
 -- Preserve historical questionnaire keys and the separate support callback flag.
 new_answers := coalesce(previous.washington_group_answers,'{}'::jsonb) || p_answers;
 insert into public.accessibility_needs(registration_id,washington_group_answers)
 values(registration.id,new_answers)
 on conflict(registration_id) do update set washington_group_answers=excluded.washington_group_answers;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(registration.event_id,p_actor_user_id,'registration.accessibility_updated','registrations',registration.id,
   jsonb_build_object('before',previous.washington_group_answers,'after',new_answers));
 return public.get_operational_accessibility(registration.id,p_actor_user_id);
end;
$$;
revoke all on function public.update_operational_accessibility(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.update_operational_accessibility(uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
