-- Local/reviewable only. Extends the canonical badge queue; no attendance/QR writes.
begin;
alter table public.group_badge_batches alter column group_id drop not null;
alter table public.group_badge_batches add column artifact text not null default 'full_badge'
 check (artifact in ('full_badge','qr_label','qr_label_run'));
alter table public.group_badge_batches add column manifest jsonb;
alter table public.group_badge_batches add column label_profile text;
alter table public.group_badge_batches add column label_scope jsonb;
alter table public.group_badge_batches add constraint badge_batch_scope check (artifact <> 'full_badge' or group_id is not null);
alter table public.group_badge_items add column artifact text not null default 'full_badge'
 check (artifact in ('full_badge','qr_label'));
-- Registration IDs are event-specific. One shared QR label state across groups/desks.
create unique index one_canonical_qr_label on public.group_badge_items(registration_id) where artifact='qr_label';
alter table public.group_badge_items add column label_content text;
alter table public.group_badge_items add column last_request_id uuid references public.group_badge_batches(id);
alter table public.group_badge_items add column label_outcome text check (label_outcome in ('requested','browser_returned','error'));

create function app.qr_label_people(p_event uuid,p_group uuid,p_registration uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'registrationId',r.id,'firstName',p.first_name,'lastName',p.last_name,'name',p.first_name||' '||p.last_name,'code',p.public_code,
  'reason',case when r.deleted_at is not null then 'deleted' when r.cancelled_at is not null or r.status='cancelled' then 'cancelled'
    when r.status not in ('submitted','confirmed') then 'inactive'
    when q.id is null then 'missing' when q.revoked_at is not null or q.status='revoked' then 'revoked'
    when q.status='expired' or q.expires_at<=statement_timestamp() then 'expired' when q.status<>'active' or q.token_encrypted is null then 'missing' else null end,
  'encrypted',q.token_encrypted,'hash',q.token_hash,
  'content',encode(sha256(convert_to(jsonb_build_array(p.first_name,p.last_name,p.public_code,q.id,q.token_hash,q.token_encrypted)::text,'UTF8')),'hex'),
  'state',coalesce(i.state,'pending'),'attempts',coalesce(i.attempts,0),'outcome',i.label_outcome,
  'printedContent',i.label_content,'updatedAt',i.updated_at
 ) order by p.last_name,p.first_name,r.id),'[]'::jsonb)
 from public.registrations r join public.participants p on p.id=r.participant_id
 left join lateral (select * from public.qr_tokens where registration_id=r.id order by created_at desc,id desc limit 1) q on true
 left join public.group_badge_items i on i.registration_id=r.id and i.artifact='qr_label'
 where r.event_id=p_event and ((p_group is null and r.id=p_registration) or (p_group is not null and exists(
  select 1 from public.participant_group_assignments a where a.registration_id=r.id and a.group_id=p_group and a.is_current)))
$$;

create function public.qr_label_queue(p_event uuid,p_actor uuid,p_action text,p_group uuid default null,p_registration uuid default null,
 p_ids uuid[] default '{}',p_snapshot text default null,p_request uuid default null,p_profile text default null,p_outcome text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare people jsonb; snap text; fp text; old public.group_badge_batches; row jsonb; item public.group_badge_items;
 owner uuid; run_manifest jsonb:='[]';
begin
 perform 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 if (p_group is null)=(p_registration is null) or p_action is null or p_action not in ('read','print','reprint','verify','outcome') then raise invalid_parameter_value; end if;
 -- Covers membership insertions/moves, identity changes and token rotations while claiming.
 -- Short transaction only: rendering and physical printing happen outside these locks.
 lock table public.groups,public.participant_group_assignments,public.registrations,public.participants,public.qr_tokens in share mode;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,141045));
 if p_group is not null and not exists(select 1 from public.groups where id=p_group and event_id=p_event and is_active) then raise insufficient_privilege; end if;
 people:=app.qr_label_people(p_event,p_group,p_registration);
 if jsonb_array_length(people)>10000 then raise program_limit_exceeded; end if;
 snap:=encode(sha256(convert_to(people::text,'UTF8')),'hex');
 if p_action='outcome' then
  if p_outcome is null or p_outcome not in ('browser_returned','error') then raise invalid_parameter_value; end if;
  select * into old from public.group_badge_batches where id=p_request and event_id=p_event and artifact='qr_label_run' and actor_user_id=p_actor;
  if old.id is null or old.label_scope->>'groupId' is distinct from p_group::text or (p_group is null and old.manifest->0->>'registrationId' is distinct from p_registration::text) then raise insufficient_privilege; end if;
  update public.group_badge_items set label_outcome=p_outcome,updated_at=clock_timestamp()
   where artifact='qr_label' and last_request_id=p_request and label_outcome='requested';
  if found then insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(p_event,p_actor,'qr_label.'||p_outcome,'group_badge_batches',p_request,'{}'); end if;
 elsif p_action<>'read' then
  if cardinality(p_ids) is null or cardinality(p_ids)=0 or cardinality(p_ids)>10000 or array_position(p_ids,null) is not null
   or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise invalid_parameter_value; end if;
  if p_action in ('print','reprint') then
   if p_request is null or p_profile is null or p_profile not in ('die-cut-29x90','continuous-29x45') then raise invalid_parameter_value; end if;
   fp:=encode(sha256(convert_to(jsonb_build_array(p_event,p_actor,p_group,p_registration,p_ids,p_snapshot,p_profile,p_action)::text,'UTF8')),'hex');
   select * into old from public.group_badge_batches where id=p_request;
   if found then
    if old.artifact<>'qr_label_run' or old.fingerprint<>fp then raise invalid_parameter_value; end if;
    -- Retry after a lost response must never return a second printable document.
    return jsonb_build_object('status','replayed');
   end if;
  end if;
  if p_snapshot is distinct from snap then return jsonb_build_object('status','conflict'); end if;
  if (select count(*) from jsonb_array_elements(people) x where (x->>'registrationId')::uuid=any(p_ids))<>cardinality(p_ids) then raise invalid_parameter_value; end if;
  for row in select x from jsonb_array_elements(people) x where (x->>'registrationId')::uuid=any(p_ids) loop
   if row->>'reason' is not null then return jsonb_build_object('status','conflict'); end if;
   if p_action='print' and row->>'state'<>'pending' then return jsonb_build_object('status','conflict'); end if;
   if p_action='reprint' and row->>'state'='pending' then return jsonb_build_object('status','conflict'); end if;
   if p_action='verify' and (row->>'state'<>'prepared' or row->>'printedContent' is distinct from row->>'content') then return jsonb_build_object('status','conflict'); end if;
  end loop;
  if p_action in ('print','reprint') then
   insert into public.group_badge_batches(id,event_id,group_id,actor_user_id,fingerprint,artifact,label_profile,label_scope)
    values(p_request,p_event,null,p_actor,fp,'qr_label_run',p_profile,jsonb_build_object('groupId',p_group,'registrationId',p_registration));
  end if;
  for row in select x from jsonb_array_elements(people) x where (x->>'registrationId')::uuid=any(p_ids) loop
   select * into item from public.group_badge_items where artifact='qr_label' and registration_id=(row->>'registrationId')::uuid;
   if item.batch_id is null then
    owner:=gen_random_uuid();
    insert into public.group_badge_batches(id,event_id,actor_user_id,fingerprint,artifact) values(owner,p_event,p_actor,row->>'content','qr_label');
    insert into public.group_badge_items(batch_id,registration_id,position,artifact) values(owner,(row->>'registrationId')::uuid,1,'qr_label') returning * into item;
   end if;
   if p_action='verify' then
    update public.group_badge_items set state='verified',updated_at=clock_timestamp() where batch_id=item.batch_id and registration_id=item.registration_id;
   else
    update public.group_badge_items set state='prepared',attempts=attempts+1,label_content=row->>'content',last_request_id=p_request,
     label_outcome='requested',updated_at=clock_timestamp() where batch_id=item.batch_id and registration_id=item.registration_id;
    run_manifest:=run_manifest||jsonb_build_array(jsonb_build_object('registrationId',item.registration_id,'attempt',item.attempts+1));
   end if;
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event,p_actor,'qr_label.'||p_action,'group_badge_batches',item.batch_id,
     jsonb_build_object('registration_id',item.registration_id,'attempt',item.attempts+case when p_action='verify' then 0 else 1 end,'request_id',p_request));
  end loop;
  if p_action in ('print','reprint') then
   update public.group_badge_batches b set manifest=run_manifest where b.id=p_request;
   return jsonb_build_object('status','claimed','requestId',p_request);
  end if;
 end if;
 people:=app.qr_label_people(p_event,p_group,p_registration);
 return jsonb_build_object('status','queue','items',people,'snapshot',encode(sha256(convert_to(people::text,'UTF8')),'hex'));
end $$;
revoke all on function app.qr_label_people(uuid,uuid,uuid),public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text) from public,anon,authenticated;
grant execute on function app.qr_label_people(uuid,uuid,uuid),public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
