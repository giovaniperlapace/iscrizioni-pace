# Accoglienza Forum ed eventi: avvio da telefono e ritiro della prova

Richiesta del 25 ottobre 2026; commit e push già autorizzati nella conversazione.

## Comportamento

- Rimossi il collegamento «Prova con QR fittizi» e il collaudo dall’applicazione.
  I vecchi segnalibri al collaudo rimandano alla dashboard operativa, con i
  normali controlli di ruolo/incarico; eliminata l’eccezione per Manager senza
  incarichi. I PNG e il foglio HTML non sono più pubblicati in `public`.
- Su telefono la pagina apre direttamente «Scegli l’incarico», in modalità
  telefono: nessuna scelta Computer/Telefono o pulsante per cambiare modalità.
  Rilevamento server con `userAgent` di Next, basato sul dispositivo mobile,
  indipendente dalla larghezza e dalla rotazione dello schermo. Computer e
  tablet conservano la scelta della postazione.
- Rimossa la ricerca dal selettore per tutti i dispositivi. «Verifica iscrizione»
  resta al primo posto; filtri di data/ora Roma e cambio incarico conservati.
- Fotocamera solo dopo la scelta dell’incarico e l’avvio esplicito; inserimento
  manuale del codice ancora disponibile sul telefono. Cambiare orientamento
  non azzera l’incarico o il codice inserito. Cornice, statistiche, sola lettura
  della verifica e operazioni degli altri incarichi conservati.
- Il collaudo resta esclusivamente nelle fixture dei test, con pagina temporanea
  creata dal runner locale. Questo conserva le regressioni F001–F009 senza
  esporre una modalità di prova nella dashboard pubblicata.

## Sale collegate: stato verificato, senza modifiche

Le sale collegate sono panel distinti (`event_moments`), con lo stesso orario
del Forum principale ma ID, sede, prenotazioni, ingressi e conteggi separati.
Di conseguenza hanno **incarichi distinti**. L’operatore della sala collegata
deve scegliere la voce contenente «SALA COLLEGATA — SOLO IN ITALIANO» e il nome
della sede; il solo incarico «Forum 1» riguarda la sala principale.

| Forum | Sala collegata | Posti per Forum |
| --- | --- | ---: |
| 1, 9, 19 | Domus Letitiae — Assisi | 156 |
| 3, 10, 18 | Serafico — Assisi | 110 |

Controllo in produzione in transazione `READ ONLY` il 25 ottobre: tutte le sei
sale presenti nel catalogo, `check_in_enabled = true`, ciascun incarico assegnato
a **54 operatori su 54**. Nessuna assegnazione da aggiungere. Gli incarichi
compaiono nella fascia del Forum, secondo il filtro già in uso.

Una prenotazione nella sala collegata non diventa automaticamente una prenotazione
nella principale: lo scanner controlla il panel dell’incarico selezionato. In
caso di Forum diverso, il percorso esistente segnala la mancata prenotazione e
mostra titolo/sede della prenotazione alternativa. L’eventuale forzatura esplicita
di ingresso già disponibile non equivale a condividere i due incarichi.

Riferimenti: `lib/events/assisi-2026-relay-rooms.ts`, migration
`20261023101000`, `20261023130000`, `20261023140000`, funzioni canoniche
`reception_panel_check_in` e `reception_forum_routing`.

## Verifiche e rilascio

Nessuna migration, modifica alle assegnazioni o scrittura operativa remota;
le prove di scansione usano esclusivamente dati sintetici e PostgreSQL temporaneo.

- 1.123 test automatici superati; TypeScript e lint mirato superati.
- Build production pulita in copia isolata, dipendenze installate da `npm ci`.
- Browser Chromium con user agent iPhone/Android: pagina originale, elenco
  diretto senza ricerca/cambio postazione, verifica al primo posto, lettura
  manuale con nome e verde, rotazione senza perdita del codice, cambio incarico,
  nessun pannello prenotazioni da telefono, redirect del vecchio collaudo.
- Regressione completa SQL/concorrenza e browser desktop/mobile: prenotazione
  distinta da ingresso, camera/USB, verifica verde/giallo/rosso e sola lettura,
  scuole, cambio incarico, fasce orarie, nessun overflow. Prova sintetica ancora
  esercitata dal solo runner locale. Un primo avvio del browser si è bloccato
  nella chiusura del contesto: gestione delle route del test ripulita prima
  della chiusura; esecuzione completa successiva passata.
- Nessun test eseguito su telefoni fisici; rilevamento e flusso verificati nel
  browser con viewport/touch/user agent mobili e codice applicativo originale.
