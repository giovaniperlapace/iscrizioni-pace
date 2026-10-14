# P13-E1 / P13-E2 / P13-E3 — inaugurazione e cerimonia finale

## Stato del 6 ottobre 2026

P13-S rinviata su indicazione dell’utente: mancano fonte e formato degli accrediti
stampa. L’utente autorizza la prossima milestone suggerita, P13-E1, e precisa
che le due cerimonie possono svolgersi in sedi diverse con caratteristiche
ancora sconosciute. Implementazione locale sul branch `codex/panel-p0-p10`.
Nessun commit, push, deployment o aggiornamento remoto del database.

## Flusso operativo

Dal menu Panel → Cerimonie si accede alla pagina condivisa
`/dashboard/manager/cerimonie`, disponibile ad admin, manager e viewer autorizzati.
Le schede Inaugurazione e Cerimonia finale selezionano configurazioni indipendenti:
ciascuna ha un momento e una location canonici propri, orari, capienza, settori,
quote, assegnazioni e revisione. Non vengono copiati o dedotti dati dell’altra sede.

1. L’admin crea una bozza, anche con sede, date e quantità ancora da definire.
   La capienza totale e quella dei settori possono essere sconosciute (`null`)
   oppure zero. La validazione richiede data/orari nel periodo dell’evento,
   capienza totale nota e nessun settore con capienza sconosciuta.
2. L’admin modella i settori quantitativi. La somma non supera il totale noto.
   Una configurazione ancora in bozza non consente assegnazioni.
3. Admin/manager creano quote con categorie esplicite per settore; le quote
   possono essere preparate in bozza, solo entro una capienza di settore nota.
4. A configurazione validata, admin/manager assegnano una quantità a un gruppo
   oppure un posto a una persona ammissibile. Una dotazione occupa immediatamente
   la quota; nessuna distribuzione nominale viene simulata in E1.
5. Le assegnazioni sono revocabili esplicitamente; riduzioni sotto gli impegni
   e cambi di sede/orario/regola con assegnazioni attive sono rifiutati.

La regola di ammissibilità è visibile e scelta dall’admin: almeno una fascia del
giorno, mattina o pomeriggio. Giorno ricavato dal momento in Europe/Rome.
Date assenti o sconosciute sono «Da verificare», distinte da presenza non prevista.
Non si scrivono prenotazioni volontarie, presenze dichiarate o check-in.
Gli orari sono inseriti nell’ora di Roma, indipendentemente dal fuso del browser.

La dotazione di gruppo non seleziona membri; il numero di presenze previste
mostrato nel selettore è informativo e riguarda solo le iscrizioni principali del
gruppo selezionato. L’assegnazione diretta dà un posto alla sola persona indicata.
I figli sono visibili accanto al genitore nel riepilogo delle persone, senza
mostrare date di nascita. Non si assegnano automaticamente posti ai figli.
La distribuzione E2 descritta sotto registra una decisione per ciascun minore,
caso per caso, come precisato dall’utente.
Sedute, geometrie e versioni delle piantine restano P13-E3.

## Integrità e autorizzazioni

Migration locale: `20261006180000_ceremony_allocations.sql`.

- `ceremony_plans` collega evento, tipo e momento; `ceremony_sectors` descrive
  il settore fisico quantitativo; `ceremony_quotas` ripartisce il settore;
  `ceremony_allocations` registra impegni e revoche senza cancellare lo storico.
- Le quattro tabelle hanno RLS e nessun accesso diretto anon/authenticated.
  RPC `get_ceremony` e `save_ceremony` riservate a service_role. Il server ricava
  attore e evento dalla sessione; il DB ricontrolla evento corrente e ruolo.
  Viewer legge soltanto; capogruppo e accoglienza non accedono a queste viste.
- Ruoli ed evento sono bloccati durante la transazione. Le operazioni sono
  serializzate per evento con advisory lock e revisioni ottimistiche per cerimonia.
  In caso di conflitto ricaricare e verificare, senza riscritture automatiche.
- I vecchi editor di location/momenti non possono cambiare o eliminare una
  configurazione collegata a una cerimonia, neppure tramite il client service.
- FK composte proteggono l’appartenenza di quote e settori alla cerimonia.
  Una sola assegnazione diretta attiva per persona/momento e una sola dotazione
  attiva per gruppo/quota. La revoca libera la quota, senza alterare check-in.
- L’audit registra operazione, ID e revisione; niente nomi, categorie o contatti.
- Cambi successivi di gruppo dell’assegnatario, cancellazioni, presenze non più
  ammissibili e gruppi inattivi segnalano l’impegno da rivedere: niente rilascio
  automatico. E2 estende il controllo ai membri delle dotazioni.
- La lettura è un unico snapshot JSON completo, quindi non è troncata al limite
  PostgREST di 1.000 righe. Oltre 50.000 iscrizioni fallisce esplicitamente e va
  sostituita con paginazione/versionamento; mai mostrare un risultato parziale.
- La capienza utilizzabile è `event_moments.capacity`; per compatibilità con
  la regola storica delle location (>0), una capienza utilizzabile zero non
  valorizza `event_locations.max_capacity`. La vista cerimonia distingue sempre
  zero da sconosciuto. I momenti rimangono privati, generali e con scanner disabilitato.

## Verifiche e accettazione

Esiti locali confermati il 6 ottobre 2026: `npm ci`, **763 test**, lint,
TypeScript e build staging superati. Suite SQL con fixture sintetiche,
concorrenza e browser desktop/mobile superati. URL diretto della pagina senza
sessione verificato: reindirizzamento al login, nessun dato operativo esposto.
Rimossa la route temporanea di collaudo prima della build; pulita la relativa
cache di tipi dev dopo la rimozione. Nessun errore runtime nel browser.

- Test applicativi: parser, capienza sconosciuta/zero, autorizzazione e attore
  derivato dalla sessione, esclusione viewer dalle scritture, errori bloccanti.
- PostgreSQL 17 temporaneo con tutte le migration applicabili: due sedi diverse,
  bozza/validazione, limiti settore/quota, riduzioni, revoca, duplicati, evento
  estraneo, privilegi, protezione editor precedenti, cambi di gruppo/date,
  lettura oltre 1.000 iscrizioni, check-in invariati.
- Concorrenza reale: due operatori sull’ultimo posto, una scrittura e un conflitto.
- Browser sintetico desktop/mobile: admin/manager/viewer, nessun modulo per
  viewer, configurazione solo admin, dati conservati dopo capienza insufficiente
  e conflitto, esclusione persone non ammissibili, bozze e capienze sconosciute.
- Script riproducibili: `node tests/sql/run-reception-checks.mjs`,
  `node tests/browser/ceremonies.mjs http://localhost:3123` con dev staging attivo.
  Il secondo crea e rimuove una route sintetica temporanea.

L’applicazione della migration nello staging, il collaudo autenticato completo,
la validazione delle sedi reali e l’accettazione dell’utente restano aperti.
La riuscita dei test locali non certifica queste verifiche né autorizza la stampa,
gli accessi stampa o l’ingresso alle cerimonie.


## P13-E2 — distribuzione e consultazione nominale

Avviata su richiesta esplicita dell’utente, con due precisazioni vincolanti:
anche i manager assegnano posti alle singole persone dalla vista dell’evento;
per i minori si decide caso per caso, senza automatismi di età o di famiglia.

- Manager/admin: dalla gestione cerimonie assegnano direttamente il posto alla
  persona, oppure aprono «Distribuzione nominale e scelte dei minori» per
  assegnare ai singoli membri le dotazioni di tutti i gruppi dell’evento.
  Nessuna appartenenza come capogruppo è richiesta al manager. Viewer sola lettura.
- Capogruppo: scheda Cerimonie, dotazioni dei propri gruppi attivi e discendenti.
  Ogni dotazione si distribuisce ai membri confermati del gruppo esatto; non
  assorbe implicitamente membri dei sottogruppi. Gli incarichi si sommano.
- Per ciascun minore accompagnato, manager o capogruppo sceglie «Assegna un posto»
  oppure «Non serve un posto». Solo la prima scelta consuma un posto. La seconda
  è persistente ed è possibile anche a dotazione piena. Nessuna scelta del
  genitore si applica automaticamente ai figli. Le scelte sono modificabili
  con revoca esplicita e nuova assegnazione; non si inventano limiti di età.
- Partecipante: sezione dedicata ai propri posti e alle scelte dei figli, nelle
  sette lingue. Non è una prenotazione volontaria né un check-in.
- Revoca restituisce il posto alla dotazione; un trasferimento atomico lo sposta
  fra dotazioni della stessa cerimonia, previa verifica di gruppo e disponibilità.
  Trasferire un’assegnazione diretta al gruppo libera la quota diretta.
  Una dotazione con decisioni nominali attive non può essere revocata in blocco.

Migration aggiuntiva `20261006200000_ceremony_distribution.sql`, da applicare
successivamente a E1. Registro unico `ceremony_nominees`, incluso backfill delle
assegnazioni dirette; indice per soggetto/cerimonia contro i duplicati. Identità
minore conservata nello storico se l’editor famiglia elimina o sostituisce il
figlio; il posto richiede revisione, non diventa un posto del genitore.

Le RPC sono service-only, con sessione verificata lato server e attore/evento/
ruoli/scope verificati nuovamente nel DB. Lock e revisioni sono comuni a manager
e capogruppo; retry con UUID stabile evita doppie scritture dopo una risposta
persa. Audit senza nomi o contatti. Le letture sono snapshot JSON completi;
errori impediscono di mostrare disponibilità fittizie. I lock conservativi su
gruppi, membership, assegnazioni e minori vanno misurati sotto carico reale.

Cambio gruppo/date, cancellazione o rimozione del minore segnala «Da rivedere»;
non libera il posto automaticamente. Il vecchio capogruppo vede la decisione
storica e può revocarla, senza ricevere i dati del nuovo gruppo. Il manager può
trasferirla dopo aver verificato la nuova appartenenza. Il QR gruppo mantiene
le proprie verifiche di composizione e non viene rigenerato dalle cerimonie.

Verifiche E2 locali: 768 test applicativi, lint, TypeScript e build staging
superati; PostgreSQL temporaneo con snapshot oltre 1.000 persone e scenari
manager/capogruppo, gerarchia, minori indipendenti, nessun posto, duplicazione fra
percorso diretto e gruppo, revoca, trasferimento e privacy. Concorrenza reale
manager/capogruppo sull’ultimo posto nominale e retry identici. Suite QR gruppo
rieseguita. Script UI: `node tests/browser/ceremony-distribution.mjs`, fixture
sintetica che crea e rimuove il percorso temporaneo, controlli sette lingue,
viewer, mobile, risposta persa e ripetizione della stessa richiesta.

Restano collaudo autenticato nello staging, sedi reali e accettazione sul campo.
Nessuna migration remota, commit, push o deployment in questa tranche.

## P13-E3 — piantine versionate e sedute numerate

Avviata il 6 ottobre 2026 su richiesta esplicita dell’utente. Tranche software
locale sullo stesso branch panel, conservando E1/E2. Fetch e pull fast-forward:
nessun commit da incorporare; `origin/main` già contenuto nel branch.

### Percorsi e operazioni

- Gestione cerimonie → **Piantina e posti numerati**, con inaugurazione e finale
  indipendenti. L’admin apre l’editor, aggiunge file nel settore scelto, modifica
  etichette e coordinate delle singole sedute, marca posti non utilizzabili e
  salva la bozza. La pubblicazione è un secondo comando esplicito.
- Ogni seduta ha un UUID stabile distinto da coordinate, fila e numero. Le file
  generate hanno un massimo di 200 sedute per comando; si possono aggiungere più
  file e spostare ogni seduta. Limite dichiarato: 10.000 sedute per versione,
  coordinate da 0 a 10.000. Nessuna capienza o sede reale viene precaricata.
- Le versioni pubblicate sono immutabili e archiviate alla pubblicazione della
  successiva. L’admin può consultare le versioni precedenti e copiarle in una
  nuova bozza; anche questa deve superare la nuova validazione.
- Manager/admin selezionano una dotazione o un’assegnazione diretta già creata
  in E1/E2 e riservano una o più sedute del settore corretto. La selezione
  consecutiva usa numeri consecutivi della stessa fila, interrompendosi su
  posti bloccati, occupati o numeri mancanti; non deduce adiacenza da coordinate.
  Corridoi/interruzioni vanno modellati con file distinte o salti di numerazione.
- Manager e capigruppo scelgono poi una seduta ricevuta e una persona con posto
  già assegnato nel registro nominale E2. I capigruppo operano soltanto nelle
  proprie dotazioni autorizzate, inclusi i gruppi discendenti. Non riservano
  nuove sedute dal settore. Viewer sola lettura; editor riservato all’admin.
- Zoom, legenda testuale e cromatica, selezione multipla, ricerca fila/posto,
  filtro settore e tabella alternativa con checkbox e pagine da 50 sedute.
  Le azioni multilingue conservano la selezione e i dati in caso di errore;
  esito incerto blocca nuovi comandi e offre retry con lo stesso UUID.
- Il trasferimento di una seduta è esplicito: togliere la seduta alla persona,
  eventualmente liberarla dalla dotazione, riservarla alla destinazione e
  attribuirla alla persona. Ogni comando è atomico; la sequenza non costituisce
  un blocco esclusivo fra più operatori. Un altro manager può riservare il posto
  dopo il rilascio, quindi verificare nuovamente la disponibilità.
- Nessun annullamento implicito: E1 non può revocare una dotazione con sedute
  riservate ed E2 non può revocare/trasferire una persona con seduta numerata.
  Prima usare i comandi espliciti della piantina. La revoca della sola seduta
  lascia il posto quantitativo della persona e della dotazione invariato.

### Passaggio dalle quantità e vincoli

La pubblicazione non assegna né toglie posti alle persone. Restano invariati
quote, dotazioni, registro nominale, scelte individuali dei minori e check-in.
La vista conta le sedute ancora da riservare alla dotazione e le persone ancora
senza numero. Un minore con scelta «Non serve un posto» non può ricevere sedute.

La somma delle sedute utilizzabili di ogni settore deve coprire tutte le quote
quantitative e non superare la capienza validata. Dopo la pubblicazione anche
l’editor E1 impedisce quote superiori alle sedute utilizzabili e capienze
inferiori alla mappa. Una nuova versione non può eliminare, bloccare, cambiare
settore o rinominare una seduta impegnata. Può spostarne le coordinate mantenendo
identità ed etichetta; la validazione della geometria reale resta umana.

### Database, autorizzazioni e raccordi

Migration aggiuntiva locale `20261006220000_ceremony_seat_maps.sql`, successiva
alle migration E1/E2, che restano invariate. Quattro tabelle RLS senza accesso
anon/authenticated: versioni, identità delle sedute, riserve e ricevute dei retry.
RPC `get_ceremony_map` / `set_ceremony_map` service-only, attore dalla sessione,
ruoli ed evento ricontrollati nel DB, stesso advisory lock/revisione E1/E2,
vincoli univoci su seduta e nominativo, trigger di integrità e audit senza nomi.
I retry ricontrollano i permessi prima di restituire la ricevuta. La lettura è
uno snapshot completo; errore o superamento dei limiti non diventa disponibilità
zero. Il capogruppo vede l’occupazione degli altri posti senza ID di dotazione,
nominativi o bozze degli altri operatori.

La consultazione personale nelle sette lingue mostra fila e numero, oppure
«Seduta da assegnare» dopo la pubblicazione. L’elenco stampabile delle piantine
include nominativi autorizzati, settore/categoria, numero, scelte senza posto e
segnalazioni di revisione. È un elenco assegnazioni, non un registro ingressi.

La proiezione canonica `app.ceremony_numbered_seat` alimenta consultazione,
scanner evento/gruppo e anteprima badge. Le RPC preesistenti di accoglienza e
coda badge restano responsabili di autorizzare attore e identità; wrapper
aggiuntivi arricchiscono soltanto risposte già valide. Nello scanner i posti
sono indicazioni per l’orientamento, separate dall’ingresso evento. L’anteprima
badge gruppo riusa il QR attivo e mostra il posto del titolare adulto; i minori
mantengono il QR del genitore e le proprie assegnazioni nominali separate.
Un badge già preparato/stampato è uno snapshot: dopo una riallocazione occorre
richiedere esplicitamente una ristampa; non viene modificato automaticamente.

Non vengono concessi incarichi o diritti di ingresso alle cerimonie, né attivato
lo scanner dei relativi momenti. Il raccordo informativo non sostituisce la
futura decisione su incarichi/accessi cerimonie. P14/P15 e la calibrazione delle
stampanti restano separati; non sono stati avviati.

### Collaudi locali e limiti residui

Esiti finali confermati: **775 test applicativi**, lint senza warning,
TypeScript e build staging superati, oltre alle suite SQL e browser sottostanti.
Il controllo delle route riservate ha segnalato la route temporanea durante
una prima esecuzione sovrapposta al browser; rimossa la fixture, la suite
completa è stata rieseguita senza modificare quel controllo ed è passata.

- `npm ci`; test applicativi di parser, geometria/identità, contiguità, scope,
  attore dalla sessione, letture bloccanti e proiezioni minimizzate.
- PostgreSQL 17 temporaneo con migration applicabili: bozza/pubblicazione,
  conversione senza doppio conteggio, minori con/senza posto, viewer e leader,
  altri gruppi/eventi, privilegi/RLS, retry e revoca ruolo, versioni immutabili,
  riallocazione esplicita e protezione dei percorsi E1/E2. Due sedi indipendenti
  e snapshot di **1.501 sedute**. Controllati scanner famiglia/gruppo e badge.
- Concorrenza fra due manager sull’ultima seduta; manager/capogruppo sullo
  stesso nominativo; quattro retry simultanei della richiesta vincente:
  una sola riserva/assegnazione attiva. Suite accoglienza/gruppi preesistente
  rieseguita, nessun cambiamento implicito ai check-in.
- Browser sintetico desktop/mobile: mappa, selezione contigua e tabellare,
  risposta persa, UUID identico al retry, nominativo/minore ancora da numerare,
  sola lettura viewer, editor admin, versione successiva, errore/conflitto con
  bozza conservata e sette lingue. Regressione del browser E2 separata.
- Script: `node tests/sql/run-reception-checks.mjs` e, con dev staging locale,
  `node tests/browser/ceremony-seat-maps.mjs http://localhost:3123`.
  Le route sintetiche vengono create e rimosse dallo script: eseguire la suite
  applicativa e la build dopo la loro rimozione, non durante il test browser.

Nessun commit, push, deployment, SQL remoto o invio email. Restano da fare
l’applicazione concordata delle migration E1/E2/E3 in staging, il collaudo
integrato autenticato, la misura dei lock sotto carico reale, la validazione
fisica delle sedi e l’accettazione sul campo. P13 non è dichiarata conclusa.


## Aggiornamento staging autorizzato — 6 ottobre 2026

Su nuova richiesta esplicita dell’utente, le tre migration E1/E2/E3 sono state
applicate e registrate atomicamente nello staging PostgreSQL 15.8, dopo backup
custom `/tmp/iscrizioni-pace-staging-before-ceremonies-20261006151320.dump`
conservato sul server e verificato con `pg_restore --list`. Le cornici transazionali
sono state rimosse soltanto dallo stream di esecuzione per avere un unico commit;
i file versionati sono rimasti invariati. Lock/timeout e ricarica PostgREST inclusi.

Conteggi e hash delle 51 tabelle preesistenti identici prima/dopo. Dieci nuove
tabelle con RLS e RPC riservate a service_role, negate ad anon/authenticated.
Zero destinatari email. Production invariata. Resta assente soltanto la rinomina
storica `20260813170000`, già documentata come non applicabile e non necessaria.

Autorizzati commit e push delle modifiche locali E1/E2/E3 sul branch panel.
La precedente nota «migration solo locali» descrive la fase di sviluppo;
per il database staging è superata da questo aggiornamento. Le verifiche locali
sono 775 test, lint senza warning, TypeScript/build staging, SQL e browser.
Il collaudo integrato autenticato e la validazione delle sedi restano aperti.
