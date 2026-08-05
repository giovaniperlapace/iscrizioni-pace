-- Run on staging with psql -1 after migration P5. The final deliberate error
-- rolls back the temporary choice and every fixture change.

do $$
declare
  public_count integer;
  draft_panel_id uuid;
  target_event_id uuid;
  target_location_id uuid;
begin
  select id into target_event_id
  from public.events
  where is_current and status = 'published'
  limit 1;

  select id into target_location_id
  from public.event_locations
  where event_id = target_event_id
  order by created_at
  limit 1;

  if target_event_id is null or target_location_id is null then
    raise exception 'P5 staging check requires the current published event and a location';
  end if;

  select count(*) into public_count from public.get_public_panel_program();
  if public_count < 1 then
    raise exception 'P5 staging check requires at least one published panel';
  end if;

  insert into public.event_moments (
    event_id, location_id, title, description, starts_at, ends_at,
    moment_type, publication_status
  ) values (
    target_event_id,
    target_location_id,
    'P5 hidden draft',
    'This draft must never reach the public RPC.',
    '2026-10-27 20:00 Europe/Rome',
    '2026-10-27 21:00 Europe/Rome',
    'panel',
    'draft'
  ) returning id into draft_panel_id;

  if exists (
    select 1 from public.get_public_panel_program()
    where panel_id = draft_panel_id
  ) then
    raise exception 'P5 public RPC exposed a draft';
  end if;

  if exists (
    select 1 from public.get_public_panel_program()
    where availability not in ('available', 'full', 'unavailable')
  ) then
    raise exception 'P5 public RPC returned an invalid availability state';
  end if;
end;
$$;

set local role anon;

do $$
begin
  if not exists (select 1 from public.get_public_panel_program()) then
    raise exception 'anon cannot read the P5 public programme';
  end if;
end;
$$;

reset role;
select 'panel_p5_public_program_checks_ok';

-- Expected failure: psql -1 rolls every fixture back.
select 1 / 0;
