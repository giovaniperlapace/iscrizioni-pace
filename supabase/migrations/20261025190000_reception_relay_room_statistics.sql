begin;
-- Aggregate read only, scoped to the assigned main Forum and its canonical relay.
create function public.reception_relay_room_statistics(p_event uuid,p_actor uuid,p_panel uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.events e
  join public.panel_reception_assignments a on a.event_id=e.id
  join public.event_moments m on m.id=a.panel_id and m.event_id=e.id
  where e.id=p_event and e.is_current and a.user_id=p_actor
   and a.panel_id=p_panel and a.duty='panel_entry' and m.moment_type='panel') then
  raise insufficient_privilege;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'panelId',relay.id,'title',relay.title,'room',l.name,'capacity',l.max_capacity,
  'entered',coalesce((select sum(case when c.school_booking_id is null then 1 else c.student_count+c.companion_count end)
   from public.check_ins c where c.event_id=p_event and c.moment_id=relay.id and c.cancelled_at is null),0)
 ) order by relay.id)
 from public.panel_relay_rooms link
 join public.event_moments source on source.id=link.source_panel_id and source.event_id=p_event and source.moment_type='panel'
 join public.event_moments relay on relay.id=link.panel_id and relay.event_id=p_event and relay.moment_type='panel'
  and relay.starts_at=source.starts_at and relay.ends_at=source.ends_at and relay.publication_status='published'
 left join public.event_locations l on l.id=relay.location_id and l.event_id=p_event
 where link.source_panel_id=p_panel),'[]'::jsonb);
end $$;
revoke all on function public.reception_relay_room_statistics(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reception_relay_room_statistics(uuid,uuid,uuid) to service_role;
commit;
