-- P13-G: opaque group credentials, atomic nominal attendance and durable badge queue.
begin;
create table public.group_reception_tokens (
 group_id uuid primary key references public.groups(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 token_encrypted text not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.group_badge_batches (
 id uuid primary key,
 event_id uuid not null references public.events(id),
 group_id uuid not null references public.groups(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id),
 fingerprint text not null,
 created_at timestamptz not null default now()
);
create table public.group_badge_items (
 batch_id uuid not null references public.group_badge_batches(id) on delete cascade,
 registration_id uuid not null references public.registrations(id),
 position integer not null,
 state text not null default 'pending' check(state in ('pending','prepared','verified')),
 attempts integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(batch_id,registration_id)
);
alter table public.group_reception_tokens enable row level security;
alter table public.group_badge_batches enable row level security;
alter table public.group_badge_items enable row level security;
revoke all on public.group_reception_tokens,public.group_badge_batches,public.group_badge_items from anon,authenticated;
grant all on public.group_reception_tokens,public.group_badge_batches,public.group_badge_items to service_role;

-- Authentication is server-derived. Database checks remain mandatory on every call.
create function app.group_reception_operator(p_event uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$ begin
 perform 1 from public.event_user_roles where user_id=p_actor and
 ((role='admin' and event_id is null) or (role in ('manager','accoglienza') and event_id=p_event)) for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
end $$;

create function public.group_reception_credential(p_event uuid,p_actor uuid,p_group uuid,p_action text,
 p_hash text default null,p_encrypted text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.groups; q public.group_reception_tokens; allowed boolean; created boolean:=false;
begin
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 select * into g from public.groups where id=p_group and event_id=p_event and is_active for update;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.event_user_roles where user_id=p_actor and
 ((role='admin' and event_id is null) or (role='manager' and event_id=p_event)) for share;
 allowed:=found;
 if not allowed then
   -- Lock memberships and the hierarchy for the duration of credential access.
   lock table public.groups,public.group_memberships in share mode;
   with recursive scope as (
     select gr.id from public.groups gr join public.group_memberships m on m.group_id=gr.id
       where m.user_id=p_actor and m.role='capogruppo' and gr.event_id=p_event and gr.is_active
     union select gr.id from public.groups gr join scope s on gr.parent_group_id=s.id
       where gr.event_id=p_event and gr.is_active
   ) select exists(select 1 from scope where id=p_group) into allowed;
 end if;
 if not allowed then raise insufficient_privilege; end if;
 if p_action not in ('get','revoke','renew') or p_action is null then raise invalid_parameter_value; end if;
 select * into q from public.group_reception_tokens where group_id=p_group for update;
 if p_action='revoke' then
   update public.group_reception_tokens set revoked_at=clock_timestamp() where group_id=p_group;
 elsif p_action='renew' or q.group_id is null then
   if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_encrypted is null then raise invalid_parameter_value; end if;
   created:=true;
   insert into public.group_reception_tokens(group_id,token_hash,token_encrypted) values(p_group,p_hash,p_encrypted)
     on conflict(group_id) do update set token_hash=excluded.token_hash,token_encrypted=excluded.token_encrypted,revoked_at=null,created_at=clock_timestamp();
 end if;
 select * into q from public.group_reception_tokens where group_id=p_group;
 if p_action<>'get' or created then
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id)
 values(p_event,p_actor,'group_qr.'||case when p_action='get' then 'create' else p_action end,'groups',p_group); end if;
 return jsonb_build_object('active',q.revoked_at is null,'hash',q.token_hash,'encrypted',case when q.revoked_at is null then q.token_encrypted else null end);
end $$;

create function app.group_reception_people(p_event uuid,p_group uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'registrationId',s.registration_id,
   'kind',s.kind,'firstName',s.first_name,'lastName',s.last_name,'code',s.public_code,
   'checkedInAt',case when c.cancelled_at is null then c.checked_in_at else null end,
   'revision',s.check_in_revision) order by s.public_code,s.position,s.id),'[]'::jsonb)
 from (
 select r.id,r.id registration_id,'adult' kind,p.first_name,p.last_name,p.public_code,0 position,r.check_in_revision
 from public.registrations r join public.participants p on p.id=r.participant_id
 where r.event_id=p_event and r.deleted_at is null and r.cancelled_at is null and r.status in ('submitted','confirmed')
 and exists(select 1 from public.participant_group_assignments a where a.registration_id=r.id and a.group_id=p_group and a.is_current)
 union all
 select ch.id,r.id,'child',ch.first_name,ch.last_name,p.public_code,ch.position,r.check_in_revision
 from public.registrations r join public.participants p on p.id=r.participant_id join public.registration_children ch on ch.registration_id=r.id
 where r.event_id=p_event and r.deleted_at is null and r.cancelled_at is null and r.status in ('submitted','confirmed')
 and exists(select 1 from public.participant_group_assignments a where a.registration_id=r.id and a.group_id=p_group and a.is_current)
 ) s left join public.check_ins c on c.registration_id=s.registration_id and c.moment_id is null and coalesce(c.child_id,c.registration_id)=s.id
$$;

create function public.reception_group_check_in(p_event uuid,p_actor uuid,p_hash text,p_action text default 'inspect',
 p_request uuid default null,p_subjects uuid[] default '{}',p_snapshot text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.groups; people jsonb; snap text; fp text; previous public.check_in_requests;
 replay boolean:=false; item jsonb; ci public.check_ins; changed integer:=0; touched uuid[]:='{}'; outcome text:='verified';
begin
 perform app.group_reception_operator(p_event,p_actor);
 if p_action is null or p_action not in ('inspect','enter','correct','cancel') or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise invalid_parameter_value; end if;
 -- Short-lived table locks cover insertions/moves as well as existing rows: no phantom members.
 lock table public.groups,public.participant_group_assignments,public.registration_children in share mode;
 select gr.* into g from public.groups gr join public.group_reception_tokens q on q.group_id=gr.id
 where q.token_hash=p_hash and q.revoked_at is null and gr.event_id=p_event and gr.is_active for share of gr,q;
 if not found then return jsonb_build_object('status','invalid'); end if;
 perform 1 from public.registrations r where r.event_id=p_event and exists(
 select 1 from public.participant_group_assignments a where a.group_id=g.id and a.registration_id=r.id and a.is_current) order by r.id for update;
 people:=app.group_reception_people(p_event,g.id);
 if jsonb_array_length(people)>10000 then raise program_limit_exceeded; end if;
 snap:=encode(sha256(convert_to(people::text,'UTF8')),'hex');
 if p_action<>'inspect' then
   if p_request is null or p_subjects is null or cardinality(p_subjects)>10000 or array_position(p_subjects,null) is not null
     or cardinality(p_subjects)<>(select count(distinct x) from unnest(p_subjects) x) then raise invalid_parameter_value; end if;
   fp:=encode(sha256(convert_to(jsonb_build_array('group',p_event,p_actor,p_hash,p_action,p_subjects,p_snapshot)::text,'UTF8')),'hex');
   perform pg_advisory_xact_lock(hashtextextended(p_request::text,11));
   select * into previous from public.check_in_requests where request_id=p_request;
   if found then
     if previous.fingerprint<>fp then raise invalid_parameter_value; end if;
     replay:=true; outcome:='replayed';
   elsif p_snapshot is distinct from snap then return jsonb_build_object('status','conflict'); end if;
   if not replay then
     if exists(select 1 from unnest(p_subjects) x where not exists(select 1 from jsonb_array_elements(people) p where (p->>'id')::uuid=x))
       or (p_action='enter' and cardinality(p_subjects)=0) then raise invalid_parameter_value; end if;
     for item in select value from jsonb_array_elements(people) loop
       if p_action='enter' and not ((item->>'id')::uuid=any(p_subjects)) then continue; end if;
       if p_action='cancel' and not ((item->>'id')::uuid=any(p_subjects)) then continue; end if;
       ci:=null;
       select * into ci from public.check_ins where event_id=p_event and moment_id is null and registration_id=(item->>'registrationId')::uuid
         and coalesce(child_id,registration_id)=(item->>'id')::uuid for update;
       if p_action='cancel' or (p_action='correct' and not ((item->>'id')::uuid=any(p_subjects))) then
         if ci.id is not null and ci.cancelled_at is null then
           update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor where id=ci.id;
           touched:=array_append(touched,(item->>'registrationId')::uuid); changed:=changed+1;
         end if;
       elsif ci.id is null then
         insert into public.check_ins(event_id,registration_id,child_id,checked_in_by,updated_by,source)
         values(p_event,(item->>'registrationId')::uuid,case when item->>'kind'='child' then (item->>'id')::uuid else null end,p_actor,p_actor,'qr_scan');
         touched:=array_append(touched,(item->>'registrationId')::uuid); changed:=changed+1;
       elsif ci.cancelled_at is not null then
         update public.check_ins set cancelled_at=null,checked_in_at=clock_timestamp(),checked_in_by=p_actor,updated_at=clock_timestamp(),updated_by=p_actor,source='qr_scan' where id=ci.id;
         touched:=array_append(touched,(item->>'registrationId')::uuid); changed:=changed+1;
       end if;
     end loop;
     update public.registrations set check_in_revision=check_in_revision+1 where id=any(touched);
     insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request,p_event,p_actor,fp);
     outcome:=case when changed=0 then 'unchanged' else 'saved' end;
     people:=app.group_reception_people(p_event,g.id); snap:=encode(sha256(convert_to(people::text,'UTF8')),'hex');
   end if;
 end if;
 if p_action<>'inspect' then
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'reception.'||p_action,'groups',g.id,jsonb_build_object('source','group_qr','outcome',outcome,'request_id',p_request,'changed',changed,'selected',p_subjects));
 end if;
 return jsonb_build_object('status','valid','kind','group','groupId',g.id,'groupName',g.name,'snapshot',snap,
 'persons',people,'revision',0,'registrationStatus','confirmed','outcome',outcome);
end $$;

revoke all on function app.group_reception_operator(uuid,uuid),app.group_reception_people(uuid,uuid),
 public.group_reception_credential(uuid,uuid,uuid,text,text,text),public.reception_group_check_in(uuid,uuid,text,text,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function app.group_reception_operator(uuid,uuid),app.group_reception_people(uuid,uuid),
 public.group_reception_credential(uuid,uuid,uuid,text,text,text),public.reception_group_check_in(uuid,uuid,text,text,uuid,uuid[],text) to service_role;
create function public.group_badge_queue(p_event uuid,p_actor uuid,p_hash text,p_action text,
 p_batch uuid default null,p_registrations uuid[] default '{}',p_snapshot text default null,p_registration uuid default null,p_expected_attempts integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare view jsonb; b public.group_badge_batches; fp text; q record; items jsonb; selected integer;
begin
 -- Also rechecks credential revocation and locks current membership, event and role.
 view:=public.reception_group_check_in(p_event,p_actor,p_hash);
 if view->>'status'<>'valid' then return view; end if;
 if p_action not in ('create','read','prepare','verify','reprint') or p_action is null then raise invalid_parameter_value; end if;
 if p_action='create' then
   if p_batch is null or p_registrations is null or cardinality(p_registrations)=0 or cardinality(p_registrations)>10000
    or array_position(p_registrations,null) is not null or cardinality(p_registrations)<>(select count(distinct x) from unnest(p_registrations) x) then raise invalid_parameter_value; end if;
   fp:=encode(sha256(convert_to(jsonb_build_array(p_event,p_actor,p_hash,p_registrations,p_snapshot)::text,'UTF8')),'hex');
   perform pg_advisory_xact_lock(hashtextextended(view->>'groupId',14));
   perform pg_advisory_xact_lock(hashtextextended(p_batch::text,13));
   select * into b from public.group_badge_batches where id=p_batch for update;
   if found then
     if b.fingerprint<>fp then raise invalid_parameter_value; end if;
   else
     if exists(select 1 from public.group_badge_batches old join public.group_badge_items i on i.batch_id=old.id
       where old.group_id=(view->>'groupId')::uuid and old.event_id=p_event and i.state<>'verified'
       and exists(select 1 from jsonb_array_elements(view->'persons') p where p->>'kind'='adult' and (p->>'id')::uuid=i.registration_id)) then return jsonb_build_object('status','conflict'); end if;
     if p_snapshot is distinct from view->>'snapshot' then return jsonb_build_object('status','conflict'); end if;
     select count(*) into selected from jsonb_array_elements(view->'persons') p where p->>'kind'='adult' and (p->>'id')::uuid=any(p_registrations);
     if selected<>cardinality(p_registrations) then raise invalid_parameter_value; end if;
     insert into public.group_badge_batches(id,event_id,group_id,actor_user_id,fingerprint)
       values(p_batch,p_event,(view->>'groupId')::uuid,p_actor,fp) returning * into b;
     insert into public.group_badge_items(batch_id,registration_id,position)
       select p_batch,(p->>'id')::uuid,row_number() over(order by p->>'lastName',p->>'firstName',p->>'id')
       from jsonb_array_elements(view->'persons') p where p->>'kind'='adult' and (p->>'id')::uuid=any(p_registrations);
   end if;
 else
   select * into b from public.group_badge_batches where group_id=(view->>'groupId')::uuid and event_id=p_event
     and (p_batch is null or id=p_batch) order by created_at desc,id desc limit 1 for update;
   if b.id is null then return jsonb_build_object('status','empty'); end if;
 end if;
 if p_action in ('prepare','verify','reprint') then
   perform 1 from public.group_badge_items where batch_id=b.id and registration_id=p_registration for update;
   if not found or not exists(select 1 from jsonb_array_elements(view->'persons') p where p->>'kind'='adult' and (p->>'id')::uuid=p_registration) then
     return jsonb_build_object('status','conflict'); end if;
   if p_action in ('verify','reprint') and (p_expected_attempts is null or p_expected_attempts is distinct from (select attempts from public.group_badge_items where batch_id=b.id and registration_id=p_registration)) then return jsonb_build_object('status','conflict'); end if;
   if p_action='prepare' then
     select token_hash,token_encrypted,status,expires_at,revoked_at into q from public.qr_tokens where registration_id=p_registration order by created_at desc,id desc limit 1 for share;
     if not found or q.status<>'active' or q.revoked_at is not null or q.token_encrypted is null or (q.expires_at is not null and q.expires_at<=clock_timestamp()) then
       return jsonb_build_object('status','qr_unavailable'); end if;
     -- Mark before returning bytes. Retrying does not silently prepare a second copy.
     update public.group_badge_items set state='prepared',attempts=attempts+1,updated_at=clock_timestamp()
       where batch_id=b.id and registration_id=p_registration and state='pending';
     if not found then return jsonb_build_object('status','already_prepared'); end if;
     insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
       values(p_event,p_actor,'badge.prepared','group_badge_batches',b.id,jsonb_build_object('registration_id',p_registration));
     return jsonb_build_object('status','ready','encrypted',q.token_encrypted,'hash',q.token_hash,
       'person',(select p from jsonb_array_elements(view->'persons') p where p->>'kind'='adult' and (p->>'id')::uuid=p_registration));
   elsif p_action='verify' then
     update public.group_badge_items set state='verified',updated_at=clock_timestamp() where batch_id=b.id and registration_id=p_registration and state='prepared';
   else
     update public.group_badge_items set state='pending',updated_at=clock_timestamp() where batch_id=b.id and registration_id=p_registration and state<>'pending';
   end if;
   if found then insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
     values(p_event,p_actor,'badge.'||p_action,'group_badge_batches',b.id,jsonb_build_object('registration_id',p_registration)); end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('registrationId',i.registration_id,'position',i.position,'state',i.state,'attempts',i.attempts,
   'name',case when p is not null then (p->>'firstName')||' '||(p->>'lastName') else null end,
   'code',p->>'code','available',p is not null) order by i.position),'[]') into items
 from public.group_badge_items i left join jsonb_array_elements(view->'persons') p on p->>'kind'='adult' and (p->>'id')::uuid=i.registration_id where i.batch_id=b.id;
 return jsonb_build_object('status','queue','batchId',b.id,'items',items);
end $$;
revoke all on function public.group_badge_queue(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) from public,anon,authenticated;
grant execute on function public.group_badge_queue(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) to service_role;

notify pgrst,'reload schema';
commit;
