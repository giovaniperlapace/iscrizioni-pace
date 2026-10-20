-- Runs only on the disposable database. No operational accounts or sends.
begin;
update panel_waitlist set status='cancelled' where status in ('waiting','offered');
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values
 (fw(910),fw(106),1,'Selected','Minor','2018-01-01'),(fw(911),fw(106),2,'Excluded','Minor','2019-01-01'),
 (fw(912),fw(107),1,'Other','Family','2018-01-01');
select set_config('request.jwt.claim.sub',fw(6)::text,true);
select set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[fw(910)]);
do $$ begin
 assert app.registration_panel_party_size(fw(106),fw(403))=2;
 assert app.panel_child_ids(fw(106),fw(403))=array[fw(910)];
 assert (select count(*)=2 from jsonb_array_elements((select children from get_participant_panel_catalog(fw(106)) where section_id=fw(503))));
 assert (select count(*)=1 from jsonb_array_elements((select children from get_participant_panel_catalog(fw(106)) where section_id=fw(503))) c where (c->>'selected')::boolean);
 begin perform set_panel_family_booking(fw(106),fw(405),fw(505),'book',array[fw(912)]);raise exception 'foreign child allowed';exception when invalid_parameter_value then null;end;
 begin perform set_panel_family_booking(fw(107),fw(405),fw(505),'book','{}');raise exception 'foreign registration allowed';exception when insufficient_privilege then null;end;
 begin perform set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[fw(911)]);raise exception 'existing selection silently replaced';exception when invalid_parameter_value then null;end;
end $$;
select set_panel_family_booking(fw(106),fw(405),fw(505),'book','{}');
do $$ begin assert app.registration_panel_party_size(fw(106),fw(405))=1;end $$;
select set_panel_family_booking(fw(106),fw(405),fw(505),'cancel','{}');
-- No automatic participation of newly added children, including through older RPCs.
select set_individual_panel_booking(fw(106),fw(405),fw(505),true);
do $$ begin assert app.registration_panel_party_size(fw(106),fw(405))=1;end $$;
select set_individual_panel_booking(fw(106),fw(405),fw(505),false);
\echo PASS per-Forum selection, adult-only default, scoped names, foreign child/owner denial and stable existing selection
-- One available place fits the adult, but not adult + one selected minor.
update panel_seat_sections set capacity=1 where id=fw(506);
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(406),fw(506),'book',array[fw(910)]);raise exception 'overbooked';exception when sqlstate 'P0001' then null;end;
 assert not exists(select 1 from panel_child_selections where registration_id=fw(106) and panel_id=fw(406));
end $$;
select set_panel_family_booking(fw(106),fw(406),fw(506),'join',array[fw(910)]);
select app.advance_panel_waitlist(fw(506),true);
do $$ begin assert (select status='waiting' from panel_waitlist where registration_id=fw(106) and panel_id=fw(406));end $$;
update panel_seat_sections set capacity=2 where id=fw(506);
select app.advance_panel_waitlist(fw(506),true);
do $$ begin
 assert (select status='offered' and reserved_seats=2 from panel_waitlist where registration_id=fw(106) and panel_id=fw(406));
 begin perform set_panel_family_booking(fw(106),fw(406),fw(506),'join',array[fw(911)]);raise exception 'hold changed';exception when invalid_parameter_value then null;end;
end $$;
select set_panel_family_booking(fw(106),fw(406),fw(506),'accept','{}');
do $$ begin
 assert app.registration_panel_party_size(fw(106),fw(406))=2;
 assert app.panel_child_ids(fw(106),fw(406))=array[fw(910)];
 assert app.panel_section_occupancy(fw(506))=2;
end $$;
set constraints all immediate;
\echo PASS exact selected party in FIFO, atomic failure rollback, two-seat hold and acceptance without adding excluded minor
insert into panel_reception_assignments(event_id,panel_id,user_id,duty) values(fw(200),fw(403),fw(6),'panel_entry');
set local role service_role;
do $$ declare result jsonb; begin
 result:=reception_panel_check_in('panel_entry',fw(403),fw(200),fw(6),'code','QQQ6');
 assert result->>'status'='valid';
 assert jsonb_array_length(result->'persons')=2;
 assert exists(select 1 from jsonb_array_elements(result->'persons') p where p->>'id'=fw(910)::text);
 assert not exists(select 1 from jsonb_array_elements(result->'persons') p where p->>'id'=fw(911)::text);
 begin perform reception_panel_check_in('panel_entry',fw(403),fw(200),fw(6),'code','QQQ6','enter',fw(920),array[fw(911)]);
  raise exception 'excluded minor admitted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
\echo PASS assigned Forum scanner lists only booked children and rejects excluded minor; service permission preserved
rollback;
