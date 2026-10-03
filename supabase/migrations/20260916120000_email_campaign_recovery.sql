-- Apply before deploying the worker. Existing recipient states are preserved.
alter table public.email_campaign_recipients
  drop constraint if exists email_campaign_recipients_status_check;
alter table public.email_campaign_recipients add constraint email_campaign_recipients_status_check
  check (status in ('pending','scheduled','sending','sent','failed','skipped','unknown'));
alter table public.email_campaigns drop constraint if exists email_campaigns_status_check;
alter table public.email_campaigns add constraint email_campaigns_status_check
  check (status in ('draft','ready','sending','scheduled','completed','partial','failed','cancelled','attention'));

create table public.email_campaign_delivery_control (
  id boolean primary key default true check (id),
  paused_until timestamptz not null default '-infinity',
  blocked boolean not null default false,
  failure_count integer not null default 0 check (failure_count >= 0),
  error_code text,
  last_failure_at timestamptz
);
insert into public.email_campaign_delivery_control(id) values (true);
alter table public.email_campaign_delivery_control enable row level security;
revoke all on public.email_campaign_delivery_control from public, anon, authenticated;
grant select, update on public.email_campaign_delivery_control to service_role;

create function public.pause_email_campaign_delivery(
  p_error_code text, p_blocked boolean default false, p_retry_after_seconds integer default 60
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_control public.email_campaign_delivery_control;
  v_count integer;
  v_pause timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('email_campaign_daily_delivery')::bigint);
  select * into strict v_control from public.email_campaign_delivery_control where id for update;
  v_count := case when v_control.last_failure_at > now() - interval '1 day'
    then least(v_control.failure_count + 1, 16) else 1 end;
  v_pause := greatest(v_control.paused_until, now() + make_interval(secs =>
    greatest(least(3600, 60 * power(2, least(v_count - 1, 6)))::integer,
      greatest(60, least(coalesce(p_retry_after_seconds, 60), 86400)))));
  update public.email_campaign_delivery_control set paused_until = v_pause,
    blocked = blocked or coalesce(p_blocked, false), failure_count = v_count,
    error_code = left(p_error_code, 100), last_failure_at = now() where id;
  return v_pause;
end;
$$;

-- Only operations staff using service_role can resume after correcting config.
-- Does not requeue any unknown/sending/failed recipient.
create function public.resume_email_campaign_delivery() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('email_campaign_daily_delivery')::bigint);
  update public.email_campaign_delivery_control set paused_until = '-infinity',
    blocked = false, failure_count = 0, error_code = null, last_failure_at = null where id;
end;
$$;

create or replace function public.claim_due_email_campaign_recipients(p_campaign_id uuid default null)
returns setof public.email_campaign_recipients
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_control public.email_campaign_delivery_control;
begin
  perform pg_advisory_xact_lock(hashtext('email_campaign_daily_delivery')::bigint);
  select * into strict v_control from public.email_campaign_delivery_control where id;
  if v_control.blocked or v_control.paused_until > now() then return; end if;
  return query
  with due as (
    select r.id from public.email_campaign_recipients r
    where r.status = 'scheduled' and r.scheduled_for <= v_today
      and (p_campaign_id is null or r.campaign_id = p_campaign_id)
    order by r.scheduled_for, r.created_at, r.id limit 25 for update skip locked
  )
  update public.email_campaign_recipients as recipient
  set status = 'sending', processing_started_at = now(), attempted_on = v_today
  from due where recipient.id = due.id returning recipient.*;
end;
$$;
revoke all on function public.pause_email_campaign_delivery(text,boolean,integer) from public, anon, authenticated;
revoke all on function public.resume_email_campaign_delivery() from public, anon, authenticated;
revoke all on function public.claim_due_email_campaign_recipients(uuid) from public, anon, authenticated;
grant execute on function public.pause_email_campaign_delivery(text,boolean,integer) to service_role;
grant execute on function public.resume_email_campaign_delivery() to service_role;
grant execute on function public.claim_due_email_campaign_recipients(uuid) to service_role;
