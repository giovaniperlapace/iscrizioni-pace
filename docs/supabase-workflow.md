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

La Supabase CLI `2.106.0` e' installata sul server in `/usr/local/bin/supabase`, ma verso il Postgres interno forza TLS e riceve `server refused TLS connection`. Finché questo resta vero, non usare `supabase db push` per questo ambiente.

Usare invece lo script locale indicando obbligatoriamente il target. Durante
lo sviluppo P0-P10 il comando ordinario e':

```bash
npm run db:migrate:staging -- supabase/migrations/<timestamp>_<name>.sql
```

Lo script:

- legge esclusivamente `.env.staging.local` per staging oppure
  `.env.production.local` per production;
- non contiene fallback verso host, chiave SSH o container production;
- rifiuta staging se viene indicato il container production noto;
- copia la migration sul server e la applica con `psql` nel container scelto;
- applicazione e registrazione in `supabase_migrations.schema_migrations`
  avvengono nella stessa transazione;
- invia `notify pgrst, 'reload schema'`.

L'applicazione in production e' intenzionalmente piu' difficile e richiede sia
il target sia la versione esatta della migration:

```bash
npm run db:migrate:production -- \
  supabase/migrations/<timestamp>_<name>.sql \
  --confirm-production <timestamp>
```

Non eseguire questo comando per P0-P10 prima del collaudo complessivo e della
procedura finale di rilascio.

## Ambiente staging

- `.env.staging.example` documenta le variabili senza contenere segreti.
- `.env.staging.local` contiene le credenziali reali staging ed e' ignorato da
  Git.
- `npm run staging:sync-env -- --stack-id <id> --ssh-key <path-assoluto>`
  genera o aggiorna il file locale leggendo le chiavi dello stack via SSH,
  senza stamparle; preserva i segreti QR e cron gia' generati.
- `npm run staging:verify` blocca URL Supabase/application production ed email
  reali.
- `npm run dev:staging` avvia Next usando esplicitamente lo staging.
- `npm run build:staging` verifica la build con la stessa configurazione.
- I comandi Next staging passano le variabili al processo figlio tramite
  `scripts/run-next-staging.mjs`; non usare direttamente `node --env-file` con
  Next, perche' i worker della build rifiutano quell'opzione ereditata.
- Lo staging usa Auth, database e Storage distinti e dati sintetici. Non
  copiare dati personali production se non tramite un processo separato e
  documentato di anonimizzazione.
- Stack Coolify attuale: `jiio6ou5wzmma2xwas53cf1d`; endpoint API:
  `https://supabase-staging-jiio6ou5wzmma2xwas53cf1d.91.99.81.31.sslip.io`.
  I valori segreti restano esclusivamente in `.env.staging.local`, Coolify e
  Vercel e non devono essere riportati nella documentazione o nei commit.
- Vercel `Preview` usa le chiavi di questo stack e `EMAIL_DELIVERY_MODE=log`.
  Dopo il primo deploy del branch impostare `NEXT_PUBLIC_APP_URL`, `APP_URL` e
  `PUBLIC_SITE_URL` con l'URL Preview stabile e registrare lo stesso URL nella
  configurazione redirect di Supabase Auth staging.
- Dal 2026-08-07 il branch `codex/panel-p0-p10` usa l'alias Preview stabile
  `https://iscrizioni-pace-git-codex-pan-f98a13-giovaniperlapaces-projects.vercel.app`.
  Le tre URL applicative sono configurate nello scope Preview limitato al
  branch; GoTrue staging usa lo stesso URL come site URL e consente callback
  da quell'alias e da `http://localhost:3000/**`. Non riutilizzare questo URL
  o queste variabili nello scope Production.

Sotto il cofano, la parte applicativa equivalente e':

```bash
docker cp supabase/migrations/20260613120000_initial_schema_and_rls.sql \
  supabase-db-ammnuajlmd83t94cfy3us6cw:/tmp/iscrizioni-pace-migration-20260613120000.sql

docker exec supabase-db-ammnuajlmd83t94cfy3us6cw \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/iscrizioni-pace-migration-20260613120000.sql
```

La versione e' stata registrata manualmente per compatibilità con workflow migration futuri:

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
- accoglienza può inserire check-in ma non leggere contatti o dati di accessibilità completi;
- i dati sensibili restano invisibili a ruoli non autorizzati.

## Tipi TypeScript

Generare `lib/database.types.ts` solo dopo avere applicato lo schema a un ambiente reale o locale:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

Se non esiste un ambiente collegato, non creare tipi manuali finti: meglio lasciare il file assente finché non può essere generato dallo schema reale.
