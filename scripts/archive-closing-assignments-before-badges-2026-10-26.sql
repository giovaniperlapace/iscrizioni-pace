-- Explicitly authorized reset only. Run immediately before the replacement in
-- the same transaction, after backup, with an exact reviewed expected snapshot.
-- Canonical revocations and full historical rows are retained in the audit;
-- delivered notification records and idempotency receipts remain untouched.
do $$
declare e uuid:=current_setting('app.closing_event')::uuid;
 actor uuid:=current_setting('app.closing_actor')::uuid;
 expected jsonb:=current_setting('app.closing_reset_expected')::jsonb;
 p public.ceremony_plans; actual jsonb; before_rows jsonb; archived jsonb;
 a record; result jsonb;
begin
 if not app.ceremony_authorize(e,actor,true) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 select * into p from public.ceremony_plans where event_id=e and kind='closing' for update;
 if p.id is null or p.layout_key is distinct from 'assisi-closing-2026' then raise exception 'Unexpected legacy closing layout';end if;
 select jsonb_build_object('revision',p.revision,
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'groupId',x.group_id,'quantity',x.quantity,'sector',s.layout_code,'revoked',x.revoked_at is not null) order by x.id) from public.ceremony_allocations x join public.ceremony_quotas q on q.id=x.quota_id join public.ceremony_sectors s on s.id=q.sector_id where x.plan_id=p.id),'[]'),
  'nominees',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'allocationId',x.allocation_id,'revoked',x.revoked_at is not null) order by x.id) from public.ceremony_nominees x where x.plan_id=p.id),'[]'),
  'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'state',x.state,'data',x.data) order by x.id) from public.ceremony_assignment_drafts x where x.plan_id=p.id),'[]'),
  'emails',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'state',x.state) order by x.id) from public.ceremony_publication_emails x where x.plan_id=p.id),'[]')) into actual;
 if expected is null or actual is distinct from expected then raise exception 'Closing reset snapshot changed; inspect before proceeding';end if;
 if exists(select 1 from public.ceremony_map_versions where plan_id=p.id)
 or exists(select 1 from public.ceremony_seat_identities where plan_id=p.id)
 or exists(select 1 from public.ceremony_seat_claims where plan_id=p.id)
 or exists(select 1 from public.check_ins where moment_id=p.moment_id or ceremony_sector_id in(select id from public.ceremony_sectors where plan_id=p.id))
 or exists(select 1 from public.ceremony_publication_emails where plan_id=p.id and state in('queued','sending'))
 or exists(select 1 from public.ceremony_allocations where plan_id=p.id and group_id is null)
 or exists(select 1 from public.ceremony_assignment_drafts where plan_id=p.id and state<>'published') then
  raise exception 'Unexpected closing operational records; reset aborted';
 end if;
 before_rows:=jsonb_build_object(
  'plan',to_jsonb(p),
  'sectors',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_sectors x where plan_id=p.id),
  'quotas',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_quotas x where plan_id=p.id),
  'allocations',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_allocations x where plan_id=p.id),
  'nominees',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_nominees x where plan_id=p.id),
  'drafts',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_assignment_drafts x where plan_id=p.id));
 for a in select id from public.ceremony_allocations where plan_id=p.id and revoked_at is null order by id loop
  result:=public.revoke_ceremony_assignment(e,actor,p.id,(select revision from public.ceremony_plans where id=p.id),gen_random_uuid(),'allocation',a.id);
  if result->>'status' is distinct from 'saved' then raise exception 'Closing revocation failed: %',result;end if;
 end loop;
 if exists(select 1 from public.ceremony_allocations where plan_id=p.id and revoked_at is null)
 or exists(select 1 from public.ceremony_nominees where plan_id=p.id and revoked_at is null) then raise exception 'Closing revocation incomplete';end if;
 archived:=jsonb_build_object('before',before_rows,'approvedSnapshot',actual,
  'revokedAllocations',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_allocations x where plan_id=p.id),
  'revokedNominees',(select jsonb_agg(to_jsonb(x) order by x.id) from public.ceremony_nominees x where plan_id=p.id));
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(e,actor,'ceremony.closing_legacy_archived','ceremony_plans',p.id,archived);
 -- The archived rows reference retired sectors, so remove them from the live
 -- ledger only after their complete original and revoked versions are saved.
 delete from public.ceremony_nominees where plan_id=p.id;
 delete from public.ceremony_allocations where plan_id=p.id;
 delete from public.ceremony_assignment_drafts where plan_id=p.id;
 perform set_config('app.closing_reset_archive',p.id::text,true);
end $$;
