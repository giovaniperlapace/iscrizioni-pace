-- Runs with the canonical migrations and synthetic Forum fixture; rolls back.
begin;
reset role;
update events set panel_access_mode='internal',school_link_enabled=true where id=fw(200);
create temp table opening_before_choices as select * from moment_attendance_choices;
create temp table opening_before_queue as select * from panel_waitlist;
select set_config('request.jwt.claim.sub',fw(11)::text,true);
set local role authenticated;
do $$ begin
  begin
    perform set_forum_bookings_open(fw(200),'internal',true);
    raise exception 'Manager allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(12)::text,true);
set local role authenticated;
do $$ begin
  begin
    perform set_forum_bookings_open(fw(200),'internal',true);
    raise exception 'Viewer allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform set_forum_bookings_open(fw(200),'internal',true);
    raise exception 'Anonymous allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(10)::text,true);
set local role authenticated;
do $$ begin
  assert set_forum_bookings_open(fw(200),'internal',false)='internal';
  assert set_forum_bookings_open(fw(200),'internal',true)='open';
  assert get_panel_release_mode()='open';
  assert (select count(*)>0 from get_public_panel_program());
  assert set_forum_bookings_open(fw(200),'internal',true)='open'; -- retry
  begin
    perform set_forum_bookings_open(fw(200),'internal',false);
    raise exception 'Stale page allowed';
  exception when serialization_failure then null; end;
  assert set_forum_bookings_open(fw(200),'open',false)='internal';
  assert get_panel_release_mode()='internal';
  assert (select count(*)=0 from get_public_panel_program());
  assert set_forum_bookings_open(fw(200),'internal',true)='open';
  begin
    perform set_forum_bookings_open(fw(200),'unknown',true);
    raise exception 'Invalid mode allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform set_forum_bookings_open(fw(200),'open',null);
    raise exception 'Null command allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform set_forum_bookings_open(fw(999),'open',true);
    raise exception 'Unknown event allowed';
  exception when no_data_found then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*)=3 from audit_logs where event_id=fw(200) and action='event.forum_opening_changed');
  assert (select school_link_enabled from events where id=fw(200));
  assert not exists((select * from moment_attendance_choices except select * from opening_before_choices)
    union all (select * from opening_before_choices except select * from moment_attendance_choices));
  assert not exists((select * from panel_waitlist except select * from opening_before_queue)
    union all (select * from opening_before_queue except select * from panel_waitlist));
end $$;
delete from event_user_roles where user_id=fw(10) and role='admin';
set local role authenticated;
do $$ begin
  begin
    perform set_forum_bookings_open(fw(200),'open',false);
    raise exception 'Revoked Admin allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo PASS Admin opening: authorization, revoked role, modes, stale commands, retries, audit and unchanged bookings/queue/school access
