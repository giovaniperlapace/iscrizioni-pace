-- Initial multi-event schema and RLS for iscrizioni-pace.
-- This migration is designed to be reviewed before applying it to a real Supabase environment.

create schema if not exists extensions;
create schema if not exists app;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

do $$
begin
  create type public.app_role as enum (
    'admin',
    'manager',
    'manager_viewer',
    'accoglienza',
    'capogruppo'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.event_status as enum (
    'draft',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.registration_status as enum (
    'draft',
    'submitted',
    'confirmed',
    'cancelled',
    'waitlisted'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_assignment_status as enum (
    'probable',
    'confirmed',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.qr_token_status as enum (
    'active',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext,
  full_name text,
  preferred_locale text not null default 'it' check (preferred_locale in ('it', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  city text not null,
  country text not null,
  starts_on date,
  ends_on date,
  status public.event_status not null default 'draft',
  default_locale text not null default 'it' check (default_locale in ('it', 'en')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.event_locations (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  address text,
  city text,
  country text,
  public_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_moments (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  location_id uuid references public.event_locations(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity >= 0),
  is_public boolean not null default true,
  check_in_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.event_user_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (
    (role = 'admin' and event_id is null)
    or (role <> 'admin' and event_id is not null)
  )
);

create unique index event_user_roles_global_admin_unique
  on public.event_user_roles(user_id, role)
  where role = 'admin' and event_id is null;

create unique index event_user_roles_event_unique
  on public.event_user_roles(event_id, user_id, role)
  where event_id is not null;

create table public.countries (
  id uuid primary key default extensions.gen_random_uuid(),
  iso2 text unique check (iso2 is null or length(iso2) = 2),
  name_it text not null,
  name_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default extensions.gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, normalized_name)
);

create table public.groups (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  country_id uuid references public.countries(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  primary_leader_name text,
  public_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.group_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'capogruppo',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (role = 'capogruppo'),
  unique (group_id, user_id)
);

create table public.participants (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  preferred_locale text not null default 'it' check (preferred_locale in ('it', 'en')),
  country_id uuid references public.countries(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  country_other text,
  city_other text,
  has_previous_santegidio_participation boolean,
  participates_with_group boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status public.registration_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  cancelled_at timestamptz,
  source text not null default 'public_form' check (source in ('public_form', 'capogruppo', 'admin', 'import')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, participant_id)
);

create table public.participant_contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  email extensions.citext,
  phone text,
  contact_name text,
  contact_relationship text,
  is_primary boolean not null default true,
  is_delegate_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null or contact_name is not null)
);

create table public.participant_consents (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  privacy_version text not null,
  privacy_accepted_at timestamptz not null,
  data_processing_accepted boolean not null default true,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_by_name text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (registration_id, privacy_version)
);

create table public.accessibility_needs (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  washington_group_answers jsonb not null default '{}'::jsonb,
  operational_notes text,
  needs_operational_support boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id)
);

create table public.participant_group_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  status public.group_assignment_status not null default 'probable',
  source text not null default 'participant_selected' check (source in ('participant_selected', 'rule', 'capogruppo', 'manager', 'admin')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, group_id)
);

create table public.event_attendance_choices (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  day date,
  choice text not null default 'unknown' check (choice in ('yes', 'no', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, day)
);

create table public.moment_attendance_choices (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  moment_id uuid not null references public.event_moments(id) on delete cascade,
  choice text not null default 'unknown' check (choice in ('yes', 'no', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, moment_id)
);

create table public.qr_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  token_hash text not null unique,
  status public.qr_token_status not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table public.check_ins (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  moment_id uuid references public.event_moments(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id) on delete set null,
  location_id uuid references public.event_locations(id) on delete set null,
  source text not null default 'qr_scan' check (source in ('qr_scan', 'manual', 'import')),
  notes text
);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_locations_event_id_idx on public.event_locations(event_id);
create index event_moments_event_id_idx on public.event_moments(event_id);
create index event_user_roles_user_id_idx on public.event_user_roles(user_id);
create index cities_country_id_idx on public.cities(country_id);
create index groups_event_id_idx on public.groups(event_id);
create index group_memberships_user_id_idx on public.group_memberships(user_id);
create index participants_auth_user_id_idx on public.participants(auth_user_id);
create index registrations_event_id_idx on public.registrations(event_id);
create index registrations_participant_id_idx on public.registrations(participant_id);
create index participant_contacts_participant_id_idx on public.participant_contacts(participant_id);
create index participant_contacts_email_idx on public.participant_contacts(email);
create index participant_consents_registration_id_idx on public.participant_consents(registration_id);
create index accessibility_needs_registration_id_idx on public.accessibility_needs(registration_id);
create index participant_group_assignments_registration_id_idx on public.participant_group_assignments(registration_id);
create index participant_group_assignments_group_id_idx on public.participant_group_assignments(group_id);
create index event_attendance_choices_registration_id_idx on public.event_attendance_choices(registration_id);
create index moment_attendance_choices_registration_id_idx on public.moment_attendance_choices(registration_id);
create index moment_attendance_choices_moment_id_idx on public.moment_attendance_choices(moment_id);
create index qr_tokens_registration_id_idx on public.qr_tokens(registration_id);
create index check_ins_registration_id_idx on public.check_ins(registration_id);
create index check_ins_event_id_idx on public.check_ins(event_id);
create unique index check_ins_registration_event_general_unique
  on public.check_ins(registration_id, event_id)
  where moment_id is null;
create unique index check_ins_registration_event_moment_unique
  on public.check_ins(registration_id, event_id, moment_id)
  where moment_id is not null;
create index audit_logs_event_id_created_at_idx on public.audit_logs(event_id, created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function app.set_updated_at();

create trigger event_locations_set_updated_at
  before update on public.event_locations
  for each row execute function app.set_updated_at();

create trigger event_moments_set_updated_at
  before update on public.event_moments
  for each row execute function app.set_updated_at();

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function app.set_updated_at();

create trigger participants_set_updated_at
  before update on public.participants
  for each row execute function app.set_updated_at();

create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function app.set_updated_at();

create trigger participant_contacts_set_updated_at
  before update on public.participant_contacts
  for each row execute function app.set_updated_at();

create trigger accessibility_needs_set_updated_at
  before update on public.accessibility_needs
  for each row execute function app.set_updated_at();

create trigger participant_group_assignments_set_updated_at
  before update on public.participant_group_assignments
  for each row execute function app.set_updated_at();

create trigger event_attendance_choices_set_updated_at
  before update on public.event_attendance_choices
  for each row execute function app.set_updated_at();

create trigger moment_attendance_choices_set_updated_at
  before update on public.moment_attendance_choices
  for each row execute function app.set_updated_at();

create or replace function app.ensure_group_assignment_event_scope()
returns trigger
language plpgsql
as $$
declare
  registration_event_id uuid;
  group_event_id uuid;
begin
  select event_id into registration_event_id
  from public.registrations
  where id = new.registration_id;

  select event_id into group_event_id
  from public.groups
  where id = new.group_id;

  if registration_event_id is distinct from group_event_id then
    raise exception 'group assignment event scope mismatch';
  end if;

  return new;
end;
$$;

create trigger participant_group_assignments_event_scope
  before insert or update on public.participant_group_assignments
  for each row execute function app.ensure_group_assignment_event_scope();

create or replace function app.ensure_moment_choice_event_scope()
returns trigger
language plpgsql
as $$
declare
  registration_event_id uuid;
  moment_event_id uuid;
begin
  select event_id into registration_event_id
  from public.registrations
  where id = new.registration_id;

  select event_id into moment_event_id
  from public.event_moments
  where id = new.moment_id;

  if registration_event_id is distinct from moment_event_id then
    raise exception 'moment attendance event scope mismatch';
  end if;

  return new;
end;
$$;

create trigger moment_attendance_choices_event_scope
  before insert or update on public.moment_attendance_choices
  for each row execute function app.ensure_moment_choice_event_scope();

create or replace function app.ensure_check_in_event_scope()
returns trigger
language plpgsql
as $$
declare
  registration_event_id uuid;
  moment_event_id uuid;
begin
  select event_id into registration_event_id
  from public.registrations
  where id = new.registration_id;

  if new.event_id is distinct from registration_event_id then
    raise exception 'check-in registration event scope mismatch';
  end if;

  if new.moment_id is not null then
    select event_id into moment_event_id
    from public.event_moments
    where id = new.moment_id;

    if new.event_id is distinct from moment_event_id then
      raise exception 'check-in moment event scope mismatch';
    end if;
  end if;

  return new;
end;
$$;

create trigger check_ins_event_scope
  before insert or update on public.check_ins
  for each row execute function app.ensure_check_in_event_scope();

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.event_user_roles eur
    where eur.user_id = auth.uid()
      and eur.role = 'admin'
      and eur.event_id is null
  );
$$;

create or replace function app.has_event_role(target_event_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_admin()
    or exists (
      select 1
      from public.event_user_roles eur
      where eur.user_id = auth.uid()
        and eur.event_id = target_event_id
        and eur.role = any(allowed_roles)
    );
$$;

create or replace function app.is_group_leader(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_admin()
    or exists (
      select 1
      from public.group_memberships gm
      where gm.user_id = auth.uid()
        and gm.group_id = target_group_id
    );
$$;

create or replace function app.owns_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.participants p
    where p.id = target_participant_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function app.owns_registration(target_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    join public.participants p on p.id = r.participant_id
    where r.id = target_registration_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function app.can_read_registration(target_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    join public.participants p on p.id = r.participant_id
    where r.id = target_registration_id
      and (
        p.auth_user_id = auth.uid()
        or app.has_event_role(r.event_id, array['manager', 'manager_viewer']::public.app_role[])
        or exists (
          select 1
          from public.participant_group_assignments pga
          join public.group_memberships gm on gm.group_id = pga.group_id
          where pga.registration_id = r.id
            and pga.status in ('probable', 'confirmed')
            and gm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function app.can_manage_registration(target_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    where r.id = target_registration_id
      and app.has_event_role(r.event_id, array['manager']::public.app_role[])
  );
$$;

create or replace function app.can_read_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.owns_participant(target_participant_id)
    or exists (
      select 1
      from public.registrations r
      where r.participant_id = target_participant_id
        and app.can_read_registration(r.id)
    );
$$;

create or replace function app.can_check_in(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.has_event_role(target_event_id, array['manager', 'accoglienza']::public.app_role[]);
$$;

grant usage on schema app to anon, authenticated;
grant execute on all functions in schema app to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on
  public.events,
  public.event_locations,
  public.event_moments,
  public.countries,
  public.cities,
  public.groups
to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_locations enable row level security;
alter table public.event_moments enable row level security;
alter table public.event_user_roles enable row level security;
alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.participants enable row level security;
alter table public.registrations enable row level security;
alter table public.participant_contacts enable row level security;
alter table public.participant_consents enable row level security;
alter table public.accessibility_needs enable row level security;
alter table public.participant_group_assignments enable row level security;
alter table public.event_attendance_choices enable row level security;
alter table public.moment_attendance_choices enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.check_ins enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read own or admin"
  on public.profiles for select
  using (id = auth.uid() or app.is_admin());

create policy "profiles update own or admin"
  on public.profiles for update
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());

create policy "profiles insert own or admin"
  on public.profiles for insert
  with check (id = auth.uid() or app.is_admin());

create policy "events public read published"
  on public.events for select
  using (status = 'published' or app.has_event_role(id, array['manager', 'manager_viewer', 'accoglienza']::public.app_role[]));

create policy "events admin manage"
  on public.events for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "event locations public read for published events"
  on public.event_locations for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.status = 'published' or app.has_event_role(e.id, array['manager', 'manager_viewer', 'accoglienza']::public.app_role[]))
    )
  );

create policy "event locations admin manage"
  on public.event_locations for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "event moments public read visible"
  on public.event_moments for select
  using (
    is_public
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.status = 'published' or app.has_event_role(e.id, array['manager', 'manager_viewer', 'accoglienza']::public.app_role[]))
    )
  );

create policy "event moments event managers manage"
  on public.event_moments for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "event user roles read own or admin"
  on public.event_user_roles for select
  using (user_id = auth.uid() or app.is_admin());

create policy "event user roles admin manage"
  on public.event_user_roles for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "countries public read active"
  on public.countries for select
  using (is_active or app.is_admin());

create policy "countries admin manage"
  on public.countries for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "cities public read active"
  on public.cities for select
  using (is_active or app.is_admin());

create policy "cities admin manage"
  on public.cities for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "groups public read active"
  on public.groups for select
  using (
    is_active
    or app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
    or app.is_group_leader(id)
  );

create policy "groups event managers manage"
  on public.groups for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "group memberships read scoped"
  on public.group_memberships for select
  using (
    user_id = auth.uid()
    or app.is_group_leader(group_id)
    or exists (
      select 1
      from public.groups g
      where g.id = group_id
        and app.has_event_role(g.event_id, array['manager', 'manager_viewer']::public.app_role[])
    )
  );

create policy "group memberships event managers manage"
  on public.group_memberships for all
  using (
    exists (
      select 1
      from public.groups g
      where g.id = group_id
        and app.has_event_role(g.event_id, array['manager']::public.app_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.groups g
      where g.id = group_id
        and app.has_event_role(g.event_id, array['manager']::public.app_role[])
    )
  );

create policy "participants read scoped"
  on public.participants for select
  using (app.can_read_participant(id));

create policy "participants update owner or manager"
  on public.participants for update
  using (
    app.owns_participant(id)
    or exists (
      select 1 from public.registrations r
      where r.participant_id = id
        and app.can_manage_registration(r.id)
    )
  )
  with check (
    app.owns_participant(id)
    or exists (
      select 1 from public.registrations r
      where r.participant_id = id
        and app.can_manage_registration(r.id)
    )
  );

create policy "participants insert authenticated owner"
  on public.participants for insert
  with check (auth_user_id = auth.uid() or app.is_admin());

create policy "registrations read scoped"
  on public.registrations for select
  using (app.can_read_registration(id));

create policy "registrations update owner or manager"
  on public.registrations for update
  using (
    app.can_manage_registration(id)
    or exists (
      select 1 from public.participants p
      where p.id = participant_id
        and p.auth_user_id = auth.uid()
    )
  )
  with check (
    app.can_manage_registration(id)
    or exists (
      select 1 from public.participants p
      where p.id = participant_id
        and p.auth_user_id = auth.uid()
    )
  );

create policy "registrations insert participant owner"
  on public.registrations for insert
  with check (
    exists (
      select 1 from public.participants p
      where p.id = participant_id
        and p.auth_user_id = auth.uid()
    )
    or app.has_event_role(event_id, array['manager']::public.app_role[])
  );

create policy "participant contacts read scoped"
  on public.participant_contacts for select
  using (app.can_read_participant(participant_id));

create policy "participant contacts write owner or manager"
  on public.participant_contacts for all
  using (
    app.owns_participant(participant_id)
    or exists (
      select 1 from public.registrations r
      where r.participant_id = participant_contacts.participant_id
        and app.can_manage_registration(r.id)
    )
  )
  with check (
    app.owns_participant(participant_id)
    or exists (
      select 1 from public.registrations r
      where r.participant_id = participant_contacts.participant_id
        and app.can_manage_registration(r.id)
    )
  );

create policy "participant consents read scoped"
  on public.participant_consents for select
  using (app.can_read_registration(registration_id));

create policy "participant consents insert owner or manager"
  on public.participant_consents for insert
  with check (
    app.can_manage_registration(registration_id)
    or exists (
      select 1
      from public.registrations r
      join public.participants p on p.id = r.participant_id
      where r.id = registration_id
        and p.auth_user_id = auth.uid()
    )
  );

create policy "accessibility needs read restricted"
  on public.accessibility_needs for select
  using (
    app.can_manage_registration(registration_id)
    or exists (
      select 1
      from public.registrations r
      join public.participants p on p.id = r.participant_id
      where r.id = registration_id
        and p.auth_user_id = auth.uid()
    )
  );

create policy "accessibility needs write owner or manager"
  on public.accessibility_needs for all
  using (
    app.can_manage_registration(registration_id)
    or exists (
      select 1
      from public.registrations r
      join public.participants p on p.id = r.participant_id
      where r.id = registration_id
        and p.auth_user_id = auth.uid()
    )
  )
  with check (
    app.can_manage_registration(registration_id)
    or exists (
      select 1
      from public.registrations r
      join public.participants p on p.id = r.participant_id
      where r.id = registration_id
        and p.auth_user_id = auth.uid()
    )
  );

create policy "group assignments read scoped"
  on public.participant_group_assignments for select
  using (
    app.can_read_registration(registration_id)
    or app.is_group_leader(group_id)
  );

create policy "group assignments insert owner or manager"
  on public.participant_group_assignments for insert
  with check (
    app.can_manage_registration(registration_id)
    or app.owns_registration(registration_id)
  );

create policy "group assignments update manager or group leader"
  on public.participant_group_assignments for update
  using (
    app.can_manage_registration(registration_id)
    or app.is_group_leader(group_id)
  )
  with check (
    app.can_manage_registration(registration_id)
    or app.is_group_leader(group_id)
  );

create policy "group assignments delete managers"
  on public.participant_group_assignments for delete
  using (app.can_manage_registration(registration_id));

create policy "event attendance read scoped"
  on public.event_attendance_choices for select
  using (app.can_read_registration(registration_id));

create policy "event attendance write owner or manager"
  on public.event_attendance_choices for all
  using (app.can_manage_registration(registration_id) or app.owns_registration(registration_id))
  with check (app.can_manage_registration(registration_id) or app.owns_registration(registration_id));

create policy "moment attendance read scoped"
  on public.moment_attendance_choices for select
  using (app.can_read_registration(registration_id));

create policy "moment attendance write owner or manager"
  on public.moment_attendance_choices for all
  using (app.can_manage_registration(registration_id) or app.owns_registration(registration_id))
  with check (app.can_manage_registration(registration_id) or app.owns_registration(registration_id));

create policy "qr tokens read operational"
  on public.qr_tokens for select
  using (
    app.can_manage_registration(registration_id)
    or exists (
      select 1
      from public.registrations r
      where r.id = registration_id
        and app.can_check_in(r.event_id)
    )
  );

create policy "qr tokens manage event managers"
  on public.qr_tokens for all
  using (app.can_manage_registration(registration_id))
  with check (app.can_manage_registration(registration_id));

create policy "check ins read scoped"
  on public.check_ins for select
  using (
    app.can_check_in(event_id)
    or app.can_read_registration(registration_id)
  );

create policy "check ins insert accoglienza or manager"
  on public.check_ins for insert
  with check (app.can_check_in(event_id));

create policy "check ins update managers"
  on public.check_ins for update
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "audit logs read admin or event manager"
  on public.audit_logs for select
  using (
    app.is_admin()
    or (
      event_id is not null
      and app.has_event_role(event_id, array['manager']::public.app_role[])
    )
  );
