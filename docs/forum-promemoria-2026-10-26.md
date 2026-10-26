# Promemoria Forum due ore prima — 26 ottobre 2026

## Comportamento richiesto

Promemoria automatico per prenotazioni personali e di gruppo confermate ai Forum
principali e alle sale collegate. Soglia `starts_at - 2 hours`, elaborata dal
cron autenticato esistente: il messaggio parte al primo ciclo utile, con il
normale tempo di svuotamento della coda. Date e orari nelle email: Europe/Rome.

- Email personale prioritaria. In sua assenza, soltanto la delega esplicita
  salvata dal capogruppo, ancora autorizzato secondo il risolutore canonico.
- Su chiarimento dell’utente: **una sola email di riepilogo per capogruppo e
  Forum**, con tutte le persone delegate e i soli minori selezionati.
  Chi ha email propria conserva il promemoria personale, compreso il capogruppo
  per la propria prenotazione. Nessuna deduzione della delega dall’appartenenza.
- Testi nelle sette lingue; lingua personale per il singolo, preferenza del
  profilo capogruppo per il riepilogo, fallback inglese.
- Accanto a data e ora, nei promemoria personali e nei riepiloghi, avviso
  nelle sette lingue: presentarsi con anticipo; dopo l’orario d’inizio della
  conferenza l’ingresso non è garantito. Presente in HTML e testo.
- Titolo, data/ora, sede e indirizzo/città canonici. Riquadro indirizzo prima
  dell’elenco persone; nessun indirizzo della sala principale usato per la
  collegata. Avviso esplicito «SALA COLLEGATA — SOLO IN ITALIANO» e validità
  limitata alla sede prenotata. Mancanza indirizzo bloccante e registrata.
- Su successiva richiesta: rimossi tutti i link di consultazione, in HTML e
  testo, sia personale sia capogruppo. Nessuna dipendenza dall’URL del sito
  e nessuna immagine remota. Istruzioni nelle sette lingue: QR personale già
  salvato sul telefono/stampato, scansione agli operatori, minori con lo stesso
  QR dell’adulto, accoglienza generale da segnalare se non completata. Il QR del
  capogruppo non sostituisce quello degli altri adulti.
- Esclusi lista d’attesa, offerte non accettate, iscrizioni eliminate/annullate,
  Forum non pubblici/non pubblicati, sedi inattive e Forum già iniziati.
  Le prenotazioni scolastiche rimangono nel distinto flusso docente esistente.
- Le prenotazioni personali arrivate dopo la soglia possono essere raccolte
  nei cicli successivi, prima dell’inizio. Il riepilogo del capogruppo viene
  fotografato prima dell’invio e non viene reinviato per deleghe aggiunte dopo.

## Report richiesto

Una email per Forum a **registrationspeace@santegidio.org**, dopo la chiusura
locale della coda, almeno cinque minuti dopo l’ultimo esito e dopo la verifica
Postmark delle email accettate. Gli esiti comprendono:

- email previste e accettate dall’API, personali/riepiloghi distinti;
- consegne al server destinatario comprovate da `MessageEvents`;
- bounce, consegne ancora in attesa, verifiche non disponibili;
- invii falliti, indirizzi sede mancanti, esiti incerti e messaggi non inviati.

Il riepilogo conta **messaggi**, non persone incluse nei riepiloghi. `Delivered`
non significa lettura. Ogni evidenza deve corrispondere al MessageID, allo stream
transactional e al destinatario archiviato; risposte sandbox o incoerenti non
contano come consegna. Il report dichiara l’ora della fotografia: prenotazioni
successive e aggiornamenti delle consegne successivi non sono inclusi.

Letture del provider in lotti limitati (cinque concorrenti, massimo 300 a ciclo),
con claim recuperabile dopo interruzione. Nessun reinvio di email viene causato
alla verifica. Report con claim persistente: un’interruzione dopo il possibile
invio resta incerta, senza duplicazioni automatiche.

## Implementazione e sicurezza

Migration `20261026120000_forum_reminders.sql`:

- impostazioni per evento, coda unica `(panel_id, recipient_key)`, report unico
  per Forum; tabelle con RLS, senza accessi anon/authenticated;
- funzioni service-only per accodamento, claim, autorizzazione prima dell’invio,
  acquisizione delle verifiche e report;
- prenotazione, incarico di sede, evento, orario e famiglia riletti dal DB;
- cambiamenti dopo il claim impediscono il messaggio obsoleto e rinviano la
  preparazione al ciclo successivo, senza aver contattato il provider;
- destinatario, testo/oggetto, payload, MessageID ed esito archiviati; nessuna
  modifica alle prenotazioni, presenze, code di attesa o assegnazioni;
- claim `SKIP LOCKED`, stato sending persistente, interruzioni dopo dieci minuti
  marcate uncertain. Nessun retry automatico degli invii incerti/falliti;
- modalità `log` non acquisisce né consuma messaggi/report reali.

Il nuovo risolutore a lotti riusa le regole canoniche senza una query per persona;
filtri da massimo 100 UUID e paginazione completa. Non cambia i chiamanti
preesistenti del risolutore singolo.

Il cron esegue questa coda e il report insieme alle code preesistenti, isolando
le loro eccezioni. Gli errori HTTP non espongono contatti o dettagli del provider.

## Postmark e prevenzione dell’errore 300

Metadati `forum_reminder_id` e `forum_report_id`, chiavi sotto 20 caratteri e
valori UUID sotto 80; controllo preventivo già presente nel trasporto.
Destinatario singolo, HTML con escaping e stili inline, corpi HTML e testo,
stream transactional canonico, nessun allegato ai nuovi messaggi.

Eseguito `node scripts/verify-forum-reminder-postmark.mjs` con il token ufficiale
**POSTMARK_API_TEST** e soli dati sintetici: personale, collegata, riepilogo di
1.005 persone e report hanno ricevuto risposta positiva, senza errore 300 e
senza alcuna consegna. Lo script forza il token di test e non carica `.env`.
Questa prova valida il payload, non certifica la consegna né la configurazione
operativa del server production.

Fonti ufficiali consultate:
- https://postmarkapp.com/developer/api/overview
- https://postmarkapp.com/developer/user-guide/send-email-with-api
- https://postmarkapp.com/developer/api/messages-api

## Verifiche e anteprime

- **1.177 test applicativi superati**, TypeScript, lint dei file modificati e build
  production in copia isolata da `npm ci`, senza `.env` o dati reali.
- SQL su PostgreSQL 17 temporaneo con tutte le migration canoniche:
  soglia esatta, niente retroattività, cancellazioni, eliminazioni, pubblicazione,
  indirizzo cambiato, minori espliciti, relazione collegata, permessi/RLS,
  interruzioni e nessun reinvio; 1.005 deleghe nello stesso messaggio.
- Dodici connessioni concorrenti per ciascun claim: promemoria, verifica della
  consegna e report acquisiti una volta sola.
- Lotti applicativi oltre 1.000 destinatari, errore su una pagina successiva
  bloccante; provider non disponibile o evidenza incoerente distinta da consegna.
- Lint generale: restano tre errori `no-explicit-any` e un avviso preesistenti
  in `tests/ceremony-navigation.test.mts`.
- `npm ci` inizialmente bloccato da voci transitive mancanti nel lockfile:
  riparati metadati/entry, senza cambiare versioni delle entry già presenti,
  senza rimuoverne e senza modificare package.json. Installazione pulita riuscita.
  Il node_modules del checkout principale manca di pdfkit; verifiche eseguite
  con le dipendenze pulite nella copia isolata.
- Anteprime sintetiche HTML/testo in `output/forum-reminders/` (ignorata da Git).
  Nessuna verifica visiva nel browser: la policy del browser non consente la
  navigazione file://. Contenuti, escaping e payload verificati dai test.

Comandi:

```sh
npm test
npm run typecheck
npm run build
node tests/sql/run-forum-reminders.mjs
node scripts/verify-forum-reminder-postmark.mjs
```

## Stato e rilascio

**Incluso nel salvataggio completo Git richiesto il 26 ottobre.** Nessuna
migration remota, attivazione o invio reale. Il cron verifica prima la presenza
della configurazione e un evento esplicitamente abilitato; se la migration non
è installata o nessun evento è abilitato, entrambe le code nuove restano inattive
e le code preesistenti continuano normalmente. Errori di rete/permessi rimangono
espliciti e isolati. La migration non abilita automaticamente gli invii.

Verifica di integrazione e audit dei rilasci: `docs/git-production-audit-2026-10-26.md`.

Per l’attivazione, dopo autorizzazione al rilascio:

1. Verificare backup completo, schema/funzioni/ACL e dati preesistenti.
2. Applicare e registrare la migration; confrontare i dati e permessi conservati.
3. Pubblicare il codice e verificare deployment, endpoint cron e timer esistente.
4. Controllare in sola lettura sede e indirizzo di tutti i Forum futuri; nessun
   testo inventato per colmare campi mancanti. Verificare mittente/stream live.
5. Inserire/abilitare l’impostazione dell’evento corrente con `enabled_at` fissato
   all’istante reale di attivazione. Solo i Forum la cui soglia di due ore non
   è ancora trascorsa saranno ammessi; niente recupero massivo retroattivo.
6. Verificare primo ciclo, stati della coda, controlli Postmark e report.
   Non usare iscritti reali per prove o reinvii di collaudo.

Disattivazione operativa: `enabled=false` per l’evento interrompe nuovi claim
   e l’autorizzazione delle email non ancora inviate. Gli esiti già ottenuti e
   le ricevute del provider restano conservati.
