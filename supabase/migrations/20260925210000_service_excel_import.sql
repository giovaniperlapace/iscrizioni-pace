-- Receipts make retries safe even when the HTTP response is lost after commit.
create table public.service_import_runs (
  id uuid primary key,
  event_id uuid not null references public.events(id),
  actor_user_id uuid not null references auth.users(id),
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.service_import_runs enable row level security;
revoke all on public.service_import_runs from public, anon, authenticated;
grant select, insert on public.service_import_runs to service_role;

-- Conservative matching: preserve accents and punctuation, collapse whitespace.
create function app.service_import_key(p_value text) returns text
language sql immutable strict set search_path = pg_catalog as $$
  select lower(trim(regexp_replace(normalize(p_value, NFC), '[[:space:]]+', ' ', 'g')))
$$;
revoke all on function app.service_import_key(text) from public, anon, authenticated;

create function public.import_participant_services(
  p_import_id uuid, p_event_id uuid, p_actor_user_id uuid, p_rows jsonb
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_run public.service_import_runs%rowtype;
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_status text;
  v_registration uuid;
  v_participant uuid;
  v_service uuid;
  v_count integer;
  v_saved public.participant_event_services%rowtype;
  v_first text;
  v_last text;
  v_label text;
  v_error text;
  v_seen uuid[] := '{}'::uuid[];
  v_matches jsonb;
  v_match jsonb;
begin
  if p_import_id is null or p_actor_user_id is null or p_event_id is null then
    raise exception 'invalid import' using errcode = '22023';
  end if;
  perform set_config('lock_timeout','5s',true);
  perform 1 from public.events where id=p_event_id and is_current for share;
  if not found then raise exception 'event is not current' using errcode='42501'; end if;
  perform 1 from public.event_user_roles where user_id=p_actor_user_id and
    ((role='admin' and event_id is null) or (role='manager' and event_id=p_event_id)) for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid rows' using errcode='22023';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'invalid row count' using errcode='22023';
  end if;
  -- Do not trust payload shape even though only the server may call this RPC.
  if exists(select 1 from jsonb_array_elements(p_rows) r where
      jsonb_typeof(r) is distinct from 'object' or
      jsonb_typeof(r->'row') is distinct from 'number' or
      coalesce(r->>'row','') !~ '^[0-9]{1,3}$' or
      jsonb_typeof(r->'firstName') is distinct from 'string' or
      jsonb_typeof(r->'lastName') is distinct from 'string' or
      jsonb_typeof(r->'service') is distinct from 'string' or
      jsonb_typeof(r->'error') is distinct from 'string' or
      length(r->>'firstName')>200 or length(r->>'lastName')>200 or
      length(r->>'service')>200 or length(r->>'error')>500) then
    raise exception 'invalid row values' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'row')::int not between 2 and 501) or
     (select count(distinct r->>'row') from jsonb_array_elements(p_rows) r) <> jsonb_array_length(p_rows) then
    raise exception 'invalid row numbers' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('service-import:' || p_import_id::text, 0));
  select * into v_run from public.service_import_runs where id=p_import_id;
  if found then
    if v_run.event_id<>p_event_id or v_run.actor_user_id<>p_actor_user_id or v_run.payload_hash<>md5(p_rows::text) then
      raise exception 'import request changed' using errcode='PT409';
    end if;
    return jsonb_build_object('rows',v_run.result,'replayed',true);
  end if;
  -- A new namesake, deletion, rename or service edit cannot race the match.
  -- Short bounded batch; failure to acquire locks aborts without any writes.
  lock table public.participants, public.registrations, public.event_services in share mode;
  lock table public.participant_event_services in share row exclusive mode;
  -- Match the whole file in one pass instead of scanning all people per row.
  with requested as (
    select app.service_import_key(r->>'firstName') first_name,
      app.service_import_key(r->>'lastName') last_name,
      count(distinct app.service_import_key(r->>'service')) service_count
    from jsonb_array_elements(p_rows) r group by 1,2
  ), live as (
    select r.id,r.participant_id,app.service_import_key(p.first_name) first_name,
      app.service_import_key(p.last_name) last_name
    from public.registrations r join public.participants p on p.id=r.participant_id
    where r.event_id=p_event_id and r.deleted_at is null
  ), matches as (
    select requested.first_name,requested.last_name,requested.service_count,
      count(live.id) match_count,min(live.id::text) registration_id,min(live.participant_id::text) participant_id
    from requested left join live using(first_name,last_name) group by 1,2,3
  ) select jsonb_object_agg(jsonb_build_array(first_name,last_name)::text,
      jsonb_build_object('count',match_count,'services',service_count,'registration',registration_id,'participant',participant_id))
    into v_matches from matches;
  for v_row in select value from jsonb_array_elements(p_rows) order by (value->>'row')::int loop
    v_registration := null; v_participant := null; v_service := null;
    v_first := app.service_import_key(v_row->>'firstName');
    v_last := app.service_import_key(v_row->>'lastName');
    v_label := app.service_import_key(v_row->>'service');
    v_error := v_row->>'error';
    v_status := null;
    if v_error<>'' or v_first='' or v_last='' or v_label='' or
      length(v_row->>'firstName')>160 or length(v_row->>'lastName')>160 or length(v_row->>'service')>160 then
      v_status := 'invalid_row';
    else
      v_match := v_matches->jsonb_build_array(v_first,v_last)::text;
      v_count := (v_match->>'count')::int;
      v_registration := (v_match->>'registration')::uuid;
      v_participant := (v_match->>'participant')::uuid;
      if v_count=0 then v_status := 'not_found';
      elsif v_count<>1 then v_status := 'ambiguous'; v_registration := null;
      elsif (v_match->>'services')::int>1 then
        v_status := 'conflict';
      else
        select count(*),(array_agg(id))[1] into v_count,v_service from public.event_services
          where event_id=p_event_id and is_active and app.service_import_key(label)=v_label;
        if v_count<>1 then v_status := 'invalid_service';
        elsif v_participant=any(v_seen) then v_status := 'duplicate';
        else
          v_seen := array_append(v_seen,v_participant);
          select * into v_saved from public.participant_event_services
            where event_id=p_event_id and participant_id=v_participant;
          if found and v_saved.registration_id=v_registration and v_saved.service_id=v_service and v_saved.status='assigned' then
            v_status := 'unchanged';
          else
            insert into public.participant_event_services
              (event_id,registration_id,participant_id,service_id,status,source,assigned_at,decided_at,created_by,updated_by)
              values(p_event_id,v_registration,v_participant,v_service,'assigned','manager',now(),now(),p_actor_user_id,p_actor_user_id)
              on conflict(event_id,participant_id) do update set
                registration_id=excluded.registration_id,service_id=excluded.service_id,status='assigned',source='manager',
                assigned_at=excluded.assigned_at,decided_at=excluded.decided_at,proposed_at=null,updated_by=excluded.updated_by;
            -- Preserve participant/operator notes and original creator.
            insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
              values(p_event_id,p_actor_user_id,'participant.event_service_imported','registrations',v_registration,
                jsonb_build_object('import_id',p_import_id,'row',v_row->'row','service_id',v_service,
                  'previous_service_id',v_saved.service_id,'previous_status',v_saved.status));
            v_status := 'updated';
          end if;
        end if;
      end if;
    end if;
    v_result := v_result || jsonb_build_array(v_row || jsonb_build_object('status',v_status,'registrationId',v_registration));
  end loop;
  insert into public.service_import_runs(id,event_id,actor_user_id,payload_hash,result)
    values(p_import_id,p_event_id,p_actor_user_id,md5(p_rows::text),v_result);
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'services.imported','service_import_runs',p_import_id,
      jsonb_build_object('rows',jsonb_array_length(p_rows)));
  return jsonb_build_object('rows',v_result,'replayed',false);
end $$;
revoke all on function public.import_participant_services(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.import_participant_services(uuid,uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
