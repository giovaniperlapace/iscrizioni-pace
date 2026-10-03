-- Group settings, geography catalog additions and audit commit together.
-- No historical data rewrite, policy change or participant reassignment.
create function public.save_operational_group(
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
  inherited_city uuid;
  effective_country uuid;
  effective_city uuid;
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
    before_row := to_jsonb(target);
    seen := array[p_group_id];
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
    inherited_city := coalesce(inherited_city,ancestor.city_id);
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
  if direct_city is not null and not exists(select 1 from public.cities where id=direct_city and country_id=effective_country and (is_active or id=target.city_id)) then
    raise exception 'City outside country' using errcode='PT422';
  end if;
  effective_city := coalesce(direct_city,inherited_city);
  if effective_city is not null and not exists(select 1 from public.cities where id=effective_city and country_id=effective_country) then
    raise exception 'Inherited city outside country' using errcode='PT422';
  end if;
  -- Validate the affected subtree using the proposed geography. A parent edit
  -- must not break public catalog loading for its existing descendants.
  if exists (
    with recursive subtree as (
      select g.id,g.node_type,coalesce(g.country_id,effective_country) as country_id,
        coalesce(g.city_id,effective_city) as city_id,array[g.id] as path,
        (g.country_id is not null and effective_country is not null and g.country_id<>effective_country)
        or g.event_id<>p_event_id or (g.node_type='city' and node_kind<>'country') or (g.node_type='area' and node_kind<>'city') or not active as invalid
      from public.groups g where g.parent_group_id=p_group_id and g.is_active
      union all
      select g.id,g.node_type,coalesce(g.country_id,s.country_id),coalesce(g.city_id,s.city_id),s.path||g.id,
        s.invalid or g.event_id<>p_event_id or (g.country_id is not null and s.country_id is not null and g.country_id<>s.country_id)
      from public.groups g join subtree s on g.parent_group_id=s.id where g.is_active and not g.id=any(s.path)
    ) select 1 from subtree s where invalid or (s.city_id is not null and not exists(select 1 from public.cities c where c.id=s.city_id and c.country_id=s.country_id))
  ) then raise exception 'Conflicting descendant geography' using errcode='PT422'; end if;
  if p_group_id is null then
    select coalesce(max(public_order),90)+10 into rank from public.groups where event_id=p_event_id and parent_group_id is not distinct from parent_id;
    insert into public.groups(event_id,name,public_label,parent_group_id,node_type,community_kind,age_brackets,is_assignable,is_public_catalog,is_active,public_order,country_id,city_id)
    values(p_event_id,group_name,p_values->>'public_label',parent_id,node_kind,community,bands,assignable,visible,active,rank,direct_country,direct_city)
    returning id into saved_id;
  else
    update public.groups set name=group_name,public_label=p_values->>'public_label',parent_group_id=parent_id,node_type=node_kind,community_kind=community,age_brackets=bands,
      is_assignable=assignable,is_public_catalog=visible,is_active=active,country_id=direct_country,city_id=direct_city,updated_at=clock_timestamp()
    where id=p_group_id returning id into saved_id;
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    select p_event_id,p_actor_user_id,case when p_group_id is null then 'group.created' else 'group.updated' end,'groups',saved_id,
      jsonb_build_object('source','group_editor','before',before_row,'after',to_jsonb(g)) from public.groups g where id=saved_id;
  return saved_id;
end;
$$;
revoke all on function public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb) to service_role;
