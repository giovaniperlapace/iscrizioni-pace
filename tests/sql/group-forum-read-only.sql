-- Disposable fixture only: match the READ ONLY transaction used by PostgREST.
begin;
insert into groups(id,event_id,name) values(fw(9700),fw(200),'Read-only leader fixture');
insert into event_user_roles(event_id,user_id,role) values(fw(200),fw(9),'manager');
insert into group_memberships(group_id,user_id) values(fw(9700),fw(9));
insert into participant_group_assignments(registration_id,group_id,status,is_current) values(fw(109),fw(9700),'confirmed',true);
commit;
begin read only;
set local role authenticated;
select set_config('request.jwt.claim.sub',fw(9)::text,true);
do $$ declare v jsonb; begin
 v:=get_group_panel_booking_view(fw(200));
 assert jsonb_array_length(v->'panels')>0;
 assert jsonb_array_length(v->'participants')=1;
 v:=get_group_panel_booking_view(fw(200),fw(506));
 assert v->'participants'->0->>'registrationId'=fw(109)::text;
end $$;
rollback;
begin;
delete from participant_group_assignments where group_id=fw(9700);
delete from group_memberships where group_id=fw(9700);
delete from groups where id=fw(9700);
delete from event_user_roles where user_id=fw(9) and role='manager';
commit;
\echo PASS Manager plus leader initial and selected catalog in PostgREST-equivalent read-only transaction
