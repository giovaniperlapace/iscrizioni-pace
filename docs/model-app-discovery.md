# Milestone 0 - Discovery repository e app modello

Data discovery: 2026-06-13.

## Stato repository locale

Cartella verificata:

`/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/codex/iscrizioni-pace`

Esito comandi:

- `pwd`: cartella corretta del progetto `iscrizioni-pace`.
- `git status --short`: fallisce con `fatal: not a git repository (or any of the parent directories): .git`.
- `git branch --show-current`: fallisce per lo stesso motivo.
- `git remote -v`: fallisce per lo stesso motivo.

Conclusione: questa cartella contiene materiali iniziali e documentazione, ma non e' ancora una working copy Git. Prima di Milestone 1 va deciso se:

- inizializzare qui una repo Git e collegare `origin` a `https://github.com/giovaniperlapace/iscrizioni-pace`;
- oppure clonare la repo GitHub in una nuova cartella e spostare/copiare dentro solo i file necessari.

Non sono stati eseguiti commit, push, installazioni, scaffold, migration o modifiche applicative.

## Inventario progetto iniziale

File rilevati nella cartella `iscrizioni-pace`:

- `AGENTS.md`.
- `PIANO_DI_LAVORO.md`.
- `Descrizione app descrizione.txt`.
- `materiali-dati/ComunitaEQuartieri.xlsx`.
- `.DS_Store`.
- `.Rhistory`.

La cartella non contiene ancora `package.json`, `app`, `lib`, `components`, `supabase/migrations` o config Next.js. Questi andranno creati solo in una milestone di setup.

## Materiali dati iniziali

`materiali-dati/ComunitaEQuartieri.xlsx` contiene:

- Foglio: `ComunitaEQuartieri`.
- Righe dati: 297.
- Colonne: `divisione`, `raggruppamento`, `comunita`, `quartiere`, `num`.

Uso probabile futuro:

- Base per seed/import di comunità, quartieri o gruppi.
- Possibile input per regole iniziali di associazione gruppo per citta/quartiere.

Limiti:

- Non e' ancora uno schema definitivo di gruppi/capigruppo.
- Manca l'associazione esplicita a paese, evento, capogruppo utente, email e scope.
- Va normalizzato e validato prima di diventare seed o migration.

## Stato app modello

App modello letta in sola consultazione:

`/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/modello_app`

Anche questa cartella locale non risulta una working copy Git: `git status --short` fallisce con `not a git repository`.

Stack rilevato da `package.json`:

- Next.js `16.1.6`.
- React `19.2.3`.
- TypeScript `^5`.
- Tailwind CSS `^4`.
- Supabase: `@supabase/ssr ^0.8.0`, `@supabase/supabase-js ^2.95.3`.
- Email: `nodemailer`.
- Editor email/campagne: TipTap.
- Export/documenti: `xlsx`, `jspdf`, `jspdf-autotable`.

Script rilevati:

- `npm run dev`.
- `npm run build`.
- `npm run lint`.
- `npm test`.
- Script operativi Supabase: `supabase:tables`, `supabase:select`, `supabase:insert`, `supabase:update`, `supabase:delete`.

## Struttura utile osservata

Route e aree principali:

- `app/login/page.tsx`.
- `app/auth/callback/page.tsx`.
- `app/api/auth/login/preflight/route.ts`.
- `app/api/auth/login/magic-link/route.ts`.
- `app/dashboard/admin/*`.
- `app/dashboard/manager/*`.
- `app/dashboard/capogruppo/*`.
- `app/dashboard/partecipante/*`.
- `app/dashboard/alloggi/*`.

Librerie principali:

- `lib/supabase/client.ts`.
- `lib/supabase/server.ts`.
- `lib/supabase/service.ts`.
- `lib/auth/roles.ts`.
- `lib/auth/login-access.ts`.
- `lib/i18n/*`.
- `lib/email/*`.
- `lib/admin/*`.
- `lib/capogruppo/*`.
- `lib/alloggi/*`.

SQL storici:

- `supabase/email_templates_migration.sql`.
- `supabase/email_send_logs_migration.sql`.
- `supabase/profili_gruppi_migration.sql`.
- `supabase/login_profiles_guard_migration.sql`.
- `supabase/participants_soft_delete_migration.sql`.
- Diverse migration alloggi/finance/Tally da non importare automaticamente.

## Pattern riusabili

### Supabase client separation

Il modello separa correttamente:

- browser client con anon key in `lib/supabase/client.ts`;
- server client con cookie in `lib/supabase/server.ts`;
- service client solo server in `lib/supabase/service.ts`.

Per `iscrizioni-pace` questo pattern e' da riusare, mantenendo service role fuori dal browser e da flussi utente ordinari.

### Magic link applicativo

Il modello usa un flusso utile:

- normalizza email e ruolo in `lib/auth/login-access.ts`;
- fa preflight access in `app/api/auth/login/preflight/route.ts`;
- genera magic link con service role in `app/api/auth/login/magic-link/route.ts`;
- costruisce callback app con `token_hash`, `type`, `role`;
- invia email tramite provider applicativo;
- `app/auth/callback/page.tsx` consuma `code`, `token_hash` o `token`, gestisce sessione Supabase e redirige per ruolo.

Adattamento richiesto:

- la nuova app parte da email pubblica, non da selezione ruolo;
- se email esiste su iscrizione evento attivo invia magic link;
- se email non esiste avvia registrazione;
- ruoli manager/capogruppo/admin/accoglienza devono avere scope evento/gruppo/funzione;
- il callback deve rispettare locale e dashboard corretta.

### Ruoli applicativi

Il modello definisce ruoli in `lib/auth/roles.ts` e li collega a `profili`. Questo va riusato come concetto, ma non come elenco definitivo:

- il modello ha `alloggi`, che nella nuova app non e' core;
- la nuova app deve aggiungere almeno `manager_viewer` e `accoglienza`;
- i ruoli devono diventare membership con scope, non solo ruolo singolo globale.

### Tabelle manager/admin

`app/dashboard/_components/participants-table.tsx` mostra pattern utili:

- fetch da API configurabile;
- stato client per filtri;
- sort per colonne;
- colonne opzionali;
- edit modal;
- gestione campi array/boolean;
- modal-only mode per deep link o edit mirati.

Da adattare:

- rimuovere alloggio, quote, date arrivo/partenza e dominio residenziale;
- introdurre evento, giorni/momenti, gruppo certo/probabile, status consenso, QR/check-in;
- separare campi sensibili e viste minimizzate.

### Email e log

Il modello contiene pattern utili in `lib/email/*` e `app/api/manager/email-campaign/route.ts`:

- template HTML/testo;
- rendering dati partecipante/capogruppo;
- invio con concorrenza limitata;
- limiti su allegati;
- log invii e destinatari;
- funzioni pure testabili per gestione destinatari.

Da adattare:

- distinguere transazionali, notifiche capogruppo e campagne;
- gestire destinatari delegati per persone senza email;
- evitare log di contenuti sensibili non necessari;
- prevedere preview/test mode prima di invii reali.

### i18n

Il modello usa provider locale TypeScript:

- `lib/i18n/provider.tsx`;
- `lib/i18n/index.ts`;
- `lib/i18n/locales/*.ts`;
- cookie/localStorage per preferenza lingua;
- fallback su lingua default.

Per la nuova app:

- minimo IT/EN;
- evitare testi hardcoded in UI/email;
- testi privacy e legali devono essere revisionati da umano.

### Test

Il modello usa `node --test --experimental-strip-types` per funzioni pure. Pattern utile per:

- normalizzazione email;
- parsing destinatari;
- template email;
- regole gruppo;
- validazioni form;
- QR/check-in idempotente.

## Pattern SQL/RLS da studiare, non copiare

File utili da rileggere nella milestone schema:

- `supabase/profili_gruppi_migration.sql` per relazione profilo-gruppo.
- `supabase/login_profiles_guard_migration.sql` per guardrail su profili.
- `supabase/email_templates_migration.sql` per template con RLS.
- `supabase/email_send_logs_migration.sql` per log invii e destinatari.
- `supabase/accommodation_hardening_migration.sql` solo per esempi di helper RLS e scope gruppo, non per dominio alloggi.

Attenzione:

- le migration del modello sono storiche e legate a un dominio diverso;
- non vanno applicate al nuovo database;
- nella nuova app servono migration progettate da zero, multi-evento e con scope espliciti.

## Cose da non importare automaticamente

- Dominio alloggi: alberghi, stanze, room assignment, preferenza alloggio.
- Finanza evento e quote partecipazione.
- Tally webhook.
- Date, nomi evento, domini, email sender, brand e testi Global Friendship/Youth for Peace.
- Ruolo `alloggi` come ruolo core.
- Migration SQL esistenti senza riprogettazione.
- Logiche che assumono evento singolo o solo membri Sant'Egidio.

## Decisioni operative per prossima milestone

Prima di Milestone 1 serve una decisione Git:

1. inizializzare questa cartella come repo;
2. oppure clonare `https://github.com/giovaniperlapace/iscrizioni-pace` in una nuova working copy.

Se si inizializza questa cartella, aggiungere subito almeno:

- `.gitignore` per Next.js, Node, env, artefatti OS e file locali;
- remote `origin`;
- branch di lavoro secondo la strategia Git corrente del progetto.

Nota successiva: la strategia Git e' stata aggiornata. Il lavoro ordinario avviene su `main`; branch dedicati si creano solo su richiesta esplicita.

File locali da valutare prima del primo commit:

- Tenere: `AGENTS.md`, `PIANO_DI_LAVORO.md`, `Descrizione app descrizione.txt`, `docs/model-app-discovery.md`, `materiali-dati/ComunitaEQuartieri.xlsx` se serve come materiale sorgente.
- Escludere: `.DS_Store`, `.Rhistory`.

## Criteri di done Milestone 0

- Stato Git locale verificato e documentato.
- App modello ispezionata senza modifiche.
- Materiale Excel iniziale inventariato.
- Pattern riusabili e parti da evitare documentati.
- Nessuna feature, installazione, scaffold o migration creata.
