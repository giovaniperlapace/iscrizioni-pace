# Rilascio presenze, scuole e Forum capogruppo — 17 ottobre 2026

L’utente autorizza commit e push su main delle ottimizzazioni delle presenze,
del link scuole e delle prenotazioni Forum capogruppo, con le migration necessarie.
Le funzioni Forum personali e capogruppo devono rimanere nascoste e chiuse fino
all’apertura generale. Il link scuole conserva il proprio accesso indipendente.

## Contenuto

- Presenze: aggiornamento dopo i comandi riusciti, invalidazione tra schede,
  rendering selettivo e riconciliazione ogni 15 minuti; nessuna migration.
- Scuole: il link diretto e la migration `20261017160000_school_direct_link`
  erano già pubblicati in `73e8d6c`. Questo rilascio aggiunge il vincolo per
  classe/fascia anche fra prenotazioni distinte e il selettore coerente.
- Capogruppo: lista d’attesa, offerte e conferme con il flusso canonico condiviso,
  notifiche al richiedente e controllo aggiornato dello scope. La navigazione,
  le pagine, le azioni e il DB richiedono `panel_access_mode = open`.

## Database production

Applicate e registrate prima del codice, nella stessa transazione:

| Migration | SHA-256 |
| --- | --- |
| `20261017120000_group_panel_waitlist` | `2a9b1a79714752c9a44f5fa989051af73b0722fe332f517b6c1873dd106fdd31` |
| `20261017180000_school_class_slot_constraints` | `2b072cb546e78abb7966741c66533c9959b52a879d2d11af712aeda087ef9b77` |

Backup custom completo sul server: `/tmp/iscrizioni-pace-production-before-combined-1792239366871.dump`,
10.844.529 byte, permessi 600, indice verificato con `pg_restore --list`.
SHA-256: `7a79c939de674c9f28365f6524132569add32ed1a1cc54b135c5dbc816b8c42d`.
Il dump rimane fuori dal repository.

Confronto delle funzioni canoniche prima dell’applicazione; confronto di 2.422
voci di catalogo prima/dopo, consentendo soltanto gli oggetti delle due migration.
Confronto dei conteggi e delle impronte di tutte le 63 tabelle pubbliche:
110.587 righe invariate, escluse dal confronto soltanto le due nuove colonne
della coda, verificate separatamente con i default previsti. Policy, privilegi
preesistenti, QR, audit e dati canonici conservati. Vincoli differiti verificati
prima del commit, registro aggiornato atomicamente e schema PostgREST ricaricato.

Il primo tentativo è stato annullato integralmente da un errore di alias nel
controllo catalogo dello script di rilascio. Dopo la verifica del rollback e
del registro ancora invariato, è stato corretto solo lo script; SQL delle
migration invariato. La successiva transazione è stata completata e verificata.

Stato confermato dopo il commit DB: `internal`, catalogo pubblico vuoto,
`school_link_enabled = true`, accesso scuole attivo. Nessuna coda o prenotazione
scuola preesistente al momento del controllo. Nessuna modifica ai flag.
Le migration storiche non registrate `20260726120000` e `20261016160000`
non sono dipendenze di questo rilascio e non sono state applicate.

## Verifiche del codice

- 948 test applicativi, lint completo e TypeScript superati.
- Build production in copia pulita senza credenziali dopo `npm ci`; tutti i
  file applicativi e SQL del rilascio coincidono con la copia compilata.
- PostgreSQL temporaneo: suite scuole e Forum, rollback della migration scuola
  con conflitti, concorrenza, RLS, chiusura, revoca, capacità, minori e FIFO.
  Corretta l’indipendenza della fixture capogruppo dall’esito del precedente
  test concorrente sull’ultimo posto; nessuna modifica applicativa richiesta.
- Browser presenze: 500 righe, zero indicatori ridisegnati se invariati, uno
  per la persona modificata; controllo a 15 minuti, salvataggi/rimozioni,
  altra scheda, errori/revoca, mobile, report e campi non salvati conservati.
- Browser scuole/docente e capogruppo con pagine e azioni originali verso
  PostgreSQL temporaneo: prenotazione/modifica/annullamento, classi distinte,
  duplicati, coda/offerta/conferma, scadenza, filtri, revoca e sette lingue.
- Configurazione email Vercel production presente e invariata. La CLI esporta
  vuoti i valori sensibili: non è stata possibile una nuova verifica diretta
  delle credenziali Postmark. Nessun invio reale di collaudo; email simulate
  nelle prove locali. Il worker resta bloccato dall’apertura generale chiusa.

Pubblicazione attraverso il normale deployment Git Vercel del progetto
`iscrizioni-pace`. Staging invariato; note e verbali delle prove hardware
parallele esclusi dal commit e conservati nel workspace.
