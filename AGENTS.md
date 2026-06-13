# AGENTS.md

Questo file e' la memoria operativa stabile per Codex e per futuri agenti che lavoreranno su questa app. Deve restare aggiornato quando cambiano architettura, workflow, comandi, schema dati, ruoli, policy RLS o decisioni importanti.

Quando lo sviluppo principale sara' concluso, `PIANO_DI_LAVORO.md` potra' essere cancellato. A quel punto questo file dovra' contenere tutto il contesto necessario per implementare funzioni accessorie, correggere bug e fare manutenzione senza dover ricostruire la storia del progetto.

## Stato del progetto

- Nome progetto/repository prevista: `iscrizioni-pace`.
- Repository GitHub prevista: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Cartella locale:
  `/Users/giovaniperlapace/Library/CloudStorage/OneDrive-ComunitàdiSant'Egidio/codex/iscrizioni-pace`.
- Milestone 1 ha inizializzato questa cartella come repository Git locale.
- Branch corrente creato per il setup: `milestone/01-setup`.
- Remote `origin` non configurato automaticamente.
- Nessun commit o push eseguito.

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

Note:

- `.env.local` resta non tracciato.
- `.env.example` contiene solo placeholder e URL pubblico previsto, senza segreti.
- Non sono state create migration e non e' stato collegato alcun database reale.

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

L'app gestisce iscrizioni a eventi internazionali annuali della Comunita' di Sant'Egidio in citta' diverse. Deve essere multi-evento e multi-anno, per esempio Assisi 2026 o Roma 2025.

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
- `manager`: collegato a uno specifico evento; vede tutti i partecipanti e gruppi dell'evento; puo' modificare dati operativi secondo permessi.
- `manager_viewer`: vede cio' che vede il manager ma non modifica iscrizioni.
- `accoglienza`: scansiona QR code e verifica iscrizioni/check-in vedendo solo dati minimi necessari.

I ruoli devono vivere in profili o membership applicative, non solo nei metadata Supabase Auth. Dove serve, il ruolo deve essere scoperto da uno scope: evento, gruppo, funzione di accoglienza.

## Workflow pubblico

La home parte dall'email:

- Se l'email corrisponde a una persona gia' iscritta, l'app invia un magic link Supabase.
- Se l'email non e' ancora registrata, viene avviato il form di iscrizione.
- Alla creazione della registrazione vengono salvati dati essenziali, consensi, gruppo certo/probabile, QR token e log.
- Viene inviata una email di conferma con dati inseriti e link di accesso.

Il form iniziale deve raccogliere almeno:

- Nome, cognome, data di nascita.
- Paese da lista preimpostata con opzione altro.
- Citta' filtrata per paese con opzione altro.
- Disabilita' o bisogni di accessibilita' con domande basate sul Washington Group.
- Partecipazione precedente a eventi/iniziative Sant'Egidio.
- Partecipazione con gruppo Sant'Egidio o come singolo.
- Se gruppo: selezione da elenco gruppi cercabile per nome gruppo e capogruppo.
- Giorni/momenti previsti di partecipazione, con opzione "non lo so ancora".
- Accettazione privacy e consenso al trattamento dati.
- Versione consenso, data/ora, e quanto serve per tracciabilita' legale.

## Dati sensibili e privacy

Privacy e sicurezza sono architettura, non dettagli finali.

Trattare con attenzione:

- Dati di disabilita' e accessibilita'.
- Data di nascita ed eta'.
- Email, telefono e contatti referenti.
- Appartenenza a gruppi o coinvolgimento nella Comunita' di Sant'Egidio.
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

- Usare branch dedicati per milestone o feature, per esempio `milestone/01-setup`, `feature/auth-roles`, `fix/check-in-scope`.
- Evitare di lavorare direttamente su `main` salvo richiesta esplicita.
- Preparare diff leggibili per review umana.
- Non fare commit/push senza richiesta.
- Se compaiono modifiche non fatte da Codex, trattarle come lavoro dell'utente.

Remote previsto, da configurare quando richiesto:

```bash
git remote add origin https://github.com/giovaniperlapace/iscrizioni-pace
```

## Supabase e Coolify

Supabase sara' usato nelle milestone implementative, non durante la sola pianificazione.

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

Entita' probabili:

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
- Prevedere modalita' test/preview.
- Non salvare password/API key in repository.

## QR code e check-in

Regole:

- QR code = token opaco, non dati personali.
- Token revocabile e rigenerabile.
- Check-in idempotente.
- Check-in associabile a evento generale e/o momento specifico.
- Accoglienza vede solo: identita' minima, stato iscrizione, eventuale settore/seduta/percorso, alert operativi strettamente necessari.
- Ogni scansione/check-in deve essere auditabile.

## Test e verifica

Quando gli script sono configurati, usare:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`, quando verra' aggiunto.
- `npm run build`.

Per funzioni critiche aggiungere test su:

- Normalizzazione email, paesi/citta' e gruppi.
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

Finche' esiste, `PIANO_DI_LAVORO.md` guida le milestone principali. Prima di iniziare una milestone, leggere la sezione corrispondente.

Quando il piano verra' cancellato:

- Non ricrearlo automaticamente.
- Usare questo `AGENTS.md` come fonte primaria.
- Per bugfix e funzioni accessorie, leggere il codice reale e aggiornare questo file se emerge una nuova regola operativa.
