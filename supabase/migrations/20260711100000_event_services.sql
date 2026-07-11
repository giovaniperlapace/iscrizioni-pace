create table if not exists public.event_services (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  description text,
  is_active boolean not null default true,
  public_order integer not null default 100,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_services_label_not_blank check (length(trim(label)) > 0),
  constraint event_services_label_length check (char_length(label) <= 60),
  constraint event_services_description_length check (description is null or char_length(description) <= 240),
  constraint event_services_public_order_positive check (public_order >= 0)
);

create unique index if not exists event_services_event_label_unique
  on public.event_services(event_id, lower(trim(label)));

create index if not exists event_services_event_order_idx
  on public.event_services(event_id, is_active, public_order, label);

create trigger event_services_set_updated_at
  before update on public.event_services
  for each row execute function app.set_updated_at();

create table if not exists public.participant_event_services (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  service_id uuid not null references public.event_services(id) on delete restrict,
  status text not null default 'assigned',
  source text not null default 'manager',
  participant_note text,
  operator_note text,
  preferred_at timestamptz,
  proposed_at timestamptz,
  assigned_at timestamptz,
  decided_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_event_services_status_check check (
    status in ('preference_pending', 'proposal_pending', 'assigned', 'declined')
  ),
  constraint participant_event_services_source_check check (
    source in ('participant_preference', 'manager', 'capogruppo')
  ),
  constraint participant_event_services_notes_length check (
    (participant_note is null or char_length(participant_note) <= 500)
    and (operator_note is null or char_length(operator_note) <= 800)
  ),
  constraint participant_event_services_no_self_assignment check (
    source <> 'participant_preference' or status <> 'assigned'
  )
);

create unique index if not exists participant_event_services_one_per_event_participant_idx
  on public.participant_event_services(event_id, participant_id);

create index if not exists participant_event_services_service_status_idx
  on public.participant_event_services(event_id, service_id, status);

create index if not exists participant_event_services_registration_idx
  on public.participant_event_services(registration_id);

create trigger participant_event_services_set_updated_at
  before update on public.participant_event_services
  for each row execute function app.set_updated_at();

create or replace function app.event_service_matches_registration(
  target_event_id uuid,
  target_registration_id uuid,
  target_participant_id uuid,
  target_service_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    join public.event_services es on es.id = target_service_id
    where r.id = target_registration_id
      and r.event_id = target_event_id
      and r.participant_id = target_participant_id
      and es.event_id = target_event_id
  );
$$;

create or replace function app.can_manage_participant_event_service(
  target_registration_id uuid,
  target_participant_id uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    where r.id = target_registration_id
      and r.participant_id = target_participant_id
      and r.event_id = target_event_id
      and app.has_event_role(r.event_id, array['manager']::public.app_role[])
  )
  or exists (
    select 1
    from public.registrations r
    join public.participant_group_assignments pga on pga.registration_id = r.id
    join public.group_memberships gm on gm.group_id = pga.group_id
    where r.id = target_registration_id
      and r.participant_id = target_participant_id
      and r.event_id = target_event_id
      and pga.is_current
      and pga.status in ('probable', 'confirmed')
      and gm.user_id = auth.uid()
      and gm.role = 'capogruppo'
  );
$$;

alter table public.event_services enable row level security;
alter table public.participant_event_services enable row level security;

create policy "event services read scoped"
  on public.event_services for select
  using (
    is_active
    and exists (
      select 1
      from public.registrations r
      join public.participants p on p.id = r.participant_id
      where r.event_id = event_services.event_id
        and p.auth_user_id = auth.uid()
    )
    or app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
    or exists (
      select 1
      from public.groups g
      where g.event_id = event_services.event_id
        and app.is_group_leader(g.id)
    )
  );

create policy "event services manage managers"
  on public.event_services for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "participant event services read scoped"
  on public.participant_event_services for select
  using (
    app.can_read_participant(participant_id)
    or app.can_manage_participant_event_service(registration_id, participant_id, event_id)
  );

create policy "participant event services participant preference"
  on public.participant_event_services for insert
  with check (
    source = 'participant_preference'
    and status = 'preference_pending'
    and app.owns_registration(registration_id)
    and app.event_service_matches_registration(event_id, registration_id, participant_id, service_id)
    and exists (
      select 1
      from public.event_services es
      where es.id = service_id
        and es.is_active
    )
  );

create policy "participant event services manage operators"
  on public.participant_event_services for all
  using (
    app.can_manage_participant_event_service(registration_id, participant_id, event_id)
  )
  with check (
    app.can_manage_participant_event_service(registration_id, participant_id, event_id)
    and app.event_service_matches_registration(event_id, registration_id, participant_id, service_id)
    and source in ('manager', 'capogruppo')
  );

insert into public.event_services (event_id, label, description, public_order)
select e.id, seed.label, seed.description, seed.public_order
from public.events e
cross join (
  values
    ('Mobilità', 'Supporto a spostamenti, arrivi e indicazioni logistiche.', 10),
    ('Accoglienza', 'Accoglienza dei partecipanti e orientamento negli spazi.', 20),
    ('Biglietteria', 'Supporto a biglietti, accessi e flussi di ingresso.', 30),
    ('Assistenza ai panel', 'Supporto operativo nelle sale e durante i panel.', 40)
) as seed(label, description, public_order)
where e.is_current
on conflict do nothing;
