# Scuole: un Forum per classe e fascia — 17 ottobre 2026

## Richiesta e decisione

Un docente referente può prenotare contemporaneamente per classi diverse. Il
vincolo riguarda il gruppo classe con i suoi accompagnatori, non il docente
come persona fisicamente presente in sala. Non vengono raccolti nomi di studenti
o accompagnatori.

Il controllo precedente era limitato a `booking_id`: classi diverse erano già
ammesse, ma inviare due prenotazioni della stessa classe aggirava il limite.
Ora l'identità è evento + docente canonico + scuola + città + classe. Maiuscole,
spazi e punteggiatura sono normalizzati (es. `3A`, `3 A`, `3-A`). Studenti e
accompagnatori sono quantità della classe: cambiarle non crea una nuova identità.

- 3A e 3B dello stesso docente: due Forum contemporanei consentiti.
- Stessa 3A: un solo Forum per giorno/fascia, anche tra prenotazioni separate.
- Fasce canoniche già usate dai Forum: mattina prima delle 12:00, pomeriggio
  dalle 12:00, calendario Europe/Rome. Anche una sovrapposizione effettiva fra
  fasce differenti è vietata. Mattina/pomeriggio o giorni diversi ammessi.
- Per cambiare Forum si modifica la prenotazione: sostituzione atomica; se
  fallisce per conflitto/capienza, i posti precedenti rimangono assegnati.
- Annullare libera anche la fascia. Le altre classi del docente restano autonome.

La classe è dichiarata dal referente: il sistema impedisce duplicati coerenti
con questa identità, ma non certifica che una classe inventata o una scuola
scritta con un nome completamente diverso siano autentiche. Nessun limite
arbitrario al numero di classi e nessuna identificazione nominativa degli alunni.
Il rate limit pubblico preesistente (5 tentativi/ora per IP/email) resta invariato.

## Implementazione

Migration dedicata `20261017180000_school_class_slot_constraints.sql`:
proiezione privata `app.school_class_reservations` delle riserve canoniche attive,
vincolo univoco classe/fascia ed esclusione GiST classe/intervallo, differiti a
fine transazione. Protezione anche per richieste concorrenti, senza affidarsi
soltanto a una query preliminare. Identità SHA-256; nessun dato nominativo nuovo.

Trigger aggiornano la proiezione per prenotazione, identità/stato classe e
orario del Forum; cancellazioni in cascata. Lock sulle righe canoniche durante
la sincronizzazione. Il validatore RPC mantiene l'errore overlap; anche i nomi
dei vincoli differiti sono mappati correttamente dai gestori errori esistenti.
Nessun nuovo accesso pubblico: tabella RLS senza policy, funzioni interne senza
grants a anon/authenticated/service_role; trigger security-definer.

Selettore condiviso modulo pubblico/pagina docente: selezione di un Forum
rende indisponibili quelli in conflitto finché non viene deselezionato. Quantità,
modifiche, QR e cancellazione conservati. Istruzioni ed errori in sette lingue;
in caso di duplicato, link alla gestione delle prenotazioni. Nessuna scrittura
alla sola selezione. Home e apertura personale/capogruppo invariati.

## Verifiche

- 913 test applicativi nella copia pulita del solo intervento; 946 nel workspace
  condiviso al momento della verifica. Lint, TypeScript e build production
  Webpack con `npm ci` superati. Lavori paralleli esclusi dalla copia.
- PostgreSQL 17 temporaneo: migrazioni canoniche, gate/RLS, capacità, creazione,
  modifica, annullamento, QR e rollback. Duplicati tra prenotazioni, variazioni
  ortografiche e di quantità, classi/scuole/docenti diversi, date/fasce diverse,
  cambio classe e orari, sovrapposizione oltre mezzogiorno.
- Concorrenza: stessa classe su Forum diversi, un solo successo; classi diverse,
  entrambi i successi. Provate anche scritture operative dirette che saltano il
  lock docente delle RPC: i vincoli DB impediscono comunque il doppio posto.
- Migrazione su dati preesistenti: conflitti fanno fallire l'intera transazione
  senza alterare tabelle o dati; backfill valido conserva esattamente prenotazioni,
  docenti, QR, riserve e audit. Nessuna cancellazione o fusione automatica.
- Browser Chrome su pagine/Server Action originali con adattatore Auth/REST locale
  verso il PostgreSQL temporaneo: stesso docente, due classi contemporanee,
  duplicato respinto senza posti/email aggiuntivi, QR, modifica e annullamento.
  Desktop/mobile, tastiera, blocco selezioni, noindex e home senza link scuola.
  Email simulate in modalità log; nessuna email o prenotazione reale di test.

Comando: `node tests/sql/run-school-direct-link.mjs`; `--browser` richiede
`SCHOOL_BUILD_DIR` con build isolata (Supabase loopback 55492) e `PLAYWRIGHT_MODULE`.
Test migration/concorrenza/browser inclusi nel runner; non eseguirli su DB remoti.

## Rilascio

Implementazione locale, nessun commit/push o migration remota per questa tranche.
Serve applicare la migration prima del codice, con autorizzazione al rilascio,
backup verificato e confronto del registro/schema production. Eseguire in una
sola transazione: eventuali conflitti già esistenti devono essere esaminati,
mai risolti cancellando prenotazioni automaticamente. Non serve cambiare i flag
`school_link_enabled` o `panel_access_mode`, né applicare migration parallele.

### Successivo rilascio autorizzato

Su successiva richiesta dell’utente, migration applicata e registrata in
production insieme alla lista d’attesa capogruppo, prima del codice e dopo
backup verificato. Dati canonici invariati; link scuole attivo e apertura
generale ancora `internal`. Ripetute suite SQL/concorrenza/migration e browser.
Dettagli nel [verbale di rilascio](rilascio-presenze-scuole-forum-2026-10-17.md).
