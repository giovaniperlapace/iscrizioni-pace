-- Milestone P8: atomic public school bookings and teacher identity linking.

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

revoke all on function public.create_public_school_booking(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.create_public_school_booking(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, jsonb, text, text
) to service_role;

create or replace function public.link_current_school_teacher_identity()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_count integer;
begin
  if auth.uid() is null or nullif(auth.jwt() ->> 'email', '') is null then
    raise exception 'verified session required' using errcode = '42501';
  end if;
  update public.school_booking_teachers
  set auth_user_id = auth.uid()
  where email = (auth.jwt() ->> 'email')::extensions.citext
    and (auth_user_id is null or auth_user_id = auth.uid());
  get diagnostics linked_count = row_count;
  return linked_count;
end;
$$;

revoke all on function public.link_current_school_teacher_identity() from public, anon;
grant execute on function public.link_current_school_teacher_identity() to authenticated;

comment on function public.create_public_school_booking(
  uuid, text, text, text, text, text, text, text, integer, integer,
  text, jsonb, text, text
) is 'Creates one public school booking and reserves its school quota atomically without student identities.';
