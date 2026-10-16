begin;
reset role;
update qr_tokens set token_encrypted='synthetic-only' where registration_id=f(10);
set local role service_role;
do $$ declare actor int; v jsonb; rev int; snap text; begin
 foreach actor in array array[30,31,33] loop
  v:=participant_reception_check_in(f(1),f(actor),f(10),'TST1');
  assert v->>'status'='valid' and v->>'kind'='family';
  assert participant_qr_label_queue(f(1),f(actor),f(10),'read')->>'status'='queue';
 end loop;
 foreach actor in array array[32,34,35,36,37] loop
  begin perform participant_reception_check_in(f(1),f(actor),f(10),'TST1');raise exception 'Participant permission bypass';exception when insufficient_privilege then null;end;
  begin perform participant_qr_label_queue(f(1),f(actor),f(10),'read');raise exception 'Print permission bypass';exception when insufficient_privilege then null;end;
 end loop;
 assert participant_reception_check_in(f(1),f(31),f(11),'TST1')->>'status'='invalid','Wrong registration binding';
 assert participant_reception_check_in(f(1),f(31),f(14),'TST5')->>'status'='invalid','Deleted registration';
 assert participant_reception_check_in(f(1),f(31),f(12),'TST3')->>'status'='invalid','Cancelled registration';
 assert participant_reception_check_in(f(1),f(31),f(15),'TST6')->>'status'='invalid','Draft registration';
 begin perform participant_reception_check_in(f(2),f(31),f(13),'TST4');raise exception 'Foreign event';exception when insufficient_privilege then null;end;
 v:=participant_reception_check_in(f(1),f(31),f(10),'TST1','enter',f(99101),array[f(10),f(40),f(41)]);
 assert v->>'status'='valid'; rev:=(v->>'revision')::int;
 assert participant_reception_check_in(f(1),f(31),f(10),'TST1','enter',f(99101),array[f(10),f(40),f(41)])->>'outcome'='replayed';
 assert participant_reception_check_in(f(1),f(31),f(10),'TST1','cancel',f(99102),array[f(40)],rev-1,'entry_cancelled')->>'status'='conflict';
 v:=participant_reception_check_in(f(1),f(31),f(10),'TST1','cancel',f(99103),array[f(40)],rev,'entry_cancelled');
 assert v->>'status'='valid';
 assert (select count(*)=2 from check_ins where registration_id=f(10) and cancelled_at is null),'Other presences changed';
 assert (select cancelled_at is not null from check_ins where registration_id=f(10) and child_id=f(40));
 assert participant_reception_check_in(f(1),f(31),f(10),'TST1','cancel',f(99103),array[f(40)],rev,'entry_cancelled')->>'outcome'='replayed';
 begin perform participant_reception_check_in(f(1),f(31),f(10),'TST1','enter',f(99104),array[f(42)]);raise exception 'Foreign child';exception when invalid_parameter_value then null;end;
 snap:=participant_qr_label_queue(f(1),f(31),f(10),'read')->>'snapshot';
 begin perform participant_qr_label_queue(f(1),f(31),f(10),'request',array[f(11)],snap,f(99105),'continuous-29x45');raise exception 'Foreign label';exception when invalid_parameter_value then null;end;
 assert participant_qr_label_queue(f(1),f(31),f(10),'request',array[f(10)],snap,f(99106),'continuous-29x45')->>'status'='claimed';
 assert participant_qr_label_queue(f(1),f(31),f(10),'request',array[f(10)],snap,f(99106),'continuous-29x45')->>'status'='replayed';
 assert participant_qr_label_queue(f(1),f(31),f(10),'outcome','{}',null,f(99106),null,'browser_returned')->>'status'='queue';
 assert (select count(*)=2 from check_ins where registration_id=f(10) and cancelled_at is null),'Print changed presence';
 assert exists(select 1 from audit_logs where actor_user_id=f(31) and metadata->>'request_id'=f(99106)::text and action in ('qr_label.print','qr_label.reprint'));
 -- Public scanner and group printing gates remain unchanged, even for code lookups.
 begin perform reception_event_check_in('event_entry',f(1),f(31),'code','TST1');raise exception 'Scanner opened';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(31),'read',null,f(10));raise exception 'Generic printing opened';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from event_user_roles where user_id=f(31) and role='manager';
set local role service_role;
do $$ begin
 begin perform participant_reception_check_in(f(1),f(31),f(10),'TST1','enter',f(99101),array[f(10),f(40),f(41)]);raise exception 'Revoked retry';exception when insufficient_privilege then null;end;
 begin perform participant_qr_label_queue(f(1),f(31),f(10),'outcome','{}',null,f(99106),null,'browser_returned');raise exception 'Revoked outcome';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare signature text; begin
 foreach signature in array array[
  'public.participant_reception_check_in(uuid,uuid,uuid,text,text,uuid,uuid[],integer,text)',
  'public.participant_qr_label_queue(uuid,uuid,uuid,text,uuid[],text,uuid,text,text)',
  'app.reception_check_in_core(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)',
  'app.qr_label_queue_core(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)'
 ] loop
  assert not has_function_privilege('authenticated',signature,'execute');assert not has_function_privilege('anon',signature,'execute');
  assert has_function_privilege('service_role',signature,'execute');
 end loop;
end $$;
rollback;
select 'PASS Manager participant scope, identity, children, selective removal, revision, replay, print independence, revocation and service-only RPCs';
