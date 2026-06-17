# Piano di lavoro

## 1. Premessa e metodo di lavoro

Questo documento e' il piano operativo iniziale per costruire una web app multi-evento per iscrizioni, gruppi, comunicazioni, QR code e check-in. Il lavoro successivo andrà svolto a milestone piccole, una per prompt, con diff brevi e verificabili.

Stato locale rilevato in questo task:

- Cartella corrente: `/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/codex/iscrizioni-pace`.
- La cartella e' ora una working copy Git su branch `main`.
- Remote GitHub configurato: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Milestone 1-6.3 sono state implementate e il codice ordinario lavora su
  `main`.
- Una parte della Milestone 12 e' stata anticipata il 2026-06-15: generazione
  QR reale, invio nella email di conferma e visualizzazione in dashboard. Resta
  da completare scanner/verifica accoglienza.
- Milestone 7 e' completata: preparazione apertura pubblica, guardrail
  env/Vercel e caso utenti con doppio ruolo operativo + iscrizione personale.
- Milestone 8 e' completata localmente: apertura controllata e monitoraggio
  iniziale dalla dashboard admin, con log operativo e audit degli errori email.
- Milestone 9 e' completata localmente: dashboard capogruppo minima per
  verificare assegnazioni probabili, confermare/rifiutare appartenenze,
  aggiungere note interne e far risalire i rifiuti al nodo padre o alla coda
  manager.
- Milestone 9.1 e' completata localmente: link riservati per gruppi nascosti ma
  iscrivibili, con label pubblica separata dal nome operativo, generazione e
  revoca da dashboard manager/capogruppo, token opachi e audit.
- Milestone 10 e' completata localmente: dashboard capogruppo con tabella
  partecipanti del gruppo, inserimento manuale in overlay, link riservati in
  overlay e form pubblico da link gruppo con valori gruppo impliciti.
- Il 2026-06-16 e' stata anticipata una parte della Milestone 11: navigazione
  dashboard a tab fra ruoli, logout globale, modale admin per assegnare anche
  admin/capogruppo e rimozione della card personale ridondante dalle dashboard
  operative.
- La produzione Vercel e' configurata su `main` con alias stabile
  `https://iscrizioni-pace.vercel.app`.
- Priorita' aggiornata il 2026-06-16: l'obiettivo principale ora e' aprire le
  iscrizioni pubbliche il prima possibile con un flusso affidabile, verificabile
  e gestibile operativamente. Le funzioni avanzate di gestione manager,
  programma evento, scanner check-in e settori/sedute vengono dopo il go-live
  delle iscrizioni.

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
- Capogruppo: vede e gestisce i partecipanti del proprio gruppo o nodo territoriale, conferma appartenenza o esternalita', inserisce persone senza email o fragili, riceve notifiche.
- Amministratore: gestisce eventi, configurazioni, utenti, ruoli e dati globali.
- Manager evento: vede e gestisce dati operativi dell'evento specifico, dashboard, tabelle, filtri, export e statistiche.
- Manager visualizzatore: vede le stesse informazioni del manager ma senza modificare iscrizioni.
- Accoglienza/check-in: scansiona QR code, verifica iscrizione generale o a sotto-eventi e vede solo dati operativi minimi.

Regola trasversale sui ruoli operativi:

- I ruoli operativi non sostituiscono mai l'identità da partecipante. Manager,
  manager visualizzatori, capigruppo paese, capigruppo città, capigruppo area
  e capigruppo del singolo gruppo devono poter avere una propria registrazione
  personale allo stesso evento tramite `participants`/`registrations`, collegata
  allo stesso utente Supabase con `participants.auth_user_id`.
- La gerarchia dei capigruppo va rappresentata come permessi su nodi dell'albero
  gruppi, non come nuove identità separate: un referente nazionale ha membership
  sul nodo paese, un referente cittadino sul nodo città, un referente locale sul
  nodo gruppo/area. Lo stesso utente può avere più membership.
- Giorni di presenza, QR personale, dati anagrafici, accessibilità e futura
  iscrizione ai panel vivono sempre sulla registrazione personale, anche quando
  l'utente ha ruoli manageriali o di referente.
- Le dashboard operative devono offrire un passaggio chiaro verso la propria
  area personale tramite la tab `Iscrizione e QR personale`. La vecchia card
  `La mia iscrizione` non va duplicata nelle dashboard operative se la tab e'
  presente.
- La dashboard partecipante deve offrire il passaggio inverso quando lo stesso
  utente ha ruoli operativi: admin, manager, manager_viewer, accoglienza e
  capogruppo non devono restare bloccati nell'area partecipante. La navigazione
  condivisa a tab e' ora il meccanismo previsto.

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
- Quale aggettivo usare nella UI interna per le persone non ancora membri di
  Sant'Egidio, evitando parole respingenti come "esterni" nelle viste
  operative. Nome provvisorio: "nuovi partecipanti".

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
- Gli utenti con ruoli operativi event-scoped, inclusi manager e referenti di
  ogni livello dell'albero gruppi, possono e di norma devono avere anche una
  registrazione personale come partecipanti allo stesso evento. Il ruolo
  applicativo abilita funzioni di gestione; la registrazione personale abilita
  presenza, QR, dati propri e scelta panel.
- Per partecipanti senza email, accesso mediato dal capogruppo/referente; valutare account delegato solo se necessario.

Ruoli e autorizzazioni:

- Ruoli in tabella profili/app memberships, non solo in metadata auth.
- Scope per evento: manager e visualizzatori collegati a uno o più eventi.
- Scope per gruppo: capogruppo collegato a nodi dell'albero gruppi tramite
  membership, inclusi paese, città, area/sottogruppo e gruppo finale.
- Accoglienza con permessi minimi su QR/check-in e dati essenziali.
- RLS come protezione primaria, controlli server come seconda linea.

Gruppi, referenti e persone non ancora membri Sant'Egidio:

- La relazione con un referente e' funzione centrale del prodotto, non solo un
  filtro del form. Ogni iscrizione deve avere un aggancio operativo a un gruppo
  certo o probabile, oppure a un nodo territoriale dei nuovi partecipanti.
- I gruppi vanno modellati come albero multi-evento: paese, città, eventuale
  area/sottogruppo cittadino. L'assegnazione ordinaria si ferma al terzo
  livello, per esempio `Italia > Roma > Roma Torrevecchia`, `Italia > Torino`
  o `Regno Unito`.
- Alcuni paesi possono non avere livello città: se esiste un solo referente
  nazionale, il nodo paese e' direttamente assegnabile.
- I collaboratori nominati da un referente di un gruppo grande non sono un
  quarto livello dell'albero: sono utenti con permessi sullo stesso gruppo o
  su sottoinsiemi operativi assegnati dal referente.
- I gruppi assegnabili devono avere label ricercabili per nome gruppo e nome
  referente principale, per esempio `Giovani per la Pace - referente Stefano
  Orlando`.
- Il matching del form usa paese, città di residenza abituale ed età calcolata
  rispetto alla data dell'evento. Le fasce iniziali sono:
  - fino a 25 anni: proporre gruppi giovani;
  - dai 30 anni: proporre gruppi adulti;
  - da 23 a 30 anni: proporre sia giovani sia adulti, perché la realtà puo'
    sovrapporsi.
- Ogni gruppo assegnabile può essere taggato come `giovani`, `adulti` o
  entrambi/nessuno quando la fascia non e' rilevante.
- Se una persona dichiara di non aver mai partecipato a iniziative o servizi
  Sant'Egidio, viene classificata come nuovo partecipante/non ancora membro,
  ma resta comunque dentro lo stesso albero territoriale per paese e città. La
  distinzione serve per comunicazioni, statistiche e informazioni riservate,
  non deve essere comunicata al partecipante come giudizio o rigetto.
- Anche i nuovi partecipanti devono essere aggregabili per territorio, per
  esempio nuovi partecipanti di Roma o Torino, così manager e referenti possono
  vedere statistiche come membri Sant'Egidio e nuovi partecipanti per città.
- Se una persona dichiara partecipazione Sant'Egidio ma non trova il referente
  o dice di non partecipare con un gruppo, il sistema la assegna al gruppo più
  probabile in base a territorio/età con stato `probable` e source `rule`.
- Il referente riceve notifiche o una coda interna per le nuove assegnazioni
  probabili; può confermare che la persona e' del gruppo, rifiutare perché non
  la conosce o chiedere riassegnazione.
- I referenti di qualunque livello dell'albero sono utenti reali dell'app e, se
  partecipano all'evento, devono completare anche la propria iscrizione
  personale: i loro giorni di presenza e le future scelte panel non vanno
  dedotti dal ruolo o dal gruppo che gestiscono.
- Dopo un rifiuto del referente si risale automaticamente al padre dell'albero
  finché esiste un nodo con referente responsabile. Se anche il livello padre
  non riconosce la persona o non c'e' un responsabile chiaro, l'assegnazione va
  in una coda manager.
- Il partecipante non riceve notifiche di rifiuto o riclassificazione interna.
  Questi passaggi servono solo alla gestione organizzativa.

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

### Milestone 6.2: anticipo QR reale in conferma e dashboard

- Stato: completata localmente il 2026-06-15; migration remota applicata;
  commit/push ancora da fare su richiesta.
- Scopo: anticipare la parte di Milestone 12 che genera e consegna il QR code
  personale al partecipante, senza implementare ancora scanner/check-in.
- Deliverable:
  - dipendenza `qrcode` per generare QR reali;
  - migration `20260615180000_store_retrievable_qr_tokens.sql` con
    `qr_tokens.token_encrypted`;
  - cifratura server-side del token opaco recuperabile con
    `QR_TOKEN_ENCRYPTION_SECRET` consigliato;
  - email di conferma iscrizione con QR code personale allegato/inline;
  - dashboard partecipante con QR reale quando il token cifrato e' disponibile
    e fallback placeholder per iscrizioni precedenti.
- File/cartelle: `lib/qrcode/*`, `lib/email/*`, `lib/registrations/*`,
  `app/dashboard/partecipante/page.tsx`, `supabase/migrations/*`.
- Migration: applicata al Supabase self-hosted con script operativo.
- Verifiche: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
  e verifica browser su overlay QR completate.
- Nota compatibilità: le iscrizioni precedenti alla migration non hanno
  `token_encrypted` e quindi mantengono il placeholder; le nuove iscrizioni
  generano e salvano il token cifrato per mostrare il QR reale.
- Rischi: rotazione o perdita di `QR_TOKEN_ENCRYPTION_SECRET` rende non
  rigenerabili i QR cifrati gia' salvati.
- Accettazione: nuove iscrizioni ricevono QR in email e lo stesso QR puo'
  essere visualizzato in dashboard.
- Non fare: scanner accoglienza, endpoint verifica token, check-in idempotente.

### Milestone 6.3: albero gruppi, matching referente e nuovi partecipanti

- Stato: completata localmente e applicata al Supabase remoto il 2026-06-16.
- Scopo: progettare e implementare la logica che collega ogni iscrizione a un
  referente, a un gruppo probabile o a un nodo territoriale dei nuovi
  partecipanti, prima di costruire la dashboard capogruppo completa.
- Deliverable schema:
  - estendere `groups` o aggiungere tabelle correlate per modellare
    `parent_group_id`, tipo nodo (`country`, `city`, `area`, `newcomers` o
    equivalente), nodo assegnabile/non assegnabile, ordine pubblico e stato
    attivo;
  - distinguere gruppi Sant'Egidio da nodi territoriali dei nuovi partecipanti
    senza esporre questa classificazione al partecipante come etichetta
    respingente;
  - modellare tag fascia (`giovani`, `adulti`, entrambi o nessuno) e regole
    paese/città/età per il matching;
  - supportare referente principale e collaboratori tramite membership utente,
    senza creare un quarto livello dell'albero;
  - aggiungere eventuali campi su `participant_group_assignments` per
    assegnazione corrente, motivazione, nodo da cui si e' risaliti e audit
    minimo, se l'unicità attuale `registration_id, group_id` non basta.
- Deliverable logica applicativa:
  - funzione testabile in `lib/groups/*` per calcolare età alla data evento;
  - funzione testabile per trovare candidati in base a paese, città e fascia
    età, con sovrapposizione 23-30 anni;
  - funzione di fallback che assegna al nodo più vicino disponibile: area se
    riconoscibile, altrimenti città, altrimenti paese;
  - opzione form "Non trovo il mio referente" che crea assegnazione `probable`
    da regola invece di bloccare l'iscrizione;
  - per chi risponde "No" alla partecipazione precedente Sant'Egidio,
    assegnazione al ramo territoriale dei nuovi partecipanti per paese/città;
  - per chi risponde "Sì" ma non partecipa con gruppo o non trova il gruppo,
    assegnazione probabile a gruppo/referente più vicino.
- Deliverable UI pubblica:
  - lista gruppi filtrata e ricercabile solo tra candidati affini;
  - label con nome gruppo e referente principale;
  - nessuna esposizione al partecipante di stati interni come
    `probable/rejected` o "esterno".
- File/cartelle: `supabase/migrations/*`, `lib/groups/*`,
  `lib/registrations/*`, `app/registrazione/*`, `tests/*`,
  `docs/registration-questionnaire.md`, `AGENTS.md`.
- Migration: sì, con diff SQL revisionabile e RLS aggiornata per non esporre
  più del necessario nel catalogo pubblico dei gruppi.
- Verifiche:
  - test unitari su matching paese/città/età;
  - casi Austria senza città, Italia con città, Roma con aree, fascia 23-30;
  - iscrizione nuovo partecipante assegnata a nodo territoriale corretto;
  - iscrizione Sant'Egidio senza referente scelto assegnata come `probable`;
  - `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Rischi:
  - mostrare troppi gruppi nel form e confondere il partecipante;
  - esporre implicitamente informazioni interne sui gruppi;
  - rendere rigida una realtà organizzativa che deve restare modificabile dai
    manager.
- Accettazione: ogni nuova iscrizione ha un aggancio operativo coerente e
  verificabile, scelto dal partecipante o calcolato dal sistema, senza
  comunicare classificazioni interne al partecipante.
- Non fare: dashboard capogruppo completa, notifiche email definitive,
  riassegnazione manuale manager avanzata.

Esito:

- Migration `20260616103000_group_tree_matching.sql` applicata al Supabase
  remoto e registrata.
- Migration `20260616110000_backfill_group_tree_test_seed.sql` applicata per
  riallineare il seed dei nodi test dopo la correzione del backfill.
- Verificati sul DB remoto: 10 nodi seed 6.3, 5 nodi pubblici assegnabili, 3
  nodi `newcomers`, 6 regole di matching.
- Implementato `lib/groups/matching.ts` con calcolo età alla data evento,
  sovrapposizione 23-30, matching territoriale e fallback.
- Il form pubblico ora mostra un campo unico autocomplete "Gruppo o referente",
  ricercabile sia per nome gruppo sia per referente, e mantiene l'opzione "Non
  trovo il mio referente".
- Durante i test locali sono stati aggiunti due affinamenti UX:
  - dopo errore di validazione il form conserva i dati già inseriti nella
    sessione browser e porta il focus sul campo da correggere;
  - la pagina di conferma iscrizione ha un pulsante per tornare alla home e
    fare il primo accesso, con email precompilata.
- Verifiche eseguite: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, più verifica browser locale del campo gruppo/referente e
  della CTA in conferma.

### Roadmap aggiornata dopo Milestone 6.3

La sequenza sotto sostituisce l'ordine precedente. Il criterio e':

- prima rendere affidabile il flusso pubblico di iscrizione;
- poi aprire le iscrizioni con strumenti minimi di controllo e supporto;
- solo dopo sviluppare dashboard manager/evento avanzate, programma, campagne,
  scanner accoglienza e settori.

### Milestone 7: preparazione apertura pubblica iscrizioni

- Scopo: trasformare l'app gia' funzionante in un servizio pronto per ricevere
  iscrizioni reali dal pubblico, includendo anche utenti con ruoli operativi
  che devono compilare la propria iscrizione personale.
- Deliverable:
  - evento reale configurato o evento pilota ripulito dai dati di test;
  - testi definitivi per privacy, consenso, email di conferma e magic link;
  - dati iniziali reali o semi-reali per paesi, città, gruppi, referenti e
    nodo territoriale dei nuovi partecipanti;
  - regola operativa documentata e verificata per cui manager, manager viewer e
    referenti/capigruppo di paese, città, area o gruppo possono accedere alla
    propria dashboard partecipante e completare i propri dati personali;
  - seed o procedura operativa per collegare ogni utente con ruolo operativo
    alla propria registrazione personale quando partecipa all'evento;
  - flusso pubblico verificato in produzione: email nuova, email esistente,
    conferma iscrizione, QR in email, accesso dashboard partecipante;
  - verifica del caso "utente con doppio cappello": accesso alla dashboard
    operativa e accesso alla dashboard partecipante con la stessa email;
  - verifica env Vercel production/development/preview, inclusi
    `QR_TOKEN_ENCRYPTION_SECRET`, SMTP e URL pubblici;
  - comando operativo `npm run opening:verify` per controllare env production
    senza stampare segreti;
  - `.vercelignore` presente con esclusione di `.env` e `.env.*` se mancante;
  - checklist operativa di apertura in `docs/` o `AGENTS.md`.
- File/cartelle: `app/page.tsx`, `app/registrazione/*`, `lib/email/*`,
  `lib/registrations/*`, `.env.example`, `.vercelignore`, `docs/*`,
  eventuali seed/migration Supabase.
- Migration: solo se necessaria per dati/configurazioni indispensabili
  all'apertura; evitare schema avanzato non richiesto dal go-live.
- Verifiche:
  - `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`;
  - test browser desktop/mobile del flusso iscrizione e dashboard;
  - test manuale con almeno un manager/referente già autenticato che completa o
    consulta la propria iscrizione partecipante;
  - smoke test production su `https://iscrizioni-pace.vercel.app`;
  - verifica che nessun dato test appaia nel flusso pubblico reale;
  - verifica manuale di email consegnata e link funzionante.
- Rischi:
  - aprire con testi privacy non definitivi;
  - lasciare dati seed visibili;
  - email SMTP non stabile o rate limit Gmail;
  - link magic/callback incoerenti tra Supabase e Vercel.
- Accettazione: una persona reale puo' iscriversi da produzione, ricevere la
  conferma, accedere alla dashboard e trovare i propri dati corretti; un utente
  con ruolo operativo puo' gestire il proprio scope e anche la propria
  iscrizione personale; lo staff ha una checklist chiara per aprire o
  richiudere le iscrizioni.
- Non fare: dashboard manager completa, gestione programma, campagne email,
  scanner accoglienza, settori/sedute.

### Milestone 8: apertura controllata e monitoraggio iniziale

- Scopo: aprire le iscrizioni a un gruppo ristretto o al pubblico con strumenti
  minimi per osservare e correggere rapidamente problemi reali.
- Stato: completata localmente il 2026-06-16.
- Deliverable completati:
  - procedura per apertura/chiusura iscrizioni tramite stato evento e date in
    `docs/opening-monitoring-log.md`;
  - dashboard admin con comandi auditati `Apri ora`, `Pausa`, `Nascondi`;
  - conteggi minimi per iscrizioni, ultime 24 ore, gruppo probabile, supporto,
    QR mancanti, email fallite e email duplicate;
  - audit degli errori email `email.magic_link_failed` e
    `email.registration_confirmation_failed`, senza salvare indirizzi email
    completi nel metadata;
  - helper testabili in `lib/registrations/opening-monitoring.ts`;
  - rientro role-aware dalla dashboard partecipante alle aree operative
    disponibili, a partire dall'area admin.
- Ancora fuori scope:
  - gestione manuale completa di duplicati o iscrizioni errate;
  - dashboard manager/admin completa con tabelle e modifica dati;
  - smoke production finale con credenziali reali prima dell'apertura.
- File/cartelle: `app/dashboard/admin/*`, `lib/registrations/*`,
  `lib/email/*`, `docs/*`, `app/dashboard/partecipante/*`, eventuali script
  operativi.
- Migration: solo per campi strettamente necessari a monitoraggio/supporto.
- Verifiche:
  - iscrizioni aperte/chiuse rispettano configurazione evento;
  - staff vede conteggi minimi senza esporre dati sensibili in eccesso;
  - casi errore principali hanno UI comprensibile;
  - test standard e smoke production.
- Rischi:
  - correggere dati reali senza audit;
  - affidarsi troppo a query manuali;
  - perdere visibilità su errori email.
- Accettazione: l'organizzazione può aprire le iscrizioni e seguire i primi
  casi reali senza dover avere ancora tutta la suite manager.
- Non fare: export avanzati, statistiche complete, campagne massive.

### Milestone 9: dashboard capogruppo minima

- Scopo: dare ai referenti gli strumenti essenziali per controllare le
  assegnazioni prodotte dalla Milestone 6.3 dopo l'apertura pubblica.
- Deliverable:
  - elenco partecipanti dei gruppi assegnati al capogruppo, con filtro per
    confermati, probabili e nuovi da verificare;
  - accesso evidente a "La mia iscrizione" per il referente stesso, con avviso
    se non ha ancora completato la propria registrazione personale all'evento;
  - azioni minime per confermare appartenenza, rifiutare perché non
    riconosciuto e aggiungere nota operativa interna;
  - risalita automatica al nodo padre dopo rifiuto: area -> città -> paese ->
    coda manager, senza notifica al partecipante;
  - badge o conteggio interno per assegnazioni da verificare;
  - audit log delle decisioni del referente senza duplicare contenuti
    sensibili.
- File/cartelle: `app/dashboard/capogruppo/*`, `lib/groups/*`, `lib/email/*`.
- Migration: eventuali stati/colonne per escalation, decisione referente,
  note interne e notifica letta/non letta, se non gia' coperti da Milestone 6.3.
- Verifiche:
  - capogruppo vede solo gruppi assegnati;
  - manager/admin vedono tutto solo dove previsto;
  - rifiuto risale al padre corretto;
  - nessuna email o notifica va al partecipante per rifiuti o
    riclassificazioni interne.
- Rischi: scope gruppo sbagliato, esposizione di dati sensibili non necessari.
- Accettazione: le assegnazioni probabili possono essere confermate, rifiutate
  o passare al livello superiore in modo tracciabile.
- Non fare: inserimento manuale avanzato se non indispensabile.

### Milestone 9.1: link riservati per gruppi nascosti

- Scopo: consentire iscrizioni a gruppi delicati o ambigui senza mostrarli nel
  menu pubblico dei gruppi, tramite link generati da manager o dal capogruppo
  del relativo scope.
- Deliverable:
  - `groups.public_label` per separare label partecipante e nome operativo
    interno;
  - tabella `group_registration_links` con token hash, label pubblica,
    etichetta interna, revoca, scadenza/limite usi opzionali e conteggio usi;
  - helper server-side per token opachi, URL e stato link;
  - form pubblico con supporto a `/registrazione?groupLink=<token>`, label
    discreta "Gruppo indicato dal referente" e assegnazione al gruppo anche se
    nascosto nel catalogo;
  - validazione server-side che impedisce di usare UUID di gruppi nascosti
    senza token link valido;
  - dashboard manager con generazione/revoca link per gruppi iscrivibili degli
    eventi gestibili;
  - dashboard capogruppo con generazione/revoca link solo per gruppi nel
    proprio scope discendente;
  - audit per creazione, revoca e uso del link, senza token in chiaro.
- File/cartelle:
  `supabase/migrations/20260617130000_group_registration_links.sql`,
  `lib/groups/registration-links.ts`, `lib/registrations/public-flow.ts`,
  `app/registrazione/*`, `app/dashboard/manager/page.tsx`,
  `app/dashboard/capogruppo/page.tsx`.
- Verifiche:
  - `npm run lint`;
  - `npm run typecheck`;
  - `npm test`;
  - `npm run build`.
- Decisioni:
  - `is_assignable = true` e `is_public_catalog = false` significa gruppo
    nascosto ma iscrivibile solo da link riservato o gestione operativa;
  - il token non contiene dati personali o ID gruppo e in database resta solo
    l'hash;
  - il link completo e' mostrato solo subito dopo la generazione;
  - il link riservato non forza le risposte personali del questionario, ma
    assegna operativamente il gruppo invitante;
  - le iscrizioni da link usano `assignment_reason = 'group_registration_link'`
    e restano `probable` finché il referente/manager non le conferma.
- Accettazione: un manager può creare un link per un gruppo nascosto, un
  capogruppo può farlo solo per il proprio scope, e un partecipante con quel
  link viene assegnato al gruppo senza vedere il gruppo nel menu pubblico
  ordinario.

### Milestone 10: inserimento manuale partecipanti da capogruppo

**Stato:** completata localmente il 2026-06-17.

- Scopo: gestire persone senza email o fragili tramite referente dopo che il
  flusso pubblico principale e' aperto.
- Deliverable realizzati:
  - tabella "Partecipanti del gruppo" nella dashboard capogruppo, con ricerca,
    filtro stato, ordinamento e azioni operative per note/conferma/rifiuto;
  - inserimento manuale capogruppo in overlay contestuale al gruppo;
  - link iscrizione gruppo in overlay contestuale, con microcopy pubblico/interno
    chiarito;
  - origine registrazione tracciata con `registrations.source = 'capogruppo'`
    per inserimento manuale e `group_registration_link` per link riservati;
  - consenso dichiarato dal capogruppo nel form manuale;
  - QR reale, audit e snapshot questionario minimale per inserimento manuale;
  - form pubblico da `?groupLink=...` semplificato: gruppo implicito, niente
    domande ridondanti su partecipazione precedente/gruppo, fallback a
    `/registrazione` se il link non è del gruppo corretto.
- File/cartelle: `app/dashboard/capogruppo/*`, `lib/registrations/*`,
  `app/registrazione/registration-form.tsx`, `app/actions.ts`.
- Migration: non necessaria per questa milestone; sono stati riusati schema
  esistente, campi `source`, `created_by`, audit, QR e link riservati della
  Milestone 9.1.
- Verifiche eseguite: record senza email, record da link riservato, niente magic
  link diretto per inserimento manuale, audit creazione, scope capogruppo,
  `npm run lint`, `npm run typecheck`, `npm test`, browser integrato su
  localhost.
- Rischi residui: duplicati senza email da gestire operativamente, pulizia
  placeholder di test, responsabilità consenso da formalizzare nei testi
  definitivi.
- Accettazione: capogruppo può inserire persone e generare link di gruppo senza
  rompere il flusso partecipante e senza esporre sezioni operative permanenti
  nella dashboard.
- Non fatto / rimandato: campagne massive, gestione manager completa, modifica
  completa iscrizione da dashboard capogruppo, assegnazione a servizi o
  sottogruppi.

### Milestone 11: dashboard manager/admin essenziale

- Scopo: fornire una console operativa sufficiente per seguire iscrizioni reali
  prima delle funzioni evento avanzate, includendo la gestione amministrativa
  di ruoli, utenti e struttura gruppi.
- Stato: parzialmente anticipata localmente il 2026-06-16.
- Deliverable anticipati:
  - navigazione condivisa a tab fra `Dashboard admin`, `Dashboard manager`,
    `Dashboard accoglienza`, `Dashboard capogruppo` e
    `Iscrizione e QR personale`;
  - admin abilitato a vedere tutte le dashboard operative tramite tab;
  - rimozione della card `Iscrizione personale collegata` dalle dashboard
    operative, perché sostituita dalla tab personale;
  - header globale con logout `Esci` e icona;
  - descrizioni dashboard in formato "In questa area puoi...", senza ripetere
    l'email dell'utente;
  - modale admin per modificare gruppo e ruolo operativo di un iscritto,
    includendo `Admin`, `Capogruppo` e `Nessun ruolo operativo`;
  - `Admin` scritto come ruolo globale in `event_user_roles`;
  - `Capogruppo` scritto in `group_memberships` sul gruppo selezionato.
- Ancora da completare:
  - tabella manager/admin completa con ricerca e filtri avanzati;
  - creazione/modifica strutturata di eventi, gruppi e nodi dell'albero;
  - export CSV controllato;
  - gestione duplicati e casi bloccanti più completa;
  - distinzione completa dei permessi read-only per `manager_viewer`.
- Deliverable:
  - tabella partecipanti per evento con ricerca e filtri essenziali;
  - dettagli iscrizione con modifica controllata dei campi operativi;
  - coda manager per assegnazioni non riconosciute dopo risalita;
  - area admin per creare/modificare eventi, gruppi e nodi dell'albero gruppi:
    paese, città, area/sottogruppo e gruppo finale;
  - area admin per invitare o promuovere utenti operativi e assegnare ruoli:
    `manager`, `manager_viewer`, `accoglienza` e referenti/capigruppo su
    qualunque nodo dell'albero;
  - assegnazione capogruppo tramite `group_memberships`, non creando ruoli
    database separati per capogruppo paese/città/area/gruppo;
  - vista admin per vedere utenti con doppio cappello e stato della loro
    iscrizione personale all'evento;
  - export CSV base con colonne minimizzate e controllate;
  - statistiche iniziali per totale iscrizioni, paese/città, gruppo, giorni di
    presenza, membri Sant'Egidio e nuovi partecipanti;
  - permessi distinti per `manager` e `manager_viewer`.
- File/cartelle: `app/dashboard/manager/*`, `app/dashboard/admin/*`,
  `components/tables/*`, `lib/reports/*`, `lib/groups/*`.
- Migration: audit export/modifiche; eventuali viste SQL solo se semplificano
  permessi e performance.
- Verifiche:
  - admin può creare evento, gruppo/nodo e assegnare un referente al nodo;
  - admin può creare o promuovere manager, viewer, accoglienza e capigruppo;
  - capogruppo paese/città/area/gruppo vede solo lo scope assegnato;
  - filtri per evento, gruppo, paese, città, stato, classificazione
    membro/nuovo partecipante, accessibilità aggregata e presenza;
  - viewer non modifica;
  - export non include dati sensibili non necessari;
  - test standard e verifica browser.
- Rischi: dati sensibili visibili in export o in tabelle troppo larghe.
- Accettazione: admin configura evento, utenti, ruoli e albero gruppi; manager
  gestisce l'evento assegnato e può risolvere i casi che bloccano il normale
  andamento delle iscrizioni.
- Non fare: gestione programma completa, campagne email, check-in.

### Milestone 12: multilingua minima e testi localizzati

- Scopo: portare i flussi pubblici e le email almeno a italiano/inglese, senza
  bloccare l'apertura se il primo go-live e' deliberatamente solo italiano.
- Deliverable:
  - strategia i18n leggera coerente con l'app esistente;
  - traduzioni IT/EN per home, registrazione, conferma, login, dashboard
    partecipante ed email transazionali;
  - fallback controllato per testi mancanti;
  - preferenza lingua salvata o rispettata dove gia' presente.
- File/cartelle: `lib/i18n/*`, `app/*`, `lib/email/*`, template email.
- Migration: solo se serve salvare o normalizzare la preferenza lingua.
- Verifiche: flusso pubblico e dashboard partecipante in IT/EN, email
  localizzate, nessun testo legale tradotto automaticamente senza revisione.
- Rischi: testi hardcoded e traduzioni legali non approvate.
- Accettazione: i flussi core funzionano in italiano e inglese con testi
  revisionabili.
- Non fare: localizzare dashboard manager avanzate se non ancora stabili.

### Milestone 13: email personalizzate e template operativi

- Scopo: passare dalle sole email transazionali a comunicazioni controllate per
  gruppi o segmenti, dopo l'apertura pubblica.
- Deliverable:
  - template versionati;
  - invio filtrato con preview;
  - log invii e destinatari diretti/delegati;
  - invio test;
  - limiti anti-invio accidentale.
- File/cartelle: `lib/email/*`, `app/dashboard/manager/email/*`,
  `app/dashboard/admin/settings/email/*`.
- Migration: templates, logs, recipients, settings se non gia' coperti.
- Verifiche: invio test, filtri destinatari, logging, gestione errori.
- Rischi: invii massivi accidentali; dati personali nel log.
- Accettazione: campagne inviate solo da ruoli autorizzati e tracciate.
- Non fare: invii reali massivi senza conferma esplicita e ambiente verificato.

### Milestone 13.4: revisione guidata UX, navigazione e dati dashboard

- Scopo: prima della rifinitura estetica finale, rivedere insieme tutta
  l'esperienza dell'app in localhost, in prima persona, usando dati e permessi
  ormai coerenti con l'architettura database definitiva. L'obiettivo e'
  trasformare le funzioni implementate in percorsi chiari, ordinati e
  comprensibili per l'utente finale, così che i manuali possano essere scritti
  su una struttura front end già stabile e non caotica.
- Metodo:
  - avviare `npm run dev` e lavorare su `localhost`;
  - usare utenti test/seed realistici per admin, manager, manager_viewer,
    capogruppo, accoglienza e partecipante;
  - rivedere una sezione alla volta, senza passare alla successiva finché la
    sezione corrente non e' chiara e approvata;
  - usare commenti puntuali, screenshot o riferimenti precisi a schermate,
    componenti e flussi per capirsi rapidamente su cosa cambiare;
  - trasformare i commenti approvati in piccole patch mirate, verificabili e
    non in refactor generici;
  - aggiornare progressivamente una checklist di revisione, così da sapere
    quali aree sono state viste, approvate o rimandate.
- Sottosezioni da affrontare una per una:
  - home pubblica email-prima: chiarezza del primo accesso, errori, stato
    iscrizioni aperte/chiuse, CTA e testi;
  - form pubblico di registrazione: ordine delle domande, comprensione di
    paese/città, gruppo/referente, link riservati gruppo, accessibilità,
    presenze e privacy;
  - conferma iscrizione e primo accesso: email, CTA verso magic link, messaggi
    successivi all'invio e aspettative del partecipante;
  - login/callback/errori: stati di sessione, link scaduti, redirect al ruolo
    corretto e messaggi non tecnici;
  - dashboard partecipante: header, evento, gruppo, panel, overlay QR,
    modifica iscrizione, ritorno alle aree operative per utenti con doppio
    ruolo;
  - dashboard capogruppo: assegnazioni da verificare, filtri, note interne,
    conferma/rifiuto, risalita al padre, link riservati gruppo e assenza di
    dati sensibili inutili;
  - dashboard manager: apertura evento, monitoraggio, tabella iscritti,
    gestione gruppi/ruoli, link riservati, filtri, coda dei casi bloccanti e
    differenza manager/manager_viewer;
  - dashboard admin: configurazione evento, ruoli, gruppi, albero, utenti con
    doppio ruolo, comandi delicati e audit;
  - dashboard accoglienza: dati minimi, QR/check-in quando completato,
    messaggi di esito e limiti di visibilità;
  - navigazione globale: tab fra ruoli, logout, ritorno all'area personale,
    coerenza mobile/desktop e assenza di vicoli ciechi;
  - visualizzazione dati sensibili: accessibilità, contatti, appartenenza a
    gruppi delicati, export, audit e minimizzazione;
  - stati vuoti/errori/loading: cosa vede ogni ruolo quando non ci sono dati,
    quando un link e' scaduto, quando una action fallisce o quando manca un
    permesso;
  - testi operativi e microcopy: nomi delle sezioni, verbi dei pulsanti,
    messaggi di conferma, tono verso partecipanti fragili e gruppi delicati;
  - preparazione manuali: estrarre dai flussi approvati la struttura dei manuali
    manager, capogruppo, accoglienza e admin.
- Deliverable:
  - checklist di revisione UX/funzionale con stato per ogni sezione;
  - patch mirate su navigazione, layout informativo, testi, ordinamento dati,
    stati vuoti e permessi visibili;
  - decisioni documentate su cosa ogni ruolo deve vedere, modificare o non
    vedere;
  - elenco stabile dei flussi da trasformare nei manuali operativi;
  - eventuali issue/annotazioni residue separate dalla rifinitura estetica
    finale.
- File/cartelle: `app/*`, `components/*`, `lib/auth/*`, `lib/groups/*`,
  `lib/registrations/*`, eventuali documenti in `docs/*`.
- Migration: solo se durante la revisione emerge che una funzione promessa non
  può essere rappresentata correttamente con lo schema già esistente. In quel
  caso la migration va trattata come correzione funzionale, non come styling.
- Verifiche:
  - sessioni localhost per ogni ruolo reale o test;
  - controlli mobile e desktop delle pagine approvate;
  - lint, typecheck, test e build dopo ogni blocco significativo;
  - nessuna schermata approvata deve dipendere da dati manuali non seedati o da
    query fuori applicazione.
- Rischi:
  - confondere revisione funzionale con rifinitura estetica;
  - riscrivere layout senza aver deciso prima cosa serve all'utente;
  - lasciare dashboard tecnicamente complete ma poco comprensibili;
  - scrivere manuali su flussi ancora instabili.
- Accettazione: tutte le sezioni principali sono state viste in localhost,
  commentate, corrette e approvate una per una; la navigazione fra ruoli e la
  visualizzazione dei dati sono coerenti con permessi, obiettivi e sensibilità
  del progetto; i manuali possono essere scritti partendo da flussi stabili.
- Non fare: rifinitura visuale finale, cambio palette/guideline estetiche,
  animazioni, campagne email reali o funzioni nuove non necessarie alla
  coerenza dei flussi.

### Milestone 13.5: rifinitura estetica e manuali operativi

- Scopo: dedicare una milestone separata solo alla cura finale dell'esperienza
  visiva e alla documentazione d'uso, partendo dai flussi approvati nella
  Milestone 13.4 e senza introdurre nuove funzioni di prodotto.
- Deliverable estetica:
  - applicazione delle guideline estetiche che verranno fornite;
  - revisione coerente di layout, spaziature, tipografia, colori, stati
    interattivi, overlay, tabelle, form e dashboard;
  - pulizia dei testi visibili dove serve per chiarezza, tono e coerenza;
  - controllo responsive su mobile e desktop per home, registrazione,
    dashboard partecipante, manager, capogruppo, admin e accoglienza.
- Deliverable manuali:
  - manuale utilizzo manager con flussi principali: monitoraggio iscrizioni,
    gestione gruppi, modifica iscritti, ruoli consentiti, comunicazioni e casi
    da controllare;
  - manuale utilizzo capogruppi con flussi principali: lettura assegnazioni,
    conferma/rifiuto partecipanti, note interne, inserimento persone senza
    email e limiti di visibilità;
  - eventuali screenshot o immagini solo se utili e non contenenti dati
    personali reali.
- File/cartelle: `app/*`, componenti UI condivisi, `app/globals.css`,
  eventuali `components/*`, `docs/manuale-manager.md`,
  `docs/manuale-capogruppo.md` o nomi equivalenti.
- Migration: nessuna, salvo piccoli supporti solo se le guideline richiedono
  preferenze persistenti gia' previste.
- Verifiche: lint/typecheck/test/build, verifica browser delle viste principali
  su desktop e mobile, controllo che non siano stati introdotti testi o layout
  incoerenti con i ruoli.
- Rischi: fare refactor funzionali mascherati da estetica; introdurre testi
  manuali non allineati ai permessi reali; usare dati personali reali negli
  screenshot.
- Accettazione: il sito appare coerente con le guideline fornite, le viste core
  sono verificate su mobile/desktop e manager/capogruppi hanno manuali pratici
  per usare l'app senza assistenza tecnica.
- Non fare: nuove funzioni prodotto, cambi schema dati, campagne reali,
  revisione legale dei testi privacy.

### Milestone 14: gestione programma e scelta momenti

- Scopo: sviluppare le funzioni evento avanzate dopo che le iscrizioni sono
  aperte e stabili.
- Deliverable:
  - admin/manager gestione momenti;
  - partecipante sceglie giorni/momenti o panel;
  - vincoli base e capienze se necessarie;
  - integrazione con dashboard partecipante nell'area panel gia' prevista.
- File/cartelle: `lib/events/*`, `app/dashboard/admin/events/*`,
  `app/dashboard/manager/events/*`, `app/dashboard/partecipante/*`.
- Migration: `event_moments`, attendance choices, capienze se necessarie.
- Verifiche: scelta evento generale e sotto-eventi; edit controllato; cambio
  programma dopo iscrizioni.
- Rischi: cambiare programma dopo che molte persone hanno gia' scelto.
- Accettazione: programma multi-giorno gestito senza hardcode.
- Non fare: check-in completo.

### Milestone 15: QR code, verifica e check-in accoglienza

- Scopo: completare la parte rimandata della vecchia Milestone 12, usando il QR
  reale gia' anticipato in Milestone 6.2.
- Deliverable:
  - scanner accoglienza;
  - endpoint/verifica token opaco;
  - check-in generale e, se disponibile, check-in momento;
  - vista accoglienza con dati minimi;
  - idempotenza e audit log.
- File/cartelle: `lib/qrcode/*`, `app/dashboard/accoglienza/*`,
  `app/api/check-in/*` o server actions equivalenti.
- Migration: eventuali dispositivi, luoghi o dettagli check-in non gia' coperti.
- Verifiche: token valido/revocato/scaduto, idempotenza, permessi accoglienza,
  nessun dato personale nel QR.
- Rischi: overexposure in accoglienza; uso del QR come identificativo troppo
  ricco; check-in duplicati.
- Accettazione: scansione registra check-in e mostra solo informazioni
  necessarie.
- Non fare: accesso manager completo nella UI accoglienza.

### Milestone 16: settori/sedute e indicazioni operative

- Scopo: completare la vecchia Milestone 13 solo quando luoghi e flussi fisici
  dell'evento sono abbastanza chiari.
- Deliverable:
  - gestione settori;
  - assegnazioni manuali o import;
  - indicazioni percorso;
  - visibilità in check-in e, se utile, dashboard partecipante.
- File/cartelle: `lib/seating/*`, `app/dashboard/manager/seating/*`,
  `app/dashboard/accoglienza/*`.
- Migration: sectors, assignments, route notes.
- Verifiche: assegnazione manuale/import, vista check-in, nessuna indicazione
  incoerente se settore mancante.
- Rischi: modellare troppo presto regole fisiche ancora non note.
- Accettazione: partecipante scansionato riceve settore/percorso se assegnato.
- Non fare: algoritmo complesso se non richiesto.

### Milestone 17: privacy, retention e audit avanzato

- Scopo: completare gli aspetti legali e di sicurezza dati oltre il minimo gia'
  necessario per l'apertura pubblica.
- Deliverable:
  - audit log completo per azioni sensibili;
  - retention policy post-evento;
  - export/cancellazione/anonimizzazione controllati;
  - revisione minimizzazione viste per ogni ruolo;
  - documento `docs/privacy-retention.md`.
- File/cartelle: `lib/audit/*`, `docs/privacy-retention.md`, admin tools.
- Migration: audit, retention markers, eventuali funzioni SQL.
- Verifiche: azioni sensibili tracciate, dati sensibili esclusi da ruoli non
  autorizzati.
- Rischi: cancellazioni irreversibili premature.
- Accettazione: policy documentata e strumenti controllati.
- Non fare: cancellare dati reali senza approvazione esplicita.

### Milestone 18: hardening finale, QA e runbook

- Scopo: consolidare l'app prima dell'uso intensivo vicino all'evento, dopo che
  i flussi principali e avanzati sono stati costruiti.
- Deliverable:
  - test E2E essenziali;
  - QA responsive/accessibilità;
  - security review;
  - deploy production verificato;
  - runbook operativo e rollback;
  - verifica RLS con utenti reali per partecipante, capogruppo, manager,
    manager_viewer, admin e accoglienza.
- File/cartelle: test, docs, config deploy, env docs.
- Migration: solo fix finali concordati.
- Verifiche: lint, typecheck, test, build, test auth/RLS, smoke test deploy.
- Rischi: differenze tra locale/staging/produzione.
- Accettazione: rilascio con checklist, rollback e monitoraggio base.
- Non fare: nuove feature non necessarie al go-live o all'evento imminente.

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

> Applica e verifica la migration dei link riservati gruppi sul Supabase remoto,
> poi implementa la Milestone 10: inserimento manuale/delegato di partecipanti
> da parte del capogruppo per persone senza email o fragili, riusando lo scope
> dell'albero gruppi, auditando l'origine e senza inviare magic link diretto al
> partecipante. Prima di chiudere esegui lint, typecheck, test e build.
