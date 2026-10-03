-- Dedicated milestone: assisted geography and strictly internal sex.
-- No backfill. Existing participant/questionnaire data is untouched.
begin;
create table public.registration_internal_demographics (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  sex text not null check (sex in ('male','female')),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.registration_internal_demographics enable row level security;
revoke all on public.registration_internal_demographics from public, anon, authenticated;
grant select, insert on public.registration_internal_demographics to service_role;

-- All operations recheck the current event and the existing operational scope.
create function public.lock_assisted_demographics(p_registration_id uuid,p_actor_user_id uuid)
returns public.registrations language plpgsql security invoker set search_path='' as $$
declare r public.registrations%rowtype;
begin
 r := public.lock_operational_registration(p_registration_id,p_actor_user_id);
 if not exists(select 1 from public.events where id=r.event_id and is_current) then
   raise exception 'Not current event' using errcode='42501';
 end if;
 return r;
end $$;
revoke all on function public.lock_assisted_demographics(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lock_assisted_demographics(uuid,uuid) to service_role;

create function public.set_assisted_registration_sex(p_registration_id uuid,p_actor_user_id uuid,p_sex text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.registrations%rowtype; previous text;
begin
 r := public.lock_assisted_demographics(p_registration_id,p_actor_user_id);
 -- Only the creator of an assisted registration can supply this internal field.
 if r.created_by is distinct from p_actor_user_id or r.source not in ('admin','capogruppo') then
   raise exception 'Not assisted creator' using errcode='42501';
 end if;
 if p_sex is null or p_sex not in ('male','female') then raise exception 'Invalid sex' using errcode='22023'; end if;
 select sex into previous from public.registration_internal_demographics where registration_id=r.id;
 if found then
   if previous=p_sex then return; end if;
   raise exception 'Already recorded' using errcode='PT409';
 end if;
 insert into public.registration_internal_demographics(registration_id,sex,recorded_by) values(r.id,p_sex,p_actor_user_id);
 -- Audit existence only: the value must never leak through generic audit exports.
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(r.event_id,p_actor_user_id,'registration.internal_demographics_recorded','registrations',r.id,'{}');
end $$;
revoke all on function public.set_assisted_registration_sex(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_assisted_registration_sex(uuid,uuid,text) to service_role;

create function public.get_operational_registration_sexes(p_registration_ids uuid[],p_actor_user_id uuid)
returns table(registration_id uuid,sex text) language plpgsql security invoker set search_path='' as $$
declare rid uuid;
begin
 if p_registration_ids is null or cardinality(p_registration_ids)>200 then raise exception 'Invalid batch' using errcode='22023'; end if;
 -- Fail the complete request if any supplied ID is outside the actor's scope.
 for rid in select distinct unnest(p_registration_ids) order by 1 loop
   perform public.lock_assisted_demographics(rid,p_actor_user_id);
 end loop;
 return query select d.registration_id,d.sex from public.registration_internal_demographics d where d.registration_id=any(p_registration_ids);
end $$;
revoke all on function public.get_operational_registration_sexes(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.get_operational_registration_sexes(uuid[],uuid) to service_role;

create function public.get_operational_demographics(p_registration_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.registrations%rowtype; p public.participants%rowtype; q public.registration_questionnaire_answers%rowtype; country text;
begin
 r := public.lock_assisted_demographics(p_registration_id,p_actor_user_id);
 select * into p from public.participants where id=r.participant_id for update;
 select * into q from public.registration_questionnaire_answers where registration_id=r.id order by created_at desc,id desc limit 1 for update;
 select name_it into country from public.countries where id=p.country_id;
 return jsonb_build_object('nationality',q.answers->>'nationality','birthPlace',q.answers->>'birthPlace',
   'country',coalesce(nullif(btrim(p.country_other),''),country),'countryId',p.country_id,'countryOther',p.country_other,
   'questionnaireId',q.id);
end $$;
revoke all on function public.get_operational_demographics(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_operational_demographics(uuid,uuid) to service_role;

create function public.update_operational_demographics(p_registration_id uuid,p_actor_user_id uuid,p_expected jsonb,p_value jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.registrations%rowtype; current_data jsonb; nationality text; birthplace text; country text;
begin
 r := public.lock_assisted_demographics(p_registration_id,p_actor_user_id);
 current_data := public.get_operational_demographics(r.id,p_actor_user_id);
 if p_expected is distinct from current_data then raise exception 'Demographics changed' using errcode='PT409'; end if;
 if jsonb_typeof(p_value) is distinct from 'object' or p_value-array['nationality','birthPlace','country'] <> '{}'::jsonb
   or (select count(*) from jsonb_each(p_value))<>3
   or exists(select 1 from jsonb_each(p_value) where jsonb_typeof(value) not in ('string','null') or length(value#>>'{}')>200) then
   raise exception 'Invalid demographics' using errcode='22023';
 end if;
 nationality := nullif(btrim(p_value->>'nationality'),''); birthplace := nullif(btrim(p_value->>'birthPlace'),''); country := nullif(btrim(p_value->>'country'),'');
 if country is distinct from current_data->>'country' then
   update public.participants set country_other=country,country_id=null where id=r.participant_id;
 end if;
 if current_data->>'questionnaireId' is null then
   insert into public.registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
   values(r.id,r.event_id,'2026-09-29-assisted-demographics',jsonb_build_object('nationality',nationality,'birthPlace',birthplace));
 else
   update public.registration_questionnaire_answers set answers=answers || jsonb_build_object('nationality',nationality,'birthPlace',birthplace)
   where id=(current_data->>'questionnaireId')::uuid;
 end if;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(r.event_id,p_actor_user_id,'registration.demographics_updated','registrations',r.id,jsonb_build_object('fields',array['nationality','birthPlace','country']));
 return public.get_operational_demographics(r.id,p_actor_user_id);
end $$;
revoke all on function public.update_operational_demographics(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.update_operational_demographics(uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
