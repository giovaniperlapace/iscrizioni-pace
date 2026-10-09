-- Make the existing P0-P10 quota editor usable on the current event without
-- importing synthetic locations, panels, capacities or bookings from staging.
-- Existing configuration always wins.
insert into public.panel_audience_types(event_id, code, name, booking_channel, sort_order)
select event.id, audience.code, audience.name,
  audience.channel::public.panel_booking_channel, audience.sort_order
from public.events event
cross join (values
  ('registered', 'Iscritti', 'individual', 10),
  ('schools', 'Scuole', 'school_booking', 20),
  ('guests', 'Ospiti', 'internal_assignment', 30)
) as audience(code, name, channel, sort_order)
where event.is_current
on conflict (event_id, code) do nothing;
