# Accoglienza: Indietro verso la scelta dell’incarico su telefono

## Comportamento

La selezione di un incarico sul telefono crea un solo passaggio nella
cronologia del browser, sullo stesso URL. Il tasto Indietro o il gesto
corrispondente torna alla scelta dell’incarico. Un ulteriore Indietro può
uscire verso la pagina precedente. «Cambia incarico» percorre lo stesso
passaggio, senza accumulare copie dell’elenco a ogni cambio.

Avanti e ricaricamento ripristinano l’incarico se ancora disponibile.
Un incarico scaduto non viene riaperto da Avanti. La verifica usa il catalogo
assegnato e l’orologio server già presenti. La navigazione desktop continua
come prima; il comportamento telefono si applica al riconoscimento server
`phoneOnly`, incluse rotazione e modalità di inserimento manuale.

Uscire dall’incarico arresta e smonta la fotocamera. Durante una richiesta,
un esito incerto o una conferma aperta, Indietro conserva la scheda montata e
la richiesta idempotente da completare. Dopo completamento/annullamento,
Indietro torna all’elenco. Un QR invalido o una sessione esplicitamente
revocata non intrappolano l’operatore nello scanner.

## Implementazione

`usePhoneDutyHistory` osserva la cronologia con `useSyncExternalStore` e un
listener `popstate` rimosso all’uscita. Lo stato browser contiene solo evento,
URL e chiave dell’incarico: nessun QR, nome, identificativo del partecipante o
contenuto della scheda. I campi interni della cronologia Next sono preservati.
La navigazione non modifica autorizzazioni, scansioni, conferme o database.

`EventReceptionConsole` segnala separatamente il lavoro ancora da completare:
il blocco della navigazione non comprende la revoca definitiva della sessione.
Le protezioni precedenti delle altre azioni e del cambio modalità restano
conservate. Nessuna migration, email o scrittura operativa reale.

## Verifiche

- 1.146 test della working tree passati, inclusa la modifica locale preesistente
  degli orari; TypeScript, lint mirato e build production passati in copia
  isolata. Dipendenze dalla copia installata tramite npm ci, senza modificare
  manifest/lockfile della repository (vedi verbale ripresa fotocamera).
- Browser Chrome con user agent iPhone e Android, viewport/touch mobile,
  pagina e console originali → endpoint originale → PostgreSQL temporaneo.
- Indietro/Avanti, ricaricamento, uscita verso la pagina precedente, tre cambi
  consecutivi senza crescita della cronologia, QR invalido, sessione revocata,
  arresto dello stream, conferma di rimozione conservata e annullabile.
- Ingresso effettivamente salvato nel DB sintetico con risposta ritardata e poi
  persa: Indietro durante pending e uncertain non perde il comando; retry
  identico e un unico ingresso attivo. Avanti dopo sei ore non riapre il Forum.
- Desktop senza nuove voci di cronologia, nessun errore JavaScript.
- Suite SQL/concorrenza esistente passata. Test non effettuati su dispositivi
  fisici o Safari; nessun ingresso reale di prova.

```sh
PHONE_HISTORY_ONLY=1 PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/browser/run-forum-event-reception.mjs
```
