# P13 — prima parte: visualizzazione degli ingressi evento

Implementazione locale del 30 settembre 2026 sul branch `codex/panel-p0-p10`.

## Comportamento

- Admin, manager e manager viewer vedono nella Gestione iscritti, sotto il nome,
  “Ingresso registrato” con data e ora Europe/Rome oppure “Ingresso non registrato”.
  La scheda mostra lo stesso dato; i minori hanno uno stato individuale, anche
  nell’elenco quando è attivo Mostra figli accompagnati.
- Le iscrizioni non operative non vengono presentate come semplicemente senza
  ingresso: mostrano “Iscrizione non operativa”. La storia resta nel database.
- Le statistiche mostrano i totali dell’intero evento: adulti iscritti, minori
  accompagnati, studenti, accompagnatori scuola, classi/gruppi scuola entrati
  e totale persone. Le quantità scuola contribuiscono al totale persone;
  il numero di prenotazioni scuola è un indicatore distinto.
- I totali non sono presenze previste, prenotazioni panel o persone ancora sul
  posto. Non essendoci registrazione delle uscite, non misurano l’occupazione
  istantanea. Non si calcolano no-show durante questa tranche.
- Una lettura iniziale e poi ogni 10 secondi aggiorna solo il contesto presenze,
  senza navigazione o refresh del form. La scheda e i campi non salvati restano
  aperti. Richieste non sovrapposte, timeout 15 secondi, nessun polling a scheda
  nascosta; ripresa quando torna visibile o torna la connessione.
- Errori e timeout rimuovono il dato precedente e mostrano indisponibilità,
  mai un falso zero o una falsa assenza. HTTP 401/403 o redirect all’accesso ferma il polling e
  cancella i dati precedenti; Riprova esegue nuovamente i controlli di accesso.

## Lettura e permessi

`GET /dashboard/attendance?eventId=<uuid>` usa esclusivamente il client Supabase
con la sessione autenticata e le policy RLS esistenti. Verifica l’utente con
`getUser`, filtra gli incarichi per il suo ID e ammette admin globale oppure
manager/manager_viewer dell’evento richiesto. Accoglienza, partecipante e
capogruppo non accedono al riepilogo operativo. Nessun service role nel flusso.

La proiezione legge `check_ins` con evento esatto, `moment_id IS NULL` e
`cancelled_at IS NULL`. Esclude iscrizioni eliminate/annullate/non operative
e scuole non submitted/confirmed. La paginazione ordinata da 500 righe evita
il limite di 1.000; errore di una pagina annulla l’intera risposta. La risposta
nominale contiene soltanto chiavi iscrizione/minore e orari, senza nomi,
recapiti, QR, note o identità degli operatori. `summary=1` restituisce soltanto
totali e metadati, con la mappa nominale vuota. Risposte `private, no-store`;
nessuna persistenza dei dati di presenza nel browser.

Sono letture periodiche, non una transazione di report: un ingresso concorrente
fra pagine può comparire al ciclo successivo. Il timestamp indica il termine
della lettura, non una garanzia di snapshot atomico o di latenza massima.

Nessuna migration o modifica alle policy. Capogruppo/partecipante, export Excel,
filtri per ingresso, statistiche per punto/fascia, audit aggregato delle
correzioni e accessi ai singoli panel restano fuori da questa prima parte.

## Verifiche

Superati 351 test, lint, typecheck e build staging; versioni installate Next/React
confrontate con il lockfile e coincidenti.

- `node --test tests/event-attendance.test.mts`: conteggi famiglia/scuola,
  iscrizioni inattive, 1.201 ingressi, errore su pagine successive, proiezione
  ridotta e controlli di sessione/ruolo/evento.
- `node tests/sql/run-reception-checks.mjs`: PostgreSQL 17 temporaneo, schema
  canonico, prove scanner P11/P12, concorrenza e nuova proiezione P13 con RLS
  per manager, viewer, admin e operatore di un altro evento.
- Query PostgREST esatta verificata in sola lettura sullo staging con `limit=0`,
  senza leggere identità o modificare dati.
- `node tests/browser/event-attendance.mjs http://localhost:3112`, su server
  locale avviato con `npm run dev:staging -- --port 3112`: componenti reali,
  trasporto sintetico, aggiornamento periodico dopo ingresso/annullamento,
  minore indipendente, quantità scuola, scheda con modifiche non salvate,
  errore/ripresa, revoca, desktop e mobile 390px. Il runner rimuove la route
  temporanea prima della build.
- Collaudo autenticato della preview con scansione su telefono e osservazione
  da una seconda postazione da completare dopo la pubblicazione richiesta.

Implementazione inizialmente locale; nella richiesta successiva del 30 settembre
l’utente ha autorizzato commit/push e verifica della preview staging. Nessuna
migration remota o invio email. L’integrazione dedicata di main resta rinviata come da nota
P12; il branch panel è stato aggiornato dal proprio upstream prima del lavoro.
