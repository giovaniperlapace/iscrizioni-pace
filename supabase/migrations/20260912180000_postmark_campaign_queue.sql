-- Deploy only with Postmark enabled and the minute cron available.
-- No rewrite of recipients or old future schedules; no retry of sending/failed rows.
create or replace function public.reserve_email_campaign_schedule(p_campaign_id uuid)
returns table (scheduled_today integer, scheduled_later integer, last_scheduled_for date)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform pg_advisory_xact_lock(hashtext('email_campaign_daily_schedule')::bigint);
  update public.email_campaign_recipients
  set status = 'scheduled', scheduled_for = v_today, error_code = null
  where campaign_id = p_campaign_id and status = 'pending';
  get diagnostics scheduled_today = row_count;
  scheduled_later := 0;
  last_scheduled_for := v_today;
  update public.email_campaigns
  set status = 'scheduled', sent_at = coalesce(sent_at, now())
  where id = p_campaign_id;
  return next;
end;
$$;

create or replace function public.claim_due_email_campaign_recipients(p_campaign_id uuid default null)
returns setof public.email_campaign_recipients
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform pg_advisory_xact_lock(hashtext('email_campaign_daily_delivery')::bigint);
  return query
  with due as (
    select r.id from public.email_campaign_recipients r
    where r.status = 'scheduled' and r.scheduled_for <= v_today
      and (p_campaign_id is null or r.campaign_id = p_campaign_id)
    order by r.scheduled_for, r.created_at, r.id
    limit 25
    for update skip locked
  )
  update public.email_campaign_recipients as recipient
  set status = 'sending', processing_started_at = now(), attempted_on = v_today
  from due where recipient.id = due.id returning recipient.*;
end;
$$;
revoke all on function public.reserve_email_campaign_schedule(uuid) from public, anon, authenticated;
revoke all on function public.claim_due_email_campaign_recipients(uuid) from public, anon, authenticated;
grant execute on function public.reserve_email_campaign_schedule(uuid) to service_role;
grant execute on function public.claim_due_email_campaign_recipients(uuid) to service_role;
comment on column public.email_campaign_recipients.scheduled_for is
  'Data Europe/Rome di disponibilita nella coda Postmark; acquisizione atomica fino a 25 destinatari per esecuzione, senza quota giornaliera Gmail.';
