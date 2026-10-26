-- Preserve delivery settings, queues and assignments. Resolve explicit delegates
-- before the assigning leader and mark only their own current delegates for PDFs.
create function app.closing_explicit_delegate(p_plan uuid,p_registration uuid) returns uuid
language sql stable security invoker set search_path='' as $$
 select r.created_by from public.ceremony_plans p join public.events ev on ev.id=p.event_id
 join public.registrations r on r.id=p_registration and r.event_id=p.event_id
 join lateral (select qa.answers->'contact' as contact from public.registration_questionnaire_answers qa
  where qa.registration_id=r.id and qa.event_id=r.event_id and qa.answers->'contact'->'useLeaderEmail'='true'::jsonb
  order by qa.id desc limit 1) delegation on true
 where p.id=p_plan and p.kind='closing' and p.layout_key='assisi-closing-badges-2026' and ev.is_current
 and r.deleted_at is null and r.status in('submitted','confirmed') and r.source='capogruppo'
 and delegation.contact->>'communicationDelegateUserId'=r.created_by::text
 and not exists(select 1 from public.registrations deleted join public.participants person on person.id=deleted.participant_id
  where deleted.event_id=p.event_id and deleted.deleted_at is not null and person.auth_user_id=r.created_by)
 and exists(select 1 from public.participant_group_assignments ga join public.groups g on g.id=ga.group_id
  where ga.registration_id=r.id and ga.is_current and ga.status='confirmed' and g.event_id=p.event_id and g.is_active
  and g.id in(select app.ceremony_leader_scope(p.event_id,r.created_by))
  and exists(select 1 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
   where n.plan_id=p.id and n.registration_id=r.id and n.revoked_at is null and a.revoked_at is null
   and (a.group_id is null or a.group_id=g.id)))
$$;

create or replace function app.closing_contact_leader(p_plan uuid,p_registration uuid,p_preferred uuid default null) returns uuid
language sql stable security invoker set search_path='' as $$
 select gm.user_id from public.ceremony_plans p
 join public.participant_group_assignments ga on ga.registration_id=p_registration and ga.is_current and ga.status='confirmed'
 join public.groups g on g.id=ga.group_id and g.event_id=p.event_id and g.is_active
 join public.group_memberships gm on gm.role='capogruppo'
 join public.groups own_group on own_group.id=gm.group_id and own_group.event_id=p.event_id and own_group.is_active
 where p.id=p_plan and g.id in(select app.ceremony_leader_scope(p.event_id,gm.user_id))
 and exists(select 1 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
  where n.plan_id=p.id and n.registration_id=p_registration and n.revoked_at is null and a.revoked_at is null
  and (a.group_id is null or a.group_id=g.id))
 -- An explicit but stale/invalid delegation must never fall back to somebody else.
 and (not exists(select 1 from public.registration_questionnaire_answers qa where qa.registration_id=p_registration and qa.event_id=p.event_id and qa.answers->'contact'->'useLeaderEmail'='true'::jsonb)
  or gm.user_id=app.closing_explicit_delegate(p.id,p_registration))
 order by (gm.user_id=p_preferred) desc nulls last,(gm.group_id=g.id) desc,gm.is_primary desc,gm.user_id limit 1
$$;

create function app.closing_leader_report_lines(p_plan uuid,p_leader uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(line||jsonb_build_object(
  'communicationDelegated',coalesce(app.closing_explicit_delegate(p_plan,(line->>'registrationId')::uuid)=p_leader,false),
  'groupId',current_group.id,'groupName',current_group.name) order by line->>'name',line->>'nomineeId'),'[]')
 from jsonb_array_elements(app.closing_badge_lines(p_plan,array(
  select n.id from public.ceremony_nominees n where n.plan_id=p_plan and n.revoked_at is null
  and app.closing_personal_email(n.registration_id) is null
  and app.closing_contact_leader(p_plan,n.registration_id,p_leader)=p_leader))) line
 join public.ceremony_plans plan on plan.id=p_plan
 join lateral (select g.id,g.name from public.participant_group_assignments ga join public.groups g on g.id=ga.group_id
  where ga.registration_id=(line->>'registrationId')::uuid and ga.is_current and ga.status='confirmed'
  and g.event_id=plan.event_id and g.is_active and g.id in(select app.ceremony_leader_scope(plan.event_id,p_leader))
  and (line->>'groupId' is null or g.id=(line->>'groupId')::uuid) order by g.name,g.id limit 1) current_group on true
$$;
revoke all on function app.closing_explicit_delegate(uuid,uuid),app.closing_leader_report_lines(uuid,uuid) from public,anon,authenticated;
grant execute on function app.closing_explicit_delegate(uuid,uuid),app.closing_leader_report_lines(uuid,uuid) to service_role;

create or replace function public.claim_ceremony_publication_email() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.ceremony_publication_emails; p public.ceremony_plans; valid_lines jsonb; target uuid; direct_email text; settings public.closing_ceremony_badge_settings; ids uuid[]; leader uuid; body jsonb;
begin
 update public.ceremony_publication_emails set state='uncertain',error_code='interrupted',updated_at=clock_timestamp() where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 -- Lock the event before queue rows, consistently with nomination/publication writers.
 select ev.id into target from public.events ev where ev.is_current;
 if target is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,1381));
 select em.* into e from public.ceremony_publication_emails em join public.ceremony_plans cp on cp.id=em.plan_id
 where em.state='queued' and em.event_id=target and
 (cp.layout_key is distinct from 'assisi-closing-badges-2026' or exists(select 1 from public.closing_ceremony_badge_settings cfg where cfg.plan_id=cp.id and cfg.enabled))
 order by em.created_at,em.id limit 1 for update of em skip locked;
 if not found then return null;end if;
 select * into p from public.ceremony_plans where id=e.plan_id;
 body:=e.payload;
 if p.layout_key='assisi-closing-badges-2026' then
  select * into settings from public.closing_ceremony_badge_settings where plan_id=p.id;
  body:=body||jsonb_build_object('badgeWorkflow',true,'instructions',settings.instructions);
  if e.registration_id is not null then
   select array_agg(n.id) into ids from jsonb_array_elements(e.payload->'lines') x
    join public.ceremony_nominees n on n.id=(x->>'nomineeId')::uuid and n.plan_id=p.id and n.registration_id=e.registration_id;
   valid_lines:=app.closing_badge_lines(p.id,coalesce(ids,'{}'));
   direct_email:=app.closing_personal_email(e.registration_id);
   if direct_email is null and jsonb_array_length(valid_lines)>0 then
    leader:=app.closing_contact_leader(p.id,e.registration_id,(e.payload->>'sourceLeaderId')::uuid);
    if leader is not null then
     -- One cumulative report for this leader, including all currently assigned people without email.
     valid_lines:=app.closing_leader_report_lines(p.id,leader);
     update public.ceremony_publication_emails other set state='skipped',error_code='included_in_leader_report',
      payload=other.payload||jsonb_build_object('leaderReportId',e.id),updated_at=clock_timestamp()
      where other.plan_id=p.id and other.id<>e.id and other.state='queued' and other.registration_id is not null
       and app.closing_personal_email(other.registration_id) is null
       and app.closing_contact_leader(p.id,other.registration_id,(other.payload->>'sourceLeaderId')::uuid)=leader;
     e.user_id:=leader;e.registration_id:=null;
     body:=body||jsonb_build_object('noticeType','leader_contacts','snapshotAt',clock_timestamp());
    end if;
   end if;
  else
   select coalesce(jsonb_agg(x||jsonb_build_object('badgeCode',s.layout_code)),'[]') into valid_lines
   from jsonb_array_elements(e.payload->'lines') x join public.ceremony_sectors s on s.plan_id=p.id and s.name=x->>'sector'
   where (x->>'groupId')::uuid in(select app.ceremony_leader_scope(e.event_id,e.user_id))
    and exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where a.plan_id=p.id and a.group_id=(x->>'groupId')::uuid and a.revoked_at is null and q.sector_id=s.id);
  end if;
 else
  select coalesce(jsonb_agg(x),'[]') into valid_lines from jsonb_array_elements(e.payload->'lines') x where
   (e.user_id is not null and (x->>'groupId')::uuid in(select app.ceremony_leader_scope(e.event_id,e.user_id))
    and exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id where a.plan_id=e.plan_id and a.group_id=(x->>'groupId')::uuid and a.revoked_at is null and s.name=x->>'sector'))
   or (e.registration_id is not null and exists(select 1 from public.ceremony_nominees n join public.registrations r on r.id=n.registration_id where n.id=(x->>'nomineeId')::uuid and n.plan_id=e.plan_id and n.registration_id=e.registration_id and n.revoked_at is null and r.deleted_at is null and r.status in ('submitted','confirmed')));
 end if;
 body:=body||jsonb_build_object('lines',valid_lines);
 update public.ceremony_publication_emails set state='sending',claim=gen_random_uuid(),user_id=e.user_id,registration_id=e.registration_id,payload=body,updated_at=clock_timestamp() where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'claim',e.claim,'eventId',e.event_id,'userId',e.user_id,'registrationId',e.registration_id,'destinationEmail',direct_email,'payload',body);
end $$;

notify pgrst,'reload schema';
