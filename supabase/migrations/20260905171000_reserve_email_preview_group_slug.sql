begin;
-- The development preview route is still reserved by Next.js in production
-- (where it returns 404), so it can never serve a group registration link.
create or replace function app.valid_group_link_slug(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$'
    and lower(value) not in ('api', 'auth', 'dashboard', 'login', 'registrazione', 'dev-email-preview');
$$;
commit;
