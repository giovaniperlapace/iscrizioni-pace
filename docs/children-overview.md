# Figli accompagnati nella gestione iscritti

La vista `section=iscritti&view=children` è condivisa da Manager e Admin,
accanto a Partecipanti, Duplicati e Senza gruppo. I permessi della sezione
restano invariati, compresa la consultazione del Manager Viewer.

- Una riga per ogni figlio, anche sopra i 14 anni; il genitore effettivamente
  collegato compare nella colonna Genitore, dopo Data di nascita ed Età.
  Il nome è un link, attivabile anche da tastiera, alla scheda operativa esistente.
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
Manager/Admin, menu attivo, due tabelle distinte, colonna Genitore e apertura con Enter, scheda
in sola lettura, chiusura Esc, ricerca, filtro Senza gruppo e desktop/mobile.
Il test non autentica utenti reali né collauda scritture sul database.

Rilascio integrato con la città obbligatoria autorizzato il 24 settembre tramite
commit/push su main. Verificati 537 test, lint, TypeScript e build con npm ci
in copia pulita. La fixture browser include ora un genitore senza data di
nascita, città ed email: scheda consultabile e figli conservati per entrambi
i ruoli, desktop/mobile. Nessuna modifica delle iscrizioni storiche.


## Tabella partecipanti ed Excel — 25 settembre 2026

Nella tabella partecipanti Manager/Admin/Viewer i figli sono sempre visibili
sotto il genitore, come già per il Capogruppo. Rimosso il pulsante di attivazione.
La vista dedicata Figli accompagnati usa invece la colonna Genitore cliccabile.

Manager/Admin e Capogruppo possono selezionare «Informazioni sulla disabilità»
tra le colonne visibili ed esportabili. Il riepilogo usa soltanto le risposte
booleane dichiarate in `accessibility_needs.washington_group_answers`, con le
etichette del form: udito, camminare/gradini e ausili per la mobilità. Il modulo
attuale non raccoglie una voce visiva. Nessuna diagnosi dedotta, né inclusione
della distinta richiesta di ricontatto; assenza di selezioni rappresentata da —.
Capogruppo: descrizioni nelle sette lingue, sole iscrizioni correnti dei gruppi
autorizzati. Viewer: colonna esclusa da UI, preferenze e API anche con URL alterato.
Letture paginate e bloccanti su errore; nessuna scrittura dei dati o modifica RLS.

Gli export operativi e Capogruppo aggiungono sempre, anche senza righe:
- Numero dei figli accompagnati (0 quando assenti).
- Nomi e cognomi dei minori accompagnati, in una cella separati da `; `.

Si conserva l'intero elenco collegato, senza escludere figli storici per età;
ordine per posizione, nomi completi e celle letterali protette da formule.
Intestazioni e descrizioni lunghe vanno a capo nell'Excel. Il modello di import
non cambia. Commit/push su main autorizzati dall’utente il 25 settembre.

Regressioni: `participant-accessibility-export.test.mts`, export operativo e
handler Capogruppo; fixture `tests/browser/participant-accessibility-export.mjs`
per figli sempre visibili, scelta colonne, Viewer, sette lingue e mobile.
