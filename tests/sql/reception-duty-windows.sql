-- The existing synthetic fixture has morning, afternoon and later-starting Forums.
begin;
do $$ declare catalog jsonb; morning jsonb; later jsonb; afternoon jsonb; closing jsonb; begin
 catalog:=app.reception_duty_catalog(fw(200));
 select c into morning from jsonb_array_elements(catalog) c where c->>'key'=fw(403)::text;
 select c into later from jsonb_array_elements(catalog) c where c->>'key'=fw(404)::text;
 select c into afternoon from jsonb_array_elements(catalog) c where c->>'key'=fw(402)::text;
 select c into closing from jsonb_array_elements(catalog) c where c->>'key'='closing';
 assert (morning->>'availableFrom')::timestamptz='2026-10-26 07:30 Europe/Rome'::timestamptz;
 assert morning->>'availableFrom'=later->>'availableFrom';
 assert (morning->>'availableUntil')::timestamptz='2026-10-26 13:30 Europe/Rome'::timestamptz;
 assert (afternoon->>'availableFrom')::timestamptz='2026-10-26 13:30 Europe/Rome'::timestamptz;
 assert (afternoon->>'availableUntil')::timestamptz='2026-10-26 19:30 Europe/Rome'::timestamptz;
 assert (closing->>'availableFrom')::timestamptz='2026-10-27 13:30 Europe/Rome'::timestamptz;
 assert (closing->>'availableUntil')::timestamptz='2026-10-28 00:00 Europe/Rome'::timestamptz;
 assert not exists(select 1 from ceremony_plans where event_id=fw(200) and kind='closing');
 -- All duties remain assigned; the catalogue is not filtered by the server's current date.
 perform set_reception_duties(fw(200),fw(11),fw(8),array['opening']);
 perform set_config('request.jwt.claim.sub',fw(8)::text,true);
 assert jsonb_array_length(public.reception_duty_catalog()->'choices')=8;
 assert (public.reception_duty_catalog()->>'serverNow')::timestamptz is not null;
end $$;
-- A configured ceremony uses its own canonical day and end, with Rome conversion.
select save_ceremony(fw(200),fw(10),'opening',-1,'configure','{"location":"Window test","capacity":2,"startsAt":"2026-10-25T16:30","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"afternoon"}');
do $$ declare opening jsonb; begin
 select c into opening from jsonb_array_elements(app.reception_duty_catalog(fw(200))) c where c->>'key'='opening';
 assert (opening->>'availableFrom')::timestamptz='2026-10-25 13:00 UTC'::timestamptz;
 assert (opening->>'availableUntil')::timestamptz='2026-10-25 19:30 UTC'::timestamptz;
end $$;
rollback;
\echo PASS Rome windows 07:30/13:30/14:00, later Forum, final-day fallback, no fabricated ceremony, full authorized catalogue and server clock
