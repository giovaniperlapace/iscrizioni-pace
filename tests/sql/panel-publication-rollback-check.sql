-- Run on staging with psql -1 after migrations P2-P4. The final deliberate
-- error rolls back every fixture, role assignment, publication and audit row.

create temporary table p4_test_context (
  event_id uuid not null,
  manager_user_id uuid not null,
  viewer_user_id uuid not null,
  audience_id uuid not null,
  location_id uuid,
  valid_panel_id uuid,
  second_panel_id uuid
) on commit drop;

insert into p4_test_context (event_id, manager_user_id, viewer_user_id, audience_id)
select
  event.id,
  manager_role.user_id,
  viewer_user.id,
  audience.id
from public.events event
join public.event_user_roles manager_role
  on manager_role.event_id = event.id
 and manager_role.role = 'manager'
join public.panel_audience_types audience
  on audience.event_id = event.id
 and audience.booking_channel = 'individual'
 and audience.is_active
cross join lateral (
  select auth_user.id
  from auth.users auth_user
  where auth_user.id <> manager_role.user_id
  order by auth_user.created_at
  limit 1
) viewer_user
where event.slug = 'assisi-2026-test'
limit 1;

do $$
declare
  context p4_test_context%rowtype;
  event_start date;
begin
  select * into context from p4_test_context;
  if context.event_id is null then
    raise exception 'P4 staging check requires event, manager, viewer and individual audience fixtures';
  end if;

  select starts_on into event_start
  from public.events
  where id = context.event_id;

  insert into public.event_locations (event_id, name, address, max_capacity, is_active)
  values (context.event_id, 'P4 rollback location', 'Synthetic staging address', 10, true)
  returning id into context.location_id;

  insert into public.event_moments (
    event_id, location_id, title, starts_at, ends_at, moment_type, publication_status
  ) values (
    context.event_id,
    context.location_id,
    'P4 valid batch panel',
    ((event_start + 1)::text || ' 14:00 Europe/Rome')::timestamptz,
    ((event_start + 1)::text || ' 15:00 Europe/Rome')::timestamptz,
    'panel',
    'draft'
  ) returning id into context.valid_panel_id;

  insert into public.event_moments (
    event_id, location_id, title, starts_at, ends_at, moment_type, publication_status
  ) values (
    context.event_id,
    context.location_id,
    'P4 second batch panel',
    ((event_start + 1)::text || ' 15:00 Europe/Rome')::timestamptz,
    ((event_start + 1)::text || ' 16:00 Europe/Rome')::timestamptz,
    'panel',
    'draft'
  ) returning id into context.second_panel_id;

  insert into public.panel_seat_sections (event_id, panel_id, audience_type_id, capacity)
  values
    (context.event_id, context.valid_panel_id, context.audience_id, 10),
    (context.event_id, context.second_panel_id, context.audience_id, 9);

  update p4_test_context
  set
    location_id = context.location_id,
    valid_panel_id = context.valid_panel_id,
    second_panel_id = context.second_panel_id;
end;
$$;

insert into public.event_user_roles (event_id, user_id, role)
select event_id, viewer_user_id, 'manager_viewer'
from p4_test_context
on conflict do nothing;

select set_config(
  'request.jwt.claim.sub',
  (select manager_user_id::text from p4_test_context),
  true
);
set local role authenticated;

do $$
declare
  context p4_test_context%rowtype;
  result jsonb;
begin
  select * into context from p4_test_context;

  begin
    perform public.publish_panels(
      context.event_id,
      array[context.valid_panel_id, context.second_panel_id]
    );
    raise exception 'invalid P4 batch was unexpectedly published';
  exception
    when check_violation then null;
  end;

  if exists (
    select 1
    from public.event_moments
    where id in (context.valid_panel_id, context.second_panel_id)
      and publication_status <> 'draft'
  ) then
    raise exception 'P4 batch failure left a partially published panel';
  end if;

  update public.panel_seat_sections
  set capacity = 10
  where panel_id = context.second_panel_id;

  result := public.publish_panels(
    context.event_id,
    array[context.valid_panel_id, context.second_panel_id]
  );

  if (result ->> 'published_count')::integer <> 2 then
    raise exception 'P4 valid batch did not publish both panels';
  end if;

  result := public.publish_panels(
    context.event_id,
    array[context.valid_panel_id, context.second_panel_id]
  );

  if (result ->> 'published_count')::integer <> 0 then
    raise exception 'P4 publication retry was not idempotent';
  end if;

  perform public.save_published_panel(
    context.event_id,
    context.valid_panel_id,
    'P4 updated public panel',
    'Synthetic published-panel update',
    context.location_id,
    (select starts_at from public.event_moments where id = context.valid_panel_id),
    (select ends_at from public.event_moments where id = context.valid_panel_id),
    jsonb_build_array(jsonb_build_object(
      'audience_type_id', context.audience_id,
      'capacity', 10
    ))
  );

  if not exists (
    select 1
    from public.audit_logs
    where entity_id = context.valid_panel_id
      and action = 'panel.published_updated'
  ) then
    raise exception 'P4 published update audit is missing';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  (select viewer_user_id::text from p4_test_context),
  true
);
set local role authenticated;

do $$
declare
  context p4_test_context%rowtype;
begin
  select * into context from p4_test_context;
  begin
    perform public.publish_panels(context.event_id, array[context.valid_panel_id]);
    raise exception 'manager_viewer unexpectedly published a panel';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select 'panel_p4_publication_checks_ok';

-- Expected failure: psql -1 rolls the temporary data back.
select 1 / 0;
