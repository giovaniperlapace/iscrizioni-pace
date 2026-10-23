# QR scuole, email e ingressi — 23 ottobre 2026

## Richiesta e comportamento

Un QR opaco stabile per prenotazione/classe, valido per tutti i suoi Forum.
Non vengono create iscrizioni individuali, anagrafiche studenti o presenze
dichiarate nei giorni dell’evento. Statistiche e elenchi degli iscritti continuano
ad attingere alle iscrizioni; studenti e accompagnatori rimangono conteggi scuole.

- Scheda scuola in Partecipanti → Scuole (Admin/Manager): «Visualizza QR», poi
  download PNG; lettura autenticata HTTP `private, no-store`, senza navigazione
  né polling. RLS del token conserva esclusione Viewer e accesso del docente
  proprietario. La pagina docente mantiene il QR e il download già presenti.
- Scanner generale: legge lo stesso QR, richiede quantità effettive distinte
  per studenti e accompagnatori. Nessuna presenza automatica alla scansione.
- Scanner Forum: solo per QR scuola, «Registra evento e ingresso al Forum»
  quando manca l’ingresso generale. Numeri espliciti, anche inferiori alla
  prenotazione. Salvataggio unico atomico dopo controlli di prenotazione,
  incarico, capienza e limiti; revisioni, audit e retry conservati.
- La facoltà congiunta non vale per QR personali, gruppi ordinari o cerimonie.
  Il precedente override personale registra ancora soltanto l’ingresso Forum.
- Un evento già registrato resta invariato; un secondo Forum registra soltanto
  il proprio conteggio. Correzione/revoca Forum non modifica l’evento. Nessuna
  somma automatica di classi/arrivi parziali non identificabili nominalmente.
- Un vecchio ingresso Forum senza evento può essere completato con gli stessi
  conteggi già registrati; valori differenti vengono respinti senza effetti.

## Email

`20261023151000_school_qr_delivery.sql` introduce una coda service-only, una riga
per prenotazione. Le prenotazioni attive dell’evento corrente già esistenti sono
accodate per l’avviso richiesto; nuove prenotazioni pubbliche e della gestione
sono accodate nella transazione di salvataggio. Gli aggiornamenti non duplicano
la conferma. Prenotazioni annullate o senza Forum attivi non ricevono email.

La conferma contiene scuola/classe, studenti/accompagnatori prenotati per ogni
Forum, data/ora Roma, QR PNG allegato e inline, accesso docente e istruzione a
mostrare il codice anche direttamente al Forum. Si riutilizza il token esistente;
solo una prenotazione senza alcun token ne riceve uno nuovo. Token revocati,
scaduti, non decifrabili o incoerenti bloccano l’invio, senza rigenerazione tacita.
Il link `/scuole/accesso` consente al docente di chiedere un accesso aggiornato.

Dopo approvazione del testo: invio dopo creazione e recupero tramite il cron autenticato esistente.
Fino ad allora, `school_booking_email_control.enabled=false` impedisce ogni claim,
compresi cron, creazioni nuove e script manuale. Il blocco è verificato anche in SQL.
La sua attivazione richiede la successiva approvazione esplicita dell’utente.
Claim atomico `SKIP LOCKED`, finestra di lavoro di 45 secondi, massimo dieci email.
Esiti `accepted` (API Postmark, non prova di consegna), `failed`, `uncertain`,
`skipped`; destinatario storico e MessageID quando disponibile. Una richiesta
interrotta diventa incerta e non viene rispedita automaticamente. Errori di
risposta Postmark e timeout non comportano invii ciechi. La modalità `log` non
consuma la coda. Invii falliti/incerti richiedono verifica e recupero deliberato.
Un trigger acquisisce i successi del vecchio invio immediato durante il passaggio
tra le versioni, senza sopprimere l’avviso per le conferme storiche.

Operazioni disponibili dopo il rilascio (senza indirizzi/token nei log):

```sh
# Solo riepilogo della coda
node --env-file=.env.local scripts/school-qr-delivery.mjs
# Invio richiesto delle righe ancora accodate; mai accepted/uncertain
node --env-file=.env.local scripts/school-qr-delivery.mjs --send
```

## Verifiche

- Lettura production soltanto: 6 prenotazioni attive, 104 studenti, 15
  accompagnatori; 6 QR attivi e 6 precedenti audit di conferma email.
  Nessun nominativo, indirizzo o token riportato nel verbale.
- 1.075 test applicativi superati nella copia isolata delle sole modifiche
  scuole e cerimonie capogruppo da pubblicare, inclusi decodifica del PNG allegato, escaping,
  singolo invio, timeout/risposta incerta, annullamento, QR incoerente, modalità
  log, separazione permessi e identità del retry.
- PostgreSQL locale temporaneo con tutte le migration: QR stabile, coda/claim,
  quantità ridotte, atomicità, rifiuto su persone, replay, secondo Forum,
  correzione/revoca indipendente, conservazione conteggio iscritti e ACL.
  Concorrenza tra accoglienza generale e Forum: una sola riga evento e una Forum.
- Browser sul codice originale in copia senza credenziali reali: componente QR
  → API/RLS → token → PNG/download; scanner USB → HTTP → PostgreSQL → evento +
  Forum per 8 studenti su 10; scanner generale rilegge 8 + 1; telefono 390px e
  desktop 1440px, nessun overflow. Nessuna email o presenza reale di prova.
- TypeScript, lint dei file coinvolti, build production isolata con variabili
  sintetiche e `git diff --check` superati.
- Lint generale: tre errori `no-explicit-any` e una warning nel preesistente
  `tests/ceremony-navigation.test.mts`, non toccato.
- Il browser completo precedente si ferma sull’attesa del testo di successo
  del dialogo ruoli (prima del percorso scuole). Il collaudo mirato scuole passa
  con `SCHOOL_QR_ONLY=1` nel runner esistente.

## Stato al momento del commit — 23 ottobre 2026

L’utente ha autorizzato commit/push su main e le migration, includendo poi anche
il menu di assegnazione posti del capogruppo. Ha rinviato l’invio delle email
alla successiva approvazione del testo. Nessuna email reale inviata da questa lavorazione.

Backup production in formato custom verificato con indice e decodifica completa:
`/root/backups/iscrizioni-pace/production-before-school-qr-20261023-162924.dump`,
20.775.615 byte, permessi 600, SHA-256
`40b07c1ebdd6dfd007a4947cf57250c39c0796669ff29f9d0ee1d5091f6aba7b`.

Migration applicate e registrate atomicamente:
- `20261023150000`: 68 tabelle / 210.359 righe invariate, 225 definizioni/ACL
  conservate salvo il corpo previsto di `reception_panel_check_in`.
- `20261023151000`: 68 tabelle preesistenti / 210.369 righe e 225 definizioni/ACL
  conservate; nuove tabelle di controllo/coda, funzioni e trigger previsti.

Confronti dentro transazioni repeatable-read, digest di tutte le righe delle
tabelle preesistenti e metadati/ACL delle funzioni. Il traffico ordinario spiega
la differenza fra i due conteggi. Nessuna presenza reale di prova.
Invio disabilitato; sei prenotazioni accodate, sei QR preesistenti riutilizzati.
Il testo da approvare è `renderSchoolBookingConfirmationEmail` in
`lib/email/templates.ts`, con QR PNG allegato e mostrato nel messaggio.

Build production Webpack, TypeScript, ESLint sui file coinvolti, 1.075 test,
SQL/concorrenza e browser scuole + cerimonie superati sulla copia del contenuto
esatto preparato per il commit, senza credenziali operative. La verifica del
deployment dopo push viene comunicata all’utente a fine rilascio.
Le modifiche locali agli incarichi e alle fasce dell’accoglienza restano escluse.
