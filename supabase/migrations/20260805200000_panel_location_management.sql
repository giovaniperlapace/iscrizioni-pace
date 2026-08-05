-- Milestone P2: manager location management guardrails and RLS.

alter table public.event_locations
  add constraint event_locations_name_not_blank
    check (length(btrim(name)) between 1 and 100),
  add constraint event_locations_address_length
    check (address is null or length(btrim(address)) between 1 and 240);

create policy "event locations managers manage"
  on public.event_locations for all
  using (app.has_event_role(event_id, array['manager']::public.app_role[]))
  with check (app.has_event_role(event_id, array['manager']::public.app_role[]));
