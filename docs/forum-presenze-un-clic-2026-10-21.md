# Forum: presenza con un clic e disponibilità

Rilascio del 21 ottobre 2026, autorizzato dall’utente insieme a tutte le modifiche locali.

- Catalogo pubblico e area personale: il badge Completo non mostra il numero
  dei posti. I Forum disponibili conservano il conteggio positivo.
- Dopo un errore di presenza, il pulsante personale conserva Forum, sezione,
  intento (prenotazione/coda/accettazione) e minori selezionati. Mostra la fascia
  Rome e richiede un clic esplicito per confermare presenza e richiesta.
- Nuova RPC authenticated con controllo proprietario, evento aperto e chiamata
  alla prenotazione canonica. Aggiornamento della sola mezza giornata, audit,
  rollback anche per gli esiti soft expired/available. Le scelte unknown delle
  altre fasce vengono temporaneamente rimosse nella transazione e ripristinate
  integralmente per non allargare il requisito di presenza alle altre giornate.
- Migration necessaria prima del codice:
  20261021150000_forum_attendance_booking.sql.

Verifiche sul codice integrato con origin/main: 1.013 test applicativi e suite
SQL completa su PostgreSQL temporaneo superati, inclusi rollback della presenza,
proprietà dell’iscrizione, conservazione delle altre fasce e concorrenza Forum.

Migration applicata e registrata atomicamente in produzione prima del codice.
Backup custom verificato con lettura completa:
`/root/backups/iscrizioni-pace/production-before-forum-attendance-booking-20261021.dump`
SHA-256 `24f70a7277b6a1e40f643a179ae54c47bc70a8a01f9f67c4b2fe9d467c5541f1`.
La migration aggiunge soltanto la funzione e i relativi permessi; non esegue DML
sui dati operativi. Verifica READ ONLY: funzione SECURITY DEFINER con search_path
fisso, esecuzione authenticated ammessa e anon esclusa; Forum open e scuole attive.
Nessuna prenotazione, presenza o email reale di collaudo.

Incluse anche le modifiche locali ai testi dell’email di conferma in sette lingue
e la documentazione del ripristino SSH. Integrati i quattro commit remoti già
pubblicati, conservando le funzioni Accoglienza e il relativo collaudo.

Lint, build production e TypeScript superati. Per il controllo TypeScript sono
state spostate in una cartella temporanea tre copie duplicate dei tipi generati
in `.next/dev/types` (nomi con suffisso ` 2.ts`); nessun sorgente modificato.
