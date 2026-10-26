insert into groups(id,event_id,name) values(f(17300),f(1),'Capacity badge group');
set role service_role;
do $$ declare p uuid; s public.ceremony_sectors; r jsonb;
begin
 select id into p from ceremony_plans where kind='closing';
 for s in select * from ceremony_sectors where plan_id=p loop
  r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,
   jsonb_build_object('action','group','sectorId',s.id,'groupId',f(17300),'quantity',s.capacity,'seatIds','[]'::jsonb,'subjects','[]'::jsonb));assert r->>'status'='saved',r;
  r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),gen_random_uuid(),'save',null,
   jsonb_build_object('action','group','sectorId',s.id,'groupId',f(17300),'quantity',1,'seatIds','[]'::jsonb,'subjects','[]'::jsonb));assert r->>'status'='capacity',r;
 end loop;
 assert (select sum((data->>'quantity')::integer)=3500 from ceremony_assignment_drafts where plan_id=p and state='draft');
 assert (select bool_and((x->>'remaining')::integer=0) from jsonb_array_elements(get_ceremony_draft_desk(f(1),f(31),'closing')->'sectors') x);
 assert not exists(select 1 from ceremony_nominees where plan_id=p);
 assert not exists(select 1 from ceremony_publication_emails where plan_id=p);
end $$;
reset role;
select 'PASS closing capacities: exact fill of 200, 1100, 2200; one extra rejected in each sector, zero remaining, no implicit nomination or email';
