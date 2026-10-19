-- Managers may read stable group QRs for their assigned current event.
-- Keep leader scope, Admin access, service-only ACLs and all stored credentials.
-- Existing tokens (including historical revoked tokens) and ACLs are preserved.
begin;
create or replace function public.group_reception_credential(
 p_event uuid,p_actor uuid,p_group uuid,p_action text,
 p_hash text default null,p_encrypted text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.group_reception_tokens;
begin
 if p_action is distinct from 'get' then raise invalid_parameter_value; end if;
 -- The caller identity comes from the authenticated server action; direct RPC
 -- execution remains service-only. Recheck and lock current role assignments.
 if current_user not in ('service_role','postgres') and p_actor is distinct from auth.uid() then
   raise insufficient_privilege;
 end if;
 perform 1 from public.event_user_roles where user_id=p_actor and
   ((role='admin' and event_id is null) or (role='manager' and event_id=p_event)) for share;
 if not found then
   lock table public.groups,public.group_memberships in share mode;
   if not exists (
     with recursive leader_scope as (
       select gr.id from public.groups gr join public.group_memberships m on m.group_id=gr.id
       where m.user_id=p_actor and m.role='capogruppo' and gr.event_id=p_event and gr.is_active
       union select gr.id from public.groups gr join leader_scope s on gr.parent_group_id=s.id
       where gr.event_id=p_event and gr.is_active
     ) select 1 from leader_scope where id=p_group
   ) then raise insufficient_privilege; end if;
 end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 -- Serialize the first creation: concurrent opens reuse exactly the same row.
 perform 1 from public.groups where id=p_group and event_id=p_event and is_active for update;
 if not found then raise insufficient_privilege; end if;
 select * into q from public.group_reception_tokens where group_id=p_group for update;
 if not found then
   if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_encrypted is null then raise invalid_parameter_value; end if;
   insert into public.group_reception_tokens(group_id,token_hash,token_encrypted)
     values(p_group,p_hash,p_encrypted) returning * into q;
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id)
     values(p_event,p_actor,'group_qr.create','groups',p_group);
 end if;
 return jsonb_build_object('active',q.revoked_at is null,'hash',q.token_hash,
   'encrypted',case when q.revoked_at is null then q.token_encrypted else null end);
end $$;
notify pgrst,'reload schema';
commit;
