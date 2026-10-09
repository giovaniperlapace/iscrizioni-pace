-- Milestone P1: canonical panel, location capacity, audience and seat-section schema.
-- This migration is reviewed and tested locally before being applied to staging.

create extension if not exists btree_gist with schema extensions;

do $$
begin
  create type public.event_moment_type as enum ('general', 'panel');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.panel_publication_status as enum ('draft', 'published');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.panel_booking_channel as enum (
    'individual',
    'school_booking',
    'internal_assignment'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.event_locations
  add column max_capacity integer,
  add column is_active boolean not null default true,
  add constraint event_locations_max_capacity_positive
    check (max_capacity is null or max_capacity > 0);

alter table public.event_moments
  add column moment_type public.event_moment_type not null default 'general',
  add column publication_status public.panel_publication_status not null default 'draft',
  add column published_at timestamptz,
  add column published_by uuid references auth.users(id) on delete set null;

update public.event_moments
set
  publication_status = case
    when is_public then 'published'::public.panel_publication_status
    else 'draft'::public.panel_publication_status
  end,
  published_at = case
    when is_public then coalesce(updated_at, created_at, now())
    else null
  end,
  published_by = null;

alter table public.event_moments
  add constraint event_moments_panel_published_fields
  check (
    moment_type <> 'panel'
    or publication_status = 'draft'
    or (
      location_id is not null
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
    )
  );

alter table public.event_moments
  add constraint event_moments_panel_location_no_overlap
  exclude using gist (
    location_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (
    moment_type = 'panel'
    and location_id is not null
    and starts_at is not null
    and ends_at is not null
  );

create table public.panel_audience_types (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  name text not null,
  booking_channel public.panel_booking_channel not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint panel_audience_types_code_format
    check (code ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint panel_audience_types_name_not_blank
    check (length(btrim(name)) between 1 and 80),
  constraint panel_audience_types_event_code_unique unique (event_id, code)
);

create table public.panel_seat_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  panel_id uuid not null references public.event_moments(id) on delete cascade,
  audience_type_id uuid not null references public.panel_audience_types(id) on delete restrict,
  capacity integer not null check (capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint panel_seat_sections_panel_audience_unique
    unique (panel_id, audience_type_id)
);

create index panel_audience_types_event_active_idx
  on public.panel_audience_types(event_id, is_active, sort_order, name);

create index panel_seat_sections_event_panel_idx
  on public.panel_seat_sections(event_id, panel_id);

create index panel_seat_sections_audience_type_idx
  on public.panel_seat_sections(audience_type_id);

create index event_moments_panel_catalog_idx
  on public.event_moments(event_id, publication_status, starts_at)
  where moment_type = 'panel';

create or replace function app.prepare_event_moment_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.moment_type = 'panel' then
    new.is_public := new.publication_status = 'published';
  elsif tg_op = 'INSERT' or new.is_public is distinct from old.is_public then
    new.publication_status := case
      when new.is_public then 'published'::public.panel_publication_status
      else 'draft'::public.panel_publication_status
    end;
  else
    new.is_public := new.publication_status = 'published';
  end if;

  if new.publication_status = 'published' then
    if tg_op = 'INSERT' or old.publication_status is distinct from new.publication_status then
      new.published_at := now();
      new.published_by := auth.uid();
    elsif new.published_at is null then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
    new.published_by := null;
  end if;

  return new;
end;
$$;

create trigger event_moments_prepare_publication
  before insert or update on public.event_moments
  for each row execute function app.prepare_event_moment_publication();

create or replace function app.ensure_event_moment_location_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.location_id is not null and not exists (
    select 1
    from public.event_locations location
    where location.id = new.location_id
      and location.event_id = new.event_id
  ) then
    raise exception 'panel location event scope mismatch';
  end if;

  return new;
end;
$$;

create trigger event_moments_location_event_scope
  before insert or update of event_id, location_id on public.event_moments
  for each row execute function app.ensure_event_moment_location_scope();

create or replace function app.ensure_panel_section_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  panel_event_id uuid;
  panel_kind public.event_moment_type;
  audience_event_id uuid;
  audience_active boolean;
begin
  select moment.event_id, moment.moment_type
  into panel_event_id, panel_kind
  from public.event_moments moment
  where moment.id = new.panel_id;

  select audience.event_id, audience.is_active
  into audience_event_id, audience_active
  from public.panel_audience_types audience
  where audience.id = new.audience_type_id;

  if panel_event_id is null or audience_event_id is null then
    raise exception 'panel section references a missing panel or audience type';
  end if;

  if panel_kind <> 'panel' then
    raise exception 'seat sections can be assigned only to panel moments';
  end if;

  if new.event_id is distinct from panel_event_id
    or new.event_id is distinct from audience_event_id then
    raise exception 'panel section event scope mismatch';
  end if;

  if (tg_op = 'INSERT' or new.audience_type_id is distinct from old.audience_type_id)
    and not audience_active then
    raise exception 'inactive audience types cannot be added to panels';
  end if;

  return new;
end;
$$;

create trigger panel_seat_sections_event_scope
  before insert or update on public.panel_seat_sections
  for each row execute function app.ensure_panel_section_scope();

create or replace function app.validate_panel_configuration(target_panel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  panel_record public.event_moments%rowtype;
  location_capacity integer;
  section_count integer;
  section_capacity bigint;
begin
  select *
  into panel_record
  from public.event_moments
  where id = target_panel_id
  for update;

  if not found or panel_record.moment_type <> 'panel' then
    return;
  end if;

  if panel_record.publication_status <> 'published' then
    return;
  end if;

  if panel_record.location_id is null
    or panel_record.starts_at is null
    or panel_record.ends_at is null
    or panel_record.ends_at <= panel_record.starts_at then
    raise exception 'published panels require a location and a valid time range';
  end if;

  select location.max_capacity
  into location_capacity
  from public.event_locations location
  where location.id = panel_record.location_id
    and location.event_id = panel_record.event_id
    and location.is_active;

  if location_capacity is null then
    raise exception 'published panels require an active location with a maximum capacity';
  end if;

  select count(*), coalesce(sum(section.capacity), 0)
  into section_count, section_capacity
  from public.panel_seat_sections section
  where section.panel_id = panel_record.id;

  if section_count = 0 then
    raise exception 'published panels require at least one seat section';
  end if;

  if section_capacity <> location_capacity then
    raise exception
      'panel section capacity total (%) must equal location capacity (%)',
      section_capacity,
      location_capacity;
  end if;
end;
$$;

create or replace function app.validate_panel_after_moment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.validate_panel_configuration(new.id);
  return null;
end;
$$;

create constraint trigger event_moments_validate_panel_configuration
  after insert or update on public.event_moments
  deferrable initially deferred
  for each row execute function app.validate_panel_after_moment_change();

create or replace function app.validate_panel_after_section_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform app.validate_panel_configuration(old.panel_id);
  end if;

  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.panel_id is distinct from old.panel_id) then
    perform app.validate_panel_configuration(new.panel_id);
  elsif tg_op = 'UPDATE' then
    perform app.validate_panel_configuration(new.panel_id);
  end if;

  return null;
end;
$$;

create constraint trigger panel_seat_sections_validate_configuration
  after insert or update or delete on public.panel_seat_sections
  deferrable initially deferred
  for each row execute function app.validate_panel_after_section_change();

create or replace function app.validate_panels_after_location_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  panel_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.max_capacity is not distinct from old.max_capacity
    and new.is_active is not distinct from old.is_active then
    return null;
  end if;

  for panel_id in
    select moment.id
    from public.event_moments moment
    where moment.location_id = coalesce(new.id, old.id)
      and moment.moment_type = 'panel'
      and moment.publication_status = 'published'
  loop
    perform app.validate_panel_configuration(panel_id);
  end loop;

  return null;
end;
$$;

create constraint trigger event_locations_validate_panel_capacity
  after insert or update or delete on public.event_locations
  deferrable initially deferred
  for each row execute function app.validate_panels_after_location_change();

create or replace function app.audit_panel_publication_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  audit_action text;
begin
  if new.moment_type <> 'panel' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.publication_status = 'published' then
    audit_action := 'panel.published';
  elsif tg_op = 'UPDATE'
    and old.publication_status is distinct from new.publication_status then
    audit_action := case
      when new.publication_status = 'published' then 'panel.published'
      else 'panel.unpublished'
    end;
  else
    return new;
  end if;

  insert into public.audit_logs (
    event_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    new.event_id,
    auth.uid(),
    audit_action,
    'event_moments',
    new.id,
    jsonb_build_object(
      'publication_status', new.publication_status,
      'location_id', new.location_id,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at
    )
  );

  return new;
end;
$$;

create trigger event_moments_audit_panel_publication
  after insert or update of publication_status on public.event_moments
  for each row execute function app.audit_panel_publication_change();

create or replace function app.is_published_panel(target_panel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.event_moments moment
    join public.events event on event.id = moment.event_id
    where moment.id = target_panel_id
      and moment.moment_type = 'panel'
      and moment.publication_status = 'published'
      and moment.is_public
      and event.status = 'published'
  );
$$;

create trigger panel_audience_types_set_updated_at
  before update on public.panel_audience_types
  for each row execute function app.set_updated_at();

create trigger panel_seat_sections_set_updated_at
  before update on public.panel_seat_sections
  for each row execute function app.set_updated_at();

grant select on public.panel_audience_types, public.panel_seat_sections to anon;
grant select, insert, update, delete
  on public.panel_audience_types, public.panel_seat_sections
  to authenticated;

alter table public.panel_audience_types enable row level security;
alter table public.panel_seat_sections enable row level security;

drop policy "event moments public read visible" on public.event_moments;

create policy "event moments published or operational read"
  on public.event_moments for select
  using (
    app.has_event_role(
      event_id,
      array['manager', 'manager_viewer']::public.app_role[]
    )
    or (
      is_public
      and (
        moment_type <> 'panel'
        or publication_status = 'published'
      )
      and exists (
        select 1
        from public.events event
        where event.id = event_moments.event_id
          and event.status = 'published'
      )
    )
  );

create policy "panel audience types published or operational read"
  on public.panel_audience_types for select
  using (
    app.has_event_role(
      event_id,
      array['manager', 'manager_viewer']::public.app_role[]
    )
    or (
      is_active
      and exists (
        select 1
        from public.panel_seat_sections section
        where section.audience_type_id = panel_audience_types.id
          and app.is_published_panel(section.panel_id)
      )
    )
  );

create policy "panel audience types managers manage"
  on public.panel_audience_types for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "panel seat sections published or operational read"
  on public.panel_seat_sections for select
  using (
    app.has_event_role(
      event_id,
      array['manager', 'manager_viewer']::public.app_role[]
    )
    or app.is_published_panel(panel_id)
  );

create policy "panel seat sections managers manage"
  on public.panel_seat_sections for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

grant execute on function app.is_published_panel(uuid) to anon, authenticated;

revoke all on function app.prepare_event_moment_publication() from public;
revoke all on function app.ensure_event_moment_location_scope() from public;
revoke all on function app.ensure_panel_section_scope() from public;
revoke all on function app.validate_panel_configuration(uuid) from public;
revoke all on function app.validate_panel_after_moment_change() from public;
revoke all on function app.validate_panel_after_section_change() from public;
revoke all on function app.validate_panels_after_location_change() from public;
revoke all on function app.audit_panel_publication_change() from public;
