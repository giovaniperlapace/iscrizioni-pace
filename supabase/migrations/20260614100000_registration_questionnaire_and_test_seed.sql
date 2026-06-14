create table public.registration_questionnaire_answers (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  questionnaire_version text not null,
  answers jsonb not null default '{}'::jsonb,
  visibility_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (registration_id, questionnaire_version)
);

create index registration_questionnaire_answers_registration_id_idx
  on public.registration_questionnaire_answers(registration_id);

create index registration_questionnaire_answers_event_id_idx
  on public.registration_questionnaire_answers(event_id);

alter table public.registration_questionnaire_answers enable row level security;

create policy "questionnaire answers read scoped"
  on public.registration_questionnaire_answers for select
  using (app.can_read_registration(registration_id));

create policy "questionnaire answers write owner or manager"
  on public.registration_questionnaire_answers for all
  using (app.can_manage_registration(registration_id) or app.owns_registration(registration_id))
  with check (app.can_manage_registration(registration_id) or app.owns_registration(registration_id));

insert into public.events (
  slug,
  title,
  city,
  country,
  starts_on,
  ends_on,
  status,
  default_locale,
  registration_opens_at,
  registration_closes_at
)
values (
  'assisi-2026-test',
  'Assisi 2026 - evento test',
  'Assisi',
  'Italia',
  date '2026-09-04',
  date '2026-09-06',
  'published',
  'it',
  timestamptz '2026-06-01 00:00:00+00',
  timestamptz '2026-09-01 23:59:59+00'
)
on conflict (slug) do update
set
  title = excluded.title,
  city = excluded.city,
  country = excluded.country,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  registration_opens_at = excluded.registration_opens_at,
  registration_closes_at = excluded.registration_closes_at;

insert into public.countries (iso2, name_it, name_en)
values
  ('IT', 'Italia', 'Italy'),
  ('GB', 'Regno Unito', 'United Kingdom'),
  ('US', 'Stati Uniti', 'United States')
on conflict (iso2) do update
set
  name_it = excluded.name_it,
  name_en = excluded.name_en,
  is_active = true;

with country_rows as (
  select id, iso2
  from public.countries
  where iso2 in ('IT', 'GB', 'US')
)
insert into public.cities (country_id, name, normalized_name)
select country_rows.id, city_rows.name, city_rows.normalized_name
from country_rows
join (
  values
    ('IT', 'Roma', 'roma'),
    ('IT', 'Assisi', 'assisi'),
    ('GB', 'London', 'london'),
    ('US', 'New York', 'new-york')
) as city_rows(iso2, name, normalized_name) on city_rows.iso2 = country_rows.iso2
on conflict (country_id, normalized_name) do update
set
  name = excluded.name,
  is_active = true;

with test_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
italy as (
  select id from public.countries where iso2 = 'IT'
),
rome as (
  select cities.id
  from public.cities
  join italy on italy.id = cities.country_id
  where cities.normalized_name = 'roma'
)
insert into public.groups (
  event_id,
  name,
  country_id,
  city_id,
  primary_leader_name,
  public_notes,
  is_active
)
select
  test_event.id,
  'Roma - Giovani per la Pace',
  italy.id,
  rome.id,
  'Capogruppo test',
  'Gruppo creato dalla migration di test Milestone 5.5.',
  true
from test_event, italy, rome
on conflict (event_id, name) do update
set
  country_id = excluded.country_id,
  city_id = excluded.city_id,
  primary_leader_name = excluded.primary_leader_name,
  public_notes = excluded.public_notes,
  is_active = true;

with test_event as (
  select id from public.events where slug = 'assisi-2026-test'
),
moment_rows as (
  select *
  from (
    values
      ('Accoglienza e registrazione', timestamptz '2026-09-04 14:00:00+02', timestamptz '2026-09-04 18:00:00+02'),
      ('Incontro internazionale', timestamptz '2026-09-05 10:00:00+02', timestamptz '2026-09-05 12:30:00+02'),
      ('Preghiera per la pace', timestamptz '2026-09-06 16:00:00+02', timestamptz '2026-09-06 18:00:00+02')
  ) as rows(title, starts_at, ends_at)
)
insert into public.event_moments (
  event_id,
  title,
  starts_at,
  ends_at,
  is_public,
  check_in_enabled
)
select
  test_event.id,
  moment_rows.title,
  moment_rows.starts_at,
  moment_rows.ends_at,
  true,
  true
from test_event, moment_rows
where not exists (
  select 1
  from public.event_moments existing
  where existing.event_id = test_event.id
    and existing.title = moment_rows.title
);

notify pgrst, 'reload schema';
