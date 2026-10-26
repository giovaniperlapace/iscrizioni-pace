-- Two leaders in the same group, but distinct explicit communication delegates.
insert into groups(id,event_id,name) values(f(17700),f(1),'Shared badge group'),(f(17701),f(1),'Different group');
insert into group_memberships(group_id,user_id,role,is_primary) values(f(17700),f(36),'capogruppo',true),(f(17700),f(37),'capogruppo',false);
insert into event_user_roles(event_id,user_id,role) values(f(1),f(37),'capogruppo');
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(17700),true,'manager','confirmed'),(f(11),f(17700),true,'manager','confirmed');
update registrations set source='capogruppo',created_by=case when id=f(10) then f(36) else f(37) end where id in(f(10),f(11));
insert into registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
select id,event_id,'delegation-test',jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',created_by)) from registrations where id in(f(10),f(11));
set role service_role;
do $$ declare p uuid; a uuid; s record; result jsonb; notice jsonb; lines jsonb;
begin
 select id into p from ceremony_plans where kind='closing';
 for s in select id,layout_code from ceremony_sectors where plan_id=p and layout_code in('CLOSING_ORANGE','CLOSING_GREEN') loop
  result:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),jsonb_build_object('action','group','sectorId',s.id,'groupId',f(17700),'quantity',case when s.layout_code='CLOSING_ORANGE' then 3 else 1 end,'seatIds','[]'::jsonb));assert result->>'status'='saved',result;
  select ca.id into a from ceremony_allocations ca join ceremony_quotas q on q.id=ca.quota_id where ca.plan_id=p and q.sector_id=s.id;
  result:=assign_ceremony_group_members(f(1),f(37),a,(select revision from ceremony_plans where id=p),gen_random_uuid(),case when s.layout_code='CLOSING_ORANGE' then
   jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(11),'childId',null))
   else jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(41))) end);assert result->>'status'='saved',result;
 end loop;
 assert app.closing_contact_leader(p,f(10),f(37))=f(36),'assigner must not replace explicit delegate';
 assert app.closing_contact_leader(p,f(11),f(36))=f(37);
 lines:=app.closing_leader_report_lines(p,f(36));assert jsonb_array_length(lines)=3;
 assert (select bool_and(x->>'communicationDelegated'='true' and x->>'groupId'=f(17700)::text and x->>'groupName'='Shared badge group' and x->>'registrationId'=f(10)::text) from jsonb_array_elements(lines) x);
 assert jsonb_array_length(app.closing_leader_report_lines(p,f(37)))=1;
 -- No explicit delegate: retain the contact report, never mark it for a PDF.
 update registration_questionnaire_answers set answers='{}' where registration_id=f(11);
 assert app.closing_explicit_delegate(p,f(11)) is null;
 assert (select count(*)=1 from jsonb_array_elements(app.closing_leader_report_lines(p,f(36))) x where x->>'communicationDelegated'='false');
 update registration_questionnaire_answers set answers=jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',f(37))) where registration_id=f(11);
 -- An invalid explicit delegate must not fall back to the assigning leader.
 update registration_questionnaire_answers set answers=jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',f(37))) where registration_id=f(10);
 assert app.closing_contact_leader(p,f(10),f(37)) is null;
 assert jsonb_array_length(app.closing_leader_report_lines(p,f(37)))=1;
 update registration_questionnaire_answers set answers=jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',f(36))) where registration_id=f(10);
 -- Removed group responsibility and reassigned participants invalidate the delegate.
 delete from group_memberships where group_id=f(17700) and user_id=f(36);
 assert app.closing_contact_leader(p,f(10),f(37)) is null;
 insert into group_memberships(group_id,user_id,role,is_primary) values(f(17700),f(36),'capogruppo',true);
 update participant_group_assignments set group_id=f(17701) where registration_id=f(10) and is_current;
 assert app.closing_contact_leader(p,f(10),f(37)) is null;
 update participant_group_assignments set group_id=f(17700) where registration_id=f(10) and is_current;
 -- Personal contact, revocations and unassigned children are excluded at claim.
 insert into participant_contacts(participant_id,email,is_primary) values(f(20),'personal-now@example.invalid',true);
 assert jsonb_array_length(app.closing_leader_report_lines(p,f(36)))=0;
 delete from participant_contacts where participant_id=f(20);
 update ceremony_nominees set revoked_at=now() where plan_id=p and child_id=f(40);
 assert jsonb_array_length(app.closing_leader_report_lines(p,f(36)))=2;
 assert claim_ceremony_publication_email() is null, 'email gate must stay disabled';
 update closing_ceremony_badge_settings set instructions=(select jsonb_object_agg(code,jsonb_build_object('it','Testo sintetico','en','Synthetic text')) from unnest(array['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN']) code),enabled=true where plan_id=p;
 update ceremony_publication_emails set created_at=now()-interval '1 hour' where plan_id=p and registration_id=f(10);
 notice:=claim_ceremony_publication_email();assert notice->>'userId'=f(36)::text and notice->'payload'->>'noticeType'='leader_contacts',notice;
 assert jsonb_array_length(notice->'payload'->'lines')=2;
 assert (select bool_and(x->>'communicationDelegated'='true' and x->>'registrationId'=f(10)::text) from jsonb_array_elements(notice->'payload'->'lines') x);
 assert (select count(*)=1 from ceremony_publication_emails where plan_id=p and error_code='included_in_leader_report');
 notice:=claim_ceremony_publication_email();assert notice->>'userId'=f(37)::text and jsonb_array_length(notice->'payload'->'lines')=1;
 assert claim_ceremony_publication_email() is null;
 assert not has_function_privilege('anon','app.closing_explicit_delegate(uuid,uuid)','execute');
 assert not has_function_privilege('authenticated','app.closing_leader_report_lines(uuid,uuid)','execute');
end $$;
reset role;
select 'PASS leader strip scope: explicit delegate over assigner, distinct recipients, current own groups, active nominees/minors, personal-email priority, invalid delegation fails closed, one report and disabled gate';
