# Figli accompagnati nella gestione iscritti

La vista `section=iscritti&view=children` è condivisa da Manager e Admin,
accanto a Partecipanti, Duplicati e Senza gruppo. I permessi della sezione
restano invariati, compresa la consultazione del Manager Viewer.

- Una riga per ogni figlio, anche sopra i 14 anni; il genitore effettivamente
  collegato è espandibile con tastiera e apre la scheda operativa esistente.
- Una seconda tabella contiene esclusivamente le iscrizioni principali con
  età nota inferiore a 15 anni all'inizio dell'evento. Non richiede un account
  Auth: comprende inserimenti assistiti e iscrizioni effettuate da un genitore.
- Nome del figlio/iscritto/genitore, email del referente e gruppo sono ricercabili;
  il filtro gruppo usa l'ID, con opzione Senza gruppo. Parametri dedicati
  preservati durante apertura e chiusura della scheda, azzerati cambiando menu.
- I tre indicatori riguardano l'intero evento prima dei filtri; le intestazioni
  delle due tabelle indicano il numero di righe filtrate. Date mancanti, non reali
  o future non diventano età zero. Nessuna deduplicazione per nome o email.
- I dati provengono dallo snapshot già autorizzato e paginato dei partecipanti;
  niente nuove query, migration, scritture, email o cambi di ruolo.

Le statistiche specificano che persone complessive, gruppi, presenze e fasce
anagrafiche includono i figli accompagnati. Partecipanti iscritti e andamento
settimanale li escludono. Le presenze dei figli seguono quelle del genitore.

## Verifica

`tests/children-overview.test.mts`: relazione esatta figlio/genitore, figli più
grandi, quindicesimo compleanno, neonati, account assente, date non valide,
assenza della data evento, iscrizioni eliminate e scope evento.

`tests/browser/children-overview.mjs` su server locale e fixture sintetica:
Manager/Admin, menu attivo, due tabelle distinte, espansione con Enter, scheda
in sola lettura, chiusura Esc, ricerca, filtro Senza gruppo e desktop/mobile.
Il test non autentica utenti reali né collauda scritture sul database.

Rilascio integrato con la città obbligatoria autorizzato il 24 settembre tramite
commit/push su main. Verificati 537 test, lint, TypeScript e build con npm ci
in copia pulita. La fixture browser include ora un genitore senza data di
nascita, città ed email: scheda consultabile e figli conservati per entrambi
i ruoli, desktop/mobile. Nessuna modifica delle iscrizioni storiche.
