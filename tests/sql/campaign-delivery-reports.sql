create schema extensions;
create schema app;
create extension pgcrypto with schema extensions;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table events(id uuid primary key);
create table event_user_roles(user_id uuid,role text,event_id uuid);
create table email_campaigns(id uuid primary key default extensions.gen_random_uuid(),event_id uuid references events,name text,subject_template text,body_template text,status text,filters_snapshot jsonb,recipient_count integer,test_sent_at timestamptz,test_sent_to_user_id uuid,sent_at timestamptz,created_by uuid);
create table email_campaign_recipients(id uuid primary key default extensions.gen_random_uuid(),campaign_id uuid references email_campaigns,participant_id uuid,registration_id uuid,delivery_kind text,delegate_user_id uuid,status text,provider_message_id text,error_code text,sent_at timestamptz,processing_started_at timestamptz,recipient_key text,recipient_type text,recipient_user_id uuid,school_teacher_id uuid,delivery_order integer,scheduled_for date);
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
\ir ../../supabase/migrations/20261020180000_campaign_delivery_reports.sql
\ir ../../supabase/migrations/20261020190000_campaign_evidence_guard.sql
\ir ../../supabase/migrations/20261020200000_campaign_event_reconciliation.sql
\ir ../../supabase/migrations/20261020210000_campaign_retry_recoverable_only.sql
insert into events values(md5('event')::uuid),(md5('other')::uuid);
insert into event_user_roles values(md5('manager')::uuid,'manager',md5('event')::uuid),(md5('viewer')::uuid,'manager_viewer',md5('event')::uuid);
insert into email_campaigns(id,event_id,name,subject_template,body_template,status,recipient_count,test_sent_at) values(md5('campaign')::uuid,md5('event')::uuid,'Campagna','Oggetto','Testo','partial',3,now());
insert into email_campaign_recipients(id,campaign_id,status,error_code,delivery_email_snapshot,recipient_name_snapshot,recipient_key,recipient_type,delivery_kind)
select md5(n)::uuid,md5('campaign')::uuid,'failed','delivery_failed',n||'@example.org',n,n,'group_leader','leader' from unnest(array['retry','blocked','delivered','unknown','race']) n;
update email_campaign_recipients set status='unknown' where recipient_key='unknown';
update email_campaign_recipients set provider_message_id='message-delivered',status='sent' where recipient_key='delivered';
insert into email_delivery_events values('delivery','message-delivered','x','Delivery',now(),'ok',false,now());
insert into email_delivery_suppressions values(encode(extensions.digest('blocked@example.org','sha256'),'hex'),true,'ManualSuppression','Recipient',now());
do $$ declare e jsonb; result uuid; before_count integer; begin
 assert not has_function_privilege('authenticated','record_campaign_delivery_event(jsonb)','execute');
 assert not has_function_privilege('anon','retry_email_campaign_recipients(uuid,uuid[],uuid)','execute');
 assert not has_table_privilege('authenticated','email_delivery_events','select');
 e:=jsonb_build_object('event_key','early','message_hash','message-early','email_hash',encode(extensions.digest('unknown@example.org','sha256'),'hex'),'kind','Delivery','occurred_at',now(),'detail','ok','recipient_id',md5('unknown')::uuid);
 perform record_campaign_delivery_event(e);perform record_campaign_delivery_event(e);
 assert (select count(*)=1 from email_delivery_events where event_key='early');
 assert (select status='sent' and provider_message_id='message-early' from email_campaign_recipients where recipient_key='unknown');
 e:=jsonb_build_object('event_key','new','email_hash','subscription','kind','SubscriptionChange','occurred_at',now(),'detail','','reason','ManualSuppression','origin','Recipient','suppressed',false);
 perform record_campaign_delivery_event(e);
 perform record_campaign_delivery_event(e||jsonb_build_object('event_key','old','occurred_at',now()-interval '1 day','suppressed',true));
 assert (select not suppressed from email_delivery_suppressions where email_hash='subscription');
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid],md5('viewer')::uuid);raise exception 'viewer accepted';exception when raise_exception then assert sqlerrm='Accesso non consentito';end;
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('blocked')::uuid],md5('manager')::uuid);raise exception 'blocked accepted';exception when raise_exception then assert sqlerrm='Destinatario non reinviabile';end;
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('delivered')::uuid],md5('manager')::uuid);raise exception 'delivered accepted';exception when raise_exception then assert sqlerrm='Destinatario non reinviabile';end;
 update email_campaign_recipients set error_code='invalid_recipient' where recipient_key='retry';
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid],md5('manager')::uuid);raise exception 'invalid address accepted';exception when raise_exception then assert sqlerrm='Destinatario non reinviabile';end;
 update email_campaign_recipients set error_code='postmark_message_too_large' where recipient_key='retry';
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid],md5('manager')::uuid);raise exception 'oversized message accepted';exception when raise_exception then assert sqlerrm='Destinatario non reinviabile';end;
 update email_campaign_recipients set error_code='delivery_failed' where recipient_key='retry';
 select count(*) into before_count from email_campaigns;
 begin perform retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid,md5('blocked')::uuid],md5('manager')::uuid);raise exception 'mixed accepted';exception when raise_exception then assert sqlerrm='Destinatario non reinviabile';end;
 assert (select count(*)=before_count from email_campaigns),'partial retry persisted';
 result:=retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid],md5('manager')::uuid);
 assert result=retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('retry')::uuid],md5('manager')::uuid),'duplicate retry';
 assert (select count(*)=1 from email_campaign_recipients where campaign_id=result and status='scheduled');
 assert (select status='failed' from email_campaign_recipients where recipient_key='retry' and campaign_id=md5('campaign')::uuid),'history changed';
 assert (select count(*)=1 from audit_logs),'duplicate audit';
end $$;

grant usage on schema public,app to authenticated;
grant select,update on email_campaign_recipients to authenticated;
set role authenticated;
do $$ begin
 begin update email_campaign_recipients set provider_message_id='forged' where recipient_key='delivered';raise exception 'forged evidence accepted';
 exception when raise_exception then assert sqlerrm='Esito riservato al servizio';end;
end $$;
reset role;
