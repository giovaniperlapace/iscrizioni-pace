reset role;
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(f(6970),f(10),3,'No seat','Test','2020-01-01');
create function public.fail_seat_audit() returns trigger language plpgsql as $$ begin if new.action='ceremony.seat_revoke' and current_setting('test.fail_seat',true)='on' then raise exception 'synthetic audit failure' using errcode='P7777';end if;return new;end $$;
create trigger fail_seat_audit before insert on public.audit_logs for each row execute function public.fail_seat_audit();
set local role service_role;
do $$ declare p uuid; rev integer; seat uuid; a uuid; n uuid; req uuid:=gen_random_uuid(); i integer; h jsonb; begin
 select id,revision into p,rev from ceremony_plans where kind='opening';
 select c.seat_id,c.allocation_id,c.nominee_id into seat,a,n from ceremony_seat_claims c join ceremony_nominees x on x.id=c.nominee_id where x.child_id=f(41) and c.released_at is null;
 foreach i in array array[30,32,34,35,36,37] loop
  begin perform revoke_ceremony_seat(f(1),f(i),p,rev,req,seat);raise exception 'unauthorized';exception when insufficient_privilege then null;end;
 end loop;
 begin perform revoke_ceremony_seat(f(1),f(31),f(2),rev,req,seat);raise exception 'foreign plan';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.revoke_ceremony_seat(uuid,uuid,uuid,integer,uuid,uuid)','execute');
 assert revoke_ceremony_seat(f(1),f(31),p,rev-1,req,seat)->>'status'='conflict';
 perform set_config('test.fail_seat','on',true);
 begin perform revoke_ceremony_seat(f(1),f(31),p,rev,req,seat);raise exception 'failure injection missed';exception when sqlstate 'P7777' then null;end;
 assert (select revision=rev from ceremony_plans where id=p);
 assert (select revoked_at is null from ceremony_nominees where id=n);
 assert exists(select 1 from ceremony_seat_claims where seat_id=seat and released_at is null);
 assert (select quantity=4 from ceremony_allocations where id=a);
 perform set_config('test.fail_seat','off',true);
 assert revoke_ceremony_seat(f(1),f(31),p,rev,req,seat)->>'status'='saved';
 assert revoke_ceremony_seat(f(1),f(31),p,rev,req,seat)->>'status'='saved';
 assert (select revision=rev+1 from ceremony_plans where id=p);
 assert (select quantity=3 and revoked_at is null from ceremony_allocations where id=a);
 assert (select revoked_at is not null from ceremony_nominees where id=n);
 assert not exists(select 1 from ceremony_seat_claims where seat_id=seat and released_at is null);
 assert (select count(*)=3 from ceremony_seat_claims where allocation_id=a and released_at is null);
 h:=get_ceremony_assignment_history(f(1),f(31),p,1,'','revoked');
 assert exists(select 1 from jsonb_array_elements(h->'entries') e where e->>'kind'='seat' and e->'seats'->0->>'id'=seat::text),'released delegation chair missing from history';
 -- An unnamed reserve is reduced one chair at a time; final chair revokes it.
 for seat in select seat_id from ceremony_seat_claims where allocation_id=a and released_at is null loop
  if (select quantity=1 from ceremony_allocations where id=a) then
   select revision into rev from ceremony_plans where id=p;
   assert set_ceremony_nominee(f(1),f(31),'no_seat',a,f(10),f(6970),null,rev,gen_random_uuid())->>'status'='saved';
   select revision into rev from ceremony_plans where id=p;
   assert revoke_ceremony_seat(f(1),f(31),p,rev,gen_random_uuid(),seat)->>'status'='nominees_active';
   assert exists(select 1 from ceremony_seat_claims where seat_id=seat and released_at is null);
   assert revoke_ceremony_assignment(f(1),f(31),p,rev,gen_random_uuid(),'nominee',(select id from ceremony_nominees where child_id=f(6970) and revoked_at is null))->>'status'='saved';
  end if;
  select revision into rev from ceremony_plans where id=p;
  assert revoke_ceremony_seat(f(1),f(33),p,rev,gen_random_uuid(),seat)->>'status'='saved';
 end loop;
 assert (select revoked_at is not null from ceremony_allocations where id=a);
 assert not exists(select 1 from ceremony_seat_claims where allocation_id=a and released_at is null);
 -- Direct adult/child ticket revocation releases capacity as well.
 for seat in select c.seat_id from ceremony_seat_claims c join ceremony_allocations z on z.id=c.allocation_id where z.registration_id=f(10) and c.released_at is null loop
  select revision into rev from ceremony_plans where id=p;
  assert revoke_ceremony_seat(f(1),f(31),p,rev,gen_random_uuid(),seat)->>'status'='saved';
 end loop;
 assert (select count(*)=1 from ceremony_seat_claims where released_at is null),'unrelated chair changed';
 assert (select count(*)=2 from ceremony_nominees where revoked_at is null),'F or unrelated nominal assignment changed';
end $$;
reset role;
select 'PASS single-chair revoke: direct adult/child, named/unnamed group, quantity, last seat, history, authorization, stale revision, replay and failure rollback';
