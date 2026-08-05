# Piano di lavoro Panel

## 1. Scopo del documento

Questo documento organizza lo sviluppo delle funzioni relative a:

- programma e panel;
- location e capienze;
- sezioni di posti riservate a pubblici diversi;
- iscrizione individuale ai panel;
- prenotazioni scolastiche per classi;
- destinatari delle campagne email collegati a panel e scuole;
- statistiche sui panel;
- accesso all'evento tramite QR e rilevazione delle presenze effettive;
- stampa del QR su etichette per i badge all'accoglienza.

Il lavoro va eseguito in milestone piccole. Ogni milestone deve essere
implementata, verificata e provata nell'interfaccia prima di iniziare la
successiva. Al termine di ogni milestone si raccolgono osservazioni e si
corregge quanto emerso: il passaggio alla milestone seguente non e'
automatico.

Questo piano integra la roadmap storica di `PIANO_DI_LAVORO.md` e, per questo
ambito, sostituisce le precedenti indicazioni generiche delle Milestone 16-18.
Non sostituisce `AGENTS.md`, che resta la memoria tecnica stabile del progetto.

Stato di partenza al 2026-08-04:

- esistono gia' `event_locations` ed `event_moments`;
- esiste gia' `moment_attendance_choices`, previsto per le scelte dei momenti;
- esistono gia' QR personali opachi, revocabili e mostrati nella dashboard;
- esistono gia' `check_ins` e le policy di base per il ruolo `accoglienza`, ma
  manca il flusso di scansione completo;
- la dashboard partecipante ha gia' uno spazio predisposto per i panel;
- la console campagne ha gia' destinatari espliciti, filtri, tab audience e
  coda giornaliera;
- la sezione statistiche manager e' gia' in sviluppo e va estesa senza
  duplicare query o viste;
- le lingue pubbliche supportate sono italiano, inglese, francese, tedesco,
  spagnolo, neerlandese e ucraino.

## 2. Metodo obbligatorio per ogni milestone

### Strategia di integrazione P0-P10

- Le milestone da P0 a P10 vengono sviluppate e collaudate su un unico branch
  di lunga durata, `codex/panel-p0-p10`, collegato all'ambiente di staging.
- Ogni milestone mantiene commit, verifiche e pausa di revisione distinti, ma
  il branch panel non viene unito a `main` al termine delle singole milestone.
- Codice e migration panel da P0 a P10 arrivano in production soltanto dopo il
  completamento e il collaudo complessivo della Milestone P10.
- Le migration panel vengono applicate durante lo sviluppo esclusivamente al
  database di staging. Non devono essere applicate al database production
  prima della procedura finale di rilascio P0-P10.
- I bugfix urgenti delle funzioni iscrizioni continuano a essere sviluppati e
  rilasciati da `main`; dopo ogni rilascio rilevante, `main` viene integrato nel
  branch panel per evitare divergenza e scoprire presto eventuali conflitti.
- Prima del merge finale sono obbligatori: riallineamento con `origin/main`,
  regressione completa su iscrizioni, iscritti, gruppi, servizi, campagne e QR,
  verifica RLS e concorrenza capienze, backup production e piano di rollback.
- Le milestone P11 e successive iniziano un ciclo separato dopo il rilascio di
  P0-P10 e non devono prolungare il branch di integrazione del modulo panel.

Prima di iniziare:

- verificare `pwd`, branch e `git status --short`;
- riallineare il contesto con `origin/main` quando si raggiunge una milestone
  condivisa, senza sovrascrivere modifiche locali non proprie;
- leggere schema, policy RLS e codice realmente in uso nell'area interessata;
- concordare eventuali decisioni ancora aperte che cambiano dati o flusso.

Durante il lavoro:

- mantenere diff brevi e limitati alla milestone;
- riusare le entita' canoniche esistenti invece di creare un secondo sistema
  parallelo per panel o check-in;
- applicare autorizzazione sia nell'interfaccia sia lato server/RLS;
- rendere atomiche prenotazioni, cancellazioni e controlli di capienza;
- registrare in audit le azioni operative importanti senza salvare dati
  personali non necessari;
- aggiornare da subito tutte le lingue per le nuove interfacce pubbliche e per
  partecipanti; manager e admin possono restare prioritariamente in italiano;
- non applicare migration al database remoto e non fare commit o push senza
  una richiesta esplicita.

Prima di concludere:

- verificare il diff e i file modificati;
- eseguire almeno test mirati, `npm run lint`, `npm run typecheck`, `npm test`
  e `npm run build`, salvo impedimenti documentati;
- provare nel browser il flusso modificato su desktop e mobile;
- per schema e permessi, testare almeno admin, manager, manager_viewer,
  accoglienza, partecipante e utente anonimo secondo lo scope della milestone;
- aggiornare `AGENTS.md` con decisioni, schema, workflow, RLS e limiti stabili;
- annotare cosa e' stato approvato, cosa va migliorato e cosa resta fuori
  scope.

Ogni milestone si considera conclusa solo dopo una breve revisione funzionale
con dati realistici. I bug emersi nella revisione si correggono prima di
estendere il modulo.

## 3. Regole di prodotto proposte

### 3.1 Panel, location e programma

- `event_moments` resta la fonte canonica dei momenti del programma. Un panel
  e' un momento di tipo `panel`, non una tabella programma parallela.
- Ogni panel ha almeno titolo, descrizione, data/ora di inizio e fine,
  location e stato di pubblicazione.
- Ogni location ha nome, indirizzo e capienza massima fisica.
- Una location rappresenta uno spazio fisico realmente utilizzabile da un solo
  panel nella stessa fascia. Sale diverse nello stesso edificio sono location
  distinte.
- Due panel non possono sovrapporsi nella stessa location. Un eventuale caso
  speciale dovra' essere modellato dividendo correttamente la location, non
  ignorando il conflitto.
- I tipi di pubblico sono un catalogo configurabile dell'evento, per esempio
  `Ospiti`, `Scuole`, `Iscritti`. Ogni tipo dichiara anche il canale ammesso:
  assegnazione interna, iscrizione individuale o prenotazione scolastica.
- Ogni panel possiede una o piu' sezioni di capienza collegate ai tipi di
  pubblico. Le sezioni sono quote di posti, non settori fisici o sedute
  numerate.
- Per un panel pubblicabile, la somma delle capienze delle sezioni deve essere
  esattamente uguale alla capienza massima della location.
- Una bozza puo' essere temporaneamente incompleta mentre viene compilata, ma
  mostra sempre posti assegnati, posti mancanti o eccedenza. Non puo' essere
  pubblicata finche' il totale non e' esatto.
- Un panel pubblicato puo' essere modificato. Il salvataggio deve essere
  atomico, mantenere il totale esatto e non ridurre nessuna sezione sotto i
  posti gia' confermati.
- Se cambia la capienza di una location gia' usata da panel pubblicati, la UI
  deve mostrare tutti i panel coinvolti e richiedere una riconciliazione
  atomica delle loro sezioni. Non devono esistere panel pubblicati in stato di
  capienza incoerente.
- Una modifica a titolo, descrizione, orario, location o disponibilita' dopo la
  pubblicazione deve essere auditata. Se coinvolge persone gia' prenotate, la
  UI deve mostrare il numero degli interessati e offrire un collegamento alla
  campagna email filtrata; l'invio non e' automatico nella prima versione.
- La pubblicazione multipla usa checkbox e un riepilogo finale. E'
  transazionale: o tutti i panel selezionati sono validi e vengono pubblicati,
  oppure nessuno cambia stato.

### 3.2 Prenotazioni individuali

- Un partecipante usa la propria registrazione all'evento per iscriversi ai
  panel; non viene creata una seconda anagrafica.
- L'iscrizione e la cancellazione devono essere idempotenti e protette da
  prenotazione atomica della capienza, per evitare overbooking con richieste
  contemporanee.
- Il partecipante vede solo sezioni abilitate all'iscrizione individuale. Le
  quote ospiti o scuola non sono selezionabili dal flusso ordinario.
- Nella prima versione non c'e' lista d'attesa: quando la quota e' esaurita il
  panel risulta completo. Una lista d'attesa potra' essere aggiunta solo con
  una milestone separata.
- Panel sovrapposti per la stessa persona vanno bloccati, mostrando chiaramente
  il conflitto.
- Come regola iniziale coerente con il modello attuale, i minori collegati
  ereditano la scelta panel dell'iscrizione principale e consumano posti reali.
  Il numero prenotato e' quindi `1 + minori collegati`. Questa regola deve
  essere confermata nella Milestone P0 prima di creare la migration.

### 3.3 Prenotazioni scuole

- Il flusso scuola e' distinto dall'iscrizione personale e non richiede i nomi
  degli studenti.
- I dati minimi proposti sono: scuola, citta', classe o descrizione del gruppo,
  numero studenti, numero accompagnatori, nome, cognome, email e telefono del
  professore referente, consenso/privacy e note operative facoltative.
- I posti occupati da una prenotazione scuola sono studenti piu'
  accompagnatori. La capienza viene scalata dalla sezione `Scuole` del panel.
- Una prenotazione puo' contenere piu' panel, con quantita' dichiarata per ogni
  panel, ma non puo' prenotare momenti sovrapposti per lo stesso gruppo.
- Il docente accede alla prenotazione tramite email e magic link, puo'
  correggere i dati e ridurre o annullare i posti entro i limiti stabiliti.
- L'aumento dei posti ripete sempre il controllo atomico della capienza.
- Il QR scuola rappresenta la prenotazione di gruppo, non una persona. Al
  check-in l'operatore conferma il numero effettivo di studenti e
  accompagnatori presenti.
- I professori sono una audience distinta delle campagne. Devono essere
  deduplicati per email normalizzata anche se hanno piu' prenotazioni, senza
  essere mescolati automaticamente con partecipanti o capigruppo.

### 3.4 QR, presenze e badge

- Il QR personale continua a contenere soltanto un token opaco. Nome, email,
  ruolo e dati sensibili non devono comparire nel contenuto del codice.
- Una scansione valida all'ingresso registra automaticamente la presenza
  effettiva della persona. Una seconda scansione non crea un duplicato e mostra
  data/ora del check-in precedente.
- Per una registrazione senza minori, la scansione puo' confermare subito il
  check-in. Se esistono minori collegati, l'operatore vede un selettore minimo
  per indicare chi e' realmente presente: non si deve presumere che tutto il
  nucleo sia arrivato.
- Per le scuole si registra un conteggio effettivo aggregato, perche' non
  vengono raccolte le identita' degli studenti.
- L'accoglienza vede soltanto nome/codice, stato iscrizione, stato presenza,
  composizione minima del nucleo o del gruppo scuola e alert strettamente
  operativi. Non vede contatti completi, questionario o dati di accessibilita'.
- Deve esistere un fallback manuale tramite codice partecipante o ricerca
  controllata per chi non ha il QR disponibile.
- Correzione o annullamento di un check-in richiedono un'azione esplicita e
  auditata.
- Il QR stampato sull'etichetta e' lo stesso QR attivo della persona, non un
  nuovo identificativo. La stampa non deve revocare o rigenerare il token.
- L'etichetta iniziale contiene QR ad alto contrasto, codice partecipante e il
  minimo testo approvato. Dimensioni, densita' e contenuti finali dipendono
  dalla stampante e vanno verificati con badge reali.

## 4. Modello dati da verificare nella prima fase

Questa e' una direzione architetturale, non una migration gia' approvata.

- Estendere `event_locations` con `max_capacity` e gli eventuali campi
  operativi indispensabili.
- Estendere `event_moments` con tipo del momento, stato
  `draft`/`published`, timestamp e autore di pubblicazione. Mantenere una
  migrazione compatibile con l'attuale `is_public`.
- Creare un catalogo evento dei tipi di pubblico, per esempio
  `panel_audience_types`.
- Creare le quote di posti del singolo panel, per esempio
  `panel_seat_sections`, con capienza e canale di prenotazione derivato dal
  tipo pubblico.
- Estendere `moment_attendance_choices` per rappresentare l'iscrizione
  individuale confermata alla sezione corretta. Prima di sostituirla con una
  nuova tabella va dimostrato che l'estensione non e' sufficiente.
- Usare funzioni SQL transazionali per prenotazione/cancellazione e lock della
  sezione, con controlli su evento, stato panel, eligibility e capienza.
- Creare entita' separate per prenotazione scuola, referente docente e righe
  panel della prenotazione; non duplicare gli studenti come `participants`.
- Estendere il modello QR solo quanto serve per identificare in modo sicuro una
  prenotazione scuola. I QR personali restano collegati a `registrations`.
- Rendere `check_ins` capace di distinguere adulto registrato e minori
  collegati, con unicita' per persona/evento. Per le scuole usare un check-in
  aggregato con quantita' prevista ed effettiva.
- Aggiungere indici per evento, panel, sezione, stato, referente scuola e
  check-in; evitare conteggi completi non indicizzati nelle pagine operative.
- Tutte le nuove tabelle devono avere RLS. Manager e admin gestiscono il
  catalogo; `manager_viewer` legge; partecipante legge e modifica soltanto le
  proprie scelte; docente legge e modifica soltanto la propria prenotazione;
  accoglienza opera soltanto sui check-in dell'evento in scope.

Vincoli che devono vivere anche nel database o in funzioni transazionali, non
solo nel browser:

- evento coerente fra location, panel, sezione e prenotazione;
- date valide e assenza di sovrapposizione nella stessa location;
- capienze non negative;
- totale sezioni esatto al momento della pubblicazione e dopo ogni modifica a
  un panel pubblicato;
- nessuna sezione sotto il numero gia' prenotato;
- nessun overbooking concorrente;
- unicita' della prenotazione individuale per registrazione e panel;
- idempotenza del check-in;
- nessuna pubblicazione o modifica operativa da `manager_viewer`.

## 5. Sequenza delle milestone

### Milestone P0 - conferma regole e dati pilota

Stato: completata il 2026-08-05. Decisioni registrate in
`docs/panel-p0-decisions.md`.

Scopo: chiudere le decisioni che cambiano schema o hardware prima di scrivere
migration.

Deliverable:

- elenco di location reali o realistico con nome, indirizzo e capienza;
- almeno tre panel di prova con orari, descrizioni e sezioni;
- catalogo iniziale dei tipi di pubblico e relativo canale di iscrizione;
- conferma della regola sui posti consumati dai minori;
- conferma dei campi minimi e della privacy per il referente scuola;
- scelta preliminare di dispositivi accoglienza, sistema operativo, browser,
  modello stampante, collegamento USB/Bluetooth/rete e formato etichetta;
- decisione esplicita sulla necessita' di funzionamento offline. In assenza di
  requisito, la prima versione e' online con fallback manuale.

Verifica e revisione:

- simulare su carta un panel pieno, una modifica dopo pubblicazione, una classe
  e una famiglia con minori;
- approvare termini e campi visibili prima della migration.

Accettazione: non restano ambiguita' che richiederebbero di rifare chiavi,
vincoli di capienza o formato delle prenotazioni.

Documento di lavoro: `docs/panel-p0-decisions.md`.

### Milestone P1 - schema panel, location, sezioni e RLS

Stato: completata sullo staging il 2026-08-05. Migration, seed sintetico,
vincoli transazionali e RLS sono stati verificati prima con rollback e poi
applicati in modo persistente soltanto allo staging. Production resta invariata.

Scopo: costruire la base dati canonica senza ancora esporre form pubblici.

Deliverable:

- migration versionata per estendere location e momenti;
- tipi pubblico e sezioni di capienza;
- stato bozza/pubblicato e audit essenziale;
- funzioni di validazione per totale capienza e sovrapposizione location;
- RLS aggiornata: manager/admin scrittura, manager_viewer lettura, pubblico
  solo sui panel pubblicati;
- seed di prova derivato dalla Milestone P0.

Verifiche:

- test SQL e applicativi su scope evento, somme corrette/errate, location
  sovrapposta, ruolo non autorizzato e modifica di un panel pubblicato;
- controllo esplicito che le bozze non siano leggibili anonimamente.

Accettazione: lo schema accetta configurazioni valide e rifiuta incoerenze
senza affidarsi alla sola UI.

Pausa di revisione: riesaminare nomi, vincoli e migrazione prima di applicarla
al database remoto.

### Milestone P2 - gestione manager delle location

Stato: implementata localmente sul branch `codex/panel-p0-p10` il 2026-08-05,
in attesa di revisione funzionale e applicazione della migration P2 soltanto
allo staging. Nessuna modifica P2 e' stata applicata in production.

Scopo: aggiungere alla dashboard manager/admin una sezione `Panel` con la
prima sottovista `Location`.

Deliverable:

- voce sidebar coerente con `nav=mini` e icone Lucide;
- tabella location ricercabile;
- creazione e modifica in overlay di nome, indirizzo e capienza massima;
- indicazione dei panel che usano la location;
- protezione delle modifiche che renderebbero incoerenti panel pubblicati;
- vista read-only per `manager_viewer`.

Verifiche: CRUD, validazioni client/server, permessi, overlay, responsive,
navigazione con sezione e `nav` preservati.

Accettazione: un manager configura le sale senza poter creare capienze
negative o incoerenti.

### Milestone P3 - bozze panel e sezioni di posti

Stato: implementata localmente sul branch `codex/panel-p0-p10` il 2026-08-05,
in attesa di revisione funzionale e applicazione delle migration P2/P3
esclusivamente allo staging. Nessuna modifica P3 e' stata applicata in
production.

Scopo: permettere la creazione completa di panel in bozza.

Deliverable:

- tabella panel con filtri per stato, data e location;
- form overlay per titolo, descrizione, orari e location;
- editor delle sezioni con tipo pubblico e numero posti;
- riepilogo in tempo reale `assegnati / capienza / differenza`;
- messaggi chiari su conflitti di orario e totale non valido;
- salvataggio bozza anche se la distribuzione non e' ancora completa;
- audit di creazione e modifica.

Verifiche: aggiunta/rimozione sezioni, duplicati tipo pubblico, cambio
location, conflitti, bozza incompleta, tastiera e lettori di schermo.

Accettazione: il manager prepara panel complessi senza renderli pubblici e
capisce immediatamente cosa manca per pubblicarli.

### Milestone P4 - pubblicazione singola, multipla e modifica successiva

Stato: implementata localmente sul branch `codex/panel-p0-p10` il 2026-08-05,
in attesa di revisione SQL/RLS, applicazione delle migration P2-P4 soltanto
allo staging e collaudo funzionale autenticato. Nessuna modifica P4 e' stata
applicata in production.

Scopo: rendere sicuro il passaggio da bozza a programma pubblico.

Deliverable:

- pulsante di pubblicazione sulla singola riga;
- checkbox di riga, checkbox intestazione e azione pubblica selezionati;
- dialogo con numero e titoli dei panel coinvolti;
- validazione transazionale all-or-nothing;
- stato e data di pubblicazione visibili in tabella;
- modifica dei panel pubblicati con controllo posti gia' prenotati;
- riepilogo delle persone coinvolte da modifiche sostanziali e scorciatoia
  futura/attiva verso campagne;
- audit per pubblicazione singola, multipla e modifica post-pubblicazione.

Verifiche: selezione filtrata, pannello non valido nel batch, doppio submit,
concorrenza, ruolo viewer e aggiornamento immediato della vista pubblica.

Accettazione: nessun click puo' pubblicare un panel incompleto o lasciare un
batch parzialmente pubblicato.

### Milestone P5 - programma panel nella home pubblica

Scopo: mostrare sulla home le informazioni pubbliche dei panel.

Deliverable:

- sezione home accessibile e responsive;
- raggruppamento per giorno o fascia, con titolo, descrizione, orario,
  location e indirizzo;
- solo panel pubblicati;
- stato disponibilita' pubblico senza esporre quote riservate non pertinenti;
- CTA per accedere alla propria iscrizione e scegliere i panel;
- testi in tutte le lingue supportate;
- metadata e struttura semantica adeguati.

Verifiche: utente anonimo, nessun panel, panel completo, cambio lingua,
mobile, descrizioni lunghe e date nel fuso `Europe/Rome`.

Accettazione: chi visita la home comprende il programma e raggiunge il proprio
accesso senza vedere bozze o dati operativi.

### Milestone P6 - iscrizione individuale ai panel

Scopo: attivare l'area panel gia' predisposta nella dashboard partecipante.

Deliverable:

- migration finale delle scelte individuali e funzioni atomiche;
- elenco dei panel pubblicati compatibili con l'iscrizione individuale;
- iscrizione e cancellazione self-service;
- indicazione posti disponibili/completo senza promettere disponibilita'
  obsoleta;
- blocco sovrapposizioni;
- conteggio corretto dei minori secondo la decisione P0;
- riepilogo nella schermata rapida della dashboard;
- audit senza dati superflui.

Verifiche: ultimo posto con richieste concorrenti, retry, doppio click,
cancellazione, panel modificato, nucleo con minori, partecipante non
proprietario e tutte le lingue.

Accettazione: la capienza non viene mai superata e il partecipante vede sempre
le proprie scelte reali.

### Milestone P7 - schema e backoffice delle prenotazioni scuole

Scopo: creare la base separata per classi e docenti senza raccogliere i nomi
degli studenti.

Deliverable:

- migration per prenotazioni scuola, referente, righe panel e stati;
- funzioni atomiche per riservare, ridurre e annullare posti scuola;
- QR opaco di prenotazione gruppo;
- RLS e accesso docente tramite identita' email verificata;
- tabella manager delle prenotazioni con ricerca, stato, scuola, docente,
  panel e quantita';
- scheda dettaglio/modifica controllata e audit.

Verifiche: email duplicata su piu' classi, quota scuola piena, modifica
quantita', annullamento, panel sovrapposti, ruolo viewer, accesso docente
estraneo.

Accettazione: una prenotazione scuola occupa solo la propria quota e non crea
falsi partecipanti individuali.

### Milestone P8 - flusso pubblico scuole

Scopo: permettere al professore di prenotare biglietti per una o piu' classi.

Deliverable:

- sezione `Scuole` dalla home con spiegazione dedicata;
- form minimo definito in P0;
- scelta panel e numero posti;
- consenso/privacy versionato;
- conferma via email e accesso magic link alla prenotazione;
- pagina docente per consultare, correggere, ridurre o annullare;
- QR scuola scaricabile;
- testi in tutte le lingue supportate;
- email transazionali separate dalle campagne.

Verifiche: validazioni, quota terminata durante il submit, retry email,
prenotazione senza smartphone, link scaduto, mobile e accessibilita'.

Accettazione: un docente completa e recupera la prenotazione senza account
manuale e senza inserire dati degli studenti.

### Milestone P9 - destinatari campagne per panel e professori

Scopo: estendere la console campagne senza alterare la selezione esplicita
esistente.

Deliverable:

- filtro cercabile per panel nella tab `Partecipanti`;
- filtro basato sulle scelte canoniche confermate, non su tag o snapshot;
- nuova tab audience `Professori` alternativa a `Partecipanti` e
  `Capigruppo`;
- righe docente deduplicate con scuola e panel utili al riconoscimento;
- filtri professori per scuola e panel;
- cambio tab che azzera la selezione, come per le audience esistenti;
- riepilogo destinatari e campi personalizzati appropriati;
- rispetto della coda globale e nessuna email in chiaro nei log campagna.

Verifiche: partecipante cancellato dal panel, docente con piu' classi,
filtri che non azzerano la selezione, seleziona tutte le righe filtrate, tab
audience e anteprima/test/invio finale.

Accettazione: il manager puo' inviare una campagna soltanto agli iscritti di
uno specifico panel oppure ai professori selezionati, senza mescolare le due
audience.

### Milestone P10 - report statistiche panel

Scopo: aggiungere alla sezione statistiche una vista decisionale sui panel.

Deliverable:

- riepilogo per panel con location, capienza, prenotati e posti residui;
- dettaglio per sezione/tipo pubblico;
- distinzione fra persone individuali, minori ereditati e posti scuola;
- numero di prenotazioni scuola e persone previste;
- segnalazione di panel pieni, quasi pieni, non configurati o incoerenti;
- dopo il check-in, confronto previsto/effettivo e no-show;
- filtri per giorno, location, panel e tipo pubblico;
- collegamenti verso gestione panel e campagne filtrate;
- vista read-only per manager_viewer.

Verifiche: conteggi su fixture note, cancellazioni, nuclei con minori, scuole,
capienza zero e nessuna divisione fuorviante.

Accettazione: ogni numero e' riconciliabile con le prenotazioni sottostanti e
serve a un'azione operativa concreta.

### Milestone P11 - verifica QR e modello delle presenze effettive

Scopo: rendere sicura e corretta la registrazione della presenza prima di
costruire lo scanner.

Deliverable:

- servizio server di verifica del token opaco;
- risposta minima e tipizzata per accoglienza;
- evoluzione `check_ins` per adulto e minori, con unicita' per persona;
- check-in aggregato per prenotazioni scuola;
- azioni idempotenti di ingresso, correzione e annullamento;
- audit con operatore, evento, timestamp, fonte e soggetto tecnico;
- fallback per codice partecipante;
- test RLS e nessun token o dato personale nei log tecnici.

Verifiche: token valido, sconosciuto, revocato, scaduto, evento errato,
registrazione annullata, scansione doppia, famiglia parziale e gruppo scuola.

Accettazione: il backend registra la presenza reale e restituisce solo i dati
minimi, anche prima dell'integrazione con la fotocamera.

### Milestone P12 - scanner e dashboard accoglienza

Scopo: completare il flusso operativo di ingresso.

Deliverable:

- scanner fotocamera nella dashboard accoglienza su HTTPS;
- stato chiaro di autorizzazione fotocamera e fallback manuale;
- check-in automatico per persona singola;
- conferma componenti presenti per nuclei con minori;
- conferma quantita' effettive per scuole;
- esito immediato valido, gia' presente, non valido o da verificare;
- prevenzione di scansioni ripetute mentre la richiesta e' in corso;
- ultima operazione visibile e possibilita' di correzione auditata;
- interfaccia ad alto contrasto, grandi target touch e dati minimi.

Verifiche: almeno due modelli reali di smartphone/tablet, fotocamera
anteriore/posteriore, luce scarsa, QR su schermo, QR stampato, rete lenta,
doppia scansione e sessione scaduta.

Accettazione: un operatore registra rapidamente un ingresso senza poter
accedere alla scheda completa del partecipante.

### Milestone P13 - presenza panel e quadro operativo dell'evento

Scopo: collegare le presenze effettive a statistiche e, se approvato, agli
accessi dei singoli panel.

Deliverable minimo:

- conteggio ingressi effettivi evento per persone e scuole;
- report in tempo quasi reale con previsti, presenti, duplicati evitati e
  correzioni;
- filtro per fascia oraria e punto di accoglienza quando disponibile.

Estensione opzionale da approvare dopo il test ingresso:

- scansione dello stesso QR all'accesso dei panel;
- verifica che la persona o la scuola sia prenotata;
- check-in specifico al panel e confronto con capienza/settore pubblico;
- messaggio operativo per non prenotato senza esporre informazioni ulteriori.

Accettazione: il numero dei presenti effettivi e' disponibile ai manager e
non deriva soltanto dalle intenzioni dichiarate nell'iscrizione.

### Milestone P14 - prova tecnica delle stampanti per etichette

Scopo: scegliere una soluzione reale prima di integrare API specifiche.

Deliverable:

- almeno una stampante candidata disponibile fisicamente;
- scheda tecnica di formato, DPI, velocita', collegamento, driver e sistemi
  supportati;
- template etichetta di prova con QR, codice e testo minimo;
- prima opzione universale tramite pagina di stampa e driver di sistema;
- valutazione, solo se necessaria, di SDK vendor, WebUSB/WebBluetooth o bridge
  locale controllato;
- test di leggibilita' con i dispositivi destinati allo scanner;
- decisione documentata su browser, computer/tablet accoglienza e procedura di
  fallback.

Verifiche: almeno 30 etichette consecutive, QR piccoli/grandi, contrasto,
taglio/allineamento, ristampa, stampante scollegata e coda bloccata.

Accettazione: esiste una combinazione hardware/software ripetibile e il QR
stampato viene letto in modo affidabile. Senza hardware reale questa milestone
non puo' essere considerata conclusa.

### Milestone P15 - stampa etichetta integrata nell'accoglienza

Scopo: stampare il QR sul badge subito dopo il check-in o dopo una ricerca
manuale.

Deliverable:

- azione `Stampa etichetta` nell'esito accoglienza;
- stampa automatica dopo check-in solo se esplicitamente abilitata nella
  postazione;
- ristampa esplicita senza generare un nuovo QR;
- stato di preparazione, stampa riuscita/da verificare ed errore recuperabile;
- audit minimale di stampa e ristampa;
- template calibrato sulla stampante scelta;
- procedura manuale se stampante o integrazione non sono disponibili.

Verifiche: scansione e stampa end-to-end, partecipante trovato manualmente,
ristampa, due operatori, errore carta, dispositivo scollegato e badge letto a
un eventuale panel successivo.

Accettazione: l'operatore consegna un badge con QR leggibile senza dipendere
dallo smartphone del partecipante.

### Milestone P16 - hardening, prova sul campo e runbook

Scopo: preparare il sistema all'uso reale con carico, operatori e hardware.

Deliverable:

- test end-to-end dei flussi manager, partecipante, docente, campagne,
  statistiche, QR, accoglienza e stampa;
- prova concorrente sulle ultime disponibilita' di un panel;
- prova operativa con piu' postazioni di accoglienza;
- verifica RLS completa e revisione dei dati minimi mostrati;
- metriche e log tecnici privi di token o dati personali non necessari;
- backup e piano di rollback delle migration;
- runbook per apertura panel, modifica urgente, panel pieno, docente in
  difficolta', QR non leggibile, check-in errato, rete lenta, stampante guasta
  e chiusura evento;
- elenco nominativo dei responsabili operativi e canale di escalation da
  compilare fuori dal repository se contiene dati privati.

Accettazione: una prova completa con utenti di test e hardware reale termina
senza overbooking, perdita di presenze o esposizione di dati fuori ruolo.

## 6. Dipendenze e ordine di rilascio

Il primo rilascio production e il primo merge verso `main` avvengono soltanto
dopo il completamento della P10. Le pause di revisione fra milestone restano
obbligatorie e servono a validare progressivamente lo stesso ambiente di
staging, non a produrre rilasci parziali.

Ordine raccomandato:

1. P0-P4: catalogo manager affidabile e pubblicazione.
2. P5-P6: programma pubblico e iscrizioni individuali.
3. P7-P8: prenotazioni scuole.
4. P9-P10: campagne e statistiche basate su dati ormai stabili.
5. P11-P13: accesso QR, presenza effettiva e possibile controllo panel.
6. P14-P15: prova hardware e stampa integrata.
7. P16: hardening e prova generale.

P9 dipende da P6 per il filtro partecipanti e da P7-P8 per l'audience
professori. P10 puo' iniziare dopo P6, ma il report completo richiede scuole e
check-in. P14 puo' essere anticipata in parallelo come attivita' organizzativa,
ma P15 non deve iniziare finche' stampante e postazione non sono state scelte e
provate.

## 7. Rischi principali e contromisure

- Overbooking: tutte le variazioni di posti passano da funzioni transazionali
  con lock e test concorrenti.
- Capienze incoerenti: pubblicazione e modifica post-pubblicazione validate nel
  database; le bozze mostrano sempre la differenza.
- Modifiche tardive: audit, numero persone interessate e scorciatoia verso una
  campagna mirata.
- Duplicazione dei dati panel: `event_moments` e le scelte canoniche restano le
  uniche fonti; non usare tag o snapshot campagna come verita'.
- Dati di minori: niente anagrafiche studenti; i minori familiari restano nel
  modello esistente e sono visibili solo dove necessario.
- Presenze gonfiate: check-in per singola persona nel nucleo e conteggio
  effettivo esplicito per le scuole.
- QR copiato o riutilizzato: token opaco, stato verificato lato server,
  idempotenza e avviso su scansione gia' registrata.
- Fotocamera non disponibile: ricerca/codice manuale sempre presenti.
- Dipendenza dalla stampante: fase hardware separata, pagina stampa universale
  come base e procedura manuale di continuita'.
- Rete instabile: prima versione online misurata sul posto; eventuale modalita'
  offline richiede una milestone specifica per sincronizzazione e conflitti,
  non un semplice cache client.
- Campagne errate: audience alternative, selezione inizialmente vuota, test
  obbligatorio e conferma finale gia' previsti dal sistema.

## 8. Fuori scope iniziale

Queste funzioni non vanno aggiunte incidentalmente:

- scelta di sedute numerate;
- piantina grafica della sala;
- trasferimento automatico di posti inutilizzati da una sezione a un'altra;
- lista d'attesa e promozione automatica;
- algoritmi di assegnazione automatica dei panel;
- pagamenti per scuole o partecipanti;
- raccolta dei nomi degli studenti;
- stampa silenziosa da qualunque dispositivo senza postazione configurata;
- modalita' offline senza un progetto esplicito di sincronizzazione;
- notifiche automatiche massive dopo modifica panel senza anteprima e conferma.

## 9. Criterio di completamento complessivo

Il piano e' completato quando:

- manager/admin configurano location, panel e quote pubblico, pubblicano uno o
  piu' panel e modificano in sicurezza quelli gia' pubblicati;
- la home mostra il programma pubblico e i partecipanti si iscrivono senza
  overbooking;
- le scuole prenotano quantita' aggregate tramite un professore referente;
- campagne e statistiche usano le prenotazioni panel canoniche;
- l'accoglienza rileva le persone realmente presenti con QR o fallback
  manuale;
- il badge puo' ricevere un'etichetta con lo stesso QR personale tramite la
  postazione scelta;
- permessi, privacy, audit, test, runbook e prova hardware sono verificati in
  condizioni realistiche.
