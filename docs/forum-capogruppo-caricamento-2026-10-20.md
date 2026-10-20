# Forum capogruppo: caricamento e ruoli cumulati — 20 ottobre 2026

## Problemi riprodotti

Lo screenshot dell’utente mostrava il fallimento del caricamento. I log live
registravano `[group-panel:load] 25006 cannot execute SELECT FOR SHARE in a read-only transaction`.
La RPC STABLE chiamava il guard delle scritture, incompatibile con la transazione
READ ONLY di PostgREST. Il precedente controllo SQL aveva usato una transazione
normale e non aveva riprodotto questo confine: non era una verifica completa.

Un secondo controllo con un’identità Manager + capogruppo ha riprodotto
`group panel access forbidden`: lo scope escludeva esplicitamente chi aveva
anche Manager/Viewer, pur avendo un incarico capogruppo valido. L’utente
richiede invece che il capogruppo possa prenotare per i membri del suo gruppo.

## Correzioni

- `20261020230000_group_forum_read_only`: solo il catalogo legge il gate senza
  lock; le scritture mantengono il guard originale e il lock sull’evento.
- `20261020231000_mixed_role_forum_leaders`: lo scope dipende dall’incarico
  capogruppo e dai discendenti attivi nell’evento corrente. Un ulteriore ruolo
  operativo non annulla questo incarico. Manager/Viewer senza incarico
  capogruppo restano esclusi; revoca e gruppi esterni restano protetti.

Nessun cambio di apertura, capienza, prenotazioni o dati dei partecipanti.

## Verifiche

- Nuovo test SQL con transazione READ ONLY: catalogo iniziale e Forum selezionato,
  includendo l’identità Manager + capogruppo.
- Browser con pagina, Server Actions e route originali in copia isolata con
  dipendenze da `npm ci`, database PostgreSQL temporaneo e solo trasporto
  Auth/PostgREST sintetico. Le letture RPC usano ora READ ONLY come il servizio
  reale. Provati selettore iniziale, lista d’attesa, accettazione con sostituzione,
  iscrizione, annullamento, doppio clic, aggiornamento ogni cinque minuti,
  errore/recupero, revoca, desktop/mobile e sette lingue.
- Harness aggiornato alla RPC `set_panel_family_booking`, durata di 60 minuti,
  fixture con ruolo cumulato anche nel DB e pulizia compatibile con i test
  successivi. Le scritture di collaudo sono esclusivamente sintetiche.
- Tutta `run-forum-waitlist.mjs --group-browser` superata, comprese concorrenza,
  minori, obbligo presenza dichiarata e ritiro Forum. 984 test applicativi e
  lint dei file modificati superati. Nessun frontend applicativo modificato.
- Produzione dopo entrambe le migration: lettura READ ONLY con un capogruppo
  che è anche Manager restituisce 24 Forum e 120 membri, sia senza selezione
  sia con Forum selezionato. Nessun nome o identificativo personale riportato.

## Applicazione in produzione

Entrambe le migration applicate e registrate atomicamente, dopo backup custom
verificati (catalogo e lettura completa). Backup in `/root/backups/iscrizioni-pace/`:

- `production-before-group-forum-read-only-20261020.dump`
  SHA-256 `282459592731f26b459b5679e96a8c910627fdccfbd1e686a5e874c3ad76207b`.
- `production-before-mixed-role-forum-leaders-20261020.dump`
  SHA-256 `862894ad1480e06e14f0726c8f04bb38c36de290e1f0216f8b82f897c7ba3275`.

Confronti dentro ciascuna transazione: 67 tabelle e rispettivamente 135.634 /
135.637 righe invariate; ACL e proprietari di 202 funzioni conservati; modificata
soltanto la definizione prevista per ciascuna migration. La differenza delle
righe fra i due snapshot deriva dall’operatività intercorsa, non dalle migration.
Stato evento `open`, scuole attive. Nessuna email o prenotazione di prova reale.
