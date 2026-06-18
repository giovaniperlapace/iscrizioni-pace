alter table public.group_registration_links
  add column if not exists token_encrypted text;

comment on column public.group_registration_links.token_encrypted is
  'Encrypted copy of the opaque group registration token, used only to show/copy active reserved links in operational dashboards.';
