-- School access by direct link is independent of the public Forum rollout.
-- Default closed; activation is an explicit operational decision per event.
alter table public.events add column school_link_enabled boolean not null default false;

create or replace function app.school_bookings_enabled(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.events where id = p_event_id
    and is_current and status = 'published'
    and (school_link_enabled or panel_access_mode = 'open'));
$$;
revoke all on function app.school_bookings_enabled(uuid) from public, anon;
grant execute on function app.school_bookings_enabled(uuid) to authenticated, service_role;

create or replace function public.get_school_booking_access()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select app.school_bookings_enabled(id) from public.events where is_current), false);
$$;
revoke all on function public.get_school_booking_access() from public;
grant execute on function public.get_school_booking_access() to anon, authenticated, service_role;

create or replace function app.require_school_bookings_open(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform 1 from public.events where id = p_event_id and is_current
    and status = 'published' and (school_link_enabled or panel_access_mode = 'open') for share;
  if not found then
    raise exception 'school bookings are not available' using errcode = '42501';
  end if;
end;
$$;
revoke all on function app.require_school_bookings_open(uuid) from public, anon, authenticated;


create or replace function public.get_public_school_booking_options()
returns table (
  event_id uuid,
  event_title text,
  panel_id uuid,
  section_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    event.id,
    event.title,
    panel.id,
    section.id,
    panel.title,
    panel.description,
    panel.starts_at,
    panel.ends_at,
    location.name
  from public.events event
  join public.event_moments panel
    on panel.event_id = event.id
   and panel.moment_type = 'panel'
   and panel.publication_status = 'published'
   and panel.is_public
  join public.event_locations location
    on location.id = panel.location_id
   and location.event_id = event.id
   and location.is_active
  join public.panel_seat_sections section
    on section.panel_id = panel.id
   and section.event_id = event.id
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.event_id = event.id
   and audience.booking_channel = 'school_booking'
   and audience.is_active
  where event.is_current and (event.school_link_enabled or event.panel_access_mode = 'open')
    and event.status = 'published'
    and (event.registration_opens_at is null or event.registration_opens_at <= now())
    and (event.registration_closes_at is null or event.registration_closes_at >= now())
    and app.panel_section_occupancy(section.id) < section.capacity
    and panel.starts_at is not null
    and panel.ends_at is not null
  order by panel.starts_at, panel.title, section.id;
$$;

grant execute on function public.get_public_school_booking_options() to service_role;

create or replace function public.create_public_school_booking(
  p_event_id uuid,
  p_teacher_email text,
  p_teacher_first_name text,
  p_teacher_last_name text,
  p_teacher_phone text,
  p_school_name text,
  p_school_city text,
  p_class_description text,
  p_student_count integer,
  p_companion_count integer,
  p_privacy_version text,
  p_panel_reservations jsonb,
  p_qr_token_hash text,
  p_qr_token_encrypted text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_teacher_id uuid;
  v_reservation record;
  v_reservation_count integer;
begin
  perform app.require_school_bookings_open(p_event_id);
  if not exists (
    select 1 from public.events event
    where event.id = p_event_id
      and event.is_current
      and event.status = 'published'
      and (event.registration_opens_at is null or event.registration_opens_at <= now())
      and (event.registration_closes_at is null or event.registration_closes_at >= now())
  ) then
    raise exception 'school bookings are not open' using errcode = '42501';
  end if;

  if p_teacher_email is null or p_teacher_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(btrim(p_teacher_email)) > 320
    or length(btrim(p_teacher_first_name)) not between 1 and 120
    or length(btrim(p_teacher_last_name)) not between 1 and 120
    or length(btrim(p_teacher_phone)) not between 3 and 40
    or length(btrim(p_school_name)) not between 1 and 180
    or length(btrim(p_school_city)) not between 1 and 120
    or length(btrim(p_class_description)) not between 1 and 180
    or p_student_count not between 1 and 1000
    or p_companion_count not between 1 and 100
    or length(btrim(p_privacy_version)) not between 1 and 80
    or p_panel_reservations is null
    or jsonb_typeof(p_panel_reservations) <> 'array'
    or p_qr_token_hash is null
    or length(p_qr_token_hash) < 32
    or p_qr_token_encrypted is null
    or length(p_qr_token_encrypted) < 20 then
    raise exception 'invalid public school booking data' using errcode = '22023';
  end if;

  select count(*)::integer into v_reservation_count
  from jsonb_array_elements(p_panel_reservations);
  if v_reservation_count not between 1 and 50 then
    raise exception 'school booking requires between 1 and 50 panels' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    where row_data.panel_id is null or row_data.seat_section_id is null
      or row_data.student_count not between 1 and p_student_count
      or row_data.companion_count not between 1 and p_companion_count
  ) or (
    select count(distinct row_data.panel_id)
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) <> v_reservation_count then
    raise exception 'invalid or duplicate school panel reservation' using errcode = '22023';
  end if;

  perform 1 from public.event_moments panel
  where panel.id in (
    select row_data.panel_id
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) order by panel.id for update;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select row_data.seat_section_id
    from jsonb_to_recordset(p_panel_reservations) row_data(seat_section_id uuid)
  ) order by section.id for update;

  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    left join public.event_moments panel
      on panel.id = row_data.panel_id and panel.event_id = p_event_id
      and panel.moment_type = 'panel' and panel.publication_status = 'published'
      and panel.is_public
    left join public.panel_seat_sections section
      on section.id = row_data.seat_section_id and section.panel_id = panel.id
      and section.event_id = p_event_id
    left join public.panel_audience_types audience
      on audience.id = section.audience_type_id and audience.is_active
      and audience.booking_channel = 'school_booking'
    where panel.id is null or section.id is null or audience.id is null
  ) then
    raise exception 'school panel section is not available' using errcode = '22023';
  end if;

  insert into public.school_booking_teachers (
    event_id, email, first_name, last_name, phone
  ) values (
    p_event_id, lower(btrim(p_teacher_email))::extensions.citext,
    btrim(p_teacher_first_name), btrim(p_teacher_last_name), btrim(p_teacher_phone)
  ) on conflict (event_id, email) do nothing;

  select id into v_teacher_id
  from public.school_booking_teachers
  where event_id = p_event_id
    and email = lower(btrim(p_teacher_email))::extensions.citext
  for update;

  insert into public.school_bookings (
    event_id, teacher_id, school_name, school_city, class_description,
    student_count, companion_count, status, privacy_version,
    privacy_accepted_at, internal_notes, created_by
  ) values (
    p_event_id, v_teacher_id, btrim(p_school_name), btrim(p_school_city),
    btrim(p_class_description), p_student_count, p_companion_count,
    'submitted', btrim(p_privacy_version), now(), null, null
  ) returning id into v_booking_id;

  for v_reservation in
    select * from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    ) order by panel_id
  loop
    insert into public.school_panel_reservations (
      event_id, booking_id, panel_id, seat_section_id,
      student_count, companion_count, status
    ) values (
      p_event_id, v_booking_id, v_reservation.panel_id,
      v_reservation.seat_section_id, v_reservation.student_count,
      v_reservation.companion_count, 'reserved'
    );
  end loop;

  perform app.validate_school_booking_overlaps(v_booking_id);
  for v_reservation in
    select distinct seat_section_id from public.school_panel_reservations
    where booking_id = v_booking_id and status = 'reserved'
    order by seat_section_id
  loop
    perform app.validate_panel_section_booking_capacity(v_reservation.seat_section_id);
  end loop;

  insert into public.school_booking_qr_tokens (
    booking_id, token_hash, token_encrypted, created_by
  ) values (v_booking_id, p_qr_token_hash, p_qr_token_encrypted, null);

  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_event_id, null, 'school_booking.public_submitted',
    'school_bookings', v_booking_id,
    jsonb_build_object(
      'status', 'submitted',
      'panel_count', v_reservation_count,
      'student_count', p_student_count,
      'companion_count', p_companion_count,
      'actor_kind', 'public_teacher'
    )
  );
  return v_booking_id;
end;
$$;

create or replace function public.save_school_booking(
  p_event_id uuid,
  p_booking_id uuid,
  p_teacher_email text,
  p_teacher_first_name text,
  p_teacher_last_name text,
  p_teacher_phone text,
  p_school_name text,
  p_school_city text,
  p_class_description text,
  p_student_count integer,
  p_companion_count integer,
  p_privacy_version text,
  p_internal_notes text,
  p_status public.school_booking_status,
  p_panel_reservations jsonb,
  p_qr_token_hash text default null,
  p_qr_token_encrypted text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking public.school_bookings%rowtype;
  v_teacher_id uuid;
  reservation record;
  reservation_count integer;
  can_manage boolean;
  is_owner boolean;
  target_status public.school_booking_status;
  action_name text;
begin
  if not (app.panel_management_allowed(p_event_id) or app.owns_school_booking(p_booking_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not app.has_event_role(p_event_id, array['manager']::public.app_role[]) then
    perform app.require_school_bookings_open(p_event_id);
  end if;
  can_manage := app.has_event_role(p_event_id, array['manager']::public.app_role[]);
  is_owner := p_booking_id is not null and app.owns_school_booking(p_booking_id);
  if not can_manage and not is_owner then
    raise exception 'school booking forbidden' using errcode = '42501';
  end if;
  if p_booking_id is null and not can_manage then
    raise exception 'only event managers can create backoffice school bookings' using errcode = '42501';
  end if;
  if p_teacher_email is null or p_teacher_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(btrim(p_teacher_email)) > 320
    or length(btrim(p_teacher_first_name)) not between 1 and 120
    or length(btrim(p_teacher_last_name)) not between 1 and 120
    or length(btrim(p_teacher_phone)) not between 3 and 40
    or length(btrim(p_school_name)) not between 1 and 180
    or length(btrim(p_school_city)) not between 1 and 120
    or length(btrim(p_class_description)) not between 1 and 180
    or p_student_count not between 1 and 1000
    or p_companion_count not between 1 and 100
    or length(btrim(p_privacy_version)) not between 1 and 80
    or length(coalesce(p_internal_notes, '')) > 2000
    or p_panel_reservations is null
    or jsonb_typeof(p_panel_reservations) <> 'array' then
    raise exception 'invalid school booking data' using errcode = '22023';
  end if;

  select count(*)::integer into reservation_count
  from jsonb_array_elements(p_panel_reservations);
  if reservation_count < 1 or reservation_count > 50 then
    raise exception 'school booking requires between 1 and 50 panels' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    where row_data.panel_id is null or row_data.seat_section_id is null
      or row_data.student_count not between 1 and p_student_count
      or row_data.companion_count not between 1 and p_companion_count
  ) or (
    select count(distinct row_data.panel_id)
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) <> reservation_count then
    raise exception 'invalid or duplicate school panel reservation' using errcode = '22023';
  end if;

  if p_booking_id is not null then
    select * into booking from public.school_bookings
    where id = p_booking_id and event_id = p_event_id for update;
    if not found then
      raise exception 'school booking not found' using errcode = 'P0002';
    end if;
    if is_owner and booking.status = 'cancelled' then
      raise exception 'cancelled school booking cannot be reopened by teacher' using errcode = '42501';
    end if;
    if is_owner and not can_manage
      and lower(btrim(p_teacher_email)) <> lower(auth.jwt() ->> 'email') then
      raise exception 'teacher email must match the verified session' using errcode = '42501';
    end if;
  end if;

  perform 1 from public.event_moments panel
  where panel.id in (
    select row_data.panel_id
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) order by panel.id for update;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select row_data.seat_section_id
    from jsonb_to_recordset(p_panel_reservations) row_data(seat_section_id uuid)
  ) order by section.id for update;

  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    left join public.event_moments panel
      on panel.id = row_data.panel_id and panel.event_id = p_event_id
      and panel.moment_type = 'panel' and panel.publication_status = 'published'
    left join public.panel_seat_sections section
      on section.id = row_data.seat_section_id and section.panel_id = panel.id
      and section.event_id = p_event_id
    left join public.panel_audience_types audience
      on audience.id = section.audience_type_id
      and audience.booking_channel = 'school_booking'
    where panel.id is null or section.id is null or audience.id is null
  ) then
    raise exception 'school panel section is not available' using errcode = '22023';
  end if;

  insert into public.school_booking_teachers (
    event_id, auth_user_id, email, first_name, last_name, phone
  ) values (
    p_event_id,
    case when lower(auth.jwt() ->> 'email') = lower(btrim(p_teacher_email)) then auth.uid() else null end,
    lower(btrim(p_teacher_email))::extensions.citext,
    btrim(p_teacher_first_name), btrim(p_teacher_last_name), btrim(p_teacher_phone)
  )
  on conflict (event_id, email) do update set
    auth_user_id = coalesce(school_booking_teachers.auth_user_id, excluded.auth_user_id),
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone
  returning id into v_teacher_id;

  target_status := case
    when not can_manage then booking.status
    when p_status = 'cancelled' then 'confirmed'::public.school_booking_status
    else p_status
  end;
  if target_status not in ('submitted', 'confirmed') then
    raise exception 'invalid active school booking status' using errcode = '22023';
  end if;

  if p_booking_id is null then
    insert into public.school_bookings (
      event_id, teacher_id, school_name, school_city, class_description,
      student_count, companion_count, status, privacy_version,
      privacy_accepted_at, internal_notes, created_by
    ) values (
      p_event_id, v_teacher_id, btrim(p_school_name), btrim(p_school_city),
      btrim(p_class_description), p_student_count, p_companion_count,
      target_status, btrim(p_privacy_version), now(), nullif(btrim(p_internal_notes), ''), auth.uid()
    ) returning * into booking;
    action_name := 'school_booking.created';
  else
    update public.school_bookings set
      teacher_id = v_teacher_id,
      school_name = btrim(p_school_name),
      school_city = btrim(p_school_city),
      class_description = btrim(p_class_description),
      student_count = p_student_count,
      companion_count = p_companion_count,
      status = target_status,
      internal_notes = case when can_manage then nullif(btrim(p_internal_notes), '') else internal_notes end,
      cancelled_at = null
    where id = p_booking_id
    returning * into booking;
    action_name := 'school_booking.updated';
  end if;

  update public.school_panel_reservations set status = 'cancelled'
  where booking_id = booking.id and status = 'reserved';
  for reservation in
    select * from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    ) order by panel_id
  loop
    insert into public.school_panel_reservations (
      event_id, booking_id, panel_id, seat_section_id,
      student_count, companion_count, status
    ) values (
      p_event_id, booking.id, reservation.panel_id, reservation.seat_section_id,
      reservation.student_count, reservation.companion_count, 'reserved'
    ) on conflict (booking_id, panel_id) do update set
      seat_section_id = excluded.seat_section_id,
      student_count = excluded.student_count,
      companion_count = excluded.companion_count,
      status = 'reserved';
  end loop;

  perform app.validate_school_booking_overlaps(booking.id);
  for reservation in
    select distinct seat_section_id from public.school_panel_reservations
    where booking_id = booking.id and status = 'reserved' order by seat_section_id
  loop
    perform app.validate_panel_section_booking_capacity(reservation.seat_section_id);
  end loop;

  if p_qr_token_hash is not null or p_qr_token_encrypted is not null then
    if p_qr_token_hash is null or p_qr_token_encrypted is null or p_booking_id is not null then
      raise exception 'invalid school booking QR token payload' using errcode = '22023';
    end if;
    insert into public.school_booking_qr_tokens (
      booking_id, token_hash, token_encrypted, created_by
    ) values (booking.id, p_qr_token_hash, p_qr_token_encrypted, auth.uid());
  end if;

  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_event_id, auth.uid(), action_name, 'school_bookings', booking.id,
    jsonb_build_object(
      'status', target_status,
      'panel_count', reservation_count,
      'student_count', p_student_count,
      'companion_count', p_companion_count,
      'actor_kind', case when can_manage then 'manager' else 'teacher' end
    )
  );
  return booking.id;
end;
$$;

create or replace function public.cancel_school_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking public.school_bookings%rowtype;
begin
  if not (app.panel_management_allowed((select event_id from public.school_bookings where id=p_booking_id)) or app.owns_school_booking(p_booking_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not app.has_event_role((select event_id from public.school_bookings where id = p_booking_id), array['manager']::public.app_role[]) then
    perform app.require_school_bookings_open((select event_id from public.school_bookings where id = p_booking_id));
  end if;
  select * into booking from public.school_bookings where id = p_booking_id for update;
  if not found then raise exception 'school booking not found' using errcode = 'P0002'; end if;
  if not app.has_event_role(booking.event_id, array['manager']::public.app_role[])
    and not app.owns_school_booking(booking.id) then
    raise exception 'school booking forbidden' using errcode = '42501';
  end if;
  if booking.status = 'cancelled' then return false; end if;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select seat_section_id from public.school_panel_reservations
    where booking_id = booking.id and status = 'reserved'
  ) order by section.id for update;
  update public.school_panel_reservations set status = 'cancelled'
  where booking_id = booking.id and status = 'reserved';
  update public.school_bookings set status = 'cancelled', cancelled_at = now()
  where id = booking.id;
  update public.school_booking_qr_tokens set status = 'revoked', revoked_at = now()
  where booking_id = booking.id and status = 'active';
  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    booking.event_id, auth.uid(), 'school_booking.cancelled',
    'school_bookings', booking.id, '{}'::jsonb
  );
  return true;
end;
$$;

create or replace function app.owns_school_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_bookings booking
    join public.school_booking_teachers teacher on teacher.id = booking.teacher_id
    where booking.id = target_booking_id
      and app.school_bookings_enabled(booking.event_id)
      and (
        teacher.auth_user_id = auth.uid()
        or (
          auth.uid() is not null
          and nullif(auth.jwt() ->> 'email', '') is not null
          and teacher.email = (auth.jwt() ->> 'email')::extensions.citext
        )
      )
  );
$$;

drop policy "school teachers release boundary" on public.school_booking_teachers;
create policy "school teachers release boundary" on public.school_booking_teachers
as restrictive for select to authenticated
using (app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
  or app.school_bookings_enabled(event_id));
drop policy "panel acceptance read" on public.school_booking_teachers;
create policy "panel acceptance read" on public.school_booking_teachers
as restrictive for select
using (app.panel_management_allowed(event_id) or app.school_bookings_enabled(event_id));

-- Teacher metadata without granting public access to Forum tables or capacities.
-- Includes their existing reservations (even if subsequently unpublished/full).
create or replace function public.get_teacher_school_panel_options(p_event_id uuid)
returns table (panel_id uuid, section_id uuid, title text, starts_at timestamptz,
  ends_at timestamptz, location_name text, audience_name text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, s.id, p.title, p.starts_at, p.ends_at, l.name, a.name
  from public.panel_seat_sections s
  join public.event_moments p on p.id = s.panel_id and p.event_id = s.event_id
  join public.panel_audience_types a on a.id = s.audience_type_id and a.event_id = s.event_id
  join public.event_locations l on l.id = p.location_id and l.event_id = p.event_id
  where s.event_id = p_event_id and app.school_bookings_enabled(p_event_id)
    and auth.uid() is not null and nullif(auth.jwt() ->> 'email', '') is not null
    and a.booking_channel = 'school_booking' and p.moment_type = 'panel'
    and p.starts_at is not null and p.ends_at is not null
    and ((p.publication_status = 'published' and p.is_public and a.is_active and l.is_active)
      or exists (select 1 from public.school_panel_reservations r
        where r.seat_section_id = s.id and app.owns_school_booking(r.booking_id)))
  order by p.starts_at, p.title, s.id;
$$;
revoke all on function public.get_teacher_school_panel_options(uuid) from public, anon;
grant execute on function public.get_teacher_school_panel_options(uuid) to authenticated;
