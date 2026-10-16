# Accoglienza: scansione diretta e rimozione esplicita — 2026-10-16

## Comportamento richiesto

- La conferma mantiene un solo riscontro sullo stato della persona. Il pulsante
  resta «Conferma partecipazione», disabilitato quando la selezione è già presente;
  eliminati cambio di testo, verde e transizione del pulsante dopo il salvataggio.
- «Rimuovi presenza» per il singolo; «Rimuovi presenze selezionate» per gruppi
  e famiglie. La selezione è quella già usata per conferma e stampa: si selezionano
  le persone su cui agire, senza deselezionare chi deve diventare assente.
- Prima della rimozione viene riletta la scheda con autorizzazione corrente.
  La finestra riporta i nomi interessati e offre «Conferma rimozione» / «Mantieni
  presenze». Nessun salvataggio da Escape o chiusura. La richiesta `cancel`
  conserva revisione, snapshot gruppo, audit e retry della stessa richiesta.
  Nessuna modifica alle altre persone, nessuna stampa implicita.
- Un nuovo QR USB sostituisce direttamente la scheda, anche con elenco del
  gruppo aperto. Nessun clic intermedio obbligatorio. Salvataggi, stampa,
  selezione scuola, conferma di rimozione ed esiti incerti sospendono la lettura.
  Dopo il completamento si può scansionare nuovamente. La lettura non registra
  alcuna presenza e non stampa. «Chiudi scheda» resta un comando facoltativo;
  le ultime letture offrono «Apri scheda» con nuova verifica.
- Telefono: conservata la fotocamera con pausa sulla scheda e ripresa esplicita,
  ora «Scansiona un altro QR». Presenze e rimozione funzionano senza stampa.
- Rimosso dalla console evento il riquadro «Badge completo e sedute cerimonie»:
  serviva alla preparazione dei badge con assegnazioni delle cerimonie e non
  appartiene al flusso operativo richiesto. Nessun montaggio del relativo pannello.

## Dettagli e regressioni

La console mantiene l’ultimo risultato verificato anche durante una richiesta
successiva o un esito incerto. In precedenza il ripiego poteva mostrare lo stato
della prima scansione, precedente alla conferma della presenza.

I nuovi metodi della sessione sono limitati al flusso evento con presenza
esplicita. Forum/sala e le loro regole restano invariati. Il componente condiviso
con i partecipanti conserva il percorso di modifica già esistente in quella
superficie; verificata la regressione completa delle azioni partecipanti.

Nessuna migration o modifica di permessi. Nessuna scrittura applicativa remota,
email o stampa fisica. Dopo le verifiche, l’utente ha richiesto commit e push
su main; pubblicazione tramite il normale deployment Git. Conservato ed escluso
dal commit il lavoro preesistente sui verbali hardware. Nessuna migration necessaria.

## Verifiche

- 903 test applicativi, lint completo e TypeScript superati.
- Build production Webpack in copia pulita con `npm ci`, senza file ambiente
  reali e con configurazione sintetica limitata a localhost.
- Browser desktop/mobile sui componenti originali: conferma singola, unico
  riscontro, rimozione singola e selettiva, annulla/Escape, selezione conservata,
  minori e QR genitore, comandi separati, passaggio singolo/gruppo diretto,
  scanner bloccato durante conferma, salvataggio e stampa, doppio clic,
  errori, conflitti, retry identico e revoca. Stampa simulata; nessun errore JS.
- Browser telefono: rimozione, assenza stampa, cambio modalità con rilascio
  fotocamera e inserimento manuale dopo diniego fotocamera.
- Browser partecipanti: conferma, stampa, selezione famiglia, tabella in sola
  lettura, conflitti, errore stampa, esito incerto e identità non corrispondente.
- SQL e concorrenza su PostgreSQL temporaneo: regressioni accoglienza, ruoli,
  revoche, revisioni, audit e privilegi.
- Pagina originale `/dashboard/accoglienza` e Server Action originali con
  adattatore Auth/PostgREST sintetico e PostgreSQL temporaneo: Accoglienza,
  Manager + Accoglienza, Admin; conferma, stampa simulata, rimozione effettiva,
  nuova scansione senza nuova presenza e revoca dell’incarico prima della RPC.
  L’adattatore copre solo gli endpoint dell’accoglienza. Il log server registra
  anche `Unexpected synthetic endpoint` nello stack della dashboard Manager,
  fuori dalle richieste accoglienza verificate; le asserzioni browser e DB del
  flusso richiesto passano. Non equivale a un login reale.

Comandi browser: `tests/browser/usb-reception.mjs`,
`tests/browser/reception-device-modes.mjs`, `tests/browser/event-presence-editor.mjs`.
Richiedono server locale e Playwright tramite `PLAYWRIGHT_MODULE`.
Verifica integrata: `node tests/sql/run-reception-checks.mjs --browser-reception-access`,
con build locale su porta 3194, backend sintetico sulla porta 55486 e chiave QR
sintetica condivisa. Eseguire `npm test` quando le fixture browser temporanee
sono state rimosse: il controllo delle route riservate include ogni cartella app.
