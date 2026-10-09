-- Milestone P7: school group bookings, verified teacher ownership and atomic
-- reservation of the dedicated school seat sections.

do $$
begin
  create type public.school_booking_status as enum (
    'draft',
    'submitted',
    'confirmed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.school_panel_reservation_status as enum (
    'reserved',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table public.school_booking_teachers (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email extensions.citext not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_booking_teachers_event_email_unique unique (event_id, email),
  constraint school_booking_teachers_email_not_blank check (length(btrim(email::text)) between 3 and 320),
  constraint school_booking_teachers_first_name_length check (length(btrim(first_name)) between 1 and 120),
  constraint school_booking_teachers_last_name_length check (length(btrim(last_name)) between 1 and 120),
  constraint school_booking_teachers_phone_length check (length(btrim(phone)) between 3 and 40)
);

create table public.school_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  teacher_id uuid not null references public.school_booking_teachers(id) on delete restrict,
  school_name text not null,
  school_city text not null,
  class_description text not null,
  student_count integer not null check (student_count between 1 and 1000),
  companion_count integer not null check (companion_count between 1 and 100),
  status public.school_booking_status not null default 'submitted',
  privacy_version text not null,
  privacy_accepted_at timestamptz not null,
  internal_notes text,
  submitted_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_bookings_school_name_length check (length(btrim(school_name)) between 1 and 180),
  constraint school_bookings_school_city_length check (length(btrim(school_city)) between 1 and 120),
  constraint school_bookings_class_length check (length(btrim(class_description)) between 1 and 180),
  constraint school_bookings_privacy_version_length check (length(btrim(privacy_version)) between 1 and 80),
  constraint school_bookings_notes_length check (internal_notes is null or length(internal_notes) <= 2000),
  constraint school_bookings_cancelled_at_consistent check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create table public.school_panel_reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  booking_id uuid not null references public.school_bookings(id) on delete cascade,
  panel_id uuid not null references public.event_moments(id) on delete restrict,
  seat_section_id uuid not null references public.panel_seat_sections(id) on delete restrict,
  student_count integer not null check (student_count between 1 and 1000),
  companion_count integer not null check (companion_count between 1 and 100),
  status public.school_panel_reservation_status not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_panel_reservations_booking_panel_unique unique (booking_id, panel_id)
);

create table public.school_booking_qr_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.school_bookings(id) on delete cascade,
  token_hash text not null unique,
  token_encrypted text not null,
  status public.qr_token_status not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index school_booking_teachers_auth_user_idx
  on public.school_booking_teachers(auth_user_id) where auth_user_id is not null;
create index school_bookings_event_status_updated_idx
  on public.school_bookings(event_id, status, updated_at desc);
create index school_bookings_teacher_idx on public.school_bookings(teacher_id);
create index school_panel_reservations_section_active_idx
  on public.school_panel_reservations(seat_section_id, booking_id)
  where status = 'reserved';
create index school_panel_reservations_panel_active_idx
  on public.school_panel_reservations(panel_id, booking_id)
  where status = 'reserved';
create unique index school_booking_qr_tokens_one_active
  on public.school_booking_qr_tokens(booking_id) where status = 'active';

create trigger school_booking_teachers_set_updated_at
  before update on public.school_booking_teachers
  for each row execute function app.set_updated_at();
create trigger school_bookings_set_updated_at
  before update on public.school_bookings
  for each row execute function app.set_updated_at();
create trigger school_panel_reservations_set_updated_at
  before update on public.school_panel_reservations
  for each row execute function app.set_updated_at();

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

create or replace function app.can_read_school_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.owns_school_booking(target_booking_id)
    or exists (
      select 1
      from public.school_bookings booking
      where booking.id = target_booking_id
        and app.has_event_role(
          booking.event_id,
          array['manager', 'manager_viewer']::public.app_role[]
        )
    );
$$;

create or replace function app.ensure_school_booking_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.school_booking_teachers teacher
    where teacher.id = new.teacher_id and teacher.event_id = new.event_id
  ) then
    raise exception 'school booking teacher event scope mismatch';
  end if;
  return new;
end;
$$;

create trigger school_bookings_event_scope
  before insert or update of event_id, teacher_id on public.school_bookings
  for each row execute function app.ensure_school_booking_scope();

create or replace function app.ensure_school_reservation_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.school_bookings booking
    join public.event_moments panel
      on panel.id = new.panel_id
     and panel.event_id = booking.event_id
     and panel.moment_type = 'panel'
     and panel.publication_status = 'published'
    join public.panel_seat_sections section
      on section.id = new.seat_section_id
     and section.panel_id = panel.id
     and section.event_id = booking.event_id
    join public.panel_audience_types audience
      on audience.id = section.audience_type_id
     and audience.booking_channel = 'school_booking'
    where booking.id = new.booking_id
      and booking.event_id = new.event_id
  ) then
    raise exception 'school reservation panel section scope mismatch';
  end if;
  return new;
end;
$$;

create trigger school_panel_reservations_event_scope
  before insert or update on public.school_panel_reservations
  for each row execute function app.ensure_school_reservation_scope();

create or replace function app.school_panel_section_occupancy(target_section_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(reservation.student_count + reservation.companion_count), 0)::integer
  from public.school_panel_reservations reservation
  join public.school_bookings booking on booking.id = reservation.booking_id
  where reservation.seat_section_id = target_section_id
    and reservation.status = 'reserved'
    and booking.status <> 'cancelled';
$$;

-- P6 calls this helper for every section capacity change. Adding school
-- occupancy here keeps one canonical capacity guard for all booking channels.
create or replace function app.panel_section_occupancy(target_section_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    coalesce((
      select sum(app.registration_panel_party_size(choice.registration_id))
      from public.moment_attendance_choices choice
      join public.registrations registration on registration.id = choice.registration_id
      where choice.seat_section_id = target_section_id
        and choice.choice = 'yes'
        and registration.status <> 'cancelled'
    ), 0)
    + app.school_panel_section_occupancy(target_section_id)
  )::integer;
$$;

create or replace function app.validate_school_booking_overlaps(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.school_panel_reservations first_reservation
    join public.event_moments first_panel on first_panel.id = first_reservation.panel_id
    join public.school_panel_reservations second_reservation
      on second_reservation.booking_id = first_reservation.booking_id
     and second_reservation.id > first_reservation.id
     and second_reservation.status = 'reserved'
    join public.event_moments second_panel on second_panel.id = second_reservation.panel_id
    where first_reservation.booking_id = target_booking_id
      and first_reservation.status = 'reserved'
      and tstzrange(first_panel.starts_at, first_panel.ends_at, '[)')
        && tstzrange(second_panel.starts_at, second_panel.ends_at, '[)')
  ) then
    raise exception 'school booking panels overlap' using errcode = '23P01';
  end if;
end;
$$;

create or replace function app.validate_school_reservation_after_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform app.validate_panel_section_booking_capacity(old.seat_section_id);
    perform app.validate_school_booking_overlaps(old.booking_id);
  end if;
  if tg_op <> 'DELETE' then
    perform app.validate_panel_section_booking_capacity(new.seat_section_id);
    perform app.validate_school_booking_overlaps(new.booking_id);
  end if;
  return null;
end;
$$;

create constraint trigger school_reservations_validate_capacity_overlap
  after insert or update or delete on public.school_panel_reservations
  deferrable initially deferred
  for each row execute function app.validate_school_reservation_after_change();

create or replace function app.validate_school_bookings_after_panel_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_booking_id uuid;
begin
  if new.moment_type <> 'panel'
    or (new.starts_at is not distinct from old.starts_at
      and new.ends_at is not distinct from old.ends_at) then
    return null;
  end if;
  for target_booking_id in
    select distinct reservation.booking_id
    from public.school_panel_reservations reservation
    where reservation.panel_id = new.id and reservation.status = 'reserved'
    order by reservation.booking_id
  loop
    perform app.validate_school_booking_overlaps(target_booking_id);
  end loop;
  return null;
end;
$$;

create constraint trigger event_moments_validate_school_panel_overlaps
  after update of starts_at, ends_at on public.event_moments
  deferrable initially deferred
  for each row execute function app.validate_school_bookings_after_panel_schedule_change();

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

grant select on public.school_booking_teachers, public.school_bookings,
  public.school_panel_reservations, public.school_booking_qr_tokens to authenticated;
alter table public.school_booking_teachers enable row level security;
alter table public.school_bookings enable row level security;
alter table public.school_panel_reservations enable row level security;
alter table public.school_booking_qr_tokens enable row level security;

create policy "school teachers read owned or operational"
  on public.school_booking_teachers for select using (
    auth_user_id = auth.uid()
    or email = (auth.jwt() ->> 'email')::extensions.citext
    or app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
  );
create policy "school bookings read owned or operational"
  on public.school_bookings for select using (app.can_read_school_booking(id));
create policy "school reservations read owned or operational"
  on public.school_panel_reservations for select using (app.can_read_school_booking(booking_id));
create policy "school QR read owner or managers"
  on public.school_booking_qr_tokens for select using (
    app.owns_school_booking(booking_id)
    or exists (
      select 1 from public.school_bookings booking
      where booking.id = booking_id
        and app.has_event_role(booking.event_id, array['manager']::public.app_role[])
    )
  );

revoke all on function app.owns_school_booking(uuid) from public, anon;
grant execute on function app.owns_school_booking(uuid) to authenticated;
revoke all on function app.can_read_school_booking(uuid) from public, anon;
grant execute on function app.can_read_school_booking(uuid) to authenticated;
revoke all on function public.save_school_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, public.school_booking_status, jsonb, text, text
) from public, anon;
grant execute on function public.save_school_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, public.school_booking_status, jsonb, text, text
) to authenticated;
revoke all on function public.cancel_school_booking(uuid) from public, anon;
grant execute on function public.cancel_school_booking(uuid) to authenticated;

revoke all on function app.ensure_school_booking_scope() from public, anon, authenticated;
revoke all on function app.ensure_school_reservation_scope() from public, anon, authenticated;
revoke all on function app.school_panel_section_occupancy(uuid) from public, anon, authenticated;
revoke all on function app.validate_school_booking_overlaps(uuid) from public, anon, authenticated;
revoke all on function app.validate_school_reservation_after_change() from public, anon, authenticated;
revoke all on function app.validate_school_bookings_after_panel_schedule_change() from public, anon, authenticated;

comment on table public.school_bookings is
  'School/class group reservations kept separate from individual participants.';
comment on function public.save_school_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer,
  text, text, public.school_booking_status, jsonb, text, text
) is 'Atomically creates or updates one school booking and its school-only panel reservations.';
