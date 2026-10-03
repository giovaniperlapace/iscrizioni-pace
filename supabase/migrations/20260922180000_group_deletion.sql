-- Group deletion milestone: preview, optimistic confirmation, scoped atomic audit.
-- Remove only group links; preserve people, accounts, registrations and QR. No data backfill.
begin;

-- Reserve removed tokens so recreating a same-named group cannot reactivate
-- an old distributed URL and silently assign people to a different group.
create table app.deleted_group_link_tokens (
  token_hash text primary key,
  deleted_at timestamptz not null default now()
);
revoke all on app.deleted_group_link_tokens from public, anon, authenticated;
grant usage on schema app to service_role;
grant select, insert on app.deleted_group_link_tokens to service_role;
create function app.reject_deleted_group_link_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from app.deleted_group_link_tokens where token_hash = new.token_hash) then
    raise exception 'Registration link token already used by a deleted group' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function app.reject_deleted_group_link_token() from public, anon, authenticated;
-- AFTER also sees a tombstone committed while uniqueness checks waited on DELETE.
create trigger reject_deleted_group_link_token after insert or update of token_hash
on public.group_registration_links for each row execute function app.reject_deleted_group_link_token();

create function public.manage_group_deletion(
  p_group_id uuid, p_actor_user_id uuid, p_delete boolean default false,
  p_expected text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  target public.groups%rowtype;
  memberships jsonb;
  links jsonb;
  rules jsonb;
  child_count bigint;
  assignment_count bigint;
  current_count bigint;
  assignments jsonb;
  fingerprint text;
  preview jsonb;
begin
  select * into target from public.groups where id = p_group_id for update;
  if not found then raise exception 'Group unavailable' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.event_user_roles where user_id = p_actor_user_id
    and ((role = 'admin' and event_id is null) or (role = 'manager' and event_id = target.event_id))) then
    raise exception 'Group outside scope' using errcode = '42501';
  end if;

  -- Lock existing dependents; the parent FOR UPDATE also serializes new FK references.
  perform 1 from public.group_memberships where group_id = target.id order by id for update;
  perform 1 from public.group_registration_links where group_id = target.id order by id for update;
  perform 1 from public.group_assignment_rules where group_id = target.id order by id for update;
  perform 1 from public.participant_group_assignments
    where group_id = target.id or escalated_from_group_id = target.id order by id for update;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]') into assignments
    from public.participant_group_assignments a where a.group_id = target.id or a.escalated_from_group_id = target.id;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') into memberships
    from public.group_memberships m where m.group_id = target.id;
  -- Never put credential hashes or encrypted legacy tokens in the audit/preview.
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'updated_at', l.updated_at) order by l.id), '[]') into links
    from public.group_registration_links l where l.group_id = target.id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') into rules
    from public.group_assignment_rules r where r.group_id = target.id;
  select count(*) into child_count from public.groups where parent_group_id = target.id;
  select count(*) into assignment_count from public.participant_group_assignments
    where group_id = target.id or escalated_from_group_id = target.id;
  select count(*) into current_count from public.participant_group_assignments where group_id = target.id and is_current;
  fingerprint := md5(jsonb_build_array(to_jsonb(target), memberships, links, rules, child_count, assignments)::text);
  preview := jsonb_build_object('name', target.name, 'expected', fingerprint,
    'children', child_count, 'assignments', assignment_count, 'currentAssignments', current_count,
    'memberships', jsonb_array_length(memberships), 'links', jsonb_array_length(links),
    'rules', jsonb_array_length(rules));
  if not p_delete then return preview; end if;
  if p_expected is distinct from fingerprint then
    raise exception 'Group changed; reload confirmation' using errcode = 'PT409';
  end if;
  if child_count > 0 then raise exception 'Group has children' using errcode = 'P0003'; end if;

  insert into app.deleted_group_link_tokens(token_hash)
    select token_hash from public.group_registration_links where group_id = target.id
    on conflict (token_hash) do nothing;
  delete from public.groups where id = target.id;
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(target.event_id, p_actor_user_id, 'group.deleted', 'groups', target.id,
      jsonb_build_object('before', to_jsonb(target), 'memberships', memberships,
        'links', links, 'rules', rules, 'assignments', assignments, 'after', null));
  return jsonb_build_object('deleted', true);
end;
$$;
revoke all on function public.manage_group_deletion(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.manage_group_deletion(uuid, uuid, boolean, text) to service_role;
-- Authenticated callers must go through the scoped, audited operation.
-- Existing SELECT/INSERT/UPDATE privileges and policies are unchanged.
revoke delete on public.groups from anon, authenticated;
notify pgrst, 'reload schema';
commit;
