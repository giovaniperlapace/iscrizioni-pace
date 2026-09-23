-- Explicit country-wide scope can stop inherited cities; legacy rows keep their semantics.
alter table public.groups add column city_scope text not null default 'inherit'
  check (city_scope in ('inherit','country'));
create table public.group_suggestion_cities (
  group_id uuid not null references public.groups(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  primary key (group_id,city_id)
);
create index group_suggestion_cities_city_idx on public.group_suggestion_cities(city_id);
alter table public.group_suggestion_cities enable row level security;
revoke all on public.group_suggestion_cities from public,anon,authenticated;
grant select on public.group_suggestion_cities to authenticated;
grant all on public.group_suggestion_cities to service_role;
create policy group_suggestion_cities_read on public.group_suggestion_cities for select to authenticated
  using (exists(select 1 from public.groups g where g.id=group_id));

-- Group settings, geography catalog additions and audit commit together.
-- No historical data rewrite, policy change or participant reassignment.
create or replace function public.save_operational_group(
  p_actor_user_id uuid, p_event_id uuid, p_group_id uuid,
  p_expected_updated_at timestamptz, p_values jsonb, p_geography jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target public.groups%rowtype;
  ancestor public.groups%rowtype;
  parent_id uuid := nullif(p_values->>'parent_group_id','')::uuid;
  node_kind text := p_values->>'node_type';
  community text := p_values->>'community_kind';
  group_name text := btrim(p_values->>'name');
  bands text[];
  direct_country uuid := nullif(p_geography->>'country_id','')::uuid;
  direct_city uuid := nullif(p_geography->>'city_id','')::uuid;
  inherited_country uuid;
  inherited_cities uuid[] := '{}';
  inherited_cities_resolved boolean := false;
  direct_cities uuid[] := '{}';
  old_cities uuid[] := '{}';
  city_item jsonb;
  city_items jsonb;
  requested_city_scope text := coalesce(p_geography->>'city_scope', 'inherit');
  effective_country uuid;
  effective_cities uuid[];
  cursor_id uuid := parent_id;
  seen uuid[] := array[]::uuid[];
  country_code text := p_geography->>'country_code';
  city_name text := btrim(p_geography->>'city_name');
  city_key text := p_geography->>'city_normalized_name';
  matches uuid[];
  before_row jsonb;
  saved_id uuid;
  rank integer;
  assignable boolean := coalesce((p_values->>'is_assignable')::boolean,false);
  visible boolean := coalesce((p_values->>'is_public_catalog')::boolean,false);
  active boolean := coalesce((p_values->>'is_active')::boolean,true);
begin
  if not exists(select 1 from public.event_user_roles where user_id=p_actor_user_id
    and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event_id))) then
    raise exception 'Group outside scope' using errcode='42501';
  end if;
  if not exists(select 1 from public.events where id=p_event_id) then
    raise exception 'Event unavailable' using errcode='22023';
  end if;
  -- Serializes hierarchy edits, including existing direct writes and group deletion.
  -- EXCLUSIVE also waits for row-locking lifecycle operations before taking
  -- the table lock, avoiding a lock-order inversion with group deletion.
  lock table public.groups in exclusive mode;
  if p_group_id is not null then
    select * into target from public.groups where id=p_group_id and event_id=p_event_id;
    if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
    if p_expected_updated_at is null or target.updated_at is distinct from p_expected_updated_at then
      raise exception 'Group changed' using errcode='PT409';
    end if;
    select coalesce(array_agg(city_id order by city_id),'{}') into old_cities from public.group_suggestion_cities where group_id=p_group_id;
    old_cities := array_remove(array_prepend(target.city_id,old_cities),null);
    before_row := to_jsonb(target) || jsonb_build_object('suggestion_city_ids',old_cities);
    seen := array[p_group_id];
  end if;
  if requested_city_scope not in ('inherit','country','cities') then raise exception 'Invalid city scope' using errcode='22023'; end if;
  if p_geography ? 'cities' then
    city_items := p_geography->'cities';
    if jsonb_typeof(city_items)<>'array' then raise exception 'Invalid cities' using errcode='22023'; end if;
    if jsonb_array_length(city_items)>100 or (requested_city_scope='cities' and jsonb_array_length(city_items)=0)
      or (requested_city_scope<>'cities' and jsonb_array_length(city_items)>0)
      or p_geography ? 'city_id' or p_geography ? 'city_name' then
      raise exception 'Invalid city selection' using errcode='22023';
    end if;
  else
    if p_geography ? 'city_scope' then raise exception 'Missing cities' using errcode='22023'; end if;
    -- An older client cannot silently discard a multi-city configuration.
    if cardinality(old_cities)>1 or target.city_scope='country' then
      raise exception 'Reload group editor' using errcode='PT409';
    end if;
    city_items := case when direct_city is not null or city_name is not null then jsonb_build_array(p_geography) else '[]'::jsonb end;
  end if;
  select coalesce(array_agg(distinct value),array[]::text[]) into bands
    from jsonb_array_elements_text(coalesce(p_values->'age_brackets','[]'::jsonb));
  if group_name is null or length(group_name)=0
    or node_kind is null or node_kind not in ('country','city','area','group','newcomers')
    or community is null or community not in ('territorial','santegidio','newcomers')
    or not (bands <@ array['giovani','adulti','anziani']) or p_geography is null then
    raise exception 'Invalid group values' using errcode='22023';
  end if;
  if node_kind='group' then assignable := true; end if;
  visible := visible and assignable;
  if (node_kind='country' and parent_id is not null)
    or (node_kind in ('city','area') and parent_id is null) then
    raise exception 'Invalid hierarchy' using errcode='PT422';
  end if;
  while cursor_id is not null loop
    if cursor_id=any(seen) then raise exception 'Hierarchy cycle' using errcode='PT422'; end if;
    seen := array_append(seen,cursor_id);
    select * into ancestor from public.groups where id=cursor_id and event_id=p_event_id and is_active;
    if not found then raise exception 'Parent unavailable' using errcode='PT422'; end if;
    if cursor_id=parent_id and ((node_kind='city' and ancestor.node_type<>'country') or (node_kind='area' and ancestor.node_type<>'city')) then
      raise exception 'Invalid parent type' using errcode='PT422';
    end if;
    if inherited_country is not null and ancestor.country_id is not null and inherited_country<>ancestor.country_id then
      raise exception 'Conflicting ancestor countries' using errcode='PT422';
    end if;
    inherited_country := coalesce(inherited_country,ancestor.country_id);
    if not inherited_cities_resolved then
      select array_remove(array_prepend(ancestor.city_id,coalesce(array_agg(city_id order by city_id),'{}')),null)
        into inherited_cities from public.group_suggestion_cities where group_id=ancestor.id;
      inherited_cities_resolved := cardinality(inherited_cities)>0 or ancestor.city_scope='country';
    end if;
    cursor_id := ancestor.parent_group_id;
  end loop;
  if direct_country is not null and country_code is not null then
    raise exception 'Ambiguous country' using errcode='22023';
  end if;
  if country_code is not null then
    if country_code !~ '^[A-Z]{2}$' or nullif(btrim(p_geography->>'country_name_it'),'') is null
      or nullif(btrim(p_geography->>'country_name_en'),'') is null then
      raise exception 'Invalid country' using errcode='22023';
    end if;
    insert into public.countries(iso2,name_it,name_en)
      values(country_code,p_geography->>'country_name_it',p_geography->>'country_name_en')
      on conflict(iso2) do nothing returning id into direct_country;
    if direct_country is not null then
      insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      values(p_event_id,p_actor_user_id,'country.created','countries',direct_country,jsonb_build_object('source','group_geography','iso2',country_code));
    else select id into direct_country from public.countries where iso2=country_code; end if;
  end if;
  if direct_country is not null and not exists(select 1 from public.countries where id=direct_country and (is_active or id=target.country_id)) then
    raise exception 'Country unavailable' using errcode='PT422';
  end if;
  if direct_country is not null and inherited_country is not null and direct_country<>inherited_country then
    raise exception 'Conflicting parent country' using errcode='PT422';
  end if;
  effective_country := coalesce(direct_country,inherited_country);
  for city_item in select value from jsonb_array_elements(city_items) loop
    if jsonb_typeof(city_item)<>'object' then raise exception 'Invalid city' using errcode='22023'; end if;
    direct_city := nullif(city_item->>'city_id','')::uuid;
    city_name := btrim(city_item->>'city_name');
    city_key := city_item->>'city_normalized_name';
    if direct_city is null and city_name is null then raise exception 'Empty city' using errcode='22023'; end if;
  if direct_city is not null and city_name is not null then raise exception 'Ambiguous city' using errcode='22023'; end if;
  if (direct_city is not null or city_name is not null) and effective_country is null then
    raise exception 'City needs country' using errcode='PT422';
  end if;
  if city_name is not null then
    if length(city_name) not between 2 and 120 or nullif(city_key,'') is null then
      raise exception 'Invalid city' using errcode='22023';
    end if;
    -- Reuse catalog identities even when older normalized_name values used a slug.
    select array_agg(id) into matches from public.cities where country_id=effective_country
      and (normalized_name=city_key or lower(regexp_replace(extensions.unaccent(btrim(name)),'\s+',' ','g'))=city_key);
    if cardinality(matches)>1 then raise exception 'Ambiguous city catalog' using errcode='PT422'; end if;
    direct_city := matches[1];
    if direct_city is null then
      insert into public.cities(country_id,name,normalized_name) values(effective_country,city_name,city_key)
        on conflict(country_id,normalized_name) do nothing returning id into direct_city;
      if direct_city is not null then
        insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
        values(p_event_id,p_actor_user_id,'city.created','cities',direct_city,jsonb_build_object('source','group_geography','country_id',effective_country,'name',city_name));
      else select id into direct_city from public.cities where country_id=effective_country and normalized_name=city_key; end if;
    end if;
  end if;
  if direct_city is not null and not exists(select 1 from public.cities where id=direct_city and country_id=effective_country and (is_active or id=any(old_cities))) then
    raise exception 'City outside country' using errcode='PT422';
  end if;
    if not direct_city=any(direct_cities) then direct_cities := array_append(direct_cities,direct_city); end if;
  end loop;
  -- A regional group has no single residence city. Keep existing assisted-entry
  -- consumers from assigning an arbitrary first city to a new participant.
  direct_city := case when cardinality(direct_cities)=1 then direct_cities[1] else null end;
  effective_cities := case when cardinality(direct_cities)>0 then direct_cities
    when requested_city_scope='country' then '{}'::uuid[] else inherited_cities end;
  if exists(select 1 from unnest(effective_cities) c(id) where not exists(select 1 from public.cities where cities.id=c.id and country_id=effective_country)) then
    raise exception 'Inherited city outside country' using errcode='PT422';
  end if;
  -- Validate the affected subtree using the proposed geography. A parent edit
  -- must not break public catalog loading for its existing descendants.
  if exists (
    with recursive subtree as (
      select g.id,g.node_type,coalesce(g.country_id,effective_country) as country_id,
        case when g.city_id is not null or exists(select 1 from public.group_suggestion_cities where group_id=g.id) then array_remove(array_prepend(g.city_id,array(select city_id from public.group_suggestion_cities where group_id=g.id)),null)
          when g.city_scope='country' then '{}'::uuid[] else effective_cities end as city_ids,array[g.id] as path,
        (g.country_id is not null and effective_country is not null and g.country_id<>effective_country)
        or g.event_id<>p_event_id or (g.node_type='city' and node_kind<>'country') or (g.node_type='area' and node_kind<>'city') or not active as invalid
      from public.groups g where g.parent_group_id=p_group_id and g.is_active
      union all
      select g.id,g.node_type,coalesce(g.country_id,s.country_id),case when g.city_id is not null or exists(select 1 from public.group_suggestion_cities where group_id=g.id) then array_remove(array_prepend(g.city_id,array(select city_id from public.group_suggestion_cities where group_id=g.id)),null)
          when g.city_scope='country' then '{}'::uuid[] else s.city_ids end,s.path||g.id,
        s.invalid or g.event_id<>p_event_id or (g.country_id is not null and s.country_id is not null and g.country_id<>s.country_id)
      from public.groups g join subtree s on g.parent_group_id=s.id where g.is_active and not g.id=any(s.path)
    ) select 1 from subtree s where invalid or exists(select 1 from unnest(s.city_ids) ids(id) where not exists(select 1 from public.cities c where c.id=ids.id and c.country_id=s.country_id))
  ) then raise exception 'Conflicting descendant geography' using errcode='PT422'; end if;
  if p_group_id is null then
    select coalesce(max(public_order),90)+10 into rank from public.groups where event_id=p_event_id and parent_group_id is not distinct from parent_id;
    insert into public.groups(event_id,name,public_label,parent_group_id,node_type,community_kind,age_brackets,is_assignable,is_public_catalog,is_active,public_order,country_id,city_id,city_scope)
    values(p_event_id,group_name,p_values->>'public_label',parent_id,node_kind,community,bands,assignable,visible,active,rank,direct_country,direct_city,case when requested_city_scope='country' then 'country' else 'inherit' end)
    returning id into saved_id;
  else
    update public.groups set name=group_name,public_label=p_values->>'public_label',parent_group_id=parent_id,node_type=node_kind,community_kind=community,age_brackets=bands,
      is_assignable=assignable,is_public_catalog=visible,is_active=active,country_id=direct_country,city_id=direct_city,city_scope=case when requested_city_scope='country' then 'country' else 'inherit' end,updated_at=clock_timestamp()
    where id=p_group_id returning id into saved_id;
  end if;
  delete from public.group_suggestion_cities where group_id=saved_id;
  insert into public.group_suggestion_cities(group_id,city_id)
    select saved_id,id from unnest(direct_cities) c(id) where id is distinct from direct_city;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    select p_event_id,p_actor_user_id,case when p_group_id is null then 'group.created' else 'group.updated' end,'groups',saved_id,
      jsonb_build_object('source','group_editor','before',before_row,'after',to_jsonb(g) || jsonb_build_object('suggestion_city_ids',direct_cities)) from public.groups g where id=saved_id;
  return saved_id;
end;
$$;
revoke all on function public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb) to service_role;
