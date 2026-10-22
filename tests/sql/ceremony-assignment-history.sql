-- Extends the full desk scenario in its existing transaction; rolled back by runner.
reset role;
create function public.fail_history_audit() returns trigger language plpgsql as $$ begin if new.action='ceremony.desk_revoke' and current_setting('test.fail_revoke',true)='on' then raise exception 'synthetic audit failure' using errcode='P7777';end if;return new;end $$;
create trigger fail_history_audit before insert on public.audit_logs for each row execute function public.fail_history_audit();
set local role service_role;
do $$ declare p uuid; v integer; a uuid; n uuid; seat uuid; req uuid:=gen_random_uuid(); h jsonb; prior_count integer; person text; i integer; begin
 select id,revision into p,v from ceremony_plans where kind='opening';
 h:=get_ceremony_assignment_history(f(1),f(31),p,1,'','all');
 assert (h->>'total')::integer=7, 'five nominees and two group reserves';
 assert jsonb_array_length(h->'entries')=7;
 assert (get_ceremony_assignment_history(f(1),f(31),p,999,'not present','all')->>'page')::integer=1;
 assert (get_ceremony_assignment_history(f(1),f(31),p,1,'','revoked')->>'total')::integer=0;
 foreach i in array array[30,32,34,35,36,37] loop
  begin perform get_ceremony_assignment_history(f(1),f(i),p,1,'','all');raise exception 'unauthorized history';exception when insufficient_privilege then null;end;
  begin perform revoke_ceremony_assignment(f(1),f(i),p,v,req,'nominee',f(1));raise exception 'unauthorized revoke';exception when insufficient_privilege then null;end;
 end loop;
 begin perform get_ceremony_assignment_history(f(2),f(31),p,1,'','all');raise exception 'foreign event history';exception when insufficient_privilege then null;end;
 begin perform revoke_ceremony_assignment(f(1),f(31),f(2),v,req,'nominee',f(1));raise exception 'foreign plan revoke';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.get_ceremony_assignment_history(uuid,uuid,uuid,integer,text,text)','execute');
 assert not has_function_privilege('anon','public.revoke_ceremony_assignment(uuid,uuid,uuid,integer,uuid,text,uuid)','execute');
 select x.id,x.allocation_id,c.seat_id,x.subject_name into n,a,seat,person from ceremony_nominees x join ceremony_seat_claims c on c.nominee_id=x.id and c.released_at is null where x.child_id=f(41);
 assert revoke_ceremony_assignment(f(1),f(31),p,v-1,req,'nominee',n)->>'status'='conflict';
 assert (select revoked_at is null from ceremony_nominees where id=n);
 perform set_config('test.fail_revoke','on',true);
 begin perform revoke_ceremony_assignment(f(1),f(31),p,v,req,'nominee',n);raise exception 'failure injection missed';exception when sqlstate 'P7777' then null;end;
 assert (select revision=v from ceremony_plans where id=p),'revision changed despite rollback';
 assert (select revoked_at is null from ceremony_nominees where id=n),'partial revoke';
 assert exists(select 1 from ceremony_seat_claims where nominee_id=n and released_at is null and seat_id=seat),'partially released chair';
 assert not exists(select 1 from ceremony_map_requests where request_id=req),'failed request recorded';
 perform set_config('test.fail_revoke','off',true);
 assert revoke_ceremony_assignment(f(1),f(31),p,v,req,'nominee',n)->>'status'='saved';
 assert revoke_ceremony_assignment(f(1),f(31),p,v,req,'nominee',n)->>'status'='saved','same retry';
 assert (select revision=v+1 from ceremony_plans where id=p);
 assert (select revoked_at is not null from ceremony_nominees where id=n);
 assert (select quantity=4 and revoked_at is null from ceremony_allocations where id=a),'group reserve retained';
 assert (select count(*)=4 from ceremony_seat_claims where allocation_id=a and released_at is null);
 assert exists(select 1 from ceremony_seat_claims where nominee_id=n and released_at is not null and seat_id=seat),'historical chair lost';
 assert exists(select 1 from ceremony_seat_claims where nominee_id is null and released_at is null and seat_id=seat),'reserve chair not restored';
 h:=get_ceremony_assignment_history(f(1),f(31),p,1,person,'revoked');
 assert (h->>'total')::integer=1 and h->'entries'->0->'seats'->0->>'id'=seat::text;
 begin perform revoke_ceremony_assignment(f(1),f(31),p,v,req,'allocation',a);raise exception 'request substitution';exception when invalid_parameter_value then null;end;
 -- Reassign the very same chair and child: old history must remain separate.
 assert desk_test(jsonb_build_object('action','assign','sectorId',(select q.sector_id from ceremony_allocations z join ceremony_quotas q on q.id=z.quota_id where z.id=a),'quantity',1,'seatIds',jsonb_build_array(seat),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(41)))))->>'status'='saved';
 select revision into v from ceremony_plans where id=p;
 assert revoke_ceremony_assignment(f(1),f(33),p,v,gen_random_uuid(),'allocation',a)->>'status'='saved';
 assert not exists(select 1 from ceremony_nominees where allocation_id=a and revoked_at is null);
 assert not exists(select 1 from ceremony_seat_claims where allocation_id=a and released_at is null);
 assert (select count(*)=2 from ceremony_nominees where allocation_id=a),'revoked nominal history deleted';
 h:=get_ceremony_assignment_history(f(1),f(31),p,1,'B','revoked');
 assert (h->>'total')::integer=3,'group and both nominal lifecycles';
 assert exists(select 1 from jsonb_array_elements(h->'entries') e where e->>'kind'='allocation' and jsonb_array_length(e->'seats')=4),'group chairs duplicated after re-naming';
 -- Direct adult and child revocation free both capacity and seat, independently.
 for n in select id from ceremony_nominees where registration_id=f(10) and allocation_id<>a and revoked_at is null loop
  select revision into v from ceremony_plans where id=p;
  assert revoke_ceremony_assignment(f(1),f(31),p,v,gen_random_uuid(),'nominee',n)->>'status'='saved';
  assert not exists(select 1 from ceremony_seat_claims where nominee_id=n and released_at is null);
  assert exists(select 1 from ceremony_nominees x join ceremony_allocations z on z.id=x.allocation_id where x.id=n and x.revoked_at is not null and z.revoked_at is not null);
 end loop;
 -- F nominal revoke keeps unnumbered reserve, whole revoke frees it.
 select x.id,x.allocation_id into n,a from ceremony_nominees x where x.registration_id=f(6951) and x.revoked_at is null;
 select revision into v from ceremony_plans where id=p;
 assert revoke_ceremony_assignment(f(1),f(31),p,v,gen_random_uuid(),'nominee',n)->>'status'='saved';
 assert (select quantity=2 and revoked_at is null from ceremony_allocations where id=a);
 select revision into v from ceremony_plans where id=p;
 assert revoke_ceremony_assignment(f(1),f(31),p,v,gen_random_uuid(),'allocation',a)->>'status'='saved';
 assert (select revoked_at is not null from ceremony_allocations where id=a);
 assert (get_ceremony_assignment_history(f(1),f(31),p,1,'F member','revoked')->'entries'->0->'seats')='[]'::jsonb;
 -- Pagination/search apply to the full lifecycle, not the first 100 rows.
 for i in 1..105 loop
  select revision into v from ceremony_plans where id=p;
  assert desk_test(jsonb_build_object('action','assign','sectorId',(select id from ceremony_sectors where layout_code='F'),'quantity',1,'seatIds','[]'::jsonb,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null))))->>'status'='saved';
  select id into n from ceremony_nominees where registration_id=f(10) and child_id is null and revoked_at is null;
  select revision into v from ceremony_plans where id=p;
  assert revoke_ceremony_assignment(f(1),f(31),p,v,gen_random_uuid(),'nominee',n)->>'status'='saved';
 end loop;
 h:=get_ceremony_assignment_history(f(1),f(31),p,1,'Adult Test','revoked');
 assert (h->>'total')::integer=106 and jsonb_array_length(h->'entries')=100;
 h:=get_ceremony_assignment_history(f(1),f(31),p,999,'Adult Test','revoked');
 assert (h->>'page')::integer=2 and jsonb_array_length(h->'entries')=6;
 assert (select count(*)=1 from ceremony_nominees where revoked_at is null),'unrelated person revoked';
 assert (select count(*)=1 from ceremony_seat_claims where released_at is null),'unrelated chair released';
 assert exists(select 1 from audit_logs where action='ceremony.desk_revoke' and metadata->>'request_id'=req::text);
end $$;
reset role;
select 'PASS history: existing lifecycle, pagination/search, Manager/Admin scope, atomic revocation, replay, direct adult/child, delegation nomination reserve and F';
