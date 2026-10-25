-- Appended to the canonical sector fixture; all changes roll back.
set role service_role;
do $$ declare p uuid; s uuid; other uuid; rev integer; r jsonb; cmd jsonb; dr uuid; before_map jsonb; begin
 select id into p from ceremony_plans where kind='opening';
 select id into s from ceremony_sectors where name='C';
 select id into other from ceremony_sectors where name='D';
 select seats into before_map from ceremony_map_versions where plan_id=p and state='published';
 select revision into rev from ceremony_plans where id=p;
 assert set_ceremony_overbooking(f(1),f(31),p,s,rev,f(13001),20)->>'status'='saved';
 assert set_ceremony_overbooking(f(1),f(31),p,s,rev,f(13001),20)->>'status'='saved','retry';
 assert (select count(*) from audit_logs where action='ceremony.overbooking_updated')=1;
 begin perform set_ceremony_overbooking(f(1),f(31),p,s,rev,f(13001),21);raise exception 'changed retry accepted';exception when invalid_parameter_value then null;end;
 assert set_ceremony_overbooking(f(1),f(31),p,s,rev,f(13002),30)->>'status'='conflict';
 begin perform set_ceremony_overbooking(f(1),f(32),p,s,rev,f(13003),20);raise exception 'Viewer bypass';exception when insufficient_privilege then null;end;
 begin perform set_ceremony_overbooking(f(1),f(36),p,s,rev,f(13004),20);raise exception 'Leader bypass';exception when insufficient_privilege then null;end;
 begin perform set_ceremony_overbooking(f(2),f(33),p,s,rev,f(13005),20);raise exception 'Event bypass';exception when insufficient_privilege then null;end;
 begin perform set_ceremony_overbooking(f(1),f(31),p,s,rev,f(13006),-1);raise exception 'Negative extra';exception when invalid_parameter_value then null;end;
 assert (select capacity=600 and assignable_limit=600 from ceremony_sectors where id=s),'physical capacity changed';
 assert (select quantity=600 from ceremony_quotas where sector_id=s),'quota changed';
 assert (select seats=before_map from ceremony_map_versions where plan_id=p and state='published'),'map changed';
 assert not exists(select 1 from ceremony_publication_emails),'setting sent notifications';
 r:=get_ceremony_draft_desk(f(1),f(31),'opening');
 assert (select (x->>'remaining')::int=620 and (x->>'baseAssignable')::int=600 and (x->>'overbooking')::int=20 from jsonb_array_elements(r->'sectors') x where x->>'id'=s::text),r;
 cmd:=jsonb_build_object('action','group','sectorId',s,'quantity',619,'groupId',f(7701),'subjects','[]'::jsonb,'seatIds','[]'::jsonb);
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13007),'save',null,cmd);assert r->>'status'='saved',r;
 select id into dr from ceremony_assignment_drafts where state='draft';
 assert set_ceremony_overbooking(f(1),f(31),p,s,(select revision from ceremony_plans where id=p),f(13008),18)->>'status'='overbooking_in_use';
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13009),'save',dr,cmd||jsonb_build_object('sectorId',other));assert r->>'status'='capacity',r;
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13010),'save',dr,cmd||jsonb_build_object('quantity',621));assert r->>'status'='capacity',r;
 -- Publish all extra reserves atomically; assign the final extra place nominally.
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13011),'publish',null,null);assert r->>'status'='saved',r;
 assert (select sum(a.quantity)=619 from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id where q.sector_id=s and a.revoked_at is null);
 cmd:=jsonb_build_object('action','assign_direct','sectorId',s,'quantity',1,'groupId',null,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',f(42))),'seatIds','[]'::jsonb);
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13012),'save',null,cmd);assert r->>'status'='saved',r;
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13013),'publish',null,null);assert r->>'status'='saved',r;
 assert set_ceremony_overbooking(f(1),f(31),p,s,(select revision from ceremony_plans where id=p),f(13014),19)->>'status'='overbooking_in_use';
 assert (select sum(a.quantity)=620 from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id where q.sector_id=s and a.revoked_at is null);
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13015),cmd||jsonb_build_object('subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(41)))));assert r->>'status'='capacity',r;
 -- Freeing reserves permits a reduction, retaining the published nominal assignment.
 r:=revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13016),'allocation',(select a.id from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id where q.sector_id=s and a.group_id=f(7701) and a.revoked_at is null));assert r->>'status'='saved',r;
 assert set_ceremony_overbooking(f(1),f(31),p,s,(select revision from ceremony_plans where id=p),f(13017),0)->>'status'='saved';
 assert not has_function_privilege('authenticated','public.set_ceremony_overbooking(uuid,uuid,uuid,uuid,integer,uuid,integer)','execute');
 assert not has_function_privilege('anon','app.ceremony_quota_budget(uuid)','execute');
 -- Two relatives can belong to different sectors; statistics are restricted to this QR.
 cmd:=jsonb_build_object('action','assign_direct','sectorId',other,'quantity',1,'groupId',null,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null)),'seatIds','[]'::jsonb);
 -- assign (not assign_direct) allows this adult's already assigned child to remain in C.
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13018),cmd||jsonb_build_object('action','assign'));assert r->>'status'='saved',r;
 insert into ceremony_reception_assignments values(f(1),f(30),'opening',f(33));
 r:=reception_ceremony_check_in(f(1),f(30),'opening','code','TST2');assert r->>'status'='valid',r;
 assert jsonb_array_length(r->'sectorStatistics')=2,r;
 assert (select sum((x->>'entered')::int)=0 from jsonb_array_elements(r->'sectorStatistics') x),r;
 r:=reception_ceremony_check_in(f(1),f(30),'opening','code','TST2','enter',f(13019),array[f(42)]);
 assert (select (x->>'entered')::int=1 from jsonb_array_elements(r->'sectorStatistics') x where x->>'sector'='C'),r;
 assert (select (x->>'entered')::int=0 from jsonb_array_elements(r->'sectorStatistics') x where x->>'sector'='D'),r;
 r:=reception_ceremony_check_in(f(1),f(30),'opening','code','TST2','enter',f(13019),array[f(42)]);assert r->>'outcome'='replayed',r;
 assert (select (x->>'entered')::int=1 from jsonb_array_elements(r->'sectorStatistics') x where x->>'sector'='C'),r;
 -- Revoking the child's assignment must not remove that child's already recorded admission.
 r:=revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13021),'nominee',(select id from ceremony_nominees where subject_id=f(42) and revoked_at is null));assert r->>'status'='saved',r;
 assert (select count(*)=1 from check_ins where ceremony_sector_id=s and cancelled_at is null),'revocation erased occupancy';
 -- Give the adult the same sector so that the current QR still exposes C after revocation.
 r:=revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13022),'nominee',(select id from ceremony_nominees where subject_id=f(11) and revoked_at is null));assert r->>'status'='saved',r;
 cmd:=jsonb_build_object('action','assign','sectorId',s,'quantity',1,'groupId',null,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null)),'seatIds','[]'::jsonb);
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13023),cmd);assert r->>'status'='saved',r;
 r:=reception_ceremony_check_in(f(1),f(30),'opening','code','TST2');assert (r->'sectorStatistics'->0->>'entered')::int=1,r;
 r:=reception_ceremony_check_in(f(1),f(30),'opening','code','TST2','cancel',f(13020),array[f(42)],1);
 assert (select (x->>'entered')::int=0 from jsonb_array_elements(r->'sectorStatistics') x where x->>'sector'='C'),r;
 assert reception_ceremony_check_in(f(1),f(30),'opening','code','TST6')->>'status'='invalid';
 begin perform reception_ceremony_check_in(f(1),f(32),'opening','code','TST2');raise exception 'Unauthorized statistics';exception when insufficient_privilege then null;end;
end $$;
select 'PASS overbooking: physical capacity preserved, budgets enforced, publication, retry, roles, reduction guards and QR-scoped fresh sector entry/cancellation counts';

-- Operators retain the admission decision even when physical capacity has been reached.
do $$ declare p uuid; r jsonb; begin
 r:=save_ceremony(f(1),f(33),'closing',-1,'configure','{"location":"Tiny synthetic sector","capacity":1,"startsAt":"2026-10-27T16:30","endsAt":"2026-10-27T19:00","state":"validated","attendancePart":"afternoon"}');assert r->>'status'='saved',r;
 select id into p from ceremony_plans where kind='closing';
 r:=save_ceremony(f(1),f(33),'closing',(select revision from ceremony_plans where id=p),'sector',jsonb_build_object('id',f(13080),'name','Tiny','capacity',1));assert r->>'status'='saved',r;
 r:=save_ceremony(f(1),f(33),'closing',(select revision from ceremony_plans where id=p),'quota',jsonb_build_object('id',f(13081),'sectorId',f(13080),'category','Participants','quantity',1));assert r->>'status'='saved',r;
 update ceremony_sectors set numbered=false where id=f(13080);
 assert set_ceremony_overbooking(f(1),f(31),p,f(13080),(select revision from ceremony_plans where id=p),f(13082),1)->>'status'='saved';
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(13083),jsonb_build_object('action','assign_direct','sectorId',f(13080),'quantity',2,'groupId',null,'seatIds','[]'::jsonb,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null),jsonb_build_object('registrationId',f(11),'childId',f(42)))));assert r->>'status'='saved',r;
 insert into ceremony_reception_assignments values(f(1),f(30),'closing',f(33));
 r:=reception_ceremony_check_in(f(1),f(30),'closing','code','TST2','enter',f(13084),array[f(11),f(42)]);assert r->>'status'='valid',r;
 assert r->'sectorStatistics'->0->>'capacity'='1' and r->'sectorStatistics'->0->>'entered'='2' and r->'sectorStatistics'->0->>'overbooking'='1',r;
 assert (select count(*)=2 from check_ins where ceremony_sector_id=f(13080) and cancelled_at is null);
end $$;
select 'PASS ceremony admission beyond physical capacity remains an explicit operator decision; closing and opening counts stay separate';
