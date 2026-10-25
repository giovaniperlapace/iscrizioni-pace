# Cerimonie: overbooking per settore — 25 ottobre 2026

Rilascio in produzione autorizzato il 25 ottobre 2026, inclusi backup, migration, commit e push. Migration applicata e registrata; codice `e1ffcf3` pubblicato su `main`, deployment production READY verificato. Nessun invio email, assegnazione o ingresso operativo di prova eseguito.

## Comportamento

Nella modale di ogni settore non numerato, la sezione **Overbooking del settore** permette ad Admin/Manager di impostare un numero esplicito di posti aggiuntivi (zero disattiva la disponibilità aggiuntiva). Il limite tecnico è 10.000, coerente con i comandi delle assegnazioni; nessuna percentuale automatica. Il salvataggio dell’overbooking è immediatamente condiviso, senza inviare notifiche. Dopo il salvataggio si usano i normali destinatari: persona/famiglia, quantità a gruppo o membri selezionati. Bozze, pubblicazione, notifiche e abbinamenti del capogruppo conservano il flusso esistente.

Capienza fisica e quota ordinaria restano invariate, compresi i posti riservati al protocollo. L’overbooking si aggiunge alla quota ordinaria del solo settore scelto; il database richiede una sola quota e un settore non numerato. Non vengono inventate sedie sulla piantina.

Totali cerimonia e modale distinguono capienza reale, posti impegnati (pubblicati e bozze), overbooking previsto e disponibilità complessiva. La modale mostra anche quota ordinaria, posti aggiuntivi impegnati/residui e totale autorizzato. Le schede della piantina hanno un indicatore separato di overbooking, visibile anche su mobile. Una riduzione che non copra più pubblicazioni e bozze viene rifiutata senza modificare dati.

## Accoglienza Forum/eventi

Durante l’incarico della cerimonia, il risultato di un QR personale/familiare mostra **soltanto i settori assegnati alle persone di quel QR**: capienza reale, persone entrate e overbooking previsto. Famiglie in più settori producono più riquadri. Nessun riquadro persistente nel selettore incarichi o nell’intestazione dello scanner, e nessun conteggio di cerimonia durante un incarico Forum o verifica iscrizione.

La RPC rilegge i conteggi nella stessa transazione di lettura, ingresso, retry o rimozione. Non c’è polling. Chiudere il risultato o completare la dissolvenza della fotocamera elimina anche i riquadri. La capienza raggiunta produce un avviso e non un nuovo blocco automatico all’ammissione: l’operatore decide esplicitamente. Titolo valido, ruolo, evento, selezione dei minori e idempotenza restano obbligatori.

`check_ins.ceremony_sector_id` memorizza il settore al momento dell’ingresso: revocare o riassegnare il biglietto successivamente non sposta una persona già entrata nei conteggi. La rimozione dell’ingresso libera il relativo conteggio; una nuova ammissione usa il settore corrente. Gli ingressi contano persone, inclusi i minori, senza duplicare i retry.

## Database e rilascio

Migration: `supabase/migrations/20261025120000_ceremony_overbooking.sql`.

- Nuovo campo `ceremony_sectors.overbooking`, inizialmente zero; nessuna assegnazione o coda email creata dalla migration.
- Nuova RPC service-only `set_ceremony_overbooking`: ruolo/evento corrente riletti, lock evento 1381 e revisione canonica, ricevuta richiesta con fingerprint attore/operazione, audit e controllo su bozze/pubblicati.
- Budget condiviso `app.ceremony_quota_budget` usato nei percorsi di assegnazione, creazione/modifica delle bozze e pubblicazione. Quote fisiche e guardie delle mappe non vengono alterate.
- Lettura manager estesa con `baseAssignable`, `overbooking` e residuo complessivo; il reader bozze continua a sottrarre le bozze.
- Snapshot settore sugli ingressi e indice parziale per i conteggi. Gli ingressi preesistenti vengono attribuiti tramite la nomina attiva corrispondente nella stessa cerimonia. Se un ingresso attivo non è riconciliabile, la migration si arresta integralmente: occorre ricostruirne il settore prima del rilascio. L’attribuzione degli ingressi anteriori alla migration usa le assegnazioni attuali, non ricostruisce eventuali spostamenti storici non registrati.
- Nessuna estensione dei permessi di utenti anonimi/autenticati sulle nuove RPC. Le proiezioni reception validano numeri, forma e unicità dei settori.

La migration **è stata applicata e registrata in produzione** in un’unica transazione, dopo backup completo remoto verificato. Le guardie hanno confrontato **74 tabelle, 264.037 righe originarie e 240 funzioni preesistenti**, conservando dati originali, ACL, proprietari, RLS, policy e trigger esistenti; sono cambiati soltanto i corpi delle cinque RPC previste. Il wrapper con guardie è stato verificato anche su PostgreSQL temporaneo, inclusi backfill e rollback per ingresso non attribuibile.

Backup: `/root/backups/iscrizioni-pace/production-before-ceremony-overbooking-1792928405.dump`, 26.233.517 byte, permessi 600, elenco e lettura completa con `pg_restore` riusciti. SHA-256: `59d347e2c364f79f9fa47d2f59b0c94cbecfdc9a5017d90323a87d6721373270`. Il backup è rimasto sul server.

Verifica produzione: lettura manager autorizzata, 8 settori inaugurazione, capienza fisica 3.640, overbooking iniziale zero; lettura reception con la sola operazione `inspect` verifica i nuovi dati del settore del QR, senza registrare ingressi. Cerimonia finale non configurata. Nuova RPC disponibile soltanto a service_role; nessun ingresso cerimonia attivo al controllo. Le letture canoniche richiedono lock condivisi, quindi sono state eseguite in transazione ordinaria conclusa con rollback, senza chiamare operazioni di mutazione.

Il rilascio esclude le modifiche concorrenti relative all’apertura dell’accoglienza alle 13:30 (`20261025130000`, già registrata in produzione).

## Verifiche

- `npm test`: **1.136 test passati**, compresi parser overbooking, contatori con protocollo/bozze ed estrazione dei conteggi reception.
- TypeScript e lint mirato di tutti i file modificati: passati.
- `npm ci`, TypeScript e build production in copia isolata, senza file `.env` reali e con endpoint locali sintetici: passati.
- `node tests/sql/run-opening-ceremony.mjs`: migration completa e regressioni su PostgreSQL temporaneo. Verificati preservazione capienza/mappe/quote, ruolo/Viewer/capogruppo/evento, replay e payload alterato, budget aggiuntivo, riduzioni con posti impegnati, spostamento bozza in settore insufficiente, pubblicazione e revoca, quote di altri settori invariate, conteggi adulti/minori e settori distinti, ingresso/rimozione/retry, conservazione del settore dopo revoca del biglietto, apertura/finale indipendenti e decisione operatore oltre la capienza reale.
- Migration su ingresso preesistente: attribuzione corretta; ingresso attivo non attribuibile: errore con rollback completo.
- Concorrenza: modifiche simultanee all’overbooking e ultimo posto aggiuntivo, una richiesta salvata e una in conflitto; conservate regressioni di assegnazione, revoca, bozze e pubblicazione.
- Browser Chrome, componenti originali e azioni HTTP su database temporaneo: desktop 1440 px e mobile 390 px; salvataggio/retry dopo risposta persa, bozza da 615 su quota 600 + 20, rifiuto riduzione a 14, persistenza alla riapertura, overflow assente. Flusso originale bozze/pubblicazione/notifiche/revoche passato.
- Scanner originale con QR sintetico: numeri 600 / 0 / +20 prima dell’ingresso, 600 / 1 / +20 dopo, ritorno a zero dopo rimozione; dati nascosti prima della lettura e dopo chiusura. Modalità telefono con sorgente camera sintetica: conteggio aggiornato prima della dissolvenza e latch conservato. Nessuna fotocamera fisica o QR operativo usato.

Anteprime locali con dati sintetici, escluse da Git: `output/cerimonie-overbooking-2026-10-25/` (`modale-1440.png`, `modale-390.png`, `accoglienza-1440.png`, `accoglienza-390.png`, `accoglienza-telefono.png`).

## Esito produzione

Commit funzionale `e1ffcf3b226b11aef8deda47e0728747fd1895a9`, push su `origin/main` completato. Deployment Git `dpl_F7VjZ1Q8Xum5KtPSg3gVJRpnGow6` READY, target production, SHA corrispondente e alias `registrationspeace.santegidio.org` verificati. Homepage HTTP 200; pagine manager cerimonie e accoglienza Forum/eventi HTTP 307 verso il login in assenza di sessione. Nessun errore/fatal nei log runtime del deployment al controllo iniziale.

Le prove operative complete sono state eseguite soltanto sul database temporaneo; in produzione sono state controllate migration, preservazione dei dati, autorizzazioni, letture canoniche e disponibilità HTTP. Nessun invio email, assegnazione, modifica di overbooking o ingresso di prova reale. Evidenze locali escluse da Git in `output/cerimonie-overbooking-2026-10-25/`.
