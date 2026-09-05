-- One registration lock and one transaction for every quick edit and its audit.
begin;
create function public.update_registration_operation(
  p_registration_id uuid, p_participant_id uuid, p_actor_user_id uuid,
  p_field text, p_value jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare r public.registrations; is_admin boolean; target_id uuid; selected_tags uuid[]; previous_value jsonb; contact_id uuid;
begin
  select * into strict r from public.registrations where id=p_registration_id and participant_id=p_participant_id and deleted_at is null for update;
  select exists(select 1 from public.event_user_roles where user_id=p_actor_user_id and role='admin' and event_id is null) into is_admin;
  if not is_admin and not exists(select 1 from public.event_user_roles where user_id=p_actor_user_id and role='manager' and event_id=r.event_id) then
    raise insufficient_privilege using message='Forbidden';
  end if;
  if p_field='group' then
    target_id := nullif(p_value->>0,'')::uuid;
    if target_id is not null and not exists(select 1 from public.groups where id=target_id and event_id=r.event_id and is_assignable and is_active) then
      raise check_violation using message='Invalid group';
    end if;
    select to_jsonb(group_id) into previous_value from public.participant_group_assignments where registration_id=r.id and is_current;
    update public.participant_group_assignments set is_current=false where registration_id=r.id and is_current;
    if target_id is not null then
      insert into public.participant_group_assignments(registration_id,group_id,status,source,is_current,assignment_reason,matcher_version)
        values(r.id,target_id,'confirmed',case when is_admin then 'admin' else 'manager' end,true,'operator_updated_group','operations-v2')
        on conflict(registration_id,group_id) do update set is_current=true,status='confirmed',source=excluded.source,
          assignment_reason=excluded.assignment_reason,matcher_version=excluded.matcher_version;
    end if;
  elsif p_field='service' then
    target_id := nullif(p_value->>0,'')::uuid;
    if target_id is not null and not exists(select 1 from public.event_services where id=target_id and event_id=r.event_id and is_active) then
      raise check_violation using message='Invalid service';
    end if;
    select jsonb_build_object('service_id',service_id,'status',status) into previous_value from public.participant_event_services where registration_id=r.id;
    if target_id is null then
      delete from public.participant_event_services where registration_id=r.id;
    else
      insert into public.participant_event_services(event_id,registration_id,participant_id,service_id,status,source,assigned_at,decided_at,created_by,updated_by)
        values(r.event_id,r.id,r.participant_id,target_id,'assigned','manager',now(),now(),p_actor_user_id,p_actor_user_id)
        on conflict(event_id,participant_id) do update set service_id=excluded.service_id,status='assigned',source='manager',
          assigned_at=now(),decided_at=now(),updated_by=p_actor_user_id;
    end if;
  elsif p_field='tags' then
    select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into selected_tags from jsonb_array_elements_text(p_value);
    if exists(select 1 from unnest(selected_tags) tag_id where not exists(select 1 from public.operational_tags where id=tag_id and event_id=r.event_id)) then
      raise check_violation using message='Invalid tag';
    end if;
    select coalesce(jsonb_agg(pt.tag_id),'[]'::jsonb) into previous_value from public.participant_operational_tags pt join public.operational_tags t on t.id=pt.tag_id where pt.participant_id=r.participant_id and t.event_id=r.event_id;
    delete from public.participant_operational_tags pt using public.operational_tags t
      where pt.tag_id=t.id and pt.participant_id=r.participant_id and t.event_id=r.event_id and not(pt.tag_id=any(selected_tags));
    insert into public.participant_operational_tags(participant_id,tag_id,assigned_by)
      select r.participant_id,unnest(selected_tags),p_actor_user_id on conflict(participant_id,tag_id) do nothing;
  elsif p_field='identity' then
    if jsonb_typeof(p_value)<>'object' or p_value='{}'::jsonb then raise check_violation using message='Invalid identity'; end if;
    if (p_value ? 'firstName' and coalesce(char_length(trim(p_value->>'firstName')),0)=0)
      or (p_value ? 'lastName' and coalesce(char_length(trim(p_value->>'lastName')),0)=0) then
      raise check_violation using message='Name is required';
    end if;
    update public.participants set
      first_name=case when p_value ? 'firstName' then p_value->>'firstName' else first_name end,
      last_name=case when p_value ? 'lastName' then p_value->>'lastName' else last_name end,
      birth_date=case when p_value ? 'birthDate' then (p_value->>'birthDate')::date else birth_date end,
      city_other=case when p_value ? 'city' then p_value->>'city' else city_other end,
      country_other=case when p_value ? 'country' then p_value->>'country' else country_other end
      where id=r.participant_id;
    if p_value ? 'email' or p_value ? 'phone' then
      select id into contact_id from public.participant_contacts where participant_id=r.participant_id and is_primary order by id limit 1 for update;
      if contact_id is not null then
        update public.participant_contacts set
          email=case when p_value ? 'email' then lower(p_value->>'email')::extensions.citext else email end,
          phone=case when p_value ? 'phone' then p_value->>'phone' else phone end where id=contact_id;
      elsif coalesce(p_value->>'email',p_value->>'phone') is not null then
        insert into public.participant_contacts(participant_id,email,phone,is_primary)
          values(r.participant_id,lower(p_value->>'email'),p_value->>'phone',true);
      end if;
    end if;
  else
    raise check_violation using message='Invalid operation';
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(r.event_id,p_actor_user_id,'participant.operation_updated','registrations',r.id,
      case when p_field='identity' then jsonb_build_object('field',p_field,'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_value) k)) else jsonb_build_object('field',p_field,'previous',previous_value,'value',p_value) end);
end $$;
revoke all on function public.update_registration_operation(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.update_registration_operation(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
