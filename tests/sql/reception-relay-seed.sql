insert into event_locations(id,event_id,name,max_capacity) values(fw(9971),fw(200),'Sala collegata sintetica',12);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
 select fw(9970),event_id,'panel','Collegamento Morning A',starts_at,ends_at,fw(9971),'draft',false from event_moments where id=fw(403);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(9972),fw(200),fw(9970),fw(300),12);
update event_moments set publication_status='published',is_public=true where id=fw(9970);
insert into panel_relay_rooms(panel_id,source_panel_id,phase) values(fw(9970),fw(403),'open');
select set_reception_duties(fw(200),fw(11),fw(8),array[fw(403)::text]);
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(fw(9973),fw(107),1,'Child','Relay','2018-01-01');
insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone) values(fw(9974),fw(200),'relay-school@example.invalid','Teacher','Relay','+39000000');
insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
 values(fw(9975),fw(200),fw(9974),'School relay','Test','1A',4,1,'test',now());
insert into check_ins(event_id,moment_id,registration_id,child_id,checked_in_by,source) values
 (fw(200),fw(9970),fw(107),null,fw(8),'manual'),(fw(200),fw(9970),fw(107),fw(9973),fw(8),'manual');
insert into check_ins(event_id,moment_id,school_booking_id,student_count,companion_count,checked_in_by,source)
 values(fw(200),fw(9970),fw(9975),4,1,fw(8),'manual');
insert into check_ins(event_id,moment_id,registration_id,checked_in_by,source,cancelled_at)
 values(fw(200),fw(9970),fw(106),fw(8),'manual',now());
