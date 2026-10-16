-- Let leaders display their own group credential; reception/printing stay Admin-only.
begin;
do $$
declare definition text; old_gate text; new_gate text;
begin
 old_gate := 'perform app.require_admin_reception_pilot(p_event,p_actor);';
 new_gate := $gate$if p_action = 'get' and not exists (
   select 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null
 ) then
   if current_user not in ('service_role','postgres') and p_actor is distinct from auth.uid() then
     raise insufficient_privilege;
   end if;
   -- Match the leader dashboard's active hierarchy; never grant Manager-wide access.
   lock table public.groups,public.group_memberships in share mode;
   if not exists (
     with recursive leader_scope as (
       select gr.id from public.groups gr join public.group_memberships m on m.group_id=gr.id
       where m.user_id=p_actor and m.role='capogruppo' and gr.event_id=p_event and gr.is_active
       union select gr.id from public.groups gr join leader_scope s on gr.parent_group_id=s.id
       where gr.event_id=p_event and gr.is_active
     ) select 1 from leader_scope where id=p_group
   ) then raise insufficient_privilege; end if;
 else
   perform app.require_admin_reception_pilot(p_event,p_actor);
 end if;$gate$;
 definition := pg_get_functiondef('public.group_reception_credential(uuid,uuid,uuid,text,text,text)'::regprocedure);
 if (length(definition)-length(replace(definition,old_gate,'')))/length(old_gate) <> 1 then
   raise exception 'Expected exactly one Admin credential gate';
 end if;
 execute replace(definition,old_gate,new_gate);
end $$;
-- No token/data updates, grants or RLS changes. Existing reads reuse the same QR;
-- a first explicit get creates its credential through the original audited path.
notify pgrst,'reload schema';
commit;
