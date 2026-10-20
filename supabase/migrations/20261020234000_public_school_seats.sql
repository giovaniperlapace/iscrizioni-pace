-- Reuse the canonical public-school catalogue and its opening/visibility gates.
-- Only school-section availability is exposed; no other audience quotas.
create function public.get_public_school_booking_options_with_availability()
returns table (
  event_id uuid, event_title text, panel_id uuid, section_id uuid,
  title text, description text, starts_at timestamptz, ends_at timestamptz,
  location_name text, remaining_seats integer
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select options.*, greatest(0, section.capacity - app.panel_section_occupancy(section.id))::integer
  from public.get_public_school_booking_options() options
  join public.panel_seat_sections section on section.id = options.section_id
  order by options.starts_at, options.title, options.section_id;
$$;
revoke all on function public.get_public_school_booking_options_with_availability() from public;
grant execute on function public.get_public_school_booking_options_with_availability() to anon, authenticated, service_role;
