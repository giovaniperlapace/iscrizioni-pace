-- Explicit desired state: retries never toggle a booking back accidentally.
create or replace function public.set_group_panel_booking(
  p_event_id uuid, p_section_id uuid, p_registration_id uuid, p_booked boolean
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_groups uuid[];
  v_panel_id uuid;
  v_current_section uuid;
  v_seats integer;
begin
  if p_booked is null or p_registration_id is null or p_section_id is null then
    raise exception 'invalid booking request' using errcode = '22023';
  end if;
  if p_booked then
    return public.book_group_panel(p_event_id, p_section_id, array[p_registration_id]);
  end if;
  select array_agg(id) into v_groups from app.leader_panel_group_scope(p_event_id) id;
  if auth.uid() is null or coalesce(cardinality(v_groups), 0) = 0 then
    raise exception 'group panel access forbidden' using errcode = '42501';
  end if;
  perform 1 from public.registrations where id = p_registration_id for update;
  perform 1 from public.participant_group_assignments
    where registration_id = p_registration_id and is_current order by id for update;
  if not exists (
    select 1 from public.registrations r
    join public.participant_group_assignments a on a.registration_id = r.id
      and a.is_current and a.status = 'confirmed' and a.group_id = any(v_groups)
    where r.id = p_registration_id and r.event_id = p_event_id
      and r.status in ('submitted', 'confirmed') and r.deleted_at is null
  ) then
    raise exception 'registration outside leader scope or inactive' using errcode = '42501';
  end if;
  select p.id into v_panel_id from public.event_moments p
  join public.panel_seat_sections s on s.panel_id = p.id and s.event_id = p.event_id
  join public.panel_audience_types a on a.id = s.audience_type_id and a.event_id = s.event_id
  where s.id = p_section_id and p.event_id = p_event_id
    and p.moment_type = 'panel' and a.booking_channel = 'individual'
  for update of p;
  if not found then raise exception 'panel not found' using errcode = 'P0002'; end if;
  select seat_section_id into v_current_section from public.moment_attendance_choices
    where registration_id = p_registration_id and moment_id = v_panel_id and choice = 'yes';
  if v_current_section is null then return jsonb_build_object('count',0,'seats',0); end if;
  -- Release the actual booked section, even when another section of this panel is displayed.
  perform 1 from public.panel_seat_sections
    where id = v_current_section for update;
  v_seats := app.registration_panel_party_size(p_registration_id);
  update public.moment_attendance_choices set choice = 'no', seat_section_id = null
    where registration_id = p_registration_id and moment_id = v_panel_id and choice = 'yes';
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(p_event_id, auth.uid(), 'panel.group_booking_cancelled', 'registrations', p_registration_id,
      jsonb_build_object('panel_id',v_panel_id,'section_id',v_current_section,'party_size',v_seats));
  return jsonb_build_object('count',1,'seats',v_seats);
end;
$$;
revoke all on function public.set_group_panel_booking(uuid,uuid,uuid,boolean) from public, anon;
grant execute on function public.set_group_panel_booking(uuid,uuid,uuid,boolean) to authenticated;
