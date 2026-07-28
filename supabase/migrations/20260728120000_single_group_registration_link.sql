-- A group can have only one reserved registration link for its lifetime.
-- Existing duplicates remain as non-canonical audit history and are revoked;
-- only one canonical link is exposed by the dashboards.

alter table public.group_registration_links
  add column if not exists is_canonical boolean not null default true;

with ranked_links as (
  select
    id,
    row_number() over (
      partition by event_id, group_id
      order by
        case when revoked_at is null then 0 else 1 end,
        created_at desc,
        id desc
    ) as position
  from public.group_registration_links
)
update public.group_registration_links as links
set
  is_canonical = ranked_links.position = 1,
  revoked_at = case
    when ranked_links.position = 1 then links.revoked_at
    else coalesce(links.revoked_at, now())
  end,
  updated_at = now()
from ranked_links
where links.id = ranked_links.id;

create unique index if not exists group_registration_links_one_per_group_idx
  on public.group_registration_links(event_id, group_id)
  where is_canonical;

comment on column public.group_registration_links.is_canonical is
  'True only for the single reserved registration link belonging to a group; false is retained solely for pre-constraint duplicate history.';

comment on index public.group_registration_links_one_per_group_idx is
  'Allows at most one canonical reserved registration link for each event group, including after revocation.';

create or replace function app.force_canonical_group_registration_link()
returns trigger
language plpgsql
set search_path = public, app, extensions
as $$
begin
  new.is_canonical := true;
  return new;
end;
$$;

drop trigger if exists group_registration_links_force_canonical
  on public.group_registration_links;

create trigger group_registration_links_force_canonical
  before insert on public.group_registration_links
  for each row execute function app.force_canonical_group_registration_link();
