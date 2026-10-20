begin;
set local role anon;
do $$ begin
 assert not exists (
   (select panel_id,title,description,starts_at,ends_at,location_name,location_address,availability from get_public_panel_program_with_seats()
    except select * from get_public_panel_program())
   union all
   (select * from get_public_panel_program() except
    select panel_id,title,description,starts_at,ends_at,location_name,location_address,availability from get_public_panel_program_with_seats())
 );
 assert not exists(select 1 from get_public_panel_program_with_seats() where remaining_seats < 0);
 assert not exists(select 1 from get_public_panel_program_with_seats() where availability='full' and remaining_seats<>0);
 assert not exists(select 1 from get_public_panel_program_with_seats() where availability='available' and remaining_seats<=0);
end $$;
reset role;
do $$ declare r record; expected bigint; begin
 for r in select * from get_public_panel_program_with_seats() loop
  select coalesce(sum(case when exists(select 1 from panel_waitlist w where w.section_id=s.id and w.status='waiting') then 0 else greatest(0,s.capacity-app.panel_section_occupancy(s.id)) end),0)
  into expected from panel_seat_sections s join panel_audience_types a on a.id=s.audience_type_id and a.event_id=s.event_id
  where s.panel_id=r.panel_id and a.booking_channel='individual' and a.is_active;
  assert r.remaining_seats is not distinct from case when r.availability='unavailable' then null else expected end;
 end loop;
end $$;
update events set panel_access_mode='internal' where is_current;
set local role anon;
do $$ begin assert not exists(select 1 from get_public_panel_program_with_seats()); end $$;
rollback;
\echo PASS public aggregate counts, anonymous access, canonical catalogue parity and closed gate
