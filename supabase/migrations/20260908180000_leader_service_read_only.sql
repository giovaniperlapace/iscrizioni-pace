-- Dedicated change: group leaders can read participant services, never manage them.
-- Keep the existing read policy/helper and participant self-preference unchanged.
-- No data rewrite: existing assignments, notes, source and audit are preserved.
begin;

alter policy "participant event services manage operators"
  on public.participant_event_services
  using (
    app.has_event_role(event_id, array['manager']::public.app_role[])
    and app.can_manage_participant_event_service(registration_id, participant_id, event_id)
  )
  with check (
    app.has_event_role(event_id, array['manager']::public.app_role[])
    and app.can_manage_participant_event_service(registration_id, participant_id, event_id)
    and app.event_service_matches_registration(event_id, registration_id, participant_id, service_id)
    and source in ('manager', 'capogruppo')
  );
-- has_event_role includes global admins. Historical source='capogruppo' remains
-- editable by managers/admins; it grants no permission to the creator.
notify pgrst, 'reload schema';
commit;
