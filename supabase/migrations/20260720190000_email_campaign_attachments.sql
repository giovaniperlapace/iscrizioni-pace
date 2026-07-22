create table public.email_campaign_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  storage_path text not null unique,
  is_inline boolean not null default false,
  content_id text,
  created_at timestamptz not null default now(),
  check (length(trim(file_name)) between 1 and 180),
  check ((is_inline and content_id is not null) or (not is_inline and content_id is null))
);

create index email_campaign_attachments_campaign_idx
  on public.email_campaign_attachments(campaign_id, created_at);

alter table public.email_campaign_attachments enable row level security;

create policy "email campaign attachments read operational"
  on public.email_campaign_attachments for select
  using (
    exists (
      select 1
      from public.email_campaigns campaign
      where campaign.id = campaign_id
        and app.has_event_role(
          campaign.event_id,
          array['manager','manager_viewer']::public.app_role[]
        )
    )
  );

create policy "email campaign attachments manage managers"
  on public.email_campaign_attachments for all
  using (
    exists (
      select 1
      from public.email_campaigns campaign
      where campaign.id = campaign_id
        and app.has_event_role(
          campaign.event_id,
          array['manager']::public.app_role[]
        )
    )
  )
  with check (
    exists (
      select 1
      from public.email_campaigns campaign
      where campaign.id = campaign_id
        and app.has_event_role(
          campaign.event_id,
          array['manager']::public.app_role[]
        )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-campaign-attachments',
  'email-campaign-attachments',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
