-- Milestone 6.3: group tree, leader matching and territorial newcomers nodes.

alter table public.groups
  add column if not exists parent_group_id uuid references public.groups(id) on delete set null,
  add column if not exists node_type text not null default 'group'
    check (node_type in ('country', 'city', 'area', 'group', 'newcomers')),
  add column if not exists community_kind text not null default 'santegidio'
    check (community_kind in ('santegidio', 'newcomers', 'territorial')),
  add column if not exists age_bracket text not null default 'none'
    check (age_bracket in ('giovani', 'adulti', 'both', 'none')),
  add column if not exists is_assignable boolean not null default true,
  add column if not exists is_public_catalog boolean not null default true,
  add column if not exists public_order integer not null default 100,
  add column if not exists matching_notes text;

create index if not exists groups_parent_group_id_idx
  on public.groups(parent_group_id);

create index if not exists groups_event_country_city_idx
  on public.groups(event_id, country_id, city_id)
  where is_active;

create index if not exists groups_public_catalog_idx
  on public.groups(event_id, public_order, name)
  where is_active and is_public_catalog;

create table if not exists public.group_assignment_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  country_id uuid references public.countries(id) on delete cascade,
  city_id uuid references public.cities(id) on delete cascade,
  min_age integer check (min_age is null or min_age >= 0),
  max_age integer check (max_age is null or max_age >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_age is null or min_age is null or max_age >= min_age)
);

create index if not exists group_assignment_rules_event_id_idx
  on public.group_assignment_rules(event_id);

create index if not exists group_assignment_rules_group_id_idx
  on public.group_assignment_rules(group_id);

create index if not exists group_assignment_rules_scope_idx
  on public.group_assignment_rules(event_id, country_id, city_id, priority)
  where is_active;

create trigger group_assignment_rules_set_updated_at
  before update on public.group_assignment_rules
  for each row execute function app.set_updated_at();

alter table public.group_assignment_rules enable row level security;

drop policy if exists "groups public read active" on public.groups;

create policy "groups public read catalog"
  on public.groups for select
  using (
    (is_active and is_public_catalog)
    or app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
    or app.is_group_leader(id)
  );

create policy "group assignment rules read managers"
  on public.group_assignment_rules for select
  using (app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[]));

create policy "group assignment rules manage managers"
  on public.group_assignment_rules for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

alter table public.participant_group_assignments
  add column if not exists is_current boolean not null default true,
  add column if not exists assignment_reason text,
  add column if not exists escalated_from_group_id uuid references public.groups(id) on delete set null,
  add column if not exists escalation_depth integer not null default 0 check (escalation_depth >= 0),
  add column if not exists matcher_version text;

create unique index if not exists participant_group_assignments_current_unique
  on public.participant_group_assignments(registration_id)
  where is_current;

create index if not exists participant_group_assignments_current_group_idx
  on public.participant_group_assignments(group_id, is_current, status);

with test_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
country_rows as (
  insert into public.countries (iso2, name_it, name_en)
  values
    ('AT', 'Austria', 'Austria')
  on conflict (iso2) do update
  set
    name_it = excluded.name_it,
    name_en = excluded.name_en,
    is_active = true
  returning id, iso2
),
all_countries as (
  select id, iso2 from country_rows
  union
  select id, iso2 from public.countries where iso2 in ('IT', 'AT')
),
city_rows as (
  insert into public.cities (country_id, name, normalized_name)
  select all_countries.id, rows.name, rows.normalized_name
  from all_countries
  join (
    values
      ('IT', 'Torino', 'torino'),
      ('AT', 'Vienna', 'vienna')
  ) as rows(iso2, name, normalized_name) on rows.iso2 = all_countries.iso2
  on conflict (country_id, normalized_name) do update
  set
    name = excluded.name,
    is_active = true
  returning id, country_id, normalized_name
),
scope_rows as (
  select
    test_event.id as event_id,
    italy.id as italy_id,
    austria.id as austria_id,
    rome.id as rome_id,
    turin.id as turin_id
  from test_event
  join public.countries italy on italy.iso2 = 'IT'
  join public.countries austria on austria.iso2 = 'AT'
  left join public.cities rome on rome.country_id = italy.id and rome.normalized_name = 'roma'
  left join public.cities turin on turin.country_id = italy.id and turin.normalized_name = 'torino'
),
group_rows as (
  select *
  from scope_rows
  cross join lateral (
    values
      ('Italia', null::text, 'country', 'territorial', 'none', false, false, 10, scope_rows.italy_id, null::uuid, null::text),
      ('Roma', 'Italia', 'city', 'territorial', 'none', false, false, 20, scope_rows.italy_id, scope_rows.rome_id, null::text),
      ('Roma Torrevecchia', 'Roma', 'area', 'santegidio', 'both', true, true, 30, scope_rows.italy_id, scope_rows.rome_id, 'Referente Roma Torrevecchia'),
      ('Roma - Giovani per la Pace', 'Roma', 'group', 'santegidio', 'giovani', true, true, 40, scope_rows.italy_id, scope_rows.rome_id, 'Capogruppo test'),
      ('Roma adulti', 'Roma', 'group', 'santegidio', 'adulti', true, true, 50, scope_rows.italy_id, scope_rows.rome_id, 'Referente adulti Roma'),
      ('Torino - Giovani per la Pace', 'Italia', 'city', 'santegidio', 'giovani', true, true, 60, scope_rows.italy_id, scope_rows.turin_id, 'Referente Torino'),
      ('Austria', null::text, 'country', 'santegidio', 'both', true, true, 70, scope_rows.austria_id, null::uuid, 'Referente Austria'),
      ('Nuovi partecipanti - Italia', 'Italia', 'newcomers', 'newcomers', 'none', true, false, 900, scope_rows.italy_id, null::uuid, 'Coordinamento nuovi partecipanti Italia'),
      ('Nuovi partecipanti - Roma', 'Nuovi partecipanti - Italia', 'newcomers', 'newcomers', 'none', true, false, 910, scope_rows.italy_id, scope_rows.rome_id, 'Coordinamento nuovi partecipanti Roma'),
      ('Nuovi partecipanti - Austria', null::text, 'newcomers', 'newcomers', 'none', true, false, 920, scope_rows.austria_id, null::uuid, 'Coordinamento nuovi partecipanti Austria')
  ) as rows(name, parent_name, node_type, community_kind, age_bracket, is_assignable, is_public_catalog, public_order, country_id, city_id, primary_leader_name)
),
upserted_groups as (
  insert into public.groups (
    event_id,
    name,
    node_type,
    community_kind,
    age_bracket,
    is_assignable,
    is_public_catalog,
    public_order,
    country_id,
    city_id,
    primary_leader_name,
    public_notes,
    is_active
  )
  select
    event_id,
    name,
    node_type,
    community_kind,
    age_bracket,
    is_assignable,
    is_public_catalog,
    public_order,
    country_id,
    city_id,
    primary_leader_name,
    'Nodo creato o aggiornato dalla migration Milestone 6.3.',
    true
  from group_rows
  on conflict (event_id, name) do update
  set
    node_type = excluded.node_type,
    community_kind = excluded.community_kind,
    age_bracket = excluded.age_bracket,
    is_assignable = excluded.is_assignable,
    is_public_catalog = excluded.is_public_catalog,
    public_order = excluded.public_order,
    country_id = excluded.country_id,
    city_id = excluded.city_id,
    primary_leader_name = excluded.primary_leader_name,
    public_notes = excluded.public_notes,
    is_active = true
  returning id, event_id, name
)
update public.groups child
set parent_group_id = parent.id
from group_rows rows
join upserted_groups touched
  on touched.event_id = rows.event_id
 and touched.name = rows.name
join public.groups parent
  on parent.event_id = rows.event_id
 and parent.name = rows.parent_name
where child.event_id = rows.event_id
  and child.name = rows.name
  and rows.parent_name is not null;

with test_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
candidate_groups as (
  select g.id, g.event_id, g.name, g.country_id, g.city_id, g.age_bracket, g.public_order
  from public.groups g
  join test_event on test_event.id = g.event_id
  where g.is_assignable
),
rule_rows as (
  select
    candidate_groups.event_id,
    candidate_groups.id as group_id,
    candidate_groups.country_id,
    candidate_groups.city_id,
    case candidate_groups.age_bracket
      when 'giovani' then 0
      else null
    end as min_age,
    case candidate_groups.age_bracket
      when 'giovani' then 30
      else null
    end as max_age,
    case candidate_groups.age_bracket
      when 'adulti' then 23
      else null
    end as adults_min_age,
    candidate_groups.public_order as priority
  from candidate_groups
  where candidate_groups.name not like 'Nuovi partecipanti%'
)
insert into public.group_assignment_rules (
  event_id,
  group_id,
  country_id,
  city_id,
  min_age,
  max_age,
  priority,
  notes
)
select event_id, group_id, country_id, city_id, min_age, max_age, priority, 'Regola seed Milestone 6.3.'
from rule_rows
where adults_min_age is null
union all
select event_id, group_id, country_id, city_id, adults_min_age, null, priority, 'Regola seed Milestone 6.3.'
from rule_rows
where adults_min_age is not null
on conflict do nothing;

notify pgrst, 'reload schema';
