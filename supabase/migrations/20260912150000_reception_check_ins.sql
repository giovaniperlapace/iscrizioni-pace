-- P11: real event attendance. Panel entry remains outside this RPC (P13).
begin;

alter table public.registrations add column check_in_revision integer not null default 0;
alter table public.school_bookings add column check_in_revision integer not null default 0;
alter table public.registration_children add constraint registration_children_id_registration_unique unique(id, registration_id);
alter table public.check_ins
  alter column registration_id drop not null,
  add column child_id uuid,
  add column school_booking_id uuid references public.school_bookings(id) on delete restrict,
  add column student_count integer,
  add column companion_count integer,
  add column cancelled_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references auth.users(id) on delete set null,
  add constraint check_ins_child_registration_fk foreign key(child_id,registration_id)
    references public.registration_children(id,registration_id) on delete restrict,
  add constraint check_ins_subject_check check (
    (registration_id is not null and school_booking_id is null and student_count is null and companion_count is null)
    or (registration_id is null and child_id is null and school_booking_id is not null
      and student_count is not null and companion_count is not null
      and student_count between 0 and 1000 and companion_count between 0 and 100
      and student_count + companion_count > 0 and moment_id is null)
  );
-- Legacy rows continue to represent the adult only, never the whole family.
drop index public.check_ins_registration_event_general_unique;
drop index public.check_ins_registration_event_moment_unique;
create unique index check_ins_registration_event_general_unique on public.check_ins(registration_id,event_id)
  where moment_id is null and child_id is null and registration_id is not null;
create unique index check_ins_registration_event_moment_unique on public.check_ins(registration_id,event_id,moment_id)
  where moment_id is not null and child_id is null and registration_id is not null;
create unique index check_ins_child_event_general_unique on public.check_ins(child_id,event_id)
  where moment_id is null and child_id is not null;
create unique index check_ins_child_event_moment_unique on public.check_ins(child_id,event_id,moment_id)
  where moment_id is not null and child_id is not null;
create unique index check_ins_school_event_unique on public.check_ins(school_booking_id,event_id)
  where school_booking_id is not null;

create or replace function app.ensure_check_in_event_scope() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.registration_id is not null then
    perform 1 from public.registrations where id=new.registration_id and event_id=new.event_id;
  else
    perform 1 from public.school_bookings where id=new.school_booking_id and event_id=new.event_id;
  end if;
  if not found then raise check_violation using message='Check-in event mismatch'; end if;
  if new.moment_id is not null and not exists(select 1 from public.event_moments where id=new.moment_id and event_id=new.event_id) then
    raise check_violation using message='Check-in moment mismatch';
  end if;
  if new.location_id is not null and not exists(select 1 from public.event_locations where id=new.location_id and event_id=new.event_id) then
    raise check_violation using message='Check-in location mismatch';
  end if;
  return new;
end $$;
drop trigger check_in_requires_operational_registration on public.check_ins;
create trigger check_in_requires_operational_registration before insert or update on public.check_ins
  for each row when (new.registration_id is not null) execute function app.require_operational_registration();

-- Reception uses the minimal RPC response, not unrestricted token/check-in rows.
drop policy "qr tokens read operational" on public.qr_tokens;
create policy "qr tokens read operational" on public.qr_tokens for select
  using (app.can_manage_registration(registration_id));
drop policy "check ins read scoped" on public.check_ins;
create policy "check ins read scoped" on public.check_ins for select using (
  app.has_event_role(event_id,array['manager','manager_viewer']::public.app_role[])
  or (registration_id is not null and app.can_read_registration(registration_id))
);
drop policy "only operational registrations" on public.check_ins;
create policy "only operational registrations" on public.check_ins as restrictive for all to authenticated
  using (registration_id is null or app.registration_is_operational(registration_id))
  with check (registration_id is null or app.registration_is_operational(registration_id));
drop policy "check ins insert accoglienza or manager" on public.check_ins;
drop policy "check ins update managers" on public.check_ins;
revoke insert,update,delete on public.check_ins from anon,authenticated;

-- No QR, names or request bodies are stored here. A digest detects changed retries.
create table public.check_in_requests (
  request_id uuid primary key,
  event_id uuid not null references public.events(id),
  actor_user_id uuid not null references auth.users(id),
  fingerprint text not null,
  created_at timestamptz not null default now()
);
alter table public.check_in_requests enable row level security;
revoke all on public.check_in_requests from anon,authenticated;
grant select,insert on public.check_in_requests to service_role;

create function public.reception_check_in(
  p_event_id uuid, p_actor_user_id uuid, p_lookup_kind text, p_lookup text,
  p_action text default 'inspect', p_request_id uuid default null,
  p_subject_ids uuid[] default '{}', p_students integer default null,
  p_companions integer default null, p_expected_revision integer default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.registrations; b public.school_bookings; q record;
  target_id uuid; school boolean := false; person uuid; ci public.check_ins;
  revision integer; changed integer := 0; replay boolean := false;
  fingerprint text; previous_request public.check_in_requests;
  v_source text; outcome text := 'verified'; persons jsonb; result jsonb; before_state jsonb; after_state jsonb;
begin
  -- Authenticate the SERVER-supplied actor again and hold the role until commit.
  perform 1 from public.event_user_roles where user_id=p_actor_user_id
    and ((role='admin' and event_id is null) or (role in ('manager','accoglienza') and event_id=p_event_id)) for share;
  if not found then raise insufficient_privilege using message='Reception forbidden'; end if;
  perform 1 from public.events where id=p_event_id and is_current for share;
  if not found then raise insufficient_privilege using message='Reception event unavailable'; end if;
  if p_action is null or p_action not in ('inspect','enter','correct','cancel')
    or p_lookup_kind is null or p_lookup_kind not in ('qr','code')
    or (p_reason is not null and p_reason not in ('selection_error','count_error','entry_cancelled'))
    or p_lookup is null or (p_lookup_kind='qr' and p_lookup !~ '^[a-f0-9]{64}$')
    or (p_lookup_kind='code' and p_lookup !~ '^[A-Z0-9]{4}$') then
    raise invalid_parameter_value using message='Invalid reception request';
  end if;
  v_source := case when p_lookup_kind='qr' then 'qr_scan' else 'manual' end;
  -- Parent first, then token locks: same order as cancellation/revocation flows.
  if p_lookup_kind='qr' then
    select registration_id into target_id from public.qr_tokens where token_hash=p_lookup;
    if target_id is null then
      select booking_id into target_id from public.school_booking_qr_tokens where token_hash=p_lookup;
      school := true;
    elsif exists(select 1 from public.school_booking_qr_tokens where token_hash=p_lookup) then
      target_id := null; -- Ambiguous token namespaces fail closed.
    end if;
  else
    select reg.id into target_id from public.registrations reg join public.participants p on p.id=reg.participant_id
      where p.public_code=p_lookup and reg.event_id=p_event_id;
  end if;
  if school then
    select * into b from public.school_bookings where id=target_id and event_id=p_event_id for update;
    if not found or b.status not in ('submitted','confirmed') then target_id:=null; end if;
    revision := b.check_in_revision;
  else
    select * into r from public.registrations where id=target_id and event_id=p_event_id for update;
    if not found or r.deleted_at is not null or r.cancelled_at is not null or r.status not in ('submitted','confirmed') then target_id:=null; end if;
    revision := r.check_in_revision;
  end if;
  if target_id is not null and p_lookup_kind='qr' then
    if school then
      select id,status,revoked_at,expires_at,token_hash into q from public.school_booking_qr_tokens
        where booking_id=target_id order by created_at desc,id desc limit 1 for share;
    else
      select id,status,revoked_at,expires_at,token_hash into q from public.qr_tokens
        where registration_id=target_id order by created_at desc,id desc limit 1 for share;
    end if;
    if not found or q.token_hash<>p_lookup or q.status<>'active' or q.revoked_at is not null
      or (q.expires_at is not null and q.expires_at<=clock_timestamp()) then target_id:=null; end if;
  end if;
  if target_id is null then
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,metadata)
      values(p_event_id,p_actor_user_id,'reception.invalid','check_ins',jsonb_build_object('source',v_source));
    return jsonb_build_object('status','invalid');
  end if;

  if p_action<>'inspect' then
    if p_request_id is null or p_subject_ids is null or cardinality(p_subject_ids)>11
      or (p_action in ('correct','cancel') and (p_expected_revision is null or p_expected_revision<0
        or p_reason is null or p_reason not in ('selection_error','count_error','entry_cancelled'))) then
      raise invalid_parameter_value using message='Explicit correction and request identity required';
    end if;
    fingerprint := encode(sha256(convert_to(jsonb_build_array(p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,
      p_action,p_subject_ids,p_students,p_companions,p_expected_revision,p_reason)::text,'UTF8')),'hex');
    -- Global key lock also serializes accidental reuse across different subjects.
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,11));
    select * into previous_request from public.check_in_requests where request_id=p_request_id;
    if found then
      if previous_request.fingerprint<>fingerprint then
        raise invalid_parameter_value using message='Request identity already used';
      end if;
      replay := true;
      outcome := 'replayed';
    elsif p_action in ('correct','cancel') and p_expected_revision<>revision then
      return jsonb_build_object('status','conflict');
    end if;
  end if;

  if p_action<>'inspect' and not replay then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'student_count',student_count,'companion_count',companion_count)), '[]') into before_state
      from public.check_ins where event_id=p_event_id and moment_id is null
        and (registration_id=target_id or school_booking_id=target_id);
    if school then
      if cardinality(p_subject_ids)<>0 or (p_action<>'cancel' and
        (p_students is null or p_companions is null or p_students<0 or p_companions<0
        or p_students>b.student_count or p_companions>b.companion_count or p_students+p_companions=0)) then
        raise invalid_parameter_value using message='Invalid school attendance counts';
      end if;
      select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id for update;
      if p_action='cancel' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where id=ci.id and cancelled_at is null;
        get diagnostics changed=row_count;
      elsif ci.id is null then
        insert into public.check_ins(event_id,school_booking_id,student_count,companion_count,checked_in_by,updated_by,source)
          values(p_event_id,target_id,p_students,p_companions,p_actor_user_id,p_actor_user_id,v_source);
        changed:=1;
      elsif ci.cancelled_at is not null or (p_action='correct' and (ci.student_count<>p_students or ci.companion_count<>p_companions)) then
        update public.check_ins set student_count=p_students,companion_count=p_companions,cancelled_at=null,
          checked_in_at=case when cancelled_at is not null then clock_timestamp() else checked_in_at end,
          checked_in_by=case when cancelled_at is not null then p_actor_user_id else checked_in_by end,
          updated_at=clock_timestamp(),updated_by=p_actor_user_id,source=v_source where id=ci.id;
        changed:=1;
      end if;
    else
      -- Child rows cannot disappear between validation and persistence.
      perform 1 from public.registration_children where registration_id=target_id order by id for share;
      if p_students is not null or p_companions is not null or cardinality(p_subject_ids)=0
        or array_position(p_subject_ids,null) is not null
        or cardinality(p_subject_ids)<>(select count(distinct x) from unnest(p_subject_ids) x)
        or exists(select 1 from unnest(p_subject_ids) x where x<>target_id and not exists(
          select 1 from public.registration_children where id=x and registration_id=target_id)) then
        raise invalid_parameter_value using message='Invalid family selection';
      end if;
      if p_action='correct' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where registration_id=target_id and moment_id is null and cancelled_at is null
            and not(coalesce(child_id,registration_id)=any(p_subject_ids));
        get diagnostics changed=row_count;
      end if;
      foreach person in array p_subject_ids loop
        ci:=null;
        select * into ci from public.check_ins where registration_id=target_id and moment_id is null
          and coalesce(child_id,registration_id)=person for update;
        if p_action='cancel' then
          if ci.id is not null and ci.cancelled_at is null then
            update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id where id=ci.id;
            changed:=changed+1;
          end if;
        elsif ci.id is null then
          insert into public.check_ins(registration_id,event_id,child_id,checked_in_by,updated_by,source)
            values(target_id,p_event_id,case when person=target_id then null else person end,p_actor_user_id,p_actor_user_id,v_source);
          changed:=changed+1;
        elsif ci.cancelled_at is not null then
          update public.check_ins set cancelled_at=null,checked_in_at=clock_timestamp(),checked_in_by=p_actor_user_id,
            updated_at=clock_timestamp(),updated_by=p_actor_user_id,source=v_source where id=ci.id;
          changed:=changed+1;
        end if;
      end loop;
    end if;
    if changed>0 then
      if school then update public.school_bookings set check_in_revision=check_in_revision+1 where id=target_id returning check_in_revision into revision;
      else update public.registrations set check_in_revision=check_in_revision+1 where id=target_id returning check_in_revision into revision; end if;
    end if;
    outcome:=case when changed=0 then 'unchanged' else 'saved' end;
    insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request_id,p_event_id,p_actor_user_id,fingerprint);
  end if;
  -- Do not include contacts, dates of birth, questionnaire, notes, or tokens.
  if school then
    select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id;
    result:=jsonb_build_object('kind','school','schoolName',b.school_name,'classDescription',b.class_description,
      'registrationStatus',b.status,'expectedStudents',b.student_count,'expectedCompanions',b.companion_count,
      'students',case when ci.cancelled_at is null then coalesce(ci.student_count,0) else 0 end,
      'companions',case when ci.cancelled_at is null then coalesce(ci.companion_count,0) else 0 end,
      'checkedInAt',case when ci.cancelled_at is null then ci.checked_in_at else null end);
  else
    select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'firstName',s.first_name,'lastName',s.last_name,
      'checkedInAt',case when c.cancelled_at is null then c.checked_in_at else null end) order by s.position) into persons
    from (select r.id as id,'adult' as kind,p.first_name,p.last_name,0 as position from public.participants p where p.id=r.participant_id
      union all select id,'child',first_name,last_name,position from public.registration_children where registration_id=target_id) s
    left join public.check_ins c on c.registration_id=target_id and c.moment_id is null and coalesce(c.child_id,c.registration_id)=s.id;
    result:=jsonb_build_object('kind','family','code',(select public_code from public.participants where id=r.participant_id),
      'registrationStatus',r.status,'persons',persons);
  end if;
  if p_action<>'inspect' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'checked_in_at',checked_in_at,'student_count',student_count,'companion_count',companion_count)), '[]') into after_state
      from public.check_ins where event_id=p_event_id and moment_id is null
        and (registration_id=target_id or school_booking_id=target_id);
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'reception.'||p_action,case when school then 'school_bookings' else 'registrations' end,target_id,
      jsonb_build_object('source',v_source,'outcome',outcome,'revision',revision,'request_id',p_request_id,
        'reason',p_reason,'changed',changed,'before',before_state,'after',after_state));
  return result || jsonb_build_object('status','valid','revision',revision,'outcome',outcome);
end $$;
revoke all on function public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) to service_role;


create function app.protect_checked_in_child() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if row(new.id,new.registration_id,new.first_name,new.last_name,new.birth_date)
    is distinct from row(old.id,old.registration_id,old.first_name,old.last_name,old.birth_date)
    and exists(select 1 from public.check_ins where child_id=old.id) then
    raise check_violation using message='Child has attendance history; identity change requires review';
  end if;
  return new;
end $$;
create trigger protect_checked_in_child before update on public.registration_children
  for each row execute function app.protect_checked_in_child();
revoke all on function app.protect_checked_in_child() from public,anon,authenticated;

create or replace function public.replace_owned_registration_children(
  p_registration_id uuid,
  p_children jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not app.owns_registration(p_registration_id) then
    raise exception 'registration not found for this participant' using errcode = '42501';
  end if;

  -- Serialize family-size changes with set_individual_panel_booking, which
  -- locks the same registration before calculating the occupied seats.
  perform 1
  from public.registrations registration
  where registration.id = p_registration_id
  for update;

  if not found then
    raise exception 'registration not found for this participant' using errcode = 'P0002';
  end if;

  if p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'children must be a JSON array' using errcode = '22023';
  end if;

  select count(*)::integer into v_count from jsonb_array_elements(p_children);
  if v_count > 10 then
    raise exception 'at most 10 children are allowed' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_children) child(
      first_name text, last_name text, birth_date date, position integer
    )
    where child.position is null
      or child.position not between 1 and 10
      or child.first_name is null
      or length(btrim(child.first_name)) not between 1 and 120
      or child.last_name is null
      or length(btrim(child.last_name)) not between 1 and 120
      or child.birth_date is null
      or child.birth_date > current_date
  ) then
    raise exception 'invalid accompanying child data' using errcode = '22023';
  end if;

  if (
    select count(distinct child.position)
    from jsonb_to_recordset(p_children) child(position integer)
  ) <> v_count then
    raise exception 'child positions must be unique' using errcode = '23505';
  end if;

  perform 1
  from public.panel_seat_sections section
  where section.id in (
    select choice.seat_section_id
    from public.moment_attendance_choices choice
    where choice.registration_id = p_registration_id
      and choice.choice = 'yes'
      and choice.seat_section_id is not null
  )
  order by section.id
  for update;

  if exists(select 1 from public.check_ins where registration_id=p_registration_id and child_id is not null) then
    if (select coalesce(jsonb_agg(jsonb_build_array(position,btrim(first_name),btrim(last_name),birth_date) order by position),'[]')
        from jsonb_to_recordset(p_children) child(position integer,first_name text,last_name text,birth_date date))
      = (select coalesce(jsonb_agg(jsonb_build_array(position,first_name,last_name,birth_date) order by position),'[]')
        from public.registration_children where registration_id=p_registration_id) then
      return v_count;
    end if;
    raise check_violation using message='Family has attendance history; changes require review';
  end if;

  delete from public.registration_children where registration_id = p_registration_id;

  insert into public.registration_children (
    registration_id, position, first_name, last_name, birth_date
  )
  select
    p_registration_id,
    child.position,
    btrim(child.first_name),
    btrim(child.last_name),
    child.birth_date
  from jsonb_to_recordset(p_children) child(
    first_name text, last_name text, birth_date date, position integer
  );

  perform app.validate_registration_panel_bookings(p_registration_id);
  return v_count;
end;
$$;


create function app.protect_check_in_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role') and
    ((tg_op='INSERT' and new.check_in_revision<>0) or
     (tg_op='UPDATE' and new.check_in_revision is distinct from old.check_in_revision)) then
    raise insufficient_privilege using message='Attendance revision requires server';
  end if;
  return new;
end $$;
create trigger protect_check_in_revision before insert or update on public.registrations
  for each row execute function app.protect_check_in_revision();
create trigger protect_check_in_revision before insert or update on public.school_bookings
  for each row execute function app.protect_check_in_revision();
revoke all on function app.protect_check_in_revision() from public,anon,authenticated;

commit;
