# Milestone P0 - decisioni e dati pilota panel

Stato: completata il 2026-08-05. L'infrastruttura isolata e' pronta; questo
documento registra le decisioni che
influenzano lo schema P1. I dati seguenti sono sintetici e servono soltanto allo
staging; non rappresentano ancora il programma pubblico definitivo.

## Decisioni gia' confermate

- Le milestone P0-P10 vengono sviluppate su `codex/panel-p0-p10` e unite a
  `main` soltanto dopo il collaudo complessivo della P10.
- Database, Auth e Storage di staging sono separati dalla production.
- In staging le email applicative usano `EMAIL_DELIVERY_MODE=log`.
- Lo stack Supabase staging e' raggiungibile soltanto tramite il proprio
  endpoint HTTPS e contiene tutte le 26 migration canoniche dell'app, senza
  dati personali production.
- Le variabili Vercel necessarie sono limitate allo scope `Preview`. Le URL
  applicative e i redirect Auth verranno collegati al primo deploy stabile del
  branch prima del collaudo dei flussi autenticati.
- `event_moments` resta la fonte canonica del programma e un panel e' un
  momento con tipo `panel`.
- Le sezioni rappresentano quote di capienza per tipo di pubblico, non posti o
  settori fisici.
- La prenotazione individuale e quella scolastica usano funzioni SQL atomiche
  e non possono superare la capienza.
- La prima versione non comprende lista d'attesa, sedute numerate o
  trasferimento automatico di posti fra sezioni.
- La prima versione e' online. Il fallback manuale sara' progettato per QR e
  accoglienza; una modalita' offline richiedera' una milestone separata.

## Catalogo pubblico pilota proposto

| Nome | Canale | Uso |
| --- | --- | --- |
| Iscritti | `individual` | Scelta self-service dalla dashboard partecipante |
| Scuole | `school_booking` | Prenotazione aggregata del docente |
| Ospiti | `internal_assignment` | Assegnazione soltanto da manager/admin |

I codici sono tecnici e stabili; i nomi visibili potranno essere localizzati.
Un tipo pubblico gia' usato non verra' eliminato fisicamente, ma disattivato.

## Fixture sintetica per staging

### Location

| Codice test | Nome | Indirizzo | Capienza |
| --- | --- | --- | ---: |
| `sala-blu` | Sala Blu | Via di Test 1, Assisi | 120 |
| `sala-verde` | Sala Verde | Via di Test 2, Assisi | 80 |

### Panel

Gli orari sono nel fuso `Europe/Rome` e usano date comprese nell'evento
Assisi 2026 già configurato.

| Titolo | Inizio | Fine | Location | Iscritti | Scuole | Ospiti |
| --- | --- | --- | --- | ---: | ---: | ---: |
| Pace e giovani | 2026-10-25 09:00 | 2026-10-25 10:30 | Sala Blu | 70 | 30 | 20 |
| Dialogo tra generazioni | 2026-10-25 09:00 | 2026-10-25 10:30 | Sala Verde | 50 | 20 | 10 |
| Citta' disarmate | 2026-10-25 11:00 | 2026-10-25 12:30 | Sala Blu | 60 | 40 | 20 |

Questa fixture copre panel contemporanei in location diverse, riuso della
stessa location in orari non sovrapposti e distribuzioni di capienza differenti.
I test P1 aggiungeranno casi deliberatamente non validi senza inserirli nel
seed stabile.

## Regole confermate prima della migration P1

1. Un'iscrizione individuale con minori collegati occupa `1 + numero di minori
   attivi`; tutti condividono la stessa scelta panel nella prima versione.
2. La sezione `Ospiti` non e' prenotabile dal partecipante e non e'
   prenotabile dal flusso scuole.
3. Un panel pubblicabile deve avere esattamente una location, inizio, fine e
   almeno una sezione; la somma delle sezioni deve coincidere con la capienza
   della location.
4. Titolo e descrizione restano traducibili a livello applicativo; P1 non
   introduce ancora una seconda anagrafica di traduzioni.
5. Un tipo pubblico disattivato resta leggibile nello storico ma non puo'
   essere aggiunto a nuovi panel. L'archiviazione non e' considerata un caso
   d'uso probabile e non richiede enfasi nella UI: resta soltanto una tutela
   tecnica contro la cancellazione di dati storici.

## Dati minimi proposti per la prenotazione scuola

- scuola, citta' e classe/descrizione del gruppo;
- numero studenti e numero accompagnatori;
- nome, cognome, email e telefono del docente referente;
- consenso/privacy versionato;
- note operative facoltative senza dati degli studenti.

Non vengono raccolti nomi, email o altri identificativi degli studenti. Testo
privacy definitivo e tempi di conservazione richiedono approvazione
organizzativa prima dell'apertura del flusso pubblico P8, ma non bloccano lo
schema strutturale P1.

## Accoglienza e hardware

P0 assume smartphone o tablet recenti, connessione HTTPS e browser aggiornato.
Modelli reali, stampante e formato etichetta verranno scelti e provati nelle
milestone P11-P15; non influenzano le chiavi o i vincoli dello schema P1-P10.

## Criterio di chiusura P0

P0 e' conclusa: le cinque regole sono state approvate e lo staging supera
`npm run staging:verify`. La migration P1 puo' quindi essere sviluppata e
revisionata sul branch panel, senza applicazione in production.
