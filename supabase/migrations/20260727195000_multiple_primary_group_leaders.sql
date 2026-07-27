-- A group can have more than one primary group leader.
-- This is required by the operational catalogue, where every listed contact
-- must receive the same primary group-leader access and notifications.

drop index if exists public.group_memberships_one_primary_per_group_idx;

create index if not exists group_memberships_primary_idx
  on public.group_memberships(group_id, is_primary);

comment on column public.group_memberships.is_primary is
  'Primary group-leader flag. Multiple primary leaders are allowed for the same group.';

notify pgrst, 'reload schema';
