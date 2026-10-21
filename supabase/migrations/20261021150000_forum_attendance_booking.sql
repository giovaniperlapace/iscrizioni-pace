-- Explicit personal consent: declare just this Forum's half-day and retry the
-- original booking/queue operation in one transaction, under canonical locks.
create function public.confirm_attendance_and_book_forum(
 p_registration_id uuid, p_panel_id uuid, p_section_id uuid, p_intent text,
 p_child_ids uuid[], p_locale text default 'en'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.registrations%rowtype; slot text; slot_day date; slot_part text;
 result jsonb; unknown_rows jsonb; previous_choice text;
begin
 select * into r from public.registrations where id=p_registration_id for update;
 if auth.uid() is null or r.id is null or not app.owns_registration(r.id) then
  raise insufficient_privilege;
 end if;
 if p_intent is null or p_intent not in ('book','join','accept') then
  raise invalid_parameter_value;
 end if;
 perform app.require_panel_bookings_open(r.event_id);
 select app.panel_slot_key(p.starts_at) into slot
 from public.event_moments p join public.panel_seat_sections s on s.panel_id=p.id
 where p.id=p_panel_id and s.id=p_section_id and p.event_id=r.event_id
   and s.event_id=r.event_id and p.moment_type='panel';
 if slot is null then raise invalid_parameter_value using message='panel is not available'; end if;
 slot_day:=split_part(slot,':',1)::date; slot_part:=split_part(slot,':',2);
 begin
  select choice::text into previous_choice from public.event_attendance_choices
   where registration_id=r.id and day=slot_day and day_part=slot_part;
  update public.event_attendance_choices set choice='yes'
   where registration_id=r.id and day=slot_day and day_part=slot_part;
  if not found then
   insert into public.event_attendance_choices(registration_id,day,day_part,choice)
    values(r.id,slot_day,slot_part,'yes');
  end if;
  -- Keep all other unknown choices intact. The canonical booking guard rejects
  -- global unknown even when a half-day is yes; suppress those markers only
  -- inside this atomic, explicitly consented operation, then restore exact rows.
  with removed as (delete from public.event_attendance_choices
    where registration_id=r.id and choice='unknown' returning *)
   select coalesce(jsonb_agg(to_jsonb(removed)),'[]') into unknown_rows from removed;
  result:=public.set_panel_family_booking(r.id,p_panel_id,p_section_id,p_intent,p_child_ids,false,p_locale);
  if result->>'status' in ('expired','available') then
   raise exception 'booking not completed' using errcode='PFA02';
  end if;
  insert into public.event_attendance_choices
   select * from jsonb_populate_recordset(null::public.event_attendance_choices,unknown_rows);
  if previous_choice is distinct from 'yes' then
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(r.event_id,auth.uid(),'participant.forum_attendance_confirmed','registrations',r.id,
     jsonb_build_object('panel_id',p_panel_id,'day',slot_day,'day_part',slot_part,'intent',p_intent));
  end if;
 exception when sqlstate 'PFA02' then
  -- Roll back attendance and any partial queue changes also for soft failures.
  return result;
 end;
 return result;
end;
$$;
revoke all on function public.confirm_attendance_and_book_forum(uuid,uuid,uuid,text,uuid[],text) from public,anon;
grant execute on function public.confirm_attendance_and_book_forum(uuid,uuid,uuid,text,uuid[],text) to authenticated;
notify pgrst, 'reload schema';
