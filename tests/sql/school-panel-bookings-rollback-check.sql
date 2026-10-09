-- Run on staging with psql -1 after P7. The deliberate final error rolls back
-- every synthetic school booking, role and audit row.

create temporary table p7_test_context (
  event_id uuid not null,
  manager_user_id uuid not null,
  teacher_user_id uuid not null,
  stranger_user_id uuid not null,
  teacher_email text not null,
  first_panel_id uuid not null,
  first_section_id uuid not null,
  second_panel_id uuid not null,
  second_section_id uuid not null,
  first_booking_id uuid,
  second_booking_id uuid
) on commit drop;

insert into p7_test_context (
  event_id, manager_user_id, teacher_user_id, stranger_user_id, teacher_email,
  first_panel_id, first_section_id, second_panel_id, second_section_id
)
select
  event.id,
  manager_role.user_id,
  users.teacher_user_id,
  users.stranger_user_id,
  users.teacher_email,
  panels.first_panel_id,
  panels.first_section_id,
  panels.second_panel_id,
  panels.second_section_id
from public.events event
join public.event_user_roles manager_role
  on manager_role.event_id = event.id and manager_role.role = 'manager'
cross join lateral (
  select
    (array_agg(auth_user.id order by auth_user.created_at))[1] as teacher_user_id,
    extensions.gen_random_uuid() as stranger_user_id,
    (array_agg(auth_user.email order by auth_user.created_at))[1] as teacher_email
  from auth.users auth_user
  where auth_user.id <> manager_role.user_id
    and not exists (
      select 1 from public.event_user_roles role_row
      where role_row.user_id = auth_user.id
        and role_row.role in ('admin', 'manager', 'manager_viewer')
    )
) users
cross join lateral (
  select
    (array_agg(section.panel_id order by panel.starts_at, panel.id))[1] as first_panel_id,
    (array_agg(section.id order by panel.starts_at, panel.id))[1] as first_section_id,
    (array_agg(section.panel_id order by panel.starts_at, panel.id))[2] as second_panel_id,
    (array_agg(section.id order by panel.starts_at, panel.id))[2] as second_section_id
  from public.panel_seat_sections section
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.booking_channel = 'school_booking'
  join public.event_moments panel
    on panel.id = section.panel_id and panel.publication_status = 'published'
  where section.event_id = event.id
) panels
where event.slug = 'assisi-2026-test'
limit 1;

do $$
declare context p7_test_context%rowtype;
begin
  select * into context from p7_test_context;
  if context.stranger_user_id is null or context.second_section_id is null then
    raise exception 'P7 staging check requires manager, two users and two school sections';
  end if;
end;
$$;

grant select, update on p7_test_context to authenticated;

select set_config('request.jwt.claim.sub', (select manager_user_id::text from p7_test_context), true);
set local role authenticated;

do $$
declare
  context p7_test_context%rowtype;
  booking_id uuid;
begin
  select * into context from p7_test_context;

  begin
    perform public.save_school_booking(
      context.event_id, null, context.teacher_email, 'P7', 'Teacher', '+3900000000',
      'P7 overlap school', 'Test city', 'Class A', 2, 1, 'school-booking-v1', null,
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('panel_id', context.first_panel_id, 'seat_section_id', context.first_section_id, 'student_count', 2, 'companion_count', 1),
        jsonb_build_object('panel_id', context.second_panel_id, 'seat_section_id', context.second_section_id, 'student_count', 2, 'companion_count', 1)
      ),
      encode(extensions.digest('p7-overlap-token', 'sha256'), 'hex'), 'p7-overlap-encrypted'
    );
    raise exception 'P7 accepted overlapping school panels';
  exception when exclusion_violation then null;
  end;

  booking_id := public.save_school_booking(
    context.event_id, null, context.teacher_email, 'P7', 'Teacher', '+3900000000',
    'P7 first school', 'Test city', 'Class A', 29, 1, 'school-booking-v1', null,
    'confirmed',
    jsonb_build_array(jsonb_build_object(
      'panel_id', context.first_panel_id, 'seat_section_id', context.first_section_id,
      'student_count', 29, 'companion_count', 1
    )),
    encode(extensions.digest('p7-first-token', 'sha256'), 'hex'), 'p7-first-encrypted'
  );
  update p7_test_context set first_booking_id = booking_id;

  begin
    perform public.save_school_booking(
      context.event_id, null, context.teacher_email, 'P7', 'Teacher', '+3900000000',
      'P7 second school', 'Test city', 'Class B', 1, 1, 'school-booking-v1', null,
      'confirmed',
      jsonb_build_array(jsonb_build_object(
        'panel_id', context.first_panel_id, 'seat_section_id', context.first_section_id,
        'student_count', 1, 'companion_count', 1
      )),
      encode(extensions.digest('p7-full-token', 'sha256'), 'hex'), 'p7-full-encrypted'
    );
    raise exception 'P7 exceeded the school section capacity';
  exception when raise_exception then
    if sqlerrm <> 'panel section capacity exceeded' then raise; end if;
  end;

  if not public.cancel_school_booking(booking_id) then
    raise exception 'P7 did not cancel the active booking';
  end if;

  booking_id := public.save_school_booking(
    context.event_id, null, context.teacher_email, 'P7', 'Teacher', '+3900000000',
    'P7 second school', 'Test city', 'Class B', 1, 1, 'school-booking-v1', null,
    'confirmed',
    jsonb_build_array(jsonb_build_object(
      'panel_id', context.first_panel_id, 'seat_section_id', context.first_section_id,
      'student_count', 1, 'companion_count', 1
    )),
    encode(extensions.digest('p7-second-token', 'sha256'), 'hex'), 'p7-second-encrypted'
  );
  update p7_test_context set second_booking_id = booking_id;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select teacher_user_id::text from p7_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select teacher_user_id from p7_test_context),
    'email', (select teacher_email from p7_test_context),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare context p7_test_context%rowtype;
begin
  select * into context from p7_test_context;
  if not app.owns_school_booking(context.second_booking_id) then
    raise exception 'P7 verified teacher does not own the email-matched booking';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select stranger_user_id::text from p7_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select stranger_user_id from p7_test_context),
    'email', 'p7-stranger@example.invalid',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare context p7_test_context%rowtype;
begin
  select * into context from p7_test_context;
  if app.owns_school_booking(context.second_booking_id) then
    raise exception 'P7 treated an unrelated user as booking owner';
  end if;
  begin
    perform public.cancel_school_booking(context.second_booking_id);
    raise exception 'P7 allowed an unrelated user to cancel a booking';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select 'panel_p7_school_booking_checks_ok';

-- Expected failure: psql -1 rolls every P7 fixture back.
select 1 / 0;
