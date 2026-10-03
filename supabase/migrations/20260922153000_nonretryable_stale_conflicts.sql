-- Application-level stale data is a terminal HTTP 409, not a retryable
-- PostgreSQL serialization failure (40001). PostgREST 14 retries 40001 forever.
-- Preserve signatures, bodies, privileges and locking except for error codes.

create or replace function public.commit_participant_import(
 p_import_id uuid,p_event_id uuid,p_actor_user_id uuid,p_version text,p_payload_hash text,p_rows jsonb,p_skipped jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.participant_imports; item jsonb; pid uuid; rid uuid; imported integer:=0; row_ids jsonb:='{}'; candidate jsonb; other_id uuid;
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 perform pg_advisory_xact_lock(hashtextextended(p_import_id::text,0));
 select * into prior from public.participant_imports where id=p_import_id;
 if found then
  if prior.event_id<>p_event_id or prior.actor_user_id<>p_actor_user_id or prior.payload_hash<>p_payload_hash then raise check_violation using message='Import identity mismatch'; end if;
  return jsonb_build_object('imported',prior.imported_count,'skipped',prior.skipped_count,'replayed',true);
 end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_typeof(p_skipped)<>'array' or jsonb_array_length(p_rows)+jsonb_array_length(p_skipped) not between 1 and 500 then
  raise check_violation using message='Invalid import size';
 end if;
 -- Short-lived locks close the gap between validation and writes, including
 -- concurrent manual entry, quick edits and another import. No locks at preview.
 lock table public.events,public.event_user_roles,public.registrations,public.participants,public.participant_contacts,public.groups,public.event_services,public.operational_tags,public.participant_group_assignments,public.participant_event_services,public.participant_operational_tags,public.registration_children,public.event_attendance_choices,public.duplicate_reviews,public.check_ins,public.moment_attendance_choices,public.accessibility_needs in share row exclusive mode;
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if public.quality_event_version(p_event_id,p_actor_user_id)<>p_version then raise sqlstate 'PT409' using message='Preview stale'; end if;
 if not exists(select 1 from public.events where id=p_event_id and is_current) then raise check_violation using message='Current event changed'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if char_length(trim(item->>'firstName')) not between 2 and 120 or char_length(trim(item->>'lastName')) not between 2 and 120
   or item->>'consent'<>'si' or nullif(item->>'privacyVersion','') is null or (item->>'consentDate')::date > current_date
   or coalesce(nullif(item->>'email',''),nullif(item->>'phone','')) is null then raise check_violation using message='Invalid participant'; end if;
  insert into public.participants(first_name,last_name,birth_date,country_other,city_other,participates_with_group)
   values(item->>'firstName',item->>'lastName',nullif(item->>'birthDate','')::date,nullif(item->>'country',''),nullif(item->>'city',''),nullif(item->>'groupId','') is not null) returning id into pid;
  insert into public.registrations(event_id,participant_id,status,source,created_by)
   values(p_event_id,pid,(item->>'status')::public.registration_status,'import',p_actor_user_id) returning id into rid;
  insert into public.participant_contacts(participant_id,email,phone,is_primary)
   values(pid,nullif(item->>'email',''),nullif(item->>'phone',''),true);
  insert into public.participant_consents(registration_id,privacy_version,privacy_accepted_at,data_processing_accepted,accepted_by_user_id)
   values(rid,item->>'privacyVersion',(item->>'consentDate')::date,true,p_actor_user_id);
  insert into public.event_attendance_choices(registration_id,choice) values(rid,'unknown');
  insert into public.qr_tokens(registration_id,token_hash,token_encrypted,created_by)
   values(rid,item->>'qrHash',item->>'qrEncrypted',p_actor_user_id);
  if nullif(item->>'groupId','') is not null then perform public.update_registration_operation(rid,pid,p_actor_user_id,'group',jsonb_build_array(item->>'groupId')); end if;
  if nullif(item->>'serviceId','') is not null then
   perform public.update_registration_operation(rid,pid,p_actor_user_id,'service',jsonb_build_array(item->>'serviceId'));
   update public.participant_event_services set status=coalesce(nullif(item->>'serviceStatus',''),'assigned'),
    assigned_at=case when coalesce(nullif(item->>'serviceStatus',''),'assigned')='assigned' then now() else null end where registration_id=rid;
  end if;
  perform public.update_registration_operation(rid,pid,p_actor_user_id,'tags',coalesce(item->'tagIds','[]'::jsonb));
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(p_event_id,p_actor_user_id,'registration.imported','registrations',rid,jsonb_build_object('import_id',p_import_id,'row',item->'row','distinct_reason',item->'distinctReason','duplicate_candidates',item->'candidates'));
  row_ids:=row_ids||jsonb_build_object('row-'||(item->>'row'),rid);
  imported:=imported+1;
 end loop;
 -- Remember explicit distinct-person decisions for both existing and file rows.
 for item in select value from jsonb_array_elements(p_rows) loop
  rid:=(row_ids->>('row-'||(item->>'row')))::uuid;
  for candidate in select value from jsonb_array_elements(coalesce(item->'candidates','[]'::jsonb)) loop
   other_id:=case when candidate->>'id' like 'row-%' then (row_ids->>(candidate->>'id'))::uuid else (candidate->>'id')::uuid end;
   if other_id is null then continue; end if; -- discarded file row
   if not exists(select 1 from public.registrations where id=other_id and event_id=p_event_id and deleted_at is null)
    or char_length(trim(item->>'distinctReason')) not between 3 and 500 then raise check_violation using message='Invalid distinct decision'; end if;
   insert into public.duplicate_reviews(event_id,left_id,right_id,decision,left_fingerprint,right_fingerprint,reason,actor_user_id)
    values(p_event_id,least(rid,other_id),greatest(rid,other_id),'not_duplicate',
      case when rid<other_id then item->>'fingerprint' else candidate->>'fingerprint' end,
      case when rid<other_id then candidate->>'fingerprint' else item->>'fingerprint' end,item->>'distinctReason',p_actor_user_id)
    on conflict(event_id,left_id,right_id) do nothing;
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'duplicate.false_positive','registrations',rid,jsonb_build_object('other_id',other_id,'reason',item->>'distinctReason','import_id',p_import_id));
  end loop;
 end loop;
 for item in select value from jsonb_array_elements(p_skipped) loop
  if char_length(trim(item->>'reason')) not between 3 and 500 then raise check_violation using message='Skip reason required'; end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(p_event_id,p_actor_user_id,'import.row_skipped','participant_imports',p_import_id,item);
 end loop;
 insert into public.participant_imports(id,event_id,actor_user_id,payload_hash,imported_count,skipped_count)
  values(p_import_id,p_event_id,p_actor_user_id,p_payload_hash,imported,jsonb_array_length(p_skipped));
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
  values(p_event_id,p_actor_user_id,'import.committed','participant_imports',p_import_id,jsonb_build_object('imported',imported,'skipped',jsonb_array_length(p_skipped)));
 return jsonb_build_object('imported',imported,'skipped',jsonb_array_length(p_skipped),'replayed',false);
end $$;

create or replace function public.review_participant_duplicate(
 p_event_id uuid,p_actor_user_id uuid,p_left_id uuid,p_right_id uuid,p_decision text,p_keep_id uuid,p_reason text,p_version text,p_left_fingerprint text,p_right_fingerprint text
) returns void language plpgsql security invoker set search_path='' as $$
declare a public.registrations; b public.registrations; keep public.registrations; lose public.registrations; kp public.participants; lp public.participants; kc public.participant_contacts; lc public.participant_contacts; ids jsonb;
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if p_left_id>=p_right_id or p_decision not in ('not_duplicate','merged') or char_length(trim(p_reason)) not between 3 and 500 then raise check_violation using message='Invalid review'; end if;
 lock table public.event_user_roles,public.registrations,public.participants,public.participant_contacts,public.groups,public.event_services,public.operational_tags,public.participant_group_assignments,public.participant_event_services,public.participant_operational_tags,public.registration_children,public.event_attendance_choices,public.duplicate_reviews,public.check_ins,public.moment_attendance_choices,public.accessibility_needs in share row exclusive mode;
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if public.quality_event_version(p_event_id,p_actor_user_id)<>p_version then raise sqlstate 'PT409' using message='Review stale'; end if;
 select * into strict a from public.registrations where id=p_left_id and event_id=p_event_id and deleted_at is null;
 select * into strict b from public.registrations where id=p_right_id and event_id=p_event_id and deleted_at is null;
 if p_decision='merged' then
  if p_keep_id=a.id then keep:=a; lose:=b; elsif p_keep_id=b.id then keep:=b; lose:=a; else raise check_violation using message='Choose survivor'; end if;
  select * into strict kp from public.participants where id=keep.participant_id;
  select * into strict lp from public.participants where id=lose.participant_id;
  -- Never detach an account or alter another event through a scoped merge.
  if lp.auth_user_id is not null then raise check_violation using message='Keep the account-linked record; two accounts require dedicated review'; end if;
  if exists(select 1 from public.registrations where participant_id in (lp.id,kp.id) and event_id<>p_event_id) then raise check_violation using message='Multiple-event identity requires dedicated review'; end if;
  update public.participants set birth_date=coalesce(kp.birth_date,lp.birth_date),country_other=coalesce(nullif(kp.country_other,''),lp.country_other),city_other=coalesce(nullif(kp.city_other,''),lp.city_other) where id=kp.id;
  select * into kc from public.participant_contacts where participant_id=kp.id and is_primary order by id limit 1;
  select * into lc from public.participant_contacts where participant_id=lp.id and is_primary order by id limit 1;
  if kc.id is not null then update public.participant_contacts set email=coalesce(kc.email,lc.email),phone=coalesce(kc.phone,lc.phone) where id=kc.id;
  elsif lc.id is not null then insert into public.participant_contacts(participant_id,email,phone,is_primary) values(kp.id,lc.email,lc.phone,true); end if;
  if not exists(select 1 from public.participant_group_assignments where registration_id=keep.id and is_current) then
   select jsonb_build_array(group_id) into ids from public.participant_group_assignments where registration_id=lose.id and is_current;
   if ids is not null then perform public.update_registration_operation(keep.id,kp.id,p_actor_user_id,'group',ids); end if;
  end if;
  if not exists(select 1 from public.participant_event_services where registration_id=keep.id) then
   insert into public.participant_event_services(event_id,registration_id,participant_id,service_id,status,source,participant_note,operator_note,assigned_at,decided_at,created_by,updated_by)
    select event_id,keep.id,kp.id,service_id,status,source,participant_note,operator_note,assigned_at,decided_at,p_actor_user_id,p_actor_user_id from public.participant_event_services where registration_id=lose.id;
  end if;
  insert into public.participant_operational_tags(participant_id,tag_id,assigned_by)
   select kp.id,pt.tag_id,p_actor_user_id from public.participant_operational_tags pt join public.operational_tags t on t.id=pt.tag_id where pt.participant_id=lp.id and t.event_id=p_event_id on conflict do nothing;
  insert into public.event_attendance_choices(registration_id,day,day_part,choice)
   select keep.id,day,day_part,choice from public.event_attendance_choices where registration_id=lose.id on conflict do nothing;
  -- Children and sensitive/questionnaire/attendance/check-in history are never
  -- silently deduplicated. Such cases need dedicated reconciliation first.
  if exists(select 1 from public.registration_children where registration_id=lose.id)
    or exists(select 1 from public.moment_attendance_choices where registration_id=lose.id)
    or exists(select 1 from public.check_ins where registration_id=lose.id)
    or exists(select 1 from public.accessibility_needs where registration_id=lose.id and (operational_notes is not null or washington_group_answers::text like '%true%')) then
    raise check_violation using message='Dependent records require dedicated review before merging';
  end if;
  perform public.set_registration_deleted(lose.id,lp.id,p_actor_user_id,p_reason);
  update public.registrations set merged_into_id=keep.id where id=lose.id;
 end if;
 insert into public.duplicate_reviews(event_id,left_id,right_id,decision,left_fingerprint,right_fingerprint,reason,actor_user_id)
  values(p_event_id,a.id,b.id,p_decision,p_left_fingerprint,p_right_fingerprint,p_reason,p_actor_user_id)
  on conflict(event_id,left_id,right_id) do update set decision=excluded.decision,left_fingerprint=excluded.left_fingerprint,right_fingerprint=excluded.right_fingerprint,reason=excluded.reason,actor_user_id=excluded.actor_user_id,created_at=now();
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
  values(p_event_id,p_actor_user_id,case when p_decision='merged' then 'participant.merged' else 'duplicate.false_positive' end,'registrations',a.id,jsonb_build_object('left_id',a.id,'right_id',b.id,'keep_id',p_keep_id,'reason',p_reason,'history_retained',true));
end $$;

create or replace function public.update_operational_child(
  p_child_id uuid, p_actor_user_id uuid, p_expected jsonb, p_child jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  registration public.registrations%rowtype;
  child public.registration_children%rowtype;
  before_data jsonb;
  birthday date;
  new_first_name text;
  new_last_name text;
begin
  select r.* into registration from public.registrations r
    join public.registration_children c on c.registration_id = r.id
    where c.id = p_child_id for update of r;
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
  select * into child from public.registration_children where id = p_child_id and registration_id = registration.id for update;
  if not found then raise exception 'Child unavailable' using errcode = '42501'; end if;
  before_data := jsonb_build_object('first_name', child.first_name, 'last_name', child.last_name, 'birth_date', child.birth_date);
  if p_expected is distinct from before_data then
    raise exception 'Child changed; reload before saving' using errcode = 'PT409';
  end if;

  if p_child is null then
    delete from public.registration_children where id = child.id;
  else
    if jsonb_typeof(p_child) <> 'object' or jsonb_typeof(p_child->'first_name') is distinct from 'string'
       or jsonb_typeof(p_child->'last_name') is distinct from 'string'
       or jsonb_typeof(p_child->'birth_date') is distinct from 'string' then
      raise exception 'Invalid child' using errcode = '22023';
    end if;
    new_first_name := btrim(p_child->>'first_name'); new_last_name := btrim(p_child->>'last_name');
    if char_length(new_first_name) not between 1 and 120 or char_length(new_last_name) not between 1 and 120
       or (p_child->>'birth_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid child' using errcode = '22023';
    end if;
    birthday := (p_child->>'birth_date')::date;
    if birthday > (now() at time zone 'UTC')::date then raise exception 'Future birth date' using errcode = '22023'; end if;
    update public.registration_children set first_name = new_first_name,
      last_name = new_last_name, birth_date = birthday where id = child.id;
  end if;
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(registration.event_id, p_actor_user_id,
      case when p_child is null then 'registration_child.deleted' else 'registration_child.updated' end,
      'registration_children', child.id,
      jsonb_build_object('registration_id', registration.id, 'before', to_jsonb(child), 'after',
        (select to_jsonb(c) from public.registration_children c where c.id = child.id)));
end;
$$;
