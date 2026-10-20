-- Add only aggregate bookable seats to the existing public catalogue.
-- Preserve the original RPC and its publication/access gates for old clients.
create or replace function public.get_public_panel_program_with_seats()
returns table (
  panel_id uuid, title text, description text, starts_at timestamptz,
  ends_at timestamptz, location_name text, location_address text,
  availability text, remaining_seats bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select program.*,
    case when program.availability = 'unavailable' then null
      else coalesce((
        select sum(case when exists (
          select 1 from public.panel_waitlist q
          where q.section_id = section.id and q.status = 'waiting'
        ) then 0 else greatest(0, section.capacity - app.panel_section_occupancy(section.id)) end)
        from public.panel_seat_sections section
        join public.panel_audience_types audience
          on audience.id = section.audience_type_id and audience.event_id = section.event_id
        where section.panel_id = program.panel_id
          and audience.booking_channel = 'individual' and audience.is_active
      ), 0)
    end
  from public.get_public_panel_program() program
  order by program.starts_at, program.title, program.panel_id;
$$;
revoke all on function public.get_public_panel_program_with_seats() from public;
grant execute on function public.get_public_panel_program_with_seats() to anon, authenticated;
