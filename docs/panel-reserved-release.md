# Rilascio gestionale panel riservato all’admin — 9 ottobre 2026

## Correzioni del collaudo: posti ospiti, azioni e filtro Panel

Approvata la distinzione nel catalogo tra posti prenotabili e quota ospiti:
`internal_assignment` compare come posti riservati, esclusi dal form pubblico.
Il riepilogo conserva capienza fisica e ripartizione completa, mostra le
prenotazioni di iscritti/scuole e le disponibilità separate delle rispettive
quote, senza una disponibilità totale che includa gli ospiti. Nessuna
iscrizione o presenza fittizia viene generata; nessuna modifica SQL o dati.
Azioni Modifica/Convalida incolonnate e filtro Panel nelle Comunicazioni
cercabile con selezione per ID. Commit/push e normale rilascio Vercel
autorizzati; collaudo funzionale affidato all’utente.
Verificati ESLint sui componenti modificati, TypeScript, build production e
18 regressioni panel/campagne/autorizzazioni. Rendering sintetico del caso
400 = 355 Iscritti + 25 Scuole + 20 Ospiti, prenotazioni e conteggi mancanti;
nessuna prova browser ripetuta. Fixture browser allineata al nuovo riepilogo.

## Correzione del collaudo: ritorno a Location

Il redirect condiviso delle action location ora include `panelView=locations`:
creazione, modifica ed eliminazione chiudono la modale e mantengono l’elenco
Location, conservando il menu full/mini. Anche gli errori restano nella stessa
sottosezione. Verificate le action reali con database sintetico e la vista
risultante desktop/mobile; 720 test, lint, TypeScript e build production.
Commit/push su main e normale rilascio Vercel autorizzati dall’utente; verificare
separatamente il deployment effettivo. Nessuna migration o modifica di dati remoti.

## Stato e perimetro

L’utente autorizza la pubblicazione production, le migration e il deployment,
limitando questa prima tranche alla dashboard admin. L’apertura al manager
richiede il suo successivo via libera dopo il collaudo. La home resta pubblica
e le iscrizioni all’evento restano operative come prima: viene esclusa solo
la nuova sezione pubblica panel. Gli esiti del rilascio sono registrati in fondo.

Il primo rilascio abilita la gestione riservata di location, panel, quote per
pubblico, prenotazioni scolastiche interne, destinatari email per panel/scuole e
statistiche. Solo l’admin globale accede alle nuove funzioni. Manager e viewer
sono esclusi anche tramite URL diretti, azioni server, RPC e letture RLS. Le campagne conservano destinatari
espliciti, anteprima/test e conferma: preparare il rilascio non invia messaggi.

Il catalogo gestionale mostra posti prenotati e rimanenti, anche per quota,
distinguendo capienza della sala, posti assegnati alle quote e posti non ancora
distribuiti. I prenotati provengono dal conteggio canonico del database. Un
caricamento incompleto o fallito blocca i dati, senza inventare disponibilità.
Cataloghi e destinatari sono paginati anche oltre 1.000 righe.

La home attuale di produzione è conservata in `app/registration-home.tsx` e
usata durante la fase riservata, senza annunci relativi ai panel. Il codice
della home futura resta in `app/page.tsx` e `app/public-panel-program.tsx`.
Nessun pulsante pubblico o scuola, collegamento del capogruppo o prenotazione
personale viene attivato in questa fase. I percorsi diretti sono protetti prima
dei loader; anche RPC e letture dirette del database rispettano la chiusura.

Accoglienza, scanner, cerimonie, coda badge e stampa delle etichette restano nel
branch panel/staging e non fanno parte di questa integrazione. Il collaudo
delle etichette è sospeso; il prossimo passo resta il pulsante per stampare un
singolo QR esistente, senza rigenerarlo o registrare una presenza.

## Aperture separate

La nuova migration aggiunge `events.panel_access_mode`, chiuso per impostazione
predefinita in ogni ambiente:

| Valore | Home e catalogo pubblici | Prenotazioni pubbliche e capigruppo |
| --- | --- | --- |
| `internal` | Home attuale, nessuna esposizione panel | Chiuse |
| `catalog` | Home futura e panel convalidati | Chiuse |
| `open` | Home futura e panel convalidati | Aperte |

La convalida gestionale di un panel (stato DB `published`) verifica e rende
pronta la scheda; non modifica la modalità dell'evento. Quando in futuro il
catalogo sarà aperto, i panel convalidati saranno visibili. Non è stato aggiunto
un comando UI per cambiare modalità: ogni apertura richiede una tranche
esplicita, con controllo dei requisiti ancora mancanti.

Il controllo è applicato anche lato database, compresi flussi scuola e policy
di lettura di location e panel. Le prenotazioni pubbliche acquisiscono un lock
sull'evento, così la chiusura aspetta quelle già in corso e blocca le successive.
Le variazioni della modalità sono auditate. Le prenotazioni scuola effettuate
dall’admin restano disponibili in modalità riservata.

Se la RPC della modalità non è ancora installata, l'app usa `internal`. Altri
errori o risposte malformate non sono trattati come dati validi. Questa difesa
applicativa non sostituisce l'applicazione delle protezioni SQL prima del rilascio.

## Git e conservazione del lavoro

- Base `main`: `79897d7e9ad217af74e88ec3c2282fa2e4c7fa3a`.
- Base P0–P10 integrata con merge locale senza commit:
  `32e7d41670bf5f4be6d80e05f5f67e6a37880940`.
- Branch `codex/panel-p0-p10` conservato a
  `42bfccad28f04ccfe5b9b4f40a0b5c5f206e6558`, comprese le funzioni successive.
- Modifiche e file locali del collaudo, inclusi AGENTS, piano, documenti e
  strumenti, conservati con `--include-untracked` nello stash
  `fa1ec7fa339a2b944045bf67e90cc2a1e9efec85`, messaggio
  `panel: collaudo etichette e annotazioni preservati prima preparazione main 2026-10-09`.
  Anche lo stash precedente relativo a main è preservato.

I conflitti sono stati integrati preservando le correzioni recenti di main,
compresi QR individuale manager, rimozione wallet, contatori gruppi, ruoli,
Postmark, export e statistiche. La dipendenza Next e il lockfile restano quelli
di main. La rimozione del file storico duplicato
`20260728120000_single_active_group_registration_link.sql` proviene dalla
correzione panel `10267c8`: rimane la migration canonica dello stesso timestamp
`20260728120000_single_group_registration_link.sql`, con la relativa protezione.

La pubblicazione del merge e il riallineamento del panel sono ora autorizzati.
Sincronizzare main nel panel con merge, conservando scanner, cerimonie, home
futura e documentazione successiva; non sostituire in blocco i file del panel.
Verificare nuovamente anche le migration dello staging. La nuova modalità
parte chiusa anche lì: l'eventuale riapertura del collaudo pubblico deve essere
esplicita. Ripristinare lo stash del collaudo solo sul panel, risolvendo le
annotazioni compatibili e senza applicarlo a main.

## Migration e procedura production

Dipendenze panel importate, immutate:

| Versione | Contenuto |
| --- | --- |
| `20260805160000` | Fondazione panel |
| `20260805200000` | Location |
| `20260805220000` | Bozze |
| `20260805230000` | Convalida/pubblicazione |
| `20260806090000` | Programma pubblico |
| `20260806120000` | Prenotazioni individuali |
| `20260806160000` | Scuole |
| `20260806190000` | Flusso pubblico scuole |
| `20260806200000` | Destinatari campagne |
| `20260807120000` | Quote inferiori alla capienza |
| `20260909120000` | Prenotazioni capigruppo |
| `20260909121000` | Slug scuole riservato |
| `20260909210000` | Azioni sulle righe capogruppo |
| `20261009120000` | **Nuova:** rilascio riservato, protezioni e disponibilità |
| `20261009140000` | **Nuova:** accettazione riservata all’admin, RPC/RLS e campagne |
| `20261009150000` | **Nuova:** tre tipi di quota del catalogo, senza dati di esempio |
| `20261009160000` | **Nuova:** restrizioni anche sulle scritture REST delle campagne |

Inventario production verificato via SSH nel container
`supabase-db-ammnuajlmd83t94cfy3us6cw` (PostgreSQL 15.8): le prime 16 versioni elencate
risultavano mancanti; aggiunta nella verifica finale la protezione REST campagne
`20261009160000`, applicata e registrata in una seconda transazione. È assente anche `20260726120000`, correzione storica di
assegnazioni che non è una dipendenza panel: esclusa dal lotto per non cambiare
assegnazioni reali estranee a questo rilascio. Il registro non viene falsificato.
Nessun conflitto tra il nuovo percorso `/scuole` e gli slug di gruppo esistenti.

Il progetto Vercel è `iscrizioni-pace`, ID `prj_4n4oKj3S4sg5RUg5H6AsJLBAK7w6`,
team `giovaniperlapaces-projects`, dominio `registrationspeace.santegidio.org`.
Le variabili production Postmark, stream distinti, QR e service role risultano
configurate e cifrate. Il pull locale non restituisce i segreti: non è usato per
sovrascrivere la configurazione o simulare una verifica di consegna. La coda
preesistente conteneva 130 destinatari pending; nessun nuovo destinatario o invio
di collaudo è creato dall’attività. Il processo ordinario di invio resta invariato.

Backup custom verificato sul server, permessi 600:
`/tmp/iscrizioni-pace-production-before-admin-panels-20261009.dump` (6,8 MB,
1.283 voci nell’indice pg_restore). Backup non scaricato né inserito in Git.

Prima della pubblicazione:

1. Identificare senza ambiguità progetto, database e deployment production;
   leggere il registro delle migration e verificare la configurazione email.
2. Confrontare le versioni realmente presenti e controllare le dipendenze di
   main. Non applicare automaticamente tutte le migration del repository.
3. Preparare e verificare un backup del database. Applicare il lotto necessario
   e la nuova protezione `internal` nella stessa transazione, insieme al
   registro delle versioni, per evitare un intervallo con RPC/RLS pubbliche
   aperte. Ricaricare PostgREST dopo il commit; verificare privilegi e modalità.
4. Pubblicare il codice autorizzato e verificare home invariata, URL diretti,
   catalogo manager, quote, scuole e viewer con account dell'ambiente. Nessuna
   email reale di collaudo o modifica di iscritti come effetto collaterale.
5. Registrare separatamente commit, esito migration, deployment effettivo e
   accettazione autenticata. Solo allora dichiarare il rilascio completato.

Rollback applicativo: tornare al deployment precedente mantenendo la modalità
`internal`; conservare tabelle e dati gestionali eventualmente inseriti.
Non usare il rollback come cancellazione delle prenotazioni o delle location.

## Verifiche locali completate

- Installazione riproducibile dal lockfile (`npm ci --ignore-scripts`).
- 719 test applicativi, lint senza errori, TypeScript e build Next production.
- PostgreSQL 17 temporaneo: applicazione delle migration canoniche e della
  nuova migration; esclusa solo la rinomina storica `20260813170000`, i cui
  19 gruppi sorgente non esistono nella fixture.
- `tests/sql/reserved-panel-release.sql`: anon, partecipante, docente,
  admin, manager escluso, viewer escluso e service role; modalità internal/catalog/open;
  URL/API diretti, gestione scuola admin, disponibilità, retry e richiusura.
  Le RPC di prenotazione capogruppo sono bloccate anche chiamandole direttamente.
- Prove concorrenti locali: chiusura in attesa di una prenotazione in corso;
  due nuclei sull'ultima quota disponibile, un solo successo e nessun overbooking.
- Regressione con 1.205 righe e errore nell'ultima pagina: nessun risultato
  parziale considerato completo.
- Browser sintetico desktop/mobile: home effettiva e URL scuola chiusi,
  catalogo futuro conservato, contatori gestionali, modale, Escape,
  blocco sfondo e assenza di overflow; home riservata nelle sette lingue.
  Filtri panel, tab Professori e campi template scuola/panel riservati all’admin.
  Nessun caricamento scuola o invio email durante queste prove.

I file `tests/browser/panel-release*` usano uno stub locale con dati sintetici
e una route di prova creata e rimossa dal runner. Le prove UI dei ruoli usano
il componente reale con fixture; le autorizzazioni sono verificate separatamente
in SQL. Non sostituiscono un collaudo autenticato del deployment reale.

## Prima dell'apertura pubblica

La richiesta del 9 ottobre supera l'esclusione iniziale della lista d'attesa:
il catalogo pubblico dovrà mostrare i posti rimanenti e consentire di mettersi
in coda quando la quota pertinente è esaurita, riutilizzando i posti liberati
dalle disdette. Queste due funzioni pubbliche non sono dichiarate implementate
da questo rilascio gestionale e non sono necessarie per iniziare a configurare
location e panel in privato.

Preparare una milestone dedicata prima dell'apertura delle iscrizioni: numero
pubblico coerente con la quota effettivamente prenotabile, ordine e priorità
della coda, richieste familiari, assegnazione del posto liberato, eventuale
scadenza dell'offerta, rinunce, notifiche e concorrenza. FIFO, scadenze o
promozioni automatiche sono opzioni da definire, non decisioni già approvate.

## Separazione delle dashboard e campagne

Il gestionale è presentato solo nell’admin. La dashboard manager conserva la
propria implementazione futura, ma menu e accessi diretti alle sezioni panel e
statistiche panel sono bloccati prima dei loader. Comunicazioni è ora riusata
anche direttamente nella dashboard admin, con collegamenti coerenti dai panel.
Il manager conserva le campagne preesistenti, senza tab Professori, filtri
panel, campi template `{{panel}}`/`{{scuola}}` o anteprime di prenotazioni.
Il server blocca payload forgiati e riuso di ID di campagne admin protette.

`app.panel_management_allowed(event_id)` costituisce la restrizione SQL di
questa fase; oggi abilita solo l’admin. Una nuova tranche autorizzata dovrà
aggiornare coerentemente questo controllo e quello applicativo prima di aprire
al manager. Non cambiare `panel_access_mode` per abilitare il gestionale manager:
quella modalità riguarda l’esposizione pubblica, indipendente dall’accettazione.

## Esito migration production

Applicate e registrate atomicamente le 16 versioni sopra elencate nel container
production verificato. Il confronto prima/dopo nella medesima transazione ha
conservato conteggi e hash delle 39 tabelle pubbliche preesistenti, escludendo
solo le nuove colonne e il timestamp tecnico aggiornato dal backfill dei momenti.
Conservati 3.350 iscrizioni, 3.457 partecipanti, 125 gruppi e zero check-in.
Aggiunti soltanto i tre tipi di quota; zero panel, location o prenotazioni fittizi.
PostgREST ricaricato e verificato con le RPC pubbliche: modalità `internal`,
programma panel e opzioni scuole vuoti. Sei nuove tabelle con RLS.

Verifiche software definitive: 719 test, lint, TypeScript, build Next production;
browser sintetico desktop/mobile con filtri email admin e home invariata.
Il collaudo funzionale dell’utente e il conseguente via libera al manager restano
aperti. Il deployment effettivo viene verificato separatamente dalla migration.

## Deployment production verificato

Il codice applicativo `eab129305d4a8e7be80ae1dbd32171b7d84e0207` è stato
pubblicato su main. Vercel ha completato il deployment
`dpl_HfWPoHo8tCQV35cuQ8FcXNSQVjbC`, URL
`https://iscrizioni-pace-ismuq8tiu-giovaniperlapaces-projects.vercel.app`, stato
READY e target production. Verificato che il dominio reale
`https://registrationspeace.santegidio.org` punti a quel deployment.

Confronto browser prima/dopo: testo della home identico, campo email presente,
nessuna sezione panel o scuole. URL scuole rimandati alla home e dashboard
protette dal login. Nessun errore restituito dalla ricerca dei runtime log del
nuovo deployment. Verifica production in sola lettura con identità ricavata
internamente dai ruoli: admin ammesso, manager senza ruolo admin negato alle
RPC gestionali e ai tipi di quota. Nessuna sessione o account reale creato per
il collaudo. Le nuove funzioni sono pronte per il test autenticato dell’utente.

La verifica finale ha aggiunto la migration `20261009160000`: anche le scritture
REST dirette di campagne e destinatari scuola/panel sono riservate all’admin.
Collaudate in transazione locale con rollback, verificando il rifiuto di INSERT
e UPDATE proibiti e la conservazione delle normali campagne manager. Applicata
in production in una seconda transazione: totale 17 versioni registrate,
nessuna modifica ai dati. Il successivo commit di documentazione, test SQL e
questa migration mantiene identico il codice applicativo già verificato.

Il branch panel resta preservato a `42bfcca`, con i due stash intatti. Il
controllo preventivo del riallineamento rileva conflitti in 12 file, inclusi
scanner/dashboard/documentazione: non sono state fatte sostituzioni automatiche.
Riconciliare queste differenze prima di riprendere lo sviluppo sul panel;
nessun push o deployment dello staging fa parte di questa pubblicazione admin.
