-- Synthetic reproduction of the explicitly approved 20 B + 30 C legacy reset.
insert into groups(id,event_id,name) values(f(17600),f(1),'Legacy reset group');
insert into group_memberships(group_id,user_id,role,is_primary) values(f(17600),f(36),'capogruppo',true);
update participant_group_assignments set is_current=false where registration_id=f(10);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(17600),true,'manager','confirmed');
do $$ declare p uuid; item record; result jsonb;
begin
 select id into p from ceremony_plans where kind='closing';
 for item in select id,case layout_code when 'B' then 20 else 30 end qty from ceremony_sectors where plan_id=p and layout_code in('B','C') loop
  result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,jsonb_build_object('action','group','sectorId',item.id,'groupId',f(17600),'quantity',item.qty,'seatIds','[]'::jsonb,'subjects','[]'::jsonb));assert result->>'status'='saved',result;
 end loop;
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17601),'publish',null,null);assert result->>'status'='saved',result;
 result:=assign_ceremony_group_members(f(1),f(36),(select a.id from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id join ceremony_sectors s on s.id=q.sector_id where a.plan_id=p and s.layout_code='B'),(select revision from ceremony_plans where id=p),f(17602),jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null)));assert result->>'status'='saved',result;
 update ceremony_publication_emails set state='accepted' where plan_id=p;
end $$;
create temp table reset_email_before as select * from ceremony_publication_emails;
create temp table reset_nominee_before as select * from ceremony_nominees;
select set_config('app.closing_reset_expected',jsonb_build_object('revision',p.revision,
 'allocations',(select jsonb_agg(jsonb_build_object('id',a.id,'groupId',f(17600),'quantity',a.quantity,'sector',s.layout_code,'revoked',false) order by a.id) from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id join ceremony_sectors s on s.id=q.sector_id where a.plan_id=p.id),
 'nominees',(select jsonb_agg(jsonb_build_object('id',n.id,'allocationId',n.allocation_id,'revoked',false) order by n.id) from ceremony_nominees n where n.plan_id=p.id),
 'drafts',(select jsonb_agg(jsonb_build_object('id',d.id,'state','published','data',d.data) order by d.id) from ceremony_assignment_drafts d where d.plan_id=p.id),
 'emails',(select jsonb_agg(jsonb_build_object('id',m.id,'state','accepted') order by m.id) from ceremony_publication_emails m where m.plan_id=p.id))::text,true) from ceremony_plans p where kind='closing';
-- APPLY AUTHORIZED RESET AND REPLACEMENT HERE
do $$ declare archived jsonb; p uuid;
begin
 select id into p from ceremony_plans where kind='closing';
 assert (select count(*)=3 and sum(capacity)=3500 from ceremony_sectors where plan_id=p);
 assert not exists(select 1 from ceremony_allocations where plan_id=p);
 assert not exists(select 1 from ceremony_nominees where plan_id=p);
 assert not exists(select 1 from ceremony_assignment_drafts where plan_id=p);
 assert not exists((select * from reset_email_before except select * from ceremony_publication_emails) union all (select * from ceremony_publication_emails except select * from reset_email_before));
 assert (select count(*)=2 from audit_logs where action='ceremony.desk_revoke' and entity_id in(select (x->>'id')::uuid from jsonb_array_elements(current_setting('app.closing_reset_expected')::jsonb->'allocations') x));
 select metadata into archived from audit_logs where action='ceremony.closing_legacy_archived' and entity_id=p;
 assert jsonb_array_length(archived->'before'->'allocations')=2;
 assert (select sum((x->>'quantity')::integer)=50 from jsonb_array_elements(archived->'before'->'allocations') x);
 assert archived->'before'->'nominees'=(select jsonb_agg(to_jsonb(n) order by n.id) from reset_nominee_before n where plan_id=p);
 assert jsonb_array_length(archived->'before'->'drafts')=2;
 assert (select bool_and(x->>'revoked_at' is not null) from jsonb_array_elements(archived->'revokedAllocations') x);
 assert (select bool_and(x->>'revoked_at' is not null) from jsonb_array_elements(archived->'revokedNominees') x);
 assert not (select enabled from closing_ceremony_badge_settings where plan_id=p);
 assert claim_ceremony_publication_email() is null;
end $$;
select 'PASS authorized legacy reset: 50 places and one nominee revoked, complete history archived, delivered emails preserved, three empty sectors and delivery disabled';
