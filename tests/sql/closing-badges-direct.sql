insert into participant_contacts(participant_id,email,is_primary) values(f(20),'direct@example.invalid',true);
set role service_role;
do $$ declare p uuid; r jsonb; s public.ceremony_sectors; n integer; notice jsonb;
begin
 select id into p from ceremony_plans where kind='closing';
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17200),'save',null,
 jsonb_build_object('action','assign_direct','sectorId',(select id from ceremony_sectors where plan_id=p and layout_code='CLOSING_PURPLE'),
 'quantity',3,'seatIds','[]'::jsonb,'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null),jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41)))));
 assert r->>'status'='saved',r;
 assert get_my_ceremony_seats(f(1),f(35))='[]';
 assert not exists(select 1 from ceremony_publication_emails where plan_id=p);
 r:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17201),'publish',null,null);assert r->>'status'='saved',r;
 assert (select count(*)=1 and max(jsonb_array_length(payload->'lines'))=3 from ceremony_publication_emails where plan_id=p);
 assert jsonb_array_length(get_my_ceremony_seats(f(1),f(35)))=3;
 assert claim_ceremony_publication_email() is null;
 update closing_ceremony_badge_settings set instructions=(select jsonb_object_agg(code,jsonb_build_object('it','Testo sintetico','en','Synthetic text')) from unnest(array['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN']) code),enabled=true where plan_id=p;
 -- Revoking one child before claim removes only that badge from the message.
 perform revoke_ceremony_assignment(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(17202),'nominee',(select id from ceremony_nominees where plan_id=p and child_id=f(40) and revoked_at is null));
 notice:=claim_ceremony_publication_email();assert jsonb_array_length(notice->'payload'->'lines')=2;
 assert notice->>'destinationEmail'='direct@example.invalid';
 assert notice->'payload'->'lines'->0->>'badgeCode'='CLOSING_PURPLE';
 assert claim_ceremony_publication_email() is null;
end $$;
reset role;
select 'PASS closing Manager direct publication: drafts hidden, one family notice, personal PDF contract, revoked child removed before claim';
