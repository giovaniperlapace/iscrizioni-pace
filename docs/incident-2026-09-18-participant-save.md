# Salvataggio schede personali e operative — 18 settembre 2026

## Due cause distinte

1. `updateParticipantDashboard` leggeva `participants` ed `events` esclusivamente
   come array (`[0]`). Le relazioni molti-a-uno di PostgREST sono oggetti: lettura
   reale in sola lettura confermata il 18 settembre. Il proprietario risultava
   assente e l'azione restituiva `not-found`, convertito nel messaggio generico
   di salvataggio fallito. Il blocco avveniva prima delle scritture, per tutte
   le sezioni della scheda personale.
2. Il modulo condiviso Admin/Manager inviava a
   `/dashboard/admin/participants/update`. `proxy.ts` richiede admin per quel
   prefisso e reindirizza il manager alla propria dashboard con HTTP 307,
   prima dell'esecuzione del route handler. Nei log Vercel di produzione:
   POST su quel percorso il 18 settembre alle 17:35:58.134 UTC, stato 307,
   sorgente `serverless-middleware`, deployment `dpl_2GfskstFPbNjDHof6egJKi4UWr9f`.

## Correzione

- Normalizzazione delle due relazioni con `relatedOne`, compatibile con oggetti
  e array. Controlli di proprietà, cancellazione, scadenza e date mantenuti.
- Letture dei dati preesistenti controllate prima di qualsiasi scrittura:
  un errore non deve trasformarsi in valori vuoti da risalvare.
- Modulo operativo su `/dashboard/participants/update`, con autenticazione,
  controllo origine, validazione e filtro Admin globale/Manager. La RPC
  esistente verifica l'evento specifico, la coppia iscrizione/partecipante e
  l'assenza di eliminazione, con transazione e audit. Nessuna modifica al proxy
  o estensione dei permessi delle pagine admin.
- Vecchia route conservata come alias per moduli admin già aperti. Gli errori
  RPC registrano soltanto il codice tecnico, senza dati personali nei log.
- Percorsi capogruppo e presenze operative già separati e protetti: verificati,
  senza introdurre accesso dei capigruppo alla route operativa Admin/Manager.

## Verifica

- Test dell'intera azione personale, builder Supabase reale e risposte simulate:
  identità, telefono, presenze per i quattro ruoli; relazioni oggetto/array;
  proprietario estraneo, iscrizione chiusa/annullata, giorni esterni all'evento;
  errori di ciascuna lettura senza scritture; figli e accessibilità conservati.
- Test del proxy sul percorso effettivamente usato dal modulo, per Admin/Manager.
- Test della route con NextRequest/NextResponse: salvataggio, ritorno alla
  dashboard, CSRF, dati invalidi, ruoli esclusi e rifiuto della RPC per scope.
- Azione contatti/identità capogruppo: salvataggio autorizzato e blocco prima
  delle scritture per assegnazione non autorizzata.
- PostgreSQL temporaneo PGlite: `participant-operations.sql`,
  `operations-attendance.sql`, `leader-attendance.sql`. Inclusa prova aggiuntiva
  di aggiornamento di un contatto primario già esistente. Scope, ruoli esclusi,
  dati invalidi e rollback verificati dalle fixture.
- Copia pulita `/tmp/pace-save-20260918`, dipendenze da `npm ci`: 409 test e lint
  superati, insieme a build production e typecheck. I file `.next/types/* 3.ts` duplicati del workspace originale
  impediscono il typecheck locale: controlli build/typecheck nella copia pulita.

Nessuna scrittura sui partecipanti reali, migration, modifica RLS o invio email.
Nessun collaudo autenticato di salvataggio sul sito reale. Pubblicazione in produzione autorizzata il 18 settembre, tramite push main/Vercel.
