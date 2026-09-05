-- Explicit responsibility and communication routing are event-registration data.
-- Personal email remains exclusively in non-delegate participant_contacts.
begin;

create table public.registration_responsibilities (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  delivery_mode text not null check (delivery_mode in ('personal', 'delegated')),
  declared_by uuid references public.profiles(id) on delete set null,
  declared_at timestamptz not null default now(),
  source text not null check (source in ('manual_entry', 'leader_choice', 'legacy_backfill'))
);
alter table public.registration_responsibilities enable row level security;

create function app.leads_registration(actor uuid, target uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  with recursive scope as (
    select g.id, g.event_id from public.groups g
    join public.group_memberships gm on gm.group_id=g.id
    where gm.user_id=actor and gm.role='capogruppo' and g.is_active
    union
    select g.id,g.event_id from public.groups g join scope s on g.parent_group_id=s.id
    where g.is_active and g.event_id=s.event_id
  )
  select exists (
    select 1 from public.registrations r
    join public.events e on e.id=r.event_id and e.is_current
    join public.participant_group_assignments a on a.registration_id=r.id and a.is_current
    join scope s on s.id=a.group_id and s.event_id=r.event_id
    where r.id=target
  );
$$;
revoke all on function app.leads_registration(uuid,uuid) from public, anon;
grant execute on function app.leads_registration(uuid,uuid) to authenticated, service_role;
grant select on public.registration_responsibilities to authenticated;
grant all on public.registration_responsibilities to service_role;
create policy "responsibility read scoped" on public.registration_responsibilities for select
using (app.can_read_registration(registration_id));

-- Keep explicit creator where still authorized; otherwise use a current primary
-- leader in the group/ancestor scope. Never rewrite historical personal contacts.
insert into public.registration_responsibilities(registration_id,responsible_user_id,delivery_mode,declared_by,source)
select r.id, candidate.id,
 case when exists(select 1 from public.participant_contacts c where c.participant_id=r.participant_id
   and not c.is_delegate_contact and nullif(trim(c.email::text),'') is not null) then 'personal' else 'delegated' end,
 candidate.id,'legacy_backfill'
from public.registrations r
cross join lateral (
 select p.id from public.profiles p
 where nullif(trim(p.email),'') is not null and app.leads_registration(p.id,r.id)
 order by (p.id=r.created_by) desc nulls last,
 exists(select 1 from public.group_memberships gm join public.participant_group_assignments a on a.group_id=gm.group_id
   where gm.user_id=p.id and gm.is_primary and a.registration_id=r.id and a.is_current) desc, p.id
 limit 1
) candidate
where r.source='capogruppo' or not exists(select 1 from public.participant_contacts c
 where c.participant_id=r.participant_id and not c.is_delegate_contact and c.email is not null);
insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata)
select r.event_id,'registration.responsibility_backfilled','registrations',rr.registration_id,
 jsonb_build_object('responsible_user_id',rr.responsible_user_id,'delivery_mode',rr.delivery_mode)
from public.registration_responsibilities rr join public.registrations r on r.id=rr.registration_id;

-- A routing decision is revalidated at preview AND delivery, including queued mail.
create function public.resolve_registration_deliveries(target_event_id uuid, target_registration_id uuid default null)
returns table(registration_id uuid,participant_id uuid,delivery_kind text,delegate_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.id,r.participant_id,
 case when rr.delivery_mode='delegated' then 'delegated' else 'direct' end,
 case when rr.delivery_mode='delegated' then rr.responsible_user_id else null end
 from public.registrations r
 left join public.registration_responsibilities rr on rr.registration_id=r.id
 where r.event_id=target_event_id and (target_registration_id is null or r.id=target_registration_id) and (
   (rr.delivery_mode='delegated' and app.leads_registration(rr.responsible_user_id,r.id)
     and exists(select 1 from public.profiles p where p.id=rr.responsible_user_id and nullif(trim(p.email),'') is not null))
   or (coalesce(rr.delivery_mode,'personal')='personal' and exists(select 1 from public.participant_contacts c
     where c.participant_id=r.participant_id and not c.is_delegate_contact and nullif(trim(c.email::text),'') is not null))
 );
$$;
revoke all on function public.resolve_registration_deliveries(uuid,uuid) from public, anon, authenticated;
grant execute on function public.resolve_registration_deliveries(uuid,uuid) to service_role;

create function public.set_registration_delivery(target_registration_id uuid, delivery_mode text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare reg public.registrations; old public.registration_responsibilities;
begin
 select * into strict reg from public.registrations where id=target_registration_id for update;
 if not app.leads_registration(auth.uid(),reg.id) then raise insufficient_privilege; end if;
 if delivery_mode not in ('personal','delegated') or delivery_mode is null then raise check_violation; end if;
 if delivery_mode='personal' and not exists(select 1 from public.participant_contacts c
   where c.participant_id=reg.participant_id and not c.is_delegate_contact and c.email is not null)
   then raise exception 'personal-email-required' using errcode='23514'; end if;
 if delivery_mode='delegated' and not exists(select 1 from public.profiles where id=auth.uid() and nullif(trim(email),'') is not null)
   then raise exception 'delegate-email-required' using errcode='23514'; end if;
 select * into old from public.registration_responsibilities where registration_id=reg.id;
 insert into public.registration_responsibilities values(reg.id,auth.uid(),delivery_mode,auth.uid(),now(),'leader_choice')
 on conflict(registration_id) do update set responsible_user_id=excluded.responsible_user_id,
 delivery_mode=excluded.delivery_mode,declared_by=excluded.declared_by,declared_at=excluded.declared_at,source=excluded.source;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(reg.event_id,auth.uid(),'registration.delivery_updated','registrations',reg.id,
 jsonb_build_object('previous_responsible_user_id',old.responsible_user_id,'responsible_user_id',auth.uid(),
 'previous_delivery_mode',old.delivery_mode,'delivery_mode',delivery_mode));
end $$;
revoke all on function public.set_registration_delivery(uuid,text) from public, anon;
grant execute on function public.set_registration_delivery(uuid,text) to authenticated;

-- All dependent manual-entry records commit together or roll back together.
-- The service-only caller supplies server-validated questionnaire/consent versions.
create function public.create_managed_registration(actor uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.groups; pid uuid; rid uuid; item jsonb;
 personal_email text := nullif(lower(trim(payload->>'email')),'');
 phone text := nullif(payload->>'phone','');
 mode text := coalesce(payload->>'deliveryMode','delegated');
begin
 select * into strict g from public.groups where id=(payload->>'groupId')::uuid and is_active and is_assignable;
 if not exists(select 1 from public.events where id=g.event_id and is_current) then raise insufficient_privilege; end if;
 if not exists (
   with recursive ancestors as (
     select id,parent_group_id from public.groups where id=g.id and is_active
     union select p.id,p.parent_group_id from public.groups p join ancestors a on a.parent_group_id=p.id
       where p.event_id=g.event_id and p.is_active
   ) select 1 from ancestors a join public.group_memberships gm on gm.group_id=a.id
     where gm.user_id=actor and gm.role='capogruppo'
 ) then raise insufficient_privilege; end if;
 if not coalesce((payload->>'consentConfirmed')::boolean,false) then raise check_violation; end if;
 if mode not in ('personal','delegated') or (mode='personal' and personal_email is null) then raise check_violation; end if;
 if mode='delegated' and not exists(select 1 from public.profiles where id=actor and nullif(trim(email),'') is not null) then raise check_violation; end if;
 if personal_email is not null then
   perform pg_advisory_xact_lock(hashtextextended(personal_email,0));
   if exists(select 1 from public.participant_contacts where email=personal_email and not is_delegate_contact)
     or exists(select 1 from public.profiles where id=actor and lower(email)=personal_email)
     then raise exception 'duplicate-email' using errcode='23505'; end if;
 end if;
 insert into public.participants(first_name,last_name,birth_date,preferred_locale,country_id,city_id,participates_with_group)
 values(payload->>'firstName',payload->>'lastName',(payload->>'birthDate')::date,'it',g.country_id,g.city_id,true) returning id into pid;
 insert into public.registrations(event_id,participant_id,source,created_by) values(g.event_id,pid,'capogruppo',actor) returning id into rid;
 if personal_email is not null or phone is not null then
   insert into public.participant_contacts(participant_id,email,phone,is_primary,is_delegate_contact) values(pid,personal_email,phone,true,false);
 end if;
 insert into public.participant_group_assignments(registration_id,group_id,status,source,confidence,is_current,assignment_reason,matcher_version,leader_internal_note,leader_note_updated_by,leader_note_updated_at)
 values(rid,g.id,'confirmed','capogruppo',1,true,'group_leader_manual_entry','group-leader-manual-v2',payload->>'leaderNote',actor,now());
 insert into public.registration_responsibilities values(rid,actor,mode,actor,now(),'manual_entry');
 insert into public.participant_consents(registration_id,privacy_version,privacy_accepted_at,data_processing_accepted,future_events_communications_accepted,accepted_by_user_id,accepted_by_name)
 values(rid,payload->>'privacyVersion',now(),true,false,actor,(select full_name from public.profiles where id=actor));
 insert into public.accessibility_needs(registration_id,washington_group_answers) values(rid,payload->'accessibilityAnswers');
 insert into public.registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers,visibility_summary)
 values(rid,g.event_id,payload->>'questionnaireVersion',payload->'answers',payload->'visibilitySummary');
 for item in select * from jsonb_array_elements(payload->'children') loop
   insert into public.registration_children(registration_id,first_name,last_name,birth_date,position)
   values(rid,item->>'firstName',item->>'lastName',(item->>'birthDate')::date,(item->>'position')::integer);
 end loop;
 if (payload->>'availabilityUnknown')::boolean then
   insert into public.event_attendance_choices(registration_id,choice) values(rid,'unknown');
 else
   for item in select * from jsonb_array_elements(payload->'availabilitySlots') loop
     insert into public.event_attendance_choices(registration_id,day,day_part,choice) values(rid,(item->>'day')::date,item->>'part','yes');
   end loop;
 end if;
 insert into public.qr_tokens(registration_id,token_hash,token_encrypted,created_by)
 values(rid,payload->>'qrHash',payload->>'qrEncrypted',actor);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(g.event_id,actor,'registration.created_by_group_leader','registrations',rid,
 jsonb_build_object('group_id',g.id,'source','capogruppo','responsible_user_id',actor,'delivery_mode',mode,
 'consent_declared',true,'has_email',personal_email is not null,'has_phone',phone is not null));
 return rid;
end $$;
revoke all on function public.create_managed_registration(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.create_managed_registration(uuid,jsonb) to service_role;

-- Audit access to the operational card/QR, using the session identity, with no
-- bearer token in audit metadata. Losing group scope immediately denies access.
create function public.read_managed_registration_card(target_registration_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare reg public.registrations; result jsonb;
begin
 select * into strict reg from public.registrations where id=target_registration_id;
 if not app.leads_registration(auth.uid(),reg.id) then raise insufficient_privilege; end if;
 select jsonb_build_object(
   'qr',(select jsonb_build_object('status',q.status,'expires_at',q.expires_at,'token_encrypted',q.token_encrypted)
      from public.qr_tokens q where q.registration_id=reg.id order by q.created_at desc limit 1),
   'attendance',coalesce((select jsonb_agg(jsonb_build_object('day',a.day,'day_part',a.day_part,'choice',a.choice)) from public.event_attendance_choices a where a.registration_id=reg.id),'[]'::jsonb),
   'responsibility',(select jsonb_build_object('responsible_user_id',rr.responsible_user_id,'delivery_mode',rr.delivery_mode,
     'name',p.full_name,'email',p.email,'valid',app.leads_registration(rr.responsible_user_id,reg.id))
     from public.registration_responsibilities rr left join public.profiles p on p.id=rr.responsible_user_id where rr.registration_id=reg.id)
 ) into result;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(reg.event_id,auth.uid(),'group_leader.participant_card_viewed','registrations',reg.id,jsonb_build_object('qr_available',result->'qr' is not null));
 return result;
end $$;
revoke all on function public.read_managed_registration_card(uuid) from public, anon;
grant execute on function public.read_managed_registration_card(uuid) to authenticated;

-- Keep ordinary table reads consistent with the current assignment and tree.
create or replace function app.can_read_registration(target_registration_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select app.owns_registration(target_registration_id)
 or exists(select 1 from public.registrations r where r.id=target_registration_id
   and app.has_event_role(r.event_id,array['manager','manager_viewer']::public.app_role[]))
 or app.leads_registration(auth.uid(),target_registration_id);
$$;

create function public.update_managed_participant(target_assignment_id uuid, target_participant_id uuid, payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare reg public.registrations; person public.participants; contact_id uuid;
 personal_email text := nullif(lower(trim(payload->>'email')),'');
 phone text := nullif(payload->>'phone','');
begin
 select r.* into strict reg from public.registrations r join public.participant_group_assignments a on a.registration_id=r.id
 where a.id=target_assignment_id and a.is_current and r.participant_id=target_participant_id for update of r;
 if not app.leads_registration(auth.uid(),reg.id) then raise insufficient_privilege; end if;
 select * into strict person from public.participants where id=reg.participant_id for update;
 if (payload->>'identityUpdate')::boolean then
   if (payload->>'birthDate')::date > current_date then raise exception 'invalid-birth-date' using errcode='23514'; end if;
   if length(trim(payload->>'firstName')) not between 2 and 120 or length(trim(payload->>'lastName')) not between 2 and 120 then raise check_violation; end if;
   update public.participants set first_name=payload->>'firstName',last_name=payload->>'lastName',birth_date=(payload->>'birthDate')::date,
    city_other=payload->>'city',country_other=payload->>'country' where id=person.id;
 end if;
 if (payload->>'contactUpdate')::boolean then
   if personal_email is not null and personal_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'invalid-email' using errcode='23514'; end if;
   if phone is not null and phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'invalid-phone' using errcode='23514'; end if;
   select id into contact_id from public.participant_contacts where participant_id=person.id and is_primary and not is_delegate_contact order by created_at limit 1;
   if person.auth_user_id is not null and personal_email is distinct from
     (select lower(email::text) from public.participant_contacts where id=contact_id) then
     raise exception 'linked-account-email' using errcode='23514';
   end if;
   if personal_email is not null then
     perform pg_advisory_xact_lock(hashtextextended(personal_email,0));
     if exists(select 1 from public.participant_contacts where email=personal_email and not is_delegate_contact and participant_id<>person.id)
       or exists(select 1 from public.profiles where id=auth.uid() and lower(email)=personal_email and person.auth_user_id is distinct from auth.uid())
       then raise exception 'duplicate-email' using errcode='23505'; end if;
   end if;
   if personal_email is null and phone is null then
     delete from public.participant_contacts where id=contact_id;
   elsif contact_id is not null then
     update public.participant_contacts set email=personal_email,phone=phone where id=contact_id;
   else
     insert into public.participant_contacts(participant_id,email,phone,is_primary,is_delegate_contact) values(person.id,personal_email,phone,true,false);
   end if;
 end if;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(reg.event_id,auth.uid(),'group_leader.participant_contact_updated','participants',person.id,
 jsonb_build_object('assignment_id',target_assignment_id,'identity_updated',payload->'identityUpdate','has_email',personal_email is not null,'has_phone',phone is not null));
end $$;
revoke all on function public.update_managed_participant(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_managed_participant(uuid,uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
