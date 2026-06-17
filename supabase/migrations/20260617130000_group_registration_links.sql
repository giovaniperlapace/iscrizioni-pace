-- Hidden assignable groups can receive registrations through revocable opaque links.

alter table public.groups
  add column if not exists public_label text;

comment on column public.groups.public_label is
  'Optional participant-facing label used when the operational group name is too sensitive or ambiguous.';

create table if not exists public.group_registration_links (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  token_hash text not null unique,
  public_label text,
  internal_label text,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (char_length(token_hash) = 64),
  check (public_label is null or char_length(public_label) <= 120),
  check (internal_label is null or char_length(internal_label) <= 120)
);

create index if not exists group_registration_links_event_id_idx
  on public.group_registration_links(event_id);

create index if not exists group_registration_links_group_id_idx
  on public.group_registration_links(group_id);

create index if not exists group_registration_links_active_idx
  on public.group_registration_links(event_id, group_id, created_at desc)
  where revoked_at is null;

create trigger group_registration_links_set_updated_at
  before update on public.group_registration_links
  for each row execute function app.set_updated_at();

alter table public.group_registration_links enable row level security;

create policy "group registration links read operational"
  on public.group_registration_links for select
  using (
    app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
    or app.is_group_leader(group_id)
  );

create policy "group registration links manage managers"
  on public.group_registration_links for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create policy "group registration links manage direct leaders"
  on public.group_registration_links for all
  using (app.is_group_leader(group_id))
  with check (app.is_group_leader(group_id));
