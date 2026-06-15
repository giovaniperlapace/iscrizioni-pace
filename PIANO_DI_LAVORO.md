# Piano di lavoro

## 1. Premessa e metodo di lavoro

Questo documento e' il piano operativo iniziale per costruire una web app multi-evento per iscrizioni, gruppi, comunicazioni, QR code e check-in. Il lavoro successivo andrà svolto a milestone piccole, una per prompt, con diff brevi e verificabili.

Stato locale rilevato in questo task:

- Cartella corrente: `/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/codex/iscrizioni-pace`.
- La cartella e' ora una working copy Git su branch `main`.
- Remote GitHub configurato: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Milestone 1-6 sono state implementate e il codice e' stato pushato su
  `main` fino al commit `Implement participant dashboard milestone`.
- Milestone 6.1 e' stata implementata localmente il 2026-06-15 e resta da
  committare/pushare su richiesta.
- La produzione Vercel e' configurata su `main` con alias stabile
  `https://iscrizioni-pace.vercel.app`.

Metodo da seguire per ogni milestone:

- Verificare sempre cartella corrente, branch corrente e `git status --short` prima di iniziare.
- Se la working tree e' sporca, capire se le modifiche sono pertinenti alla milestone; non sovrascrivere lavoro non compreso.
- Lavorare normalmente su `main`; creare branch dedicati solo se richiesto esplicitamente.
- Non fare commit o push senza richiesta esplicita.
- Prima di concludere ogni blocco, verificare `git diff`, file modificati, lint/typecheck/test/build quando disponibili.
- Ogni milestone deve avere criteri di done chiari: deliverable presenti, test/verifiche passate o limiti esplicitati, nessun segreto committato, nessuna modifica fuori scope.
- Sincronizzare con GitHub solo quando la repository locale e `main` sono chiari; fare commit/push su `main` solo su richiesta esplicita.
- Documentare decisioni tecniche e assunzioni in `AGENTS.md`, `docs/decisioni.md` o documenti equivalenti quando verranno creati.

Guardrail permanenti:

- Segreti, token Supabase, password Gmail/Coolify e chiavi service role non devono essere inseriti in file tracciati.
- I dati personali, soprattutto dati su disabilità, bisogni di accessibilità, minori/giovani, appartenenza a gruppi e presenza agli eventi, vanno trattati con minimizzazione, RLS stretta e audit log.
- Le migration Supabase vanno versionate, applicate in modo tracciabile e verificate contro drift tra repository e database reale.
- Il service role Supabase va usato solo lato server o strumenti operativi, mai nel browser.
- Ogni policy RLS rilevante va testata con utenti/ruoli diversi, non solo con client service role.

## 2. Sintesi del prodotto

L'app gestira' iscrizioni a eventi internazionali annuali della Comunità di Sant'Egidio, organizzati ogni anno in una città diversa. Deve essere multi-evento e multi-anno, per esempio Assisi 2026 o Roma 2025.

Utenti e ruoli principali:

- Partecipante: si iscrive, modifica i propri dati quando consentito, consulta dashboard, QR code, programma e scelte di partecipazione.
- Capogruppo: vede e gestisce i partecipanti del proprio gruppo, conferma appartenenza o esternalita', inserisce persone senza email o fragili, riceve notifiche.
- Amministratore: gestisce eventi, configurazioni, utenti, ruoli e dati globali.
- Manager evento: vede e gestisce dati operativi dell'evento specifico, dashboard, tabelle, filtri, export e statistiche.
- Manager visualizzatore: vede le stesse informazioni del manager ma senza modificare iscrizioni.
- Accoglienza/check-in: scansiona QR code, verifica iscrizione generale o a sotto-eventi e vede solo dati operativi minimi.

Workflow principale:

- La home parte dall'email.
- Se l'email corrisponde a un'iscrizione esistente, viene inviato un magic link Supabase.
- Se l'email non e' registrata, si avvia il form di iscrizione.
- Alla registrazione vengono salvati consensi, dati essenziali, gruppo certo o probabile, QR token e viene inviata una email di conferma.
- In fasi successive il partecipante può scegliere momenti specifici del programma.

Funzioni core:

- Autenticazione magic link Supabase.
- Profili applicativi, ruoli, permessi e RLS.
- Eventi, programma, momenti e sotto-eventi.
- Registrazioni, gruppi, capigruppo, assegnazioni certe/probabili.
- Partecipanti senza email gestiti tramite referente.
- Email di conferma, notifiche capogruppo e campagne personalizzate.
- QR code, scansione e check-in.
- Dashboard partecipante, capogruppo, manager, admin e accoglienza.
- Tabelle con filtri, ricerca, export e statistiche.
- Multilingua almeno italiano/inglese, estendibile.
- Privacy, retention, audit log e sicurezza operativa.

Confini rispetto alla app modello:

- La nuova app non deve assumere che l'evento sia residenziale.
- Le funzionalità di alloggio della app modello non sono core, salvo eventuali pattern di tabelle, filtri, ruoli e dashboard.
- La nuova app deve gestire anche persone esterne o nuove, non solo membri Sant'Egidio.
- La priorità funzionale e' iscrizione, gruppi, accoglienza, QR code, comunicazioni e scelta dei momenti.

## 3. Assunzioni e domande aperte

Assunzioni ragionevoli:

- Ogni partecipante appartiene a un evento specifico; la stessa persona potrà iscriversi a più eventi in anni diversi.
- L'email e' il principale identificativo di accesso per i partecipanti, ma non e' obbligatoria per persone inserite da un capogruppo.
- I dati di accessibilità sono dati sensibili e devono essere separati o comunque protetti con visibilità limitata.
- I capigruppo sono utenti Supabase Auth con profilo applicativo, non semplici contatti.
- Le comunicazioni per persone senza email vengono indirizzate al referente/capogruppo con riferimenti espliciti alle persone interessate.
- Il check-in deve poter funzionare su evento generale e su momenti/sotto-eventi.
- La prima implementazione può essere ottimizzata per un evento attivo alla volta nella UI pubblica, mantenendo però il database multi-evento.

Blocchi potenzialmente bloccanti prima dell'implementazione:

- Inizializzare o clonare correttamente la repository Git locale da `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Definire come accedere al Supabase self-hosted: URL, anon key, service role key o token CLI/management, project ref se disponibile.
- Definire credenziali o provider email da usare in sviluppo/staging, evitando account personali non tracciati.
- Decidere dominio/callback URL per magic link in locale, staging e produzione.
- Confermare requisiti legali minimi su privacy, consenso, dati di disabilità e retention.

Domande che possono restare aperte fino a milestone successive:

- Quali lingue oltre italiano e inglese servono al primo evento.
- Se il programma ha posti limitati per alcuni momenti.
- Se i settori/sedute sono assegnati manualmente, importati o calcolati.
- Se l'accoglienza deve lavorare offline o solo online.
- Quale formato di export serve ai manager.
- Quali statistiche sono essenziali per il primo rilascio.
- Come distinguere operativamente "membro Sant'Egidio già coinvolto" e "persona esterna/nuova".

Informazioni da chiedere al committente:

- Evento pilota, date, città, luoghi e momenti iniziali.
- Testo privacy e versione consenso da registrare.
- Elenco iniziale paesi/città e gruppi/capigruppo.
- Regole iniziali per associazione probabile gruppo da paese/città.
- Ruoli iniziali degli utenti admin, manager, capigruppo, accoglienza.
- Provider email definitivo e policy di invio.
- Requisiti di retention post-evento.

## 4. Analisi preliminare della app modello

La app modello e' accessibile in:

`/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/modello_app`

Struttura rilevata:

- Stack coerente con quello previsto: Next.js 16.1.6, React 19.2.3, TypeScript, Tailwind CSS 4, Supabase.
- App Router in `app/*`, con `app/login`, `app/auth/callback`, dashboard per `admin`, `manager`, `capogruppo`, `partecipante`, `alloggi`.
- Librerie in `lib/*`: auth, Supabase client/server/service, i18n, email, event settings, admin, capogruppo, alloggi.
- SQL storici in `supabase/*.sql`.
- Test Node in `tests/*.test.ts`.
- Documento operativo `AGENTS.md` e guida `docs/supabase-workflow.md`.

Pattern da riusare:

- Separazione tra Supabase browser/server client e service client lato server.
- Magic link gestito dall'app: preflight accesso, generazione link Supabase lato server e invio email applicativo.
- Tabella profili con ruoli applicativi e redirect per ruolo.
- Layout dashboard separati per ruolo.
- Componenti manager/admin riusabili per tabelle, filtri, edit modal, log email.
- i18n con provider e file locale TypeScript.
- Email templates, log invii e destinatari.
- Soft delete dei partecipanti e schermata admin di recupero.
- Documentazione operativa per Codex in `AGENTS.md`.
- Guardrail per operazioni Supabase e uso service role solo lato server.

Codice eventualmente adattabile:

- Login magic-link, callback e controllo ruoli, previa revisione per il nuovo flusso email-prima.
- Pattern `participants-table` per filtri, ricerca, colonne opzionali, sort, edit modal ed export futuro.
- Pattern campagne email e log destinatari.
- Pattern impostazioni evento/admin.
- Pattern i18n e selettore lingua.
- Pattern capogruppo per scope dati del gruppo.
- Test di funzioni pure per normalizzazione, presentazione dati e destinatari email.

Parti da non importare automaticamente:

- Dominio alloggi/residenziale: alberghi, stanze, quote, preferenze alloggio, room assignment.
- Logiche specifiche host city/alloggio dell'evento modello.
- Integrazione Tally webhook, salvo eventuale studio storico.
- Finanza evento, salvo richiesta futura.
- Nomi, date, domini, email sender e configurazioni specifiche del Global Friendship/evento modello.
- Migration SQL esistenti, da non applicare al nuovo database senza progettazione dedicata.

Tabelle e pattern dati osservati senza esporre segreti:

- `partecipanti`, `gruppi`, `profili`, `profili_gruppi`.
- `admin_event_settings`.
- `admin_email_settings`, `email_templates`, `email_send_logs`, `email_send_log_recipients`.
- Tabelle alloggi: `alberghi`, `stanze`, `stanze_gruppi`, `partecipanti_stanze`.
- Tabelle operative aggiuntive: duplicate false positives, finance, webhook events.
- RLS presente su gruppi, partecipanti, email templates/log, alloggi e finance, con helper SQL per ruolo/scope gruppo.

## 5. Proposta architetturale iniziale

Next.js App Router:

- `app/[locale]/page.tsx` o struttura equivalente per UI pubblica multilingua.
- `app/[locale]/registrazione/*` per flusso nuova iscrizione.
- `app/[locale]/dashboard/partecipante/*`.
- `app/[locale]/dashboard/capogruppo/*`.
- `app/[locale]/dashboard/manager/*`.
- `app/[locale]/dashboard/admin/*`.
- `app/[locale]/dashboard/accoglienza/*`.
- `app/auth/callback` per completare magic link.
- `app/api/*` solo dove serve un endpoint HTTP, webhook o azione non adatta a server action.

Organizzazione proposta:

- `lib/supabase/client.ts`, `server.ts`, `service.ts`.
- `lib/auth/*` per ruoli, access checks, redirect, session helpers.
- `lib/events/*` per evento attivo, configurazioni e programma.
- `lib/registrations/*` per validazione, normalizzazione e use case iscrizione.
- `lib/groups/*` per assegnazioni certe/probabili e scope capogruppo.
- `lib/email/*` per provider, template, invii e log.
- `lib/qrcode/*` per token, generazione e verifica.
- `lib/audit/*` per eventi sensibili.
- `lib/i18n/*` per traduzioni.
- `components/*` per componenti riusabili, evitando coupling ai dati Supabase.

Supabase client/server:

- Browser client con anon key solo per sessione utente e chiamate permesse da RLS.
- Server client con cookie per leggere sessione e applicare RLS.
- Service client solo in route/server actions fidate per operazioni amministrative, invio magic link, email e processi che richiedono privilegi.

Autenticazione:

- Flusso pubblico email-prima.
- Se email già associata a iscrizione attiva, invio magic link.
- Se nuova, form pubblico con rate limit e validazione.
- Profili applicativi collegati a Supabase Auth per ruoli non partecipante e per capigruppo.
- Per partecipanti senza email, accesso mediato dal capogruppo/referente; valutare account delegato solo se necessario.

Ruoli e autorizzazioni:

- Ruoli in tabella profili/app memberships, non solo in metadata auth.
- Scope per evento: manager e visualizzatori collegati a uno o più eventi.
- Scope per gruppo: capogruppo collegato a gruppi tramite membership.
- Accoglienza con permessi minimi su QR/check-in e dati essenziali.
- RLS come protezione primaria, controlli server come seconda linea.

Multilingua:

- Italiano e inglese obbligatori al primo rilascio.
- Namespace per area: public, registration, participantDashboard, groupLeader, manager, admin, checkIn, email.
- Persistenza lingua in cookie o profilo utente.
- Template email localizzati, con fallback controllato.

Email:

- Provider astratto: SMTP/Gmail iniziale se confermato, lasciando spazio a provider transazionale.
- Template versionati nel database o file seed/migration, con log degli invii.
- Distinguere email transazionali da campagne manager.
- Per persone senza email, invio al referente con elenco destinatari riferiti.

QR/check-in:

- QR code basato su token opaco non indovinabile, non su dati personali.
- Token revocabile e rigenerabile.
- Endpoint di verifica che restituisce solo dati minimi per accoglienza.
- Check-in idempotente con audit log: chi, quando, dove, evento/momento.
- Supporto per check-in evento generale e momenti specifici.

Logging/audit:

- Audit log per creazione/modifica iscrizione, cambi gruppo, check-in, invii email, modifica ruoli, export, accesso a dati sensibili.
- Log tecnici separati da audit applicativo.
- Evitare di registrare contenuti sensibili non necessari.

Ambienti:

- Locale: `.env.local` non tracciato.
- Staging: database e callback URL separati se possibile.
- Produzione: Supabase self-hosted su Hetzner/Coolify.
- Ogni ambiente deve avere URL, chiavi e redirect espliciti.

## 6. Ipotesi iniziale di modello dati

Non vanno scritte migration in questo task. Ipotesi di entità da progettare in una milestone dedicata:

- `events`: evento/anno, titolo, slug, città, date, stato, lingua default, configurazioni.
- `event_locations`: luoghi, indirizzi, note operative.
- `event_moments`: momenti del programma, fasce, capienza, luogo, tipo, visibilità.
- `profiles`: profili applicativi collegati a `auth.users`.
- `profile_roles` o `event_user_roles`: ruoli per evento e scope.
- `groups`: gruppi registrati, paese/città, capogruppo principale, metadati.
- `group_memberships`: utenti capogruppo associati ai gruppi.
- `registrations`: iscrizioni partecipante per evento.
- `participants`: anagrafica essenziale e codice identificativo secondario
  breve (`public_code`) per comunicazioni e funzioni operative, mantenendo
  l'UUID come chiave tecnica.
- `participant_contacts`: email, telefono, referente, persone senza email.
- `participant_consents`: privacy, consenso, versione, timestamp, ip/user-agent se legalmente utile.
- `accessibility_needs`: risposte Washington Group e bisogni operativi, con permessi stretti.
- `group_assignment_rules`: regole paese/città per proposta gruppo.
- `participant_group_assignments`: gruppo certo/probabile, fonte, confidence, conferma capogruppo.
- `event_attendance_choices`: presenza evento generale e giorni.
- `moment_attendance_choices`: scelte per momenti/sotto-eventi.
- `qr_tokens`: token opachi, stato, scadenza/revoca.
- `check_ins`: scansioni per evento/momento, luogo, operatore.
- `communications`: campagne o transazionali.
- `communication_recipients`: destinatari effettivi, inclusi referenti per persone senza email.
- `email_templates`, `email_send_logs`, `email_send_log_recipients`.
- `seating_sectors`, `seat_assignments`: settori/sedute/percorsi.
- `audit_logs`: eventi sensibili.
- `countries`, `cities`: liste configurabili con opzione altro e normalizzazione.

RLS particolarmente attenta:

- `registrations`, `participants`, `participant_contacts`.
- `accessibility_needs`.
- `participant_consents`.
- `participant_group_assignments`.
- `check_ins`.
- `communications` e log destinatari.
- `audit_logs`.
- Tabelle ruoli/profili.

Dati sensibili e minimizzazione:

- Dati di disabilità/accessibilità: raccogliere solo quanto serve, visibile solo a chi organizza assistenza o accoglienza se necessario.
- Data di nascita: usare per età/fasce, evitare esposizione in viste non necessarie.
- Email/telefono: visibili solo a ruoli autorizzati.
- Appartenenza o coinvolgimento Sant'Egidio: trattare come dato operativo delicato.
- QR code: non deve contenere nome, email o dati personali in chiaro.
- Retention: definire policy per anonimizzare o cancellare dati post-evento mantenendo statistiche aggregate.

## 7. Milestone operative

### Milestone 0: discovery repository e app modello

- Scopo: mettere in sicurezza il punto di partenza.
- Deliverable: repository Git locale corretta, stato branch chiaro, app modello analizzata in modo più sistematico, note in `AGENTS.md` o `docs/discovery.md`.
- File/cartelle: root progetto, `AGENTS.md`, `docs/*`.
- Migration: nessuna.
- Verifiche: `pwd`, `git status --short`, `git remote -v`, `git branch --show-current`, ispezione non distruttiva app modello.
- Rischi: lavorare in cartella non clonata; copiare pattern troppo specifici.
- Accettazione: repo pronta e documentazione discovery utile.
- Non fare: scaffolding, install, migration, copia codice modello.

### Milestone 1: setup progetto Next.js/TypeScript/Tailwind/Supabase

- Scopo: creare base tecnica minima.
- Deliverable: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, struttura iniziale, env example senza segreti.
- File/cartelle: `app`, `lib`, `components`, `public`, config Next/TS/ESLint/Tailwind.
- Migration: nessuna.
- Verifiche: install, dev server, lint/typecheck/build se disponibili.
- Rischi: introdurre dipendenze non necessarie.
- Accettazione: home tecnica minima avviabile e buildabile.
- Non fare: database reale, auth completa, UI definitiva.

### Milestone 2: qualità e documentazione operativa

- Scopo: fissare guardrail per lavoro incrementale.
- Deliverable: script `lint`, `typecheck`, `test`, `build`; test runner minimo; `AGENTS.md`; docs workflow.
- File/cartelle: `package.json`, config test, `AGENTS.md`, `docs/*`.
- Migration: nessuna.
- Verifiche: script eseguiti localmente.
- Rischi: processi pesanti troppo presto.
- Accettazione: ogni milestone futura ha comandi standard.
- Non fare: logica prodotto.

### Milestone 3: schema database iniziale e RLS

- Scopo: modellare nucleo multi-evento e permessi.
- Deliverable: migration iniziali per eventi, profili/ruoli, gruppi, registrazioni, consensi, QR/check-in base, audit log.
- File/cartelle: `supabase/migrations/*`, `lib/database.types.ts` se generato.
- Migration: si, create table, indici, RLS, helper SQL.
- Verifiche: migration applicata su ambiente concordato, introspezione schema, test RLS manuali/automatizzati.
- Rischi: schema troppo rigido; RLS permissiva.
- Accettazione: schema applicabile da zero e rollback/forward chiaro.
- Non fare: UI completa.

### Milestone 4: Supabase client/server e autenticazione base

- Scopo: collegare app e Supabase in modo sicuro.
- Deliverable: client browser/server/service, callback auth, ruoli, redirect dashboard.
- File/cartelle: `lib/supabase/*`, `lib/auth/*`, `app/auth/callback`, `middleware.ts`.
- Migration: eventuali aggiustamenti profili/ruoli.
- Verifiche: login test per ruoli seed, session handling, redirect.
- Rischi: service role esposto; callback URL non configurati.
- Accettazione: utenti test accedono alla dashboard corretta.
- Non fare: form iscrizione completo.

### Milestone 5: flusso pubblico email-prima e iscrizione iniziale

- Scopo: realizzare il primo workflow partecipante.
- Deliverable: home email, controllo email esistente, primo form iscrizione minimo, consensi versionati, conferma email, creazione QR token.
- File/cartelle: `app/[locale]/page.tsx`, `app/[locale]/registrazione/*`, `lib/registrations/*`, `lib/email/*`, `lib/qrcode/*`.
- Migration: eventuali refine su registrazioni, consensi, QR.
- Verifiche: iscrizione nuova, email esistente magic link, validazioni, rate limit base.
- Rischi: duplicati, consenso non tracciabile, dati sensibili troppo esposti.
- Accettazione: partecipante può iscriversi e ricevere conferma.
- Non fare: questionario definitivo configurabile, dashboard manager completa.

### Milestone 5.5: questionario iscrizione e utenti di test

- Stato: completata lato codice, migration, UI pubblica e deploy production.
  Bootstrap utenti test pronto ma da eseguire con email reali/test scelte
  dall'utente quando serve.
- Scopo: rendere testabile il sistema end-to-end prima delle dashboard complete,
  definendo il questionario reale di iscrizione e creando i primi accessi
  applicativi per admin, manager e partecipante.
- Deliverable questionario:
  - inventario completo e versionato delle domande in
    `lib/questionnaire/registration.ts`;
  - classificazione di ogni domanda per obbligatorietà, dato personale o
    sensibile, visibilità per ruolo e uso strutturato/snapshot;
  - tabella `registration_questionnaire_answers` per snapshot versionato;
  - form pubblico aggiornato con nome, cognome, paese/città di residenza
    abituale, data e luogo di nascita, nazionalità, telefono opzionale,
    accessibilità, partecipazione precedente Sant'Egidio, gruppo condizionale,
    giorni di presenza e privacy;
  - campi paese/città/nazionalità cercabili, con opzione altro dove serve;
  - telefono opzionale con prefisso internazionale, opzione altro e validazione
    formato;
  - domande sì/no rese come pulsanti, non menu a tendina;
  - testi UI semplificati: la UI non cita il Washington Group, anche se la
    logica resta ispirata a standard inclusivi.
- Deliverable bootstrap/test:
  - script o comando operativo per creare/promuovere un utente `admin` e un
    utente `manager` su un evento di test senza esporre service role;
  - seed dati minimi: evento pubblicato, paesi/città essenziali, almeno un
    gruppo e un capogruppo/manager se utile al test;
  - dashboard iniziali non complete per `admin` e `manager`, sufficienti a
    verificare login, ruolo, evento assegnato e link alle sezioni future;
  - dashboard partecipante iniziale collegata all'iscrizione appena creata,
    anche se la dashboard completa resta nella Milestone 6;
  - dati di test tracciati e distinguibili dai dati reali.
- File/cartelle: `app/registrazione/*`, `lib/registrations/*`,
  `lib/questionnaire/*` o equivalente, `lib/admin/*`, `scripts/*`,
  `app/dashboard/admin/*`, `app/dashboard/manager/*`,
  `app/dashboard/partecipante/*`, eventuali seed/migration Supabase.
- Migration: eventuali tabelle per questionario versionato, risposte
  configurabili, seed evento/ruoli/dati test se si decide di versionarli in SQL.
- Verifiche:
  - login magic link funzionante per admin, manager e partecipante;
  - admin entra in `/dashboard/admin`;
  - manager entra in `/dashboard/manager` solo per evento assegnato;
  - partecipante si iscrive, riceve conferma, poi entra nella propria
    dashboard e vede solo i propri dati;
  - dati test creati senza bypassare i flussi ordinari, salvo comandi bootstrap
    esplicitamente server-side/service role;
  - `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Rischi:
  - trasformare troppo presto il questionario in un builder complesso;
  - salvare risposte sensibili in JSON non governato;
  - creare seed/admin con segreti o procedure non ripetibili;
  - confondere dati test e dati reali.
- Accettazione: esiste un evento di test pubblicato, il questionario reale e'
  compilabile, il database si popola con iscrizioni di prova, e tre utenti
  reali o test (`admin`, `manager`, `partecipante`) possono fare login e
  raggiungere la dashboard corretta.
- Non fare: dashboard manager/admin operative complete, export, campagne email,
  gestione capogruppo avanzata, builder questionario general-purpose se non
  strettamente necessario.

### Milestone 5.6: production Vercel, env e magic link

- Stato: completata.
- Scopo: rendere testabile il flusso online fuori dal localhost e assicurare
  che magic link e callback puntino al dominio Vercel production.
- Deliverable:
  - progetto Vercel collegato alla repo;
  - production branch impostata su `main`;
  - env production impostate per Supabase, URL app e SMTP;
  - alias stabile `https://iscrizioni-pace.vercel.app`;
  - allowlist Supabase Auth aggiornata per localhost e domini Vercel;
  - deployment production verificato;
  - generazione magic link verificata senza stampare token.
- Verifiche eseguite:
  - `vercel inspect https://iscrizioni-pace.vercel.app` mostra target
    `production` e stato `Ready`;
  - `curl -I -L https://iscrizioni-pace.vercel.app/` risponde `HTTP 200`;
  - `GOTRUE_URI_ALLOW_LIST` contiene `https://iscrizioni-pace.vercel.app/**`;
  - un magic link generato con Supabase admin usa action host pubblico Supabase
    e redirect a `https://iscrizioni-pace.vercel.app/auth/callback`;
  - il link applicativo costruito con `token_hash` usa lo stesso dominio.
- Note:
  - le variabili secret Vercel restano sensitive/encrypted e possono apparire
    vuote quando lette da CLI/API;
  - le variabili pubbliche URL sono state rese verificabili con `--no-sensitive`;
  - l'arrivo reale delle email dipende ancora dalla validità della password app
    Gmail configurata su SMTP.

### Milestone 6: dashboard partecipante

- Stato: completata il 2026-06-15.
- Scopo: completare il self-service controllato del partecipante dopo il
  bootstrap di Milestone 5.5.
- Deliverable: dashboard con dati personali, QR code, stato iscrizione, modifica campi consentiti, riepilogo risposte questionario.
- File/cartelle: `app/[locale]/dashboard/partecipante/*`, `lib/registrations/*`.
- Migration: eventuale audit log modifiche.
- Verifiche: partecipante vede solo se stesso; modifica rispettando finestre e audit.
- Rischi: accesso a dati altrui.
- Accettazione: RLS e UI impediscono letture/modifiche fuori scope.
- Non fare: gestione capogruppo.

### Milestone 6.1: affinamento dashboard partecipante

- Stato: completata localmente il 2026-06-15, non ancora committata/pushata.
- Scopo: rivedere la struttura della dashboard partecipante dopo il primo
  utilizzo, separando meglio consultazione rapida, iscrizione modificabile e QR.
- Deliverable:
  - header piu' informativo: nome partecipante, evento con città/paese e date
    in forma naturale (`dal ... al ...`), gruppo e referente separati;
  - stato dell'assegnazione gruppo non mostrato al partecipante nella riga
    iniziale, perché e' informazione soprattutto interna;
  - schermata rapida ridotta ad azioni principali e area panel;
  - due pulsanti centrati, simmetrici e con icone stilizzate per aprire QR code
    e iscrizione modificabile;
  - QR code e iscrizione non sono sezioni sempre visibili: si aprono in overlay
    URL-based con `?overlay=qr` e `?overlay=iscrizione`;
  - overlay centrati nel viewport, con chiusura tramite simbolo in alto a
    destra e scroll interno quando necessario;
  - area panel mantenuta come contenuto principale della dashboard rapida, in
    attesa delle funzioni future di iscrizione/scelta momenti.
- File/cartelle: `app/dashboard/partecipante/*`, `lib/registrations/*`.
- Migration: nessuna prevista; usare `event_moments` e
  `moment_attendance_choices` salvo nuovi requisiti sui panel.
- Verifiche: controllo browser desktop/mobile, nessuna sovrapposizione testi,
  overlay centrati, pulsanti simmetrici e righe header senza overflow;
  `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Rischi: nascondere dati che il partecipante deve poter verificare facilmente.
- Accettazione: la prima schermata e' piu' leggibile, QR e dati modificabili
  sono raggiungibili via overlay, i panel restano visibili, i dati modificabili
  restano chiari e controllati.
- Non fare: introdurre una nuova dashboard capogruppo o manager.

### Milestone 7: gruppi e dashboard capogruppo

- Scopo: dare strumenti ai capigruppo.
- Deliverable: elenco partecipanti del gruppo, conferma membro/esterno, note operative, notifiche base.
- File/cartelle: `app/[locale]/dashboard/capogruppo/*`, `lib/groups/*`, `lib/email/*`.
- Migration: group assignments, membership capogruppo, campi conferma.
- Verifiche: capogruppo vede solo gruppi assegnati; manager/admin vedono tutto.
- Rischi: scope gruppo sbagliato.
- Accettazione: casi gruppo singolo/multiplo coperti.
- Non fare: inserimento manuale avanzato se non incluso.

### Milestone 8: inserimento manuale partecipanti da capogruppo

- Scopo: gestire persone senza email o fragili tramite referente.
- Deliverable: form manuale capogruppo, contatto referente, comunicazioni aggregate al capogruppo.
- File/cartelle: `dashboard/capogruppo`, `lib/registrations`, `lib/email`.
- Migration: campi/tabelle contatti delegati e origine registrazione.
- Verifiche: record senza email, niente magic link diretto, audit creazione.
- Rischi: duplicati e responsabilità consenso.
- Accettazione: capogruppo può inserire persone senza rompere flusso partecipante.
- Non fare: assumere consenso senza testo/processo approvato.

### Milestone 9: dashboard manager/admin con tabelle e filtri

- Scopo: gestione operativa completa.
- Deliverable: tabelle partecipanti, ricerca, filtri, sort, edit modal, export base, statistiche iniziali.
- File/cartelle: `dashboard/manager`, `dashboard/admin`, `components/tables`, `lib/reports`.
- Migration: audit export/modifiche; eventuali viste SQL.
- Verifiche: filtri per evento, gruppo, paese, città, stato, accessibilità aggregata, presenza.
- Rischi: dati sensibili visibili in export.
- Accettazione: manager gestisce evento assegnato; visualizzatore non modifica.
- Non fare: funzioni admin globali fuori scope.

### Milestone 10: gestione programma e scelta momenti

- Scopo: modellare programma evento e scelte partecipanti.
- Deliverable: admin/manager gestione momenti, partecipante sceglie giorni/momenti, vincoli base.
- File/cartelle: `lib/events`, `dashboard/admin/events`, `dashboard/partecipante/program`.
- Migration: `event_moments`, attendance choices, capienze se necessarie.
- Verifiche: scelta evento generale e sotto-eventi; edit controllato.
- Rischi: cambio programma dopo iscrizioni.
- Accettazione: programma multi-giorno gestito senza hardcode.
- Non fare: check-in completo.

### Milestone 11: email personalizzate e template

- Scopo: comunicazioni transazionali e campagne.
- Deliverable: template, invio filtrato, preview, log invii, destinatari diretti/delegati.
- File/cartelle: `lib/email`, `dashboard/manager/email`, `dashboard/admin/settings/email`.
- Migration: templates, logs, recipients, settings.
- Verifiche: invio test, filtri destinatari, logging, gestione errori.
- Rischi: invii massivi accidentali; dati personali nel log.
- Accettazione: campagne inviate solo da ruoli autorizzati e tracciate.
- Non fare: invii reali massivi senza ambiente/staging confermato.

### Milestone 12: QR code e check-in accoglienza

- Scopo: supportare ingresso ai luoghi evento.
- Deliverable: QR in dashboard, scanner accoglienza, verifica token, check-in generale/momento, vista dati minimi.
- File/cartelle: `lib/qrcode`, `dashboard/accoglienza`, `api/check-in`.
- Migration: QR tokens, check-ins, eventuali dispositivi/luoghi.
- Verifiche: token valido/revocato/scaduto, idempotenza, permessi accoglienza.
- Rischi: QR con dati personali; overexposure in accoglienza.
- Accettazione: scansione registra check-in e mostra solo informazioni necessarie.
- Non fare: accesso manager completo nella UI accoglienza.

### Milestone 13: settori/sedute e indicazioni operative

- Scopo: guidare accoglienza e flussi nei luoghi.
- Deliverable: gestione settori, assegnazioni, indicazioni percorso, visibilità in check-in.
- File/cartelle: `lib/seating`, `dashboard/manager/seating`, `dashboard/accoglienza`.
- Migration: sectors, assignments, route notes.
- Verifiche: assegnazione manuale/import, vista check-in.
- Rischi: regole fisiche dei luoghi non ancora note.
- Accettazione: partecipante scansionato riceve settore/percorso se assegnato.
- Non fare: algoritmo complesso se non richiesto.

### Milestone 14: multilingua

- Scopo: rendere UI e email almeno IT/EN.
- Deliverable: locale routing o provider, traduzioni IT/EN, email localizzate, fallback.
- File/cartelle: `lib/i18n`, `app/[locale]`, template email.
- Migration: preferenza lingua partecipante/profilo.
- Verifiche: navigazione IT/EN, form, dashboard, email.
- Rischi: testi hardcoded.
- Accettazione: flussi core funzionano in italiano e inglese.
- Non fare: traduzioni automatiche non revisionate per testi legali.

### Milestone 15: privacy, retention e audit

- Scopo: chiudere aspetti legali e sicurezza dati.
- Deliverable: audit log completo, retention policy, export/cancellazione/anonimizzazione post-evento, minimizzazione viste.
- File/cartelle: `lib/audit`, `docs/privacy-retention.md`, admin tools.
- Migration: audit, retention markers, eventuali funzioni SQL.
- Verifiche: azioni sensibili tracciate, dati sensibili esclusi da ruoli non autorizzati.
- Rischi: cancellazioni irreversibili premature.
- Accettazione: policy documentata e strumenti controllati.
- Non fare: cancellare dati reali senza approvazione esplicita.

### Milestone 16: hardening, QA, deploy e documentazione

- Scopo: preparare rilascio affidabile.
- Deliverable: test E2E essenziali, QA responsive/accessibilità, security review, deploy staging/produzione, runbook.
- File/cartelle: test, docs, config deploy, env docs.
- Migration: solo fix finali concordati.
- Verifiche: lint, typecheck, test, build, test auth/RLS, smoke test deploy.
- Rischi: differenze tra locale/staging/produzione.
- Accettazione: rilascio con checklist, rollback e monitoraggio base.
- Non fare: nuove feature non necessarie al go-live.

## 8. Strategia Supabase/Coolify

Nelle milestone successive, usare Supabase CLI solo quando la milestone lo prevede esplicitamente. Prima di operare sul database reale servono URL, chiavi/tokens e conferma dell'ambiente target.

Workflow migration:

- Creare migration versionate nel repository.
- Applicare prima a locale/staging quando possibile.
- Applicare a produzione solo dopo review del diff SQL.
- Dopo ogni migration, verificare schema, indici, RLS e tipi generati.
- Evitare modifiche manuali non replicate in migration.
- Se si rileva drift, documentarlo e creare migration di riconciliazione.

Verifica RLS:

- Testare con utenti reali o JWT simulati per partecipante, capogruppo, manager, viewer, admin e accoglienza.
- Verificare casi negativi: partecipante non vede altri, capogruppo non vede altri gruppi, viewer non modifica, accoglienza vede dati minimi.
- Non considerare validi test fatti solo con service role.

Variabili ambiente e segreti:

- Usare `.env.local` non tracciato e `.env.example` senza valori reali.
- Separare anon key pubblica e service role privata.
- Non scrivere token Coolify/Supabase nei documenti.
- Documentare quali variabili servono per locale, staging e produzione.

Se mancano accessi, chiedere esplicitamente:

- Supabase URL, anon key, service role key o token CLI/management.
- Project ref, se esiste nel self-hosted.
- Credenziali o token Coolify.
- Accesso GitHub e permessi repository.
- Provider email, user/app password o API key.
- Callback URL autorizzati per auth.

## 9. Strategia GitHub e review

Prima milestone tecnica da fare solo dopo aver sistemato Git locale:

- Verificare o clonare la repository corretta.
- Impostare remote `origin` su `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Lavorare su `main`, salvo richiesta esplicita di branch dedicato.
- Usare commit piccoli e tematici solo su richiesta.
- Preparare diff locali per review umana; fare push diretto su `main` quando richiesto.

Regole anti-perdita lavoro:

- Non usare comandi distruttivi come reset hard o checkout di file modificati senza richiesta esplicita.
- Controllare `git status --short` prima e dopo ogni milestone.
- Controllare `git diff` prima della risposta finale.
- Se compaiono modifiche non fatte da Codex, trattarle come lavoro dell'utente e non sovrascriverle.

Review per ogni blocco:

- Sintesi file modificati.
- Verifiche eseguite e non eseguite.
- Rischi residui.
- Domande aperte.
- Nessun segreto o dato personale nei diff.

## 10. Prossimo prompt consigliato

Prompt consigliato per la prossima milestone:

> Procedi con la Milestone 7: gruppi e dashboard capogruppo. Prima verifica
> branch, stato Git, schema attuale e RLS. Implementa una prima dashboard
> capogruppo che mostri solo i partecipanti dei gruppi assegnati, con dati
> minimi, conferma appartenenza/esternalita' e guardrail per non esporre dati
> sensibili fuori scope.
