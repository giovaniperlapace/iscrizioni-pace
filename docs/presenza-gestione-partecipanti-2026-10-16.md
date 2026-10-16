# Presenza all’evento dalla gestione partecipanti — 16 ottobre 2026

> Aggiornamento successivo: [partecipazione e stampa con due comandi separati](partecipazione-e-stampa-separate-2026-10-16.md). Il comando combinato e la modifica sotto il nome sono stati sostituiti dal nuovo flusso.

Lo stato «Ingresso registrato / Ingresso non registrato» sotto il nome e codice
nella tabella Gestione iscritti apre direttamente la modifica dell’ingresso.
La matita e la sottolineatura rendono riconoscibile il comando; non occorre
aprire la scheda anagrafica. Funzione Admin, con Manager/Viewer in sola lettura
e iscrizioni eliminate o non operative escluse.

All’apertura si rilegge il nucleo dal codice pubblico tramite `receptionCheckIn`;
la risposta deve contenere l’adulto della riga scelta. La selezione iniziale
corrisponde alle presenze correnti. L’operatore seleziona adulto e minori,
conferma esplicitamente e salva; deselezionare una presenza la annulla.
Chiudi ed Escape non salvano. L’elenco viene riletto subito dopo il salvataggio.

Si riusano la sessione, la selezione, la Server Action Admin e la RPC già
pubblicate. Anche una prima registrazione usa la revisione letta: una modifica
concorrente impone una nuova lettura e conferma. Il doppio clic è bloccato;
un esito incerto conserva esattamente richiesta/UUID per il retry. Nessuna
migration, modifica a QR/iscrizioni, stampa o email.

## Verifiche

- 895 test applicativi; ESLint, TypeScript, build production con `npm ci` in
  copia pulita e senza file ambiente reali.
- `tests/browser/event-presence-editor.mjs`: apertura senza scritture,
  prima registrazione, annullamento, minori distinti, aggiornamento elenco,
  focus/Escape, doppio clic, conflitto, retry idempotente, revoca e controllo
  identità; tabella reale Admin/Manager/Viewer e desktop/mobile.
- `tests/browser/usb-reception.mjs`: regressioni scanner e stampa simulata.
- `tests/sql/run-reception-checks.mjs`: RPC, ruoli, revisioni, retry, audit e
  concorrenza su PostgreSQL temporaneo con dati sintetici.

Commit e push su main autorizzati dall’utente, con il normale deployment Git
Vercel. Nessuna scrittura su presenze reali per collaudo. Le modifiche simultanee
alla scelta dispositivo dello scanner e i verbali hardware precedenti non
appartengono a questo rilascio.
