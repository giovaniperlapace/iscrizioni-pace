# Cerimonia finale: configurazione in produzione — 26 ottobre 2026

Richiesta esplicita dell’utente di predisporre direttamente in produzione i
posti della pianta fornita. Conclusione alle **19:30** confermata dall’utente;
inizio alle **16:15 del 27 ottobre 2026**, come nel programma già adottato
(`lib/events/home-program.ts`). Tutti gli orari sono Europe/Rome.

## Configurazione salvata

Sede: **Basilica di San Francesco · Piazza inferiore e superiore, Assisi**.
Piano `assisi-closing-2026`, stato `validated`, revisione iniziale 15.
Assegnazioni per settore, senza numerazione individuale delle sedie.

| Settore | Capienza | Protocollo | Assegnabile |
| --- | ---: | ---: | ---: |
| A · Protocollo / VIP | 350 | 350 | 0 |
| B | 350 | 0 | 350 |
| C | 350 | 0 | 350 |
| D | 350 | 0 | 350 |
| E | 470 | 0 | 470 |
| Esterno basilica superiore | 1.200 | 0 | 1.200 |
| Prato in piedi | 1.000 | 0 | 1.000 |
| **Totale** | **4.070** | **350** | **3.720** |

Sono 3.070 posti a sedere e 1.000 posti in piedi. A ha limite assegnabile e
quota ordinaria zero, tutti gli altri settori quota pari alla capienza.
Overbooking iniziale zero ovunque. La riserva protocollo non è una dotazione
a un gruppo fittizio e non crea nomine o notifiche.

## Esecuzione e conservazione

Operazione dati mediante `scripts/configure-closing-ceremony-2026-10-26.sql`,
con le RPC Admin canoniche `save_ceremony` per piano, settori e quote; metadati
`numbered`, `layout_code`, `assignable_limit` come nella preparazione inaugurazione.
Nessuna modifica allo schema o alle funzioni, quindi nessuna nuova migration.
Nessun commit/push o deployment applicativo necessario o eseguito.

Transazione unica con lock evento canonico, revisione e audit, timeout di lock
8 secondi e statement 45 secondi. La procedura rifiuta un piano finale già
esistente: in caso di esito incerto rileggere, non rilanciare alla cieca.
Configurazione attribuita all’Admin operativo registrationspeace@santegidio.org.

Guardie prima del commit: **70 righe preesistenti** in sedi, momenti, piani,
settori e quote conservate integralmente; **243 funzioni** con corpo,
proprietario e ACL invariati. Piano inaugurazione e relativi dati conservati.
Piano finale senza assegnazioni, bozze, nomine o email. Il commit è riuscito.

Backup completo custom sul server, permessi 600, verificato con elenco e
decodifica integrale `pg_restore`, **29.399.313 byte**:

`/root/backups/iscrizioni-pace/production-before-closing-layout-1793011002452.dump`

SHA-256: `16d8b028541c0565a924a12e849d04a4195f2d285be1db8b59e97bdcec784174`.
Il backup è rimasto sul server. Non ripristinare globalmente questo backup
su un evento operativo: qualsiasi correzione successiva deve conservare le
assegnazioni e le operazioni avvenute nel frattempo.

## Verifiche

- `node tests/sql/run-opening-ceremony.mjs`: passato su PostgreSQL temporaneo,
  comprese tutte le regressioni e concorrenze cerimonie già presenti.
- Nuova regressione: sette settori, 4.070/350/3.720, orari Roma, rifiuto di
  assegnazioni in A, esatto riempimento in bozza degli altri sei settori,
  rifiuto oltre capienza, nessuna pubblicazione/email, ruoli e scope evento.
- Rifiutati rilancio e attore non Admin, senza modifiche parziali.
- RPC canonica di lettura Admin verificata prima del commit; rilettura distinta
  dopo il commit per stato, orari, capienze, quote, audit e assenza di email.
- `git diff --check`: passato.
- Suite applicativa generale: 1.174 passati, un file di test non avviabile
  (`forum-pdf-export.test.mts`) per dipendenza locale `pdfkit` assente.
  TypeScript generale segnala lo stesso modulo e il conseguente parametro
  `chunk` senza tipo in `lib/panels/panel-roster-pdf.ts`. Questi file non sono
  stati modificati per questa configurazione. Nessuna build o nuova prova
  browser: il codice applicativo pubblicato non è cambiato.

La fotografia è stata usata come riferimento dei settori e delle quantità;
non è stata caricata pubblicamente. La visualizzazione usa lo schema settori
già disponibile nell’applicazione, non una riproduzione architettonica della foto.

## Correzione della piantina compatta

Su successiva richiesta, la finale ha una disposizione dedicata: A–E in cinque
fasce davanti al palco nella piazza inferiore, esterno basilica superiore e
prato affiancati nella seconda colonna. Stesso stile di schede/colori della
piantina inaugurazione, ma senza riutilizzarne la disposizione A1/A/A2/F.
Il disegno non cresce più in altezza con la capienza delle aree.

Tutti i 4.070 simboli conservati: quadratini per i posti a sedere, punti per il
prato; 350 simboli grigi per il protocollo. Quote, disponibilità, colori delle
assegnazioni, selezione tramite ID e blocco durante un’operazione conservati.
Modifica applicativa limitata a `app/dashboard/ceremony-sector-map.tsx`.

Verifica browser del componente originale con dati sintetici a 1440, 1024,
390 e 320px: tutti e sette i settori nella stessa vista, altezza complessiva
544/544/516/532px, nessun overflow orizzontale, selezione di ogni settore,
conteggi fisici esatti, protocollo grigio e blocco dei sette pulsanti verificati.
Nessun errore JavaScript. Solo nel collaudo locale è stato usato il font di
fallback per il timeout del download Google Fonts; layout originale ripristinato
prima della pubblicazione, route di collaudo rimossa.

Copia di rilascio dal commit production `42d4ab8` più il solo componente
aggiornato e il lockfile già corretto nel checkout (dipendenze opzionali mancanti
nel lockfile del commit). `npm ci`, 1.163 test, TypeScript e lint del componente
passati. I lavori locali sui promemoria Forum non sono inclusi nella copia.
Nessuna modifica DB, email o nuova assegnazione per questa correzione grafica.

Pubblicazione applicativa completata tramite CLI da questa copia verificata,
senza commit/push. Primo caricamento interrotto da errore di rete EPIPE; secondo
riuscito. Build production Vercel completata in 35 secondi, deployment
`dpl_FwM7a5S16CaCMNsm7buoq6xoHwiA` READY, prima preparato con `--skip-domain`
e poi promosso. Dominio `registrationspeace.santegidio.org` risolto sul nuovo
deployment. Percorso Manager senza sessione ricondotto al login, senza dati
riservati; log error/fatal del nuovo deployment senza risultati al controllo.
Font originali presenti nel build pubblicato. Nessuna sessione Admin/Manager
reale usata per un collaudo operativo in produzione.

### Simboli più grandi, senza spazio laterale sprecato

Ulteriore correzione richiesta dopo le schermate dell’utente: il numero di
colonne della griglia si adatta alla larghezza e all’altezza effettive del
riquadro tramite ResizeObserver, conservando simboli quadrati/circolari e
quantità esatte. L’altezza del disegno resta limitata (A–E 32px su telefono,
40px desktop; esterno/prato 96/160px), così tutti i settori restano insieme.

Verifica browser 1440/1024/390/320px: altezza piantina 624/624/576/592px,
nessun overflow, 4.070 simboli, A grigio, selezione e blocco operazioni passati.
Su desktop i quadratini A–D passano da 2,4px a circa 4,67px; E da 1,68px a
4px; esterno da circa 2,99px a 4,15px. Anche il prato occupa la larghezza
disponibile. Nessuna modifica alle capienze o ai dati operativi.

Anche questa revisione supera 1.163 test, TypeScript, lint mirato e build
production. Deployment `dpl_92hWjtexaw912dKyZ23RaKANWaQc` READY, verificato
prima della promozione e pubblicato sul dominio operativo. Percorso Manager
anonimo protetto dal login; nessun errore/fatal nei log al controllo iniziale.
Nessun commit/push. Anteprima locale con dati di collaudo:
`output/closing-map/larger-symbols.png`.

### Disposizione fisica dei blocchi richiesta successivamente

- A, B, C e D: tre blocchi da 100 (10 file × 10 sedie) affiancati a un
  blocco da 50 (5 file × 10 sedie).
- E: gli stessi primi 350 posti, più tre blocchi posteriori da 40
  (4 file × 10 sedie), totale 470.
- Esterno basilica superiore: 12 blocchi da 100 (10×10), in quattro file
  di tre blocchi, totale 1.200.

La geometria è ora fissa e mantiene corridoi fra i blocchi. Il ridimensionamento
responsive conserva le proporzioni quadrate, senza il precedente limite di
altezza che riduceva i quadratini. La griglia adattiva resta solo per il prato.
Il renderer usa la configurazione esclusivamente con le capienze attese: dati
futuri differenti conservano il disegno generico basato sulla capienza reale.
Non sono state introdotte assegnazioni individuali a sedie né numerazioni operative.

Confronto browser con lo stesso componente dell’apertura e gli stessi viewport:
quadratini finale A–E 9,56/8,38/2,77/2,13px a 1440/1024/390/320px; riferimento
apertura 8,12/7/2,55/1,82px. Esterno 9,43/8,25/2,62/1,98px, anch’esso almeno
pari all’apertura. Quantità, blocchi, protocollo grigio, sette settori cliccabili,
blocco durante operazioni e assenza di overflow verificati. Nessun errore JS.

Questa disposizione richiede più altezza rispetto alla griglia senza blocchi:
piantina circa 1.178/1.085/634/692px negli stessi viewport. Le due piazze restano
affiancate; su desktop è necessario scorrere se l’altezza dello schermo non
basta. Non si applica più il precedente limite 624px, incompatibile con i nuovi
blocchi e la dimensione dei quadratini richiesta.

Quattro regressioni dedicate verificano struttura 100/100/100/50, rear E,
matrice 4×3 dell’esterno, assenza di sovrapposizioni e fallback per capienze
diverse. Nessuna modifica ai dati di produzione.

1.167 test, TypeScript, lint mirato e build production passati. Deployment
`dpl_8JnBixSd9S4YhgnL5CPg7KRzB1tY` READY e promosso sul dominio operativo;
controllo anonimo del percorso Manager correttamente ricondotto al login.
Pubblicazione dalla copia pulita con le sole modifiche della piantina;
nessun commit/push né lavoro sui promemoria incluso.

### Correzione dell’orientamento dei blocchi da 50

L’utente ha corretto l’ultima indicazione: il quarto blocco di A–D e della
parte anteriore di E è **10 file da 5 sedie**, non 5 file da 10.
Modificata soltanto questa geometria; 350 posti in A–D, 470 in E e tutti gli
altri blocchi conservati. Regressioni aggiornate e passate, TypeScript e lint
mirato passati. Nessuna modifica ai dati o alle assegnazioni.

Build production riuscita e deployment `dpl_AZpb9FznpaonQeHLmJKmw9kJ4PHD`
READY, promosso sul dominio operativo. Nessun commit/push.

### Ripristino dopo il rilascio badge

Il dominio era passato al deployment Git `dpl_FrrTd1C82QoPjypL4vcDzxiGPPLR`,
commit `95d20d1`, che non conteneva le modifiche della piantina precedentemente
pubblicate da CLI. Ripristinata la geometria finale sopra il commit corrente:
aggiornamento badge conservato, nessuna scrittura al database.

Copia isolata da `95d20d1` con il renderer, la geometria e le regressioni della
piantina: 1.179 test, TypeScript, lint mirato e build production passati.
Deployment `dpl_Gycyk5m9mSTfnqvqKXJRYATsZLcS` READY; ripristino di produzione
seguito da commit/push della piantina su main esplicitamente richiesti
dall’utente, per includerla anche nei futuri rilasci Git. Lavori sui promemoria
e altre modifiche locali esclusi dal commit. La copia di verifica usa il
lockfile locale già riparato per npm ci; nessuna dipendenza della piantina aggiunta.
