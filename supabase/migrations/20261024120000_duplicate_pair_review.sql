begin;

-- Version only the two comparison cards. Activity elsewhere in the event must
-- not invalidate a decision that merely records two people as distinct.
create function public.quality_duplicate_pair_version(
 p_event_id uuid,p_actor_user_id uuid,p_left_id uuid,p_right_id uuid
) returns text language plpgsql security invoker set search_path='' as $$
declare result text;
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id,false);
 if p_left_id is null or p_right_id is null or p_left_id>=p_right_id or
   (select count(*) from public.registrations where event_id=p_event_id and id in(p_left_id,p_right_id) and deleted_at is null)<>2 then
  raise check_violation using message='Invalid comparison pair';
 end if;
 with r as materialized (select * from public.registrations where event_id=p_event_id and id in(p_left_id,p_right_id)),
 p as materialized (select * from public.participants where id in(select participant_id from r)),
 a as materialized (select * from public.participant_group_assignments where registration_id in(select id from r) and is_current),
 s as materialized (select * from public.participant_event_services where registration_id in(select id from r)),
 t as materialized (select pt.* from public.participant_operational_tags pt join public.operational_tags ot on ot.id=pt.tag_id where pt.participant_id in(select id from p) and ot.event_id=p_event_id)
 select md5(coalesce(string_agg(data,'|' order by data),'')) into result from (
  select 'r'||to_jsonb(r)::text data from r
  union all select 'p'||to_jsonb(p)::text from p
  union all select 'c'||to_jsonb(c)::text from public.participant_contacts c where participant_id in(select id from p) and is_primary
  union all select 'a'||to_jsonb(a)::text from a
  union all select 'g'||to_jsonb(g)::text from public.groups g where id in(select group_id from a)
  union all select 's'||to_jsonb(s)::text from s
  union all select 'es'||to_jsonb(es)::text from public.event_services es where id in(select service_id from s)
  union all select 't'||to_jsonb(t)::text from t
  union all select 'ot'||to_jsonb(ot)::text from public.operational_tags ot where id in(select tag_id from t)
  union all select 'ch'||to_jsonb(ch)::text from public.registration_children ch where registration_id in(select id from r)
  union all select 'co'||to_jsonb(co)::text from public.countries co where id in(select country_id from p)
  union all select 'ci'||to_jsonb(ci)::text from public.cities ci where id in(select city_id from p)
 ) source;
 return result;
end $$;
revoke all on function public.quality_duplicate_pair_version(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.quality_duplicate_pair_version(uuid,uuid,uuid,uuid) to service_role;

-- Separate from merge/import: those retain their broader consistency checks.
-- Brief locks cover updates AND inserted/deleted related rows during validation;
-- no HTTP reads, whole-event digest, attendance or Forum tables under the lock.
create function public.dismiss_participant_duplicate(
 p_event_id uuid,p_actor_user_id uuid,p_left_id uuid,p_right_id uuid,
 p_reason text,p_version text,p_left_fingerprint text,p_right_fingerprint text
) returns void language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
begin
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if p_reason is null or char_length(trim(p_reason)) not between 3 and 500 or
    p_version is null or p_left_fingerprint is null or p_right_fingerprint is null or
    p_left_fingerprint !~ '^[a-f0-9]{64}$' or p_right_fingerprint !~ '^[a-f0-9]{64}$' then
  raise check_violation using message='Invalid review';
 end if;
 lock table public.event_user_roles,public.registrations,public.participants,public.participant_contacts,
  public.groups,public.event_services,public.operational_tags,public.participant_group_assignments,
  public.participant_event_services,public.participant_operational_tags,public.registration_children,
  public.countries,public.cities in share mode;
 perform app.quality_authorize(p_event_id,p_actor_user_id);
 if public.quality_duplicate_pair_version(p_event_id,p_actor_user_id,p_left_id,p_right_id)<>p_version then
  raise serialization_failure using message='Comparison pair changed';
 end if;
 -- Serialize only reviews for the same pair, including the first insert.
 perform pg_advisory_xact_lock(hashtextextended(p_event_id::text||':'||p_left_id::text||':'||p_right_id::text,0));
 if exists(select 1 from public.duplicate_reviews where event_id=p_event_id and left_id=p_left_id and right_id=p_right_id
   and decision='not_duplicate' and left_fingerprint=p_left_fingerprint and right_fingerprint=p_right_fingerprint
   and reason=trim(p_reason) and actor_user_id=p_actor_user_id) then return; end if;
 insert into public.duplicate_reviews(event_id,left_id,right_id,decision,left_fingerprint,right_fingerprint,reason,actor_user_id)
 values(p_event_id,p_left_id,p_right_id,'not_duplicate',p_left_fingerprint,p_right_fingerprint,trim(p_reason),p_actor_user_id)
 on conflict(event_id,left_id,right_id) do update set decision=excluded.decision,
  left_fingerprint=excluded.left_fingerprint,right_fingerprint=excluded.right_fingerprint,
  reason=excluded.reason,actor_user_id=excluded.actor_user_id,created_at=now();
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event_id,p_actor_user_id,'duplicate.false_positive','registrations',p_left_id,
  jsonb_build_object('left_id',p_left_id,'right_id',p_right_id,'keep_id',null,'reason',trim(p_reason),'history_retained',true));
end $$;
revoke all on function public.dismiss_participant_duplicate(uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dismiss_participant_duplicate(uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
commit;
