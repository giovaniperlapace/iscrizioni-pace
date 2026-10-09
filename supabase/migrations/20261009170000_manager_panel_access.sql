-- Extend the accepted admin management tools to managers of the current event.
-- Public release mode and viewer permissions stay independent.
create or replace function app.panel_management_allowed(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select app.is_admin() or (
    exists (select 1 from public.events where id = p_event_id and is_current)
    and app.has_event_role(p_event_id, array['manager']::public.app_role[])
  );
$$;
revoke all on function app.panel_management_allowed(uuid) from public;
grant execute on function app.panel_management_allowed(uuid) to anon, authenticated, service_role;

alter policy "panel acceptance read" on public.school_booking_qr_tokens
using (app.panel_management_allowed((select event_id from public.school_bookings where id = booking_id)) or app.owns_school_booking(booking_id));
alter policy "panel acceptance read" on public.moment_attendance_choices
using (app.is_admin() or exists (select 1 from public.event_moments m where m.id = moment_id
  and (app.panel_management_allowed(m.event_id) or m.moment_type <> 'panel' or app.is_published_panel(m.id))));

-- Existing permissive policies still enforce event scope and write roles.
alter policy "panel campaigns acceptance read" on public.email_campaigns
using (app.panel_management_allowed(event_id) or not app.is_panel_campaign(id));
alter policy "panel campaigns acceptance insert" on public.email_campaigns
with check (
  app.panel_management_allowed(event_id) or (
    coalesce(filters_snapshot->>'audience','') <> 'teachers'
    and nullif(filters_snapshot->>'panelId','') is null
    and nullif(filters_snapshot->>'schoolName','') is null
    and not ((subject_template || ' ' || body_template) ~* '\{\{[[:space:]]*(panel|scuola)[[:space:]]*\}\}')
  )
);
alter policy "panel campaigns acceptance update" on public.email_campaigns
using (app.panel_management_allowed(event_id) or not app.is_panel_campaign(id))
with check (
  app.panel_management_allowed(event_id) or (
    coalesce(filters_snapshot->>'audience','') <> 'teachers'
    and nullif(filters_snapshot->>'panelId','') is null
    and nullif(filters_snapshot->>'schoolName','') is null
    and not ((subject_template || ' ' || body_template) ~* '\{\{[[:space:]]*(panel|scuola)[[:space:]]*\}\}')
  )
);
alter policy "panel campaigns acceptance delete" on public.email_campaigns
using (app.panel_management_allowed(event_id) or not app.is_panel_campaign(id));

alter policy "panel recipients acceptance read" on public.email_campaign_recipients
using (app.panel_management_allowed((select event_id from public.email_campaigns where id = campaign_id))
  or (recipient_type <> 'teacher' and not app.is_panel_campaign(campaign_id)));
alter policy "panel recipients acceptance insert" on public.email_campaign_recipients
with check (app.panel_management_allowed((select event_id from public.email_campaigns where id = campaign_id))
  or (recipient_type <> 'teacher' and not app.is_panel_campaign(campaign_id)));
alter policy "panel recipients acceptance update" on public.email_campaign_recipients
using (app.panel_management_allowed((select event_id from public.email_campaigns where id = campaign_id))
  or (recipient_type <> 'teacher' and not app.is_panel_campaign(campaign_id)))
with check (app.panel_management_allowed((select event_id from public.email_campaigns where id = campaign_id))
  or (recipient_type <> 'teacher' and not app.is_panel_campaign(campaign_id)));
alter policy "panel recipients acceptance delete" on public.email_campaign_recipients
using (app.panel_management_allowed((select event_id from public.email_campaigns where id = campaign_id))
  or (recipient_type <> 'teacher' and not app.is_panel_campaign(campaign_id)));
