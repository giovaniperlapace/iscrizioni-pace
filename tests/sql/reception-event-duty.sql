-- Runs after P11's complete fixture in the disposable database only.
set role service_role;
do $$ declare duty text; actor int; v jsonb; begin
  foreach duty in array array['panel_entry','room_assistance','',null] loop
    begin
      perform reception_event_check_in(duty,f(1),f(30),'code','TST1');
      raise exception 'Non-event duty permitted';
    exception when insufficient_privilege then null; end;
  end loop;
  foreach actor in array array[30,31,33] loop
    assert reception_event_check_in('event_entry',f(1),f(actor),'code','TST1')->>'status'='valid';
  end loop;
  foreach actor in array array[32,34,35,36,37] loop
    begin perform reception_event_check_in('event_entry',f(1),f(actor),'code','TST1');
      raise exception 'Unauthorized event entry'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform reception_event_check_in('event_entry',f(2),f(30),'code','TST4');
    raise exception 'Foreign event entry'; exception when insufficient_privilege then null; end;
  v:=reception_event_check_in('event_entry',f(1),f(30),'code','TST1','enter',f(1200),array[f(10)]);
  assert v->>'status'='valid';
  assert reception_event_check_in('event_entry',f(1),f(30),'code','TST1','enter',f(1200),array[f(10)])->>'outcome'='replayed';
end $$;
reset role;
-- Revocation between inspection and entry is checked against the live role.
begin;
delete from event_user_roles where user_id=f(30);
set local role service_role;
do $$ begin
  begin perform reception_event_check_in('event_entry',f(1),f(30),'code','TST1','enter',f(1201),array[f(10)]);
    raise exception 'Revoked operator entered'; exception when insufficient_privilege then null; end;
  begin perform reception_event_check_in('event_entry',f(1),f(30),'code','TST1','enter',f(1200),array[f(10)]);
    raise exception 'Revoked operator replayed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
-- Forging a server-supplied actor from a public client cannot invoke either RPC.
set role authenticated;
do $$ begin
  begin perform reception_event_check_in('event_entry',f(1),f(33),'code','TST1');
    raise exception 'Direct RPC actor forgery'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform reception_event_check_in('event_entry',f(1),f(30),'code','TST1');
    raise exception 'Anonymous RPC access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('authenticated','public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','execute');
  assert not has_function_privilege('anon','public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','execute');
  assert has_function_privilege('service_role','public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','execute');
end $$;
select 'PASS P12 duty scope, role revocation, retries, all roles and RPC grants';
