begin;
-- A dedicated edit of the existing declaration, not a group reassignment.
create function public.get_operational_association(p_registration_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.registrations%rowtype; q public.registration_questionnaire_answers%rowtype;
begin
  r := public.lock_assisted_demographics(p_registration_id, p_actor_user_id);
  perform 1 from public.event_user_roles where user_id = p_actor_user_id
    and ((role = 'admin' and event_id is null) or (role = 'manager' and event_id = r.event_id)) for share;
  if not found then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into q from public.registration_questionnaire_answers where registration_id = r.id
    order by created_at desc, id desc limit 1 for update;
  return jsonb_build_object('questionnaireId', q.id, 'association',
    case when jsonb_typeof(q.answers->'externalGroupAssociation') = 'string' then q.answers->>'externalGroupAssociation' else null end);
end $$;
revoke all on function public.get_operational_association(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_operational_association(uuid,uuid) to service_role;

create function public.update_operational_association(p_registration_id uuid, p_actor_user_id uuid, p_expected jsonb, p_value text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_data jsonb; r public.registrations%rowtype; value text;
begin
  current_data := public.get_operational_association(p_registration_id, p_actor_user_id);
  select * into r from public.registrations where id = p_registration_id;
  if current_data is distinct from p_expected then raise exception 'Association changed' using errcode = 'PT409'; end if;
  if length(p_value) > 200 then raise exception 'Invalid association' using errcode = '22023'; end if;
  value := nullif(btrim(p_value), '');
  if value is not distinct from nullif(btrim(current_data->>'association'), '') then return current_data; end if;
  if current_data->>'questionnaireId' is null then
    insert into public.registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
      values(r.id,r.event_id,'2026-10-02-operational-association',jsonb_build_object('externalGroupAssociation',value));
  else
    update public.registration_questionnaire_answers set answers = answers || jsonb_build_object('externalGroupAssociation',value)
      where id = (current_data->>'questionnaireId')::uuid;
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(r.event_id,p_actor_user_id,'registration.association_updated','registrations',r.id,
      jsonb_build_object('fields',array['externalGroupAssociation']));
  return public.get_operational_association(r.id,p_actor_user_id);
end $$;
revoke all on function public.update_operational_association(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.update_operational_association(uuid,uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
