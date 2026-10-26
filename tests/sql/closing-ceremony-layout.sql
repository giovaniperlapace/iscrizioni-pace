-- Synthetic data only; appended after the operational configuration in a rollback.
set role service_role;
do $$
declare p public.ceremony_plans; s record; r jsonb; d jsonb; command jsonb;
begin
 select * into strict p from ceremony_plans where event_id=f(1) and kind='closing';
 assert p.state='validated' and p.layout_key='assisi-closing-2026';
 assert (select capacity=4070 and starts_at='2026-10-27T16:15:00+01:00'
  and ends_at='2026-10-27T19:30:00+01:00' from event_moments where id=p.moment_id);
 d:=get_ceremony_draft_desk(f(1),f(31),'closing');
 assert jsonb_array_length(d->'sectors')=7 and d->>'state'='validated';
 assert (select sum((x->>'remaining')::integer)=3720 from jsonb_array_elements(d->'sectors') x);
 assert not exists(select 1 from ceremony_sectors where plan_id=p.id and (numbered or overbooking<>0));
 assert (select capacity=350 and assignable_limit=0 from ceremony_sectors where plan_id=p.id and layout_code='A');
 insert into groups(id,event_id,name) values(f(16000),f(1),'Closing synthetic group');
 for s in select * from ceremony_sectors where plan_id=p.id order by layout_code loop
  command:=jsonb_build_object('action','group','sectorId',s.id,'quantity',s.assignable_limit+1,
   'seatIds','[]'::jsonb,'groupId',f(16000),'subjects','[]'::jsonb);
  r:=manage_ceremony_drafts(f(1),f(31),p.id,(select revision from ceremony_plans where id=p.id),gen_random_uuid(),'save',null,command);
  assert r->>'status'='capacity',r;
  if s.assignable_limit>0 then
   command:=jsonb_set(command,'{quantity}',to_jsonb(s.assignable_limit));
   r:=manage_ceremony_drafts(f(1),f(31),p.id,(select revision from ceremony_plans where id=p.id),gen_random_uuid(),'save',null,command);
   assert r->>'status'='saved',r;
  end if;
 end loop;
 assert (select sum((data->>'quantity')::integer)=3720 from ceremony_assignment_drafts where plan_id=p.id and state='draft');
 assert not exists(select 1 from ceremony_allocations where plan_id=p.id);
 assert not exists(select 1 from ceremony_publication_emails);
 begin
  perform get_ceremony_draft_desk(f(1),f(36),'closing');
  raise exception 'Leader read bypass';
 exception when insufficient_privilege then null;end;
 begin
  perform get_ceremony_draft_desk(f(2),f(31),'closing');
  raise exception 'Event read bypass';
 exception when insufficient_privilege then null;end;
 assert not has_table_privilege('authenticated','ceremony_sectors','insert');
end $$;
select 'PASS closing: 4070 total, 350 protocol excluded, 3720 assignable, exact Rome times, all sector draft capacities, no publication/email, roles and event scope';
