# P13 — report operativo dell’accoglienza

Implementazione locale del 30 settembre 2026, branch `codex/panel-p0-p10`.
Questa tranche completa il report minimo; non certifica la chiusura dell’intera
P13, il collaudo hardware o gli accessi ai panel.

## Contratto del report

In Statistiche, sotto i totali degli ingressi evento, il report mostra:

- previsti e ingressi, distinti fra adulti, minori, studenti, accompagnatori e
  classi/gruppi scuola; totale persone senza sommare anche il numero di classi;
- filtro per giorno e fascia mattina (prima delle 12) / pomeriggio (dalle 12),
  sempre Europe/Rome; ritorno all’intero evento;
- distribuzione oraria degli ingressi ancora validi;
- richieste di ingresso duplicate senza modifiche (`enter/unchanged`), retry
  riconosciuti (`replayed`), correzioni e annullamenti realmente salvati.

Senza filtro i previsti sono tutte le iscrizioni operative e le quantità delle
prenotazioni scuola operative. Con un giorno/fascia i previsti individuali sono
le dichiarazioni `yes`, con i minori collegati; una dichiarazione legacy senza
fascia vale per l’intero giorno. Le scuole sono le prenotazioni operative con
almeno un panel riservato che inizia nella fascia. Ogni prenotazione scuola
contribuisce una sola volta con le quantità della classe, anche se ha più panel:
sono persone previste all’evento, non posti prenotati sommati nei panel.

Gli ingressi filtrati sono quelli registrati in quella fascia e ancora attivi.
Chi è entrato prima non costituisce un nuovo ingresso nella fascia seguente.
Non si ricavano permanenza, uscite o no-show. Correzioni di quantità scuola e
annullamenti aggiornano anche il riepilogo per ora; questo non è un grafico
immutabile degli eventi storici. Le operazioni usano invece l’ora dell’audit.

Il conteggio dei duplicati non pretende di misurare tutte le riletture: l’audit
storico `inspect` non distingue una lettura di persona già presente dall’apertura
di Modifica presenze. Non vengono reinterpretati i log né modificato lo scanner
per inventare quel dato. I retry sono richieste ripetute, non persone aggiuntive;
una correzione salvata conta una volta anche se interessa più componenti.

Nessun punto di accoglienza identificato è attualmente salvato: la UI lo dichiara,
senza spacciare l’operatore o il canale QR/manuale per una postazione fisica.

## Autorizzazione e database

Nuova migration locale `20260930180000_reception_operational_report.sql`:
RPC `reception_operational_report(uuid,date,text)`, `STABLE SECURITY DEFINER`,
`search_path` vuoto, chiamata con client autenticato. Controlla `auth.uid()` e
incarico reale: admin globale o manager/manager_viewer dell’evento richiesto.
Nessun parametro attore, nessun service role nel percorso applicativo.
Anon, accoglienza, capogruppo, partecipante e operatori di altri eventi sono esclusi.

La funzione restituisce solo aggregati: nessun nome, ID iscrizione/minore,
recapito, token, identificativo operatore o audit grezzo. Non amplia le policy
RLS né i privilegi di lettura sulle tabelle. Il privilegio elevato serve a
calcolare i contatori dell’audit anche per viewer senza concedergli l’audit.
La query aggregata non ha il limite PostgREST di 1.000 righe e restituisce un
unico snapshot SQL; i totali generali già esistenti hanno il loro ciclo separato.

`GET /dashboard/attendance/report` valida UUID, giorno e fascia, verifica sessione,
invoca la RPC e proietta/valida la risposta. Errori di autorizzazione diventano
401/403; funzione assente o dati malformati danno indisponibilità, mai zeri.
Risposta `private, no-store`. Polling ogni 10 secondi senza sovrapposizioni,
timeout 15 secondi, sospensione a pagina nascosta, retry su ritorno online.
Revoca/redirect cancellano i dati e bloccano il polling fino a Riprova report.
Cambio filtro nasconde immediatamente la precedente risposta e ignora risposte
tardive, senza navigazione o refresh dei form.

Il 2 ottobre 2026 l’utente ha richiesto commit e push del codice sul branch
Panel. La migration non è applicata in remoto: per attivare il report occorre
applicarla allo staging con richiesta esplicita e verificare la RPC via PostgREST.
Il push avvia la preview applicativa; senza migration il nuovo report mostra
indisponibilità, mentre i totali presenze preesistenti restano indipendenti. Nessuna modifica a main,
production, dati remoti, email, ruoli o scanner in questa tranche.

## Verifiche

Superati 361 test applicativi, lint, typecheck, build staging, suite SQL
PostgreSQL 17 e browser sintetico desktop/mobile (390px), senza errori runtime.

- Test unitari del filtro, della proiezione minima, delle risposte parziali,
  errori di sessione/RPC e risposta appartenente a un altro evento.
- `node tests/sql/run-reception-checks.mjs`: PostgreSQL 17 temporaneo, migration
  canoniche, regressioni P11/P12, concorrenza, RLS della proiezione presenze e
  `reception-report.sql` per aggregati, dichiarazioni, fascia Europe/Rome,
  unità dell’audit, accessi di tutti i ruoli e revoca.
- `node tests/browser/event-attendance.mjs http://localhost:3112`: trasporto
  sintetico e componenti reali, filtri report, previsti/ingressi, ore,
  responsive 390px, aggiornamenti, annullamenti, errori e revoche, conservazione
  dei form aperti. Route di fixture rimossa dal runner.

I test automatici non sostituiscono il collaudo autenticato scanner/seconda
postazione né una prova fisica su telefono.

## Modello proposto per la tranche accessi panel/sala

Il piano richiede di concordare le decisioni aperte che cambiano dati o flusso.
La scelta è stata presentata all’utente mentre veniva completato il report.
Proposta concreta, ancora da confermare prima dell’implementazione:

1. Assegnazioni per utente, evento e singolo panel: `panel_entry` oppure
   `room_assistance`, gestite e revocabili da admin/manager; viewer in sola lettura.
   Riutilizzare account esistenti, senza attribuire il ruolo evento `accoglienza`.
2. Elenco dei soli incarichi autorizzati; selezione prima dello scanner. Un unico
   incarico si attiva automaticamente. Nessun cambio durante richiesta o esito
   incerto; cambio esplicito fra operazioni, senza confondere le ultime letture
   di panel diversi.
3. Stesso QR e fallback personale di quattro caratteri. Il server e il DB
   verificano ogni volta assegnazione, evento corrente, panel, prenotazione,
   settore/capienza e ingresso evento. Famiglie: solo componenti selezionati
   ed effettivamente entrati all’evento; scuole: quantità esplicite entro la
   prenotazione e gli ingressi evento. Nessun ingresso evento implicito.
4. La maschera consulta solo nominativo/scuola, panel, sala e settore pertinenti;
   nessuna scrittura, nessun recapito/questionario e nessuna seduta numerata.
5. Check-in panel distinti tramite `moment_id`, con revisioni/retry/audit e tutela
   dei minori. Le query scuola P11 oggi cercano per prenotazione/evento senza
   `moment_id`: prima di estenderle ai panel occorre separarne esplicitamente lo
   scope e verificare la conservazione del flusso evento. La migration deve
   anche separare l’unicità scuola evento da quella scuola/panel.
6. Collaudo obbligatorio su tentativi API fuori incarico, revoca, concorrenza,
   famiglie parziali/scuole, prenotazioni annullate, capienza e assenza di effetti
   sul numero di ingressi evento.
