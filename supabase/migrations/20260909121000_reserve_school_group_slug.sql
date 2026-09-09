-- Keep group slugs distinct from the school route introduced on the panel branch.
create or replace function app.valid_group_link_slug(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$'
    and lower(value) not in ('api', 'auth', 'dashboard', 'login', 'registrazione', 'dev-email-preview', 'scuole');
$$;
