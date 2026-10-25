-- Runs against the sector fixture in a disposable, rolled-back transaction.
reset role;
insert into participants(id,first_name,last_name,public_code)
 select f(15000+n),'Ungrouped','Person '||n,'U'||lpad(n::text,3,'0') from generate_series(1,3) n;
insert into registrations(id,event_id,participant_id,status)
 select f(15100+n),f(1),f(15000+n),'submitted' from generate_series(1,3) n;
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date)
 values(f(15200),f(15101),1,'Ungrouped','Child','2019-01-01');
-- An old confirmed membership must not exclude a participant.
insert into participant_group_assignments(registration_id,group_id,is_current,source,status)
 values(f(15101),f(7701),false,'manager','confirmed');
set role service_role;
do $$ declare p uuid; s uuid; cmd jsonb; result jsonb; draft uuid; rev integer; request uuid; before_alloc integer; before_nom integer; directory jsonb;
begin
 select id into p from ceremony_plans where kind='opening';
 select id into s from ceremony_sectors where plan_id=p and name='C';
 select count(*) into before_alloc from ceremony_allocations;
 select count(*) into before_nom from ceremony_nominees;
 directory:=get_ceremony_sector_directory(f(1),f(31),p,null,'Ungrouped',1,true);
 assert (directory->>'total')::int=4,directory;
 assert not exists(select 1 from jsonb_array_elements(directory->'people') x where x->>'registrationId'=f(10)::text);
 cmd:=jsonb_build_object('action','group_nominal','sectorId',s,'quantity',3,'seatIds','[]'::jsonb,'groupId',null,'subjects',jsonb_build_array(
  jsonb_build_object('registrationId',f(15101),'childId',null),
  jsonb_build_object('registrationId',f(15102),'childId',null),
  jsonb_build_object('registrationId',f(15101),'childId',f(15200))));
 rev:=(select revision from ceremony_plans where id=p);request:=gen_random_uuid();
 result:=manage_ceremony_drafts(f(1),f(31),p,rev,request,'save',null,cmd);
 assert result->>'status'='saved',result;
 assert manage_ceremony_drafts(f(1),f(31),p,rev,request,'save',null,cmd)=result,'save replay';
 assert (select count(*) from ceremony_allocations)=before_alloc;
 assert (select count(*) from ceremony_nominees)=before_nom;
 assert not exists(select 1 from ceremony_publication_emails),'draft email';
 select id into draft from ceremony_assignment_drafts where state='draft';
 assert manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,cmd)->>'status'='duplicate';
 -- A changed membership invalidates both updates and publication, atomically.
 insert into participant_group_assignments(registration_id,group_id,is_current,source,status)
  values(f(15102),f(7701),true,'manager','confirmed');
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',draft,cmd);
 assert result->>'status'='ineligible',result;
 rev:=(select revision from ceremony_plans where id=p);request:=gen_random_uuid();
 result:=manage_ceremony_drafts(f(1),f(31),p,rev,request,'publish',null,null);
 assert result->>'status'='ineligible',result;
 assert (select count(*) from ceremony_allocations)=before_alloc,'partial allocation';
 assert (select count(*) from ceremony_nominees)=before_nom,'partial nominee';
 assert not exists(select 1 from ceremony_publication_emails),'partial email';
 assert (select revision from ceremony_plans where id=p)=rev;
 update participant_group_assignments set is_current=false where registration_id=f(15102);
 result:=manage_ceremony_drafts(f(1),f(33),p,rev,gen_random_uuid(),'save',draft,jsonb_set(cmd,'{sectorId}',to_jsonb((select id from ceremony_sectors where name='D'))));
 assert result->>'status'='saved',result;
 rev:=(select revision from ceremony_plans where id=p);request:=gen_random_uuid();
 result:=manage_ceremony_drafts(f(1),f(31),p,rev,request,'publish',null,null);
 assert result->>'status'='saved' and result->>'seats'='3' and result->>'notifications'='2',result;
 assert manage_ceremony_drafts(f(1),f(31),p,rev,request,'publish',null,null)=result,'publish replay';
 assert (select count(*) from ceremony_nominees where registration_id in(f(15101),f(15102)) and revoked_at is null)=3;
 assert (select count(*) from ceremony_publication_emails)=2;
 assert not exists(select 1 from ceremony_publication_emails where user_id is not null),'leader email';
 assert (select jsonb_array_length(payload->'lines') from ceremony_publication_emails where registration_id=f(15101))=2;
 assert not exists(select 1 from ceremony_nominees where registration_id=f(15103)),'unselected person';
 assert not exists(select 1 from ceremony_allocations where registration_id in(f(15101),f(15102)) and group_id is not null);
 -- Forged lists cannot include a confirmed group member, even without an adult row.
 cmd:=jsonb_set(jsonb_set(cmd,'{quantity}','1'),'{subjects}',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(41))));
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,cmd);
 assert result->>'status'='ineligible',result;
 begin
  perform manage_ceremony_drafts(f(1),f(32),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,cmd);
  raise exception 'viewer bypass';
 exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.assign_ceremony_seats(uuid,uuid,uuid,integer,uuid,jsonb)','execute');
 assert not has_function_privilege('anon','public.assign_ceremony_seats(uuid,uuid,uuid,integer,uuid,jsonb)','execute');
end $$;
select 'PASS Senza gruppo: directory, historical memberships, explicit children, hidden drafts, move, membership recheck, atomic publication, personal emails and retries';
