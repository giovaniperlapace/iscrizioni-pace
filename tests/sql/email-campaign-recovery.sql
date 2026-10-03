-- Run after the postmark queue fixture, both migrations and original assertions.
insert into email_campaign_recipients(id,campaign_id,status,scheduled_for)
values(md5('retry')::uuid,md5('a')::uuid,'scheduled',current_date),
(md5('unknown')::uuid,md5('a')::uuid,'unknown',current_date);
do $$ declare v_pause timestamptz; begin
  v_pause := pause_email_campaign_delivery('postmark_429',false,180);
  assert v_pause >= now()+interval '180 seconds', 'Retry-After ignored';
  assert (select count(*)=0 from claim_due_email_campaign_recipients()), 'global pause bypassed';
  assert (select count(*)=0 from claim_due_email_campaign_recipients(md5('a')::uuid)), 'campaign pause bypassed';
  assert (select status='scheduled' from email_campaign_recipients where id=md5('retry')::uuid), 'retry row consumed during pause';
  perform pause_email_campaign_delivery('postmark_10',true,60);
  update email_campaign_delivery_control set paused_until=now()-interval '1 second';
  assert (select count(*)=0 from claim_due_email_campaign_recipients()), 'configuration block expired automatically';
  perform resume_email_campaign_delivery();
  assert (select count(*)=1 from claim_due_email_campaign_recipients()), 'safe retry not recovered';
  assert (select status='unknown' from email_campaign_recipients where id=md5('unknown')::uuid), 'unknown outcome retried';
  assert (select status='failed' from email_campaign_recipients where id=md5('failed')::uuid), 'old failed row retried';
  assert (select count(*)=0 from claim_due_email_campaign_recipients()), 'duplicate claim';
  assert not has_function_privilege('authenticated','public.pause_email_campaign_delivery(text,boolean,integer)','execute'), 'public pause';
  assert not has_function_privilege('anon','public.resume_email_campaign_delivery()','execute'), 'public resume';
  assert not has_table_privilege('authenticated','public.email_campaign_delivery_control','update'), 'public control write';
  assert has_function_privilege('service_role','public.resume_email_campaign_delivery()','execute'), 'service cannot resume';
  perform pause_email_campaign_delivery('postmark_429');
  perform pause_email_campaign_delivery('postmark_429');
  assert (select paused_until >= now()+interval '120 seconds' from email_campaign_delivery_control), 'no exponential backoff';
end $$;
