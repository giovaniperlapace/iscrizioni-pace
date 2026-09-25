# Importazione servizi da Excel

La gestione iscritti Manager/Admin offre **Importa servizi da Excel** accanto
all’import delle nuove iscrizioni. Il modello è distinto e contiene il foglio
`Servizi` con le colonne `nome`, `cognome`, `servizio`, le istruzioni e il catalogo
dei servizi attivi dell’evento corrente. Il Viewer e gli altri ruoli non possono
aprire il comando, scaricare il modello o inviare l’importazione.

Il pulsante **Importa e attribuisci servizi** esegue l’assegnazione e mostra il
report nella stessa modale. Non c’è un passaggio di creazione delle persone.
L’import iscritti esistente, i suoi consensi e il suo modello restano invariati.

## Regole di identificazione e assegnazione

- Cerca tutte le iscrizioni non eliminate dell’evento corrente, a prescindere
  dai filtri della tabella e dai gruppi. Le iscrizioni storiche di altri eventi
  e quelle eliminate non sono candidate; i figli accompagnati non sono iscritti
  autonomi e non sono destinatari di questo import.
- Confronta nome e cognome con normalizzazione Unicode NFC, minuscole e spazi
  consecutivi uniformati. Accenti, apostrofi e punteggiatura restano significativi;
  nessuna ricerca approssimata e nessuna scelta tra omonimi. Anche un’eventuale
  anomalia con più iscrizioni della stessa persona rende il match ambiguo.
- Solo un match univoco e un servizio attivo univoco del catalogo permettono
  la scrittura. Un’etichetta sconosciuta, inattiva o di un altro evento non crea
  servizi e non cambia l’assegnazione esistente.
- Il modello dati consente un solo servizio per persona/evento: l’import imposta
  `assigned` e aggiorna l’eventuale servizio precedente. Note dell’operatore e
  del partecipante, autore originario, dati personali, account, ruoli di accesso,
  gruppi, presenze, consensi e QR restano conservati. Non invia email.
- Un servizio già assegnato resta invariato. Righe identiche sono applicate una
  sola volta. Se lo stesso nominativo compare con servizi diversi, nessuna delle
  relative assegnazioni viene applicata, indipendentemente dall’ordine delle righe.

## Report

Il report a video e quello scaricabile in `.xlsx` distinguono: servizi attribuiti,
già assegnati, partecipanti non trovati, nominativi ambigui, servizi non validi,
righe non valide, servizi contrastanti nel file e righe ripetute. Le categorie
sono esclusive e la loro somma coincide con le righe esaminate (escluse quelle
vuote). Il numero della riga originale, nome, cognome, servizio ed esito permettono
di rintracciare i casi nel file; il filtro **Mostra solo i casi da correggere**
facilita il controllo. Per le omonimie il report non sceglie né espone un candidato.

La modale conserva filtri e scroll. X/Esc sono bloccati durante l’invio e
restituiscono il focus al comando alla chiusura. Il caricamento usa il componente
condiviso `ProgressButton`. Il report resta visibile dopo il salvataggio; scegliendo
un nuovo file si avvia un nuovo import.

## Database, sicurezza e retry

La migration `20260925210000_service_excel_import.sql` aggiunge esclusivamente:

- la tabella `service_import_runs`, protetta da RLS e senza accesso anonimo o
  autenticato ordinario, per le ricevute dei reinvii;
- la funzione interna di normalizzazione;
- la RPC `import_participant_services`, eseguibile solo da `service_role`.

L’API ricava attore ed evento dalla sessione tramite `qualityAccess(true)`. La RPC
rilegge e blocca evento corrente e incarico Manager dello stesso evento oppure
Admin globale. Il payload non può scegliere un altro evento o un altro attore.

Il confronto viene calcolato sull’intero file in un passaggio SQL, senza il limite
di righe REST. Durante confronto e scrittura, lock condivisi su partecipanti,
iscrizioni e catalogo impediscono cambi di nome, nuovi omonimi, cancellazioni o
variazioni dei servizi concorrenti; le assegnazioni servizi sono serializzate.
I lock hanno attesa massima di cinque secondi e durano la transazione. Possono
ritardare brevemente altre scritture: con 500 righe e oltre 1.200 iscrizioni
sintetiche il collaudo locale ha impiegato circa 0,16 secondi, senza rappresentare
una garanzia di prestazioni di produzione.

Assegnazioni, audit e ricevuta sono atomici. Errori tecnici fanno fallire l’intera
transazione; righe non risolte ricevono un esito senza impedire le altre assegnazioni.
Un UUID per file selezionato, con lock del relativo import, attore/evento e hash
del payload impedisce di applicare due volte la stessa richiesta. Anche una
risposta HTTP persa dopo il commit è recuperabile premendo nuovamente il comando
senza cambiare il file. Il recupero restituisce il risultato originale, senza
nuove scritture. Se la generazione Excel fallisce dopo il commit, il report a video
rimane disponibile e **Recupera report Excel** rigenera il file dalla ricevuta.

File: solo `.xlsx`, massimo 2 MiB/500 righe. Budget reale del corpo HTTP prima
del parsing, controllo Origin, intestazioni canoniche e solo testo semplice.
Riusa l’ispezione ZIP dell’import iscritti: limiti su decompressione, celle e
archivio; blocco di formule, link esterni, macro, cifratura e oggetti incorporati.
Le risposte sono `private, no-store`; le celle dei report sono stringhe letterali.

## Collaudo e rilascio

- `node --test tests/service-import.test.mts`: modello/parser/report, somme,
  formule e limiti, veri handler API con dipendenze sintetiche, attore/evento,
  errori, catalogo paginato e recupero report dopo il commit.
- `tests/sql/service-import.sql`: database PostgreSQL vuoto e temporaneo, schema
  servizi reale; permessi, omonimie oltre il limite REST, eliminati, eventi,
  conflitti e ripetizioni, accenti, note, rollback audit e impronte dei dati
  personali/iscrizioni/ruoli conservate.
- `node tests/sql/service-import-concurrency.mjs 55447 service_import_test`:
  sul database temporaneo precedente, omonimo inserito durante l’import,
  cancellazione concorrente, reinvio simultaneo e lotto di 500 righe.
- `node tests/browser/service-import.mjs http://localhost:3127`: dev server
  locale e database temporaneo `service_import_test` sulla porta 55447.
  Crea/rimuove una route sintetica e sostituisce solo le dipendenze Auth/Supabase
  del vero handler con un adattatore PostgreSQL locale. Verifica toolbar,
  modello, caricamento, RPC reale, risposta persa, report Excel, filtro,
  Manager/Admin, Viewer anche via URL/API, desktop/mobile, focus ed Esc.
  Le fixture browser vanno eseguite prima dei test generali/build; le route
  sintetiche vengono rimosse al termine. Nessuna scrittura su persone reali.

Verificati 559 test, lint, TypeScript e build production con `npm ci` in copia
pulita dei soli file del rilascio, oltre a SQL e browser.

Il 25 settembre l’utente ha autorizzato migration, commit e push su `main`.
La migration è stata applicata e registrata atomicamente in produzione **prima
del push**. Nella stessa transazione sono state verificate invariate le impronte
dei dati delle 37 tabelle pubbliche preesistenti, tutte le policy, i grant/RLS di
38 relazioni e le definizioni/grant di 51 routine. Nuova ricevuta vuota, RPC solo
`service_role`, nessuna importazione di collaudo su persone reali né email.
Backup dello schema riservato sul server in
`/root/pace-release-20260925-service-import/schema-before.sql`.
Il codice segue il normale rilascio Git/Vercel autorizzato; nessun aggiornamento
delle persone esistenti è necessario. L’utente ha poi autorizzato anche la
correzione della posizione degli errori di presenza, inclusa nel rilascio con
un commit distinto e verificata insieme all’import servizi.
