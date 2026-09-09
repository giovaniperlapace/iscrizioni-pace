-- Synthetic, idempotent fixture for the staging group-panel dashboard only.
-- Never apply to production. Requires the explicitly created staging leader.
do $$
declare e uuid; leader_id uuid; root_id uuid; group_id uuid; person_id uuid; reg_id uuid; n text;
begin
 select id into leader_id from auth.users where email='capogruppo.panel.staging@example.invalid';
 if leader_id is null then raise exception 'Staging test leader is required'; end if;
 select id into e from public.events where is_current;
 select g.id into root_id from public.groups g join public.group_memberships m on m.group_id=g.id
 where g.event_id=e and m.user_id=leader_id limit 1;
 if root_id is null then raise exception 'Staging leader scope is required'; end if;
 select id into group_id from public.groups where event_id=e and name='Test iscrizioni panel';
 if group_id is not null then return; end if;
 insert into public.groups(event_id,name,node_type,parent_group_id,is_active,is_assignable,is_public_catalog)
 values(e,'Test iscrizioni panel','group',root_id,true,true,false) returning id into group_id;
 foreach n in array array['Anna','Bruno','Carla','Davide'] loop
  insert into public.participants(first_name,last_name,participates_with_group)
  values(n,'Test Panel',true) returning id into person_id;
  insert into public.registrations(event_id,participant_id,status,source)
  values(e,person_id,'confirmed','capogruppo') returning id into reg_id;
  insert into public.participant_group_assignments(registration_id,group_id,status,is_current,source)
  values(reg_id,group_id,'confirmed',true,'capogruppo');
  if n='Anna' then
   insert into public.registration_children(registration_id,position,first_name,last_name,birth_date)
   values(reg_id,1,'Minore Test','Panel','2018-01-01');
  end if;
 end loop;
end $$;
