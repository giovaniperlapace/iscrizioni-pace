-- Register accompanying children as people linked to the parent's registration.
-- Event, registration status, group, attendance slots and QR/check-in are inherited
-- through registration_id so no duplicate contact, consent or assignment is needed.

create table public.registration_children (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  position smallint not null,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_children_position_check
    check (position between 1 and 10),
  constraint registration_children_first_name_check
    check (char_length(btrim(first_name)) between 1 and 120),
  constraint registration_children_last_name_check
    check (char_length(btrim(last_name)) between 1 and 120),
  unique (registration_id, position)
);

comment on table public.registration_children is
  'Accompanying children counted as registered people; event, status, group, attendance and check-in are inherited from the parent registration.';

create index registration_children_registration_id_idx
  on public.registration_children(registration_id);

create trigger registration_children_set_updated_at
  before update on public.registration_children
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.registration_children to authenticated;

alter table public.registration_children enable row level security;

create policy "registration children read scoped"
  on public.registration_children for select
  using (app.can_read_registration(registration_id));

create policy "registration children write owner or manager"
  on public.registration_children for all
  using (
    app.owns_registration(registration_id)
    or app.can_manage_registration(registration_id)
  )
  with check (
    app.owns_registration(registration_id)
    or app.can_manage_registration(registration_id)
  );
