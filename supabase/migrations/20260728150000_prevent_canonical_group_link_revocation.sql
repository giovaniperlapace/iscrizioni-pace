-- The single canonical group registration link must remain usable.
-- Historical non-canonical duplicates may retain their revoked state.

update public.group_registration_links
set
  revoked_at = null,
  revoked_by = null,
  updated_at = now()
where is_canonical
  and (revoked_at is not null or revoked_by is not null);

alter table public.group_registration_links
  add constraint group_registration_links_canonical_not_revoked
  check (
    not is_canonical
    or (revoked_at is null and revoked_by is null)
  );

comment on constraint group_registration_links_canonical_not_revoked
  on public.group_registration_links is
  'The single canonical reserved link for a group cannot be revoked.';
