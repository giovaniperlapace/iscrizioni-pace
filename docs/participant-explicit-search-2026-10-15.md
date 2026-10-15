# Ricerca iscritti esplicita — 15 ottobre 2026

Richiesta: ricerca avviata con Invio, senza attese automatiche, ritorno in cima
o perdita dei caratteri digitati. Pubblicazione su main/production autorizzata.

## Modifica

La tabella condivisa Admin/Manager usa `OperationsParticipantFilters`:

- nome/codice/provenienza, email/telefono, gruppo, servizio e tag restano in
  bozza fino a Invio o al pulsante **Cerca**;
- navigazione client con `scroll: false`, senza ricaricamento del documento;
- campi controllati e stabili, senza chiavi legate alla risposta server;
- una risposta della propria ricerca conserva eventuali modifiche successive;
  una navigazione a filtri diversi ripristina invece i valori ricevuti;
- ricerca in corso visibile, campi ancora modificabili e invii ripetuti bloccati
  durante l'attesa; un nuovo invio degli stessi filtri rilegge i risultati;
- **Azzera filtri** cancella anche le bozze non inviate e il filtro statistico.
  Colonne, ordinamento, vista e modalità del menu restano nell'URL.

Loader, filtri server, autorizzazioni e ambiti evento sono invariati. Il vecchio
`AutoFilterForm` resta disponibile per le altre schermate. Nessuna migration,
scrittura applicativa, email o prova su iscritti reali è necessaria.

## Verifica

- 893 test superati nel workspace; 886 nella copia pulita che esclude i sette
  test scanner USB non pubblicati. Adeguate tre verifiche strutturali alla
  separazione del componente e al nuovo comando di azzeramento.
- ESLint mirato, TypeScript e build production superati; build in copia pulita
  con `npm ci`, senza credenziali DB e senza le modifiche scanner concorrenti.
- Collaudo browser riproducibile: `tests/browser/participant-explicit-search.mjs`,
  con tabella, router e funzione di filtro originali, 500 iscritti sintetici,
  fixture server esistente e ritardo aggiuntivo nella risposta RSC.
  Il test richiede una copia isolata e ripristina le pagine sostituite.
- Superate tutte e quattro le combinazioni Chrome Admin/Manager e viewport
  desktop/mobile: nessuna richiesta RSC durante la digitazione o la scelta dei
  filtri, Invio/Cerca, nome/codice/provenienza/email/telefono, bozza conservata
  durante risposta lenta, stesso elemento DOM e focus, scroll conservato,
  azzeramento, ricerca ripetuta e zero richieste di ricaricamento documento.
  Nessun errore JavaScript; layout mobile verificato anche sull'immagine.

Le modifiche scanner USB e la relativa documentazione già presenti nel
workspace sono escluse dal rilascio e conservate sul disco.
