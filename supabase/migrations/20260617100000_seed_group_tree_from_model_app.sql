-- Populate the operational group tree from the model app catalogue.
-- The tree follows Country -> City -> Area/Group. Only Roma has age-specific
-- areas for now; every other assignable city is available to both tracks.

alter table public.group_memberships
  add column if not exists is_primary boolean not null default false;

create unique index if not exists group_memberships_one_primary_per_group_idx
  on public.group_memberships(group_id)
  where is_primary;

create index if not exists group_memberships_primary_idx
  on public.group_memberships(group_id, is_primary);

with country_rows as (
  insert into public.countries (iso2, name_it, name_en)
  values
    ('AT', 'Austria', 'Austria'),
    ('BE', 'Belgio', 'Belgium'),
    ('DK', 'Danimarca', 'Denmark'),
    ('FR', 'Francia', 'France'),
    ('DE', 'Germania', 'Germany'),
    ('HU', 'Ungheria', 'Hungary'),
    ('IT', 'Italia', 'Italy'),
    ('PL', 'Polonia', 'Poland'),
    ('PT', 'Portogallo', 'Portugal'),
    ('RU', 'Federazione Russa', 'Russian Federation'),
    ('ES', 'Spagna', 'Spain'),
    ('UA', 'Ucraina', 'Ukraine')
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
  select id, iso2 from public.countries
  where iso2 in ('AT', 'BE', 'DK', 'FR', 'DE', 'HU', 'IT', 'PL', 'PT', 'RU', 'ES', 'UA')
)
insert into public.cities (country_id, name, normalized_name)
select all_countries.id, rows.name, rows.normalized_name
from all_countries
join (
  values
    ('AT', 'Innsbruck', 'innsbruck'),
    ('AT', 'Wien', 'wien'),
    ('BE', 'Antwerpen', 'antwerpen'),
    ('BE', 'Brussels', 'brussels'),
    ('DK', 'Copenaghen', 'copenaghen'),
    ('FR', 'Paris', 'paris'),
    ('DE', 'Berlin', 'berlin'),
    ('DE', 'Mönchengladbach', 'monchengladbach'),
    ('DE', 'München', 'munchen'),
    ('DE', 'Würzburg', 'wurzburg'),
    ('HU', 'Budapest', 'budapest'),
    ('HU', 'Pécs', 'pecs'),
    ('HU', 'Székesfehérvár', 'szekesfehervar'),
    ('IT', 'Bologna', 'bologna'),
    ('IT', 'Catania', 'catania'),
    ('IT', 'Foggia', 'foggia'),
    ('IT', 'Frosinone', 'frosinone'),
    ('IT', 'Lucca', 'lucca'),
    ('IT', 'Messina', 'messina'),
    ('IT', 'Milano', 'milano'),
    ('IT', 'Monterotondo', 'monterotondo'),
    ('IT', 'Napoli', 'napoli'),
    ('IT', 'Novara', 'novara'),
    ('IT', 'Padova', 'padova'),
    ('IT', 'Roma', 'roma'),
    ('IT', 'Sezze', 'sezze'),
    ('IT', 'Tivoli', 'tivoli'),
    ('IT', 'Torino', 'torino'),
    ('IT', 'Treviso', 'treviso'),
    ('IT', 'Trieste', 'trieste'),
    ('PL', 'Poznań', 'poznan'),
    ('PT', 'Lisbona', 'lisbona'),
    ('PT', 'Seixal', 'seixal'),
    ('RU', 'Moscow', 'moscow'),
    ('ES', 'Barcelona', 'barcelona'),
    ('ES', 'Madrid', 'madrid'),
    ('ES', 'Manresa', 'manresa'),
    ('UA', 'Lviv', 'lviv')
) as rows(iso2, name, normalized_name) on rows.iso2 = all_countries.iso2
on conflict (country_id, normalized_name) do update
set
  name = excluded.name,
  is_active = true;

with target_events as (
  select id
  from public.events
  where slug = 'assisi-2026-test'
),
country_nodes as (
  select
    target_events.id as event_id,
    countries.id as country_id,
    null::uuid as city_id,
    countries.name_it as name,
    null::text as parent_name,
    'country'::text as node_type,
    'territorial'::text as community_kind,
    'none'::text as age_bracket,
    false as is_assignable,
    false as is_public_catalog,
    row_number() over (order by countries.name_it) * 10 as public_order,
    null::text as primary_leader_name
  from target_events
  join public.countries countries
    on countries.iso2 in ('AT', 'BE', 'DK', 'FR', 'DE', 'HU', 'IT', 'PL', 'PT', 'RU', 'ES', 'UA')
),
city_nodes as (
  select
    country_nodes.event_id,
    country_nodes.country_id,
    cities.id as city_id,
    cities.name,
    country_nodes.name as parent_name,
    'city'::text as node_type,
    'santegidio'::text as community_kind,
    case when countries.iso2 = 'IT' and cities.normalized_name = 'roma'
      then 'none'::text
      else 'both'::text
    end as age_bracket,
    not (countries.iso2 = 'IT' and cities.normalized_name = 'roma') as is_assignable,
    not (countries.iso2 = 'IT' and cities.normalized_name = 'roma') as is_public_catalog,
    1000 + row_number() over (order by country_nodes.name, cities.name) * 10 as public_order,
    null::text as primary_leader_name
  from country_nodes
  join public.countries countries on countries.id = country_nodes.country_id
  join public.cities cities on cities.country_id = countries.id
  where not (countries.iso2 = 'IT' and cities.normalized_name = 'monterotondo')
),
rome_scope as (
  select
    target_events.id as event_id,
    countries.id as country_id,
    cities.id as city_id
  from target_events
  join public.countries countries on countries.iso2 = 'IT'
  join public.cities cities
    on cities.country_id = countries.id
   and cities.normalized_name = 'roma'
),
rome_area_nodes as (
  select
    rome_scope.event_id,
    rome_scope.country_id,
    rome_scope.city_id,
    rows.name,
    'Roma'::text as parent_name,
    'area'::text as node_type,
    'santegidio'::text as community_kind,
    rows.age_bracket,
    true as is_assignable,
    true as is_public_catalog,
    2000 + rows.public_order as public_order,
    rows.primary_leader_name
  from rome_scope
  cross join (
    values
      ('Movimento de Gli amici', 'adulti', 10, null::text),
      ('Monterotondo', 'adulti', 20, null::text),
      ('Pentecoste', 'adulti', 30, null::text),
      ('Resurrezione', 'adulti', 40, null::text),
      ('Resurrezione 68', 'adulti', 50, null::text),
      ('Sant''Andrea', 'adulti', 60, null::text),
      ('Sant''Egidio', 'adulti', 70, null::text),
      ('Seminario', 'both', 80, null::text),
      ('Universitari', 'giovani', 90, 'Stefano Orlando'),
      ('Europeans for Peace', 'adulti', 100, null::text),
      ('Giovani per la pace scuole superiori', 'giovani', 110, 'Laura Guida'),
      ('Giovani per la pace scuole medie', 'giovani', 120, 'Alessandro Natali'),
      ('Anziani Roma Centro', 'adulti', 130, null::text),
      ('Anziani Roma Est', 'adulti', 140, null::text),
      ('Anziani Roma Nord', 'adulti', 150, null::text),
      ('Anziani Roma Sud', 'adulti', 160, null::text),
      ('Anziani Roma Sud-Litorale', 'adulti', 170, null::text),
      ('Castelli Romani', 'adulti', 180, null::text),
      ('Roma CENTRO/MONTEVERDE/OVEST', 'adulti', 190, null::text),
      ('Roma Est', 'adulti', 200, null::text),
      ('Roma Nord', 'adulti', 210, null::text),
      ('Roma Sud', 'adulti', 220, null::text),
      ('Roma Sud-Litorale', 'adulti', 230, null::text),
      ('Assemblea di Trastevere', 'adulti', 240, null::text),
      ('Corridoi Umanitari', 'adulti', 250, null::text),
      ('Genti di Pace - Scuola', 'adulti', 260, null::text)
  ) as rows(name, age_bracket, public_order, primary_leader_name)
),
group_rows as (
  select * from country_nodes
  union all
  select * from city_nodes
  union all
  select * from rome_area_nodes
)
insert into public.groups (
  event_id,
  name,
  country_id,
  city_id,
  primary_leader_name,
  public_notes,
  is_active,
  parent_group_id,
  node_type,
  community_kind,
  age_bracket,
  is_assignable,
  is_public_catalog,
  public_order,
  matching_notes
)
select
  group_rows.event_id,
  group_rows.name,
  group_rows.country_id,
  group_rows.city_id,
  group_rows.primary_leader_name,
  'Nodo creato o aggiornato dal seed catalogo gruppi modello app.',
  true,
  null,
  group_rows.node_type,
  group_rows.community_kind,
  group_rows.age_bracket,
  group_rows.is_assignable,
  group_rows.is_public_catalog,
  group_rows.public_order,
  case
    when group_rows.node_type = 'area' then 'Area Roma da catalogo operativo.'
    when group_rows.is_assignable then 'Gruppo/citta da catalogo modello app; eta giovani/adulti.'
    else 'Nodo territoriale non selezionabile.'
  end
from group_rows
on conflict (event_id, name) do update
set
  country_id = excluded.country_id,
  city_id = excluded.city_id,
  primary_leader_name = excluded.primary_leader_name,
  public_notes = excluded.public_notes,
  is_active = true,
  node_type = excluded.node_type,
  community_kind = excluded.community_kind,
  age_bracket = excluded.age_bracket,
  is_assignable = excluded.is_assignable,
  is_public_catalog = excluded.is_public_catalog,
  public_order = excluded.public_order,
  matching_notes = excluded.matching_notes;

update public.groups child
set parent_group_id = parent.id
from public.groups parent
where child.event_id = parent.event_id
  and child.is_active
  and parent.is_active
  and (
    (
      child.node_type = 'city'
      and parent.node_type = 'country'
      and parent.country_id = child.country_id
    )
    or (
      child.node_type = 'area'
      and parent.node_type = 'city'
      and parent.country_id = child.country_id
      and parent.city_id = child.city_id
      and parent.name = 'Roma'
    )
  );

update public.groups legacy
set
  is_active = false,
  is_public_catalog = false,
  matching_notes = 'Nodo seed precedente disattivato dal catalogo gruppi modello app.'
from public.events event
where legacy.event_id = event.id
  and event.slug = 'assisi-2026-test'
  and legacy.name in (
    'Roma Torrevecchia',
    'Roma - Giovani per la Pace',
    'Roma adulti',
    'Torino - Giovani per la Pace',
    'Nuovi partecipanti - Italia',
    'Nuovi partecipanti - Roma',
    'Nuovi partecipanti - Austria'
  );

delete from public.group_assignment_rules
using public.events event
where group_assignment_rules.event_id = event.id
  and event.slug = 'assisi-2026-test'
  and group_assignment_rules.notes in (
    'Regola seed Milestone 6.3.',
    'Regola seed catalogo gruppi modello app.'
  );

with target_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
candidate_groups as (
  select
    groups.id,
    groups.event_id,
    groups.country_id,
    groups.city_id,
    groups.age_bracket,
    groups.public_order
  from public.groups groups
  join target_event on target_event.id = groups.event_id
  where groups.is_active
    and groups.is_assignable
    and groups.community_kind = 'santegidio'
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
select
  event_id,
  group_id,
  country_id,
  city_id,
  min_age,
  max_age,
  priority,
  'Regola seed catalogo gruppi modello app.'
from rule_rows
where adults_min_age is null
union all
select
  event_id,
  group_id,
  country_id,
  city_id,
  adults_min_age,
  null,
  priority,
  'Regola seed catalogo gruppi modello app.'
from rule_rows
where adults_min_age is not null;

notify pgrst, 'reload schema';
