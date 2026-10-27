# Aggiornamento piantina dopo pubblicazione — 27 ottobre 2026

La segnalazione corretta riguarda la piantina Admin/Manager dopo «Conferma
posti e invia notifica ai partecipanti»: i posti pubblicati ai gruppi devono
passare dalle bozze ai posti da abbinare da parte del capogruppo.

## Causa riprodotta e correzione

L'aggiornamento rileggeva sia la directory degli iscritti sia la piantina,
con due RPC successive. Un errore della directory o una revisione differente
fra le letture invalidava l'intera risposta, anche quando la piantina era
disponibile e la pubblicazione già riuscita. Lo stato locale restava precedente.
Il test di regressione ha riprodotto HTTP 503 al posto del nuovo snapshot.

La stessa rotta privata `/dashboard/ceremonies/sectors` accetta `view=map`:
controlla ruolo ed evento e legge soltanto `get_ceremony_draft_desk`.
La vista generale usa questa modalità dopo pubblicazione, revoca e con
«Aggiorna disponibilità». Le modali continuano a richiedere mappa e directory
alla stessa revisione. Nessun contatore ottimistico o valore stimato.

Gli errori di rilettura hanno uno stato separato dagli esiti delle operazioni.
Se fallisce la mappa, viene indicato esplicitamente che non è aggiornata;
«Aggiorna disponibilità» rilegge soltanto, senza ripubblicare o riaccodare email.

## Verifica

- Test della rotta: errore directory riprodotto prima della correzione, poi
  snapshot aggiornato; ruolo/evento, errore del desk e controllo delle revisioni
  della directory conservati.
- Browser desktop 1440px e telefono 390px, componenti reali e PostgreSQL
  temporaneo: pubblicazione da pulsante di 28 posti per gruppo, poi altri 28;
  la piantina passa subito da 28 bozze a 28/56 posti gialli da abbinare.
  Directory resa indisponibile durante la pubblicazione per riprodurre il caso.
- Errore della sola mappa simulato, messaggio visibile e recupero verificato;
  conteggi SQL di assegnazioni e notifiche invariati durante il recupero.
- 1.225 test applicativi, TypeScript, lint mirato e build production in copia
  isolata passati. Screenshot esaminato; log in `output/ceremony-map-refresh/`.

## Stato e limiti

Commit e push su main richiesti dall’utente il 27 ottobre, insieme alla
selezione predefinita della cerimonia finale. Rilascio tramite integrazione Git
Vercel; verifica dello stato e del commit del deployment dopo il push.
Nessuna migration, pubblicazione di posti reali o consegna email di prova.
La consultazione dei log Vercel dell'ultima ora non ha restituito richieste
per questa rotta: il meccanismo è riprodotto nei test, ma non è possibile
attribuirlo con certezza alla specifica operazione segnalata in produzione.
La modifica già richiesta per aprire la cerimonia finale di default è conservata.
