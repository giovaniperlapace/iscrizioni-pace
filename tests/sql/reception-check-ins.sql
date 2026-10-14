-- Synthetic identities only. Run through run-reception-checks.mjs on a fresh DB.
create function public.f(n integer) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
update events set is_current=false;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current) values
  (f(1),'p11-test','P11 test','Test','IT','2026-10-25','2026-10-27','published',true),
  (f(2),'p11-other','Other event','Test','IT','2026-10-25','2026-10-27','published',false);
insert into auth.users(id,email) select f(n),'p11-'||n||'@example.invalid' from generate_series(30,37) n;
insert into profiles(id,email) select id,email from auth.users;
insert into event_user_roles(event_id,user_id,role) values
  (f(1),f(30),'accoglienza'),(f(1),f(31),'manager'),(f(1),f(32),'manager_viewer'),
  (null,f(33),'admin'),(f(2),f(34),'accoglienza'),(f(1),f(36),'capogruppo');
insert into participants(id,first_name,last_name,public_code,auth_user_id) values
  (f(20),'Adult','Test','TST1',f(35)),(f(21),'Other','Test','TST2',null),
  (f(22),'Cancelled','Test','TST3',null),(f(23),'Foreign','Test','TST4',null),
  (f(24),'Deleted','Test','TST5',null),(f(25),'Draft','Test','TST6',null);
insert into registrations(id,event_id,participant_id,status) values
  (f(10),f(1),f(20),'confirmed'),(f(11),f(1),f(21),'submitted'),
  (f(12),f(1),f(22),'cancelled'),(f(13),f(2),f(23),'confirmed'),
  (f(14),f(1),f(24),'confirmed'),(f(15),f(1),f(25),'draft');
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values
  (f(40),f(10),1,'Child one','Test','2018-01-01'),(f(41),f(10),2,'Child two','Test','2019-01-01'),
  (f(42),f(11),1,'Other child','Test','2020-01-01');
insert into qr_tokens(registration_id,token_hash) values
  (f(10),repeat('a',64)),(f(11),repeat('c',64)),(f(12),repeat('d',64)),
  (f(13),repeat('e',64)),(f(14),repeat('f',64));
update registrations set deleted_at=now(),deletion_reason='Synthetic deletion' where id=f(14);
insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone)
  values(f(60),f(1),'teacher@example.invalid','Teacher','Test','+39000000');
insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
  values(f(50),f(1),f(60),'Test school','Test city','Class 1A',10,2,'test',now());
insert into school_booking_qr_tokens(booking_id,token_hash,token_encrypted) values(f(50),repeat('b',64),'synthetic');
-- Preserve and interpret legacy entries as adult only.
insert into check_ins(registration_id,event_id,source) values(f(11),f(1),'manual');
set role service_role;
do $$ declare v jsonb; n int; begin
  v:=reception_check_in(f(1),f(30),'qr',repeat('a',64));
  assert v->>'status'='valid' and jsonb_array_length(v->'persons')=3 and v->>'revision'='0';
  assert v::text !~ 'birth|email|phone|token|questionnaire|notes';
  assert (select count(*)=0 from check_ins where registration_id=f(10)), 'inspect mutated presence';
  foreach n in array array[32,34,35,36,37] loop
    begin perform reception_check_in(f(1),f(n),'code','TST1'); raise exception 'role bypass';
    exception when insufficient_privilege then null; end;
  end loop;
  foreach n in array array[31,33] loop assert reception_check_in(f(1),f(n),'code','TST1')->>'status'='valid'; end loop;
  begin perform reception_check_in(f(2),f(30),'code','TST4'); raise exception 'wrong event permitted';
  exception when insufficient_privilege then null; end;
end $$;
-- All invalid credentials collapse to the same minimal response.
do $$ declare code text; h text; begin
  foreach code in array array['XXXX','TST3','TST4','TST5','TST6'] loop
    assert reception_check_in(f(1),f(30),'code',code)='{"status":"invalid"}'::jsonb;
  end loop;
  foreach h in array array['0','d','e','f'] loop
    assert reception_check_in(f(1),f(30),'qr',repeat(h,64))='{"status":"invalid"}'::jsonb;
  end loop;
end $$;
reset role;
update qr_tokens set expires_at=now()-interval '1 second' where registration_id=f(11);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('c',64))->>'status'='invalid'; end $$;
reset role;
update qr_tokens set expires_at=null,revoked_at=now() where registration_id=f(11);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('c',64))->>'status'='invalid'; end $$;
reset role;
update qr_tokens set revoked_at=null,status='revoked' where registration_id=f(11);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('c',64))->>'status'='invalid'; end $$;
reset role;
update qr_tokens set status='active' where registration_id=f(11);
insert into qr_tokens(registration_id,token_hash,status,created_at) values(f(11),repeat('1',64),'revoked',now()+interval '1 second');
set role service_role;
do $$ begin
  assert reception_check_in(f(1),f(30),'qr',repeat('c',64))->>'status'='invalid', 'old token fallback';
  assert reception_check_in(f(1),f(30),'code','TST2')->'persons'->0->>'checkedInAt' is not null,'manual fallback/legacy adult';
end $$;
-- Partial family: child only; adult and other child remain absent.
do $$ declare v jsonb; t timestamptz; begin
  v:=reception_check_in(f(1),f(30),'qr',repeat('a',64),'enter',f(100),array[f(40)]);
  assert v->>'revision'='1' and v->>'outcome'='saved';
  assert (select count(*)=1 from check_ins where registration_id=f(10) and child_id=f(40));
  select checked_in_at into t from check_ins where child_id=f(40);
  assert reception_check_in(f(1),f(30),'qr',repeat('a',64),'enter',f(100),array[f(40)])->>'outcome'='replayed';
  assert reception_check_in(f(1),f(30),'qr',repeat('a',64),'enter',f(101),array[f(40)])->>'outcome'='unchanged';
  assert (select checked_in_at=t from check_ins where child_id=f(40));
  begin perform reception_check_in(f(1),f(30),'code','TST1','enter',f(100),array[f(10)]); raise exception 'changed retry accepted';
  exception when invalid_parameter_value then null; end;
  begin perform reception_check_in(f(1),f(30),'code','TST1','enter',f(102),array[f(42)]); raise exception 'foreign child accepted';
  exception when invalid_parameter_value then null; end;
  assert reception_check_in(f(1),f(30),'code','TST1','correct',f(103),array[f(10)],null,null,0,'selection_error')->>'status'='conflict';
  v:=reception_check_in(f(1),f(30),'code','TST1','correct',f(104),array[f(10)],null,null,1,'selection_error');
  assert v->>'revision'='2';
  assert (select cancelled_at is not null from check_ins where child_id=f(40));
  assert (select count(*)=1 from check_ins where registration_id=f(10) and cancelled_at is null);
  v:=reception_check_in(f(1),f(30),'code','TST1','cancel',f(105),array[f(10)],null,null,2,'entry_cancelled');
  assert v->>'revision'='3';
  -- A delayed successful correction retry must NOT undo a later cancellation.
  assert reception_check_in(f(1),f(30),'code','TST1','correct',f(104),array[f(10)],null,null,1,'selection_error')->>'outcome'='replayed';
  assert (select count(*)=0 from check_ins where registration_id=f(10) and cancelled_at is null);
end $$;
-- School attendance is aggregate, bounded and never summed on a second scan.
do $$ declare v jsonb; begin
  assert reception_check_in(f(1),f(30),'qr',repeat('b',64))->>'kind'='school';
  begin perform reception_check_in(f(1),f(30),'qr',repeat('b',64),'enter',f(200),'{}',11,1); raise exception 'overcount accepted';
  exception when invalid_parameter_value then null; end;
  assert reception_check_in(f(1),f(30),'qr',repeat('b',64),'enter',f(201),'{}',8,1)->>'revision'='1';
  assert reception_check_in(f(1),f(30),'qr',repeat('b',64),'enter',f(202),'{}',10,2)->>'outcome'='unchanged';
  assert (select student_count=8 and companion_count=1 from check_ins where school_booking_id=f(50));
  v:=reception_check_in(f(1),f(30),'qr',repeat('b',64),'correct',f(203),'{}',9,2,1,'count_error');
  assert v->>'students'='9' and v->>'revision'='2';
  assert reception_check_in(f(1),f(30),'qr',repeat('b',64),'cancel',f(204),'{}',null,null,2,'entry_cancelled')->>'students'='0';
end $$;
reset role;
-- Cancellation after verification is checked again at mutation time.
update school_bookings set status='cancelled',cancelled_at=now() where id=f(50);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('b',64),'enter',f(205),'{}',8,1)->>'status'='invalid'; end $$;
reset role;
update school_bookings set status='submitted',cancelled_at=null where id=f(50);
-- School QR lifecycle and namespace collision also fail closed.
update school_booking_qr_tokens set expires_at=now()-interval '1 second' where booking_id=f(50);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('b',64))->>'status'='invalid'; end $$;
reset role;
update school_booking_qr_tokens set expires_at=null,revoked_at=now() where booking_id=f(50);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('b',64))->>'status'='invalid'; end $$;
reset role;
update school_booking_qr_tokens set revoked_at=null,status='revoked' where booking_id=f(50);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('b',64))->>'status'='invalid'; end $$;
reset role;
update school_booking_qr_tokens set status='active',token_hash=repeat('a',64) where booking_id=f(50);
set role service_role;
do $$ begin assert reception_check_in(f(1),f(30),'qr',repeat('a',64))->>'status'='invalid'; end $$;
reset role;
update school_booking_qr_tokens set token_hash=repeat('b',64) where booking_id=f(50);
-- Foreign person/event relations are also rejected by table constraints.
do $$ begin
  begin insert into check_ins(registration_id,event_id,child_id) values(f(10),f(1),f(42)); raise exception 'foreign child linked'; exception when foreign_key_violation then null; end;
  begin insert into check_ins(registration_id,event_id) values(f(10),f(2)); raise exception 'foreign event linked'; exception when check_violation then null; end;
  begin insert into check_ins(school_booking_id,event_id,student_count,companion_count) values(f(50),f(2),1,1); raise exception 'foreign school event linked'; exception when check_violation then null; end;
end $$;
-- History prevents destructive child replacement and identity substitution.
select set_config('request.jwt.claim.sub',f(35)::text,false);
set role authenticated;
do $$ begin
  assert replace_owned_registration_children(f(10),'[{"position":1,"first_name":"Child one","last_name":"Test","birth_date":"2018-01-01"},{"position":2,"first_name":"Child two","last_name":"Test","birth_date":"2019-01-01"}]')=2;
  begin update registrations set check_in_revision=0 where id=f(10); raise exception 'revision forged'; exception when insufficient_privilege then null; end;
  begin perform replace_owned_registration_children(f(10),'[]'); raise exception 'history erased'; exception when check_violation then null; end;
  begin update registration_children set first_name='Replacement' where id=f(40); raise exception 'history reassigned'; exception when check_violation then null; end;
end $$;
reset role;
-- RLS and grants for every role: reception cannot read raw QR, children or PII.
select set_config('request.jwt.claim.sub',f(30)::text,false);
set role authenticated;
do $$ begin
  assert (select count(*)=0 from qr_tokens);
  assert (select count(*)=0 from check_ins);
  assert (select count(*)=0 from participants);
  assert (select count(*)=0 from registration_children);
  assert (select count(*)=0 from school_bookings);
  begin perform reception_check_in(f(1),f(33),'code','TST1'); raise exception 'forged actor'; exception when insufficient_privilege then null; end;
  begin insert into check_ins(registration_id,event_id) values(f(10),f(1)); raise exception 'direct write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform reception_check_in(f(1),f(30),'code','TST1'); raise exception 'anonymous RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Authenticated manager/viewer/admin have event reads, but cannot bypass audit with direct writes.
do $$ declare actor int; begin
  foreach actor in array array[31,32,33] loop
    perform set_config('request.jwt.claim.sub',f(actor)::text,true);
    set local role authenticated;
    assert (select count(*)>=1 from check_ins where event_id=f(1));
    begin update check_ins set cancelled_at=null where event_id=f(1); raise exception 'unaudited update'; exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;
-- Audit failure rolls back check-in AND idempotency ledger AND revision.
create function fail_p11_audit() returns trigger language plpgsql as $$ begin
  if new.action like 'reception.%' then raise exception 'synthetic audit failure'; end if; return new; end $$;
create trigger fail_p11_audit before insert on audit_logs for each row execute function fail_p11_audit();
set role service_role;
do $$ declare rev int; begin
  select check_in_revision into rev from registrations where id=f(10);
  begin perform reception_check_in(f(1),f(30),'code','TST1','enter',f(300),array[f(41)]); raise exception 'unexpected success';
  exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
  assert (select count(*)=0 from check_ins where child_id=f(41));
  assert (select check_in_revision=rev from registrations where id=f(10));
  assert (select count(*)=0 from check_in_requests where request_id=f(300));
end $$;
reset role;
drop trigger fail_p11_audit on audit_logs;
do $$ begin
  assert not exists(select 1 from audit_logs where action like 'reception.%' and metadata::text ~ 'token|Adult|Child|teacher@|birth|email|phone');
  assert exists(select 1 from audit_logs where action='reception.enter' and entity_id=f(10) and metadata->'after' @> jsonb_build_array(jsonb_build_object('child_id',f(40))));
  assert (select count(*)=0 from moment_attendance_choices where registration_id=f(10));
end $$;
select 'PASS QR states, actor/event scope, family, school, retry/correction, RLS, history, audit rollback';
