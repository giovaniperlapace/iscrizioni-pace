import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
export async function checkSchoolClassConcurrency({psql,bin,args}) {
 psql(`begin;
 insert into event_locations(id,event_id,name,max_capacity) values(sd(306),sd(100),'Sala 6',100);
 insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
 select sd(406),event_id,moment_type,'Forum scuola 6',starts_at,ends_at,sd(306),'draft',false from event_moments where id=sd(401);
 insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(sd(506),sd(100),sd(406),sd(200),25);
 update event_moments set publication_status='published',is_public=true where id=sd(406);
 commit;`);
 const concurrent=sql=>new Promise((resolve,reject)=>{
  const child=spawn(bin+'/psql',[...args,'-tA']);let err='';child.stdout.resume();child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>resolve({code,err}));child.stdin.end(sql);
 });
 const rpc=(className,panel)=>`select create_public_school_booking(sd(100),'school-3@example.invalid','Ada','Docente','+3906000000','Scuola race','Roma','${className}',5,1,'school-booking-v1',jsonb_build_array(jsonb_build_object('panel_id',sd(${400+panel}),'seat_section_id',sd(${500+panel}),'student_count',5,'companion_count',1)),encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'synthetic-encrypted-token-value');`;
 const same=await Promise.all([1,6].map(panel=>concurrent(`begin;set role service_role;${rpc('3 A',panel)}select pg_sleep(0.2);commit;`)));
 assert.equal(same.filter(x=>x.code===0).length,1,JSON.stringify(same));assert.match(same.find(x=>x.code!==0).err,/overlap/);
 const different=await Promise.all([['3B',1],['3C',6]].map(([name,panel])=>concurrent(`begin;set role service_role;${rpc(name,panel)}select pg_sleep(0.2);commit;`)));
 assert.ok(different.every(x=>x.code===0),JSON.stringify(different));
 // Direct operational writes deliberately skip the RPC teacher row lock.
 const direct=panel=>`begin;
 with b as (insert into school_bookings(event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,status,privacy_version,privacy_accepted_at)
 select sd(100),id,'Scuola race','Roma','4A',2,1,'submitted','school-booking-v1',now() from school_booking_teachers where event_id=sd(100) and email='school-3@example.invalid' returning id)
 insert into school_panel_reservations(event_id,booking_id,panel_id,seat_section_id,student_count,companion_count,status)
 select sd(100),id,sd(${400+panel}),sd(${500+panel}),2,1,'reserved' from b;
 select pg_sleep(0.2);commit;`;
 const bypass=await Promise.all([1,6].map(panel=>concurrent(direct(panel))));
 assert.equal(bypass.filter(x=>x.code===0).length,1,JSON.stringify(bypass));assert.match(bypass.find(x=>x.code!==0).err,/overlap/);
 assert.equal(psql("select count(*) from school_bookings where school_name='Scuola race';",true).trim(),'4');
 psql("begin;delete from school_panel_reservations where booking_id in(select id from school_bookings where school_name='Scuola race');delete from school_bookings where school_name='Scuola race';commit;");
 assert.equal(psql('select count(*) from app.school_class_reservations;',true).trim(),'0');
 console.log('PASS concurrent same-class RPC and direct writes: one winner; different classes both succeed; no orphan seats or QR');
}
