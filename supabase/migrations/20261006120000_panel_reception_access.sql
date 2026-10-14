-- P13: per-panel assignments and admissions. No event reception role is granted.
-- New functionality is staged separately from the report activation.
begin;

create table public.panel_reception_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  panel_id uuid not null references public.event_moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  duty text not null check(duty in ('panel_entry','room_assistance')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(panel_id,user_id,duty)
);
create index panel_reception_assignments_user_event_idx on public.panel_reception_assignments(user_id,event_id);
alter table public.panel_reception_assignments enable row level security;
revoke all on public.panel_reception_assignments from anon,authenticated;
grant select on public.panel_reception_assignments to authenticated;
grant all on public.panel_reception_assignments to service_role;
create policy "panel staff read own or managed assignments" on public.panel_reception_assignments for select to authenticated
  using(user_id=auth.uid() or app.has_event_role(event_id,array['manager']::public.app_role[]));

create function app.ensure_panel_reception_assignment_scope() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.event_moments where id=new.panel_id and event_id=new.event_id and moment_type='panel') then
    raise check_violation using message='Panel assignment event mismatch';
  end if;
  return new;
end $$;
revoke all on function app.ensure_panel_reception_assignment_scope() from public,anon,authenticated;
create trigger panel_reception_assignment_scope before insert or update on public.panel_reception_assignments
  for each row execute function app.ensure_panel_reception_assignment_scope();

-- Authenticated minimal catalogue: no access to other assignments or unpublished
-- panel content is granted on the underlying tables. Pagination is by assignment ID.
create function public.my_panel_reception_duties()
returns table(assignment_id uuid,event_id uuid,panel_id uuid,duty text,title text,room text,starts_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.id,a.event_id,a.panel_id,a.duty,m.title,l.name,m.starts_at
  from public.panel_reception_assignments a
  join public.events e on e.id=a.event_id and e.is_current
  join public.event_moments m on m.id=a.panel_id and m.event_id=e.id and m.moment_type='panel'
  left join public.event_locations l on l.id=m.location_id and l.event_id=e.id
  where a.user_id=auth.uid();
$$;
revoke all on function public.my_panel_reception_duties() from public,anon;
grant execute on function public.my_panel_reception_duties() to authenticated;

create function public.has_panel_reception_duty() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.panel_reception_assignments a
    join public.events e on e.id=a.event_id and e.is_current where a.user_id=auth.uid());
$$;
revoke all on function public.has_panel_reception_duty() from public,anon;
grant execute on function public.has_panel_reception_duty() to authenticated;

create function public.set_panel_reception_assignment(
  p_event_id uuid,p_panel_id uuid,p_user_id uuid,p_duty text,p_assigned boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  perform 1 from public.event_user_roles where user_id=auth.uid()
    and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event_id)) for share;
  if not found then raise insufficient_privilege using message='Panel management forbidden'; end if;
  perform 1 from public.events where id=p_event_id and is_current for share;
  if not found then raise insufficient_privilege using message='Current event required'; end if;
  if p_duty is null or p_duty not in ('panel_entry','room_assistance') or p_assigned is null then
    raise invalid_parameter_value using message='Invalid assignment';
  end if;
  if p_user_id=auth.uid() and not p_assigned then
    raise invalid_parameter_value using message='Self removal forbidden';
  end if;
  -- Assignment-key lock serializes simultaneous grant/revoke requests.
  perform pg_advisory_xact_lock(hashtextextended(p_panel_id::text||p_user_id::text||p_duty,13));
  perform 1 from public.event_moments where id=p_panel_id and event_id=p_event_id and moment_type='panel';
  if not found then raise invalid_parameter_value using message='Invalid panel'; end if;
  perform 1 from public.profiles where id=p_user_id for key share;
  if not found then raise invalid_parameter_value using message='Existing account required'; end if;
  if p_assigned then
    insert into public.panel_reception_assignments(event_id,panel_id,user_id,duty,created_by)
      values(p_event_id,p_panel_id,p_user_id,p_duty,auth.uid()) on conflict(panel_id,user_id,duty) do nothing;
  else
    delete from public.panel_reception_assignments where event_id=p_event_id and panel_id=p_panel_id and user_id=p_user_id and duty=p_duty;
  end if;
  get diagnostics changed=row_count;
  if changed>0 then
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      values(p_event_id,auth.uid(),case when p_assigned then 'panel.duty_assigned' else 'panel.duty_revoked' end,
        'panel_reception_assignments',p_panel_id,jsonb_build_object('user_id',p_user_id,'duty',p_duty));
  end if;
  return changed>0;
end $$;
revoke all on function public.set_panel_reception_assignment(uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.set_panel_reception_assignment(uuid,uuid,uuid,text,boolean) to authenticated;

-- Separate revisions leave event attendance snapshots untouched.
create table public.panel_check_in_revisions (
  panel_id uuid not null references public.event_moments(id) on delete restrict,
  subject_id uuid not null,
  revision integer not null check(revision>=0),
  primary key(panel_id,subject_id)
);
alter table public.panel_check_in_revisions enable row level security;
revoke all on public.panel_check_in_revisions from anon,authenticated;
grant select,insert,update on public.panel_check_in_revisions to service_role;

alter table public.check_ins add column seat_section_id uuid references public.panel_seat_sections(id) on delete restrict;
alter table public.check_ins drop constraint check_ins_subject_check;
alter table public.check_ins add constraint check_ins_subject_check check (
  (registration_id is not null and school_booking_id is null and student_count is null and companion_count is null)
  or (registration_id is null and child_id is null and school_booking_id is not null
    and student_count is not null and companion_count is not null
    and student_count between 0 and 1000 and companion_count between 0 and 100
    and student_count+companion_count>0)
);
alter table public.check_ins add constraint check_ins_section_requires_moment check(seat_section_id is null or moment_id is not null);
drop index public.check_ins_school_event_unique;
create unique index check_ins_school_event_unique on public.check_ins(school_booking_id,event_id)
  where school_booking_id is not null and moment_id is null;
create unique index check_ins_school_panel_unique on public.check_ins(school_booking_id,event_id,moment_id)
  where school_booking_id is not null and moment_id is not null;
create index check_ins_panel_section_active_idx on public.check_ins(moment_id,seat_section_id) where cancelled_at is null and moment_id is not null;

create function app.ensure_check_in_section_scope() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.seat_section_id is not null and not exists(select 1 from public.panel_seat_sections
    where id=new.seat_section_id and event_id=new.event_id and panel_id=new.moment_id) then
    raise check_violation using message='Check-in section mismatch';
  end if;
  return new;
end $$;
revoke all on function app.ensure_check_in_section_scope() from public,anon,authenticated;
create trigger check_in_section_scope before insert or update on public.check_ins
  for each row execute function app.ensure_check_in_section_scope();

-- Preserve the event RPC; only add explicit general-event scope to school lookups.
create or replace function public.reception_check_in(
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
      select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id is null for update;
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
    select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id is null;
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

create function public.reception_panel_check_in(
  p_duty text, p_panel_id uuid, p_event_id uuid, p_actor_user_id uuid, p_lookup_kind text, p_lookup text,
  p_action text default 'inspect', p_request_id uuid default null,
  p_subject_ids uuid[] default '{}', p_students integer default null,
  p_companions integer default null, p_expected_revision integer default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  panel public.event_moments; section public.panel_seat_sections;
  section_id uuid; section_label text; room_name text; location_capacity integer;
  reservation_students integer; reservation_companions integer; arrival public.check_ins;
  expected_students integer; expected_companions integer; occupied bigint; desired integer;
  r public.registrations; b public.school_bookings; q record;
  target_id uuid; school boolean := false; person uuid; ci public.check_ins;
  revision integer; changed integer := 0; replay boolean := false;
  fingerprint text; previous_request public.check_in_requests;
  v_source text; outcome text := 'verified'; persons jsonb; result jsonb; before_state jsonb; after_state jsonb;
begin
  -- Lock the exact assignment so revocation and a command have a definite order.
  if p_duty is null or p_duty not in ('panel_entry','room_assistance')
    or (p_duty='room_assistance' and p_action is distinct from 'inspect') then
    raise insufficient_privilege using message='Panel duty forbidden';
  end if;
  perform 1 from public.panel_reception_assignments where user_id=p_actor_user_id
    and event_id=p_event_id and panel_id=p_panel_id and duty=p_duty for share;
  if not found then raise insufficient_privilege using message='Panel assignment required'; end if;
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

  else
    select * into r from public.registrations where id=target_id and event_id=p_event_id for update;
    if not found or r.deleted_at is not null or r.cancelled_at is not null or r.status not in ('submitted','confirmed') then target_id:=null; end if;

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
    -- Invalid lookups disclose no identity. Room assistance does not write data.
    return jsonb_build_object('status','invalid');
  end if;

  -- Same parent/reservation/panel/section lock order as booking operations.
  if school then
    select seat_section_id,student_count,companion_count
      into section_id,reservation_students,reservation_companions
      from public.school_panel_reservations where booking_id=target_id
        and panel_id=p_panel_id and event_id=p_event_id and status='reserved' for share;
  else
    select seat_section_id into section_id from public.moment_attendance_choices
      where registration_id=target_id and moment_id=p_panel_id and choice='yes' for share;
  end if;
  if section_id is null then return jsonb_build_object('status','not_booked'); end if;
  select * into panel from public.event_moments where id=p_panel_id and event_id=p_event_id
    and moment_type='panel' and publication_status='published' for update;
  if not found then return jsonb_build_object('status','panel_unavailable'); end if;
  select name,max_capacity into room_name,location_capacity from public.event_locations
    where id=panel.location_id and event_id=p_event_id and is_active for share;
  if not found or location_capacity is null then return jsonb_build_object('status','panel_unavailable'); end if;
  select * into section from public.panel_seat_sections where id=section_id
    and event_id=p_event_id and panel_id=p_panel_id for update;
  if not found then return jsonb_build_object('status','not_booked'); end if;
  select name into section_label from public.panel_audience_types where id=section.audience_type_id
    and event_id=p_event_id and is_active
    and booking_channel=case when school then 'school_booking'::public.panel_booking_channel else 'individual'::public.panel_booking_channel end for share;
  if not found then return jsonb_build_object('status','not_booked'); end if;
  -- Room assistance gets only routing information, with no attendance history,
  -- technical subject IDs, quantities, contacts or writes (including audit).
  if p_duty='room_assistance' then
    return jsonb_build_object('status','valid','kind','room','revision',0,'outcome','verified',
      'registrationStatus',case when school then b.status::text else r.status::text end,
      'label',case when school then b.school_name||' · '||b.class_description else
        (select first_name||' '||last_name from public.participants where id=r.participant_id) end,
      'panel',jsonb_build_object('id',p_panel_id,'title',panel.title,'room',room_name,'section',section_label));
  end if;
  select coalesce((select pr.revision from public.panel_check_in_revisions pr
    where pr.panel_id=p_panel_id and pr.subject_id=target_id),0) into revision;
  if school then
    select * into arrival from public.check_ins where school_booking_id=target_id
      and event_id=p_event_id and moment_id is null and cancelled_at is null;
    expected_students:=least(reservation_students,b.student_count,coalesce(arrival.student_count,0));
    expected_companions:=least(reservation_companions,b.companion_count,coalesce(arrival.companion_count,0));
    if arrival.id is null and (p_action not in ('inspect','cancel') or
      (p_action='inspect' and not exists(select 1 from public.check_ins where school_booking_id=target_id
        and moment_id=p_panel_id and cancelled_at is null))) then
      return jsonb_build_object('status','event_entry_required');
    end if;
  end if;

  if p_action<>'inspect' then
    if p_request_id is null or p_subject_ids is null or cardinality(p_subject_ids)>11
      or (p_action in ('correct','cancel') and (p_expected_revision is null or p_expected_revision<0
        or p_reason is null or p_reason not in ('selection_error','count_error','entry_cancelled'))) then
      raise invalid_parameter_value using message='Explicit correction and request identity required';
    end if;
    fingerprint := encode(sha256(convert_to(jsonb_build_array(p_duty,p_panel_id,p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,
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
    if p_action<>'cancel' then
      if school then
        desired:=case when p_action='enter' and exists(select 1 from public.check_ins where school_booking_id=target_id
          and moment_id=p_panel_id and cancelled_at is null) then
          (select student_count+companion_count from public.check_ins where school_booking_id=target_id and moment_id=p_panel_id and cancelled_at is null)
          else coalesce(p_students,0)+coalesce(p_companions,0) end;
      else
        select count(*) into desired from (select unnest(p_subject_ids) id union
          select coalesce(child_id,registration_id) from public.check_ins where registration_id=target_id
            and moment_id=p_panel_id and cancelled_at is null and p_action='enter') subjects;
      end if;
      select coalesce(sum(case when school_booking_id is null then 1 else student_count+companion_count end),0)
        into occupied from public.check_ins where moment_id=p_panel_id and cancelled_at is null
          and seat_section_id=section_id and coalesce(registration_id,school_booking_id)<>target_id;
      if occupied+desired>section.capacity then return jsonb_build_object('status','capacity_exceeded'); end if;
      select coalesce(sum(case when school_booking_id is null then 1 else student_count+companion_count end),0)
        into occupied from public.check_ins where moment_id=p_panel_id and cancelled_at is null
          and coalesce(registration_id,school_booking_id)<>target_id;
      if occupied+desired>location_capacity then return jsonb_build_object('status','capacity_exceeded'); end if;
      -- Existing admissions retain their historical section; do not silently move them.
      if exists(select 1 from public.check_ins where moment_id=p_panel_id and cancelled_at is null
        and coalesce(registration_id,school_booking_id)=target_id and seat_section_id is distinct from section_id) then
        return jsonb_build_object('status','conflict');
      end if;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'student_count',student_count,'companion_count',companion_count)), '[]') into before_state
      from public.check_ins where event_id=p_event_id and moment_id=p_panel_id
        and (registration_id=target_id or school_booking_id=target_id);
    if school then
      if cardinality(p_subject_ids)<>0 or (p_action<>'cancel' and
        (p_students is null or p_companions is null or p_students<0 or p_companions<0
        or p_students>expected_students or p_companions>expected_companions or p_students+p_companions=0)) then
        raise invalid_parameter_value using message='Invalid school attendance counts';
      end if;
      select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id=p_panel_id for update;
      if p_action='cancel' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where id=ci.id and cancelled_at is null;
        get diagnostics changed=row_count;
      elsif ci.id is null then
        insert into public.check_ins(event_id,moment_id,seat_section_id,school_booking_id,student_count,companion_count,checked_in_by,updated_by,source)
          values(p_event_id,p_panel_id,section_id,target_id,p_students,p_companions,p_actor_user_id,p_actor_user_id,v_source);
        changed:=1;
      elsif ci.cancelled_at is not null or (p_action='correct' and (ci.student_count<>p_students or ci.companion_count<>p_companions)) then
        update public.check_ins set student_count=p_students,companion_count=p_companions,cancelled_at=null,seat_section_id=section_id,
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
      if p_action<>'cancel' and exists(select 1 from unnest(p_subject_ids) x where not exists(
        select 1 from public.check_ins e where e.registration_id=target_id and e.event_id=p_event_id
          and e.moment_id is null and e.cancelled_at is null and coalesce(e.child_id,e.registration_id)=x)) then
        return jsonb_build_object('status','event_entry_required');
      end if;
      if p_action='correct' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where registration_id=target_id and moment_id=p_panel_id and cancelled_at is null
            and not(coalesce(child_id,registration_id)=any(p_subject_ids));
        get diagnostics changed=row_count;
      end if;
      foreach person in array p_subject_ids loop
        ci:=null;
        select * into ci from public.check_ins where registration_id=target_id and moment_id=p_panel_id
          and coalesce(child_id,registration_id)=person for update;
        if p_action='cancel' then
          if ci.id is not null and ci.cancelled_at is null then
            update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id where id=ci.id;
            changed:=changed+1;
          end if;
        elsif ci.id is null then
          insert into public.check_ins(registration_id,event_id,moment_id,seat_section_id,child_id,checked_in_by,updated_by,source)
            values(target_id,p_event_id,p_panel_id,section_id,case when person=target_id then null else person end,p_actor_user_id,p_actor_user_id,v_source);
          changed:=changed+1;
        elsif ci.cancelled_at is not null then
          update public.check_ins set cancelled_at=null,seat_section_id=section_id,checked_in_at=clock_timestamp(),checked_in_by=p_actor_user_id,
            updated_at=clock_timestamp(),updated_by=p_actor_user_id,source=v_source where id=ci.id;
          changed:=changed+1;
        end if;
      end loop;
    end if;
    if changed>0 then
      insert into public.panel_check_in_revisions(panel_id,subject_id,revision) values(p_panel_id,target_id,1)
        on conflict(panel_id,subject_id) do update set revision=panel_check_in_revisions.revision+1 returning panel_check_in_revisions.revision into revision;
    end if;
    outcome:=case when changed=0 then 'unchanged' else 'saved' end;
    insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request_id,p_event_id,p_actor_user_id,fingerprint);
  end if;
  -- Do not include contacts, dates of birth, questionnaire, notes, or tokens.
  if school then
    select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id=p_panel_id;
    result:=jsonb_build_object('kind','school','schoolName',b.school_name,'classDescription',b.class_description,
      'registrationStatus',b.status,'expectedStudents',expected_students,'expectedCompanions',expected_companions,
      'students',case when ci.cancelled_at is null then coalesce(ci.student_count,0) else 0 end,
      'companions',case when ci.cancelled_at is null then coalesce(ci.companion_count,0) else 0 end,
      'checkedInAt',case when ci.cancelled_at is null then ci.checked_in_at else null end);
  else
    select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'firstName',s.first_name,'lastName',s.last_name,
      'checkedInAt',case when c.cancelled_at is null then c.checked_in_at else null end,
      'eventCheckedIn',exists(select 1 from public.check_ins e where e.registration_id=target_id and e.moment_id is null
        and e.cancelled_at is null and coalesce(e.child_id,e.registration_id)=s.id)) order by s.position) into persons
    from (select r.id as id,'adult' as kind,p.first_name,p.last_name,0 as position from public.participants p where p.id=r.participant_id
      union all select id,'child',first_name,last_name,position from public.registration_children where registration_id=target_id) s
    left join public.check_ins c on c.registration_id=target_id and c.moment_id=p_panel_id and coalesce(c.child_id,c.registration_id)=s.id;
    result:=jsonb_build_object('kind','family','code',(select public_code from public.participants where id=r.participant_id),
      'registrationStatus',r.status,'persons',persons);
  end if;
  if p_action<>'inspect' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'checked_in_at',checked_in_at,'student_count',student_count,'companion_count',companion_count)), '[]') into after_state
      from public.check_ins where event_id=p_event_id and moment_id=p_panel_id
        and (registration_id=target_id or school_booking_id=target_id);
  end if;
  if p_duty<>'room_assistance' then
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'reception.panel.'||p_action,case when school then 'school_bookings' else 'registrations' end,target_id,
      jsonb_build_object('panel_id',p_panel_id,'duty',p_duty,'source',v_source,'outcome',outcome,'revision',revision,'request_id',p_request_id,
        'reason',p_reason,'changed',changed,'before',before_state,'after',after_state));
  end if;
  return result || jsonb_build_object('status','valid','revision',revision,'outcome',outcome,
    'panel',jsonb_build_object('id',p_panel_id,'title',panel.title,'room',room_name,'section',section_label));
end $$;
revoke all on function public.reception_panel_check_in(text,uuid,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.reception_panel_check_in(text,uuid,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) to service_role;

notify pgrst,'reload schema';
commit;
