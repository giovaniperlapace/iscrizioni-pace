-- Called after old empty configuration and its guarded replacement, within a rollback transaction.
insert into groups(id,event_id,name) values(f(17000),f(1),'Badge group');
insert into group_memberships(group_id,user_id,role,is_primary) values(f(17000),f(36),'capogruppo',true);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(17000),true,'manager','confirmed'),(f(11),f(17000),true,'manager','confirmed');
insert into participant_contacts(participant_id,email,is_primary) values(f(20),'badge-person@example.invalid',true);
set role service_role;
do $$ declare p uuid; rev integer; result jsonb; a uuid; sid uuid; nid uuid; batch uuid:=f(17001); instructions jsonb; notice jsonb; before_count integer;
begin
 select id into p from ceremony_plans where kind='closing';
 assert (select count(*)=3 and sum(capacity)=3500 and sum(assignable_limit)=3500 and not bool_or(numbered) from ceremony_sectors where plan_id=p);
 assert (select sum(quantity)=3500 from ceremony_quotas where plan_id=p);
 assert not (select enabled from closing_ceremony_badge_settings where plan_id=p);
 assert not has_table_privilege('authenticated','closing_ceremony_badge_settings','select');
 assert not has_function_privilege('anon','public.get_closing_ceremony_badge(uuid,uuid)','execute');
 assert not has_function_privilege('authenticated','public.set_closing_badge_delivery(uuid,uuid,integer,jsonb,boolean)','execute');
 -- Reserve is published normally; only nominal assignments have badges.
 select id into sid from ceremony_sectors where plan_id=p and layout_code='CLOSING_ORANGE';
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17002),'save',null,jsonb_build_object('action','group','sectorId',sid,'groupId',f(17000),'quantity',4,'seatIds','[]'::jsonb,'subjects','[]'::jsonb));assert result->>'status'='saved',result;
 assert not exists(select 1 from ceremony_publication_emails where plan_id=p);
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17003),'publish',null,null);assert result->>'status'='saved',result;
 assert (select count(*)=1 from ceremony_publication_emails where plan_id=p and user_id=f(36));
 assert claim_ceremony_publication_email() is null, 'delivery must remain disabled';
 select id into a from ceremony_allocations where plan_id=p and group_id=f(17000);
 select revision into rev from ceremony_plans where id=p;
 result:=assign_ceremony_group_members(f(1),f(36),a,rev,batch,jsonb_build_array(
  jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(11),'childId',null)));
 assert result->>'status'='saved',result;
 assert assign_ceremony_group_members(f(1),f(36),a,rev,batch,jsonb_build_array(
  jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(11),'childId',null)))->>'status'='saved';
 assert (select count(*)=3 from ceremony_publication_emails where plan_id=p), 'retry duplicated notification';
 assert (select jsonb_array_length(payload->'lines')=2 from ceremony_publication_emails where plan_id=p and registration_id=f(10));
 assert (select count(*)=3 from ceremony_nominees where plan_id=p);
 assert (select quantity=4 from ceremony_allocations where id=a);
 assert not exists(select 1 from ceremony_seat_claims where plan_id=p);
 select id into nid from ceremony_nominees where plan_id=p and registration_id=f(10) and child_id is null;
 assert get_closing_ceremony_badge(f(35),nid)->>'badgeCode'='CLOSING_ORANGE';
 assert get_closing_ceremony_badge(f(36),nid)->>'name'='Adult Test';
 assert get_closing_ceremony_badge(f(31),nid)->>'name'='Adult Test';
 begin perform get_closing_ceremony_badge(f(37),nid);raise exception 'foreign user read badge';exception when insufficient_privilege then null;end;
 assert get_my_ceremony_seats(f(1),f(35))->0->>'badgeCode'='CLOSING_ORANGE';
 assert get_ceremony_leader_tickets(f(1),f(36))->'allocations'->0->>'badgeCode'='CLOSING_ORANGE';
 assert app.ceremony_subject_seats(f(1),f(10))->0->>'badgeCode'='CLOSING_ORANGE';
 assert claim_ceremony_publication_email() is null;
 begin perform set_closing_badge_delivery(f(1),f(33),(select revision from ceremony_plans where id=p),'[]',true);raise exception 'enabled with malformed settings';exception when invalid_parameter_value then null;end;
 -- Approved email templates are independent from the separate instruction campaigns.
 instructions:='{}'::jsonb;
 assert app.closing_badge_instructions_valid(instructions);
 assert set_closing_badge_delivery(f(1),f(33),-1,instructions,true)->>'status'='conflict';
 begin perform set_closing_badge_delivery(f(1),f(36),(select revision from ceremony_plans where id=p),instructions,true);raise exception 'leader enabled delivery';exception when insufficient_privilege then null;end;
 assert set_closing_badge_delivery(f(1),f(33),(select revision from ceremony_plans where id=p),instructions,true)->>'status'='saved';
 update ceremony_publication_emails set created_at=now()-interval '2 hours' where plan_id=p and user_id=f(36);
 notice:=claim_ceremony_publication_email();
 assert notice->>'userId'=f(36)::text and notice->'payload'->'lines'->0->>'quantity'='4',notice;
 assert notice->'payload'->'lines'->0->>'badgeCode'='CLOSING_ORANGE';
 -- Select in deterministic order for contact and digest assertions.
 update ceremony_publication_emails set created_at=now()-interval '1 hour' where plan_id=p and registration_id=f(10);
 notice:=claim_ceremony_publication_email();
 assert notice->>'destinationEmail'='badge-person@example.invalid' and jsonb_array_length(notice->'payload'->'lines')=2,notice;
 assert notice->'payload'->>'badgeWorkflow'='true';
 assert notice->'payload'->'instructions'='{}'::jsonb;
 notice:=claim_ceremony_publication_email();
 assert notice->>'userId'=f(36)::text and notice->'payload'->>'noticeType'='leader_contacts',notice;
 assert jsonb_array_length(notice->'payload'->'lines')=1 and notice->'payload'->'lines'->0->>'name'='Other Test',notice;
 assert claim_ceremony_publication_email() is null;
 -- Removal invalidates downloads immediately; group reserve remains intact.
 result:=pair_ceremony_group_ticket(f(1),f(36),a,(select revision from ceremony_plans where id=p),f(17004),'revoke',null,null,null,nid);assert result->>'status'='saved';
 assert get_closing_ceremony_badge(f(35),nid) is null;
 assert (select quantity=4 from ceremony_allocations where id=a);
 select count(*) into before_count from ceremony_publication_emails;
 -- An over-capacity family batch must leave neither partial names nor messages.
 result:=assign_ceremony_group_members(f(1),f(36),a,(select revision from ceremony_plans where id=p),f(17005),jsonb_build_array(
 jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(41)),jsonb_build_object('registrationId',f(11),'childId',f(42))));
 assert result->>'status'='capacity',result;
 assert (select count(*) from ceremony_publication_emails)=before_count;
end $$;
reset role;
select 'PASS closing badges: three capacities, disabled delivery, publication and leader queue, personal email, family attachments contract, cumulative contact report, roles, QR projection, revocation and atomic retry';
