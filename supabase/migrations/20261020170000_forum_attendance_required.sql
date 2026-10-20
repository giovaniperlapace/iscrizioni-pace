-- New personal/group Forum requests require declared attendance in the Forum slot.
-- School reservations use separate tables and are deliberately unaffected.
create function app.require_forum_attendance(p_registration_id uuid,p_panel_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare slot text; attending boolean;
begin
 perform 1 from public.registrations where id=p_registration_id for update;
 select app.panel_slot_key(p.starts_at) into slot from public.event_moments p
 join public.registrations r on r.event_id=p.event_id
 where p.id=p_panel_id and r.id=p_registration_id and p.moment_type='panel';
 if slot is null then return; end if;
 -- Explicit half-day choices take precedence over legacy whole-day choices.
 select c.choice='yes' into attending from public.event_attendance_choices c
 where c.registration_id=p_registration_id and c.day=split_part(slot,':',1)::date
 and (c.day_part=split_part(slot,':',2) or c.day_part is null)
 order by (c.day_part is not null) desc limit 1;
 if attending is distinct from true or exists(select 1 from public.event_attendance_choices
   where registration_id=p_registration_id and choice='unknown') then
  raise exception 'forum attendance required' using errcode='PFA01';
 end if;
end;
$$;
revoke all on function app.require_forum_attendance(uuid,uuid) from public,anon,authenticated;

create function app.guard_forum_attendance() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='moment_attendance_choices' then
  if new.choice<>'yes' then return new; end if;
  if tg_op='UPDATE' and old.choice='yes' and old.registration_id=new.registration_id
    and old.moment_id=new.moment_id and old.seat_section_id is not distinct from new.seat_section_id then return new; end if;
  -- INSERT ... ON CONFLICT retries of an existing reservation are harmless.
  if tg_op='INSERT' and exists(select 1 from public.moment_attendance_choices c
   where c.registration_id=new.registration_id and c.moment_id=new.moment_id and c.choice='yes'
   and c.seat_section_id is not distinct from new.seat_section_id) then return new; end if;
  perform app.require_forum_attendance(new.registration_id,new.moment_id);
 else
  if new.status<>'waiting' then return new; end if;
  if tg_op='UPDATE' and old.status='waiting' and old.registration_id=new.registration_id
   and old.panel_id=new.panel_id then return new; end if;
  perform app.require_forum_attendance(new.registration_id,new.panel_id);
 end if;
 return new;
end;
$$;
revoke all on function app.guard_forum_attendance() from public,anon,authenticated;
create trigger forum_attendance_required before insert or update on public.moment_attendance_choices
 for each row execute function app.guard_forum_attendance();
create trigger forum_attendance_required before insert or update on public.panel_waitlist
 for each row execute function app.guard_forum_attendance();

create or replace function public.set_panel_family_booking(
 p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_intent text,
 p_child_ids uuid[],p_as_leader boolean default false,p_locale text default 'en'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.registrations%rowtype; result jsonb; existing_ids uuid[]; active boolean;
begin
 select * into r from public.registrations where id=p_registration_id for update;
 if r.id is null or auth.uid() is null then raise insufficient_privilege; end if;
 if p_as_leader then
  perform 1 from public.participant_group_assignments where registration_id=r.id and is_current order by id for update;
  if not app.can_manage_group_panel_registration(r.event_id,r.id,auth.uid()) then raise insufficient_privilege; end if;
 elsif not app.owns_registration(r.id) then raise insufficient_privilege; end if;
 perform app.require_panel_bookings_open(r.event_id);
 if p_intent is null or p_intent not in ('book','cancel','join','leave','accept') then raise invalid_parameter_value; end if;
 if p_panel_id is null and p_as_leader then
  select panel_id into p_panel_id from public.panel_seat_sections where id=p_section_id and event_id=r.event_id;
 end if;
 if not exists(select 1 from public.panel_seat_sections s join public.event_moments p on p.id=s.panel_id
  where s.id=p_section_id and s.panel_id=p_panel_id and p.event_id=r.event_id and p.moment_type='panel') then
  raise invalid_parameter_value using message='panel is not available';
 end if;
 if p_intent in ('book','join','accept') then
  perform app.require_forum_attendance(r.id,p_panel_id);
 end if;
 -- Lock all affected sections before changing the requested party, matching queue acceptance.
 perform 1 from public.event_moments where id=p_panel_id or id in (
  select moment_id from public.moment_attendance_choices where registration_id=r.id and choice='yes') order by id for update;
 perform 1 from public.panel_seat_sections where id=p_section_id or id in (
  select seat_section_id from public.moment_attendance_choices where registration_id=r.id and choice='yes') or id in (
  select section_id from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered')) order by id for update;
 if p_intent in ('book','join') then
  if p_child_ids is null or cardinality(p_child_ids)>10 or array_position(p_child_ids,null) is not null
   or cardinality(p_child_ids)<>(select count(distinct x) from unnest(p_child_ids) x)
   or exists(select 1 from unnest(p_child_ids) x where not exists(select 1 from public.registration_children c where c.id=x and c.registration_id=r.id)) then
   raise invalid_parameter_value using message='invalid child selection';
  end if;
  existing_ids:=app.panel_child_ids(r.id,p_panel_id);
  active:=exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes')
   or exists(select 1 from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered'));
  if active and not(existing_ids @> p_child_ids and existing_ids <@ p_child_ids) then
   raise invalid_parameter_value using message='cancel existing booking or leave queue before changing children';
  end if;
  insert into public.panel_child_selections values(r.id,p_panel_id,p_child_ids)
   on conflict(registration_id,panel_id) do update set child_ids=excluded.child_ids;
 end if;
 if p_intent in ('join','leave','accept') then
  result:=app.set_panel_waitlist(r.id,p_panel_id,p_section_id,p_intent,p_as_leader,p_locale);
 elsif p_as_leader then
  result:=public.set_group_panel_booking(r.event_id,p_section_id,r.id,p_intent='book');
 else
  result:=public.set_individual_panel_booking(r.id,p_panel_id,p_section_id,p_intent='book');
 end if;
 if p_intent in ('cancel','leave') and not exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes')
  and not exists(select 1 from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered')) then
  delete from public.panel_child_selections where registration_id=r.id and panel_id=p_panel_id;
 end if;
 return result;
end;
$$;
