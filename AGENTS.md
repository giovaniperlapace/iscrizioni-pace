# AGENTS.md

Questo file e' la memoria operativa stabile per Codex e per futuri agenti che lavoreranno su questa app. Deve restare aggiornato quando cambiano architettura, workflow, comandi, schema dati, ruoli, policy RLS o decisioni importanti.

Quando lo sviluppo principale sarà concluso, `PIANO_DI_LAVORO.md` potrà essere cancellato. A quel punto questo file dovra' contenere tutto il contesto necessario per implementare funzioni accessorie, correggere bug e fare manutenzione senza dover ricostruire la storia del progetto.

## Stato del progetto

- Nome progetto/repository prevista: `iscrizioni-pace`.
- Repository GitHub prevista: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Cartella locale:
  `/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/codex/iscrizioni-pace`.
- Milestone 1 ha inizializzato questa cartella come repository Git locale.
- Milestone 2 ha aggiunto guardrail di qualità e documentazione operativa.
- Milestone 4 ha aggiunto autenticazione base Supabase, callback auth,
  helper ruoli e protezione dashboard con Next `proxy.ts`.
- Milestone 5 ha aggiunto il flusso pubblico email-prima, iscrizione iniziale,
  invio applicativo di magic link/conferme via Gmail SMTP e QR token opaco.
- Milestone 5.5 ha aggiunto questionario iscrizione versionato, seed evento
  test e bootstrap utenti test per admin/manager/partecipante.
- Milestone 6 ha completato una prima dashboard partecipante self-service con
  riepilogo iscrizione, QR placeholder, area panel/gruppo, modifica controllata
  di contatti, lingua, presenze e supporto, piu' audit delle modifiche.
- Milestone 6.1 ha affinato la dashboard partecipante: gruppo come informazione
  secondaria sotto il nome, schermata rapida focalizzata sui panel e due
  pulsanti con icone per aprire QR code o iscrizione modificabile in overlay.
- Il 2026-06-15 e' stata verificata e corretta la configurazione Vercel
  production: la production branch e' `main`, l'alias stabile e'
  `https://iscrizioni-pace.vercel.app`, e i magic link generati per l'ambiente
  online puntano a quel dominio.
- Branch di lavoro ordinario: `main`.
- Remote `origin` configurato:
  `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Ultimo commit/push noto su `main`: milestone 6, `Implement participant dashboard milestone`.

Prima di ogni feature verificare:

- `pwd`.
- `git status --short`.
- `git branch --show-current`.
- `git remote -v`, quando serve verificare GitHub.

## Milestone 0 - discovery

Discovery repository e app modello completata in:

- `docs/model-app-discovery.md`.

Risultati:

- La cartella iniziale non era una working copy Git.
- Anche la cartella locale `modello_app` non risulta una working copy Git, quindi va usata solo come riferimento read-only.
- Non importare automaticamente codice o migration dall'app modello: riusare solo pattern dopo review.

## Milestone 1 - setup progetto

Setup tecnico iniziale completato in questa cartella.

Stack installato:

- Next.js 16 App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS 4.
- ESLint.
- Supabase: `@supabase/ssr` e `@supabase/supabase-js`.

Comandi disponibili:

- `npm run dev`.
- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

File di setup rilevanti:

- `app/layout.tsx`.
- `app/page.tsx`.
- `app/globals.css`.
- `lib/supabase/client.ts`.
- `lib/supabase/server.ts`.
- `lib/supabase/service.ts`.
- `.env.example`.
- `docs/setup.md`.
- `docs/workflow.md`.

Note:

- `.env.local` resta non tracciato.
- `.env.example` contiene solo placeholder e URL pubblico previsto, senza segreti.
- Non sono state create migration e non e' stato collegato alcun database reale.

## Milestone 2 - qualità e documentazione operativa

Guardrail iniziali completati in questa cartella.

Deliverable:

- Script `test` aggiunto in `package.json`.
- Test runner minimo basato sul runner nativo di Node.
- Smoke test in `tests/smoke.test.mts`.
- Workflow operativo documentato in `docs/workflow.md`.
- README e documentazione setup aggiornati con il comando `npm test`.

Comandi standard da usare prima di chiudere milestone future:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

Note:

- `npm test` esegue `node --test tests/*.test.mts`.
- Il runner e' volutamente leggero: per ora serve per test di funzioni pure e smoke test.
- Non sono state introdotte dipendenze test esterne.
- Non sono state create migration e non e' stato collegato alcun database reale.

## Milestone 3 - schema database iniziale e RLS

Schema iniziale e RLS completati come migration versionata e applicati al Supabase self-hosted Hetzner/Coolify.

Deliverable:

- Migration `supabase/migrations/20260613120000_initial_schema_and_rls.sql`.
- Guida operativa `docs/supabase-workflow.md`.

Schema iniziale creato:

- Eventi e programma: `events`, `event_locations`, `event_moments`.
- Profili e ruoli: `profiles`, `event_user_roles`.
- Liste territoriali: `countries`, `cities`.
- Gruppi e capigruppo: `groups`, `group_memberships`.
- Persone e iscrizioni: `participants`, `registrations`, `participant_contacts`, `participant_consents`.
- Dati sensibili di accessibilità: `accessibility_needs`.
- Assegnazioni e presenze: `participant_group_assignments`, `event_attendance_choices`, `moment_attendance_choices`.
- QR e accoglienza: `qr_tokens`, `check_ins`.
- Audit: `audit_logs`.

Decisioni RLS iniziali:

- I cataloghi necessari al form pubblico (`events` pubblicati, luoghi/momenti pubblici, paesi/città attivi, gruppi attivi) sono leggibili senza esporre dati personali.
- I dati personali sono leggibili solo da proprietario, manager/admin in scope evento o capogruppo in scope gruppo.
- I dati di accessibilità restano più stretti: proprietario e manager/admin, non accoglienza diretta.
- Accoglienza può operare su QR/check-in in scope evento, ma non leggere contatti o dati sensibili completi.
- `manager_viewer` legge dati operativi in scope ma non gestisce registrazioni.
- `admin` e' ruolo globale con `event_id` nullo in `event_user_roles`; gli altri ruoli hanno sempre scope evento.
- Le funzioni helper RLS vivono nello schema `app` e sono `security definer`.

Applicazione su Hetzner/Coolify:

- Server: `91.99.81.31`, accesso SSH riuscito come `root` con chiave locale `~/.ssh/id_ed25519_hetzner_20260613`.
- Progetto Coolify: `iscrizioni_pace_cool`.
- Servizio Coolify: `supabase-ammnuajlmd83t94cfy3us6cw`.
- Network Docker Supabase: `ammnuajlmd83t94cfy3us6cw`.
- Container database: `supabase-db-ammnuajlmd83t94cfy3us6cw`.
- La Supabase CLI `2.106.0` e' stata installata sul server in `/usr/local/bin/supabase`.
- La CLI raggiunge il DB interno ma fallisce con TLS verso Postgres self-hosted; la migration e' stata applicata con `psql` dentro il container database.
- La versione e' registrata in `supabase_migrations.schema_migrations` come `20260613120000:initial_schema_and_rls`.

Procedura rapida per migration future su questo Supabase self-hosted:

- Creare una nuova migration versionata in `supabase/migrations/<timestamp>_<nome>.sql`.
- Verificare staticamente il diff SQL e non inserire segreti o dati personali.
- Applicare la migration con:

```bash
./scripts/apply-remote-migration.sh supabase/migrations/<timestamp>_<nome>.sql
```

- Lo script usa `.env.local` se presente, altrimenti i default operativi già noti: SSH `root@91.99.81.31`, chiave `~/.ssh/id_ed25519_hetzner_20260613`, container `supabase-db-ammnuajlmd83t94cfy3us6cw`.
- Lo script copia il file SQL sul server, lo applica con `psql` dentro il container DB, registra la versione in `supabase_migrations.schema_migrations` e invia `notify pgrst, 'reload schema'`.
- Non usare `supabase db push` su questo ambiente finché la connessione CLI verso il Postgres interno continua a fallire con TLS.

Verifiche eseguite dopo applicazione:

- 20 tabelle pubbliche attese create.
- 20 tabelle pubbliche con RLS attivo.
- 45 policy RLS presenti.
- 13 funzioni nello schema `app`.
- `notify pgrst, 'reload schema'` eseguito.
- REST API verificata con anon key su `events` e `countries`, risposta `200` con array vuoto.

Note:

- `lib/database.types.ts` non e' stato ancora generato; farlo in una milestone dedicata con accesso DB stabilizzato.
- La verifica RLS con utenti reali per ruolo resta da fare: partecipante, capogruppo, manager, manager_viewer, admin e accoglienza.
- `.env.local` e' stato creato localmente in questo progetto con URL/chiavi Supabase e dettagli SSH, resta non tracciato.

## Milestone 4 - Supabase client/server e autenticazione base

Autenticazione base completata in app, senza ancora implementare il form pubblico email-prima o l'invio applicativo dei magic link.

Deliverable:

- Client Supabase browser/server/service confermati in `lib/supabase/*`.
- Callback auth server-side in `app/auth/callback/route.ts`.
- Helper ruoli e redirect in `lib/auth/roles.ts` e `lib/auth/session.ts`.
- Protezione dashboard in `proxy.ts`.
- Pagina `app/login/page.tsx` per errori/redirect di sessione.
- Dashboard placeholder protette in `app/dashboard/*`.
- Test di funzioni pure in `tests/auth-roles.test.mts`.

Decisioni:

- In Next.js 16.2.9 usare `proxy.ts` per la protezione route; `middleware.ts` e' deprecato.
- `manager_viewer` condivide per ora la route `/dashboard/manager`; la UI applichera' permessi read-only nelle milestone dashboard.
- `partecipante` non e' nell'enum database `app_role`: e' una destinazione applicativa di default per utenti autenticati/proprietari di iscrizioni.
- Il callback supporta `code`, `token_hash` e `token` con tipi OTP Supabase noti.
- Al callback viene fatto `upsert` del profilo applicativo in `profiles` usando la sessione utente e RLS ordinaria, non service role.
- Il cookie `iscrizioni_requested_role` può ricordare una dashboard richiesta per utenti con più ruoli.
- La protezione dashboard legge `event_user_roles` via client server con anon key e RLS; non usa service role nei flussi utente ordinari.

Note operative:

- I callback URL Supabase devono includere `/auth/callback` sugli ambienti autorizzati, per esempio `http://localhost:3000/auth/callback` in locale.
- La login page e' provvisoria: Milestone 5 realizzera' home email-prima, preflight email esistente, magic link e form iscrizione.
- `npm test` importa helper TypeScript reali dai test `.mts`; `tsconfig.json` abilita `allowImportingTsExtensions` per questo uso con `noEmit`.

## Milestone 5 - flusso pubblico email-prima e iscrizione iniziale

Flusso pubblico iniziale completato in app.

Deliverable:

- Home `app/page.tsx` con email-prima.
- Pagina `app/registrazione/page.tsx` per nuova iscrizione iniziale.
- Conferma `app/registrazione/conferma/page.tsx`.
- Server actions in `app/actions.ts`.
- Use case pubblico in `lib/registrations/public-flow.ts`.
- Validazione form in `lib/registrations/validation.ts`.
- Invio email SMTP in `lib/email/*`.
- QR token opaco e hash in `lib/qrcode/token.ts`.
- Rate limit base in memoria in `lib/security/rate-limit.ts`.
- Test di funzioni pure in `tests/registration-flow.test.mts`.

Decisioni:

- I magic link sono generati con `supabase.auth.admin.generateLink` e inviati
  dall'app via SMTP Gmail, non dal mailer interno Supabase.
- L'account mittente configurato e' `registrationspeace@gmail.com`.
- La password app resta solo in `.env.local` o nelle env del runtime; non
  deve essere stampata o committata.
- Variabili email supportate:
  `EMAIL_FROM`, `EMAIL_USER`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`; `GMAIL_APP_PASSWORD` resta alias locale supportato.
- Dopo callback magic link, i partecipanti con contatto email corrispondente
  vengono collegati a `auth.users.id` tramite service role server-side.
- Il QR code conserva in database solo `token_hash`; il token in chiaro non va
  salvato.
- Il rate limit e' volutamente basico e in memoria; per produzione serverless
  andrà sostituito o affiancato da storage condiviso.

Note operative:

- `.env.local` contiene gli alias email necessari per lo sviluppo locale.
- Il repository non risulta ancora collegato a Vercel tramite `.vercel/project.json`;
  quando verrà collegato, sincronizzare almeno `EMAIL_FROM`, `EMAIL_USER`,
  `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `APP_URL` e
  `NEXT_PUBLIC_APP_URL`.
- Supabase non necessita della password Gmail per questo flusso finché i
  magic link sono inviati dall'app.
- Il form usa liste pubbliche da `countries`, `cities`, `groups` e l'evento
  pubblicato corrente; se il database non contiene un evento `published`, la
  home mostra iscrizioni non aperte.
- I giorni di presenza mostrati nel form di iscrizione derivano da
  `events.starts_on` e `events.ends_on`, non da valori hardcoded nel componente.

## Milestone 5.5 - questionario iscrizione e utenti test

Questionario reale iniziale e bootstrap end-to-end completati in app.

Deliverable:

- Inventario versionato in `lib/questionnaire/registration.ts`.
- Documentazione in `docs/registration-questionnaire.md`.
- Migration `supabase/migrations/20260614100000_registration_questionnaire_and_test_seed.sql`.
- Tabella `registration_questionnaire_answers` per snapshot versionato di
  risposte/configurazione questionario.
- Form pubblico aggiornato con primo questionario essenziale e condizionale:
  nome, cognome, data nascita, luogo di nascita libero (paese e città),
  nazionalità cercabile da elenco mondiale, paese europeo geografico e città
  di residenza abituale, telefono opzionale, accessibilità, partecipazione
  precedente Sant'Egidio, eventuale gruppo, giorni di presenza previsti e privacy.
- Codice partecipante breve automatico in `participants.public_code`, formato
  alfanumerico maiuscolo a 4 caratteri, univoco e generato dal database.
- Salvataggio scelte momento in `moment_attendance_choices`.
- Dashboard iniziali admin, manager e partecipante con dati minimi per
  verificare login, ruolo, evento assegnato e visibilità RLS.
- Script `scripts/bootstrap-test-users.mjs`.

Decisioni:

- Non e' stato introdotto un builder questionario general-purpose.
- I dati stabili restano nello schema relazionale esistente: `participants`,
  `participant_contacts`, `participant_consents`, `accessibility_needs`,
  `event_attendance_choices`, `moment_attendance_choices` e
  `participant_group_assignments`.
- Lingua preferita, momenti del programma e partecipazione prevista non sono
  richiesti nella prima iscrizione; restano supportati per passaggi successivi.
- La lista paesi del primo form usa nazioni dell'Europa geografica, non solo
  politica, includendo paesi transcontinentali come Russia e Turchia.
- `registration_questionnaire_answers` conserva solo uno snapshot versionato
  delle risposte/configurazione per audit e manutenzione futura.
- Le domande Washington Group e le note di supporto restano dati sensibili:
  visibili a partecipante, manager e admin, non all'accoglienza diretta.
- Nel testo visibile all'utente non va citato il Washington Group o la
  classificazione tecnica delle aree funzionali; la documentazione può restare
  tecnica, ma la UI deve usare formulazioni semplici e inclusive.
- L'evento test versionato e' `assisi-2026-test`; i dati creati dalla migration
  sono distinguibili dai dati reali.
- `participants.public_code` e' un identificativo secondario semplice per email
  e funzioni operative. Non sostituisce `participants.id` UUID come chiave
  tecnica e non deve essere usato come segreto, token di accesso o prova di
  identità.

Comandi aggiunti:

- `npm run bootstrap:test-users`.

Uso bootstrap utenti test:

```bash
TEST_ADMIN_EMAIL=admin-test@example.org \
TEST_MANAGER_EMAIL=manager-test@example.org \
TEST_PARTICIPANT_EMAIL=partecipante-test@example.org \
npm run bootstrap:test-users
```

Lo script richiede `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` nell'ambiente. Non stampare mai la service role.

## Vercel production e magic link

Configurazione verificata il 2026-06-15:

- Progetto Vercel: `iscrizioni-pace`.
- Project ID: `prj_4n4oKj3S4sg5RUg5H6AsJLBAK7w6`.
- Team/org ID: `team_ZzsE0ydPpm1T9muAU1xi2uCN`.
- Production branch: `main`.
- Dominio production stabile: `https://iscrizioni-pace.vercel.app`.
- Alias production aggiuntivi:
  `https://iscrizioni-pace-giovaniperlapaces-projects.vercel.app` e
  `https://iscrizioni-pace-giovaniperlapace-giovaniperlapaces-projects.vercel.app`.
- Ultimo deployment production verificato: `dpl_88vmZqKD4owNWxPgnzJnoueYYmsW`.

Variabili Vercel production richieste:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_URL`.
- `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_APP_URL=https://iscrizioni-pace.vercel.app`.
- `APP_URL=https://iscrizioni-pace.vercel.app`.
- `PUBLIC_SITE_URL=https://iscrizioni-pace.vercel.app`.
- `EMAIL_FROM`.
- `EMAIL_USER`.
- `EMAIL_PASSWORD`.
- `SMTP_HOST`.
- `SMTP_PORT`.
- `SMTP_SECURE`.
- `EMAIL_DELIVERY_MODE=smtp`.

Note operative Vercel:

- Le variabili pubbliche e non segrete (`NEXT_PUBLIC_*`, URL app, host/porta
  SMTP e flag booleani) possono essere create con `--no-sensitive` per essere
  verificabili con `vercel env pull`.
- Le variabili segrete (`SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PASSWORD` e simili)
  devono restare sensitive/encrypted; Vercel le mostra vuote quando vengono
  lette via CLI/API, ed e' normale.
- Dopo la modifica di qualunque `NEXT_PUBLIC_*` serve un nuovo deploy
  production, perché Next le incorpora nel build.
- I push su `main` devono produrre deployment production; se tornano preview,
  controllare che non ci siano env `Preview (main)` e che la production branch
  sia ancora `main`.

Supabase Auth e redirect:

- `API_EXTERNAL_URL` di GoTrue deve essere
  `https://iscrizioni-supabase.stefano-orlando.it`.
- `GOTRUE_URI_ALLOW_LIST` deve includere almeno:
  `http://localhost:3000/**`, `https://iscrizioni-pace.vercel.app/**` e gli
  alias production Vercel.
- La verifica del 2026-06-15 ha generato un magic link di prova senza stampare
  token: l'action host era `iscrizioni-supabase.stefano-orlando.it`, il
  `redirect_to` puntava a `https://iscrizioni-pace.vercel.app/auth/callback`
  e il redirect applicativo era `/dashboard/partecipante`.
- L'invio reale delle email dipende da una password app Gmail valida nelle
  variabili SMTP; il dominio del link e' stato verificato separatamente
  dall'arrivo effettivo in inbox.

## Milestone 6 - dashboard partecipante

Dashboard partecipante iniziale completata in app.

Deliverable:

- Pagina `app/dashboard/partecipante/page.tsx` sostituita con dashboard
  utilizzabile.
- Server action `updateParticipantDashboard` in `app/actions.ts`.
- Helper testabili in `lib/registrations/participant-dashboard.ts`.
- Test di parsing, finestra modifica e audit diff in
  `tests/registration-flow.test.mts`.

Funzioni disponibili:

- Riepilogo iscrizione con frase introduttiva su evento/date, gruppo in card
  separata vicino ai panel, QR placeholder e accessibilita' sintetica.
- Codice partecipante `participants.public_code` visibile in dashboard come
  identificativo operativo semplice dentro l'area QR con etichetta "Il tuo
  codice"; non va duplicato nell'header.
- Modifica controllata di telefono, lingua preferita, giorni di presenza,
  richiesta di supporto e note pratiche.
- Le modifiche sono consentite solo se la registrazione non e' `cancelled` e
  se `events.registration_closes_at` non e' superato.
- La dashboard filtra sempre le iscrizioni sul `participants.auth_user_id`
  della sessione corrente, oltre alle RLS del database.
- Le modifiche vengono registrate in `audit_logs` con action
  `participant.dashboard_updated` e solo elenco dei campi cambiati, senza
  duplicare contenuti sensibili.

Decisioni:

- Il QR token resta opaco: in dashboard non viene mostrato ne' ricostruito il
  token in chiaro, perche' in database esiste solo `token_hash`.
- La dashboard mostra stato QR/accesso evento e codice partecipante, ma una
  futura rigenerazione/scaricamento QR richiedera' flusso dedicato con token
  nuovo, revocabile e consegnato in modo controllato.
- Per leggere lo stato QR e scrivere audit server-side si usa service role solo
  dopo aver verificato la proprieta' della registrazione con sessione utente.
- L'accessibilita' viene riepilogata senza mostrare tassonomie tecniche nella
  UI; il partecipante puo' comunque vedere/modificare le proprie note operative.
- I momenti del programma/panel non vanno raccolti nel form pubblico di
  iscrizione e non sono un campo del riepilogo modificabile. Vanno trattati
  come esperienza separata della dashboard: al momento si mostra "Panel a cui
  sei iscritto"; quando i panel saranno disponibili, usare le tabelle esistenti
  `event_moments` e `moment_attendance_choices` per iscrizione/tracciamento,
  introducendo una migration solo se serviranno nuovi attributi specifici dei
  panel.
- Il blocco privacy/dati sensibili non viene mostrato nella dashboard
  partecipante ordinaria: consenso e bisogni di accessibilita' restano salvati
  e auditabili, ma non duplicati in una card separata se gia' riepilogati.
- L'area iniziale non deve usare metriche ridondanti come stato iscrizione o
  accesso evento: quei dati sono impliciti o gia' presenti altrove. In alto
  vanno privilegiati panel e gruppo, cioe' informazioni operative future.

## Milestone 6.1 - affinamento dashboard partecipante

Affinamento completato il 2026-06-15.

Deliverable:

- Header dashboard aggiornato con il gruppo come informazione secondaria sotto
  il nome del partecipante. Il gruppo e il referente sono mostrati come due
  informazioni separate; lo stato interno dell'assegnazione gruppo non viene
  mostrato al partecipante.
- La riga evento sotto il nome include titolo, città, paese e date in forma
  naturale, per esempio `dal 25 ottobre 2026 al 27 ottobre 2026`.
- Prima schermata alleggerita: mostra azioni principali e area "Panel a cui sei
  iscritto", senza riepilogo iscrizione o QR code gia' aperti.
- Due pulsanti/link principali, centrati e simmetrici, aprono overlay dedicati:
  `/dashboard/partecipante?overlay=qr` e
  `/dashboard/partecipante?overlay=iscrizione`.
- I pulsanti hanno icone stilizzate: QR code per l'accesso e pagina/form per
  iscrizione e modifica dati.
- L'overlay QR mostra placeholder QR, stato QR e codice partecipante.
- L'overlay iscrizione mostra riepilogo e modifiche controllate gia' previste da
  Milestone 6.

Decisioni:

- Non sono stati introdotti tab; la separazione usa overlay URL-based con query
  `overlay`, cosi' il server component resta semplice e condivisibile.
- Le sezioni QR e iscrizione non sono piu' visibili nella schermata rapida, ma
  si aprono sopra la dashboard e si chiudono con il simbolo in alto a destra.
- Gli overlay sono centrati nel viewport, con scroll interno se il contenuto e'
  piu' lungo dello spazio disponibile.
- Il gruppo non vive piu' in una card autonoma nella dashboard iniziale:
  rimane un dato operativo secondario accanto all'identita' del partecipante.
- La UI partecipante non mostra lo stato `probable/confirmed/rejected`
  dell'assegnazione gruppo nella riga iniziale, perché e' soprattutto
  informazione operativa interna.
- L'helper del range date contiene un TODO i18n per tradurre in futuro
  `dal/al` in `from/to` o equivalenti.
- I panel restano il contenuto principale della schermata rapida in attesa di
  funzioni future di iscrizione/scelta momenti.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Dev server locale avviato e dashboard verificata nel browser integrato su
  `http://localhost:3000/dashboard/partecipante` con utente test autenticato.
- Verificato che non compaiano piu' card privacy, check-in, metriche
  ridondanti e duplicazione del codice partecipante in header.
- Verificati nel browser integrato gli overlay `?overlay=qr` e
  `?overlay=iscrizione`.
- Verificati pulsanti simmetrici con icone su desktop e viewport mobile 390px.
- Verificato che gli overlay siano centrati su desktop e mobile.
- Verificate righe evento e gruppo su desktop/mobile senza overflow
  orizzontale.

## Stack previsto

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Supabase.
- Database Supabase self-hosted su VM Hetzner gestita con Coolify.
- Supabase URL previsto: `https://iscrizioni-supabase.stefano-orlando.it`.
- Coolify previsto: `https://supabase-iscrizioni.stefano-orlando.it`.

Non assumere che chiavi, token, project ref o credenziali siano disponibili. Se servono, chiederli esplicitamente.

## Prodotto

L'app gestisce iscrizioni a eventi internazionali annuali della Comunità di Sant'Egidio in città diverse. Deve essere multi-evento e multi-anno, per esempio Assisi 2026 o Roma 2025.

Il prodotto deve coprire:

- Iscrizione pubblica tramite email.
- Accesso a iscrizione esistente tramite magic link Supabase.
- Dashboard partecipante.
- Gruppi e capigruppo.
- Inserimento di partecipanti senza email tramite referente/capogruppo.
- Dashboard manager/admin con tabelle, filtri, statistiche ed export.
- Programma evento e scelta dei momenti.
- Email transazionali e campagne personalizzate.
- QR code e check-in accoglienza.
- Settori/sedute e informazioni operative.
- Multilingua almeno italiano e inglese.
- Audit log, privacy, minimizzazione dati e retention post-evento.

Questa app non deve partire dall'assunto che l'evento sia residenziale.

## Ruoli applicativi

Ruoli minimi da supportare:

- `partecipante`: accede alla propria dashboard, modifica la propria iscrizione quando consentito, consulta QR code, programma e scelte.
- `capogruppo`: utente reale dell'app; vede solo i partecipanti dei propri gruppi; conferma appartenenza/esternalita'; inserisce persone senza email; riceve notifiche.
- `admin`: gestisce eventi, configurazioni, utenti, ruoli e impostazioni globali.
- `manager`: collegato a uno specifico evento; vede tutti i partecipanti e gruppi dell'evento; può modificare dati operativi secondo permessi.
- `manager_viewer`: vede ciò che vede il manager ma non modifica iscrizioni.
- `accoglienza`: scansiona QR code e verifica iscrizioni/check-in vedendo solo dati minimi necessari.

I ruoli devono vivere in profili o membership applicative, non solo nei metadata Supabase Auth. Dove serve, il ruolo deve essere scoperto da uno scope: evento, gruppo, funzione di accoglienza.

## Workflow pubblico

La home parte dall'email:

- Se l'email corrisponde a una persona già iscritta, l'app invia un magic link Supabase.
- Se l'email non e' ancora registrata, viene avviato il form di iscrizione.
- Alla creazione della registrazione vengono salvati dati essenziali, consensi, gruppo certo/probabile, QR token e log.
- Viene inviata una email di conferma con dati inseriti e link di accesso.

Il form iniziale deve raccogliere almeno:

- Nome, cognome, data di nascita.
- Paese da lista preimpostata con opzione altro.
- Città filtrata per paese con opzione altro.
- Disabilità o bisogni di accessibilità con domande basate sul Washington Group.
- Partecipazione precedente a eventi/iniziative Sant'Egidio.
- Partecipazione con gruppo Sant'Egidio o come singolo.
- Se gruppo: selezione da elenco gruppi cercabile per nome gruppo e capogruppo.
- Giorni/momenti previsti di partecipazione, con opzione "non lo so ancora".
- Accettazione privacy e consenso al trattamento dati.
- Versione consenso, data/ora, e quanto serve per tracciabilità legale.

## Dati sensibili e privacy

Privacy e sicurezza sono architettura, non dettagli finali.

Trattare con attenzione:

- Dati di disabilità e accessibilità.
- Data di nascita ed età.
- Email, telefono e contatti referenti.
- Appartenenza a gruppi o coinvolgimento nella Comunità di Sant'Egidio.
- Presenza a eventi/momenti.
- Check-in e luoghi.
- Minori o giovani partecipanti, se presenti.

Principi:

- Raccogliere solo dati necessari.
- Separare o proteggere fortemente i dati sensibili.
- Mostrare all'accoglienza solo dati minimi operativi.
- Non inserire dati personali nel QR code: usare token opaco, revocabile e non indovinabile.
- Loggare azioni sensibili senza duplicare contenuti sensibili non necessari.
- Prevedere retention, anonimizzazione o cancellazione post-evento.

## Guardrail operativi

Prima di ogni blocco:

- Verificare `pwd`.
- Verificare `git status --short`.
- Verificare branch corrente con `git branch --show-current` quando la repo Git esiste.
- Se la working tree e' sporca, capire se le modifiche sono pertinenti. Non sovrascrivere lavoro non compreso.
- Leggere i file rilevanti prima di modificare.

Durante il lavoro:

- Fare diff piccoli e verificabili.
- Seguire pattern esistenti del repository.
- Non introdurre astrazioni non necessarie.
- Non installare dipendenze senza motivo chiaro e senza verificare lo stack esistente.
- Non fare commit o push senza richiesta esplicita.
- Non usare comandi distruttivi come `git reset --hard` o checkout di file modificati senza richiesta esplicita.
- Non committare segreti, chiavi, password, token o dump con dati personali.

Prima di concludere:

- Eseguire i comandi disponibili e pertinenti: lint, typecheck, test, build.
- Verificare `git diff`.
- Dire cosa e' stato cambiato, cosa e' stato verificato, cosa non e' stato possibile verificare.

## Strategia Git

- Lavorare normalmente su `main`.
- Le prove si fanno in locale; quando tutto funziona e l'utente chiede commit/push, fare commit e push direttamente su `main`.
- Non creare branch staging/produzione o branch milestone salvo richiesta esplicita.
- Preparare diff leggibili per review umana.
- Non fare commit/push senza richiesta.
- Se compaiono modifiche non fatte da Codex, trattarle come lavoro dell'utente.

Remote configurato:

```bash
git remote -v
```

## Supabase e Coolify

Supabase sarà usato nelle milestone implementative, non durante la sola pianificazione.

Accessi da chiedere se mancanti:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_URL`.
- `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase project ref o dettagli self-hosted equivalenti.
- Token Supabase CLI/Management API, se necessario.
- Credenziali/API token Coolify.
- Provider email e relative credenziali/API key.
- URL pubblici e callback URL autorizzati.

Regole:

- Usare anon key nel browser.
- Usare server client con cookie per sessione utente.
- Usare service role solo lato server o strumenti operativi.
- Non bypassare RLS nei flussi utente ordinari.
- Le migration devono essere versionate in repository.
- Evitare drift tra database reale e migration.
- Testare RLS con ruoli diversi, non solo con service role.

## Architettura attesa

Struttura probabile:

- `app/[locale]/page.tsx` o equivalente per UI pubblica multilingua.
- `app/[locale]/registrazione/*` per nuova iscrizione.
- `app/[locale]/dashboard/partecipante/*`.
- `app/[locale]/dashboard/capogruppo/*`.
- `app/[locale]/dashboard/manager/*`.
- `app/[locale]/dashboard/admin/*`.
- `app/[locale]/dashboard/accoglienza/*`.
- `app/auth/callback` per magic link.
- `proxy.ts` per protezione route dashboard e aggiornamento sessione Supabase.
- `app/api/*` solo per endpoint necessari.
- `components/*` per componenti riusabili.
- `lib/supabase/*` per client browser/server/service.
- `lib/auth/*` per ruoli, access checks e redirect.
- `lib/events/*` per eventi, configurazioni e programma.
- `lib/registrations/*` per iscrizioni, validazione e normalizzazione.
- `lib/groups/*` per gruppi e assegnazioni.
- `lib/email/*` per template, provider, invio e log.
- `lib/qrcode/*` per QR token e verifica.
- `lib/check-in/*` per scansione e check-in.
- `lib/i18n/*` per traduzioni.
- `lib/audit/*` per log applicativi.

Usare API routes o server actions secondo il pattern che emergera' dal progetto. Per operazioni con service role, preferire codice server chiaro, testabile e con controlli di autorizzazione espliciti.

## Modello dati iniziale atteso

Entità probabili:

- `events`.
- `event_locations`.
- `event_moments`.
- `profiles`.
- `event_user_roles` o equivalente.
- `groups`.
- `group_memberships`.
- `registrations`.
- `participants` o anagrafica separata da iscrizione.
- `participant_contacts`.
- `participant_consents`.
- `accessibility_needs`.
- `group_assignment_rules`.
- `participant_group_assignments`.
- `event_attendance_choices`.
- `moment_attendance_choices`.
- `qr_tokens`.
- `check_ins`.
- `communications`.
- `communication_recipients`.
- `email_templates`.
- `email_send_logs`.
- `email_send_log_recipients`.
- `seating_sectors`.
- `seat_assignments`.
- `audit_logs`.
- `countries`.
- `cities`.

Non creare migration senza una milestone dedicata e un diff SQL revisionabile.

## App modello

App modello locale:

`/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/modello_app`

Usarla come riferimento, non come sorgente da copiare automaticamente.

Pattern utili osservati:

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4.
- Dashboard separate per `admin`, `manager`, `capogruppo`, `partecipante`, `alloggi`.
- Magic link Supabase gestito dall'app con preflight, callback e invio email applicativo.
- Separazione Supabase browser/server/service client.
- Ruoli applicativi in tabella profili.
- Componenti tabellari con filtri, sort, edit modal e colonne opzionali.
- i18n via provider e file locale TypeScript.
- Email templates, campagne, log invii e log destinatari.
- Soft delete partecipanti.
- Documentazione operativa in `AGENTS.md`.
- Guida operativa Supabase in `docs/supabase-workflow.md`.

Codice eventualmente adattabile dopo review:

- Login magic-link e callback.
- Helper ruoli e access check.
- Pattern tabella partecipanti.
- Pattern dashboard manager/admin/capogruppo.
- Pattern email templates/log.
- Pattern i18n.
- Test di funzioni pure.

Non importare automaticamente:

- Logiche alloggi/residenziali: alberghi, stanze, quote, room assignment.
- Tally webhook.
- Finanza evento.
- Date, domini, nomi, email sender e configurazioni specifiche della app modello.
- Migration SQL della app modello senza riprogettazione per questa app.

## Multilingua

Lingue minime:

- Italiano.
- Inglese.

Regole:

- Evitare testi UI hardcoded quando la struttura i18n esiste.
- Aggiornare almeno IT/EN per ogni nuova UI o email.
- Non tradurre automaticamente testi legali definitivi senza revisione umana.
- Salvare preferenza lingua dove serve, per profilo o iscrizione.

## Email

Email previste:

- Conferma iscrizione.
- Magic link.
- Notifica a capogruppo per nuova associazione.
- Comunicazioni per persone senza email inviate al referente.
- Campagne manager/admin filtrate.

Regole:

- Separare template, rendering e invio.
- Loggare invii e destinatari.
- Evitare invii reali massivi in sviluppo.
- Prevedere modalità test/preview.
- Non salvare password/API key in repository.

## QR code e check-in

Regole:

- QR code = token opaco, non dati personali.
- Token revocabile e rigenerabile.
- Check-in idempotente.
- Check-in associabile a evento generale e/o momento specifico.
- Accoglienza vede solo: identità minima, stato iscrizione, eventuale settore/seduta/percorso, alert operativi strettamente necessari.
- Ogni scansione/check-in deve essere auditabile.

## Test e verifica

Quando gli script sono configurati, usare:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

Per funzioni critiche aggiungere test su:

- Normalizzazione email, paesi/città e gruppi.
- Assegnazione gruppo certa/probabile.
- Ruoli e scope evento/gruppo.
- Validazione form iscrizione.
- Rendering template email.
- QR token e check-in.
- RLS, dove testabile.

Per frontend significativo:

- Avviare dev server.
- Verificare nel browser locale.
- Controllare responsive desktop/mobile.
- Verificare che testi non si sovrappongano e che flussi principali siano usabili.

## Documentazione da mantenere

Aggiornare questo file quando:

- Cambiano comandi di setup/test/build.
- Cambiano variabili ambiente richieste.
- Cambia struttura cartelle.
- Cambiano ruoli o permessi.
- Cambia schema database o policy RLS.
- Cambiano flussi auth, registrazione, email, QR/check-in.
- Si prendono decisioni architetturali rilevanti.

Usare documenti aggiuntivi quando il dettaglio diventa troppo lungo:

- `docs/supabase-workflow.md`.
- `docs/decisioni.md`.
- `docs/privacy-retention.md`.
- `docs/deploy.md`.
- `docs/model-app-discovery.md`.
- `docs/setup.md`.

## Uso di PIANO_DI_LAVORO.md

Finché esiste, `PIANO_DI_LAVORO.md` guida le milestone principali. Prima di iniziare una milestone, leggere la sezione corrispondente.

Quando il piano verrà cancellato:

- Non ricrearlo automaticamente.
- Usare questo `AGENTS.md` come fonte primaria.
- Per bugfix e funzioni accessorie, leggere il codice reale e aggiornare questo file se emerge una nuova regola operativa.
