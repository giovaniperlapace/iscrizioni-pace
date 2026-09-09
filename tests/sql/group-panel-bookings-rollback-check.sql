-- Run with psql -1. Everything, including synthetic auth users, rolls back.
insert into auth.users(id, email) values
  ('11111111-2222-4333-8444-555555555501', 'group-panel-sql-leader@example.invalid'),
  ('11111111-2222-4333-8444-555555555502', 'group-panel-sql-outsider@example.invalid');

create temporary table p6_test_context (
  event_id uuid not null,
  audience_id uuid not null,
  first_user_id uuid not null,
  second_user_id uuid not null,
  first_registration_id uuid,
  second_registration_id uuid,
  first_panel_id uuid,
  overlapping_panel_id uuid,
  first_section_id uuid,
  overlapping_section_id uuid
) on commit drop;

insert into p6_test_context (event_id, audience_id, first_user_id, second_user_id)
select
  event.id,
  audience.id,
  users.first_user_id,
  users.second_user_id
from public.events event
join public.panel_audience_types audience
  on audience.event_id = event.id
 and audience.booking_channel = 'individual'
 and audience.is_active
cross join lateral (
  select
    (array_agg(auth_user.id order by auth_user.email))[1] as first_user_id,
    (array_agg(auth_user.id order by auth_user.email))[2] as second_user_id
  from auth.users auth_user where auth_user.email like 'group-panel-sql-%@example.invalid'
) users
where event.slug = 'assisi-2026-test'
limit 1;

do $$
declare
  context p6_test_context%rowtype;
  event_start date;
  first_participant_id uuid;
  second_participant_id uuid;
  first_location_id uuid;
  second_location_id uuid;
begin
  select * into context from p6_test_context;
  if context.event_id is null or context.second_user_id is null then
    raise exception 'P6 staging check requires an event, individual audience and two auth users';
  end if;

  select starts_on into event_start from public.events where id = context.event_id;

  insert into public.participants (auth_user_id, first_name, last_name)
  values (context.first_user_id, 'P6 First', 'Participant')
  returning id into first_participant_id;

  insert into public.participants (auth_user_id, first_name, last_name)
  values (context.second_user_id, 'P6 Second', 'Participant')
  returning id into second_participant_id;

  insert into public.registrations (event_id, participant_id, status, source)
  values (context.event_id, first_participant_id, 'confirmed', 'admin')
  returning id into context.first_registration_id;

  insert into public.registrations (event_id, participant_id, status, source)
  values (context.event_id, second_participant_id, 'confirmed', 'admin')
  returning id into context.second_registration_id;

  insert into public.registration_children (
    registration_id, position, first_name, last_name, birth_date
  ) values
    (context.first_registration_id, 1, 'P6 Child One', 'Participant', date '2018-01-01'),
    (context.second_registration_id, 1, 'P6 Child Two', 'Participant', date '2019-01-01');

  insert into public.event_locations (event_id, name, max_capacity, is_active)
  values (context.event_id, 'P6 capacity location', 3, true)
  returning id into first_location_id;

  insert into public.event_locations (event_id, name, max_capacity, is_active)
  values (context.event_id, 'P6 overlap location', 10, true)
  returning id into second_location_id;

  insert into public.event_moments (
    event_id, location_id, title, starts_at, ends_at, moment_type, publication_status
  ) values (
    context.event_id,
    first_location_id,
    'P6 capacity panel',
    ((event_start + 2)::text || ' 14:00 Europe/Rome')::timestamptz,
    ((event_start + 2)::text || ' 15:00 Europe/Rome')::timestamptz,
    'panel',
    'draft'
  ) returning id into context.first_panel_id;

  insert into public.event_moments (
    event_id, location_id, title, starts_at, ends_at, moment_type, publication_status
  ) values (
    context.event_id,
    second_location_id,
    'P6 overlapping panel',
    ((event_start + 2)::text || ' 14:30 Europe/Rome')::timestamptz,
    ((event_start + 2)::text || ' 15:30 Europe/Rome')::timestamptz,
    'panel',
    'draft'
  ) returning id into context.overlapping_panel_id;

  insert into public.panel_seat_sections (event_id, panel_id, audience_type_id, capacity)
  values (context.event_id, context.first_panel_id, context.audience_id, 3)
  returning id into context.first_section_id;

  insert into public.panel_seat_sections (event_id, panel_id, audience_type_id, capacity)
  values (context.event_id, context.overlapping_panel_id, context.audience_id, 10)
  returning id into context.overlapping_section_id;

  update public.event_moments
  set publication_status = 'published'
  where id in (context.first_panel_id, context.overlapping_panel_id);

  update p6_test_context set
    first_registration_id = context.first_registration_id,
    second_registration_id = context.second_registration_id,
    first_panel_id = context.first_panel_id,
    overlapping_panel_id = context.overlapping_panel_id,
    first_section_id = context.first_section_id,
    overlapping_section_id = context.overlapping_section_id;
end;
$$;


create temporary table group_panel_test_scope(root_id uuid, child_id uuid, outside_registration_id uuid);
do $$
declare ctx p6_test_context%rowtype; root uuid; child uuid; person uuid; outside_reg uuid;
begin
 select * into ctx from p6_test_context;
 insert into public.groups(event_id,name,node_type,is_active,is_assignable) values(ctx.event_id,'Bulk test root','country',true,false) returning id into root;
 insert into public.groups(event_id,name,node_type,parent_group_id,is_active,is_assignable) values(ctx.event_id,'Bulk test child','group',root,true,true) returning id into child;
 insert into public.group_memberships(group_id,user_id) values(root,ctx.first_user_id);
 insert into public.participant_group_assignments(registration_id,group_id,status,is_current,source)
 values(ctx.first_registration_id,child,'confirmed',true,'admin'),(ctx.second_registration_id,child,'confirmed',true,'admin');
 insert into public.participants(first_name,last_name) values('Outside','Scope') returning id into person;
 insert into public.registrations(event_id,participant_id,status,source) values(ctx.event_id,person,'confirmed','admin') returning id into outside_reg;
 insert into group_panel_test_scope values(root,child,outside_reg);
end $$;
grant select on p6_test_context, group_panel_test_scope to authenticated;
select set_config('request.jwt.claim.sub', (select first_user_id::text from p6_test_context), true);
set local role authenticated;
do $$
declare c p6_test_context%rowtype; s group_panel_test_scope%rowtype; result jsonb;
begin
 select * into c from p6_test_context; select * into s from group_panel_test_scope;
 result := public.get_group_panel_booking_view(c.event_id,c.first_section_id);
 if jsonb_array_length(result->'participants') <> 2 then raise exception 'scope must include exactly two descendant participants'; end if;
 begin
  perform public.book_group_panel(c.event_id,c.first_section_id,array[c.first_registration_id,s.outside_registration_id]);
  raise exception 'outside scope was accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.book_group_panel(c.event_id,c.first_section_id,array[c.first_registration_id,c.second_registration_id]);
  raise exception 'over capacity was accepted';
 exception when sqlstate 'P0001' then if sqlerrm not like '%full%' then raise; end if; end;
 result := public.get_group_panel_booking_view(c.event_id,c.first_section_id);
 if exists(select 1 from jsonb_array_elements(result->'participants') p where p->>'status'='selected') then raise exception 'failed batch partially committed'; end if;
 result := public.book_group_panel(c.event_id,c.first_section_id,array[c.first_registration_id,c.first_registration_id]);
 if result->>'count' <> '1' or result->>'seats' <> '2' then raise exception 'child seats or deduplication incorrect %',result; end if;
 result := public.book_group_panel(c.event_id,c.first_section_id,array[c.first_registration_id]);
 if result->>'count' <> '0' then raise exception 'retry was not idempotent'; end if;
 begin
  perform public.book_group_panel(c.event_id,c.overlapping_section_id,array[c.second_registration_id,c.first_registration_id]);
  raise exception 'overlap accepted';
 exception when exclusion_violation then null; end;
 result := public.book_group_panel(c.event_id,c.overlapping_section_id,array[c.second_registration_id]);
 if result->>'count' <> '1' then raise exception 'second booking failed'; end if;
 begin
  perform public.set_group_panel_booking(c.event_id,c.first_section_id,s.outside_registration_id,false);
  raise exception 'outside scope cancellation accepted';
 exception when insufficient_privilege then null; end;
 result := public.set_group_panel_booking(c.event_id,c.first_section_id,c.first_registration_id,false);
 if result->>'count' <> '1' or result->>'seats' <> '2' then raise exception 'cancellation did not release family seats'; end if;
 result := public.set_group_panel_booking(c.event_id,c.first_section_id,c.first_registration_id,false);
 if result->>'count' <> '0' then raise exception 'cancellation retry not idempotent'; end if;
 result := public.get_group_panel_booking_view(c.event_id,c.first_section_id);
 if exists(select 1 from jsonb_array_elements(result->'participants') p where p->>'registrationId'=c.first_registration_id::text and p->>'status'<>'available') then raise exception 'cancellation did not update status'; end if;
 result := public.set_group_panel_booking(c.event_id,c.first_section_id,c.first_registration_id,true);
 if result->>'count' <> '1' or result->>'seats' <> '2' then raise exception 'rebooking failed'; end if;
 begin
  perform public.set_group_panel_booking(c.event_id,c.overlapping_section_id,c.first_registration_id,true);
  raise exception 'row action accepted overlap';
 exception when exclusion_violation then null; end;
 begin
  perform public.set_group_panel_booking(c.event_id,c.first_section_id,c.second_registration_id,true);
  raise exception 'row action accepted invalid booking';
 exception when exclusion_violation then null; end;
 perform public.set_group_panel_booking(c.event_id,c.overlapping_section_id,c.second_registration_id,false);
 begin
  perform public.set_group_panel_booking(c.event_id,c.first_section_id,c.second_registration_id,true);
  raise exception 'row action exceeded capacity';
 exception when sqlstate 'P0001' then if sqlerrm not like '%full%' then raise; end if; end;
 perform public.set_group_panel_booking(c.event_id,c.overlapping_section_id,c.second_registration_id,true);
 raise notice 'PASS: scoped cancellation, family seats, repeated cancellation, rebooking and overlap';
 raise notice 'PASS: descendant scope, batch rollback, children, capacity, overlap, duplicates and retry';
end $$;
reset role;
-- Nonleaders and read-only/operational roles must not call either RPC.
select set_config('request.jwt.claim.sub', (select second_user_id::text from p6_test_context), true);
set local role authenticated;
do $$ declare c p6_test_context%rowtype; begin
 select * into c from p6_test_context;
 begin perform public.get_group_panel_booking_view(c.event_id,c.first_section_id); raise exception 'nonleader could read'; exception when insufficient_privilege then null; end;
 begin perform public.book_group_panel(c.event_id,c.first_section_id,array[c.second_registration_id]); raise exception 'nonleader could book'; exception when insufficient_privilege then null; end;
 begin perform public.set_group_panel_booking(c.event_id,c.first_section_id,c.second_registration_id,false); raise exception 'unauthorized cancellation: nonleader could book'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select first_user_id::text from p6_test_context), true);
insert into public.event_user_roles(user_id,event_id,role) select first_user_id,event_id,'manager_viewer' from p6_test_context;
set local role authenticated;
do $$ declare c p6_test_context%rowtype; begin
 select * into c from p6_test_context;
 begin perform public.book_group_panel(c.event_id,c.first_section_id,array[c.first_registration_id]); raise exception 'viewer with membership could book'; exception when insufficient_privilege then null; end;
 begin perform public.set_group_panel_booking(c.event_id,c.first_section_id,c.first_registration_id,false); raise exception 'unauthorized cancellation: viewer with membership could book'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.event_user_roles where user_id=(select first_user_id from p6_test_context) and role='manager_viewer';
update public.registrations set deleted_at=now(),deletion_reason='SQL rollback test' where id=(select second_registration_id from p6_test_context);
set local role authenticated;
do $$ declare c p6_test_context%rowtype; result jsonb; begin
 select * into c from p6_test_context;
 result:=public.get_group_panel_booking_view(c.event_id,c.first_section_id);
 if jsonb_array_length(result->'participants')<>1 then raise exception 'deleted registration visible'; end if;
 begin perform public.book_group_panel(c.event_id,c.first_section_id,array[c.second_registration_id]); raise exception 'deleted registration bookable'; exception when insufficient_privilege then null; end;
 begin perform public.set_group_panel_booking(c.event_id,c.first_section_id,c.second_registration_id,false); raise exception 'unauthorized cancellation: deleted registration bookable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.set_group_panel_booking(uuid,uuid,uuid,boolean)','execute') or has_function_privilege('anon','public.book_group_panel(uuid,uuid,uuid[])','execute') or
    has_function_privilege('anon','public.get_group_panel_booking_view(uuid,uuid)','execute') then raise exception 'anon can call RPC'; end if;
 raise notice 'PASS: nonleader, viewer, anonymous and deleted registration guards';
end $$;
set constraints all immediate;
rollback;
