begin;
-- Service-only entry points: the actor is supplied by the authenticated HTTP route.
-- Registration locks use a consistent order; the existing single-edit RPC remains
-- authoritative for group/service validation, scope, history and audit.
create function public.bulk_update_registration_operation(
  p_event_id uuid, p_registration_ids uuid[], p_actor_user_id uuid,
  p_field text, p_value uuid
) returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; n integer; tags jsonb;
begin
  if not exists(select 1 from public.event_user_roles where user_id=p_actor_user_id
    and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event_id))) then
    raise insufficient_privilege using message='Forbidden';
  end if;
  n := cardinality(p_registration_ids);
  if n is null or n < 1 or n > 100 or p_value is null or p_field is null or p_field not in ('tags','group','service')
    or n <> (select count(distinct id) from unnest(p_registration_ids) id) then
    raise check_violation using message='Invalid selection';
  end if;
  -- Lock all rows before evaluating eligibility or changing any of them.
  perform id from public.registrations where id=any(p_registration_ids) order by id for update;
  if n <> (select count(*) from public.registrations where id=any(p_registration_ids) and event_id=p_event_id and deleted_at is null) then
    raise check_violation using message='Selection is no longer available';
  end if;
  if p_field='tags' then
    perform id from public.operational_tags where id=p_value and event_id=p_event_id for key share;
    if not found then raise check_violation using message='Invalid tag'; end if;
  end if;
  for r in select id,participant_id from public.registrations where id=any(p_registration_ids) order by id loop
    if p_field='tags' then
      -- Add one tag without replacing any existing event tag.
      select coalesce(jsonb_agg(tag_id),'[]'::jsonb) into tags from (
        select pt.tag_id from public.participant_operational_tags pt
        join public.operational_tags t on t.id=pt.tag_id
        where pt.participant_id=r.participant_id and t.event_id=p_event_id
        union select p_value
      ) selected;
    else tags := jsonb_build_array(p_value);
    end if;
    perform public.update_registration_operation(r.id,r.participant_id,p_actor_user_id,p_field,tags);
  end loop;
  return n;
end $$;
revoke all on function public.bulk_update_registration_operation(uuid,uuid[],uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.bulk_update_registration_operation(uuid,uuid[],uuid,text,uuid) to service_role;

create function public.delete_operational_tag(p_event_id uuid,p_tag_id uuid,p_actor_user_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare tag public.operational_tags; n integer;
begin
  if not exists(select 1 from public.event_user_roles where user_id=p_actor_user_id
    and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event_id))) then
    raise insufficient_privilege using message='Forbidden';
  end if;
  select * into strict tag from public.operational_tags where id=p_tag_id and event_id=p_event_id for update;
  select count(*) into n from public.participant_operational_tags where tag_id=tag.id;
  -- The existing FK removes assignments, including those on archived registrations.
  delete from public.operational_tags where id=tag.id;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'operational_tag.deleted','operational_tags',tag.id,
      jsonb_build_object('label',tag.label,'color',tag.color,'removed_assignments',n));
  return n;
end $$;
revoke all on function public.delete_operational_tag(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_operational_tag(uuid,uuid,uuid) to service_role;
commit;
