# Lista d’attesa Forum: un’ora per confermare

Su richiesta dell’utente il termine per accettare un posto disponibile passa da
30 a 60 minuti, sia nell’area personale sia per il capogruppo.

La migration `20261020143000_forum_waitlist_one_hour` aggiorna le due funzioni
canoniche: promozione della coda e claim della notifica. Conserva FIFO,
selezione esplicita dei minori, prenotazioni, controlli di accesso e gestione
delle scadenze. I testi web e delle email sono aggiornati nelle sette lingue.

Verifiche: 54 test applicativi mirati; suite PostgreSQL temporanea con controllo
della durata alla promozione e al claim, scadenza, FIFO, minori e concorrenza;
lint, build production e TypeScript in copia isolata dai lavori paralleli.
Nessuna email o prenotazione reale di prova.

Migration applicata e registrata atomicamente in produzione dopo backup custom
verificato (12.980.161 byte, SHA256
`fbc77768a5aab7e65c3b3832cb36580a70238ead57453950bbe1e4c22a6f3bb3`).
Confronto integrale prima/dopo: 64 tabelle, 134.516 righe e ACL/proprietari delle
194 funzioni esistenti invariati. Lista d’attesa vuota, nessuna offerta preesistente
da estendere. Modalità Forum `internal` conservata.
