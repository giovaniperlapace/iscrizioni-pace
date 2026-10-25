begin;
\ir reception-relay-seed.sql
set local role service_role;
do $$ declare v jsonb; begin
 v:=reception_relay_room_statistics(fw(200),fw(8),fw(403));
 assert jsonb_array_length(v)=1;
 assert v->0->>'room'='Sala collegata sintetica';
 assert (v->0->>'capacity')::int=12;
 assert (v->0->>'entered')::int=7,'Adult + explicit child + 4 students + companion; cancelled excluded';
 assert v::text !~ 'registration|child|student|teacher|email|firstName';
 assert reception_relay_room_statistics(fw(200),fw(8),fw(404))='[]';
 assert reception_relay_room_statistics(fw(200),fw(8),fw(9970))='[]','No inverse link';
 begin perform reception_relay_room_statistics(fw(200),fw(1),fw(403));raise exception 'unassigned actor';exception when insufficient_privilege then null;end;
 begin perform reception_relay_room_statistics(fw(201),fw(8),fw(403));raise exception 'foreign event';exception when insufficient_privilege then null;end;
 begin perform reception_relay_room_statistics(fw(200),fw(8),fw(9999));raise exception 'unknown source';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','reception_relay_room_statistics(uuid,uuid,uuid)','execute');
 assert not has_function_privilege('authenticated','reception_relay_room_statistics(uuid,uuid,uuid)','execute');
end $$;
reset role;
update check_ins set cancelled_at=now() where moment_id=fw(9970) and cancelled_at is null;
do $$ begin assert (reception_relay_room_statistics(fw(200),fw(8),fw(403))->0->>'entered')::int=0;end $$;
update event_moments set publication_status='draft',is_public=false where id=fw(9970);
do $$ begin assert reception_relay_room_statistics(fw(200),fw(8),fw(403))='[]';end $$;
update event_moments set publication_status='published',is_public=true where id=fw(9970);
update event_moments set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour' where id=fw(9970);
do $$ begin assert reception_relay_room_statistics(fw(200),fw(8),fw(403))='[]';end $$;
update events set is_current=false where id=fw(200);
do $$ begin
 begin perform reception_relay_room_statistics(fw(200),fw(8),fw(403));raise exception 'noncurrent event';exception when insufficient_privilege then null;end;
end $$;
set constraints all immediate;
rollback;
\echo PASS relay counts: canonical source, current event/duty authorization, service-only, adult/child/school weights, cancelled excluded, independent counters
