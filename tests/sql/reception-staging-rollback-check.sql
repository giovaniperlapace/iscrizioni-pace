-- Staging only: existing synthetic group-panel fixture. No persistent test writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create temporary table p11_context on commit drop as
select r.id registration_id,r.event_id,p.public_code,child.id child_id,u.id actor_id,
  gen_random_uuid() booking_id,gen_random_uuid() teacher_id,
  encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex') token_hash
from public.registrations r join public.participants p on p.id=r.participant_id
join public.events e on e.id=r.event_id
join public.registration_children child on child.registration_id=r.id
cross join auth.users u
where e.is_current and r.deleted_at is null and p.first_name='Anna' and p.last_name='Test Panel'
  and u.email='capogruppo.panel.staging@example.invalid';
do $$ begin
  assert (select count(*)=1 from p11_context),'Expected one synthetic family with child';
  assert has_function_privilege('service_role','public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','EXECUTE');
  assert not has_function_privilege('anon','public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','EXECUTE');
  assert not has_table_privilege('authenticated','public.check_ins','INSERT');
  assert not has_table_privilege('authenticated','public.check_ins','UPDATE');
  assert not has_table_privilege('authenticated','public.check_ins','DELETE');
end $$;
-- Synthetic QR exists only until rollback, including when the fixture has no QR.
insert into public.qr_tokens(registration_id,token_hash,created_at)
select registration_id,token_hash,greatest(clock_timestamp(),coalesce((select max(q.created_at) from public.qr_tokens q where q.registration_id=c.registration_id),clock_timestamp()))+interval '1 second'
from p11_context c;
-- Temporary operational role on a designated synthetic staging account.
insert into public.event_user_roles(event_id,user_id,role)
select event_id,actor_id,'accoglienza' from p11_context
where not exists(select 1 from public.event_user_roles where event_id=p11_context.event_id and user_id=p11_context.actor_id and role='accoglienza');
insert into public.school_booking_teachers(id,event_id,email,first_name,last_name,phone)
select teacher_id,event_id,'p11-rollback@example.invalid','Docente','P11 Test','+39000000' from p11_context;
insert into public.school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
select booking_id,event_id,teacher_id,'Scuola P11 Test','Test','Classe rollback',10,2,'test',now() from p11_context;
insert into public.school_booking_qr_tokens(booking_id,token_hash,token_encrypted)
select booking_id,encode(sha256(convert_to(booking_id::text,'UTF8')),'hex'),'synthetic' from p11_context;
grant select on p11_context to service_role;
set local role service_role;
do $$ declare c record; v jsonb; request_id uuid:=gen_random_uuid(); revision integer; baseline_panels text; baseline_intentions text; begin
  select * into strict c from p11_context;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) into baseline_panels from public.moment_attendance_choices t;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) into baseline_intentions from public.event_attendance_choices t;
  v:=public.reception_check_in(c.event_id,c.actor_id,'qr',c.token_hash);
  assert v->>'status'='valid' and v->>'kind'='family';
  assert v::text !~ 'birth|email|phone|token|questionnaire|notes';
  begin perform public.reception_check_in(c.event_id,gen_random_uuid(),'code',c.public_code); raise exception 'Foreign actor accepted';
  exception when insufficient_privilege then null; end;
  assert public.reception_check_in(c.event_id,c.actor_id,'qr',repeat('0',64))->>'status'='invalid';
  v:=public.reception_check_in(c.event_id,c.actor_id,'qr',c.token_hash,'enter',request_id,array[c.child_id]);
  assert v->>'status'='valid';
  assert (select count(*)=1 from public.check_ins where child_id=c.child_id and cancelled_at is null);
  assert public.reception_check_in(c.event_id,c.actor_id,'qr',c.token_hash,'enter',request_id,array[c.child_id])->>'outcome'='replayed';
  revision:=(v->>'revision')::integer;
  assert public.reception_check_in(c.event_id,c.actor_id,'code',c.public_code,'correct',gen_random_uuid(),array[c.registration_id],null,null,revision+1,'selection_error')->>'status'='conflict';
  v:=public.reception_check_in(c.event_id,c.actor_id,'code',c.public_code,'correct',gen_random_uuid(),array[c.registration_id],null,null,revision,'selection_error');
  assert (select cancelled_at is not null from public.check_ins where child_id=c.child_id);
  revision:=(v->>'revision')::integer;
  v:=public.reception_check_in(c.event_id,c.actor_id,'code',c.public_code,'cancel',gen_random_uuid(),array[c.registration_id],null,null,revision,'entry_cancelled');
  assert (select count(*)=0 from public.check_ins where registration_id=c.registration_id and moment_id is null and cancelled_at is null);
  v:=public.reception_check_in(c.event_id,c.actor_id,'qr',encode(sha256(convert_to(c.booking_id::text,'UTF8')),'hex'),'enter',gen_random_uuid(),'{}',8,1);
  assert v->>'students'='8' and v->>'companions'='1';
  v:=public.reception_check_in(c.event_id,c.actor_id,'qr',encode(sha256(convert_to(c.booking_id::text,'UTF8')),'hex'),'correct',gen_random_uuid(),'{}',9,2,(v->>'revision')::integer,'count_error');
  assert v->>'students'='9';
  v:=public.reception_check_in(c.event_id,c.actor_id,'qr',encode(sha256(convert_to(c.booking_id::text,'UTF8')),'hex'),'cancel',gen_random_uuid(),'{}',null,null,(v->>'revision')::integer,'entry_cancelled');
  assert v->>'students'='0';
  assert exists(select 1 from public.audit_logs where action='reception.correct' and entity_id=c.registration_id and actor_user_id=c.actor_id and metadata ? 'after');
  assert (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))=baseline_panels from public.moment_attendance_choices t),'Panel choices changed';
  assert (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))=baseline_intentions from public.event_attendance_choices t),'Declared attendance changed';
end $$;
reset role;
select 'PASS staging RPC, family, school, retry, correction conflict, cancellation, actor scope, audit and preserved intentions/panels';
rollback;
