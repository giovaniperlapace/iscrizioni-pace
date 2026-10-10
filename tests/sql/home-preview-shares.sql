-- Run in a fresh temporary database only.
create role anon; create role authenticated; create role service_role;
create schema app;
create table public.events(id uuid primary key, is_current boolean);
create table public.event_locations(id uuid primary key, event_id uuid, name text, address text);
create table public.event_moments(id uuid primary key, event_id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz, location_id uuid, publication_status text, moment_type text);
create table public.panel_audience_types(id uuid primary key, event_id uuid, booking_channel text);
create table public.panel_seat_sections(id uuid primary key, event_id uuid, panel_id uuid, audience_type_id uuid, capacity integer);
create function app.panel_section_occupancy(uuid) returns integer language sql as $$select 3$$;

\ir ../../supabase/migrations/20261010120000_home_preview_shares.sql
insert into events values ('00000000-0000-4000-8000-000000000001',true),('00000000-0000-4000-8000-000000000002',false);
insert into home_preview_shares(event_id,label,token_hash) values ('00000000-0000-4000-8000-000000000001','Test',repeat('a',64)),('00000000-0000-4000-8000-000000000002','Other event',repeat('b',64));
insert into event_locations values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Sala','Indirizzo');
insert into event_moments values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Forum bozza','Descrizione','2026-10-26 09:30+01','2026-10-26 12:30+01','00000000-0000-4000-8000-000000000003','draft','panel');
insert into panel_audience_types values ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','individual');
insert into panel_seat_sections values ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',10);
do $$declare v jsonb; begin
 if has_table_privilege('anon','home_preview_shares','select') or has_table_privilege('authenticated','home_preview_shares','select') or has_function_privilege('anon','get_shared_home_preview(text)','execute') or has_function_privilege('authenticated','get_shared_home_preview(text)','execute') then raise exception 'public privilege leak'; end if;
 if not has_function_privilege('service_role','get_shared_home_preview(text)','execute') then raise exception 'service denied'; end if;
 v:=get_shared_home_preview(repeat('a',64));
 if v->'panels'->0->>'title' <> 'Forum bozza' or (v->'panels'->0->>'remainingSeats')::int <> 7 then raise exception 'incorrect preview %',v; end if;
 if get_shared_home_preview(repeat('c',64)) is not null or get_shared_home_preview(repeat('b',64)) is not null then raise exception 'invalid token/event accepted'; end if;
 update event_locations set name='Sala aggiornata';
 if get_shared_home_preview(repeat('a',64))->'panels'->0->>'locationName' <> 'Sala aggiornata' then raise exception 'stale data'; end if;
 update home_preview_shares set revoked_at=now() where token_hash=repeat('a',64);
 if get_shared_home_preview(repeat('a',64)) is not null then raise exception 'revocation failed'; end if;
 update home_preview_shares set revoked_at=null,expires_at=now()-interval '1 second' where token_hash=repeat('a',64);
 if get_shared_home_preview(repeat('a',64)) is not null then raise exception 'expiry failed'; end if;
end $$;
