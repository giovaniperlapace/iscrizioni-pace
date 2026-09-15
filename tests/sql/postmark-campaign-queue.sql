-- Disposable database only. Run this fixture and then the migration, then assertions.
create role anon;
create role authenticated;
create role service_role;
create table public.email_campaigns(id uuid primary key, status text, sent_at timestamptz);
create table public.email_campaign_recipients(
  id uuid primary key, campaign_id uuid references email_campaigns(id),
  status text, scheduled_for date, attempted_on date, processing_started_at timestamptz,
  error_code text, created_at timestamptz default now()
);
