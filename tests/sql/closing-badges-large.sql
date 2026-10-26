insert into groups(id,event_id,name) values(f(17100),f(1),'Large badge group');
insert into group_memberships(group_id,user_id,role,is_primary) values(f(17100),f(36),'capogruppo',true);
insert into participants(id,first_name,last_name,public_code) select f(170000+n),'Synthetic','Member '||lpad(n::text,4,'0'),(5000+n)::text from generate_series(1,1005) n;
insert into registrations(id,event_id,participant_id,status) select f(180000+n),f(1),f(170000+n),'submitted' from generate_series(1,1005) n;
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) select f(180000+n),f(17100),true,'manager','confirmed' from generate_series(1,1005) n;
set role service_role;
do $$ declare p uuid; a uuid; r jsonb; notice jsonb; subjects jsonb;
begin
 select id into p from ceremony_plans where kind='closing';
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17101),'save',null,
 jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where plan_id=p and layout_code='CLOSING_GREEN'),'groupId',f(17100),'quantity',1005,'seatIds','[]'::jsonb,'subjects','[]'::jsonb));assert r->>'status'='saved',r;
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17102),'publish',null,null);assert r->>'status'='saved';
 select id into a from ceremony_allocations where plan_id=p and group_id=f(17100);
 select jsonb_agg(jsonb_build_object('registrationId',f(180000+n),'childId',null)) into subjects from generate_series(1,1005) n;
 r:=assign_ceremony_group_members(f(1),f(36),a,(select revision from ceremony_plans where id=p),f(17103),subjects);assert r->>'status'='saved',r;
 assert (select count(*)=1005 from ceremony_nominees where plan_id=p);
 assert (select count(*)=1006 from ceremony_publication_emails where plan_id=p);
 assert claim_ceremony_publication_email() is null;
 -- A personal email added after nomination must take precedence over the leader report.
 insert into participant_contacts(participant_id,email,is_primary) values(f(170001),'new-personal@example.invalid',true);
 update closing_ceremony_badge_settings set instructions=(select jsonb_object_agg(code,jsonb_build_object('it','Testo sintetico','en','Synthetic text')) from unnest(array['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN']) code),enabled=true where plan_id=p;
 update ceremony_publication_emails set created_at=now()-interval '2 hours' where plan_id=p and registration_id=f(180001);
 notice:=claim_ceremony_publication_email();assert notice->>'destinationEmail'='new-personal@example.invalid',notice;
 update ceremony_publication_emails set created_at=now()-interval '1 hour' where plan_id=p and user_id=f(36);
 notice:=claim_ceremony_publication_email();assert notice->'payload'->'lines'->0->>'quantity'='1005';
 notice:=claim_ceremony_publication_email();
 assert notice->'payload'->>'noticeType'='leader_contacts' and jsonb_array_length(notice->'payload'->'lines')=1004;
 assert not exists(select 1 from jsonb_array_elements(notice->'payload'->'lines') x where x->>'registrationId'=f(180001)::text);
 assert (select count(*)=1003 from ceremony_publication_emails where plan_id=p and state='skipped' and error_code='included_in_leader_report');
 assert claim_ceremony_publication_email() is null;
 update ceremony_publication_emails set updated_at=now()-interval '15 minutes' where plan_id=p and state='sending';
 assert claim_ceremony_publication_email() is null;
 assert (select count(*)=3 from ceremony_publication_emails where plan_id=p and state='uncertain');
 -- All source notices remain tied to the one report, including an uncertain result.
 assert (select count(distinct payload->>'leaderReportId')=1 from ceremony_publication_emails where plan_id=p and state='skipped');
end $$;
reset role;
select 'PASS closing report: 1005 real batch nominations, new personal email prioritized, 1004 people in one report, 1003 linked sources, no automatic retry after uncertain send';
