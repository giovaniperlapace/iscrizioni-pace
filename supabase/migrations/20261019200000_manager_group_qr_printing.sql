-- Manager printing is limited to a group in the current event. Scanner and
-- general reception operations retain their existing gates.
begin;
do $$
declare definition text; old_gate text := 'if p_group is null and p_registration is not null then perform app.require_participant_reception_operator(p_event,p_actor); else perform app.require_reception_operator(p_event,p_actor); end if;';
begin
 definition := pg_get_functiondef('app.qr_label_queue_core(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)'::regprocedure);
 if strpos(definition,old_gate)=0 then raise exception 'Unexpected QR label core gate'; end if;
 definition := replace(definition,old_gate,'perform app.require_participant_reception_operator(p_event,p_actor);');
 execute definition;
end $$;
create or replace function public.qr_label_queue(p_event uuid,p_actor uuid,p_action text,p_group uuid default null,p_registration uuid default null,
 p_ids uuid[] default '{}',p_snapshot text default null,p_request uuid default null,p_profile text default null,p_outcome text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_group is not null and p_registration is null then
  perform app.require_participant_reception_operator(p_event,p_actor);
 else
  perform app.require_reception_operator(p_event,p_actor);
 end if;
 -- Core locks/rechecks the active group and event, membership, selected IDs,
 -- snapshot, actor-owned outcomes and idempotency before any write.
 return app.qr_label_queue_core(p_event,p_actor,p_action,p_group,p_registration,p_ids,p_snapshot,p_request,p_profile,p_outcome);
end $$;
notify pgrst,'reload schema';
commit;
