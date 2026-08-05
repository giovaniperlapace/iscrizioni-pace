-- Run on staging after the P1 migration and fixture with psql -1. The final
-- deliberate error rolls back the temporary draft and role assignment.

insert into public.event_moments (
  event_id,
  title,
  moment_type,
  publication_status,
  is_public
)
select
  event.id,
  'P1 RLS rollback draft',
  'panel',
  'draft',
  false
from public.events event
where event.slug = 'assisi-2026-test';

insert into public.event_user_roles (event_id, user_id, role)
select
  event.id,
  auth_user.id,
  'manager_viewer'
from public.events event
join auth.users auth_user
  on auth_user.email = 'participant.panel.staging@example.invalid'
where event.slug = 'assisi-2026-test';

select set_config(
  'request.jwt.claim.sub',
  (
    select auth_user.id::text
    from auth.users auth_user
    where auth_user.email = 'participant.panel.staging@example.invalid'
  ),
  true
);

set local role authenticated;

do $$
declare
  visible_drafts integer;
begin
  select count(*) into visible_drafts
  from public.event_moments
  where title = 'P1 RLS rollback draft';

  if visible_drafts <> 1 then
    raise exception 'manager_viewer cannot read the panel draft';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare
  visible_drafts integer;
  visible_published integer;
begin
  select count(*) into visible_drafts
  from public.event_moments
  where title = 'P1 RLS rollback draft';

  select count(*) into visible_published
  from public.event_moments
  where moment_type = 'panel'
    and publication_status = 'published';

  if visible_drafts <> 0 then
    raise exception 'anonymous users can read a panel draft';
  end if;

  if visible_published <> 3 then
    raise exception 'anonymous users cannot read the three published fixtures';
  end if;
end;
$$;

reset role;

select 'panel_p1_rls_checks_ok';

-- Expected failure: psql -1 rolls the temporary data back.
select 1 / 0;
