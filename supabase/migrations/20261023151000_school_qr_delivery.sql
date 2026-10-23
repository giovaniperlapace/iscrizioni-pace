-- Delivery is intentionally paused until the user approves the exact email text.
create table public.school_booking_email_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.school_booking_email_control(singleton,enabled) values(true,false);
alter table public.school_booking_email_control enable row level security;
revoke all on public.school_booking_email_control from public,anon,authenticated;
grant select,update on public.school_booking_email_control to service_role;

-- One confirmation per booking; existing current-event bookings receive the QR notice too.
create table public.school_booking_email_deliveries (
  booking_id uuid primary key references public.school_bookings(id) on delete cascade,
  state text not null default 'queued' check (state in ('queued','sending','accepted','failed','uncertain','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipient text,
  message_id text,
  error_code text
);
alter table public.school_booking_email_deliveries enable row level security;
revoke all on public.school_booking_email_deliveries from public,anon,authenticated;
grant select,insert,update on public.school_booking_email_deliveries to service_role;

create function app.enqueue_school_booking_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('submitted','confirmed') then
    insert into public.school_booking_email_deliveries(booking_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function app.enqueue_school_booking_email() from public,anon,authenticated;
create trigger enqueue_school_booking_email after insert or update of status on public.school_bookings
  for each row execute function app.enqueue_school_booking_email();
insert into public.school_booking_email_deliveries(booking_id)
  select b.id from public.school_bookings b join public.events e on e.id=b.event_id
  where e.is_current and b.status in ('submitted','confirmed') on conflict do nothing;

-- Stable token: only fill a genuinely missing token; never replace a revoked/expired one.
create function public.ensure_school_booking_qr(p_booking uuid,p_hash text,p_encrypted text) returns text
language plpgsql security invoker set search_path='' as $$
declare b public.school_bookings; q public.school_booking_qr_tokens;
begin
 select * into b from public.school_bookings where id=p_booking for update;
 if not found or b.status not in ('submitted','confirmed') or not exists(
   select 1 from public.events where id=b.event_id and is_current) then raise invalid_parameter_value; end if;
 select * into q from public.school_booking_qr_tokens where booking_id=b.id order by created_at desc,id desc limit 1 for share;
 if found then
   if q.status<>'active' or q.revoked_at is not null or (q.expires_at is not null and q.expires_at<=clock_timestamp()) then
     raise invalid_parameter_value using message='School QR unavailable';
   end if;
   return q.token_encrypted;
 end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_encrypted is null or length(p_encrypted)<20 then raise invalid_parameter_value; end if;
 insert into public.school_booking_qr_tokens(booking_id,token_hash,token_encrypted) values(b.id,p_hash,p_encrypted);
 insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata)
   values(b.event_id,'school_booking.qr_created','school_bookings',b.id,'{}');
 return p_encrypted;
end $$;

create function public.claim_school_booking_email(p_booking uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
 if not coalesce((select enabled from public.school_booking_email_control where singleton for share),false) then return null; end if;
 -- Never retry an interrupted send: provider acceptance may have happened.
 update public.school_booking_email_deliveries set state='uncertain',error_code='interrupted',updated_at=clock_timestamp()
   where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 select d.booking_id into target from public.school_booking_email_deliveries d
   join public.school_bookings b on b.id=d.booking_id join public.events e on e.id=b.event_id
   where d.state='queued' and e.is_current and (p_booking is null or d.booking_id=p_booking)
   order by d.created_at,d.booking_id limit 1 for update of d skip locked;
 if target is null then return null; end if;
 update public.school_booking_email_deliveries set state='sending',updated_at=clock_timestamp() where booking_id=target;
 return target;
end $$;
revoke all on function public.ensure_school_booking_qr(uuid,text,text),public.claim_school_booking_email(uuid) from public,anon,authenticated;
grant execute on function public.ensure_school_booking_qr(uuid,text,text),public.claim_school_booking_email(uuid) to service_role;

-- Rolling deployment compatibility: the previous server sends immediately and
-- writes this audit after provider acceptance. Only future legacy successes
-- consume queued rows; historical confirmations do not suppress the requested notice.
create function app.record_legacy_school_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)='service_role' then
   update public.school_booking_email_deliveries set state='accepted',updated_at=clock_timestamp()
     where booking_id=new.entity_id and state='queued';
 end if;
 return new;
end $$;
revoke all on function app.record_legacy_school_confirmation() from public,anon,authenticated;
create trigger record_legacy_school_confirmation after insert on public.audit_logs
 for each row when (new.action='school_booking.confirmation_email_sent' and new.entity_table='school_bookings')
 execute function app.record_legacy_school_confirmation();
