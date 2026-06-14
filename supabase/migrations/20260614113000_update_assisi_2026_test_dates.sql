-- Align the Assisi 2026 test event dates with the current registration form scope.

update public.events
set
  starts_on = date '2026-10-25',
  ends_on = date '2026-10-27',
  registration_closes_at = timestamptz '2026-10-24 23:59:59+00'
where slug = 'assisi-2026-test';

with test_event as (
  select id
  from public.events
  where slug = 'assisi-2026-test'
)
update public.event_moments as moment
set
  starts_at = case moment.title
    when 'Accoglienza e registrazione' then timestamptz '2026-10-25 14:00:00+01'
    when 'Incontro internazionale' then timestamptz '2026-10-26 10:00:00+01'
    when 'Preghiera per la pace' then timestamptz '2026-10-27 16:00:00+01'
    else moment.starts_at
  end,
  ends_at = case moment.title
    when 'Accoglienza e registrazione' then timestamptz '2026-10-25 18:00:00+01'
    when 'Incontro internazionale' then timestamptz '2026-10-26 12:30:00+01'
    when 'Preghiera per la pace' then timestamptz '2026-10-27 18:00:00+01'
    else moment.ends_at
  end
from test_event
where moment.event_id = test_event.id
  and moment.title in (
    'Accoglienza e registrazione',
    'Incontro internazionale',
    'Preghiera per la pace'
  );
