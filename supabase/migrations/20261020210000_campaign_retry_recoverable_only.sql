-- Invalid addresses and oversized immutable messages need a new reviewed campaign, not an identical retry.
create or replace function public.retry_email_campaign_recipients(p_campaign_id uuid,p_recipient_ids uuid[],p_actor_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare c email_campaigns; r email_campaign_recipients; new_id uuid; existing_id uuid; count_ids integer;
begin
 select * into c from email_campaigns where id=p_campaign_id for update;
 if c.id is null or not exists(select 1 from event_user_roles where user_id=p_actor_id and
   ((role='admin' and event_id is null) or (role='manager' and event_id=c.event_id))) then raise exception 'Accesso non consentito'; end if;
 if c.status not in ('completed','partial','failed','attention') or c.test_sent_at is null then raise exception 'Campagna non conclusa'; end if;
 select count(distinct x) into count_ids from unnest(p_recipient_ids) x;
 if count_ids=0 or count_ids>500 or count_ids<>cardinality(p_recipient_ids) then raise exception 'Selezione non valida'; end if;
 if exists(select 1 from email_campaign_retry_links where source_recipient_id=any(p_recipient_ids)) then
   select min(retry_campaign_id::text)::uuid into existing_id from email_campaign_retry_links where source_recipient_id=any(p_recipient_ids);
   if (select count(*) from email_campaign_retry_links where source_recipient_id=any(p_recipient_ids) and retry_campaign_id=existing_id)=count_ids
    and (select count(*) from email_campaign_retry_links where retry_campaign_id=existing_id)=count_ids
    and (select retry_of_campaign_id from email_campaigns where id=existing_id)=p_campaign_id then return existing_id; end if;
   raise exception 'Alcuni destinatari hanno già un reinvio: aggiornare il report';
 end if;
 if (select count(*) from email_campaign_recipients where campaign_id=c.id and id=any(p_recipient_ids))<>count_ids then raise exception 'Destinatari non validi'; end if;
 for r in select * from email_campaign_recipients where campaign_id=c.id and id=any(p_recipient_ids) for update loop
  if r.delivery_email_snapshot is null or exists(select 1 from email_delivery_suppressions where email_hash=encode(extensions.digest(lower(trim(r.delivery_email_snapshot)),'sha256'),'hex') and suppressed)
    or exists(select 1 from email_delivery_events where message_hash=r.provider_message_id and kind in ('Delivery','SpamComplaint'))
    or not ((r.status='failed' and r.error_code='delivery_failed')
      or (r.status='sent' and exists(select 1 from email_delivery_events where message_hash=r.provider_message_id and kind='Bounce' and retryable)
        and not exists(select 1 from email_delivery_events where message_hash=r.provider_message_id and kind='Bounce' and not retryable))) then
   raise exception 'Destinatario non reinviabile';
  end if;
 end loop;
 insert into email_campaigns(event_id,name,subject_template,body_template,status,filters_snapshot,recipient_count,test_sent_at,test_sent_to_user_id,sent_at,created_by,retry_of_campaign_id)
 values(c.event_id,left('Reinvio · '||c.name,120),c.subject_template,c.body_template,'scheduled',c.filters_snapshot,count_ids,c.test_sent_at,c.test_sent_to_user_id,now(),p_actor_id,c.id) returning id into new_id;
 insert into email_campaign_recipients(campaign_id,participant_id,registration_id,delivery_kind,delegate_user_id,status,recipient_key,recipient_type,recipient_user_id,school_teacher_id,delivery_order,scheduled_for,delivery_email_snapshot,recipient_name_snapshot)
 select new_id,participant_id,registration_id,delivery_kind,delegate_user_id,'scheduled',recipient_key,recipient_type,recipient_user_id,school_teacher_id,delivery_order,(now() at time zone 'Europe/Rome')::date,delivery_email_snapshot,recipient_name_snapshot
 from email_campaign_recipients where id=any(p_recipient_ids);
 insert into email_campaign_retry_links(source_recipient_id,retry_campaign_id) select unnest(p_recipient_ids),new_id;
 insert into audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(c.event_id,p_actor_id,'email_campaign.selective_retry','email_campaigns',new_id,jsonb_build_object('source_campaign_id',c.id,'recipient_count',count_ids));
 return new_id;
end $$;
revoke all on function public.retry_email_campaign_recipients(uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.retry_email_campaign_recipients(uuid,uuid[],uuid) to service_role;
