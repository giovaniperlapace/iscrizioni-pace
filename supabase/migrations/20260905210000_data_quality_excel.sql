-- Block 6. Additive schema; no existing participant is changed by this migration.
begin;
alter table public.registrations add column merged_into_id uuid references public.registrations(id);
create table public.duplicate_reviews (
 id uuid primary key default extensions.gen_random_uuid(),
 event_id uuid not null references public.events(id),
 left_id uuid not null references public.registrations(id),
 right_id uuid not null references public.registrations(id),
 decision text not null check(decision in ('not_duplicate','merged')),
 left_fingerprint text not null, right_fingerprint text not null,
 reason text not null check(char_length(trim(reason)) between 3 and 500),
 actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check(left_id < right_id), unique(event_id,left_id,right_id)
);
create table public.participant_imports (
 id uuid primary key,
 event_id uuid not null references public.events(id),
 actor_user_id uuid not null references auth.users(id),
 payload_hash text not null,
 imported_count integer not null, skipped_count integer not null,
 created_at timestamptz not null default now()
);
alter table public.duplicate_reviews enable row level security;
alter table public.participant_imports enable row level security;
create policy "operators read duplicate decisions" on public.duplicate_reviews for select to authenticated
 using(app.is_admin() or app.has_event_role(event_id,array['manager','manager_viewer']::public.app_role[]));
create policy "operators read import results" on public.participant_imports for select to authenticated
 using(app.is_admin() or app.has_event_role(event_id,array['manager','manager_viewer']::public.app_role[]));
grant select on public.duplicate_reviews,public.participant_imports to authenticated;
grant all on public.duplicate_reviews,public.participant_imports to service_role;

create function app.quality_authorize(e uuid,actor uuid,write_access boolean default true) returns void
language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.event_user_roles where user_id=actor and
   ((role='admin' and event_id is null) or (event_id=e and (role='manager' or (not write_access and role='manager_viewer'))))) then
  raise insufficient_privilege using message='Forbidden';
 end if;
end $$;
revoke all on function app.quality_authorize(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function app.quality_authorize(uuid,uuid,boolean) to service_role;

-- Database-derived optimistic concurrency token. Every input to preview, merge
-- and catalog resolution participates; not a client-supplied record count.
create function public.quality_event_version(p_event_id uuid,p_actor_user_id uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare result text;
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id,false);
 select md5(coalesce(string_agg(data,'|' order by data),'')) into result from (
  select 'r'||to_jsonb(t)::text data from public.registrations t where event_id=p_event_id
  union all select 'p'||to_jsonb(t)::text from public.participants t where id in (select participant_id from public.registrations where event_id=p_event_id)
  union all select 'c'||to_jsonb(t)::text from public.participant_contacts t where participant_id in (select participant_id from public.registrations where event_id=p_event_id)
  union all select 'g'||to_jsonb(t)::text from public.groups t where event_id=p_event_id
  union all select 's'||to_jsonb(t)::text from public.event_services t where event_id=p_event_id
  union all select 't'||to_jsonb(t)::text from public.operational_tags t where event_id=p_event_id
  union all select 'a'||to_jsonb(t)::text from public.participant_group_assignments t where registration_id in (select id from public.registrations where event_id=p_event_id)
  union all select 'ps'||to_jsonb(t)::text from public.participant_event_services t where event_id=p_event_id
  union all select 'pt'||to_jsonb(t)::text from public.participant_operational_tags t where tag_id in (select id from public.operational_tags where event_id=p_event_id)
  union all select 'ch'||to_jsonb(t)::text from public.registration_children t where registration_id in (select id from public.registrations where event_id=p_event_id)
  union all select 'ea'||to_jsonb(t)::text from public.event_attendance_choices t where registration_id in (select id from public.registrations where event_id=p_event_id)
  union all select 'd'||to_jsonb(t)::text from public.duplicate_reviews t where event_id=p_event_id
 ) source;
 return result;
end $$;
revoke all on function public.quality_event_version(uuid,uuid) from public,anon,authenticated;
grant execute on function public.quality_event_version(uuid,uuid) to service_role;

create function app.protect_merged_registration() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='INSERT' then
  if new.merged_into_id is not null then raise check_violation using message='Create registration before merge'; end if;
  return new;
 end if;
 if new.merged_into_id is distinct from old.merged_into_id and current_user not in ('service_role','postgres') then
  raise insufficient_privilege using message='Merge requires server';
 end if;
 if old.merged_into_id is not null and (new.deleted_at is null or new.merged_into_id is distinct from old.merged_into_id) then
  raise check_violation using message='Merged registration cannot be restored';
 end if;
 if new.merged_into_id is not null and (new.deleted_at is null or new.merged_into_id=new.id or not exists(select 1 from public.registrations where id=new.merged_into_id and event_id=new.event_id and deleted_at is null)) then
  raise check_violation using message='Invalid merge target';
 end if;
 return new;
end $$;
create trigger protect_merged_registration before insert or update on public.registrations for each row execute function app.protect_merged_registration();

create function public.commit_participant_import(
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
 if public.quality_event_version(p_event_id,p_actor_user_id)<>p_version then raise serialization_failure using message='Preview stale'; end if;
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
revoke all on function public.commit_participant_import(uuid,uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_participant_import(uuid,uuid,uuid,text,text,jsonb,jsonb) to service_role;

create function public.review_participant_duplicate(
 p_event_id uuid,p_actor_user_id uuid,p_left_id uuid,p_right_id uuid,p_decision text,p_keep_id uuid,p_reason text,p_version text,p_left_fingerprint text,p_right_fingerprint text
) returns void language plpgsql security invoker set search_path='' as $$
declare a public.registrations; b public.registrations; keep public.registrations; lose public.registrations; kp public.participants; lp public.participants; kc public.participant_contacts; lc public.participant_contacts; ids jsonb;
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if p_left_id>=p_right_id or p_decision not in ('not_duplicate','merged') or char_length(trim(p_reason)) not between 3 and 500 then raise check_violation using message='Invalid review'; end if;
 lock table public.event_user_roles,public.registrations,public.participants,public.participant_contacts,public.groups,public.event_services,public.operational_tags,public.participant_group_assignments,public.participant_event_services,public.participant_operational_tags,public.registration_children,public.event_attendance_choices,public.duplicate_reviews,public.check_ins,public.moment_attendance_choices,public.accessibility_needs in share row exclusive mode;
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if public.quality_event_version(p_event_id,p_actor_user_id)<>p_version then raise serialization_failure using message='Review stale'; end if;
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
revoke all on function public.review_participant_duplicate(uuid,uuid,uuid,uuid,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.review_participant_duplicate(uuid,uuid,uuid,uuid,text,uuid,text,text,text,text) to service_role;
commit;
