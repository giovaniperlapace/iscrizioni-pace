# AGENTS.md

Questo file e' la memoria operativa stabile per Codex e per futuri agenti che lavoreranno su questa app. Deve restare aggiornato quando cambiano architettura, workflow, comandi, schema dati, ruoli, policy RLS o decisioni importanti.

Quando lo sviluppo principale sarà concluso, `PIANO_DI_LAVORO.md` potrà essere cancellato. A quel punto questo file dovra' contenere tutto il contesto necessario per implementare funzioni accessorie, correggere bug e fare manutenzione senza dover ricostruire la storia del progetto.

## Stato del progetto

- Nome progetto/repository: `iscrizioni-pace`.
- Repository GitHub: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Cartella locale:
  `/Users/stefanolaptop/Documents/codex_new/iscrizioni-pace`.
- Milestone 1 ha inizializzato questa cartella come repository Git locale.
- Milestone 2 ha aggiunto guardrail di qualità e documentazione operativa.
- Milestone 4 ha aggiunto autenticazione base Supabase, callback auth,
  helper ruoli e protezione dashboard con Next `proxy.ts`.
- Milestone 5 ha aggiunto il flusso pubblico email-prima, iscrizione iniziale,
  invio applicativo di magic link/conferme via Gmail SMTP e QR token opaco.
- Milestone 5.5 ha aggiunto questionario iscrizione versionato, seed evento
  test e bootstrap utenti test per admin/manager/partecipante.
- Milestone 6 ha completato una prima dashboard partecipante self-service con
  riepilogo iscrizione, area panel/gruppo, modifica controllata di contatti,
  lingua, presenze e supporto, piu' audit delle modifiche. Il QR era inizialmente
  placeholder ed e' stato poi sostituito dal QR reale anticipato il 2026-06-15.
- Milestone 6.1 ha affinato la dashboard partecipante: gruppo come informazione
  secondaria sotto il nome, schermata rapida focalizzata sui panel e due
  pulsanti con icone per aprire QR code o iscrizione modificabile in overlay.
- Milestone 6.3 ha aggiunto albero gruppi, nodi territoriali per nuovi
  partecipanti, matching referente/gruppo per paese, città ed età, e opzione
  pubblica "Non trovo il mio referente"; durante il test locale sono stati
  aggiunti anche conservazione dati form dopo errore e CTA di primo accesso
  dalla conferma iscrizione.
- Milestone 7 ha iniziato la preparazione all'apertura pubblica: checklist
  operativa, guardrail Vercel/env, comando `opening:verify`, riconoscimento del
  ruolo capogruppo da `group_memberships` e primo accesso all'area personale
  dalle dashboard operative. Dal 2026-06-16 questo accesso e' diventato la tab
  condivisa `Iscrizione e QR personale`.
- Milestone 8 ha aggiunto apertura controllata e monitoraggio iniziale dalla
  dashboard admin: comandi auditati per aprire/pausare/nascondere evento,
  conteggi minimi iscrizioni/anomalie, logging audit degli errori email e log
  operativo in `docs/opening-monitoring-log.md`.
- Milestone 9 ha aggiunto dashboard capogruppo minima: elenco assegnazioni in
  scope albero gruppi, filtri operativi, conferma/rifiuto con risalita al padre,
  note interne, lettura notifica e audit delle decisioni senza email al
  partecipante.
- Milestone 9.1 ha aggiunto link riservati per gruppi nascosti ma iscrivibili:
  `groups.public_label`, tabella `group_registration_links`, generazione/revoca
  da dashboard manager e capogruppo in scope, token opachi e form pubblico
  precompilato tramite `?groupLink=...`.
- Milestone 10 ha aggiunto gestione partecipanti da dashboard capogruppo:
  tabella operativa dei partecipanti del gruppo, inserimento manuale in overlay,
  link riservati in overlay, source `capogruppo`, QR reale, consenso dichiarato
  dal referente, assegnazione gruppo confermata e audit dedicato.
- Milestone 11 ha consolidato le dashboard manager/admin essenziali: tabella
  iscritti filtrabile per ricerca, evento, stato gruppo, ruolo operativo e
  stato iscrizione, conteggi sul risultato filtrato, modifica gruppo/ruolo gia'
  presente in overlay e consultazione read-only coerente per `manager_viewer`.
  Le tabelle operative caricano fino a 200 iscrizioni recenti e includono anche
  le iscrizioni annullate quando filtrate.
- Dopo revisione della Milestone 11, la gestione gruppi admin/manager e' stata
  spostata su una tabella gruppi filtrabile con azioni per riga. La creazione e
  modifica gruppi si apre in overlay; la generazione/revoca dei link riservati
  si apre dall'azione `Gestisci link` del singolo gruppo. Non mostrare in
  dashboard un form di generazione link per ogni gruppo contemporaneamente.
- Le statistiche generiche sopra la tabella iscritti admin/manager sono state
  rimosse per ridurre rumore visivo. Inventario delle statistiche disponibili:
  `docs/statistiche-disponibili.md`.
- Il 2026-06-17 la roadmap futura e' stata rinumerata dalla prossima milestone
  in poi: Milestone 12 e' revisione guidata UX, navigazione e dati dashboard;
  Milestone 13 e' multilingua minima e testi localizzati; Milestone 14 e'
  rifinitura estetica e manuali operativi. Motivo: le funzioni essenziali sono
  sufficienti per preparare l'apertura pubblica, quindi prima di aggiungere
  moduli avanzati bisogna verificare UX/flussi, localizzare testi stabili e
  solo dopo rifinire UI, grafica e manuali.
- Milestone 12 e' stata avviata il 2026-06-17 con una prima revisione UX su
  home, registrazione, conferma/magic link e dashboard partecipante. Prime
  patch consolidate nel commit `3d4d00d`: messaggi rossi del form solo dopo
  interazione o submit tentato, consenso dati sensibili di accessibilità
  mostrato/richiesto solo quando l'utente segnala bisogni di accessibilità,
  login non autenticato senza path tecnico, riduzione temporanea delle domande
  accessibilità e rimozione dei placeholder dai campi note accessibilità.
- Nella seconda tranche della Milestone 12 sono state riviste in localhost la
  dashboard partecipante con utente test non personale, dashboard capogruppo,
  manager, admin e accoglienza. Patch approvate: i dati accessibilità della
  dashboard partecipante non vengono più duplicati in input hidden nei form non
  dedicati e sono preservati lato server; i controlli `Gestisci` della tabella
  capogruppo hanno etichette accessibili contestuali; il proxy reindirizza gli
  accessi a dashboard non consentite verso la prima dashboard consentita invece
  che sempre verso l'area partecipante.
- Il 2026-06-17 la dashboard partecipante e' stata rifinita dopo revisione UX:
  il QR personale deve essere visibile subito nella prima schermata, non dietro
  un pulsante; sotto al QR compare `Il tuo codice: <codice>`; le azioni QR
  (`Scarica immagine`, futuro `Aggiungi al tuo wallet`) restano accanto al QR
  quando lo spazio lo consente; lo stato QR e' un indicatore verde/rosso in alto
  a destra con tooltip descrittivo, non una riga informativa nella card.
- Milestone 13 e' stata completata il 2026-06-17 con multilingua minima:
  selettore lingua globale nell'header con bandierine, cookie
  `iscrizioni_locale`, detection iniziale da `Accept-Language`, fallback
  inglese quando la lingua non e' supportata, e localizzazione di home, login,
  conferma iscrizione, form pubblico, tab dashboard condivise, testi comuni
  header, dashboard partecipante e dashboard capogruppo. Lingue supportate:
  italiano, inglese, francese, tedesco, spagnolo, neerlandese e ucraino.
  La lingua preferita del partecipante ora accetta le stesse lingue nei flussi
  pubblico, dashboard partecipante e inserimento manuale capogruppo.
- Il 2026-06-16 e' stata rifinita la navigazione delle dashboard operative:
  tab condivise fra dashboard admin/manager/accoglienza/capogruppo e area
  personale, logout globale, rimozione della card "La mia iscrizione" dalle
  dashboard operative e gestione admin/capogruppo dal modale admin.
- Il 2026-06-17 e' stato popolato l'albero gruppi operativo per l'evento test
  a partire dai paesi/città dell'app modello: nodi paese/città, 26 aree Roma,
  città italiane aggiunte Monterotondo/Tivoli/Sezze, regole matching e
  referenti principali iniziali per Universitari, Giovani per la pace scuole
  superiori e Giovani per la pace scuole medie.
- Il 2026-06-15 e' stata anticipata la generazione QR reale: le nuove
  iscrizioni generano un QR code reale, inviato nella email di conferma e
  visualizzato nella dashboard partecipante.
- Il 2026-06-15 e' stata verificata e corretta la configurazione Vercel
  production: la production branch e' `main`, l'alias stabile e'
  `https://iscrizioni-pace.vercel.app`, e i magic link generati per l'ambiente
  online puntano a quel dominio.
- Branch di lavoro ordinario: `main`.
- Remote `origin` configurato:
  `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Per verificare l'ultimo commit/push noto su `main`, usare
  `git log -1 --oneline origin/main` dopo `git fetch` o dopo un push riuscito.

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
- `npm run opening:verify`.
- `npm run opening:verify:production`.

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
- `npm run opening:verify` controlla la presenza delle env richieste per
  l'apertura pubblica usando `.env.local`, senza stampare valori segreti.
- `npm run opening:verify:production` usa `.env.production.local` e verifica
  anche che gli URL app puntino a `https://iscrizioni-pace.vercel.app`.
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
- Intenzione prodotto aggiornata: `admin` e `manager` devono avere permessi
  operativi sostanzialmente identici sui dati dell'evento. Le differenze
  riservate all'admin sono creare/avviare nuovi eventi e assegnare/promuovere
  il ruolo `manager` a persone gia' iscritte.
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
- Prime dashboard protette in `app/dashboard/*`; i placeholder iniziali sono
  stati progressivamente sostituiti dalle dashboard operative e dalla
  navigazione condivisa a tab.
- Test di funzioni pure in `tests/auth-roles.test.mts`.

Decisioni:

- In Next.js 16.2.9 usare `proxy.ts` per la protezione route; `middleware.ts` e' deprecato.
- `manager_viewer` condivide la route `/dashboard/manager`; la UI deve restare
  read-only per questo ruolo e nascondere/disabilitare le azioni modificative.
- `partecipante` non e' nell'enum database `app_role`: e' una destinazione applicativa di default per utenti autenticati/proprietari di iscrizioni.
- Il callback supporta `code`, `token_hash` e `token` con tipi OTP Supabase noti.
- Al callback viene fatto `upsert` del profilo applicativo in `profiles` usando la sessione utente e RLS ordinaria, non service role.
- Il cookie `iscrizioni_requested_role` può ricordare una dashboard richiesta per utenti con più ruoli.
- La protezione dashboard legge `event_user_roles` via client server con anon key e RLS; non usa service role nei flussi utente ordinari.
- Dal lavoro di Milestone 7, il ruolo applicativo `capogruppo` viene scoperto
  anche da `group_memberships` collegate ai nodi dell'albero gruppi, non solo da
  `event_user_roles`. Questo permette referenti paese/città/area/gruppo senza
  creare ruoli separati per ogni livello.

Note operative:

- I callback URL Supabase devono includere `/auth/callback` sugli ambienti autorizzati, per esempio `http://localhost:3000/auth/callback` in locale.
- La login page e' ora una pagina di errore/redirect sessione; il flusso
  email-prima, preflight email esistente, magic link e form iscrizione e'
  implementato nella home e nelle route di registrazione.
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
- QR token opaco e hash in `lib/qrcode/token.ts`, rendering QR in
  `lib/qrcode/render.ts` e cifratura server-side del token recuperabile in
  `lib/qrcode/secure-token.ts`.
- Rate limit base in memoria in `lib/security/rate-limit.ts`.
- Test di funzioni pure in `tests/registration-flow.test.mts`.

Decisioni:

- I magic link sono generati con `supabase.auth.admin.generateLink` e inviati
  dall'app via SMTP Gmail, non dal mailer interno Supabase.
- Dal 2026-06-17 i magic link applicativi costruiti con
  `data.properties.hashed_token` devono puntare a
  `/auth/callback?...&token_hash=<hash>&type=email`. Usare `type=magiclink`
  con `verifyOtp` faceva fallire il login con errore link scaduto; il callback
  mantiene un fallback da `magiclink` a `email` per eventuali link già inviati.
- L'account mittente configurato e' `registrationspeace@santegidio.org`.
- La password app resta solo in `.env.local` o nelle env del runtime; non
  deve essere stampata o committata.
- Variabili email supportate:
  `EMAIL_FROM`, `EMAIL_USER`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`; `GMAIL_APP_PASSWORD` resta alias locale supportato.
- Dopo callback magic link, i partecipanti con contatto email corrispondente
  vengono collegati a `auth.users.id` tramite service role server-side.
- Il QR code non contiene dati personali: contiene solo un token opaco.
- Dal 2026-06-15 `qr_tokens` conserva `token_hash` per verifica futura e
  `token_encrypted` per rigenerare server-side lo stesso QR in dashboard. Il
  token non va salvato in chiaro.
- Il rate limit e' volutamente basico e in memoria; per produzione serverless
  andrà sostituito o affiancato da storage condiviso.

Note operative:

- `.env.local` contiene gli alias email necessari per lo sviluppo locale.
- Il repository e' collegato a Vercel tramite `.vercel/project.json`. Se il
  link viene perso o ricreato, sincronizzare almeno `EMAIL_FROM`, `EMAIL_USER`,
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
- Dopo la prima revisione UX della Milestone 12, il form pubblico mostra per
  ora solo tre opzioni accessibilità: sentire, camminare/salire gradini, uso di
  sedia a rotelle o altro ausilio per la mobilità. Sono state rimosse
  temporaneamente le opzioni vedere, cura di sé, ricordare/concentrarsi,
  comunicare e bisogno di assistenza durante l'evento. Il campo note pratiche
  non deve avere placeholder/suggerimenti nel box.
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

Configurazione verificata e aggiornata il 2026-06-17:

- Progetto Vercel: `iscrizioni-pace`.
- Project ID: `prj_4n4oKj3S4sg5RUg5H6AsJLBAK7w6`.
- Team/org ID: `team_ZzsE0ydPpm1T9muAU1xi2uCN`.
- Production branch: `main`.
- Dominio production stabile: `https://iscrizioni-pace.vercel.app`.
- Alias production aggiuntivi:
  `https://iscrizioni-pace-giovaniperlapaces-projects.vercel.app` e
  `https://iscrizioni-pace-giovaniperlapace-giovaniperlapaces-projects.vercel.app`.
- Ultimo deployment production verificato: `dpl_31mPosisDYWVULXdLTcz5satRWKD`,
  generato dal commit `f2baa4a` su `main`.

Variabili Vercel production richieste:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_URL`.
- `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `QR_TOKEN_ENCRYPTION_SECRET` consigliato per cifratura QR stabile.
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
- Se configurato, `QR_TOKEN_ENCRYPTION_SECRET` deve restare stabile tra deploy:
  se cambia, i QR già salvati in `token_encrypted` non saranno più
  rigenerabili in dashboard. L'app ha fallback server-side per compatibilita',
  ma in produzione e' preferibile configurare un segreto esplicito.
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
- Il 2026-06-17 e' stato corretto un bug reale di login: i link applicativi
  costruiti da `data.properties.hashed_token` devono usare
  `token_hash=<hash>&type=email`. Prima usavano `type=magiclink` e Supabase
  restituiva errore OTP/link scaduto. La produzione e' stata verificata con
  redirect a `/dashboard/partecipante` per `type=email` e fallback
  `type=magiclink` su token non ancora consumati.
- L'invio reale delle email dipende da una password app Gmail valida nelle
  variabili SMTP; il dominio del link e' stato verificato separatamente
  dall'arrivo effettivo in inbox.

## Milestone 7 - preparazione apertura pubblica

Checklist operativa:

- `docs/opening-checklist.md`.

Guardrail aggiunti:

- `.vercelignore` esclude `.env`, `.env.*`, `.next`, `node_modules`, log e
  artefatti locali, lasciando tracciabile `.env.example`.
- `.env.example` usa URL locali per sviluppo e documenta il dominio production
  stabile `https://iscrizioni-pace.vercel.app`.
- Script `npm run opening:verify` e `npm run opening:verify:production`
  controllano env richieste: Supabase public/private, SMTP,
  `QR_TOKEN_ENCRYPTION_SECRET` e, in modalità production, URL app stabili. Non
  stampano valori segreti.
- Le dashboard operative usano tab condivise fra area admin, manager,
  accoglienza, capogruppo e `Iscrizione e QR personale`. La vecchia card
  "La mia iscrizione" e' stata rimossa dalle dashboard operative perché la
  stessa funzione e' raggiungibile dalla tab personale.
- `app/dashboard/capogruppo/page.tsx` ora valida la sessione lato server e usa
  `group_memberships` come fonte reale dei nodi/gruppi assegnati.

## Milestone 8 - apertura controllata e monitoraggio iniziale

Deliverable:

- Dashboard admin aggiornata in `app/dashboard/admin/page.tsx` con vista
  operativa per evento: stato apertura, finestre `registration_opens_at` /
  `registration_closes_at`, conteggi iscrizioni e segnali da controllare.
- Server action `updateEventOpeningState` in `app/actions.ts` con comandi:
  `Apri ora`, `Pausa`, `Nascondi`.
- Ogni comando apertura scrive audit in `audit_logs` con action
  `event.opening_open`, `event.opening_pause` o `event.opening_draft`.
- Gli errori di invio magic link e conferma iscrizione vengono registrati in
  `audit_logs` con action `email.magic_link_failed` e
  `email.registration_confirmation_failed`, senza salvare segreti, token o
  indirizzi email completi nel metadata.
- Helper testabili in `lib/registrations/opening-monitoring.ts`.
- Test `tests/opening-monitoring.test.mts`.
- Log/procedura operativa `docs/opening-monitoring-log.md`, collegato alla
  checklist apertura.

Decisioni:

- `Apri ora` imposta l'evento `published`, apre subito la finestra iscrizioni e
  rimuove una chiusura passata; se la chiusura futura esiste, viene mantenuta.
- `Pausa` lascia l'evento `published` ma porta `registration_closes_at` al
  momento corrente, così il form pubblico non accetta nuove iscrizioni.
- `Nascondi` imposta l'evento `draft` e porta `registration_closes_at` al
  momento corrente.
- La dashboard admin mostra solo conteggi e anomalie aggregate, non elenchi di
  email o dati personali.
- I conteggi da guardare nei primi giorni sono: iscrizioni totali, ultime 24
  ore, senza gruppo corrente, gruppo probabile, QR mancante, errori email 24h,
  email duplicate e richieste di supporto operativo.

Verifiche previste:

- Prima dell'apertura reale eseguire `npm run opening:verify`,
  `npm run opening:verify:production`, `npm run email:verify`,
  `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Dopo ogni comando admin verificare home pubblica e form in una nuova sessione
  browser.

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

- Riepilogo iscrizione con frase introduttiva su evento/date, area panel,
  overlay QR e accessibilita' sintetica.
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

- Il QR token resta opaco e non contiene dati personali. In dashboard viene
  rigenerata l'immagine QR server-side decifrando `qr_tokens.token_encrypted`;
  se il record e' precedente alla migration e non ha token cifrato, resta il
  placeholder.
- La dashboard mostra stato QR/accesso evento, codice partecipante e QR reale
  quando il token cifrato e' disponibile.
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
- L'overlay QR mostrava inizialmente un placeholder; dopo l'anticipo QR reale
  mostra il QR quando `token_encrypted` e' disponibile, con stato QR e codice
  partecipante.
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
- La dashboard partecipante deve sempre offrire un rientro alle aree operative
  disponibili per lo stesso utente quando esistono ruoli aggiuntivi oltre a
  partecipante. Questo evita che admin, manager, capogruppo o accoglienza che
  aprono "La mia iscrizione" restino senza navigazione per tornare al proprio
  profilo operativo. La prima implementazione mostra "Vai all'area admin" e
  usa la stessa logica role-aware per futuri ruoli.

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

## Milestone 6.3 - albero gruppi, matching referente e nuovi partecipanti

Albero gruppi e matching iniziale completati localmente il 2026-06-16.

Deliverable:

- Migration `supabase/migrations/20260616103000_group_tree_matching.sql`.
- Migration `supabase/migrations/20260616110000_backfill_group_tree_test_seed.sql`
  aggiunta dopo applicazione remota per riallineare il seed dei nodi test già
  registrato.
- Migration `supabase/migrations/20260617100000_seed_group_tree_from_model_app.sql`
  aggiunta per popolare il catalogo operativo da app modello e per distinguere
  il referente principale in `group_memberships.is_primary`.
- `groups` estesa con `parent_group_id`, `node_type`, `community_kind`,
  `age_bracket`, `is_assignable`, `is_public_catalog`, `public_order` e
  `matching_notes`.
- Nuova tabella `group_assignment_rules` per regole di evento su paese, città,
  fascia età e priorità.
- `participant_group_assignments` estesa con `is_current`,
  `assignment_reason`, `escalated_from_group_id`, `escalation_depth` e
  `matcher_version`, più indice unico parziale per l'assegnazione corrente.
- Helper testabili in `lib/groups/matching.ts` per calcolare età alla data
  evento, fasce giovani/adulti con sovrapposizione 23-30 anni, candidati
  territoriali e fallback.
- Form pubblico aggiornato con campo unico autocomplete per gruppi/referenti,
  filtrato sui candidati affini e ricercabile sia per nome gruppo sia per nome
  referente. Le label usano `nome gruppo - referente ...`.
- Opzione "Non trovo il mio referente" mantenuta: azzera l'eventuale scelta e
  consente l'assegnazione probabile da regola.
- Dopo un errore di validazione nel form pubblico, i dati già inseriti vengono
  conservati in `sessionStorage` per la sessione browser e la UI porta il focus
  sul campo più probabile da correggere.
- La pagina di conferma iscrizione contiene una CTA per tornare alla home e
  fare il primo accesso; se presente, l'email viene passata alla home e
  precompilata nel form email-prima.
- Le nuove iscrizioni vengono agganciate a un gruppo scelto, a un gruppo
  probabile calcolato o a un nodo territoriale dei nuovi partecipanti quando
  esiste un candidato coerente.
- La dashboard manager mostra l'albero gruppi completo, inclusi nodi interni,
  gruppi senza referente e referente principale quando presente.

Decisioni:

- Il referente principale di un gruppo e' modellato con
  `group_memberships.is_primary = true` e duplicato come testo leggibile in
  `groups.primary_leader_name` per il form pubblico. Un gruppo può avere più
  membership capogruppo, ma al massimo una primaria.
- Per ora la distinzione `age_bracket = giovani/adulti` e' significativa solo
  per le aree Roma; le città/gruppi fuori Roma sono seedati come `both`.
- `community_kind = 'newcomers'` e i nodi territoriali dei nuovi partecipanti
  sono classificazioni interne: non vanno esposte nella UI partecipante o nelle
  email ordinarie.
- I gruppi visibili nel form pubblico devono avere `is_public_catalog = true`,
  essere attivi e assegnabili. I nodi interni possono essere usati dal server
  per il matching ma non mostrati come scelta pubblica.
- Il matching usa `participants.country_id` e `participants.city_id` quando il
  paese/città digitato coincide con i cataloghi. I campi testuali restano
  comunque conservati come fallback e nello snapshot questionario.
- Se la persona dichiara di non avere partecipazione precedente Sant'Egidio,
  il sistema assegna il nodo `newcomers` più vicino per città o paese.
- Se la persona ha partecipazione Sant'Egidio ma non trova il referente o non
  partecipa con gruppo, il sistema assegna un gruppo/referente probabile con
  `source = 'rule'` e `status = 'probable'`.
- Se il partecipante seleziona un gruppo, l'assegnazione resta `probable` con
  `source = 'participant_selected'`; la conferma esplicita del referente resta
  demandata alla dashboard capogruppo futura.

Verifiche previste:

- Test unitari in `tests/group-matching.test.mts` coprono Austria senza città,
  Italia/Roma, aree, sovrapposizione 23-30 anni, nuovi partecipanti e "Non
  trovo il mio referente".
- Migration 6.3 e backfill applicati al Supabase remoto il 2026-06-16. Dopo il
  backfill remoto verificati: 10 nodi seed 6.3, 5 nodi pubblici assegnabili, 3
  nodi `newcomers`, 6 regole di matching.
- Browser locale verificato per autocomplete gruppo/referente e CTA conferma
  iscrizione. Il browser integrato non ha permesso test automatico completo di
  digitazione per un problema del clipboard virtuale, ma lint/typecheck/test e
  build sono passati.
- Prima di chiudere una modifica collegata alla 6.3 usare ancora
  `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Milestone 9 - dashboard capogruppo minima

Dashboard capogruppo minima completata e consolidata su `main`.

Deliverable:

- Migration
  `supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql`.
- `participant_group_assignments` estesa con metadati di gestione referente:
  `leader_internal_note`, `leader_note_updated_by`,
  `leader_note_updated_at`, `leader_decision_by`, `leader_decision_at` e
  `leader_notification_read_at`.
- Helper testabili in `lib/groups/capogruppo-dashboard.ts` per scope
  discendenti dell'albero gruppi, filtri, conteggi, normalizzazione note e
  target di escalation al padre.
- Pagina `app/dashboard/capogruppo/page.tsx` sostituita con vista operativa:
  metriche, accesso "La mia iscrizione", filtri `Da verificare`, `Probabili`,
  `Confermati`, `Rifiutati` e schede assegnazione.
- Server action `updateGroupLeaderAssignment` in `app/actions.ts` con intent
  `note`, `read`, `confirm`, `reject`.

Decisioni:

- La dashboard capogruppo usa il service role lato server solo dopo aver
  verificato sessione e membership del referente, così include anche i
  discendenti dei nodi assegnati. Il service role non arriva mai al browser.
- La UI mostra dati personali minimi: nome, codice operativo, provenienza,
  gruppo, stato e metadati di assegnazione. Non mostra email, telefono,
  accessibilità o altri dati sensibili.
- `confirm` imposta l'assegnazione corrente a `confirmed`, registra
  `confirmed_by/confirmed_at`, decisione referente e lettura.
- `reject` porta l'assegnazione rifiutata a `status = 'rejected'` e
  `is_current = false`; se il gruppo ha un padre crea o riattiva una nuova
  assegnazione corrente `probable` sul padre con `source = 'capogruppo'`.
  Se non c'e' padre, la registrazione resta senza assegnazione corrente e
  finisce nella coda manager già monitorata come "senza gruppo corrente".
- Rifiuto, conferma, nota e lettura sono decisioni interne: non inviano email
  o notifiche al partecipante.
- L'audit log salva action e metadati tecnici (`group_id`, stato precedente,
  eventuale gruppo di escalation, flag nota cambiata), non il testo della nota
  interna.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

## Milestone 9.1 - link riservati per gruppi nascosti

Link riservati per gruppi iscrivibili ma non visibili nel catalogo pubblico
completati localmente il 2026-06-17.

Deliverable:

- Migration `supabase/migrations/20260617130000_group_registration_links.sql`.
- `groups` estesa con `public_label`, label opzionale mostrabile al
  partecipante quando il nome operativo interno e' troppo delicato o ambiguo.
- Nuova tabella `group_registration_links` con `token_hash`, `public_label`,
  `internal_label`, `use_count`, `max_uses`, `expires_at`, `revoked_at`,
  `created_by` e `revoked_by`.
- Helper server-side in `lib/groups/registration-links.ts` per generare token
  opachi, hash SHA-256, URL pubblici, label partecipante e stato link.
- Form pubblico `/registrazione?groupLink=<token>`: il token valido aggiunge un
  contesto "Gruppo indicato dal referente", usa la label pubblica e assegna il
  gruppo anche se `is_public_catalog = false`.
- `createPublicRegistration` valida server-side il gruppo selezionato: senza
  token link valido accetta solo gruppi attivi, assegnabili e pubblici nel
  catalogo. Questo chiude la possibilità di forzare manualmente UUID di gruppi
  nascosti nel submit.
- Dashboard manager: sezione "Link riservati di iscrizione" per generare e
  revocare link su tutti i gruppi iscrivibili degli eventi gestibili.
- Dashboard capogruppo: sezione "Link iscrizione gruppo" per generare e
  revocare link solo sui gruppi nel proprio scope discendente.
- Audit log per `group_registration_link.created`,
  `group_registration_link.revoked` e `registration.group_link_used`, senza
  salvare token in chiaro.
- Test aggiornati in `tests/group-matching.test.mts` e
  `tests/database-schema.test.mts`.

Decisioni:

- `is_assignable = true` indica che un gruppo può ricevere iscrizioni;
  `is_public_catalog = true` indica che compare nel suggerimento pubblico;
  `is_assignable = true` e `is_public_catalog = false` indica gruppo nascosto
  ma iscrivibile solo tramite link riservato o gestione operativa.
- Il token del link e' opaco e non contiene ID gruppo, nomi o dati personali.
  In database si conserva solo `token_hash`; il link completo viene mostrato
  solo subito dopo la creazione.
- La label pubblica del link prevale su `groups.public_label`; se entrambe sono
  assenti, il form mostra "Gruppo indicato dal tuo referente".
- Il link riservato non forza le risposte personali del questionario: la persona
  può rispondere sinceramente su partecipazione precedente e gruppo; il token
  determina comunque l'assegnazione operativa al gruppo invitante.
- Le iscrizioni arrivate da link riservato usano
  `assignment_reason = 'group_registration_link'`, `status = 'probable'` e
  `source = 'participant_selected'` per restare compatibili con il vincolo
  attuale della tabella.
- Manager/admin possono generare link per tutti i gruppi iscrivibili in scope
  evento; capogruppo solo per il proprio gruppo/nodo e discendenti.
- I link esistenti non sono ricostruibili dalla dashboard perché il token in
  chiaro non viene conservato. Se serve reinviare un link, se ne genera uno
  nuovo e si può revocare quello vecchio.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Migration remota applicata con
  `./scripts/apply-remote-migration.sh supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql`.

## Milestone 10 - inserimento manuale partecipanti da capogruppo

Inserimento manuale completato localmente il 2026-06-17.

Deliverable:

- Helper testabile `lib/registrations/manual-registration.ts` per parsing,
  normalizzazione e snapshot questionario minimale.
- Server action `createGroupLeaderManualRegistration` in `app/actions.ts`.
- Dashboard capogruppo aggiornata in `app/dashboard/capogruppo/page.tsx`:
  tabella partecipanti del gruppo, filtri/ordinamento, azioni per rivedere
  assegnazioni, overlay per inserimento manuale e overlay per link iscrizione.
- Componenti client `manual-attendance-fields.tsx` e
  `manual-accessibility-fields.tsx`.
- Test in `tests/registration-flow.test.mts`.

Funzioni disponibili:

- Il capogruppo può inserire nome, cognome, email o telefono, eventuale data di
  nascita, lingua, presenza prevista e nota interna.
- La presenza manuale usa le date reali dell'evento, non etichette riassuntive;
  può restare "da confermare".
- Le domande accessibilità nell'inserimento manuale mostrano i follow-up solo
  se viene selezionato "Sì".
- Il gruppo selezionabile è limitato ai gruppi iscrivibili nello scope
  discendente del capogruppo.
- L'iscrizione viene creata con `registrations.source = 'capogruppo'` e
  `registrations.created_by` valorizzato.
- L'assegnazione gruppo viene creata subito `confirmed`, con source
  `capogruppo`, confidence `1`, reason `group_leader_manual_entry`,
  `matcher_version = 'group-leader-manual-v1'` e metadati decisione referente.
- Vengono creati contatto primario, consenso privacy/trattamento dichiarato dal
  capogruppo, snapshot questionario minimale, record accessibilità vuoto,
  QR token opaco cifrato e audit `registration.created_by_group_leader`.

Decisioni:

- La vista predefinita della dashboard capogruppo è la tabella
  "Partecipanti del gruppo"; i riepiloghi tecnici e i conteggi ridondanti non
  vanno mostrati al capogruppo.
- "Genera link" e "Inserisci partecipante" sono strumenti contestuali aperti in
  overlay dal gruppo selezionato, non sezioni permanenti della pagina.
- I link riservati generati dal capogruppo mantengono il gruppo nascosto dal
  catalogo pubblico ma precompilano il form pubblico tramite `?groupLink=...`.
- Nel form pubblico aperto da link riservato, la UI non chiede più se la persona
  ha già partecipato o se parteciperà con un gruppo: i valori sono impliciti e
  inviati come hidden (`hasPreviousSantegidioParticipation=yes`,
  `participatesWithGroup=yes`, `groupId=<gruppo>`).
- Il riquadro del form pubblico da link riservato deve spiegare che il link
  iscrive a quello specifico gruppo e offrire l'uscita verso `/registrazione`
  per l'iscrizione generica se il gruppo non è corretto.
- Email e telefono sono alternativi: serve almeno un recapito.
- Se l'email è presente, l'action blocca doppie iscrizioni allo stesso evento.
- L'inserimento manuale non invia email automatiche al partecipante.
- I dati di paese/città del partecipante sono ereditati dal gruppo scelto
  quando presenti; eventuali dettagli più completi restano modificabili in
  passaggi successivi.
- La checkbox consenso registra che il capogruppo dichiara di avere il consenso
  della persona iscritta; non sostituisce eventuali verifiche organizzative
  successive.
- La modifica completa dell'iscrizione, l'assegnazione a servizi e l'eventuale
  assegnazione a sottogruppi restano da progettare in milestone successive
  insieme alla rifinitura coerente di tutta l'app.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- Browser integrato su localhost: login capogruppo reale, link riservato
  generato e aperto, form pubblico con `groupLink`, inserimento manuale,
  tabella partecipanti e overlay link/manuale verificati.

## Rifinitura dashboard operative - 2026-06-16

Rifinitura realizzata dopo review nel browser integrato e consolidata su
`main`. Il diario della sessione e' in
`docs/diario-2026-06-16-dashboard-layout.md`; il commit di documentazione e
riallineamento e' `f2baa4a`.

Deliverable:

- Nuovo componente condiviso `app/dashboard/role-tabs.tsx`.
- Logica testabile per le tab in `lib/auth/dashboard-tabs.ts`.
- Navigazione a tab fra aree:
  `Dashboard admin`, `Dashboard manager`, `Dashboard accoglienza`,
  `Dashboard capogruppo`, `Iscrizione e QR personale`.
- Logout globale nell'header tramite server action `logout()` in
  `app/actions.ts` e bottone `Esci` con icona in `components/app-headbar.tsx`.
- Rimozione della card `Iscrizione personale collegata` dalle dashboard
  operative: l'area personale si raggiunge dalla tab
  `Iscrizione e QR personale`.
- Rimozione del vecchio placeholder dashboard accoglienza e riallineamento al
  layout delle altre dashboard operative.
- Modale admin `Modifica iscritto` aggiornato:
  - rimossa la X di chiusura;
  - `Annulla` e' l'unica uscita senza salvare;
  - `Conferma modifiche` e' l'unico salvataggio;
  - il select ruolo permette `Admin`, `Manager`, `Manager viewer`,
    `Accoglienza`, `Capogruppo` e `Nessun ruolo operativo`.

Decisioni:

- La tab attiva e' l'indicatore principale dell'area corrente; i titoli visibili
  ridondanti `Area protetta` / `Pannello operativo` sono stati rimossi dalle
  dashboard operative.
- Restano titoli `sr-only` per accessibilita' e struttura semantica.
- L'informazione `Area protetta` resta come badge grafico nella descrizione
  sotto le tab, non come titolo principale.
- Le descrizioni sotto le tab devono iniziare con tono operativo tipo
  "In questa area puoi..." e non devono ripetere l'email dell'utente, gia'
  mostrata nell'header globale.
- `manager` e `manager_viewer` condividono la tab `Dashboard manager`.
- Gli admin vedono tutte le dashboard operative, anche senza ruoli evento
  separati.
- Il ruolo `Admin` assegnato dal modale admin viene scritto in
  `event_user_roles` come ruolo globale con `event_id = null`.
- Il ruolo `Capogruppo` assegnato dal modale admin viene scritto in
  `group_memberships` sul gruppo selezionato.
- Cambiare ruolo dal select admin rimuove gli altri ruoli operativi assegnabili
  nello stesso contesto; `Nessun ruolo operativo` li rimuove.

Note operative:

- Durante il test un utente operativo reale ha perso temporaneamente il ruolo
  admin per effetto della nuova gestione ruolo; e' stato ripristinato
  manualmente via Supabase service role. Dopo il ripristino risultavano
  `admin` globale e `manager` sull'evento test. Per modifiche future al select
  ruolo, verificare sempre anche l'utente admin che sta eseguendo la modifica.

Verifiche eseguite durante la sessione:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Verifiche browser su admin, manager, capogruppo, accoglienza e partecipante.

## Anticipo QR code reale

Funzionalità anticipata il 2026-06-15 rispetto alla roadmap originaria.

Deliverable:

- Dipendenza `qrcode` aggiunta per generare QR PNG/data URL reali.
- Migration `supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql`
  aggiunta e applicata al Supabase self-hosted remoto.
- `qr_tokens.token_encrypted` conserva il token QR opaco cifrato lato server;
  `qr_tokens.token_hash` resta la base per la verifica futura.
- Alla nuova iscrizione l'app genera il QR dal token opaco, lo allega/mostra
  inline nella email di conferma e conserva il token cifrato.
- La dashboard partecipante mostra il QR reale quando `token_encrypted` e'
  disponibile; per iscrizioni precedenti senza token cifrato mostra ancora il
  placeholder.
- Nella dashboard partecipante il QR reale deve restare immediatamente visibile
  all'apertura dell'area personale. Evitare overlay o pulsanti primari per
  "vedere il QR"; l'overlay resta solo come compatibilita' URL/possibile vista
  estesa futura.
- Il codice partecipante va mostrato una sola volta sotto il QR con label breve
  `Il tuo codice:`, non duplicato in una card informativa separata.
- Le azioni QR attuali sono download PNG/data URL e placeholder disabilitato per
  wallet. La futura integrazione wallet richiedera' una vera funzione pass, non
  un link fittizio.

Decisioni:

- Il QR code contiene solo token opaco, non dati personali, nome, email o
  codice partecipante.
- `QR_TOKEN_ENCRYPTION_SECRET` e' il segreto consigliato per cifrare/decifrare
  token recuperabili. Deve restare stabile tra deploy.
- Lo scanner accoglienza e la verifica token restano da completare in una
  milestone successiva dedicata a QR/check-in.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Migration remota applicata con
  `./scripts/apply-remote-migration.sh supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql`.
- Browser integrato verificato su `?overlay=qr`: le iscrizioni precedenti alla
  migration mostrano fallback placeholder, le nuove potranno mostrare QR reale.

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
- `capogruppo`: utente reale dell'app; vede solo i partecipanti dei propri gruppi o nodi territoriali; conferma appartenenza/esternalita'; inserisce persone senza email; riceve notifiche.
- `admin`: ha gli stessi poteri operativi del manager sugli eventi, piu' la
  possibilita' riservata di creare/avviare nuovi eventi e assegnare il ruolo
  `manager` a persone gia' iscritte.
- `manager`: collegato a uno specifico evento; vede tutti i partecipanti e
  gruppi dell'evento e puo' modificare dati operativi, configurazione evento,
  gruppi e funzioni organizzative come l'admin, tranne creare nuovi eventi o
  nominare altri manager.
- `manager_viewer`: vede ciò che vede il manager ma non modifica iscrizioni.
- `accoglienza`: scansiona QR code e verifica iscrizioni/check-in vedendo solo dati minimi necessari.

I ruoli devono vivere in profili o membership applicative, non solo nei metadata Supabase Auth. Dove serve, il ruolo deve essere scoperto da uno scope: evento, gruppo, funzione di accoglienza.

Le dashboard admin e manager devono convergere: entrambe sono console operative
per configurare l'evento corrente, utenti operativi, ruoli non-manager e albero
gruppi. Admin e manager devono poter creare/modificare gruppi e nodi
paese/città/area/gruppo finale, invitare o promuovere manager_viewer,
accoglienza e referenti, e collegare i capigruppo ai nodi tramite
`group_memberships`. Solo l'admin puo' creare/avviare nuovi eventi e assegnare
o promuovere il ruolo `manager` a persone gia' iscritte.

Decisione stabile su ruoli operativi e partecipazione personale:

- I ruoli operativi non sostituiscono l'identità da partecipante. Manager,
  manager_viewer, capogruppo paese, capogruppo città, capogruppo area e
  capogruppo del singolo gruppo devono poter avere una propria registrazione
  personale allo stesso evento.
- La registrazione personale resta modellata in `participants` e
  `registrations`, collegata allo stesso utente Supabase tramite
  `participants.auth_user_id`. Giorni di presenza, QR personale, dati propri,
  accessibilità e futura scelta dei panel devono vivere su questa registrazione,
  non sul ruolo operativo.
- La gerarchia dei referenti/capigruppo va modellata con membership su nodi
  dell'albero `groups`: paese, città, eventuale area/sottogruppo, gruppo finale.
  Non creare identità separate o ruoli database distinti solo per
  `capogruppo_paese` o `capogruppo_citta` se basta lo scope del nodo.
- Le dashboard operative devono offrire un accesso chiaro a "La mia iscrizione"
  e segnalare se l'utente con ruolo operativo non ha ancora completato la
  propria registrazione personale per l'evento.

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
- Disabilità o bisogni di accessibilità con lista ridotta e temporanea:
  sentire, camminare/salire gradini, sedia a rotelle o altro ausilio per la
  mobilita'.
- Partecipazione precedente a eventi/iniziative Sant'Egidio.
- Partecipazione con gruppo Sant'Egidio o come singolo.
- Se gruppo: selezione da elenco gruppi cercabile per nome gruppo e capogruppo.
- Giorni/momenti previsti di partecipazione, con opzione "non lo so ancora".
- Accettazione privacy e consenso al trattamento dati.
- Versione consenso, data/ora, e quanto serve per tracciabilità legale.

## Gruppi, referenti e nuovi partecipanti

Decisione aggiornata il 2026-06-15:

- L'aggancio a un referente o a un gruppo probabile e' funzione centrale: ogni
  iscrizione deve essere collegata a un gruppo Sant'Egidio, a un referente
  probabile o a un nodo territoriale dei nuovi partecipanti.
- "Esterni" e' una categoria interna da evitare nella UI partecipante. Nome
  provvisorio per documentazione e viste operative: `nuovi partecipanti` o
  `non ancora membri Sant'Egidio`.
- I nuovi partecipanti non sanno e non devono ricevere notifiche sul fatto di
  essere stati classificati come non membri; la distinzione serve a
  comunicazioni, statistiche e informazioni riservate.
- I nuovi partecipanti devono comunque vivere nello stesso modello territoriale
  ad albero dei gruppi: paese, città e, solo dove ha senso, livelli ulteriori
  non esposti come appartenenza Sant'Egidio. Non si scende alle aree cittadine
  se le informazioni disponibili non permettono di farlo con affidabilità.
- L'albero gruppi previsto e' paese -> città -> eventuale area/sottogruppo. In
  paesi con un solo referente nazionale, il nodo paese può essere direttamente
  assegnabile.
- L'assegnazione del referente Sant'Egidio si ferma al terzo livello: esempi
  validi sono Torino, Regno Unito, Roma Torrevecchia.
- Collaboratori nominati da un referente non sono un quarto livello
  dell'albero: sono utenti con permessi sullo stesso gruppo o su sottoinsiemi
  operativi assegnati.
- Il form deve filtrare i gruppi affini usando paese, città di residenza ed età
  alla data dell'evento. Fasce iniziali: fino a 25 anni gruppi giovani; dai 30
  anni gruppi adulti; da 23 a 30 anni proporre sia giovani sia adulti.
- Ogni gruppo può essere taggato come giovani, adulti, entrambi o non
  dipendente dall'età.
- Le opzioni gruppo nel form devono essere ricercabili sia per nome gruppo sia
  per referente principale, per esempio `Giovani per la Pace - referente
  Stefano Orlando`.
- Deve esistere l'opzione "Non trovo il mio referente". In quel caso, oppure
  se una persona ha già partecipato a Sant'Egidio ma dice di non partecipare
  con un gruppo, il sistema assegna il gruppo più probabile in base a
  territorio/età con stato `probable`.
- Il referente vede le assegnazioni probabili in una coda interna e può
  confermare o rifiutare. Dopo rifiuto si risale automaticamente al padre
  dell'albero finché esiste un responsabile; se nessuno riconosce la persona,
  l'assegnazione finisce in coda manager.
- Il partecipante non riceve notifiche di rifiuto, risalita o
  riclassificazione interna.
- I referenti di qualunque livello dell'albero e i manager possono essere anche
  partecipanti dell'evento con la stessa email/account. Le funzioni operative
  servono a gestire altri partecipanti; la loro presenza personale, il QR e i
  panel passano sempre dalla dashboard partecipante.

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

`/Users/stefanolaptop/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/modello_app`

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
- Francese.
- Tedesco.
- Spagnolo.
- Neerlandese.
- Ucraino.

Regole:

- La lista canonica lingue sta in `lib/i18n/config.ts`.
- La localizzazione server usa `getRequestLocale()` in `lib/i18n/server.ts`:
  prima cookie `iscrizioni_locale`, poi `Accept-Language`, infine fallback
  inglese.
- Il selettore lingua globale vive in `components/language-selector.tsx` ed e'
  mostrato da `components/app-headbar.tsx`; nell'header mostra solo le
  bandierine, mentre i nomi lingua restano disponibili nei dati per form e
  accessibilità.
- Evitare testi UI hardcoded quando la struttura i18n esiste.
- Aggiornare tutte le lingue supportate per ogni nuova UI pubblica; se una
  traduzione non e' ancora affidabile, usare inglese come fallback esplicito.
- D'ora in poi ogni nuova pagina o funzione che interessa partecipante o
  capogruppo deve essere implementata nelle lingue supportate fin dall'inizio:
  italiano, inglese, francese, tedesco, spagnolo, neerlandese e ucraino.
  Questo vale per testi visibili, etichette, pulsanti, stati, errori, overlay,
  fallback di dati mancanti e campi form. Manager/admin possono restare
  prioritariamente italiani, con inglese o fallback sulle parti condivise.
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
