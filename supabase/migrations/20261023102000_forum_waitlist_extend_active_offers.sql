-- Extend still-live existing offers to two hours from their original offered_at.
-- Never restart the clock, revive expired offers, shorten a later deadline or resend.
with extended as (
 update public.panel_waitlist
 set expires_at=offered_at+interval '2 hours'
 where status='offered' and expires_at>clock_timestamp()
  and expires_at<offered_at+interval '2 hours'
 returning id,event_id,offered_at,expires_at
)
insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 select event_id,null,'panel.waitlist_window_extended','panel_waitlist',id,
  jsonb_build_object('offered_at',offered_at,'expires_at',expires_at,'duration_minutes',120)
 from extended;
