# Campagne: report per destinatario e reinvio selettivo — 20 ottobre 2026

## Uso

In Email → Campagne inviate, il pulsante **Dettagli** apre conteggi ed elenco
ricercabile per nome, indirizzo ed esito. Storico paginato, destinatari a 100 per
pagina, export CSV completo e collegamenti tra originale e reinvio. Sul telefono
l'esito è leggibile sotto l'indirizzo. “Aggiorna report” rilegge gli eventi già
ricevuti dal servizio; non invia messaggi.

Gli stati distinguono consegna al server, accettazione senza consegna confermata,
rifiuto successivo, errore prima dell'invio, blocco/disiscrizione, attesa, esito
incerto ed esclusione dalla selezione. La consegna non certifica lettura o arrivo
nella posta principale. Dove manca un indirizzo storico verificato si mostra
esplicitamente il contatto attuale, senza presentarlo come destinazione certa.

Solo i fallimenti recuperabili sono selezionabili. La conferma elenca le persone
interessate e accoda una nuova campagna collegata, con lo stesso contenuto e gli
stessi allegati. Gli indirizzi sono riletti e confrontati con l'istantanea; i
blocchi sono ricontrollati presso Postmark. Indirizzi cambiati, invalidi, messaggi
troppo grandi, esiti incerti, consegne confermate, reclami spam, disiscrizioni e
reinvii già avviati non vengono ritentati automaticamente. Una richiesta ripetuta
restituisce la stessa campagna di recupero. Un errore di verifica del provider
blocca il nuovo reinvio. Non esiste riattivazione automatica delle disiscrizioni.

## Implementazione

Il worker salva indirizzo e nome prima della trasmissione e aggiunge identificativi
opachi della campagna e del destinatario nei metadati Postmark. Conserva i gate,
la coda e i messaggi con esito incerto. Il webhook broadcast autenticato acquisisce
Delivery, Bounce, SpamComplaint e SubscriptionChange senza corpi delle email.
Gli eventi sono idempotenti, collegati tramite hash del MessageID; le soppressioni
fuori ordine non prevalgono su eventi più recenti. Un evento verificato può
risolvere una risposta di invio incerta, anche arrivando prima di essa. La campagna
viene riallineata dopo la risoluzione dell'ultimo destinatario incerto.

Le nuove tabelle sono service-only. I report verificano sessione, evento e gate
Forum; i reinvii ricontrollano il ruolo anche nel DB. I campi degli esiti sono
protetti da scritture REST dirette. Errori interni non vengono esposti nel report.
CSV protetto dalle formule; risposte HTTP private/no-store. Eventi autenticati di
altri stream vengono ignorati senza scritture, inclusi i probe di Postmark;
segreto mancante/errato: 401; evento broadcast invalido: 400; DB indisponibile: 503.

Migration `20261020180000`, `20261020190000`, `20261020200000` incluse nel
rilascio condiviso, descritto in `rilascio-modifiche-residue-2026-10-20.md`.
La restrizione ai fallimenti realmente recuperabili usa
`20261020210000_campaign_retry_recoverable_only`. Quest'ultima è applicata e
registrata atomicamente: 67 tabelle, 135.088 righe e ACL/proprietari delle 201
funzioni conservati; modificata solo la RPC prevista. Backup custom verificato:
`/root/backups/iscrizioni-pace/production-before-campaign-retry-recoverable-20261020.dump`,
13.088.457 byte, SHA-256
`94edc79e21bbac04a9f549a42eb4d19146f2ff980f3a203515105bef8d572339`.
Timer email ripristinato attivo.

## Riconciliazione storica e caso segnalato

Recuperati e registrati gli eventi disponibili per **936 messaggi**, su 1.014
identificativi conservati dall'applicazione; nessun timeout residuo nel recupero
conclusivo. I restanti **78** non sono presenti nello storico Postmark attualmente
consultabile e non vengono dichiarati consegnati. Acquisite **6 soppressioni**.
Letture dei dettagli completate anche dal server applicativo; salvati soltanto
indirizzi verificati ed eventi normalizzati, senza corpi o allegati.

Campagne del 19 ottobre, orari Europe/Rome:

| Ora | Selezionati | Consegna al server | Rifiuto successivo | Blocco prima dell'invio |
|---|---:|---:|---:|---:|
| 10:40 | 109 | 105 | 3 | 1 |
| 12:22 | 20 | 17 | 2 | 1 |

Il blocco comune è una disiscrizione originata dal destinatario. I cinque rifiuti
successivi sono scadenze in coda (`QUEUE.Expired`). Nessuna delle due campagne
ha ora destinatari selezionati con esito di consegna non ricostruito.

## Verifiche

981 test applicativi, lint, TypeScript e build production da `npm ci` in copia
isolata senza credenziali. PostgreSQL temporaneo: accessi, eventi duplicati e
fuori ordine, risoluzione anticipata, atomicità, rollback e due reinvii concorrenti;
indirizzi invalidi e messaggi eccessivi esclusi dal recupero identico.
Browser originale sintetico a 390/1440 px: filtri, paginazione, selezione conservata,
conferma esplicita, errore di rete/servizio, accesso revocato e assenza di overflow.

Production: endpoint report senza sessione respinge l'accesso, private/no-store;
webhook senza segreto 401. Due ripetizioni autenticate dello stesso **evento
storico reale**, già verificato, restituiscono 200 e conservano un solo evento
(1 → 1). Non sono state create email o presenze sintetiche in produzione.
Revisione visiva autenticata come Manager su dati reali non effettuata.

**Nessuna email inviata o reinviata, nessuna disiscrizione rimossa.**

## Anteprima del contenuto salvato — 24 ottobre 2026

Nei dettagli della campagna, «Visualizza email» apre oggetto e messaggio;
«Nascondi email» richiude il riquadro. Il cambio o aggiornamento della campagna
azzera l'apertura. Si leggono subject_template e body_template della campagna
con le autorizzazioni esistenti, senza ricostruire dati personali correnti.
I segnaposto restano visibili e una nota distingue il modello dalla copia
ricevuta dal singolo destinatario. HTML filtrato con la stessa allowlist degli
invii; testo semplice convertito mantenendo gli a capo. Nessuna migration.
Verificati apertura/chiusura nel browser con dati sintetici e 19 test mirati,
inclusi conservazione dei token e rimozione di script, tracking e link attivi
non consentiti. Nessuna email inviata durante la verifica.
