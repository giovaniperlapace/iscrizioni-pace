# Statistiche disponibili

Inventario operativo delle statistiche gia' calcolate o ricavabili dai dati
attuali. Questo file serve a decidere in seguito dove inserirle nella UI senza
riempire le dashboard di numeri ridondanti.

## Gia' calcolate nelle dashboard

### Riepiloghi globali admin/manager rimossi dalla UI

Questi conteggi aggregati sono semplici da calcolare sommando gli snapshot
evento, ma sono stati rimossi dalle dashboard operative perche' duplicano la
sezione "Apertura e monitoraggio":

- Eventi aperti o eventi gestibili.
- Iscrizioni totali/visibili su tutti gli eventi nello scope.
- Elementi "da controllare" aggregati, come somma di senza gruppo corrente, QR
  mancanti ed errori email recenti.

Se verranno reintrodotti, dovrebbero vivere in una vista dedicata o in alert
mirati, non come fascia generica in cima alla pagina.

### Apertura e monitoraggio evento

Fonte principale: `summarizeRegistrationMonitoring` in
`lib/registrations/opening-monitoring.ts`.

- Iscrizioni totali per evento.
- Iscrizioni inviate (`submitted`).
- Iscrizioni annullate (`cancelled`).
- Iscrizioni nelle ultime 24 ore.
- Iscrizioni senza gruppo corrente.
- Assegnazioni gruppo da verificare (`probable`).
- Gruppi scelti direttamente dal partecipante.
- Gruppi assegnati da regola.
- Nuovi partecipanti assegnati a nodi newcomers.
- QR mancanti.
- Richieste di supporto operativo.
- Email duplicate nello stesso evento.
- Errori email nelle ultime 24 ore, da `audit_logs`.
- Stato apertura evento: non pubblicato, programmato, aperto, chiuso.

### Dashboard manager/admin, iscritti

Fonte principale: `summarizeOperationsDashboardParticipants` in
`lib/registrations/operations-dashboard.ts`.

Questi conteggi sono disponibili ma sono stati rimossi dalla UI iscritti perche'
troppo generici:

- Righe caricate nella tabella operativa.
- Righe visibili dopo i filtri.
- Iscritti senza gruppo.
- Iscritti con gruppo da verificare.
- Iscritti con ruoli operativi.
- Iscritti senza email.

### Dashboard manager/admin, gruppi

Fonte: dati `groups` e `group_registration_links`.

- Gruppi visibili dopo i filtri.
- Gruppi iscrivibili (`is_assignable`).
- Gruppi visibili nel form pubblico (`is_public_catalog`).
- Link riservati attivi.
- Stato accesso iscrizione per gruppo:
  - nel form pubblico;
  - solo con link;
  - non iscrivibile.

### Dashboard capogruppo

Fonte principale: `summarizeGroupLeaderAssignments` in
`lib/groups/capogruppo-dashboard.ts`.

- Assegnazioni totali in scope.
- Assegnazioni da leggere/verificare.
- Assegnazioni probabili.
- Assegnazioni confermate.
- Assegnazioni rifiutate.

## Derivabili subito dallo schema

Queste statistiche non richiedono nuove tabelle, ma vanno collocate con cura.

### Iscrizioni e provenienza

- Iscritti per paese.
- Iscritti per citta'.
- Iscritti per paese/citta' e gruppo.
- Iscritti con paese o citta' non normalizzati.
- Nuovi partecipanti vs partecipanti gia' Sant'Egidio.
- Persone che dichiarano di partecipare con un gruppo.
- Persone che dichiarano di non trovare il referente.

### Gruppi e referenti

- Iscritti per gruppo corrente.
- Iscritti per stato assegnazione gruppo.
- Iscritti senza referente principale assegnato.
- Gruppi senza referente principale.
- Gruppi nascosti ma iscrivibili tramite link.
- Link creati per gruppo.
- Link usati per gruppo.
- Link esauriti, revocati o scaduti.

### Presenze e programma

- Presenze previste per giorno evento.
- Presenze sconosciute.
- Scelte per momento/panel.
- Capienza residua per momento, se `capacity` e scelte momento vengono usate.
- Partecipanti senza scelte panel.

### QR e accoglienza

- QR generati.
- QR mancanti.
- QR revocati o scaduti, se vengono usati questi stati.
- Check-in totali.
- Check-in per giorno.
- Check-in per momento.
- Duplicati o tentativi ripetuti sullo stesso QR.

### Email e accesso

- Magic link inviati.
- Magic link falliti.
- Conferme iscrizione fallite.
- Errori email per dominio destinatario.
- Utenti con `auth_user_id` collegato.
- Iscritti senza account auth collegato.

### Ruoli operativi

- Admin globali.
- Manager per evento.
- Manager viewer per evento.
- Accoglienza per evento.
- Capigruppo per nodo/gruppo.
- Utenti con doppio cappello: ruolo operativo e iscrizione personale.

### Accessibilita' e supporto

Da usare solo in viste ristrette e aggregate, senza esporre dettagli sensibili.

- Partecipanti che richiedono supporto operativo.
- Partecipanti con note operative di accessibilita'.
- Richieste supporto per gruppo o paese.

## Da progettare prima di mostrare

- Tassi o percentuali pubbliche, perche' possono essere fuorvianti con numeri
  piccoli o dati incompleti.
- Trend temporali oltre le ultime 24 ore.
- Classifiche gruppi/paesi, da evitare se generano pressione o confronti non
  utili.
- Statistiche su accessibilita' troppo granulari.
- Export aggregati ufficiali post-evento, da legare a policy privacy e
  retention.

## Regola UI provvisoria

Non aggiungere metriche generiche sopra ogni tabella. Prima decidere:

- chi usa quel numero;
- quale decisione operativa abilita;
- se serve come filtro, alert o riepilogo;
- se contiene dati personali o dati sensibili indiretti;
- se il numero cambia con i filtri o rappresenta il totale evento.
