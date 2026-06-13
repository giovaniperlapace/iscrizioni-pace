# Workflow Supabase

Questa guida parte dalla Milestone 3. Il repository contiene migration versionate e la migration iniziale e' stata applicata al Supabase self-hosted Hetzner/Coolify.

## Regole

- Applicare migration solo su un ambiente esplicitamente concordato.
- Tenere URL, anon key, service role key e token CLI fuori dal repository.
- Applicare prima in locale o staging quando possibile.
- Non modificare manualmente lo schema del database senza aggiungere una migration equivalente.
- Dopo ogni migration verificare schema, indici, trigger, RLS e ruoli applicativi.

## Applicazione migration

Quando Supabase CLI e ambiente sono disponibili con Postgres raggiungibile:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Per il Supabase self-hosted attuale:

- server: `91.99.81.31`;
- container DB: `supabase-db-ammnuajlmd83t94cfy3us6cw`;
- network Docker: `ammnuajlmd83t94cfy3us6cw`;
- servizio Coolify: `supabase-ammnuajlmd83t94cfy3us6cw`.

La Supabase CLI `2.106.0` e' installata sul server in `/usr/local/bin/supabase`, ma verso il Postgres interno forza TLS e riceve `server refused TLS connection`. Finche' questo resta vero, non usare `supabase db push` per questo ambiente.

Usare invece lo script locale:

```bash
./scripts/apply-remote-migration.sh supabase/migrations/<timestamp>_<name>.sql
```

Lo script:

- legge `.env.local` se presente;
- usa SSH verso `root@91.99.81.31` con `~/.ssh/id_ed25519_hetzner_20260613`;
- copia la migration sul server;
- applica SQL con `psql` dentro `supabase-db-ammnuajlmd83t94cfy3us6cw`;
- registra la versione in `supabase_migrations.schema_migrations`;
- invia `notify pgrst, 'reload schema'`.

Sotto il cofano, la parte applicativa equivalente e':

```bash
docker cp supabase/migrations/20260613120000_initial_schema_and_rls.sql \
  supabase-db-ammnuajlmd83t94cfy3us6cw:/tmp/iscrizioni-pace-migration-20260613120000.sql

docker exec supabase-db-ammnuajlmd83t94cfy3us6cw \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/iscrizioni-pace-migration-20260613120000.sql
```

La versione e' stata registrata manualmente per compatibilita' con workflow migration futuri:

```sql
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

insert into supabase_migrations.schema_migrations(version, name, statements)
values ('20260613120000', 'initial_schema_and_rls', array[]::text[])
on conflict (version) do update set name = excluded.name;
```

## Verifica schema

Controlli minimi dopo l'applicazione:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## Verifica RLS

La verifica RLS non va fatta solo con service role. Preparare utenti reali o JWT equivalenti per:

- partecipante;
- capogruppo;
- manager;
- manager_viewer;
- admin;
- accoglienza.

Casi negativi minimi:

- un partecipante non legge registrazioni di altri partecipanti;
- un capogruppo non legge registrazioni fuori dai propri gruppi;
- un manager vede solo eventi assegnati;
- un manager_viewer non modifica registrazioni;
- accoglienza puo' inserire check-in ma non leggere contatti o dati di accessibilita' completi;
- i dati sensibili restano invisibili a ruoli non autorizzati.

## Tipi TypeScript

Generare `lib/database.types.ts` solo dopo avere applicato lo schema a un ambiente reale o locale:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

Se non esiste un ambiente collegato, non creare tipi manuali finti: meglio lasciare il file assente finche' non puo' essere generato dallo schema reale.
