# Recupero campagne e conferma accesso — rilascio 16 settembre 2026

Rilascio autorizzato dall’utente tramite push su main e integrazione Git Vercel.
Migration `20260916120000_email_campaign_recovery.sql` applicata e registrata
in produzione in un’unica transazione: conteggio (3.324) e impronta dei
destinatari invariati. I dati e gli esiti delle campagne precedenti non vengono
riclassificati automaticamente. Il timer viene riattivato dopo la verifica
del nuovo deployment; nessun invio di prova o reinvio storico.
Al rilascio sospendere lo scheduler e lasciare terminare i worker precedenti,
poi applicare la migration, pubblicare il nuovo codice e riattivare lo scheduler.
Non sovrapporre worker vecchi e nuovi: i vecchi non conoscono gli esiti `unknown`.

## Comportamento della coda

- HTTP 429 e manutenzione esplicita Postmark (ErrorCode 100): messaggi rifiutati
  tornano `scheduled`, con pausa globale persistente. Backoff da 60 secondi
  a un'ora; eventuale Retry-After prevale, con massimo 24 ore. Il contatore
  delle pause riparte dopo un giorno senza errori oppure alla ripresa manuale.
- Credenziali, account o stream non validi: `blocked`, nessun tentativo
  automatico finché l'operatore non corregge la causa e riattiva la coda.
- Timeout, errore di rete, risposta incompleta e 5xx senza conferma esplicita
  di manutenzione: destinatari `unknown`, mai riacquisiti dal cron. La pausa
  globale dura almeno cinque minuti; dopo, riprendono solo gli altri messaggi.
- Errori definitivi del singolo destinatario, inclusa suppression 406:
  `failed`, nessun retry né aggiramento sullo stream transazionale.
- Ogni risposta mista conserva gli esiti individuali. Al primo problema
  generale si fermano i sottobatch e i claim successivi. Messaggi non ancora
  sottoposti restano riprogrammabili. Richieste già in volo possono terminare.
- La pausa si registra prima di rilasciare le righe per retry. Se questa
  scrittura fallisce, le righe rimangono `sending`; i successi già accettati
  vengono comunque salvati. Nessuna ripetizione automatica di esiti incerti.
- La dashboard mostra una pausa temporanea o un blocco del servizio; una
  campagna con destinatari `unknown` mostra `Esiti da verificare`.

## Operazioni dopo un'interruzione

Consultare `email_campaign_delivery_control` tramite accesso amministrativo
autorizzato: `blocked`, `paused_until`, `error_code`, `last_failure_at`.
La tabella e le RPC di controllo sono riservate a service_role; non contengono
destinatari, corpi email o token. Dopo aver corretto una configurazione non
valida, una ripresa esplicita usa:

```sql
select public.resume_email_campaign_delivery();
```

Questa RPC NON riaccoda `unknown`, `sending` o `failed`. Prima di recuperare
singoli destinatari in tali stati, riconciliare l'accettazione con Postmark;
il recupero è un'operazione amministrativa separata, mai un reinvio alla cieca.
Le campagne `unknown` possono coesistere con messaggi ancora programmati.

## Conferma dei magic link

La richiesta GET alla callback (incluso HEAD gestito dal framework) non chiama
Supabase e mostra un modulo nativo con un solo pulsante di conferma. Nessun
script, prefetch o verifica automatica; apertura e scansioni ripetute non
consumano OTP o codici PKCE. Il POST richiede lo stesso origin e usa il flusso
di verifica, profilo e assegnazione dashboard già esistente, con redirect 303.
Pagina non memorizzabile, referrer limitato all’origine (mai token/query),
CSP restrittiva; testi nelle sette lingue.
Funziona anche senza JavaScript. Non protegge da scanner che inviano attivamente
il modulo POST come un utente; nessuna promessa di riconoscere tutti i bot.

La generazione richiede hashed_token; non usa più action_link come fallback,
per evitare la verifica preventiva sull'endpoint Supabase. I link applicativi
già inviati alla callback acquisiscono anch'essi la conferma. Link Supabase
diretti eventualmente già spediti non possono essere protetti retroattivamente.

## Verifiche locali

Test `postmark-recovery`, `postmark-batch`, `postmark-worker` e
`magic-link-confirmation`: pause, risposte miste, split interrotto, errori DB,
GET ripetuti senza Auth, POST esplicito, PKCE, token scaduto, origin e sette lingue.
SQL: eseguire su database temporaneo fixture `postmark-campaign-queue.sql`,
migration `20260912180000`, migration `20260916120000`, quindi
`postmark-campaign-queue-assertions.sql` e `email-campaign-recovery.sql`.
Copre 1.205 destinatari, pause globali, backoff, ripresa e privilegi;
PGlite non sostituisce una prova concorrente multi-sessione in produzione.
Verifiche finali: 322 test, lint, typecheck e build production superati.
Browser `tests/browser/magic-link-confirmation.mjs`: build locale con backend
Auth simulato, GET/HEAD senza verifica, sette lingue, desktop/mobile e POST
esplicito con token scaduto. Nessun login o invio reale. La policy strict-origin
evita la perdita dell'header Origin che no-referrer causa nei POST nativi.

Fonti: [errori Postmark](https://postmarkapp.com/developer/api/overview),
[prefetch dei link Supabase](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching).

# Stato di produzione — 15 settembre 2026

Postmark attivo con il rilascio `e74d395`, deployment Vercel
`dpl_8mr9uuYWXvztxnV3yPEm1VxAwXvb` READY su registrationspeace.santegidio.org.
Migration `20260912180000` applicata e registrata atomicamente; hash dei destinatari
invariato e permessi RPC verificati (anon/authenticated negati, service_role sì).
Timer systemd abilitato e prima chiamata riuscita senza destinatari in coda.
Magic link richiesto dal browser dalla produzione a registrationspeace@santegidio.org:
MessageID `6ed819e3-7469-4aaa-a752-c77f986d8ba7`, stream outbound, Delivered con
SMTP Google 250. Callback del login non eseguita. Nessuna campagna reale avviata.
310 test superati; build produzione Vercel riuscita. Pagamento non modificato:
resta da regolarizzare la fattura segnalata in precedenza se ancora insoluta.

Le sezioni seguenti conservano la preparazione e i test precedenti: le indicazioni
"da pubblicare"/"produzione Gmail" sono storiche e superate da questo rilascio.
Il richiamo periodico usa systemd sul server esistente, non Vercel Cron (piano Hobby).

# Invio email con Postmark

Implementazione del 2026-09-12, reintegrata sul codice aggiornato il 2026-09-15. Non ancora attivata in produzione.

## Configurazione verificata

Dominio `santegidio.org`: DKIM e Return-Path risultano Verified in Postmark e
pubblicati nei DNS. DMARC esistente `v=DMARC1; p=reject;` conservato.
Mittente `registrationspeace@santegidio.org` confermato. Nessuna modifica MX.
Server osservato: `20897691` (My First Server), stream `outbound` transazionale e
`broadcast` campagne. Account approvato il 2026-09-15; piano Basic 50.000 email/mese (55 USD) indicato come corrente, pagamento della fattura ancora fallito. Due email consumate, entrambe prove consegnate.

## Trasporto e flussi

`lib/email/smtp.ts` conserva il percorso storico per i chiamanti ma usa soltanto
POST HTTPS `/email` di Postmark. Nessun fallback Gmail, nessuna dipendenza
Nodemailer, nessuna modifica alla generazione/verifica dei magic link Supabase.

- Transazionale: magic link, conferme di iscrizione, istruzioni di accesso/ruolo,
  messaggi agli organizzatori.
- Broadcast: invio di prova e invio definitivo delle campagne.
- From e ReplyTo: `registrationspeace@santegidio.org`.
- Allegati base64 e immagini inline con ContentID `cid:...`.
- TrackOpens false e TrackLinks None, anche per evitare riscritture dei magic link.
- Nessun indirizzo, corpo email o token nei log della modalità log.
- Timeout HTTP 10 secondi, niente retry automatico: una risposta persa può seguire
  un'accettazione reale. Errori di rete/esiti non interpretabili sono `*_unknown`;
  gli errori API salvano solo il codice numerico, mai il messaggio con dati personali.
- `sent` significa accettata dal provider, non consegnata nella casella.

Postmark gestisce disiscrizioni e suppression dello stream broadcast: aggiunge
il proprio link di disiscrizione alle campagne. Non aggirare le suppression
reinviando nel flusso transazionale. Le suppression broadcast sono distinte dai
magic link. Non sono stati aggiunti webhook: bounce/consegna effettiva vanno
consultati in Postmark, non sono sincronizzati come nuovi stati nell'app.

## Variabili server

```
EMAIL_DELIVERY_MODE=postmark
EMAIL_FROM=registrationspeace@santegidio.org
EMAIL_REPLY_TO=registrationspeace@santegidio.org
POSTMARK_SERVER_TOKEN=<token del server, non token account>
POSTMARK_TRANSACTIONAL_STREAM=outbound
POSTMARK_BROADCAST_STREAM=broadcast
CRON_SECRET=<segreto esistente della coda>
```

Il token non deve essere NEXT_PUBLIC né comparire in git/log. Il vecchio valore
`smtp` ora fallisce esplicitamente per evitare un rilascio apparentemente riuscito.
In sviluppo usare `EMAIL_DELIVERY_MODE=log`; `POSTMARK_API_TEST` valida il payload
senza consegnare e viene rifiutato quando NODE_ENV=production.
`npm run email:verify` controlla credenziali e tipi degli stream senza inviare,
ma non certifica approvazione account o consegna.

## Coda e migration

`20260912180000_postmark_campaign_queue.sql` sostituisce soltanto le due RPC già
riservate a service_role. RLS invariata. Nuovi destinatari prenotati per oggi,
nessun tetto Gmail giornaliero. Claim atomico massimo 25, lock e SKIP LOCKED;
preparazione concorrente 3 e allegati caricati una volta per campagna/blocco.
Ogni claim viene inoltrato tramite `/email/batch`, con risultati per destinatario;
i blocchi proseguono senza pausa fino a coda vuota o budget di 180 secondi, poi
si termina il blocco corrente. Non esiste più il limite di 25 email/minuto.
Le route hanno maxDuration 300; il budget lascia margine al blocco finale,
ma non garantisce completamento in caso di stallo DB/infrastruttura.
L'avvio usa Next `after`: conferma immediata al browser, lavoro dopo la risposta.
Il cron al minuto riprende eventuali scheduled residui e può sovrapporsi senza
riacquisire gli stessi destinatari grazie al claim atomico. Richiede piano Vercel
compatibile e CRON_SECRET. Nessuna promessa di throughput fisso: dipende anche
da letture DB, personalizzazioni e dimensione allegati.

Il trasporto supporta fino a 500 email per richiesta, suddividendo ulteriormente
per dimensione JSON/base64 (10 MB prudenziali, singolo messaggio massimo 9 MB).
Risposte HTTP 200 hanno comunque esiti individuali: i fallimenti non annullano
gli altri successi. Nessun retry automatico di esiti incerti. Se un salvataggio
DB fallisce dopo accettazione, gli altri esiti vengono salvati; la riga incerta
resta sending, da riconciliare prima di un eventuale recupero.

Scelta: API batch standard, compatibile con i template HTML attuali e gli
allegati/CID. Bulk API richiede attivazione aggiuntiva da supporto e gestione
asincrona diversa degli esiti; non introdotta per questa migrazione.
Fonti: https://postmarkapp.com/developer/api/email-api,
https://postmarkapp.com/developer/api/bulk-email,
https://nextjs.org/docs/app/api-reference/functions/after.

Nessuna riscrittura delle campagne precedenti: date future conservate; sent,
failed e sending non vengono riaccodati. Un'interruzione può lasciare sending:
riconciliare con Postmark prima di qualunque recupero per evitare duplicati.
Il riepilogo usa conteggi esatti, anche oltre 1.000 destinatari.
Il controllo configurazione avviene prima del claim.

## Attivazione ancora da eseguire

1. Regolarizzare il pagamento Postmark prima di affidare il traffico di produzione al servizio; l'approvazione è già verificata.
2. Configurare token/variabili negli ambienti autorizzati, verificare server Live,
   stream broadcast con disiscrizioni gestite da Postmark, e cron Vercel al minuto.
3. Nel rilascio coordinare migration e codice; non applicare la nuova coda mentre
   l'app usa ancora Gmail (eliminerebbe la protezione del limite Gmail).
   Evitare invii di campagne durante il passaggio; per rollback conservare prima
   le definizioni RPC precedenti, non basta ripristinare il solo codice.
4. Dopo richiesta di pubblicazione, commit/push e verifica del deployment.
5. Collaudare invii reali autorizzati: email di accesso con callback effettiva e
   campagna a destinatario di prova, From/ReplyTo, DKIM/SPF/DMARC, QR/allegato e
   prosecuzione della coda. Non avviare campagne reali durante il collaudo.

Token del server salvato in `.env.postmark.local`, escluso da Git e con permessi
0600. Per i test usare `node --env-file=.env.local --env-file=.env.postmark.local ...`;
per il controllo provider `node --env-file=.env.postmark.local scripts/verify-email-config.mjs`.
L'ambiente `.env.local` ordinario e gli ambienti Vercel non sono stati modificati:
non avviare l'app recuperata con la vecchia modalità smtp; per lo sviluppo senza
invio impostare esplicitamente EMAIL_DELIVERY_MODE=log, oppure caricare l'override
Postmark. Nessuna migration remota o pubblicazione eseguita.

## Collaudo reale del 15 settembre

Invii tramite il trasporto applicativo a `registrationspeace@santegidio.org`:

- Transazionale: `56b4ed37-b20e-444e-be56-04745b508851`.
- Broadcast: `49c218d6-785c-43ae-9645-2caa8696c798`.

Entrambi non sandbox, evento Delivered con risposta Google SMTP 250 OK.
Confermati From e Reply-To, allegati `qr-prova.png` e `prova.txt`, CID inline,
tracking disabilitato e link di disiscrizione solo broadcast. Il QR è sintetico e
non valido per l'evento. Nessun account/iscrizione/campagna reale creato o modificato.
Il test prova la consegna al server destinatario, non la cartella inbox/spam;
non è stato effettuato un login completo tramite callback con un utente reale.
Il recupero ha richiesto di ricostruire il lockfile dalla versione corrente,
rimuovendo solo Nodemailer e tipi: evitato il ripristino di dipendenze obsolete
incluse nello stash. Backup preesistente conservato nello stash nominato in AGENTS.


## Verifiche

- Suite Node, typecheck, lint e build.
- `tests/postmark-delivery.test.mts`: payload, stream, identità, CID/base64,
  errori HTTP/API, risposte incomplete, rete incerta, nessun retry, log redatti.
- API Postmark reale con token pubblico POSTMARK_API_TEST: due richieste
  transazionale/broadcast accettate, nessuna consegna a persone.
- SQL su PostgreSQL WASM PGlite temporaneo: eseguire nell'ordine fixture
  `tests/sql/postmark-campaign-queue.sql`, migration e
  `tests/sql/postmark-campaign-queue-assertions.sql`. Copre 1.205 destinatari,
  batch limitati, assenza doppio claim sequenziale, scope campagna, date future,
  failed conservati e privilegi. Non sostituisce una prova concorrente multi-sessione.

Fonti: https://postmarkapp.com/developer/api/email-api e
https://postmarkapp.com/support/article/1208-how-to-add-an-unsubscribe-link

### Verifiche finali della ripresa

Suite completa: 306 test superati. Lint, typecheck dopo rigenerazione dei file
Next e build production superati. Test SQL PGlite con 1.205 destinatari superati.
Aggiornato anche il test del messaggio di errore dei link di gruppo per rispettare
la modifica locale preesistente: verifica il messaggio generico tradotto e
l'assenza dell'errore tecnico, preservando il blocco del modulo generico.
`npm run dev:postmark` avvia il codice locale con l'override Postmark;
`npm run email:verify:postmark` verifica il provider senza inviare.


## Ottimizzazione batch verificata — 2026-09-15

- 310 test superati, lint, typecheck e build production superati.
- Test specifici: 501 messaggi divisi in 500+1; separazione per dimensione degli
  allegati base64; risposte miste e malformate; destinatari invalidi; timeout
  senza retry; più claim consecutivi; arresto al budget; salvataggi indipendenti
  quando una scrittura DB fallisce dopo accettazione.
- Due nuovi messaggi `[PROVA POSTMARK BATCH]` inviati in una richiesta reale a
  registrationspeace@santegidio.org, con allegato di prova. Entrambi Delivered,
  SMTP Google 250 OK, Sandboxed false. MessageID:
  `8fbc7a92-dbb5-4f0d-9921-edee5da1c98f`,
  `d7d46cc5-a772-47fa-ad37-4538c72130cf`.
- Quattro email di prova complessive oggi, includendo le due precedenti.
  Nessun partecipante reale né campagna persistente creata per i test.
- Nessun deploy, modifica env Vercel o migration remota. Nessun nuovo controllo
  del pagamento. Throughput su migliaia di destinatari reali e funzionamento
  del cron in produzione da verificare al rilascio; non simulati come riusciti.


## Pubblicazione autorizzata e scheduler reale

Il progetto appartiene a `giovaniperlapaces-projects`, piano Vercel Hobby.
Il cron Vercel ogni minuto non è disponibile: `vercel.json` non definisce cron.
Lo scheduler di produzione è un timer systemd sul server esistente 91.99.81.31,
con unità versionate in `scripts/postmark-cron/`. Non richiede un piano aggiuntivo.
Dopo il completamento di ogni richiamo attende 60 secondi; una sola istanza per
servizio. L'endpoint richiede `CRON_SECRET`, identico al segreto della configurazione
root-only `/etc/iscrizioni-pace/email-cron.conf` (0600). Timeout curl 280s, unità 290s.
Non esegue retry della stessa richiesta: al tick successivo la coda seleziona
soltanto le righe scheduled. Stati sending/failed richiedono riconciliazione.

Operazioni: `systemctl status pace-email-campaigns.timer`,
`journalctl -u pace-email-campaigns.service`. Per fermare lo scheduler:
`systemctl stop pace-email-campaigns.timer`. La partenza immediata delle campagne
continua tramite Next after. Questa configurazione sostituisce i riferimenti
al cron Vercel al minuto presenti nella documentazione preparatoria sopra.
