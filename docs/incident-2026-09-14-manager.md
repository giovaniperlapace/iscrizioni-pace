# Errore dashboard manager — 14 settembre 2026

## Riscontri

Schermata segnalata: `/dashboard/manager`, messaggio server e digest
`2526072483`, circa le 10:30 Europe/Rome. Dopo il login CLI con
`info@giovaniperlapace.it`, correlazione esatta nei log Vercel: richiesta
`q4xkj-1789374584024-6380c76afb64` alle 08:29:44.024 UTC (10:29:44 italiane),
GET `/dashboard/manager`, errore `URI too long`, digest `2526072483`.
Deployment `dpl_J54QZF7TBV4DMBQmpH43uVMPCr7e`. Nella finestra 08:15–08:45
UTC risultano 12 errori dello stesso tipo: 8 manager, 3 capogruppo e 1 admin.
Due richieste manager riportano HTTP 200 perché la risposta era già iniziata:
per il controllo usare il livello error, non soltanto lo stato HTTP.

Su Hetzner, log Kong del servizio `ammnuajlmd83t94cfy3us6cw`, finestra
08:15–08:45 UTC: 48 risposte HTTP 414, dalle 08:28:22 alle 08:39:59 UTC
(10:28–10:39 italiane). Dodici risposte per ciascuna delle quattro tabelle
participant_contacts, participant_group_assignments,
participant_operational_tags e participant_event_services. Le query e i
campi corrispondono ai loader applicativi. Il proxy tronca la request line
nei log 414: un parser che richiede il suffisso HTTP/1.1 li perde.

Riproduzione in sola lettura sull'endpoint reale con UUID sintetici:
- 300 UUID, URL di 11.886 caratteri: HTTP 414, `URI too long`.
- 100 UUID, URL di 4.086 caratteri: HTTP 200, zero righe come previsto.

Il loader condiviso `loadRowsForIds` usava blocchi di 300 identificativi:
la richiesta superava il limite del proxy e `loadAllRows` sollevava un
errore durante il rendering server. Ridurre i blocchi evita il problema
senza cambiare filtri, permessi o dati. Può colpire anche admin e altri
consumatori dello stesso helper, in funzione del numero di ID caricati.

Il database risulta avviato dal 18 giugno, zero restart e OOMKilled=false.
Nessun evento OOM nel journal kernel disponibile dal 12 settembre.
Questi controlli non escludono ogni possibile problema temporaneo di rete.

Per sabato 12 settembre, finestra locale 00:00–24:00, nessun 414 nei log
Kong disponibili. Non è dimostrato che l'episodio di sabato abbia la stessa
causa. Le interrogazioni Vercel per sabato, sia sull’intera giornata sia
sulla finestra 08:00–09:00 UTC, sono rifiutate con HTTP 400; i log di oggi
sono invece accessibili. La causa dell’episodio di sabato resta non verificata.

## Correzione locale

Blocchi ridotti a 100 UUID, conservando deduplicazione, paginazione delle
relazioni e interruzione integrale su errore. Regressione con client
Supabase reale e trasporto simulato con limite URL, 601 UUID, ID duplicati,
sei relazioni per ID e paginazione oltre 500 righe per blocco; test separato
di errore in un blocco successivo.

Verifica in sola lettura con il codice corretto sul database reale:
241 iscrizioni attive, 240 contatti primari, 229 assegnazioni correnti,
zero tag e servizi; tutte e quattro le letture riuscite, tre richieste
ciascuna. Nessuna modifica a dati, account, invii email o configurazione server.

Verifiche completate in checkout pulito con `npm ci`: lint, 259 test,
build production e typecheck superati. Il rilascio segue il push su main
e il deployment automatico GitHub–Vercel.
