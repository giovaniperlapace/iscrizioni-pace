-- Two-hour reminders. Installing this migration does not enable real delivery.
create table public.forum_reminder_settings (
 event_id uuid primary key references public.events(id) on delete cascade,
 enabled_at timestamptz not null,
 enabled boolean not null default false
);
create table public.forum_reminder_emails (
 id uuid primary key default extensions.gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 panel_id uuid not null references public.event_moments(id) on delete cascade,
 recipient_key text not null,
 state text not null default 'queued' check(state in ('queued','sending','accepted','failed','uncertain','skipped')),
 claim uuid, recipient text, message_id text, error_code text,
 payload_snapshot jsonb, subject_snapshot text, text_snapshot text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(), accepted_at timestamptz,
 retry_after timestamptz not null default clock_timestamp(),
 unique(panel_id,recipient_key)
);
create index forum_reminder_queue on public.forum_reminder_emails(created_at,id) where state='queued';
alter table public.forum_reminder_settings enable row level security;
alter table public.forum_reminder_emails enable row level security;
revoke all on public.forum_reminder_settings,public.forum_reminder_emails from public,anon,authenticated;
grant select,insert,update on public.forum_reminder_settings,public.forum_reminder_emails to service_role;

-- The same current-booking predicate is used when queuing, claiming and immediately
-- before delivery. No waiting-list row or general attendance can create a reminder.
create function app.forum_reminder_payload(p_registration uuid,p_panel uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('eventId',r.event_id,'registrationId',r.id,'panelId',m.id,
  'title',m.title,'startsAt',m.starts_at,'endsAt',m.ends_at,
  'location',l.name,'address',l.address,'city',l.city,
  'locale',p.preferred_locale,'name',concat_ws(' ',p.first_name,p.last_name),
  'relay',exists(select 1 from public.panel_relay_rooms rr where rr.panel_id=m.id),
  'children',coalesce((select jsonb_agg(concat_ws(' ',c.first_name,c.last_name) order by c.position,c.id)
   from public.registration_children c where c.registration_id=r.id and c.id=any(app.panel_child_ids(r.id,m.id))),'[]'::jsonb))
 from public.registrations r
 join public.participants p on p.id=r.participant_id
 join public.events e on e.id=r.event_id and e.is_current and e.status='published'
 join public.forum_reminder_settings settings on settings.event_id=e.id and settings.enabled
 join public.moment_attendance_choices b on b.registration_id=r.id and b.moment_id=p_panel and b.choice='yes'
 join public.event_moments m on m.id=b.moment_id and m.event_id=e.id and m.moment_type='panel'
 join public.panel_seat_sections section on section.id=b.seat_section_id and section.panel_id=m.id and section.event_id=e.id
 join public.event_locations l on l.id=m.location_id and l.event_id=e.id and l.is_active
 where r.id=p_registration and r.status in ('submitted','confirmed') and r.deleted_at is null
  and m.publication_status='published' and m.is_public
  and m.starts_at>now() and m.starts_at-interval '2 hours'<=now()
  and m.starts_at-interval '2 hours'>=settings.enabled_at;
$$;

-- Routing key only: recipient authorization remains in the canonical contact resolver.
-- A personal email always wins. No implicit delegation is inferred from membership.
create function app.forum_reminder_recipient_key(p_registration uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select case when not exists(select 1 from public.participant_contacts c
   where c.participant_id=r.participant_id and nullif(btrim(c.email::text),'') is not null)
  and r.source='capogruppo' and r.created_by is not null
  and exists(select 1 from public.registration_questionnaire_answers a where a.registration_id=r.id and a.event_id=r.event_id
   and a.answers->'contact'->>'useLeaderEmail'='true'
   and a.answers->'contact'->>'communicationDelegateUserId'=r.created_by::text)
  then 'delegate:'||r.created_by::text else 'participant:'||r.id::text end
 from public.registrations r where r.id=p_registration;
$$;

create function app.forum_reminder_batch_payload(p_event uuid,p_panel uuid,p_key text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(payload order by payload->>'name',payload->>'registrationId'),'[]'::jsonb)
 from (select app.forum_reminder_payload(r.id,p_panel) payload
  from public.registrations r join public.moment_attendance_choices b on b.registration_id=r.id
  where r.event_id=p_event and b.moment_id=p_panel and b.choice='yes' and b.seat_section_id is not null
   and case when p_key like 'delegate:%' then r.created_by::text=split_part(p_key,':',2)
    else r.id::text=split_part(p_key,':',2) end
   and app.forum_reminder_recipient_key(r.id)=p_key) rows
 where payload is not null;
$$;

create function public.enqueue_forum_reminders() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare added integer;
begin
 update public.forum_reminder_emails set state='uncertain',error_code='interrupted',updated_at=clock_timestamp()
 where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 insert into public.forum_reminder_emails(event_id,panel_id,recipient_key)
 select distinct r.event_id,b.moment_id,app.forum_reminder_recipient_key(r.id)
 from public.moment_attendance_choices b
 join public.registrations r on r.id=b.registration_id
 join public.event_moments m on m.id=b.moment_id
 join public.forum_reminder_settings settings on settings.event_id=r.event_id and settings.enabled
 where b.choice='yes' and b.seat_section_id is not null
  and m.starts_at>now() and m.starts_at<=now()+interval '2 hours'
  and app.forum_reminder_payload(r.id,m.id) is not null
 order by r.event_id,b.moment_id,app.forum_reminder_recipient_key(r.id)
 on conflict(panel_id,recipient_key) do nothing;
 get diagnostics added=row_count;
 return added;
end $$;

create function public.claim_forum_reminder() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare notice public.forum_reminder_emails; payload jsonb;
begin
 select q.* into notice from public.forum_reminder_emails q
 join public.forum_reminder_settings settings on settings.event_id=q.event_id and settings.enabled
 where q.state='queued' and q.retry_after<=clock_timestamp() order by q.created_at,q.id limit 1 for update of q skip locked;
 if not found then return null; end if;
 payload:=app.forum_reminder_batch_payload(notice.event_id,notice.panel_id,notice.recipient_key);
 update public.forum_reminder_emails set state='sending',claim=extensions.gen_random_uuid(),updated_at=clock_timestamp()
 where id=notice.id returning * into notice;
 return jsonb_build_object('id',notice.id,'claim',notice.claim,'eventId',notice.event_id,
  'recipientKey',notice.recipient_key,'panelId',notice.panel_id,'payload',payload);
end $$;

-- Called after resolving the current contact. A cancellation, changed schedule,
-- move to another room, changed family or disabled switch prevents this send.
create function public.authorize_forum_reminder(p_id uuid,p_claim uuid,p_payload jsonb,
 p_recipient text,p_subject text,p_text text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare notice public.forum_reminder_emails; current_payload jsonb;
begin
 select * into notice from public.forum_reminder_emails where id=p_id and claim=p_claim and state='sending' for update;
 if not found then return false; end if;
 current_payload:=app.forum_reminder_batch_payload(notice.event_id,notice.panel_id,notice.recipient_key);
 if current_payload='[]'::jsonb or current_payload is distinct from p_payload then return false; end if;
 update public.forum_reminder_emails set recipient=p_recipient,subject_snapshot=p_subject,text_snapshot=p_text,
  payload_snapshot=current_payload,updated_at=clock_timestamp() where id=notice.id;
 return true;
end $$;

revoke all on function app.forum_reminder_recipient_key(uuid),app.forum_reminder_batch_payload(uuid,uuid,text),app.forum_reminder_payload(uuid,uuid),public.enqueue_forum_reminders(),public.claim_forum_reminder(),
 public.authorize_forum_reminder(uuid,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_forum_reminders(),public.claim_forum_reminder(),
 public.authorize_forum_reminder(uuid,uuid,jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';

-- Delivery evidence and one operational report per Forum. Neither creates reminders.
alter table public.forum_reminder_emails
 add column delivery_state text check(delivery_state in ('delivered','bounced','pending','unverified')),
 add column delivery_at timestamptz,
 add column delivery_checked_at timestamptz,
 add column delivery_check_claim uuid,
 add column delivery_check_started_at timestamptz;
create table public.forum_reminder_reports (
 id uuid primary key default extensions.gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 panel_id uuid not null unique references public.event_moments(id) on delete cascade,
 state text not null default 'queued' check(state in ('queued','sending','accepted','failed','uncertain')),
 claim uuid, payload_snapshot jsonb, subject_snapshot text, text_snapshot text,
 message_id text, error_code text, accepted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.forum_reminder_reports enable row level security;
revoke all on public.forum_reminder_reports from public,anon,authenticated;
grant select,insert,update on public.forum_reminder_reports to service_role;

create function public.claim_forum_reminder_delivery_check() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare notice public.forum_reminder_emails;
begin
 select q.* into notice from public.forum_reminder_emails q
 join public.forum_reminder_settings s on s.event_id=q.event_id and s.enabled
 where q.state='accepted' and q.delivery_checked_at is null
  and q.accepted_at<=clock_timestamp()-interval '5 minutes'
  and (q.delivery_check_started_at is null or q.delivery_check_started_at<clock_timestamp()-interval '2 minutes')
 order by q.accepted_at,q.id limit 1 for update of q skip locked;
 if not found then return null; end if;
 update public.forum_reminder_emails set delivery_check_claim=extensions.gen_random_uuid(),delivery_check_started_at=clock_timestamp()
 where id=notice.id returning * into notice;
 return jsonb_build_object('id',notice.id,'claim',notice.delivery_check_claim,'messageId',notice.message_id,'recipient',notice.recipient);
end $$;

create function public.claim_forum_reminder_report() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare report public.forum_reminder_reports; summary jsonb;
begin
 update public.forum_reminder_reports set state='uncertain',error_code='interrupted',updated_at=clock_timestamp()
 where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 insert into public.forum_reminder_reports(event_id,panel_id)
 select distinct q.event_id,q.panel_id from public.forum_reminder_emails q
 join public.forum_reminder_settings s on s.event_id=q.event_id and s.enabled
 order by q.event_id,q.panel_id on conflict(panel_id) do nothing;
 select r.* into report from public.forum_reminder_reports r
 join public.forum_reminder_settings s on s.event_id=r.event_id and s.enabled
 where r.state='queued'
  and not exists(select 1 from public.forum_reminder_emails q where q.panel_id=r.panel_id
   and (q.state in ('queued','sending') or q.updated_at>clock_timestamp()-interval '5 minutes'
    or (q.state='accepted' and q.delivery_checked_at is null)))
 order by r.updated_at,r.id limit 1 for update of r skip locked;
 if not found then return null; end if;
 select jsonb_build_object('title',m.title,'startsAt',m.starts_at,'location',l.name,'address',l.address,
  'checkedAt',clock_timestamp(),'total',count(q.id),
  'accepted',count(*) filter(where q.state='accepted'),
  'delivered',count(*) filter(where q.state='accepted' and q.delivery_state='delivered'),
  'bounced',count(*) filter(where q.state='accepted' and q.delivery_state='bounced'),
  'pending',count(*) filter(where q.state='accepted' and q.delivery_state='pending'),
  'unverified',count(*) filter(where q.state='accepted' and (q.delivery_state='unverified' or q.delivery_state is null)),
  'failed',count(*) filter(where q.state='failed'),
  'uncertain',count(*) filter(where q.state='uncertain'),
  'skipped',count(*) filter(where q.state='skipped'),
  'personal',count(*) filter(where q.state='accepted' and q.recipient_key like 'participant:%'),
  'digests',count(*) filter(where q.state='accepted' and q.recipient_key like 'delegate:%'),
  'missingAddress',count(*) filter(where q.error_code='forum_reminder_address_missing')) into summary
 from public.event_moments m left join public.event_locations l on l.id=m.location_id
 left join public.forum_reminder_emails q on q.panel_id=m.id
 where m.id=report.panel_id group by m.id,l.id;
 update public.forum_reminder_reports set state='sending',claim=extensions.gen_random_uuid(),payload_snapshot=summary,updated_at=clock_timestamp()
 where id=report.id returning * into report;
 return jsonb_build_object('id',report.id,'claim',report.claim,'payload',summary);
end $$;
revoke all on function public.claim_forum_reminder_delivery_check(),public.claim_forum_reminder_report() from public,anon,authenticated;
grant execute on function public.claim_forum_reminder_delivery_check(),public.claim_forum_reminder_report() to service_role;
notify pgrst,'reload schema';
