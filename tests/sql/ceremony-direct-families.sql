-- Loaded after the sector fixture setup, in the same rollback-only transaction.
set role service_role;
do $$ declare p uuid; s uuid; rev integer; req uuid:=f(7890); c jsonb; r jsonb; v jsonb; before_count integer; before_revision integer; begin
 select id into p from ceremony_plans where kind='opening';
 select id into s from ceremony_sectors where name='B';
 -- Remove the pre-existing child nomination but retain its group's reserve.
 perform pair_test('revoke',null,null,null,(select id from ceremony_nominees where child_id=f(40) and revoked_at is null));
 v:=get_ceremony_sector_directory(f(1),f(31),p,null,'Adult',1);
 -- Complete children are attached to the parent even when the search excludes their names.
 v:=get_ceremony_sector_directory(f(1),f(31),p,null,(select first_name||' '||last_name from participants where id=(select participant_id from registrations where id=f(10))),1);
 assert exists(select 1 from jsonb_array_elements(v->'people') x where x->>'registrationId'=f(10)::text and x->>'childId' is null and jsonb_array_length(x->'children')=2),v;
 select revision into rev from ceremony_plans where id=p;
 c:=jsonb_build_object('action','assign_direct','sectorId',s,'quantity',3,'seatIds','[]'::jsonb,'groupId',null,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41))));
 r:=assign_ceremony_seats(f(1),f(31),p,rev,req,c);assert r->>'status'='saved',r;
 assert assign_ceremony_seats(f(1),f(31),p,rev,req,c)->>'status'='saved';
 assert (select count(*) from ceremony_nominees n join ceremony_allocations a on a.id=n.allocation_id where n.revoked_at is null and n.registration_id=f(10) and a.group_id is null)=3;
 assert (select a.quantity from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id where a.group_id=f(7701) and q.sector_id=s and a.revoked_at is null)=3;
 assert not exists(select 1 from ceremony_nominees n join ceremony_allocations a on a.id=n.allocation_id where n.revoked_at is null and a.group_id=f(7701));
 assert not exists(select 1 from ceremony_seat_claims where released_at is null);
 -- Individual revocation preserves the other two family tickets and group budget.
 perform revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7891),'nominee',(select id from ceremony_nominees where child_id=f(41) and revoked_at is null));
 assert (select count(*) from ceremony_nominees where registration_id=f(10) and revoked_at is null)=2;
 -- A duplicate family fails atomically; no partial child ticket may survive.
 select count(*) into before_count from ceremony_nominees;
 select revision into before_revision from ceremony_plans where id=p;
 r:=assign_ceremony_seats(f(1),f(31),p,before_revision,f(7892),c);assert r->>'status'='duplicate',r;
 assert (select count(*) from ceremony_nominees)=before_count;
 assert (select revision from ceremony_plans where id=p)=before_revision;
 -- An omitted child is rejected rather than silently changing the reviewed family.
 r:=assign_ceremony_seats(f(1),f(31),p,before_revision,f(7893),jsonb_set(jsonb_set(c,'{quantity}','1'),'{subjects}',jsonb_build_array(c->'subjects'->0)));assert r->>'status'='family_changed',r;
 assert (select count(*) from ceremony_nominees)=before_count;
 begin perform assign_ceremony_seats(f(1),f(32),p,before_revision,f(7894),c);raise exception 'Viewer write';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.assign_ceremony_seats(uuid,uuid,uuid,integer,uuid,jsonb)','execute');
end $$;
reset role;
-- Insufficient free seats must roll back all direct family writes, ignoring unused reserves.
do $$ declare p uuid; s uuid; c jsonb; r jsonb; n record; before_count integer; rev integer; begin
 select id into p from ceremony_plans where kind='opening';select id into s from ceremony_sectors where name='B';
 for n in select id from ceremony_nominees where registration_id=f(10) and revoked_at is null loop
  perform revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'nominee',n.id);
 end loop;
 update ceremony_quotas set quantity=6 where sector_id=s; -- four reserved, only two free
 select count(*) into before_count from ceremony_nominees;select revision into rev from ceremony_plans where id=p;
 c:=jsonb_build_object('action','assign_direct','sectorId',s,'quantity',3,'seatIds','[]'::jsonb,'groupId',null,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41))));
 r:=assign_ceremony_seats(f(1),f(31),p,rev,f(7895),c);assert r->>'status'='capacity',r;
 assert (select count(*) from ceremony_nominees)=before_count;
 assert (select revision from ceremony_plans where id=p)=rev;
end $$;
select 'PASS direct family: complete children across search, separate group reserves, replay, individual revocation, duplicate and capacity rollback, family changes and ACL';
