# Settore F: Sala Maschiella in collegamento

Richiesta del 25 ottobre 2026. Rilascio autorizzato: commit/push, verifica deployment, poi backup verificato
e applicazione della migration in produzione.

Il nome canonico diventa `F: Sala Maschiella in collegamento`: le viste che
aggiungono «Settore» mostrano esattamente «Settore F: Sala Maschiella in
collegamento», senza duplicare il prefisso. Codice layout `F`, UUID, capienza
500, limite assegnabile, quote, assegnazioni, bozze e mappe conservati.

La piantina per settori identifica e posiziona F tramite `layoutCode`, anche
quando il nome cambia, e usa il nome canonico nell'intestazione della sala.
La panoramica precedente usa lo stesso nome nel pulsante della sala collegata.
Il nome lungo può andare a capo nella colonna mobile.

La migration `20261025100000_opening_relay_sector_name.sql` riguarda soltanto
l'inaugurazione corrente con layout `assisi-opening-2026`. Usa il lock canonico,
verifica F non numerato a 500 posti, aggiorna il solo nome, incrementa la
revisione e aggiunge un audit. Retry sul nome definitivo senza nuove modifiche;
nome inatteso bloccante. Nessuna modifica alle email già accodate/inviate.
Le nuove letture e le future notifiche usano il nome aggiornato.

## Verifiche

- 1.133 test applicativi passati, compreso il rendering dei componenti originali:
  F una sola volta nella sala separata, 500 quadratini, nome completo in entrambe
  le piantine.
- TypeScript e lint dei due componenti modificati passati.
- Build production con webpack passata in copia isolata, dipendenze locali
  condivise e configurazione sintetica; nessuna credenziale production copiata.
- Suite SQL e concorrenza delle cerimonie su PostgreSQL temporaneo passata.
  Il nuovo test confronta integralmente mappe, claim, nomine, riserve, bozze,
  richieste e coda email, e verifica letture Admin/Manager e capogruppo,
  incremento revisione, retry senza doppio audit e rollback per nome inatteso.
- Checklist React applicata: identificazione stabile, nessun nuovo effetto,
  stato o fetch; label accessibili e wrapping del testo conservati.

## Ordine di rilascio

Pubblicare prima il codice che identifica F tramite layoutCode, verificare
il deployment, poi applicare la migration dopo backup verificato e conferma
dell'ambiente secondo `docs/supabase-workflow.md`. La vecchia piantina cerca
il nome esatto F e non deve ricevere il nuovo nome prima dell'aggiornamento.
Il bootstrap storico e le fixture iniziali restano invariati.
