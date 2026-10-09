-- Run on staging with psql -1 after P6. The deliberate final error rolls back
-- every synthetic participant, booking, child, panel and audit row.

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
    (array_agg(auth_user.id order by auth_user.created_at))[1] as first_user_id,
    (array_agg(auth_user.id order by auth_user.created_at))[2] as second_user_id
  from auth.users auth_user
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

select set_config('request.jwt.claim.sub', (select first_user_id::text from p6_test_context), true);
set local role authenticated;

do $$
declare
  context p6_test_context%rowtype;
  result jsonb;
begin
  select * into context from p6_test_context;

  result := public.set_individual_panel_booking(
    context.first_registration_id, context.first_panel_id, context.first_section_id, true
  );
  if not (result ->> 'booked')::boolean or (result ->> 'party_size')::integer <> 2 then
    raise exception 'P6 family booking did not reserve adult plus child';
  end if;

  result := public.set_individual_panel_booking(
    context.first_registration_id, context.first_panel_id, context.first_section_id, true
  );
  if (result ->> 'changed')::boolean then
    raise exception 'P6 retry was not idempotent';
  end if;

  if not exists (
    select 1 from public.get_participant_panel_catalog(context.first_registration_id)
    where panel_id = context.first_panel_id and booking_status = 'selected'
  ) then
    raise exception 'P6 catalog does not show the real selected choice';
  end if;

  begin
    perform public.set_individual_panel_booking(
      context.first_registration_id,
      context.overlapping_panel_id,
      context.overlapping_section_id,
      true
    );
    raise exception 'P6 accepted overlapping panel choices';
  exception when exclusion_violation then null;
  end;

  begin
    perform public.replace_owned_registration_children(
      context.first_registration_id,
      jsonb_build_array(
        jsonb_build_object('position', 1, 'first_name', 'One', 'last_name', 'Child', 'birth_date', '2018-01-01'),
        jsonb_build_object('position', 2, 'first_name', 'Two', 'last_name', 'Child', 'birth_date', '2019-01-01'),
        jsonb_build_object('position', 3, 'first_name', 'Three', 'last_name', 'Child', 'birth_date', '2020-01-01')
      )
    );
    raise exception 'P6 allowed a family-size change beyond booked capacity';
  exception when raise_exception then
    if sqlerrm <> 'panel section capacity exceeded' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select second_user_id::text from p6_test_context), true);
set local role authenticated;

do $$
declare
  context p6_test_context%rowtype;
begin
  select * into context from p6_test_context;

  begin
    perform public.set_individual_panel_booking(
      context.second_registration_id, context.first_panel_id, context.first_section_id, true
    );
    raise exception 'P6 exceeded the last available seat with a two-person party';
  exception when raise_exception then
    if sqlerrm <> 'panel section is full' then raise; end if;
  end;

  begin
    perform public.set_individual_panel_booking(
      context.first_registration_id, context.first_panel_id, context.first_section_id, false
    );
    raise exception 'P6 allowed a participant to cancel another registration booking';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select first_user_id::text from p6_test_context), true);
set local role authenticated;

select public.set_individual_panel_booking(
  first_registration_id, first_panel_id, first_section_id, false
)
from p6_test_context;

reset role;
select set_config('request.jwt.claim.sub', (select second_user_id::text from p6_test_context), true);
set local role authenticated;

select public.set_individual_panel_booking(
  second_registration_id, first_panel_id, first_section_id, true
)
from p6_test_context;

reset role;

do $$
declare context p6_test_context%rowtype;
begin
  select * into context from p6_test_context;
  if app.panel_section_occupancy(context.first_section_id) <> 2 then
    raise exception 'P6 cancellation did not release capacity for the next family';
  end if;
end;
$$;

select 'panel_p6_individual_booking_checks_ok';

-- Expected failure: psql -1 rolls every P6 fixture back.
select 1 / 0;
