-- Only the requested event's 26 October morning may start early.
begin;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current)
 values('d302dff4-f08d-4040-8d83-9ec2042a73d5','synthetic-early-selection','Synthetic early selection','Test','IT','2026-10-25','2026-10-27','draft',false);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at)
 values
 (fw(9801),'d302dff4-f08d-4040-8d83-9ec2042a73d5','panel','Morning','2026-10-26 09:00 Europe/Rome','2026-10-26 11:00 Europe/Rome'),
 (fw(9802),'d302dff4-f08d-4040-8d83-9ec2042a73d5','panel','Morning connected room','2026-10-26 11:00 Europe/Rome','2026-10-26 12:00 Europe/Rome'),
 (fw(9803),'d302dff4-f08d-4040-8d83-9ec2042a73d5','panel','Afternoon','2026-10-26 16:00 Europe/Rome','2026-10-26 18:00 Europe/Rome'),
 (fw(9804),'d302dff4-f08d-4040-8d83-9ec2042a73d5','panel','Tuesday','2026-10-27 09:00 Europe/Rome','2026-10-27 11:00 Europe/Rome');
do $$ declare catalog jsonb; c jsonb; begin
 catalog:=app.reception_duty_catalog('d302dff4-f08d-4040-8d83-9ec2042a73d5');
 for c in select value from jsonb_array_elements(catalog) where value->>'key' in(fw(9801)::text,fw(9802)::text) loop
  assert (c->>'availableFrom')::timestamptz='2026-10-25 18:25 Europe/Rome'::timestamptz;
  assert (c->>'availableUntil')::timestamptz='2026-10-26 13:30 Europe/Rome'::timestamptz;
 end loop;
 select value into c from jsonb_array_elements(catalog) where value->>'key'=fw(9803)::text;
 assert (c->>'availableFrom')::timestamptz='2026-10-26 13:30 Europe/Rome'::timestamptz;
 select value into c from jsonb_array_elements(catalog) where value->>'key'=fw(9804)::text;
 assert (c->>'availableFrom')::timestamptz='2026-10-27 07:30 Europe/Rome'::timestamptz;
 select value into c from jsonb_array_elements(catalog) where value->>'key'='opening';
 assert (c->>'availableFrom')::timestamptz='2026-10-25 13:30 Europe/Rome'::timestamptz;
 assert (c->>'availableUntil')::timestamptz='2026-10-26 00:00 Europe/Rome'::timestamptz;
 select value into c from jsonb_array_elements(app.reception_duty_catalog(fw(200))) where value->>'key'=fw(403)::text;
 assert (c->>'availableFrom')::timestamptz='2026-10-26 07:30 Europe/Rome'::timestamptz,'Other events unchanged';
end $$;
rollback;
\echo PASS early Monday selection scoped to requested event/date, connected room, unchanged end/opening/afternoon/Tuesday/other events
