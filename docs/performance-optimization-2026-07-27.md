# Audit e ottimizzazione prestazionale - 2026-07-27

## Ambito e vincoli

L'intervento ha analizzato il repository completo e ha applicato soltanto
ottimizzazioni interne, conservative e reversibili. Non sono stati modificati
DOM, CSS, testi, route, contratti API, codici di risposta, regole applicative,
controlli di autorizzazione, schema database o dipendenze.

Le misure locali sono state eseguite su:

- Apple M5 arm64, 10 CPU logiche, 16 GiB RAM;
- macOS, Node.js 24.16.0, npm 11.17.0;
- build di produzione Next.js 16.2.9;
- Supabase remoto già configurato dal progetto;
- server locale di produzione su loopback;
- 30 richieste per route, concorrenza 5 e 3 warm-up per il benchmark HTTP;
- harness locali isolati per client Supabase, rate limiter e server SMTP finto.

Non è stato eseguito traffico di carico contro la produzione, non sono state
applicate migration e non sono stati effettuati deploy. La telemetria live
Vercel non era consultabile perché il connettore richiedeva una nuova
autenticazione; di conseguenza non vengono dichiarati limiti di capacità
assoluti dell'ambiente online.

## 1. Sintesi iniziale

### Architettura individuata

L'applicazione è un monolite Next.js 16 App Router con React 19 e TypeScript,
distribuito come Vercel Functions Node.js. Le pagine pubbliche e le dashboard
sono prevalentemente Server Components dinamici; le mutazioni usano Server
Actions e Route Handlers.

La persistenza è Supabase self-hosted:

- PostgreSQL esposto all'app tramite PostgREST/Supabase JS via HTTPS;
- Supabase Auth per sessioni e magic link;
- Supabase Storage privato per gli allegati delle campagne;
- RLS e helper SQL per l'isolamento dei ruoli;
- service role soltanto nei flussi server che lo richiedono.

L'invio email usa Nodemailer 9 con Gmail SMTP. Le campagne hanno un limite
applicativo di 100 destinatari, concorrenza 3, massimo 5 allegati, 5 MiB per
file e 10 MiB complessivi.

Non risultano code durevoli, worker separati, job schedulati, Redis, cache dati
condivise, Docker, Kubernetes, `vercel.json` o pipeline CI nel repository. Il
rate limiter applicativo è una `Map` locale al processo e non è condiviso fra
istanze.

### Colli di bottiglia principali

1. Ogni chiamata a `createSupabaseServiceClient()` costruiva un nuovo client,
   trattenendo oggetti e aumentando lavoro CPU e pressione sul garbage
   collector.
2. Il rate limiter conservava indefinitamente le chiavi scadute quando non
   venivano riutilizzate.
3. Ogni email creava un nuovo transporter e una nuova connessione SMTP/TLS.
4. La personalizzazione di ogni destinatario eseguiva tre richieste Supabase in
   serie; anche gli allegati erano scaricati in serie.
5. La dashboard capogruppo eseguiva richieste indipendenti in cascata.
6. Le dashboard admin e manager caricavano dataset e statistiche anche per
   sezioni che non li visualizzavano. La sezione campagne manager caricava
   inoltre l'intero snapshot operativo della dashboard sottostante.

### Rischi principali con aumento del traffico

- crescita non limitata dell'heap per chiavi rate-limit ad alta cardinalità;
- handshake SMTP ripetuti, latenza e rischio di superare i limiti del provider;
- moltiplicazione delle richieste PostgREST per ogni render di dashboard;
- waterfall di rete, particolarmente costose quando Vercel e Supabase non sono
  nella stessa regione;
- stato rate-limit non coerente in un deployment multiistanza;
- assenza di metriche live sufficienti per CPU, heap, event loop, query lente e
  saturazione del database;
- campagne sincrone senza coda durevole, vulnerabili a timeout o interruzione
  dell'istanza durante invii lunghi.

### Interventi eseguiti

- client service-role Supabase lazy e riutilizzato per istanza;
- pulizia periodica opportunistica dei bucket rate-limit scaduti;
- transporter SMTP lazy, riutilizzato e dotato di pool configurabile;
- parallelizzazione delle richieste indipendenti nella dashboard capogruppo e
  nel recapito campagne;
- download parallelo degli allegati entro il limite esistente di 10 MiB;
- caricamento condizionale dei dati nelle sezioni admin e manager;
- benchmark HTTP riproducibile e test di regressione prestazionali;
- documentazione delle variabili SMTP e del capacity planning.

### Risultato complessivo

Le modifiche eliminano perdite di memoria dimostrate e lavoro di rete
duplicato senza cambiare il comportamento pubblico. Nei microbenchmark il
client Supabase trattiene il 98,25% di heap in meno, il rate limiter elimina
quasi tutto l'heap scaduto e il pool SMTP riduce del 66,7% le connessioni del
campione. Test, lint, typecheck, build e verifica browser sono tutti riusciti.

Il benchmark HTTP della registrazione mostra un miglioramento medio, ma la
varianza della rete verso Supabase remoto è alta: il dato è utile come segnale,
non come prova di capacità produttiva.

## 2. Baseline

### Baseline strutturale

| Percorso | Comportamento iniziale | Rischio |
| --- | --- | --- |
| Client service-role | Nuovo `createClient()` a ogni helper/use case | Allocazioni, listener e heap trattenuto |
| Rate limiter | Nessuna eliminazione delle chiavi non più usate | Crescita proporzionale alle chiavi uniche |
| SMTP | Nuovo transporter per ogni messaggio | Un handshake TCP/TLS per email |
| Campagna, per destinatario | 3 richieste Supabase seriali | Latenza moltiplicata per il round trip |
| Allegati campagna | Download seriale fino a 5 file | Waterfall di Storage |
| Dashboard capogruppo | 7 stadi di rete nel percorso critico | TTFB elevato |
| Dashboard admin/manager | Dati caricati indipendentemente dalla sezione | Query e trasferimento inutili |

Il client applicativo non apre connessioni PostgreSQL dirette: usa PostgREST via
HTTPS. Non esiste quindi un connection pool SQL da dimensionare nel codice
Node.js; il pool database effettivo appartiene a Supabase/PostgREST.

### Baseline di memoria e CPU

Il microbenchmark del client service-role ha invocato 10.000 volte l'helper con
configurazione invariata, forzando il garbage collector prima e dopo la misura:

- tempo: 170,48 ms;
- identità client: diversa a ogni invocazione;
- crescita heap prima del GC: 152,60 MiB;
- heap trattenuto dopo GC: 133,30 MiB.

Il test del rate limiter ha creato 200.000 chiavi uniche, le ha fatte scadere e
ha provocato una successiva operazione:

- heap trattenuto dopo la scadenza: 23,03 MiB;
- le vecchie chiavi rimanevano nella `Map`.

### Baseline SMTP

Un server SMTP locale finto ha misurato 12 messaggi con la stessa concorrenza
applicativa della campagna, pari a 3:

- 12 connessioni TCP;
- 142,73 ms complessivi;
- nessun errore.

Il test non misura la latenza reale di Gmail; isola il costo di creazione e
riuso delle connessioni.

### Baseline HTTP

Il benchmark ha usato un server Next.js di produzione locale e il Supabase
remoto configurato. Tutte le risposte avevano stato valido e dimensione
costante:

| Route | RPS | Media | p50 | p95 | p99 | Errori | Byte medi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 436,92 | 11,36 ms | 9,80 ms | 17,57 ms | 17,78 ms | 0 | 18.151 |
| `/login` | 567,15 | 8,80 ms | 8,61 ms | 9,88 ms | 12,41 ms | 0 | 15.472 |
| `/registrazione` | 34,79 | 136,78 ms | 113,33 ms | 205,22 ms | 211,00 ms | 0 | 43.896 |

Per ridurre l'effetto di un singolo campione, `/registrazione` è stata
misurata tre volte. La media iniziale dei tre run era:

- 27,93 RPS;
- latenza media 184,42 ms;
- p50 125,80 ms;
- p95 447,78 ms;
- p99 453,41 ms;
- error rate 0%.

L'ampia dispersione, soprattutto al p95/p99, dimostra che rete e database
remoti dominano questo test.

### Baseline build e asset

- `next build`: 6,03 s reali;
- massimo RSS del processo di build: 969.457.664 byte, circa 925 MiB;
- `.next/static`: 1.520 KiB;
- chunk statico più grande: 459.077 byte.

La build misura il requisito del processo di compilazione, non la memoria
runtime delle Functions.

## 3. Modifiche applicate

### 3.1 Client Supabase service-role riutilizzato

**File:** `lib/supabase/service.ts`,
`tests/performance-guards.test.mts`.

**Problema e causa:** l'helper creava un client completo per ogni chiamata,
anche nella stessa istanza con URL e chiave invariati.

**Soluzione:** inizializzazione lazy e singleton per processo, con ricreazione
automatica se URL o chiave cambiano. La validazione delle env e le opzioni auth
sono invariate. È coerente con il pattern di client singolo documentato da
[Supabase](https://supabase.com/docs/reference/javascript/initializing) e con
l'inizializzazione lazy richiesta dalle build Next.js.

**Rischio:** un singleton vive per l'intera durata dell'istanza. È accettabile
per un client stateless con `persistSession: false` e
`autoRefreshToken: false`; il test copre anche la rotazione di configurazione.

**Test:** identità stabile con configurazione invariata, identità nuova dopo
rotazione della chiave, suite completa e build.

**Rollback:** ripristinare la creazione diretta dentro l'helper.

### 3.2 Pulizia dei bucket rate-limit scaduti

**File:** `lib/security/rate-limit.ts`,
`tests/performance-guards.test.mts`.

**Problema e causa:** le chiavi uniche non consultate una seconda volta non
venivano mai eliminate.

**Soluzione:** scansione opportunistica al massimo una volta ogni 60 secondi,
che elimina soltanto bucket già scaduti. Limiti, finestre e risposte restano
identici.

**Rischio:** la scansione è O(n) e viene pagata da una richiesta ogni minuto.
È preferibile alla crescita illimitata, ma non sostituisce un rate limiter
condiviso quando il traffico diventa elevato.

**Test:** un bucket scaduto viene eliminato e uno ancora attivo continua a
bloccare la richiesta.

**Rollback:** rimuovere la chiamata di cleanup e le funzioni aggiunte.

### 3.3 Pool e riuso SMTP

**File:** `lib/email/config.ts`, `lib/email/smtp.ts`, `.env.example`,
`tests/performance-guards.test.mts`.

**Problema e causa:** il transporter veniva creato per ogni messaggio, quindi
ogni invio pagava setup TCP/TLS e autenticazione.

**Soluzione:** un transporter lazy per istanza, pool abilitato per default,
ricreazione se cambia la configurazione e funzione esplicita di chiusura. I
valori sono configurabili e validati:

- `SMTP_POOL`, default `true`;
- `SMTP_MAX_CONNECTIONS`, default 5, intervallo 1-10;
- `SMTP_MAX_MESSAGES`, default 100, intervallo 1-1000.

I default 5/100 coincidono con quelli consigliati nella documentazione
[Nodemailer pooled SMTP](https://nodemailer.com/smtp/pooled), che raccomanda un
solo transporter riutilizzato.

**Rischio:** il pool è locale alla singola Function; più istanze possono
moltiplicare le connessioni verso Gmail. `maxMessages` rinnova periodicamente
le connessioni e `SMTP_POOL=false` consente rollback operativo immediato.

**Test:** default, limiti, fallback di valori invalidi, benchmark SMTP locale,
suite completa e build.

**Rollback:** impostare `SMTP_POOL=false` oppure ripristinare il transporter
per invio.

### 3.4 Campagne email: richieste e allegati paralleli

**File:** `app/api/email-campaigns/route.ts`.

**Problema e causa:** dati partecipante, gruppo ed email venivano richiesti in
tre round trip seriali per destinatario; fino a cinque allegati venivano
scaricati in sequenza.

**Soluzione:** `Promise.all` per operazioni indipendenti. Il numero e il
contenuto delle query sono invariati; cambia soltanto il loro scheduling. Il
pattern è quello documentato da
[Next.js per il data fetching parallelo](https://nextjs.org/docs/app/getting-started/fetching-data#parallel-data-fetching).

**Rischio:** i download paralleli aumentano temporaneamente la memoria rispetto
al trasferimento seriale, ma l'aumento è limitato dal vincolo preesistente di
10 MiB complessivi. Un errore di qualsiasi allegato continua a far fallire
l'operazione come prima.

**Test:** suite campagne esistente, typecheck, build e regressione del formato
risposta.

**Rollback:** ripristinare gli `await` seriali e il ciclo allegati.

### 3.5 Dashboard capogruppo: eliminazione dei waterfall

**File:** `app/dashboard/capogruppo/page.tsx`.

**Problema e causa:** membership, gruppi, assegnazioni, tag, servizi e link
venivano caricati in più stadi seriali anche quando indipendenti.

**Soluzione:** membership e gruppi partono insieme; dopo il calcolo dello scope,
assegnazioni, tag, servizi e link partono insieme. Le query, i filtri RLS e i
record restituiti sono invariati.

**Rischio:** un incremento momentaneo delle richieste simultanee verso
PostgREST, compensato da un percorso critico molto più corto. Il parallelismo
massimo aggiunto è quattro.

**Test:** suite completa, build e apertura browser delle route pubbliche. Le
dashboard autenticate restano coperte dai test di helper/ruoli; la loro
validazione live richiede gli utenti test dell'ambiente.

**Rollback:** ripristinare la sequenza degli `await`.

### 3.6 Dashboard admin e manager: caricamento per sezione

**File:** `app/dashboard/admin/page.tsx`,
`app/dashboard/manager/page.tsx`.

**Problema e causa:** il rendering caricava sempre snapshot operativi,
statistiche e monitoraggio apertura, benché ogni sezione ne usasse solo una
parte.

**Soluzione:**

- admin `evento`: carica il monitoraggio apertura e non lo snapshot operativo
  né le statistiche;
- admin nelle altre sezioni: non carica il monitoraggio apertura;
- statistiche admin/manager: caricate solo nella sezione `dashboard`;
- manager `email`: non carica lo snapshot operativo della dashboard.

Gli oggetti vuoti sono costruiti con gli helper esistenti, senza cambiare props,
DOM o output visibile.

**Rischio:** una futura sezione potrebbe iniziare a usare dati oggi considerati
non necessari. La condizione andrà aggiornata insieme alla nuova UI.

**Test:** lint, typecheck, 94 test, build e verifica visuale delle pagine
pubbliche senza error overlay, errori console o overflow.

**Rollback:** tornare al caricamento incondizionato.

### 3.7 Benchmark e guardrail

**File:** `scripts/benchmark-http.mjs`, `package.json`,
`tests/performance-guards.test.mts`.

È disponibile `npm run performance:http`. Default:

- base URL `http://127.0.0.1:3000`;
- route `/,/login,/registrazione`;
- 30 richieste per route;
- concorrenza 5;
- 3 warm-up;
- timeout 15 secondi.

Le env `PERF_BASE_URL`, `PERF_PATHS`, `PERF_REQUESTS`,
`PERF_CONCURRENCY`, `PERF_WARMUPS` e `PERF_TIMEOUT_MS` consentono di cambiare
il profilo senza modificare il file. Il comando esegue soltanto GET e non va
puntato alla produzione con concorrenza elevata senza autorizzazione.

Il test di regressione copre singleton Supabase, cleanup rate-limit e parsing
della configurazione SMTP.

## 4. Confronto prima e dopo

| Metrica | Prima | Dopo | Variazione | Condizioni | Affidabilità |
| --- | ---: | ---: | ---: | --- | --- |
| 10.000 accessi al client service-role | 170,48 ms | 24,19 ms | -85,8% | Harness locale, env invariata | Alta |
| Heap service client dopo GC | 133,30 MiB | 2,33 MiB | -98,25% | 10.000 accessi, GC esplicito | Alta |
| Heap rate-limit scaduto | 23,03 MiB | 0,01 MiB | -99,96% | 200.000 chiavi uniche | Alta |
| Connessioni SMTP per 12 messaggi | 12 | 4 | -66,7% | SMTP locale, concorrenza 3 | Alta |
| Durata SMTP per 12 messaggi | 142,73 ms | 87,98 ms | -38,4% | SMTP locale, nessuna WAN | Media |
| Stadi rete dashboard capogruppo | 7 | 3 | -57,1% | Analisi del grafo degli `await` | Alta |
| Stadi query per destinatario email | 3 | 1 | -66,7% | Stesse 3 richieste in parallelo | Alta |
| RPS medio `/registrazione` | 27,93 | 39,98 | +43,1% | 3 run, 30 richieste, c=5 | Bassa |
| Latenza media `/registrazione` | 184,42 ms | 120,81 ms | -34,5% | Stesse condizioni | Bassa |
| p50 `/registrazione` | 125,80 ms | 106,65 ms | -15,2% | Stesse condizioni | Bassa |
| p95 `/registrazione` | 447,78 ms | 189,90 ms | -57,6% | Stesse condizioni | Bassa |
| p99 `/registrazione` | 453,41 ms | 215,41 ms | -52,5% | Stesse condizioni | Bassa |
| Error rate HTTP | 0% | 0% | invariato | Tutti i run locali | Alta |
| RSS massimo build | 969.457.664 B | 957.399.040 B | -1,24% | `next build` cronometrata | Media |
| Tempo build | 6,03 s | 6,15 s | +1,99% | Singolo run per stato | Bassa |
| Dimensione `.next/static` | 1.520 KiB | 1.520 KiB | 0% | Build produzione | Alta |
| Chunk statico massimo | 459.077 B | 459.077 B | 0% | Build produzione | Alta |

Il +1,99% del tempo build è entro il rumore di un singolo run e non indica una
regressione. Il bundle client è identico perché non sono stati modificati
componenti client, DOM o CSS.

Riduzioni strutturali non incluse nella tabella:

- manager, sezioni non-dashboard: 3 richieste statistiche eliminate;
- manager, sezione email: circa 15-20 richieste PostgREST eliminate per render,
  in funzione del numero di identità operative;
- admin, sezione evento: 1 richiesta evento corrente, 8 richieste snapshot
  operativo e 3 richieste statistiche eliminate;
- admin, sezioni non-evento: eliminato il monitoraggio completo di tutti gli
  eventi, pari a 1 richiesta più fino a 6 richieste per evento popolato;
- admin, sezioni non-dashboard: 3 richieste statistiche eliminate.

Questi conteggi descrivono richieste HTTP Supabase dal processo Next.js, non il
numero interno di statement SQL generato da PostgREST.

## 5. Allocazione consigliata delle risorse

### Principi

Vercel Functions con Fluid Compute riusa le istanze e può eseguire più
invocazioni nello stesso processo. La documentazione corrente indica come
taglie disponibili [Standard 2 GiB/1 vCPU e Performance 4 GiB/2 vCPU](https://vercel.com/docs/functions/configuring-functions/memory).
Le Functions scalano automaticamente e vanno collocate vicino alla sorgente
dati per ridurre il round trip
([Vercel Functions](https://vercel.com/docs/functions),
[Fluid Compute](https://vercel.com/docs/fluid-compute)).

L'app è prevalentemente I/O-bound. Non c'è evidenza per passare subito alla
taglia Performance: prima va misurata la produzione con la taglia Standard.

### Configurazione iniziale per ambiente

| Ambiente | CPU e memoria | Istanze e worker | Database e cache | SMTP | Timeout e scaling |
| --- | --- | --- | --- | --- | --- |
| Sviluppo locale | Almeno 2 CPU logiche e 3 GiB disponibili durante la build; la build ha raggiunto 0,91 GiB RSS | 1 processo Next, nessun worker thread | Database di sviluppo; nessuna cache dati; rate-limit locale | `EMAIL_DELIVERY_MODE=log`; pool irrilevante | Nessun autoscaling; benchmark c=5 |
| Test/CI | 2 vCPU e almeno 3 GiB per build+test con margine | 1 job per working copy; parallelizzare pipeline, non test che condividono env | Dataset isolato e ripetibile; nessun test di carico sul DB di produzione | `log` o SMTP finto | Timeout CI 10 min; benchmark con warm-up e almeno 3 run |
| Produzione, traffico basso | Vercel Standard, 1 vCPU/2 GiB | Nessun minimo fisso; Fluid auto-scale; nessun `cluster` Node | PostgREST gestisce il pool SQL; nessuna cache utente | Concorrenza app 3; `SMTP_MAX_CONNECTIONS` 3-5 per istanza | Durata platform default; allarme su p95 interattivo >2 s |
| Produzione, traffico medio | Restare Standard finché CPU e memoria hanno margine | Autoscaling Vercel; regione singola vicina a Supabase | Misurare query rate, connessioni Postgres e lock; valutare cache solo per cataloghi con invalidazione | Budget globale provider; pool per istanza non oltre quota/N istanze | Allarme CPU >70%, memoria >70%, errori >1%, p95 >2 s |
| Produzione, traffico elevato | Scalare orizzontalmente Standard; provare 4 GiB/2 vCPU solo se CPU-bound o RSS p95 supera 1,4 GiB | Autoscaling; niente numero fisso senza test; valutare multi-regione solo con dati compatibili | Rate limiter condiviso, analisi `EXPLAIN`, metriche pool e slow query; coda durevole per campagne | Pool e rate globali coordinati; non moltiplicare 5 connessioni per istanze senza quota | Load test progressivo, circuit breaker/backpressure e obiettivo 30-40% headroom |

Il limite di durata Vercel corrente è molto superiore all'SLO desiderabile per
una pagina interattiva; non va usato come obiettivo di risposta. Le campagne
possono durare più a lungo, ma con 100 destinatari devono essere monitorate
separatamente. I [limiti Vercel Functions](https://vercel.com/docs/functions/limitations)
sono limiti della piattaforma, non una prova che database, SMTP e applicazione
possano sostenere la stessa concorrenza.

### Formule di capacity planning

Senza telemetria live non è corretto dichiarare un numero massimo di utenti.
Usare:

```text
concorrenza_app = RPS_arrivo × latenza_p95_secondi

RPS_sicuri_DB =
  query_o_richieste_PostgREST_sostenibili_al_p95
  / richieste_PostgREST_p95_per_richiesta_app

RPS_sicuri =
  min(RPS_sicuri_DB, RPS_sicuri_SMTP, RPS_sicuri_Function)
  × 0,60

istanze_teoriche =
  ceil(concorrenza_app / concorrenza_verificata_per_istanza × 1,30)
```

Vercel decide il numero reale di istanze. La formula serve a verificare che il
database e i servizi esterni reggano la concorrenza generata dall'autoscaling.

Procedura:

1. raccogliere almeno sette giorni di p50/p95/p99, errori, CPU attiva e memoria;
2. misurare per route il numero di richieste PostgREST;
3. eseguire load test in preview con 10, 25, 50 e 100 utenti virtuali;
4. fermare l'incremento se p95 cresce oltre il 20%, errori superano l'1%,
   memoria non torna al baseline o il DB supera il 70% della capacità;
5. mantenere 30-40% di margine sul primo collo di bottiglia osservato;
6. ripetere con dataset simile alla produzione e allegati al limite massimo.

## 6. Rischi residui

1. **Rate limiter per istanza.** In ambiente multiistanza ogni processo ha
   contatori diversi; può limitare l'abuso locale ma non garantisce una quota
   globale.
2. **Campagne sincrone.** Un crash o timeout può lasciare una campagna
   parziale. Il claim atomico evita doppia presa in carico, ma non sostituisce
   una coda durevole con retry idempotenti.
3. **Pool SMTP moltiplicato per istanze.** Il cap locale non è un cap globale
   per l'account Gmail.
4. **Dashboard ancora query-intensive.** Le sezioni operative necessarie
   caricano fino a 200 iscrizioni e più dataset correlati. Sono stati rimossi i
   caricamenti inutili, non riscritta la logica.
5. **Indice composto non verificato.** Le query ricorrenti su
   `registrations` filtrano `event_id` e ordinano `submitted_at DESC`; esiste
   un indice su `event_id`, ma l'utilità di
   `(event_id, submitted_at DESC)` va dimostrata con `EXPLAIN (ANALYZE,
   BUFFERS)` sul database reale prima di creare una migration.
6. **Osservabilità incompleta.** Non sono disponibili nel repository metriche
   applicative per event-loop lag, GC, heap, cache, pool PostgREST, query lente
   e chiamate esterne. Il connettore Vercel non era autenticato durante
   l'audit.
7. **Benchmark HTTP variabile.** Usa Supabase remoto ma non simula sessioni
   autenticate, scritture, campagne o picchi reali.
8. **Nessun test di durata/multiistanza.** Non è stato eseguito perché avrebbe
   richiesto un ambiente isolato e quote esplicitamente autorizzate.
9. **Allegati in memoria.** Il limite di 10 MiB rende l'impatto contenuto, ma
   invocazioni Fluid concorrenti possono sommare più campagne nella stessa
   istanza.
10. **Sessione verificata due volte.** Proxy e pagina possono effettuare
    controlli auth ripetuti. È defense-in-depth e non è stata rimossa per non
    ridurre la sicurezza.

## 7. Raccomandazioni successive

1. Riautenticare il connettore Vercel e rilevare per sette giorni CPU attiva,
   memoria provisioned, durata, error rate, cold start e route p95/p99.
2. Verificare che la Function sia nella regione più vicina al Supabase
   self-hosted; misurare prima e dopo un eventuale cambio.
3. Abilitare o verificare Speed Insights per Core Web Vitals e TTFB, evitando
   di aggiungere telemetria duplicata.
4. Aggiungere logging strutturato campionato alle sole operazioni lente:
   route, durata, esito, numero record e chiamate esterne; mai email, nomi,
   token, allegati o corpi dei messaggi.
5. Eseguire `EXPLAIN (ANALYZE, BUFFERS)` sulle query dashboard con dataset
   realistico e creare l'indice composto soltanto se riduce realmente letture e
   ordinamento.
6. Sostituire il rate limiter locale con uno storage atomico condiviso prima di
   fare affidamento su di esso per la protezione multiistanza.
7. Spostare le campagne su una coda durevole soltanto quando durata, volume o
   retry reali dimostrano la necessità; preservare claim e idempotenza.
8. Aggiungere un load test autenticato in preview, con account sintetici e
   `EMAIL_DELIVERY_MODE=log`, includendo dashboard e campagne al limite di
   allegati.
9. Aggiungere un soak test di almeno 60 minuti per verificare ritorno dell'heap
   al baseline, crescita dei bucket e riuso delle connessioni.
10. Rieseguire il benchmark HTTP con almeno 10 run alternati prima/dopo o su
    commit separati quando la rete remota è stabile; usare mediana dei run e
    intervallo di confidenza.

## Verifiche finali

- `npm test`: 94 test superati;
- `npm run lint`: superato;
- `npm run typecheck`: superato;
- `npm run build`: superato;
- build: tutte le route dinamiche generate senza errori;
- verifica browser su `/`, `/login`, `/registrazione`: nessun error overlay,
  warning/errore console o overflow orizzontale;
- response byte count invariato per tutte le route benchmark;
- `git diff --check`: pulito;
- nessun processo Next.js lasciato attivo al checkpoint;
- nessun commit, push, deploy o intervento database eseguito.
