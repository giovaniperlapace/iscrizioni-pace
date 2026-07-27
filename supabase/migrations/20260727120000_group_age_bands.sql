-- Allow each group to target zero, one or more age bands.
-- An empty array means that the group has no age filter.

alter table public.groups
  add column if not exists age_brackets text[] not null default '{}'::text[];

alter table public.groups
  drop constraint if exists groups_age_brackets_allowed;

alter table public.groups
  add constraint groups_age_brackets_allowed
  check (
    age_brackets <@ array['giovani', 'adulti', 'anziani']::text[]
  );

update public.groups
set age_brackets = case age_bracket
  when 'giovani' then array['giovani']::text[]
  when 'adulti' then array['adulti', 'anziani']::text[]
  when 'both' then array['giovani', 'adulti', 'anziani']::text[]
  else '{}'::text[]
end
where cardinality(age_brackets) = 0;

comment on column public.groups.age_brackets is
  'Age bands used by public group matching. Empty means no age filter.';

notify pgrst, 'reload schema';
