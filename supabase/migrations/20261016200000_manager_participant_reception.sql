-- Managers may operate on a participant's registration and its minors only.
-- The scanner/group RPCs keep their reception-only gates. Shared cores retain
-- canonical revisions, audit, idempotency, exclusions and label counters.
begin;
create function app.require_participant_reception_operator(p_event uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' and current_user<>'postgres' and p_actor is distinct from auth.uid() then raise insufficient_privilege; end if;
 perform 1 from public.event_user_roles where user_id=p_actor and
  ((role='admin' and event_id is null) or (role in ('manager','accoglienza') and event_id=p_event)) for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
end $$;

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)'::regprocedure);
 if strpos(definition,'perform app.require_reception_operator(p_event_id,p_actor_user_id);')=0 then raise exception 'Unexpected reception gate'; end if;
 definition:=replace(definition,'public.reception_check_in(', 'app.reception_check_in_core(');
 definition:=replace(definition,'perform app.require_reception_operator(p_event_id,p_actor_user_id);',
  'if p_lookup_kind=''code'' then perform app.require_participant_reception_operator(p_event_id,p_actor_user_id); else perform app.require_reception_operator(p_event_id,p_actor_user_id); end if;');
 execute definition;
 definition:=pg_get_functiondef('public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)'::regprocedure);
 if strpos(definition,'perform app.require_reception_operator(p_event,p_actor);')=0 then raise exception 'Unexpected label gate'; end if;
 definition:=replace(definition,'public.qr_label_queue(', 'app.qr_label_queue_core(');
 definition:=replace(definition,'perform app.require_reception_operator(p_event,p_actor);',
  'if p_group is null and p_registration is not null then perform app.require_participant_reception_operator(p_event,p_actor); else perform app.require_reception_operator(p_event,p_actor); end if;');
 execute definition;
end $$;

create or replace function public.reception_check_in(
 p_event_id uuid,p_actor_user_id uuid,p_lookup_kind text,p_lookup text,p_action text default 'inspect',p_request_id uuid default null,
 p_subject_ids uuid[] default '{}',p_students integer default null,p_companions integer default null,p_expected_revision integer default null,p_reason text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform app.require_reception_operator(p_event_id,p_actor_user_id);
 return app.reception_check_in_core(p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,p_action,p_request_id,p_subject_ids,p_students,p_companions,p_expected_revision,p_reason);
end $$;

create function public.participant_reception_check_in(
 p_event_id uuid,p_actor_user_id uuid,p_registration_id uuid,p_code text,p_action text default 'inspect',p_request_id uuid default null,
 p_subject_ids uuid[] default '{}',p_expected_revision integer default null,p_reason text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare code text;
begin
 perform app.require_participant_reception_operator(p_event_id,p_actor_user_id);
 -- Bind the public code to the opened registration before any read or write.
 -- Parent lock precedes the existing core's token/check-in locks.
 select p.public_code into code from public.registrations reg join public.participants p on p.id=reg.participant_id
  where reg.id=p_registration_id and reg.event_id=p_event_id
  for update of reg for share of p;
 if code is null or code is distinct from p_code then return jsonb_build_object('status','invalid'); end if;
 return app.reception_check_in_core(p_event_id,p_actor_user_id,'code',code,p_action,p_request_id,p_subject_ids,null,null,p_expected_revision,p_reason);
end $$;

create or replace function public.qr_label_queue(p_event uuid,p_actor uuid,p_action text,p_group uuid default null,p_registration uuid default null,
 p_ids uuid[] default '{}',p_snapshot text default null,p_request uuid default null,p_profile text default null,p_outcome text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform app.require_reception_operator(p_event,p_actor);
 return app.qr_label_queue_core(p_event,p_actor,p_action,p_group,p_registration,p_ids,p_snapshot,p_request,p_profile,p_outcome);
end $$;

create function public.participant_qr_label_queue(p_event uuid,p_actor uuid,p_registration uuid,p_action text,
 p_ids uuid[] default '{}',p_snapshot text default null,p_request uuid default null,p_profile text default null,p_outcome text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform app.require_participant_reception_operator(p_event,p_actor);
 if p_registration is null then raise invalid_parameter_value; end if;
 return app.qr_label_queue_core(p_event,p_actor,p_action,null,p_registration,p_ids,p_snapshot,p_request,p_profile,p_outcome);
end $$;

revoke all on function app.require_participant_reception_operator(uuid,uuid),
 app.reception_check_in_core(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text),
 app.qr_label_queue_core(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text),
 public.participant_reception_check_in(uuid,uuid,uuid,text,text,uuid,uuid[],integer,text),
 public.participant_qr_label_queue(uuid,uuid,uuid,text,uuid[],text,uuid,text,text) from public,anon,authenticated;
grant execute on function app.require_participant_reception_operator(uuid,uuid),
 app.reception_check_in_core(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text),
 app.qr_label_queue_core(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text),
 public.participant_reception_check_in(uuid,uuid,uuid,text,text,uuid,uuid[],integer,text),
 public.participant_qr_label_queue(uuid,uuid,uuid,text,uuid[],text,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
