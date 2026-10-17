# Prenotazioni e lista d’attesa Forum del capogruppo

## Verifica dell’integrazione in main

Il 17 ottobre 2026, dopo `git fetch origin`, `main` e `origin/main` coincidono
in `2c6261b`. Il branch conservato `origin/codex/panel-p0-p10` (`095af93`) è
interamente antenato di main, attraverso il merge `384f58a` del 14 ottobre.
Nessun ulteriore merge dal branch panel è necessario.

Sono già integrate la pagina `/dashboard/capogruppo/panel`, le azioni per
iscrivere/disiscrivere una persona e le RPC che limitano le operazioni ai gruppi
e discendenti attivi del capogruppo. La navigazione, la pagina e le Server Action
richiedono `panel_access_mode = open`; il catalogo pubblico ha un gate separato
(`catalog` oppure `open`). Pubblicare solo il catalogo non apre le prenotazioni.

La coda del 14 ottobre aveva aggiornato capienza, riserve e regola delle fasce
anche nelle prenotazioni del capogruppo, ma lasciava disabilitato il pulsante
quando il Forum era pieno. Inserimento in coda, offerte e notifiche erano
accessibili soltanto dal flusso personale.

## Funzioni completate localmente

- Ogni riga permette iscrizione, disiscrizione, inserimento/rimozione dalla
  lista d’attesa e conferma esplicita del posto offerto. Stato, posizione e
  scadenza sono visibili; i messaggi di successo restano sostituiti dallo stato
  aggiornato, come già richiesto per questa dashboard.
- Una richiesta include i minori collegati, anche quando il partecipante non
  possiede un account personale. Il gruppo può continuare a prenotare un altro
  Forum della stessa fascia mentre aspetta. Prima dell’accettazione compare
  l’avviso di sostituzione della precedente scelta per tutto il nucleo.
- Coda unica con il partecipante: FIFO rigorosa, una voce attiva per
  iscrizione/Forum, riserva di tutti i posti necessari e 30 minuti per accettare.
  Nessun salto di un nucleo più grande; i posti residui restano prenotabili.
  Richieste e conferme concorrenti delle due dashboard sono idempotenti.
- La notifica va all’account Auth del capogruppo che ha inserito la richiesta,
  nella lingua della sua interfaccia al momento dell’inserimento. Indica il
  partecipante, il Forum, il luogo e la scadenza, con collegamento alla sezione
  nella dashboard capogruppo. Il link non conferma e non contiene token di
  offerta; l’accesso usa la sessione/login ordinari.
- Se la richiesta esiste già ed è stata inserita dal partecipante o da un altro
  capogruppo, un nuovo clic non la duplica e non cambia il destinatario. Gli
  altri capigruppo autorizzati possono gestirla; non ricevono automaticamente
  copie della notifica. Anche una richiesta su un’altra quota individuale dello
  stesso Forum resta visibile e viene gestita sulla quota effettiva.
- Scope riletto dal DB per ogni operazione. Prima dell’assegnazione/claim della
  notifica viene ricontrollato il destinatario: revoca, spostamento fuori scope,
  iscrizione inattiva o email assente cancellano la richiesta non più valida.
  Non c’è trasferimento automatico della notifica a un nuovo capogruppo.
- Aggiornamento della sola vista ogni cinque minuti, senza richieste parallele,
  interrotto durante le modifiche e alla chiusura. Filtri conservati. Errori
  visibili, aggiornamento manuale per riprovare e rimozione delle righe su accesso
  revocato. La scadenza disabilita la conferma nella UI; il DB la verifica sempre.
- Testi e notifiche in sette lingue. Conservati il worker esistente, il claim
  persistente e l’assenza di reinvii automatici dopo esiti incerti.

## Database e rilascio

Nuova migration locale: `20261017120000_group_panel_waitlist.sql`.
Aggiunge tipo destinatario e lingua alla coda canonica, con default individuale
per le voci esistenti. Condivide l’implementazione della coda fra le due RPC,
aggiunge `set_group_panel_waitlist`, estende il catalogo capogruppo e il payload
del claim email. Lo scope ricorsivo è condiviso con il controllo del destinatario.
I nuovi helper restano privati; nessuna policy RLS espone la tabella della coda.

La prenotazione di gruppo accetta una riserva appena consumata senza aggirare la
FIFO per gli altri partecipanti. Catalogo e nuove prenotazioni escludono Forum
già iniziati o location inattive, in coerenza con le offerte. Prenotazioni,
partecipanti, token e presenze preesistenti non vengono riscritti dalla migration.

La migration deve precedere il codice al rilascio. Mantenere `internal` se si
pubblica il codice prima dell’apertura; `catalog` mostra il programma ma non
abilita prenotazioni o inviti. L’apertura richiede la decisione separata di
passare a `open` e il controllo del timer email già esistente.

In questa tranche: nessun commit/push, deployment, migration remota, scrittura
su dati reali o invio email. Lavoro locale su main; branch panel conservato.
Modifiche parallele dell’Accoglienza conservate e non incluse nell’implementazione.

## Verifiche

- 933 test applicativi superati; ESLint e TypeScript senza errori.
- Build production superata in copia temporanea senza `.env`, dopo `npm ci`.
  Gli otto file di implementazione coincidono byte per byte con la copia compilata.
- Tutte le migration canoniche applicate a PostgreSQL 17 temporaneo, con la sola
  esclusione già prevista della rinomina storica priva di gruppi nella fixture.
- SQL: flusso individuale, gruppi/discendenti, persona senza account, minori,
  coda con altro Forum già prenotato, deduplicazione, quote diverse dello stesso
  Forum, scope, privilegi, destinatario/lingua, revoca/spostamento, scadenza,
  annullamento, chiusura e ritiro/ripubblicazione Forum.
- Sei connessioni concorrenti fra partecipante e capogruppo: una voce FIFO,
  un claim di notifica e una sola prenotazione con sostituzione canonica;
  conservati anche i test concorrenti individuali sull’ultimo posto.
- Browser sulla pagina originale, Server Action e route originali, trasporto
  Auth/PostgREST sintetico e PostgreSQL reale temporaneo: doppio clic, coda,
  polling a cinque minuti, offerta, avviso cambio, accettazione, annullamento,
  nuova prenotazione, scadenza UI, errore/recupero manuale, filtri, revoca,
  desktop/mobile e sette lingue. Nessun provider email chiamato.
- Rendering delle email verificato nelle sette lingue con escaping, destinatario
  sintetico e link alla dashboard; consegna reale non esercitata.

## Successivo rilascio autorizzato

Su richiesta dell’utente, migration applicata e registrata in production prima
del codice insieme al vincolo scuole. `panel_access_mode` resta `internal`:
navigazione e prenotazioni capogruppo restano nascoste e bloccate. Ripetute
suite SQL/concorrenza e browser su pagina e azioni originali; corretta la
fixture concorrente per non dipendere dal vincitore di una prova precedente.
Dettagli e backup nel [verbale di rilascio](rilascio-presenze-scuole-forum-2026-10-17.md).

Comandi riproducibili:

```sh
npm test
npm run lint
npm run typecheck
node tests/sql/run-forum-waitlist.mjs
```

Per il browser usare un server Next locale su `127.0.0.1:3164` con tutte le
variabili Supabase rivolte al trasporto sintetico `127.0.0.1:55485`, chiavi
sintetiche, URL applicativi loopback ed `EMAIL_DELIVERY_MODE=log`. Impostare
`PLAYWRIGHT_MODULE` al runtime locale e lanciare:

```sh
node tests/sql/run-forum-waitlist.mjs --group-browser
```

Il runner crea ed elimina il database temporaneo; nessuna fixture applicativa
viene aggiunta alle route del prodotto.
