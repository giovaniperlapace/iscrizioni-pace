# Email lista d’attesa Forum: lingua di ripiego — 21 ottobre 2026

Quando la lingua è assente, vuota o non riconosciuta, la notifica dell’offerta
usa l’italiano. Lingue valide, normalizzazione e alias esistenti conservati.
Vale per partecipanti e capigruppo; oggetto, testo, HTML e date sono coerenti.
La lingua preferita del partecipante e quella salvata all’inserimento dal
capogruppo restano le fonti canoniche. Nessun aggiornamento dei profili.

Migration `20261021160000_forum_waitlist_italian_fallback`: sola modifica del
ripiego SQL per `notification_locale` mancante del capogruppo (en → it).
Il renderer gestisce anche null, undefined e valori sconosciuti. Nessuna
modifica a prenotazioni, FIFO, durata dell’offerta, destinatari o invii.

Verifiche in copia pulita di main con le sole modifiche richieste:
1.026 test, lint, TypeScript, build production e suite SQL Forum/coda con
PostgreSQL temporaneo, incluse prenotazioni/claim/accettazioni concorrenti.
Dodici nuovi casi confrontano l’intera email con la versione italiana,
per partecipante e capogruppo, conservando l’inglese esplicitamente scelto.

Backup production custom verificato tramite lettura del catalogo e di tutto
il contenuto con pg_restore (nessun ripristino sul database operativo):
`/root/backups/iscrizioni-pace/production-before-italian-fallback-20261021.dump`,
17.506.094 byte, SHA-256
`7085ff81ae6bab061cb4dc981ba7d0ada38856d7b0c72c29cdab80a0a55a15a4`.

Applicazione e registrazione atomiche tramite script canonico con guard nella
stessa transazione: corpo della funzione identico salvo il ripiego; tutte le
altre definizioni app/public, proprietari e ACL conservati. Nessuna chiamata
operativa alla funzione di claim durante le verifiche e nessuna email di prova.

Codice `5584100` pubblicato su main; deployment production
`dpl_Fhf3dshxTjcwrA1MVsotfYpNGYNb` READY, commit esatto verificato, build remota
circa 49 secondi. Alias `registrationspeace.santegidio.org` associato senza errori.
Lettura SQL READ ONLY conferma migration registrata, ripiego italiano e ACL
`postgres`/`service_role` conservati. Nessun errore/fatal nei log del deployment
nel controllo immediato; non equivale a monitoraggio prolungato o invio reale.
