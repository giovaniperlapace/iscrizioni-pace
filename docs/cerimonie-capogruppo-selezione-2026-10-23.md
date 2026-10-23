# Cerimonie capogruppo: ordine e scelta dei destinatari — 23 ottobre 2026

## Comportamento

- L’elenco iniziale e i risultati della ricerca danno precedenza alle persone
  con presenza dichiarata `yes` nel giorno e nella fascia della cerimonia
  selezionata. L’ordine viene applicato prima delle pagine da 100.
- La scelta proviene dalla RPC canonica, distinta per piano: per inaugurazione
  usa il 25 ottobre pomeriggio (oppure giornata intera), non il mattino. Finale
  e altre configurazioni seguono giorno/fascia del proprio piano, in ora Roma.
- A parità di precedenza si conserva l’ordine originale per cognome e famiglia.
  I minori ereditano l’indicazione della relativa iscrizione, ma la selezione
  per assegnare loro un posto resta esplicita.
- Presenza confermata, assenza dichiarata e dato da comunicare appaiono già
  nella riga, senza aprire schede. Assenti e persone senza dichiarazione
  rimangono selezionabili secondo le regole preesistenti.
- «Scegli una dotazione» diventa «1. Scegli i posti ricevuti»: schede radio
  con settore, gruppo, quantità ricevuta, assegnata e disponibile. Settore
  scelto evidenziato; riepilogo con data/ora Roma e sede della cerimonia.
- «2. Scegli le persone» spiega la precedenza e mantiene ricerca, selezione
  della pagina, minori espliciti e paginazione.
- «Biglietti da assegnare» mostra gruppo/settore, conteggi, nominativi in
  schede e pulsanti «Rimuovi». Usa colori, bordi e pulsanti del sito; singola
  colonna mobile e due colonne desktop. Avviso se si supera il numero di posti.
- Testi aggiornati in tutte le sette lingue, inclusi vuoto, revoca ed errori
  che prima parlavano di dotazione.

## Conservazione e verifiche

Nessuna migration, modifica ai permessi, selezione automatica di persone,
nuovo polling o chiamata aggiuntiva al database. Salvataggio, conferma finale,
revoca e retry con identica richiesta conservati. Cambio settore azzera la
selezione come prima; una ricerca conserva i nomi scelti.

- `npm test`: 1.081 test superati nella working copy al momento della verifica.
- Nuovo test: presenza specifica per apertura/finale, precedenza globale anche
  oltre 100 persone, ricerca, ordine stabile, figli, scope gruppo, assenze e
  dati mancanti senza blocco dell’assegnazione.
- Browser sui componenti originali e PostgreSQL temporaneo: nominativo 100
  portato tra i primi per presenza `yes`, persona presente solo al mattino
  ancora indicata assente al pomeriggio, ricerca, rimozione dal riepilogo,
  assegnazioni 20/80, sette lingue, desktop 1440px e telefono 390px, nessun
  overflow orizzontale o errore JavaScript.
- Suite SQL e concorrenza cerimonie superate, comprese le regressioni Manager
  e le assegnazioni/revoche su dati sintetici.
- ESLint dei cinque file modificati superato. Il lint generale resta fermo
  sui tre `no-explicit-any` e un warning preesistenti in
  `tests/ceremony-navigation.test.mts`.
- Build production Webpack e TypeScript in copia isolata di HEAD più le sole
  modifiche di questa richiesta, senza credenziali operative. Il typecheck
  della working copy condivisa al primo controllo segnala `schools` non
  definito in `tests/forum-waitlist.test.mts:121`, modifica parallela non toccata.

Inclusione nel commit/push su main autorizzata esplicitamente dall’utente il
23 ottobre, insieme ai QR scuole. Ripetuti congiuntamente nella copia isolata
preparata per il commit: 1.075 test, lint dei file coinvolti, TypeScript, build
production Webpack, SQL/concorrenza e browser originale desktop/mobile nelle
sette lingue, tutti superati. Il precedente errore `schools` della working copy
è stato corretto nella lavorazione scuole. Nessuna migration necessaria per
questa UI e nessuna assegnazione reale di prova. Le altre modifiche locali
sono conservate; dettagli del rilascio in `scuole-qr-ingressi-email-2026-10-23.md`.
