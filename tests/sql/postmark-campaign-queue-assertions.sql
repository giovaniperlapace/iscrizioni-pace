insert into email_campaigns values(md5('a')::uuid,'draft',null),(md5('b')::uuid,'draft',null);
insert into email_campaign_recipients(id,campaign_id,status)
select md5(n::text)::uuid, md5('a')::uuid,'pending' from generate_series(1,1205) n;
select * from reserve_email_campaign_schedule(md5('a')::uuid);
do $$ begin
  assert (select count(*)=1205 from email_campaign_recipients where status='scheduled' and scheduled_for=(now() at time zone 'Europe/Rome')::date), 'quota still active';
  assert (select scheduled_today=0 from reserve_email_campaign_schedule(md5('a')::uuid)), 'reservation not idempotent';
  assert not has_function_privilege('authenticated','public.claim_due_email_campaign_recipients(uuid)','execute'), 'authenticated can claim';
  assert not has_function_privilege('anon','public.reserve_email_campaign_schedule(uuid)','execute'), 'anon can schedule';
  assert has_function_privilege('service_role','public.claim_due_email_campaign_recipients(uuid)','execute'), 'service cannot claim';
end $$;
insert into email_campaign_recipients(id,campaign_id,status,scheduled_for)
values(md5('future')::uuid,md5('a')::uuid,'scheduled',current_date+10),
(md5('failed')::uuid,md5('a')::uuid,'failed',current_date),
(md5('other')::uuid,md5('b')::uuid,'scheduled',current_date);
do $$ declare claimed integer; total integer:=0; begin
  loop
    select count(*) into claimed from claim_due_email_campaign_recipients(md5('a')::uuid);
    exit when claimed=0;
    assert claimed<=25, 'unbounded batch';
    total:=total+claimed;
  end loop;
  assert total=1205, 'missing or duplicate claims above 1000';
  assert (select status='scheduled' from email_campaign_recipients where id=md5('other')::uuid), 'campaign scope lost';
  assert (select status='scheduled' from email_campaign_recipients where id=md5('future')::uuid), 'future schedule changed';
  assert (select status='failed' from email_campaign_recipients where id=md5('failed')::uuid), 'failed send retried';
  assert (select count(*)=1 from claim_due_email_campaign_recipients()), 'global queue not drained';
end $$;
