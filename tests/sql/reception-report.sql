begin;
-- The fixture was exercised earlier; isolate a deterministic report window.
insert into check_ins(event_id,registration_id,child_id,source)
 select f(1),f(10),x,'manual' from unnest(array[null::uuid,f(40),f(41)]) x
 where not exists(select 1 from check_ins where registration_id=f(10) and moment_id is null and child_id is not distinct from x);
update check_ins set checked_in_at='2026-10-25 09:59:00Z',cancelled_at=null where event_id=f(1) and registration_id=f(10);
insert into event_attendance_choices(registration_id,day,day_part,choice) values
 (f(10),'2026-10-25','morning','yes'),(f(10),'2026-10-25','afternoon','yes'),(f(11),'2026-10-25','morning','no');
insert into audit_logs(event_id,entity_table,action,metadata,created_at) values
 (f(1),'check_ins','reception.enter','{"outcome":"unchanged"}','2026-10-25 09:30:00Z'),
 (f(1),'check_ins','reception.enter','{"outcome":"replayed"}','2026-10-25 09:30:00Z'),
 (f(1),'check_ins','reception.correct','{"outcome":"saved"}','2026-10-25 10:59:00Z'),
 (f(1),'check_ins','reception.cancel','{"outcome":"saved"}','2026-10-25 11:00:00Z'),
 (f(2),'check_ins','reception.enter','{"outcome":"unchanged"}','2026-10-25 09:30:00Z');
insert into event_locations(id,event_id,name,max_capacity,is_active) values(f(1300),f(1),'Report room',20,true);
insert into panel_audience_types(id,event_id,code,name,booking_channel) values(f(1301),f(1),'report_schools','Report schools','school_booking');
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status) values
 (f(1302),f(1),f(1300),'First report panel','2026-10-25 08:00:00+01','2026-10-25 09:00:00+01','panel','draft'),
 (f(1303),f(1),f(1300),'Second report panel','2026-10-25 09:00:00+01','2026-10-25 10:00:00+01','panel','draft');
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values
 (f(1304),f(1),f(1302),f(1301),20),(f(1305),f(1),f(1303),f(1301),20);
update event_moments set publication_status='published' where id in (f(1302),f(1303));
insert into school_panel_reservations(event_id,booking_id,panel_id,seat_section_id,student_count,companion_count) values
 (f(1),f(50),f(1302),f(1304),10,2),(f(1),f(50),f(1303),f(1305),10,2);
insert into event_user_roles(event_id,user_id,role) values(f(2),f(34),'manager');
do $$ declare actor int; v jsonb; begin
 foreach actor in array array[31,32,33] loop
  perform set_config('request.jwt.claim.sub',f(actor)::text,true);
  set local role authenticated;
  v:=reception_operational_report(f(1),'2026-10-25','morning');
  assert v->'expected'->>'adults'='1' and v->'expected'->>'children'='2','declared family expected once';
  assert v->'expected'->>'students'='10' and v->'expected'->>'schoolBookings'='1','school counted once across two panels';
  assert v->'arrivals'->>'adults'='1' and v->'arrivals'->>'children'='2','actual family independent';
  assert v->'operations'->>'duplicateRequests'='1' and v->'operations'->>'retries'='1';
  assert v->'operations'->>'corrections'='1' and v->'operations'->>'cancellations'='0','Rome noon boundary';
  assert v::text !~ 'actor|token|email|firstName|registrationId','minimal aggregates';
  v:=reception_operational_report(f(1),'2026-10-25','afternoon');
  assert v->'operations'->>'cancellations'='1';
  assert v->'expected'->>'students'='0','school without panel in this slot excluded';
  assert v->'arrivals'->>'adults'='0','earlier arrivals are not current occupancy';
  v:=reception_operational_report(f(1));
  assert (v->'expected'->>'students')::int=10 and (v->'expected'->>'companions')::int=2;
  begin perform reception_operational_report(f(1),null,'morning'); raise exception 'bad filter allowed'; exception when invalid_parameter_value then null; end;
  reset role;
 end loop;
 foreach actor in array array[30,34,35,36,37] loop
  perform set_config('request.jwt.claim.sub',f(actor)::text,true); set local role authenticated;
  begin perform reception_operational_report(f(1)); raise exception 'report scope bypass'; exception when insufficient_privilege then null; end;
  reset role;
 end loop;
end $$;
-- Event roles are rechecked even within an already authenticated session.
delete from event_user_roles where user_id=f(31);
set local role authenticated;
select set_config('request.jwt.claim.sub',f(31)::text,true);
do $$ begin
 begin perform reception_operational_report(f(1)); raise exception 'revocation bypass'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform reception_operational_report(f(1)); raise exception 'anonymous report'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS P13 report: family counts, Rome filters, audit units, permissions and revocation';
