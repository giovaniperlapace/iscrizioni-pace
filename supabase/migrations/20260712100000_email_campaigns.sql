create table public.email_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  subject text not null,
  body_text text not null,
  current_version integer not null default 1 check (current_version > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) between 1 and 80),
  check (length(trim(subject)) between 1 and 180),
  check (length(trim(body_text)) between 1 and 20000)
);

create unique index email_templates_event_name_unique
  on public.email_templates(event_id, lower(trim(name))) where is_active;
create index email_templates_event_updated_idx
  on public.email_templates(event_id, updated_at desc);
create trigger email_templates_set_updated_at before update on public.email_templates
  for each row execute function app.set_updated_at();

create table public.email_template_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  template_id uuid not null references public.email_templates(id) on delete cascade,
  version integer not null check (version > 0),
  subject text not null,
  body_text text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table public.email_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  template_version integer,
  name text not null,
  subject_template text not null,
  body_template text not null,
  status text not null default 'draft' check (status in ('draft','ready','sending','completed','partial','failed','cancelled')),
  filters_snapshot jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0 check (recipient_count between 0 and 100),
  test_sent_at timestamptz,
  test_sent_to_user_id uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) between 1 and 120),
  check (length(trim(subject_template)) between 1 and 180),
  check (length(trim(body_template)) between 1 and 20000)
);
create index email_campaigns_event_created_idx on public.email_campaigns(event_id, created_at desc);
create trigger email_campaigns_set_updated_at before update on public.email_campaigns
  for each row execute function app.set_updated_at();

create table public.email_campaign_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  delivery_kind text not null check (delivery_kind in ('direct','delegated')),
  delegate_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider_message_id text,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, participant_id)
);
create index email_campaign_recipients_campaign_status_idx
  on public.email_campaign_recipients(campaign_id, status);

alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

create policy "email templates read operational" on public.email_templates for select
  using (app.has_event_role(event_id, array['manager','manager_viewer']::public.app_role[]));
create policy "email templates manage managers" on public.email_templates for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));
create policy "email template versions read operational" on public.email_template_versions for select
  using (exists (select 1 from public.email_templates t where t.id = template_id and app.has_event_role(t.event_id, array['manager','manager_viewer']::public.app_role[])));
create policy "email template versions manage managers" on public.email_template_versions for all
  using (exists (select 1 from public.email_templates t where t.id = template_id and app.has_event_role(t.event_id, array['manager']::public.app_role[])))
  with check (exists (select 1 from public.email_templates t where t.id = template_id and app.has_event_role(t.event_id, array['manager']::public.app_role[])));
create policy "email campaigns read operational" on public.email_campaigns for select
  using (app.has_event_role(event_id, array['manager','manager_viewer']::public.app_role[]));
create policy "email campaigns manage managers" on public.email_campaigns for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));
create policy "email recipients read operational" on public.email_campaign_recipients for select
  using (exists (select 1 from public.email_campaigns c where c.id = campaign_id and app.has_event_role(c.event_id, array['manager','manager_viewer']::public.app_role[])));
create policy "email recipients manage managers" on public.email_campaign_recipients for all
  using (exists (select 1 from public.email_campaigns c where c.id = campaign_id and app.has_event_role(c.event_id, array['manager']::public.app_role[])))
  with check (exists (select 1 from public.email_campaigns c where c.id = campaign_id and app.has_event_role(c.event_id, array['manager']::public.app_role[])));
