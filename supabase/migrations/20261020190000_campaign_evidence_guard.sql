-- Reporting evidence and submission state are server-owned. Existing UI writes
-- already use service-role operations; a direct REST client cannot forge retry eligibility.
create function app.protect_campaign_delivery_evidence() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_table_name='email_campaign_recipients' then
   if tg_op='INSERT' then
    if new.delivery_email_snapshot is not null or new.recipient_name_snapshot is not null or new.provider_message_id is not null or new.status not in ('pending','skipped') then raise exception 'Esito riservato al servizio';end if;
   elsif row(new.delivery_email_snapshot,new.recipient_name_snapshot,new.provider_message_id,new.status,new.error_code,new.sent_at)
    is distinct from row(old.delivery_email_snapshot,old.recipient_name_snapshot,old.provider_message_id,old.status,old.error_code,old.sent_at) then raise exception 'Esito riservato al servizio';end if;
  else
   if tg_op='INSERT' then
    if new.retry_of_campaign_id is not null then raise exception 'Reinvio riservato al servizio';end if;
   elsif new.retry_of_campaign_id is distinct from old.retry_of_campaign_id then raise exception 'Reinvio riservato al servizio';end if;
  end if;
 end if;
 return new;
end $$;
create trigger email_recipient_evidence_guard before insert or update on public.email_campaign_recipients for each row execute function app.protect_campaign_delivery_evidence();
create trigger email_campaign_retry_guard before insert or update on public.email_campaigns for each row execute function app.protect_campaign_delivery_evidence();
revoke all on function app.protect_campaign_delivery_evidence() from public,anon,authenticated;
