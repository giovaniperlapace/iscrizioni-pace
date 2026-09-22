-- Release deleted participant identities without deleting history or operational accounts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.registrations, public.participants in share row exclusive mode;
create or replace function public.set_registration_deleted(
  p_registration_id uuid, p_participant_id uuid, p_actor_user_id uuid,
  p_reason text, p_restore boolean default false
) returns void language plpgsql security invoker set search_path = '' as $$
declare r public.registrations; is_admin boolean; reason text := trim(p_reason); affected_campaigns uuid[];
begin
  select * into strict r from public.registrations where id=p_registration_id and participant_id=p_participant_id for update;
  select exists(select 1 from public.event_user_roles where user_id=p_actor_user_id and role='admin' and event_id is null) into is_admin;
  if not is_admin and (p_restore or not exists(select 1 from public.event_user_roles where user_id=p_actor_user_id and role='manager' and event_id=r.event_id)) then
    raise insufficient_privilege using message='Forbidden';
  end if;
  if reason is null or char_length(reason) not between 3 and 500 then raise check_violation using message='Reason required (3–500 characters)'; end if;
  if p_restore then
    if r.deleted_at is null then raise check_violation using message='Registration is not deleted'; end if;
    -- A reused address belongs to the new active registration. Do not revive
    -- a second registration under that address or reconnect its old account.
    if exists (
      select 1 from public.participant_contacts old_contact
      join public.participant_contacts current_contact on current_contact.email=old_contact.email
      join public.registrations active on active.participant_id=current_contact.participant_id
      where old_contact.participant_id=r.participant_id and old_contact.email is not null
        and active.event_id=r.event_id and active.deleted_at is null
        and active.status <> 'cancelled' and active.id <> r.id
    ) then raise sqlstate 'PT409' using message='Email already used by an active registration'; end if;
    update public.registrations set deleted_at=null, deleted_by=null, deletion_reason=null,
      restored_at=now(), restored_by=p_actor_user_id where id=r.id;
    update public.qr_tokens set status='active', revoked_at=null, suspended_by_registration_deletion=false
      where registration_id=r.id and suspended_by_registration_deletion and status='revoked'
        and (expires_at is null or expires_at>now());
  else
    if r.deleted_at is not null then raise check_violation using message='Registration is already deleted'; end if;
    update public.registrations set deleted_at=now(), deleted_by=p_actor_user_id, deletion_reason=reason where id=r.id;
    update public.qr_tokens set status='revoked', revoked_at=now(), suspended_by_registration_deletion=true
      where registration_id=r.id and status='active';
    with skipped as (update public.email_campaign_recipients cr set status='skipped', error_code='registration_deleted', processing_started_at=null
      from public.email_campaigns c, public.participants p
      where c.id=cr.campaign_id and c.event_id=r.event_id and p.id=r.participant_id
        and (cr.registration_id=r.id or (cr.recipient_type='group_leader' and cr.participant_id=r.participant_id)
          or cr.recipient_user_id=p.auth_user_id or cr.delegate_user_id=p.auth_user_id)
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
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
  values(r.event_id,p_actor_user_id,case when p_restore then 'registration.restored' else 'registration.soft_deleted' end,
    'registrations',r.id,jsonb_build_object('reason',reason,'participant_id',r.participant_id,
      'previous_deleted_at',r.deleted_at,'previous_deleted_by',r.deleted_by,'previous_deletion_reason',r.deletion_reason,
      'participant_record_retained',true,'auth_account_retained',true));
  -- Run after queue cancellation, which still needs the previous auth_user_id.
  if not p_restore and not exists (
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
-- Existing deletions receive the same treatment; participants active in another
-- event retain their account. Email contacts and all historical content remain.
with detached as (
  update public.participants p set auth_user_id=null
  where p.auth_user_id is not null
    and exists(select 1 from public.registrations r where r.participant_id=p.id and r.deleted_at is not null)
    and not exists(select 1 from public.registrations r where r.participant_id=p.id and r.deleted_at is null)
  returning p.id
)
insert into public.audit_logs(action,entity_table,entity_id,metadata)
select 'participant.deleted_identity_detached','participants',id,
  '{"reason":"email_reuse","migration":"20260922200000"}'::jsonb from detached;
commit;
