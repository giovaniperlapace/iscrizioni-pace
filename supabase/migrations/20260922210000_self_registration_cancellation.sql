-- Owner cancellation uses the established soft-delete lifecycle, without extending
-- the operational delete/restore RPC's privileges. No historical rows are removed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create function public.cancel_own_registration(p_registration_id uuid, p_actor_user_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  r public.registrations;
  reason text := 'Cancelled by the participant';
  affected_campaigns uuid[];
begin
  select * into r from public.registrations where id=p_registration_id for update;
  if not found then raise insufficient_privilege using message='Registration unavailable'; end if;
  -- Idempotent retry after identity detachment, restricted to the original actor.
  if r.deleted_at is not null and r.deleted_by=p_actor_user_id and exists (
    select 1 from public.audit_logs where entity_id=r.id and entity_table='registrations'
      and action='registration.self_cancelled' and actor_user_id=p_actor_user_id
  ) then return; end if;
  if r.deleted_at is not null or p_actor_user_id is null or not exists (
    select 1 from public.participants where id=r.participant_id and auth_user_id=p_actor_user_id
    for update
  ) then raise insufficient_privilege using message='Registration unavailable'; end if;
  perform 1 from public.events where id=r.event_id and is_current for share;
  if not found then raise insufficient_privilege using message='Event unavailable'; end if;
    update public.registrations set deleted_at=now(), deleted_by=p_actor_user_id, deletion_reason=reason where id=r.id;
    update public.qr_tokens set status='revoked', revoked_at=now(), suspended_by_registration_deletion=true
      where registration_id=r.id and status='active';
    with skipped as (update public.email_campaign_recipients cr set status='skipped', error_code='registration_deleted', processing_started_at=null
      from public.email_campaigns c, public.participants p
      where c.id=cr.campaign_id and c.event_id=r.event_id and p.id=r.participant_id
        and cr.registration_id=r.id
        and cr.status in ('pending','scheduled','sending') returning cr.campaign_id)
    select array_agg(distinct campaign_id) into affected_campaigns from skipped;
    -- Keep preview totals/test approval current, and finish queues emptied by deletion.
    -- Sent campaign counts and test metadata remain historical.
    update public.email_campaigns c set
      recipient_count=case when c.sent_at is null then
        (select count(*) from public.email_campaign_recipients where campaign_id=c.id and status<>'skipped')
        else c.recipient_count end,
      test_sent_at=case when c.sent_at is null then null else c.test_sent_at end,
      test_sent_to_user_id=case when c.sent_at is null then null else c.test_sent_to_user_id end,
      status=case when c.status in ('scheduled','sending') and not exists(
        select 1 from public.email_campaign_recipients where campaign_id=c.id and status in ('pending','scheduled','sending')
      ) then case
        when not exists(select 1 from public.email_campaign_recipients where campaign_id=c.id and status='failed') then 'completed'
        when not exists(select 1 from public.email_campaign_recipients where campaign_id=c.id and status='sent') then 'failed'
        else 'partial' end else c.status end
      where c.id=any(affected_campaigns);
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
  values(r.event_id,p_actor_user_id,'registration.self_cancelled','registrations',r.id,
    jsonb_build_object('reason',reason,'participant_id',r.participant_id,
      'participant_record_retained',true,'auth_account_retained',true));
  -- Detach only identities with no remaining live registration.
  if not exists (
    select 1 from public.registrations where participant_id=r.participant_id and deleted_at is null
  ) then
    with detached as (
      update public.participants set auth_user_id=null
      where id=r.participant_id and auth_user_id is not null returning id
    )
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    select r.event_id,p_actor_user_id,'participant.deleted_identity_detached','participants',id,
      jsonb_build_object('registration_id',r.id,'reason','email_reuse') from detached;
  end if;
end $$;
revoke all on function public.cancel_own_registration(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_own_registration(uuid,uuid) to service_role;
commit;
