-- Track expected attendance by half-day slots and seed the operational slots
-- for the current Assisi 2026 event.

alter table public.event_attendance_choices
  add column if not exists day_part text
  check (day_part in ('morning', 'afternoon'));

alter table public.event_attendance_choices
  drop constraint if exists event_attendance_choices_registration_id_day_key;

create unique index if not exists event_attendance_choices_registration_day_part_unique
  on public.event_attendance_choices (
    registration_id,
    coalesce(day, date '0001-01-01'),
    coalesce(day_part, 'unknown')
  );

with current_event as (
  select id
  from public.events
  where slug = 'assisi-2026-test'
),
slot_rows as (
  select *
  from (
    values
      ('Presenza - 24 ottobre pomeriggio', timestamptz '2026-10-24 14:00:00+02', timestamptz '2026-10-24 20:00:00+02'),
      ('Presenza - 25 ottobre mattina', timestamptz '2026-10-25 08:00:00+01', timestamptz '2026-10-25 13:00:00+01'),
      ('Presenza - 25 ottobre pomeriggio', timestamptz '2026-10-25 14:00:00+01', timestamptz '2026-10-25 20:00:00+01'),
      ('Presenza - 26 ottobre mattina', timestamptz '2026-10-26 08:00:00+01', timestamptz '2026-10-26 13:00:00+01'),
      ('Presenza - 26 ottobre pomeriggio', timestamptz '2026-10-26 14:00:00+01', timestamptz '2026-10-26 20:00:00+01'),
      ('Presenza - 27 ottobre mattina', timestamptz '2026-10-27 08:00:00+01', timestamptz '2026-10-27 13:00:00+01'),
      ('Presenza - 27 ottobre pomeriggio', timestamptz '2026-10-27 14:00:00+01', timestamptz '2026-10-27 20:00:00+01')
  ) as rows(title, starts_at, ends_at)
)
insert into public.event_moments (
  event_id,
  title,
  starts_at,
  ends_at,
  is_public,
  check_in_enabled
)
select
  current_event.id,
  slot_rows.title,
  slot_rows.starts_at,
  slot_rows.ends_at,
  false,
  false
from current_event, slot_rows
where not exists (
  select 1
  from public.event_moments existing
  where existing.event_id = current_event.id
    and existing.title = slot_rows.title
);

notify pgrst, 'reload schema';
