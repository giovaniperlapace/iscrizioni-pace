begin;
-- Read-only capability derived from the same assignments as the visible role.
-- No assignment backfill, no general reception grant, no writes or row locks.
create function public.reception_registration_check(p_event uuid,p_actor uuid,p_kind text,p_value text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rid uuid;
begin
 if not exists(select 1 from public.events where id=p_event and is_current)
  or not (exists(select 1 from public.panel_reception_assignments where event_id=p_event and user_id=p_actor)
   or exists(select 1 from public.ceremony_reception_assignments where event_id=p_event and user_id=p_actor)) then
  raise insufficient_privilege;
 end if;
 if p_kind is null or p_kind not in ('qr','code') or p_value is null
  or (p_kind='qr' and p_value !~ '^[a-f0-9]{64}$')
  or (p_kind='code' and p_value !~ '^[A-Z0-9]{4}$') then raise invalid_parameter_value; end if;

 -- Same active-registration and latest-token rules as operational reception.
 -- A school/group QR cannot identify an individual and is not accepted here.
 if p_kind='qr' then
  select q.registration_id into rid from public.qr_tokens q where q.token_hash=p_value
   and q.status='active' and q.revoked_at is null
   and (q.expires_at is null or q.expires_at>statement_timestamp())
   and q.id=(select latest.id from public.qr_tokens latest where latest.registration_id=q.registration_id
    order by latest.created_at desc,latest.id desc limit 1)
   and not exists(select 1 from public.school_booking_qr_tokens where token_hash=p_value);
 else
  select r.id into rid from public.registrations r join public.participants p on p.id=r.participant_id
   where r.event_id=p_event and p.public_code=p_value;
 end if;
 select jsonb_build_object('status','valid','kind','family','outcome','verified',
  'revision',r.check_in_revision,'registrationStatus',r.status,'code',p.public_code,
  'persons',jsonb_build_array(jsonb_build_object('id',r.id,'kind','adult',
   'firstName',p.first_name,'lastName',p.last_name,'checkedInAt',c.checked_in_at))) into result
 from public.registrations r join public.participants p on p.id=r.participant_id
 left join public.check_ins c on c.registration_id=r.id and c.event_id=p_event
  and c.child_id is null and c.moment_id is null and c.cancelled_at is null
 where r.id=rid and r.event_id=p_event and r.deleted_at is null and r.cancelled_at is null
  and r.status in ('submitted','confirmed');
 return coalesce(result,jsonb_build_object('status','invalid'));
end $$;
revoke all on function public.reception_registration_check(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reception_registration_check(uuid,uuid,text,text) to service_role;
commit;
