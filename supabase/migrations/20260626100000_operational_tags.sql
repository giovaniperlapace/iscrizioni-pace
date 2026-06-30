create table if not exists public.operational_tags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  color text not null default '#0f5f8f',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_tags_label_not_blank check (length(trim(label)) > 0),
  constraint operational_tags_label_length check (char_length(label) <= 40),
  constraint operational_tags_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists operational_tags_event_label_unique
  on public.operational_tags(event_id, lower(trim(label)));

create index if not exists operational_tags_event_id_idx
  on public.operational_tags(event_id, label);

create trigger operational_tags_set_updated_at
  before update on public.operational_tags
  for each row execute function app.set_updated_at();

alter table public.operational_tags enable row level security;

create policy "operational tags read operational"
  on public.operational_tags for select
  using (
    app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
    or exists (
      select 1
      from public.groups g
      where g.event_id = operational_tags.event_id
        and app.is_group_leader(g.id)
    )
  );

create policy "operational tags manage managers"
  on public.operational_tags for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));

create table if not exists public.participant_operational_tags (
  participant_id uuid not null references public.participants(id) on delete cascade,
  tag_id uuid not null references public.operational_tags(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (participant_id, tag_id)
);

create index if not exists participant_operational_tags_tag_id_idx
  on public.participant_operational_tags(tag_id);

alter table public.participant_operational_tags enable row level security;

create or replace function app.can_assign_participant_tag(
  target_participant_id uuid,
  target_tag_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from public.operational_tags ot
    where ot.id = target_tag_id
      and app.has_event_role(ot.event_id, array['manager']::public.app_role[])
      and exists (
        select 1
        from public.registrations r
        where r.participant_id = target_participant_id
          and r.event_id = ot.event_id
      )
  )
  or exists (
    select 1
    from public.operational_tags ot
    join public.registrations r on r.participant_id = target_participant_id
      and r.event_id = ot.event_id
    join public.participant_group_assignments pga on pga.registration_id = r.id
    join public.group_memberships gm on gm.group_id = pga.group_id
    where ot.id = target_tag_id
      and pga.is_current
      and gm.user_id = auth.uid()
      and gm.role = 'capogruppo'
  );
$$;

create policy "participant operational tags read scoped"
  on public.participant_operational_tags for select
  using (
    app.can_read_participant(participant_id)
    or app.can_assign_participant_tag(participant_id, tag_id)
  );

create policy "participant operational tags assign managers or leaders"
  on public.participant_operational_tags for insert
  with check (app.can_assign_participant_tag(participant_id, tag_id));

create policy "participant operational tags remove managers or leaders"
  on public.participant_operational_tags for delete
  using (app.can_assign_participant_tag(participant_id, tag_id));
