-- Run after the P1 migration with psql -1. The final deliberate error proves
-- that every schema and behavior check is rolled back on the target database.

do $$
declare
  test_event_id uuid;
  test_location_id uuid;
  active_audience_id uuid;
  valid_panel_id uuid;
  second_panel_id uuid;
begin
  insert into public.events (slug, title, city, country, status)
  values (
    'panel-p1-rollback-check',
    'Panel P1 rollback check',
    'Test',
    'Test',
    'published'
  )
  returning id into test_event_id;

  insert into public.event_locations (
    event_id,
    name,
    max_capacity,
    is_active
  ) values (
    test_event_id,
    'Temporary test location',
    10,
    true
  )
  returning id into test_location_id;

  insert into public.panel_audience_types (
    event_id,
    code,
    name,
    booking_channel
  ) values (
    test_event_id,
    'registered',
    'Iscritti',
    'individual'
  )
  returning id into active_audience_id;

  insert into public.event_moments (
    event_id,
    location_id,
    title,
    starts_at,
    ends_at,
    moment_type,
    publication_status
  ) values (
    test_event_id,
    test_location_id,
    'Valid test panel',
    '2030-01-01 09:00:00+01',
    '2030-01-01 10:00:00+01',
    'panel',
    'draft'
  )
  returning id into valid_panel_id;

  insert into public.panel_seat_sections (
    event_id,
    panel_id,
    audience_type_id,
    capacity
  ) values (
    test_event_id,
    valid_panel_id,
    active_audience_id,
    10
  );

  update public.event_moments
  set publication_status = 'published'
  where id = valid_panel_id;

  perform app.validate_panel_configuration(valid_panel_id);

  begin
    update public.panel_seat_sections
    set capacity = 9
    where panel_id = valid_panel_id;

    perform app.validate_panel_configuration(valid_panel_id);
    raise exception 'capacity mismatch was unexpectedly accepted';
  exception
    when others then
      if sqlerrm not like 'panel section capacity total (%) must equal location capacity (%)' then
        raise;
      end if;
  end;

  begin
    insert into public.event_moments (
      event_id,
      location_id,
      title,
      starts_at,
      ends_at,
      moment_type,
      publication_status
    ) values (
      test_event_id,
      test_location_id,
      'Overlapping test panel',
      '2030-01-01 09:30:00+01',
      '2030-01-01 10:30:00+01',
      'panel',
      'draft'
    );

    raise exception 'overlapping panel was unexpectedly accepted';
  exception
    when exclusion_violation then null;
  end;

  insert into public.event_moments (
    event_id,
    location_id,
    title,
    starts_at,
    ends_at,
    moment_type,
    publication_status
  ) values (
    test_event_id,
    test_location_id,
    'Second non-overlapping test panel',
    '2030-01-01 10:00:00+01',
    '2030-01-01 11:00:00+01',
    'panel',
    'draft'
  )
  returning id into second_panel_id;

  update public.panel_audience_types
  set is_active = false
  where id = active_audience_id;

  begin
    insert into public.panel_seat_sections (
      event_id,
      panel_id,
      audience_type_id,
      capacity
    ) values (
      test_event_id,
      second_panel_id,
      active_audience_id,
      10
    );

    raise exception 'inactive audience type was unexpectedly accepted';
  exception
    when others then
      if sqlerrm <> 'inactive audience types cannot be added to panels' then
        raise;
      end if;
  end;
end;
$$;

select 'panel_p1_rollback_checks_ok';

-- Expected failure: psql -1 rolls the entire migration and all fixtures back.
select 1 / 0;
