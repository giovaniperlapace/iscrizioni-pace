begin;

-- Slugs are administrative public URLs, not credentials. Legacy encrypted
-- tokens remain readable by the application and are not rotated by this backfill.
alter table public.group_registration_links add column slug text;
create extension if not exists unaccent with schema extensions;

create function app.valid_group_link_slug(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$'
    and lower(value) not in ('api', 'auth', 'dashboard', 'login', 'registrazione');
$$;

alter table public.group_registration_links add constraint group_link_slug_valid
  check (slug is null or (app.valid_group_link_slug(slug)
    and token_hash = encode(extensions.digest(slug, 'sha256'), 'hex')));

-- A canonical link cannot expire, run out, or be removed while its group exists.
update public.group_registration_links set expires_at = null, max_uses = null
where is_canonical and (expires_at is not null or max_uses is not null);
alter table public.group_registration_links add constraint canonical_link_unlimited
  check (not is_canonical or (expires_at is null and max_uses is null));

create function app.protect_canonical_group_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_canonical and exists (select 1 from public.groups where id = old.group_id) then
    if tg_op = 'DELETE' then raise exception 'A canonical group link cannot be deleted'; end if;
    if not new.is_canonical or new.group_id <> old.group_id or new.event_id <> old.event_id then
      raise exception 'A canonical group link cannot be detached';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_canonical_group_link before delete or update
on public.group_registration_links for each row execute function app.protect_canonical_group_link();

create function app.ensure_group_registration_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  suffix text;
  sequence integer := 1;
  link_id uuid;
begin
  if not new.is_assignable then return new; end if;
  if exists (select 1 from public.group_registration_links where group_id = new.id and is_canonical) then
    return new;
  end if;
  base := trim(both '_' from regexp_replace(lower(extensions.unaccent(coalesce(nullif(new.public_label, ''), new.name))), '[^a-z0-9]+', '_', 'g'));
  if length(base) < 3 then base := 'gruppo' || case when base <> '' then '_' || base else '' end; end if;
  loop
    suffix := case when sequence = 1 then '' else '_' || sequence end;
    candidate := rtrim(left(base, 96 - length(suffix)), '_') || suffix;
    if app.valid_group_link_slug(candidate) then
      begin
        insert into public.group_registration_links(event_id, group_id, token_hash, slug, public_label, internal_label, created_by)
        values(new.event_id, new.id, encode(extensions.digest(candidate, 'sha256'), 'hex'), candidate,
          left(coalesce(nullif(new.public_label, ''), new.name), 120), left(new.name, 120), auth.uid())
        returning id into link_id;
        insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
        values(new.event_id, auth.uid(), 'group_registration_link.created', 'group_registration_links', link_id,
          jsonb_build_object('group_id', new.id, 'automatic', true, 'token_format', 'readable_slug'));
        return new;
      exception when unique_violation then
        -- Handles simultaneous creation and collisions with legacy token hashes.
        if exists (select 1 from public.group_registration_links where group_id = new.id and is_canonical) then return new; end if;
      end;
    end if;
    sequence := sequence + 1;
  end loop;
end;
$$;
create trigger ensure_group_registration_link after insert or update of is_assignable, name, public_label
on public.groups for each row execute function app.ensure_group_registration_link();

revoke all on function app.ensure_group_registration_link() from public;
revoke all on function app.protect_canonical_group_link() from public;

-- Includes assignable territorial nodes; purely structural nodes are excluded.
update public.groups g set is_assignable = g.is_assignable
where g.is_assignable and not exists (
  select 1 from public.group_registration_links l where l.group_id = g.id and l.is_canonical
);
commit;
