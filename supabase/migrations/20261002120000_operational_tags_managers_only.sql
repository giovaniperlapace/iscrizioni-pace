-- Operational tags are reserved to event management, including read access.
begin;
alter policy "operational tags read operational" on public.operational_tags
  using (app.has_event_role(event_id, array['manager','manager_viewer']::public.app_role[]));

create or replace function app.can_assign_participant_tag(target_participant_id uuid, target_tag_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.operational_tags ot
    join public.registrations r on r.event_id = ot.event_id
    where ot.id = target_tag_id and r.participant_id = target_participant_id
      and r.deleted_at is null
      and app.has_event_role(ot.event_id, array['manager']::public.app_role[])
  );
$$;

alter policy "participant operational tags read scoped" on public.participant_operational_tags
  using (exists (
    select 1 from public.operational_tags ot
    where ot.id = tag_id
      and app.has_event_role(ot.event_id, array['manager','manager_viewer']::public.app_role[])
  ));
-- Existing INSERT/DELETE policies call the restricted function above.
commit;
