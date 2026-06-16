-- Backfill test group tree data after 20260616103000 on already migrated databases.

with country_rows as (
  insert into public.countries (iso2, name_it, name_en)
  values ('AT', 'Austria', 'Austria')
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
)
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
  is_active = true;

with scope_rows as (
  select
    event.id as event_id,
    italy.id as italy_id,
    austria.id as austria_id,
    rome.id as rome_id,
    turin.id as turin_id
  from public.events event
  join public.countries italy on italy.iso2 = 'IT'
  join public.countries austria on austria.iso2 = 'AT'
  left join public.cities rome on rome.country_id = italy.id and rome.normalized_name = 'roma'
  left join public.cities turin on turin.country_id = italy.id and turin.normalized_name = 'torino'
  where event.slug = 'assisi-2026-test'
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
)
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
  is_active = true;

with parent_rows as (
  select event.id as event_id, rows.name, rows.parent_name
  from public.events event
  cross join (
    values
      ('Roma', 'Italia'),
      ('Roma Torrevecchia', 'Roma'),
      ('Roma - Giovani per la Pace', 'Roma'),
      ('Roma adulti', 'Roma'),
      ('Torino - Giovani per la Pace', 'Italia'),
      ('Nuovi partecipanti - Italia', 'Italia'),
      ('Nuovi partecipanti - Roma', 'Nuovi partecipanti - Italia')
  ) as rows(name, parent_name)
  where event.slug = 'assisi-2026-test'
)
update public.groups child
set parent_group_id = parent.id
from parent_rows
join public.groups parent
  on parent.event_id = parent_rows.event_id
 and parent.name = parent_rows.parent_name
where child.event_id = parent_rows.event_id
  and child.name = parent_rows.name;

with test_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
candidate_groups as (
  select g.id, g.event_id, g.name, g.country_id, g.city_id, g.age_bracket, g.public_order
  from public.groups g
  join test_event on test_event.id = g.event_id
  where g.is_assignable
    and g.community_kind = 'santegidio'
),
rule_rows as (
  select
    candidate_groups.event_id,
    candidate_groups.id as group_id,
    candidate_groups.country_id,
    candidate_groups.city_id,
    case candidate_groups.age_bracket when 'giovani' then 0 else null end as min_age,
    case candidate_groups.age_bracket when 'giovani' then 30 else null end as max_age,
    case candidate_groups.age_bracket when 'adulti' then 23 else null end as adults_min_age,
    candidate_groups.public_order as priority
  from candidate_groups
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
