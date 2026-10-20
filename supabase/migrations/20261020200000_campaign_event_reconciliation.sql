-- Reconcile campaign summary after definitive provider evidence.
create or replace function public.record_campaign_delivery_event(p_event jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into email_delivery_events(event_key,message_hash,email_hash,kind,occurred_at,detail,retryable)
 values(p_event->>'event_key',p_event->>'message_hash',p_event->>'email_hash',p_event->>'kind',(p_event->>'occurred_at')::timestamptz,left(p_event->>'detail',1500),coalesce((p_event->>'retryable')::boolean,false))
 on conflict(event_key) do update set retryable=email_delivery_events.retryable or excluded.retryable;
 if p_event->>'kind'='SubscriptionChange' then
  insert into email_delivery_suppressions values(p_event->>'email_hash',(p_event->>'suppressed')::boolean,p_event->>'reason',p_event->>'origin',(p_event->>'occurred_at')::timestamptz)
  on conflict(email_hash) do update set suppressed=excluded.suppressed,reason=excluded.reason,origin=excluded.origin,occurred_at=excluded.occurred_at
  where excluded.occurred_at>=email_delivery_suppressions.occurred_at;
 end if;
 -- A verified event can resolve an ambiguous submission, including before the API response.
 if p_event->>'kind' in ('Delivery','Bounce','SpamComplaint') and p_event->>'recipient_id' is not null then
  update email_campaign_recipients set status='sent',provider_message_id=p_event->>'message_hash',error_code=null,
    sent_at=coalesce(sent_at,(p_event->>'occurred_at')::timestamptz),processing_started_at=null
  where id=(p_event->>'recipient_id')::uuid and status in ('sending','unknown')
   and encode(extensions.digest(lower(trim(delivery_email_snapshot)),'sha256'),'hex')=p_event->>'email_hash'
   and (provider_message_id is null or provider_message_id=p_event->>'message_hash');
 end if;
 with states as (
  select r.campaign_id,case
    when count(*) filter(where r.status='unknown')>0 then 'attention'
    when count(*) filter(where r.status in ('pending','scheduled','sending'))>0 then 'scheduled'
    when count(*) filter(where r.status='failed')=0 then 'completed'
    when count(*) filter(where r.status='sent')=0 then 'failed' else 'partial' end as status
  from email_campaign_recipients r where r.campaign_id in
   (select campaign_id from email_campaign_recipients where provider_message_id=p_event->>'message_hash')
  group by r.campaign_id
 ) update email_campaigns c set status=states.status from states where c.id=states.campaign_id
   and c.status in ('scheduled','sending','attention','completed','partial','failed') and c.status is distinct from states.status;
end $$;
