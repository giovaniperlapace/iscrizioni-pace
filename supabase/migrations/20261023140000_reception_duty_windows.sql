begin;
-- Selection windows only. Permissions, assignments and check-in RPCs are unchanged.
create or replace function app.reception_duty_catalog(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with duties as (
  select 0 ordering,m.id::text key,m.title,l.name room,'panel'::text kind,
   m.starts_at,m.ends_at,(m.starts_at at time zone 'Europe/Rome')::date as duty_day,
   (m.starts_at at time zone 'Europe/Rome')::time < time '12:00' morning
  from public.event_moments m left join public.event_locations l on l.id=m.location_id
  where m.event_id=p_event and m.moment_type='panel'
  union all
  select case when c.kind='opening' then 1 else 2 end,c.kind,
   case when c.kind='opening' then 'Cerimonia d’apertura' else 'Cerimonia finale' end,
   l.name,'ceremony',m.starts_at,m.ends_at,
   coalesce((m.starts_at at time zone 'Europe/Rome')::date,
    case when c.kind='opening' then e.starts_on else e.ends_on end),false
  from public.events e cross join (values('opening'),('closing')) c(kind)
  left join public.ceremony_plans p on p.event_id=e.id and p.kind=c.kind
  left join public.event_moments m on m.id=p.moment_id and m.event_id=e.id
  left join public.event_locations l on l.id=m.location_id
  where e.id=p_event
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'key',key,'title',title,'room',room,'kind',kind,
  'availableFrom',(duty_day + case when key='opening' then time '14:00' when morning then time '07:30' else time '13:30' end) at time zone 'Europe/Rome',
  'availableUntil',case when morning then (duty_day + time '13:30') at time zone 'Europe/Rome'
   else least(coalesce(ends_at + interval '90 minutes',(duty_day + 1)::timestamp at time zone 'Europe/Rome'),
    (duty_day + 1)::timestamp at time zone 'Europe/Rome') end
 ) order by ordering,title),'[]'::jsonb) from duties;
$$;

create or replace function public.reception_duty_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e uuid; managed boolean; keys text[];
begin
 select id into e from public.events where is_current;
 if e is null or auth.uid() is null then raise insufficient_privilege; end if;
 managed:=app.has_event_role(e,array['manager']::public.app_role[]);
 keys:=app.reception_duty_keys(e,auth.uid());
 return jsonb_build_object('eventId',e,'canManage',managed,'serverNow',statement_timestamp(),'choices',
 coalesce((select jsonb_agg(c) from jsonb_array_elements(app.reception_duty_catalog(e)) c where managed or c->>'key'=any(keys)),'[]'),
 'assigned',to_jsonb(keys));
end $$;
commit;
