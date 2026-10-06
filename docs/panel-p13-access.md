# P13 — attivazione report e accessi panel/sala, 6 ottobre 2026

## Perimetro concordato

L'utente ha chiesto di attivare il report in staging senza collaudo e proseguire
con gli accessi ai singoli panel. Il testing completo viene rinviato al termine
dello sviluppo. Questa decisione supera, per questa tranche, il passaggio di
collaudo prima dello sviluppo successivo. Non costituisce accettazione di P13,
autorizzazione alla production o richiesta di commit/push.

## Report attivato in staging

Applicata e registrata `20260930180000_reception_operational_report.sql` nel solo
container staging `supabase-db-jiio6ou5wzmma2xwas53cf1d`, con un'unica transazione
per DDL e registro migration e notifica di ricarica dello schema PostgREST.
Il corpo SQL versionato è invariato: i delimitatori della transazione del file
sono stati ricondotti alla transazione esterna per includere anche il registro.

Controlli di installazione: registro presente, funzione presente, esecuzione
concessa ad `authenticated` e negata ad `anon`. Non sono state eseguite scansioni,
prove funzionali della RPC, modifiche a iscrizioni/incarichi o email. La preview
applicativa del report era già stata pubblicata; nessun nuovo deploy in questa
tranche. Il funzionamento autenticato nel browser resta da collaudare.

Inventario remoto prima dell'attivazione: oltre al report mancavano tutte le 18
migration importate da main elencate in
`docs/panel-main-integration-2026-10-03.md` e la migration storica
`20260813170000_rename_anziani_and_amici_groups.sql`. Non sono state applicate:
non sono dipendenze della funzione report. Prima di pubblicare il codice del
riallineamento occorre valutare questo inventario, comprese le modifiche storiche
ai cataloghi, e predisporre separatamente l'aggiornamento dello staging.

## Accessi panel implementati localmente

Nuova migration `20261006120000_panel_reception_access.sql`, **non applicata in
remoto**. Le migration precedenti non sono state riscritte.

- Incarichi `panel_entry` e `room_assistance` per account, evento e singolo panel.
  Nessun nuovo ruolo globale e nessuna attribuzione del ruolo evento accoglienza.
- Gestione condivisa admin/manager dal catalogo panel, link «Incarichi per panel
  e sala». Email esatta di un account già esistente, senza creazione account o
  invito; aggiunte cumulative e revoca puntuale con conferma. Autorizzazione
  prima delle letture, ripetuta dalla RPC autenticata con audit atomico.
  La propria revoca resta esclusa. Il viewer conserva le statistiche in sola
  lettura; non viene aperta un'eccezione alle restrizioni di main sulla gestione.
- Navigazione alla dashboard accoglienza abilitata anche dagli incarichi panel
  correnti, senza trasformarli in ruoli evento. Una capability separata abilita
  soltanto la navigazione; ogni comando rilegge assegnazione e scope nel server
  e nel DB. Un incarico unico parte selezionato; più incarichi richiedono una
  scelta prima dello scanner. Il cambio svuota letture/QR in memoria ed è
  bloccato durante selezione, richiesta, esito incerto o sessione revocata.
- Scanner condiviso: fotocamera, codice personale di quattro caratteri, soglia
  di assenza del QR, feedback e ultime 15 letture conservati. Nessuna nuova
  persistenza di QR o nominativi nel browser.
- Ingresso panel solo con prenotazione attiva, panel pubblicato, sala/settore
  validi e presenza evento delle persone selezionate. Singolo automatico;
  famiglie esplicite, senza dedurre i minori dall'ingresso del genitore.
  Scuole con quantità esplicite entro i limiti della prenotazione, della scheda
  scuola e degli ingressi evento. Nessun ingresso evento implicito.
- Assistenza in sala: consulta nominativo/scuola e sala/settore del panel
  assegnato. Comandi diversi da consultazione rifiutati da parser, server/RPC;
  nessuna scrittura di presenze, prenotazioni, posti o audit della consultazione.
  Nessun ID di soggetto, quantità, storico presenze, recapito, questionario,
  dato di accessibilità o seduta numerata nella risposta di sala.
- Check-in canonici con `moment_id` e settore, revisioni separate per
  panel/soggetto, retry con lo stesso UUID e impronta comprendente panel/incarico.
  Correzioni e annullamenti espliciti; stato evento e suoi contatori invariati.
  Le due letture scuole nella RPC evento sono rese esplicite su `moment_id is
  null`, prima di consentire più ingressi scuola su panel diversi.
- Lock su incarico, evento, soggetto, prenotazione, panel e settore; capienza
  controllata per settore e sala con serializzazione sul panel. Nessuno
  spostamento silenzioso di ingressi già attivi tra settori. Audit separato
  `reception.panel.*`, senza alterare i contatori operativi del report evento.
- Statistiche panel: numero degli ingressi validi al caricamento, con minori e
  quantità scuole; letture paginate, errori espliciti senza falsi zeri. Le
  prenotazioni restano distinte dagli ingressi; nessuna deduzione di permanenza,
  uscite o no-show. Aggiornamento ricaricando le statistiche.

Se una prenotazione viene cancellata, lo scanner risponde «non prenotato» senza
esporre la scheda. Non cancella implicitamente la storia dei check-in. Se cambia
il settore dopo l'ingresso, una nuova scrittura segnala conflitto: occorre
annullare esplicitamente l'ingresso prima di registrarlo nel nuovo settore.

## Verifiche e passaggi ancora necessari

Eseguiti soltanto controlli statici/compilazione: TypeScript, lint e build con
configurazione staging. Predisposte regressioni in `tests/panel-reception.test.mts`
e adattati i mock auth/proxy; **suite di test non eseguite in questa tranche**.
Nessun collaudo SQL, browser, autenticato o hardware dei nuovi accessi.

Prima dell'accettazione, nel testing completo richiesto dall'utente:

1. Verificare la nuova migration su PostgreSQL temporaneo, RLS e privilegi;
   ruoli incrociati, assegnazione/revoca concorrente, retry e capienza concorrente.
2. Verificare separatamente famiglie parziali, minori senza genitore entrato,
   scuole su più panel, ingressi evento annullati/ridotti, prenotazioni cancellate
   o cambiate, correzioni e annullamenti. Confrontare i conteggi evento prima/dopo.
3. Rieseguire regressioni main/panel, predisporre le migration staging mancanti
   e applicare quella dei nuovi accessi nell'ambiente concordato prima della
   relativa pubblicazione. L'attivazione del report non attiva gli accessi panel.
4. Collaudare su preview con account distinti scanner e statistiche, incluso
   cambio incarico, API fuori scope, esito incerto, revoca, filtri report e
   almeno due dispositivi reali. Verificare assenza di scritture per sala.

P13 implementata in questa tranche ma non dichiarata conclusa o collaudata.
Nessuna attività P14/P15/P16, commit, push o modifica production.
