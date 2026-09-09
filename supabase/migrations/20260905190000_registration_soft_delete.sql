-- Block 5: preserve registrations and their history; explicit lifecycle RPC.
begin;

alter table public.registrations
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null,
  add column deletion_reason text,
  add column restored_at timestamptz,
  add column restored_by uuid references auth.users(id) on delete set null,
  add constraint registration_deletion_reason check (
    deleted_at is null or (deletion_reason is not null and char_length(trim(deletion_reason)) between 3 and 500)
  );
create index registrations_operational_event_idx on public.registrations(event_id, submitted_at desc)
  where deleted_at is null;
alter table public.qr_tokens add column suspended_by_registration_deletion boolean not null default false;

create function app.registration_is_operational(target_registration_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.registrations where id = target_registration_id and deleted_at is null);
$$;
grant execute on function app.registration_is_operational(uuid) to authenticated, service_role;

-- Restrictive policies compose with existing event/owner/group authorization.
create policy "registrations hide deleted" on public.registrations as restrictive for select to authenticated
  using (deleted_at is null or app.is_admin());
create policy "registrations prevent editing deleted" on public.registrations as restrictive for update to authenticated
  using (deleted_at is null) with check (deleted_at is null);

do $$ declare t text; begin
  foreach t in array array['participant_group_assignments','participant_consents','accessibility_needs',
    'event_attendance_choices','moment_attendance_choices','registration_questionnaire_answers',
    'registration_children','participant_event_services','qr_tokens','check_ins'] loop
    execute format('create policy "only operational registrations" on public.%I as restrictive for all to authenticated using (app.registration_is_operational(registration_id)) with check (app.registration_is_operational(registration_id))', t);
  end loop;
end $$;

create function app.protect_registration_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- An intentional maintenance operation by the database owner is separate
    -- from application deletion, including service-role application requests.
    if current_user <> 'postgres' then raise insufficient_privilege using message = 'Use soft delete'; end if;
    return old;
  end if;
  if current_user not in ('service_role', 'postgres') then
    if tg_op = 'INSERT' then
      if new.deleted_at is not null or new.deleted_by is not null or new.deletion_reason is not null
        or new.restored_at is not null or new.restored_by is not null then
        raise insufficient_privilege using message = 'Lifecycle fields require the server RPC';
      end if;
    elsif row(new.deleted_at,new.deleted_by,new.deletion_reason,new.restored_at,new.restored_by)
      is distinct from row(old.deleted_at,old.deleted_by,old.deletion_reason,old.restored_at,old.restored_by) then
      raise insufficient_privilege using message = 'Lifecycle fields require the server RPC';
    end if;
  end if;
  return new;
end $$;
create trigger protect_registration_lifecycle before insert or update or delete on public.registrations
  for each row execute function app.protect_registration_lifecycle();

-- Serialize check-in and QR issuance with deletion, including service-role callers.
create function app.require_operational_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.registrations where id = new.registration_id and deleted_at is null for share;
  if not found then raise check_violation using message = 'Registration is deleted or unavailable'; end if;
  return new;
end $$;
create trigger check_in_requires_operational_registration before insert or update on public.check_ins
  for each row execute function app.require_operational_registration();
create trigger qr_issue_requires_operational_registration before insert on public.qr_tokens
  for each row execute function app.require_operational_registration();

create trigger group_update_requires_operational_registration before insert or update on public.participant_group_assignments
  for each row execute function app.require_operational_registration();
create trigger service_update_requires_operational_registration before insert or update on public.participant_event_services
  for each row execute function app.require_operational_registration();
create policy "tags only operational registrations" on public.participant_operational_tags as restrictive for all to authenticated
  using (exists(select 1 from public.operational_tags t join public.registrations r on r.event_id=t.event_id
    where t.id=tag_id and r.participant_id=participant_operational_tags.participant_id and r.deleted_at is null))
  with check (exists(select 1 from public.operational_tags t join public.registrations r on r.event_id=t.event_id
    where t.id=tag_id and r.participant_id=participant_operational_tags.participant_id and r.deleted_at is null));

create function public.set_registration_deleted(
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
end $$;
revoke all on function public.set_registration_deleted(uuid,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.set_registration_deleted(uuid,uuid,uuid,text,boolean) to service_role;
commit;
