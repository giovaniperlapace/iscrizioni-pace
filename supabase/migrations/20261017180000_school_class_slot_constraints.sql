-- School cohort = event + referring teacher + school/city + class.
-- Headcounts are attributes of that cohort, never an alternative identity.
-- Dedicated milestone: class/slot integrity. No release flags or canonical data change.
create or replace function app.school_class_identity(
  p_event_id uuid, p_teacher_id uuid, p_school_name text, p_school_city text, p_class_description text
) returns text language sql immutable strict set search_path = pg_catalog as $$
  select encode(extensions.digest(jsonb_build_array(p_event_id, p_teacher_id,
    regexp_replace(lower(normalize(p_school_name)), '[[:space:][:punct:]]+', '', 'g'),
    regexp_replace(lower(normalize(p_school_city)), '[[:space:][:punct:]]+', '', 'g'),
    regexp_replace(lower(normalize(p_class_description)), '[[:space:][:punct:]]+', '', 'g')
  )::text, 'sha256'), 'hex');
$$;
revoke all on function app.school_class_identity(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;

-- Transactional projection of canonical active reservations. Database constraints,
-- rather than a read-then-insert check, also protect simultaneous submissions.
create table app.school_class_reservations (
  reservation_id uuid primary key references public.school_panel_reservations(id) on delete cascade,
  booking_id uuid not null references public.school_bookings(id) on delete cascade,
  class_identity text not null,
  slot_key text not null,
  during tstzrange not null,
  constraint school_class_slot_overlap unique(class_identity, slot_key) deferrable initially deferred,
  constraint school_class_time_overlap exclude using gist
    (class_identity extensions.gist_text_ops with =, during with &&) deferrable initially deferred
);
create index school_class_reservations_booking_idx on app.school_class_reservations(booking_id);
alter table app.school_class_reservations enable row level security;
revoke all on app.school_class_reservations from public,anon,authenticated,service_role;

create or replace function app.sync_school_class_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Serialize against class identity/status and timetable changes, including
  -- operational writes which do not go through the booking RPCs.
  perform 1 from public.school_panel_reservations r
    join public.school_bookings b on b.id=r.booking_id
    join public.event_moments p on p.id=r.panel_id
    where r.id=p_reservation_id for share of b,p;
  delete from app.school_class_reservations where reservation_id=p_reservation_id;
  insert into app.school_class_reservations(reservation_id,booking_id,class_identity,slot_key,during)
    select r.id,b.id,app.school_class_identity(b.event_id,b.teacher_id,b.school_name,b.school_city,b.class_description),
      app.panel_slot_key(p.starts_at),tstzrange(p.starts_at,p.ends_at,'[)')
    from public.school_panel_reservations r
    join public.school_bookings b on b.id=r.booking_id
    join public.event_moments p on p.id=r.panel_id
    where r.id=p_reservation_id and r.status='reserved' and b.status in ('submitted','confirmed');
end;
$$;
revoke all on function app.sync_school_class_reservation(uuid) from public,anon,authenticated,service_role;

create or replace function app.sync_school_class_after_reservation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.sync_school_class_reservation(new.id);
  return null;
end;
$$;
create trigger school_class_reservation_sync after insert or update on public.school_panel_reservations
  for each row execute function app.sync_school_class_after_reservation();
revoke all on function app.sync_school_class_after_reservation() from public,anon,authenticated,service_role;

create or replace function app.sync_school_class_after_booking()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r uuid;
begin
  for r in select id from public.school_panel_reservations where booking_id=new.id order by id loop
    perform app.sync_school_class_reservation(r);
  end loop;
  return null;
end;
$$;
create trigger school_class_booking_sync
  after update of event_id,teacher_id,school_name,school_city,class_description,status on public.school_bookings
  for each row execute function app.sync_school_class_after_booking();
revoke all on function app.sync_school_class_after_booking() from public,anon,authenticated,service_role;

create or replace function app.sync_school_class_after_schedule()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r uuid;
begin
  for r in select id from public.school_panel_reservations where panel_id=new.id order by id loop
    perform app.sync_school_class_reservation(r);
  end loop;
  return null;
end;
$$;
create trigger school_class_schedule_sync after update of starts_at,ends_at on public.event_moments
  for each row execute function app.sync_school_class_after_schedule();
revoke all on function app.sync_school_class_after_schedule() from public,anon,authenticated,service_role;

-- Abort on pre-existing conflicts; never silently cancel or merge bookings.
insert into app.school_class_reservations(reservation_id,booking_id,class_identity,slot_key,during)
  select r.id,b.id,app.school_class_identity(b.event_id,b.teacher_id,b.school_name,b.school_city,b.class_description),
    app.panel_slot_key(p.starts_at),tstzrange(p.starts_at,p.ends_at,'[)')
  from public.school_panel_reservations r
  join public.school_bookings b on b.id=r.booking_id
  join public.event_moments p on p.id=r.panel_id
  where r.status='reserved' and b.status in ('submitted','confirmed');

create or replace function app.validate_school_booking_overlaps(target_booking_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from app.school_class_reservations a
    join app.school_class_reservations b on b.class_identity=a.class_identity and b.reservation_id<>a.reservation_id
    where a.booking_id=target_booking_id and (a.slot_key=b.slot_key or a.during && b.during)
  ) then
    raise exception 'school class booking panels overlap' using errcode='23P01';
  end if;
end;
$$;
