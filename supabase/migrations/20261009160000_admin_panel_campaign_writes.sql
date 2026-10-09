-- Match the admin-only API boundary even for direct authenticated REST writes.
-- This supplements the read policies without changing ordinary campaigns.
create policy "panel campaigns acceptance insert" on public.email_campaigns
as restrictive for insert with check (
  app.is_admin() or (
    coalesce(filters_snapshot->>'audience','') <> 'teachers'
    and nullif(filters_snapshot->>'panelId','') is null
    and nullif(filters_snapshot->>'schoolName','') is null
    and not ((subject_template || ' ' || body_template) ~* '\{\{[[:space:]]*(panel|scuola)[[:space:]]*\}\}')
  )
);
create policy "panel campaigns acceptance update" on public.email_campaigns
as restrictive for update using (app.is_admin() or not app.is_panel_campaign(id))
with check (
  app.is_admin() or (
    coalesce(filters_snapshot->>'audience','') <> 'teachers'
    and nullif(filters_snapshot->>'panelId','') is null
    and nullif(filters_snapshot->>'schoolName','') is null
    and not ((subject_template || ' ' || body_template) ~* '\{\{[[:space:]]*(panel|scuola)[[:space:]]*\}\}')
  )
);
create policy "panel campaigns acceptance delete" on public.email_campaigns
as restrictive for delete using (app.is_admin() or not app.is_panel_campaign(id));
create policy "panel recipients acceptance insert" on public.email_campaign_recipients
as restrictive for insert with check (app.is_admin() or (recipient_type<>'teacher' and not app.is_panel_campaign(campaign_id)));
create policy "panel recipients acceptance update" on public.email_campaign_recipients
as restrictive for update using (app.is_admin() or (recipient_type<>'teacher' and not app.is_panel_campaign(campaign_id)))
with check (app.is_admin() or (recipient_type<>'teacher' and not app.is_panel_campaign(campaign_id)));
create policy "panel recipients acceptance delete" on public.email_campaign_recipients
as restrictive for delete using (app.is_admin() or (recipient_type<>'teacher' and not app.is_panel_campaign(campaign_id)));
