# Sale collegate Forum — 23 ottobre 2026

## Stato e autorizzazione

Dopo la sospensione iniziale e il collaudo locale, il 23 ottobre l’utente ha
esplicitamente autorizzato il rilascio completo: «manda tutto in produzione,
esegui le migrations, e fai partire le mail». La sospensione è quindi superata.
Prima di questa conferma erano state eseguite soltanto letture production;
nessun invio o modifica operativa. Esiti del rilascio registrati in fondo.

## Decisioni confermate

- Sei panel separati, collegati per UUID ai Forum 1, 3, 9, 10, 18, 19.
- Domus Letitiae, Assisi: Forum 1, 9, 19, **156 posti ciascuno**.
- Serafico, Assisi: Forum 3, 10, 18, **110 posti ciascuno**. I 100 inizialmente
  indicati per il Forum 18 erano un errore, corretto esplicitamente dall’utente.
- Totale 798 posti/conferenza, distribuiti nelle tre fasce, non contemporanei.
- Stessi orari esatti dei rispettivi Forum originali, letti dalle righe canoniche.
- Nome: «FORUM N — SALA COLLEGATA — SOLO IN ITALIANO — [sede] — [titolo]».
- Avviso evidente in schede, oggetto e apertura email: trasmissione esclusivamente
  in italiano, senza traduzioni; relatori nella sala principale, accesso valido
  solo per la sede prenotata. Interfaccia e spiegazione disponibili in sette lingue.
- Indirizzi e trasporti ricevuti nella revisione del 23 ottobre:
  Domus Letitiae, **Viale Giovanni XXIII 2, Assisi**, navetta **Linea C**
  o mezzi propri, **ampio parcheggio**; Serafico, **Viale Guglielmo Marconi 6,
  Assisi**, navetta **Linea C** o mezzi propri, **parcheggio limitato**.
  Indirizzi canonici nel DB, indicazioni esplicite nelle schede e nelle email.
- Chiarimento espresso dell’utente: invitare soltanto chi attende il Forum
  corrispondente, non tutte le code della medesima fascia.
- Inviti delle sale collegate limitati a chi **vive abitualmente in Italia**.
  Fonte: `participants.country_other` non vuoto (precedenza come nell’anagrafica)
  oppure `countries.iso2` tramite `participants.country_id`. Testo riconosciuto:
  Italia/Italy/IT/ITA, senza distinzione di maiuscole e con spazi esterni rimossi.
  Residenza mancante o non riconosciuta esclusa; nessuna inferenza da lingua,
  cittadinanza, gruppo o residenza del capogruppo. Nessuna modifica alla coda principale.
- Tutti i nuovi posti nella quota individuale utilizzabile anche dai capigruppo;
  nessuna ripartizione automatica per scuole o ospiti.

## Coda e prenotazioni

`panel_relay_rooms` collega ogni nuovo panel alla sorgente e ne registra la fase
`staged`, `priority`, `open`. `panel_waitlist.source_waitlist_id` collega
l’invito alternativo alla richiesta originale senza spostarla o riscriverla.

L’attivazione service-only `activate_panel_relay_rooms(event_id)` acquisisce
uno snapshot delle richieste attive valide dei residenti in Italia, in ordine FIFO, conservando il
richiedente/destinatario (partecipante oppure capogruppo), la lingua e i minori
scelti. La nuova richiesta è un’offerta alternativa: non è una prenotazione
né una nuova dichiarazione di presenza. Il retry dell’attivazione non duplica
richieste e non riapre finestre di conferma.

Il worker già esistente propone i posti con riserva per tutto il nucleo e
due ore per confermare per **tutti i Forum**, sia principali sia collegati; mantiene claim persistenti e nessun reinvio cieco
dopo esito incerto. L’offerta già in corso nella sala principale ha precedenza:
la promozione della relativa alternativa attende la sua risoluzione/scadenza.
L’accettazione nella sala principale rende superfluo l’invito alternativo,
che il controllo successivo annulla. Se due offerte diventano disponibili in
momenti vicini, l’accettazione rilegge le prenotazioni e i controlli canonici
impediscono una doppia prenotazione nella stessa fascia.

La residenza viene ricontrollata prima della promozione e del claim della notifica.
Se cambiata, viene annullata solo la richiesta della sala collegata, senza toccare
la principale. Anche l’eventuale successiva iscrizione alla lista d’attesa della
sala collegata richiede residenza in Italia; la prenotazione diretta di un posto
libero dopo la fase prioritaria conserva le regole precedenti.

La migration `20261023102000` estende le offerte **ancora valide** a due ore dal
loro `offered_at`, senza far ripartire il timer, riaprire scadenze trascorse,
accorciare termini già più lunghi, reinviare notifiche o cambiare ordine e posti.
Ogni estensione ha audit; la ripetizione non produce altre modifiche.

Durante `priority`, nuove prenotazioni e nuove code ordinarie sono bloccate
anche nel database e nei percorsi operativi, compreso il caso in cui tutti gli
inviti siano già offerti e ci siano posti residui. I posti non vengono aperti
solo perché non ci sono più righe `waiting`: occorre risolvere anche gli inviti
`offered`. Il worker controlla anche le sale prioritarie senza righe attive,
per completare l’apertura dopo l’ultima accettazione/rinuncia. Con coda iniziale
vuota la sala passa direttamente a `open` durante l’attivazione.

Accettare la sala collegata conserva la coda originale e sostituisce atomicamente
l’eventuale altro Forum prenotato nella fascia. La conferma mostra titolo e sede
della prenotazione sostituita. Un successivo passaggio alla sala principale
libera contestualmente il posto collegato. Rifiutare/scadere l’alternativa non
modifica la coda principale; le normali scadenze delle offerte principali
continuano ad applicarsi. Nessuna persona viene trasferita automaticamente.

La UI richiede una spunta esplicita sulla trasmissione solo in italiano prima
di abilitare la conferma, sia personale sia del capogruppo. Titolo e sede
canonici rendono distinti catalogo, elenchi, statistiche e incarichi scanner;
non vengono assegnati automaticamente operatori reali alle nuove sale.

## File principali

- `supabase/migrations/20261023100000_forum_relay_rooms.sql`: relazione, guardie,
  snapshot, promozione/notifiche, cataloghi e sostituzioni da mostrare.
- `supabase/migrations/20261023101000_assisi_relay_programme.sql`: sei panel,
  due sedi, quote; fase iniziale `staged`, senza offerte né invii.
- `supabase/migrations/20261023102000_forum_waitlist_extend_active_offers.sql`: estensione conservativa delle offerte attive, senza reinvio.
- `lib/events/assisi-2026-relay-rooms.ts`: UUID immutabili condivisi da UI/email.
- `lib/panels/relay-copy.ts`: spiegazioni e conferme nelle sette lingue.
- Componenti originali personale/capogruppo/catalogo e renderer email aggiornati.

## Verifiche

- Suite applicativa: **1.070 test superati** dopo residenza, indicazioni delle sedi e finestra di due ore.
- Lint dei file modificati superato. Il lint generale segnala tre errori
  `no-explicit-any` e un avviso preesistenti nel test non modificato
  `tests/ceremony-navigation.test.mts`; non sono stati alterati file estranei.
  TypeScript e build production finali superati nella copia isolata da `npm ci`,
  senza `.env`, credenziali o dati reali, con la configurazione Next originale.
- PostgreSQL 17 temporaneo con migration canoniche: suite preesistente, seed dei
  sei Forum, totale 798, indirizzi e trasporti, residenza canonica/testuale,
  esteri/ignoti esclusi, ricontrollo residenza al claim, estensione delle offerte
  valide senza riapertura o reinvio, due ore alla promozione e al claim, guardie di priorità anche su scritture operative,
  snapshot/riprova, conservazione esatta della coda originale, minori/FIFO,
  conservazione di proprietario/commento/ACL del catalogo personale ricreato,
  offerta principale già attiva, accettazione, passaggio alla principale,
  rinuncia/scadenza e apertura residui.
- Browser su componenti e Server Action originali, Auth/PostgREST sintetici,
  database reale temporaneo: personale e capogruppo senza account personale,
  sette lingue, 390/1440 px, consenso italiano, accettazione, coda conservata,
  indirizzi e indicazioni localizzate, catalogo pubblico e sei conferme simultanee con un’unica prenotazione.
- Gli errori iniziali del collaudo browser dipendevano da fixture/percorso e
  blocco delle risorse dev dall’origine loopback. Corretto solo l’ambiente
  isolato (`allowedDevOrigins: ['127.0.0.1']`), senza cambiare Next production.
- Il checkout locale contiene duplicati preesistenti/sincronizzati nei tipi
  generati `.next` che fanno fallire un secondo typecheck; la copia isolata
  pulita è stata usata per verificare i sorgenti senza toccare quei file.

Comandi riproducibili:

```sh
npm test
npm run lint
npm run typecheck
npm run build
node tests/sql/run-forum-waitlist.mjs
PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/sql/run-forum-waitlist.mjs --relay-browser
```

Il collaudo browser richiede Next locale su 127.0.0.1:3164, tutte le URL
Supabase su 127.0.0.1:55485, chiavi sintetiche, `EMAIL_DELIVERY_MODE=log` e
origine dev loopback consentita. Eseguirlo in copia senza credenziali.
Il runner crea/elimina la propria route di prova e il database temporaneo.
Anteprima HTML/testo senza invio: `output/relay-review/email-sala-collegata.html`
e `.txt`; seconda sede in `email-sala-collegata-serafico.html` e `.txt`
(destinatario, orari, termine e link sintetici; cartella ignorata da Git).

## Procedura di rilascio autorizzata

1. Ricontrollare worktree, eventuali modifiche parallele, programma, orari,
   code, scheduler e stato attuale. Se gli orari sono già trascorsi, fermarsi:
   non aggirare i controlli né attivare inviti scaduti.
2. Backup production verificato con indice/decodifica; confronto dei dati e
   ACL/funzioni prima/dopo. Le prenotazioni e code originali devono restare intatte.
3. Applicare/registrare atomicamente la migration infrastrutturale `20261023100000`.
4. Pubblicare il codice compatibile e attendere deployment READY con SHA corretto.
5. Applicare/registrare `20261023101000`: sei panel ancora in fase `staged`.
   Applicare/registrare `20261023102000` per le offerte ancora valide,
   verificando che solo le scadenze previste e il relativo audit cambino.
6. Dopo verifica di codice, capienze, lingua e scheduler, eseguire una sola
   attivazione service-only per l’evento canonico. Questo passaggio abilita
   gli inviti reali tramite il worker esistente: è distinto dalla migration.
7. Verificare snapshot e riserve, invii accettati dal provider (senza equipararli
   a consegna), eventuali fallimenti/esiti incerti e apertura dei residui.

La nuova conferma del 23 ottobre autorizza tutti i passaggi sopra, incluso
l’avvio delle notifiche; nessun invio reale viene usato per il collaudo.


## Esito del rilascio — 23 ottobre, 20:29 Europe/Rome

- Integrati prima del rilascio i quattro commit production fino a `91059bb`,
  conservando le modifiche cerimonie, scuole e consultazione Viewer. Risolto
  soltanto il conflitto editoriale in AGENTS, mantenendo entrambe le sezioni.
- Codice `430ea5bd17417d17831d0e552d2e1ee5667c4be7` su main; deployment
  `dpl_41zfkYfUg4Dxsp9to2BLqZAM9zST` **READY**, alias production
  `https://registrationspeace.santegidio.org` verificato nelle API Vercel.
- Sul codice integrato: **1.085 test passati**, SQL/concorrenza passati,
  build e TypeScript in copia isolata da `npm ci` passati. Il primo tentativo
  di build isolata con node_modules simbolico è stato respinto da Turbopack;
  ripetuta con installazione propria, senza modifiche ai sorgenti.
- Backup completo remoto protetto (600), indice e decodifica integrale verificati:
  `/root/backups/iscrizioni-pace-relay-20261023/before-relay-181957.dump`,
  20.910.899 byte, SHA256
  `8ee5c983675bb3a78ffb3131b4c253c51960591cef3a9a2e54c259b775090ad1`.
- Applicate e registrate atomicamente tutte le migration `20261023100000`,
  `20261023101000`, `20261023102000`. La prima è stata eseguita con confronto
  nella stessa transazione: **70 tabelle, 211.458 righe preesistenti intatte**,
  proprietari/ACL/metadati delle 229 funzioni preesistenti conservati;
  modificati soltanto i sei corpi previsti. La migration programma ha conservato
  tutte le righe preesistenti anche nelle tabelle destinataria delle aggiunte:
  71 tabelle / 211.489 righe, metadati di 234 funzioni invariati.
- Sei panel pubblici, capienza complessiva 798, due sedi con indirizzi corretti.
  **107 offerte ancora valide** estese a due ore dal termine iniziale,
  senza reinvio o riapertura di offerte scadute, con audit delle estensioni.
- Attivazione esplicita completata: **269 inviti**, per 270 posti richiesti
  compreso un minore. Confronto atomico: 1.530 righe originali di coda,
  5.625 scelte di prenotazione e 6.359 selezioni minori preesistenti conservate.
  Inviti: Forum 1 = 65, 3 = 22, 9 = 133, 10 = 22, 18 = 27, 19 = 0.
  Forum 19 aperto direttamente, non avendo coda iniziale.
- Avviato il worker canonico con configurazione production e Postmark Live,
  stream transactional `outbound`, mittente `registrationspeace@santegidio.org`.
  Esecuzione concorrente col cron già esistente, claim/idempotenza conservati.
  Nessun invio manuale fuori coda e nessun reinvio degli esiti incerti.
- **155 email accettate dall’API**, zero invii falliti o incerti, zero claim
  pendenti. Verifica individuale Postmark delle 155: **154 Delivered**, una
  ancora senza evento di consegna, zero bounce rilevati. Oggetto con avviso
  della lingua e indirizzo verificati nei contenuti di tutte le 155 email.
  Delivered indica consegna al server destinatario, non lettura.
- **114 inviti ancora waiting**, perché la testa FIFO delle rispettive code
  ha un’offerta principale valida: Forum 1 = 65, Forum 3 = 22, Forum 18 = 27.
  Al controllo le scadenze principali erano 21:39, 21:42 e 21:40 Europe/Rome;
  risposte/scadenze consentono lo scorrimento automatico successivo. Nessuna
  forzatura della coda o del diritto a rispondere all’offerta principale.
- Zero notifiche relay a residenze estere/non riconosciute al controllo.
  Nessuna prenotazione, presenza o email reale usata come collaudo.
  Il file locale estraneo `docs/forum-presenze-un-clic-2026-10-21 2.md` è
  stato conservato e non incluso nei commit.
