alter table public.email_campaigns
  drop constraint if exists email_campaigns_status_check,
  drop constraint if exists email_campaigns_recipient_count_check;

alter table public.email_campaigns
  add constraint email_campaigns_status_check
    check (status in (
      'draft',
      'ready',
      'sending',
      'scheduled',
      'completed',
      'partial',
      'failed',
      'cancelled'
    )),
  add constraint email_campaigns_recipient_count_check
    check (recipient_count >= 0);

alter table public.email_campaign_recipients
  drop constraint if exists email_campaign_recipients_delivery_kind_check,
  drop constraint if exists email_campaign_recipients_status_check,
  drop constraint if exists email_campaign_recipients_campaign_id_participant_id_key;

alter table public.email_campaign_recipients
  alter column participant_id drop not null,
  alter column registration_id drop not null,
  add column recipient_key text,
  add column recipient_type text not null default 'participant',
  add column recipient_user_id uuid references auth.users(id) on delete set null,
  add column delivery_order integer check (delivery_order is null or delivery_order > 0),
  add column scheduled_for date,
  add column attempted_on date,
  add column processing_started_at timestamptz;

update public.email_campaign_recipients
set recipient_key = 'participant:' || participant_id::text
where recipient_key is null;

alter table public.email_campaign_recipients
  alter column recipient_key set not null,
  add constraint email_campaign_recipients_recipient_type_check
    check (recipient_type in ('participant', 'group_leader')),
  add constraint email_campaign_recipients_delivery_kind_check
    check (delivery_kind in ('direct', 'delegated', 'leader')),
  add constraint email_campaign_recipients_status_check
    check (status in (
      'pending',
      'scheduled',
      'sending',
      'sent',
      'failed',
      'skipped'
    )),
  add constraint email_campaign_recipients_target_check
    check (
      (
        recipient_type = 'participant'
        and participant_id is not null
        and registration_id is not null
        and recipient_user_id is null
        and delivery_kind in ('direct', 'delegated')
      )
      or
      (
        recipient_type = 'group_leader'
        and registration_id is null
        and delivery_kind = 'leader'
      )
    ),
  add constraint email_campaign_recipients_campaign_recipient_key_unique
    unique (campaign_id, recipient_key);

create index email_campaign_recipients_daily_queue_idx
  on public.email_campaign_recipients(status, scheduled_for, created_at)
  where status in ('scheduled', 'sending');

create index email_campaign_recipients_attempted_on_idx
  on public.email_campaign_recipients(attempted_on)
  where attempted_on is not null;

comment on column public.email_campaign_recipients.recipient_key is
  'Chiave congelata della campagna: participant:<uuid> oppure leader:<auth-user-uuid>.';

comment on column public.email_campaign_recipients.scheduled_for is
  'Giorno Europe/Rome riservato dalla coda, con tetto globale di 300 tentativi al giorno.';

create or replace function public.reserve_email_campaign_schedule(
  p_campaign_id uuid
)
returns table (
  scheduled_today integer,
  scheduled_later integer,
  last_scheduled_for date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_date date := (now() at time zone 'Europe/Rome')::date;
  v_reserved integer;
  v_recipient record;
begin
  perform pg_advisory_xact_lock(
    hashtext('email_campaign_daily_schedule')::bigint
  );

  scheduled_today := 0;
  scheduled_later := 0;

  for v_recipient in
    select id
    from public.email_campaign_recipients
    where campaign_id = p_campaign_id
      and status = 'pending'
    order by delivery_order nulls last, created_at, id
  loop
    loop
      select count(*)::integer
      into v_reserved
      from public.email_campaign_recipients
      where scheduled_for = v_date
        and status in ('scheduled', 'sending', 'sent', 'failed');

      exit when v_reserved < 300;
      v_date := v_date + 1;
    end loop;

    update public.email_campaign_recipients
    set
      status = 'scheduled',
      scheduled_for = v_date,
      error_code = null
    where id = v_recipient.id;

    if v_date = v_today then
      scheduled_today := scheduled_today + 1;
    else
      scheduled_later := scheduled_later + 1;
    end if;
  end loop;

  update public.email_campaigns
  set
    status = 'scheduled',
    sent_at = coalesce(sent_at, now())
  where id = p_campaign_id;

  last_scheduled_for := v_date;
  return next;
end;
$$;

create or replace function public.claim_due_email_campaign_recipients(
  p_campaign_id uuid default null
)
returns setof public.email_campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_attempted integer;
  v_capacity integer;
begin
  perform pg_advisory_xact_lock(
    hashtext('email_campaign_daily_delivery')::bigint
  );

  select count(*)::integer
  into v_attempted
  from public.email_campaign_recipients
  where attempted_on = v_today;

  v_capacity := greatest(0, 300 - v_attempted);

  if v_capacity = 0 then
    return;
  end if;

  return query
  with due as (
    select id
    from public.email_campaign_recipients
    where status = 'scheduled'
      and scheduled_for <= v_today
      and (p_campaign_id is null or campaign_id = p_campaign_id)
    order by scheduled_for, created_at, id
    limit v_capacity
    for update skip locked
  )
  update public.email_campaign_recipients as recipient
  set
    status = 'sending',
    processing_started_at = now(),
    attempted_on = v_today
  from due
  where recipient.id = due.id
  returning recipient.*;
end;
$$;

revoke all on function public.reserve_email_campaign_schedule(uuid) from public;
revoke all on function public.claim_due_email_campaign_recipients(uuid) from public;
revoke all on function public.reserve_email_campaign_schedule(uuid) from anon, authenticated;
revoke all on function public.claim_due_email_campaign_recipients(uuid) from anon, authenticated;
grant execute on function public.reserve_email_campaign_schedule(uuid) to service_role;
grant execute on function public.claim_due_email_campaign_recipients(uuid) to service_role;
