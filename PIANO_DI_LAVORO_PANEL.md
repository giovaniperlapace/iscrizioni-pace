# Piano di lavoro Panel

## Tranche corrente: main, Chrome silenzioso e collaudo Admin — 14 ottobre 2026

L’utente richiede l’integrazione completa del panel in main, conservando il
branch panel e le funzioni esistenti. Superata la sospensione stampa: canale
scelto per questa tranche Chrome configurato silenzioso, individuale/gruppi,
profili continuo 29 × 45 e pretagliato 29 × 90 distinti. Alternative conservate
come documentazione, fuori dal lavoro corrente.

Nuovi flussi di stampa e scanner nella dashboard Accoglienza riservati al
solo Admin, anche lato server e DB. Manager verrà abilitato dopo il collaudo;
P0–P10 già pubblicate restano disponibili. Le altre nuove superfici importate
restano riservate al pilot Admin. Nessuna apertura pubblica implicita.

Successiva autorizzazione esplicita del 14 ottobre: commit, push e migration
necessarie per il rilascio su main e il collaudo a distanza. Applicate in
production le dieci migration della tranche, conservando tutte le 83.960
righe preesistenti e la modalità internal; esclusa la correzione dati storica.
Dettagli in `docs/panel-main-integration-2026-10-14.md`. Merge `384f58a`
pubblicato su main e deployment production READY verificato sul dominio;
home invariata e iscrizioni pubbliche chiuse. Accettazione fisica ancora aperta.

Collaudatore remoto con accesso Admin, Mac e forse Windows. DK-22210
acquistato; stampante, collegamento e rotolo montato ancora da verificare.
Seguire `docs/collaudo-stampa-remoto-admin.md`. P14/P15 e accettazione fisica
non concluse: attendere riscontri espliciti dell’operatore per ogni prova.


## Programma in tre riquadri giornalieri — 2026-10-10

- Correzione esplicita dell’utente: sempre tre riquadri, uno per ciascun
  giorno 25/26/27 ottobre, con gli appuntamenti cronologici e fasce orarie.
  Più spazio verticale tra orari, titoli, luoghi e singoli appuntamenti.
- Nel riepilogo il panel delle 17 confluisce nel cappello pomeridiano dalle
  16; fasce sovrapposte dello stesso giorno riassunte dall’inizio più precoce
  alla fine più tarda. Il dettaglio conserva tutti gli orari individuali.
  Superata la precedente separazione delle fasce 16/17 nel riepilogo.
- Home pubblica internal e anteprima riservata conservate; nessuna modifica
  a panel, prenotazioni, capienze o permessi.

## Richiamo email dopo i panel — 2026-10-10

- Aggiunto in fondo ai panel il richiamo “Iscriviti o accedi per prenotare
  il tuo posto”, con istruzione che distingue nuova iscrizione e accesso
  tramite link email. Sette lingue; stile, freccia e scorrimento condivisi.
- Il collegamento punta al campo email con margine per la testata. Visibile
  anche nell’anteprima, dove il form rimane disabilitato; nel catalogo pubblico
  resta subordinato all’apertura delle prenotazioni. Home internal invariata.

## Panel nel riepilogo del programma — 2026-10-10

- Su richiesta dell’utente, anche il programma generale della home futura e
  dell’anteprima contiene i panel, raggruppati per inizio/fine effettivi e
  ordinati insieme agli appuntamenti generali. Dicitura “Panel in vari luoghi”,
  fascia senza zero iniziale e collegamento all’elenco dettagliato.
- Fasce derivate dai medesimi record del gestionale, senza orari duplicati:
  giorni distinti e orari eccezionali restano separati. Sette lingue conservate.
  Home pubblica in modalità `internal` invariata; pulsante preview solo Admin.

## Prima home con programma e panel nascosta — 2026-10-10

- Su richiesta dell’utente preparata localmente su main la home futura,
  conforme allo stile dell’app. Programma generale dalla pagina ufficiale
  fornita: inaugurazione, preghiere per la pace e cerimonia conclusiva;
  orari senza fine inventata e contenuti nelle sette lingue.
- Anteprima `/dashboard/anteprima-home` dal catalogo Panel, solo Admin globale
  e Manager dell’evento corrente. Su correzione dell’utente il pulsante è
  visibile solo nel catalogo Admin, rimosso dalla dashboard Manager.
  Include le bozze richieste dall’utente e
  rilegge i record del gestionale: titoli, orari, location e posti individuali.
  Panel incompleti segnalati, nessuna copia dei forum dal sito esterno.
- Modalità `internal` e home attuale conservate; pubblico e ruoli non ammessi
  esclusi dall’anteprima, form email e prenotazioni disabilitati nella preview.
  La futura home pubblica continua a mostrare solo panel pubblicati.
- Test mirati, lint, TypeScript, build e browser sintetico desktop/mobile
  verificati. L’utente autorizza commit/push e rilascio in production del
  codice, mantenendo la home pubblica attuale. Nessuna apertura pubblica,
  migration remota o email autorizzata da questa tranche.
  Branch panel e stash preservati. Dettagli in
  `docs/home-program-preview-2026-10-10.md`.
## Prove stampa sospese, tre metodi aperti — 2026-10-12

- L’utente ferma esplicitamente le prove: non è deciso che verrà adottato
  il metodo Chrome silenzioso. Nessuna scelta definitiva del canale di stampa.
- Conservare aperte tutte e tre le alternative discusse: browser con
  stampa silenziosa configurata, dialogo di stampa ordinario e componente
  locale di collegamento (QZ Tray o altra soluzione da valutare).
- Conservare implementazione locale, template, campioni e risultati fisici
  acquisiti, compresa la corretta stampa delle due identità Manager staging.
  Il successo su questo Mac non autorizza scelta o distribuzione del metodo.
- Sospendere ulteriori prove, integrazione nell’accoglienza, installazioni
  e configurazioni aggiuntive fino alla ripresa esplicita dell’utente.
  Nessun commit/push, deployment o migration autorizzati da questa richiesta.

## Stampa dalla dashboard Manager reale riuscita — 2026-10-12

- L’utente preme `Stampa etichetta QR` nella scheda reale Manager di Alba
  Test Accoglienza / P0LE, sull’app locale collegata al solo staging.
- Conferma una sola etichetta, allineata e separata, nome/QR/P0LE integri,
  senza altre conferme. Dopo il ritaglio riferisce decodifica del QR;
  telefono e misura del ritaglio non acquisiti separatamente in questa prova.
- Verifica DB in sola lettura: testo scansionato coincidente con l’ultimo
  QR attivo già esistente del campione. Non copiare il payload nei verbali.
  Rispetto allo snapshot iniziale, stato/updated_at dell’iscrizione e
  impronte di tutti i record QR e delle presenze dello stesso campione invariati.
- Acquisito il percorso reale scheda Manager → handler autenticato → QR
  esistente → stampa silenziosa → etichetta fisica leggibile dopo ritaglio.
  Sola prova individuale su questo Mac/Chrome/Brother; coda badge, storico
  condiviso, lotti e postazioni future restano separati e non collaudati qui.
- Dimensioni rimosse dai testi dei pulsanti come richiesto: `Stampa etichetta QR`
  e `Ristampa etichetta QR`. Download PNG esistente preservato.
- Lavoro locale sul branch panel, staging sintetico. Nessuna modifica a
  iscrizioni/QR/presenze, nuova email, migration, commit/push o deployment.
  La sessione di autenticazione Manager di test rimane quella predisposta.

## Collaudo pulsante nella dashboard Manager reale — preparazione, 2026-10-12

- Richiesta dell’utente: test direttamente nella dashboard Manager. Avviata
  l’app locale su http://127.0.0.1:3161 con Next webpack e variabili staging
  verificate; solo gli URL applicativi del processo adattati a localhost.
  Launcher `tools/brother-browser-test/run-manager-staging.mjs`.
- Account esistente `manager.panel.staging@example.invalid`, ruolo Manager
  dell’evento sintetico corrente `assisi-2026-test`, sessione Auth verificata
  nel Chrome dedicato già configurato. Nessun nuovo account/ruolo o invio email;
  aperta una sessione di test, senza callback che aggiorni profili/iscrizioni.
- Scheda reale `/dashboard/manager?section=iscritti&edit=8765cda1-1345-4ccd-b2bd-11909202b46e`
  di Alba Test Accoglienza / P0LE. QR staging preesistente attivo e impaginabile,
  senza creazione o rotazione. Il pulsante Stampa etichetta QR è in vista;
  distinto dal comando Scarica immagine esistente.
- Verifica end-to-end automatizzata con stampa simulata nel browser separato:
  dashboard reale, pulsante reale, GET autenticato HTTP 200 private no-store,
  CSP same-origin, identità e codice del DB, QR decodificato coincidente con
  l’ultimo token esistente, una sola chiamata print, nessuna scheda aggiuntiva,
  pulizia iframe e nessun errore pagina. Nessun lavoro fisico inviato dal test.
- Confronto DB prima/dopo: stato/updated_at dell’iscrizione, impronta dei record
  QR e delle presenze del solo campione invariati. La sessione Auth è l’unico
  accesso preparato. Nessuna migration, deployment, commit/push o email.
- Prossimo passo: clic dell’utente nella scheda Manager e controllo fisico
  di un’etichetta Alba Test Accoglienza / P0LE. Questi QR sono dello staging;
  la scansione successiva con fotocamera serve alla lettura, non usare lo
  scanner accoglienza dell’app per collaudare la stampa (registrerebbe ingressi).

## Prima prova singola silenziosa riuscita sul Mac — 2026-10-12

- Dopo calibrazione del formato reale 29 × 90 mm nel profilo Chrome dedicato,
  l’utente conferma una sola etichetta TEST-003, allineata, taglio corretto e
  nome/QR/codice integri. Stampa con un solo clic, senza altre conferme;
  breve finestra Chrome visibile e chiusa automaticamente, durata non misurata.
- Pixel 7 e iPhone leggono il payload corretto prima del ritaglio. Dopo
  ritaglio manuale a 45 mm, entrambi leggono ancora il QR e nome/TEST-003
  restano integri, confermati dall’utente.
- Esito acquisito per questa singola stampa sul Mac con Chrome 154 e Brother
  QL-810W, profilo dedicato configurato. Non equivale al collaudo di Windows,
  QL-800, continuo da 29 mm, lotti applicativi o tutte le postazioni future.
  Ripetibilità della stampa silenziosa e raccordo con coda/storico restano aperti.
- Conservare calibrazione tramite opzione reale del driver e controllo del
  profilo prima di avviare --kiosk-printing: il solo seed delle dimensioni
  aveva causato fallback 12 × 12 mm e quattro etichette inutilizzabili riferite.
- Template/loader/handler e client di stampa individuale preparati localmente
  sul branch panel. Prova fisica con soli dati sintetici; download PNG
  esistente conservato. Nessuna creazione/rotazione QR, presenza, dato remoto,
  migration, email, commit/push o deployment. Stash originale preservato.

## Stampa silenziosa: formato errato e calibrazione — 2026-10-12

- Prova fisica silenziosa fallita: l’utente riferisce quattro etichette
  inutilizzabili, stampa molto piccola/suddivisa e tagli disallineati.
  Ritiene successivamente di aver riallineato il rotolo; non trattarlo come
  conferma di una nuova uscita corretta. Ulteriori invii automatici sospesi.
- Evidenza: profilo Chrome e attributi IPP del lavoro 7 riportano media
  `12x12mm`, copies=1. Le opzioni lpoptions 29x90mm non hanno impedito a Chrome
  di usare il formato da 12 mm. Il seed iniziale della carta non conteneva
  l’identificativo reale del driver; non era sufficiente scrivere dimensioni
  e nome del supporto nelle preferenze.
- Nessun lavoro pendente rilevato. Chiusa soltanto la sessione di collaudo;
  aperta calibrazione senza `--kiosk-printing`, selezionata nell’anteprima
  l’opzione reale 29 × 90 mm con vendor_id `om_29000x90000um_29x90mm`.
- Verificati nel modello effettivo dell’anteprima: carta 29000 × 90000 µm,
  copies=1, pages=[1], margini Nessuno, scala 100%, verticale e nessuna
  intestazione. Anteprima visivamente integra. Annullata senza stampare;
  salvata la carta reale nel profilo, controllata nuovamente dopo la chiusura.
- Launcher con modalità `--calibrate` e blocco della modalità silenziosa
  se carta/identificativo/scala/margini/intestazioni non sono validi. Non
  considerare questo controllo del profilo prova dell’esito fisico.
- Riaperta la sessione silenziosa corretta; prossimo passo una sola nuova
  pressione dell’utente e verifica fisica. Nessuna copia di correzione
  inviata dall’agente. Validità della stampa silenziosa ancora aperta.

## Prova stampa silenziosa sul Mac — preparazione, 2026-10-12

- L’utente autorizza una prova di implementazione sul Mac attuale. Conservata
  la scelta futura delle postazioni; nessun QZ Tray o componente aggiuntivo.
- Pulsante Manager/Admin ora usa `lib/qrcode/print-client.ts`: una richiesta
  fresca al medesimo GET autenticato, iframe dello stesso sito e print dopo
  decodifica delle immagini. Nessuna seconda pressione nell’anteprima.
  Documento marcato, errori/login esclusi; una sola stampa concorrente nella
  pagina, annullamento in chiusura/cambio scheda e pulizia risorse. Il messaggio
  di comando avviato non conferma uscita fisica né aggiorna presenze/coda.
  Download PNG esistente conservato; ristampa sempre esplicita e rilegge il QR.
- CSP del documento consente iframe solo dello stesso sito (`frame-ancestors
  self`), senza estendere i permessi del loader/handler. Un browser normale
  continua ad aprire il dialogo; la stampa silenziosa richiede la postazione
  configurata e non è attivabile dal sito.
- Chrome 154 sul Mac: finestra/profile separati avviati con `--kiosk-printing`,
  senza policy globali né modifiche al profilo ordinario. Impostazioni di prova
  una copia, margini Nessuno, scala 100%, intestazioni disattivate; Brother
  predefinita e opzioni utente PageSize=29x90mm / CutMedia=EndOfPage.
  Valori precedenti di queste due opzioni conservati nello snapshot locale.
  Ripristino: `node tools/brother-browser-test/launch-silent-chrome.mjs --restore-printer`.
- Pagina `silent-label-test.html`, José María García López / TEST-003, stesso
  QR sintetico dei campioni precedenti, stesso renderer e client applicativi.
  Generatore `generate-silent-sample.mjs`; avvio `launch-silent-chrome.mjs`.
  Solo server loopback, senza credenziali o accesso a DB. Debug della sessione
  di prova solo locale sulla porta 3169. Pagina reale aperta, pulsante pronto,
  presenza della flag verificata. Nessun lavoro fisico inviato dall’agente:
  prossimo passo clic dell’utente e verifica uscita/assenza dialogo.
- Sette test mirati, ESLint, TypeScript superati. Test browser del client reale
  con print simulata: singolo invio, nessuna nuova scheda, ristampa fresca,
  errori 401/403/404/500, concorrenza, annullamento, URL estranei e pulizia.
  Questo test non dichiara collaudata la stampa silenziosa fisica.
- Lavoro locale sul branch panel; nessun commit/push, deployment, migration,
  modifica a persone o presenze reali, email. Stash preservato.

## Scelta postazioni rinviata e alternativa Chrome — 2026-10-12

- L’utente non conosce ancora i PC dell’accoglienza e rinvia la scelta del
  canale di stampa finché saranno note le macchine e la tollerabilità del
  dialogo per gli operatori. Non installare né configurare implicitamente
  QZ Tray o altri componenti; proposte e test del template conservati.
- Correzione della precedente valutazione: un componente di collegamento
  locale non è obbligatorio. Chrome da versione 144 su Mac/Windows/Linux
  supporta la policy `SilentPrintingEnabled`, che chiude automaticamente
  l’anteprima e stampa sulla destinazione predefinita con opzioni predefinite.
  Richiede configurazione della postazione/browser, non una modifica che
  il sito possa abilitare da solo. Stampante, pagina, scala e taglio vanno
  predisposti e collaudati sulle macchine effettive.
- Il requisito utente riguarda l’assenza di dialogo operativo, non il divieto
  tecnico di usare `window.print()` su un browser predisposto alla stampa
  silenziosa. Possibili percorsi ancora da scegliere: Chrome configurato,
  componente locale o dialogo se accettato esplicitamente dall’utente.
- Fonte primaria verificata: documentazione policy Chrome Enterprise e
  definizione Chromium `SilentPrintingEnabled.yaml`.
  https://chromeenterprise.google/intl/es-419_ALL/policies/silent-printing-enabled/
  https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/policy/resources/templates/policy_definitions/Miscellaneous/SilentPrintingEnabled.yaml
- Nessuna configurazione di Chrome, driver o stampante modificata; nessuna
  ulteriore implementazione o prova fisica in questa valutazione.

## Stampa diretta senza dialogo — requisito utente, 2026-10-12

- L’utente richiede che il pulsante operativo stampi direttamente sulla
  stampante della postazione, senza dialogo di stampa. Questa indicazione
  supera il percorso operativo precedente basato su `window.print()`;
  i campioni con dialogo restano strumenti di collaudo del template.
- La prima implementazione locale individuale con anteprima/dialogo va
  adattata a un collegamento locale alla stampante. Nessuna soluzione scelta
  o installata implicitamente. Valutato QZ Tray per Mac/Windows: richieste
  firmate e certificato attendibile necessari per sopprimere anche i popup.
- Configurare stampante, supporto fisico, scala e taglio per postazione;
  mantenere QR esistente, stampa separata da presenze, deduplicazione e
  stato inviato distinto dalla conferma fisica. Formato finale 29 × 45 mm;
  sul DK-11201 attuale si conserva pagina fisica 29 × 90 mm.
- Confermata dall’utente la lettura su Pixel 7 e iPhone di tutte le tre
  copie TEST-002 consecutive. Cinque etichette confermate nella sessione:
  due campioni singoli letti anche dopo ritaglio e tre copie lette prima
  del ritaglio. Prova iniziale positiva, nessuna certificazione generale
  di lotti applicativi, continuo da 29 mm, QL-800 o Windows.

## Stampa individuale QR locale — 2026-10-12

- Confermato dall’utente DK-11201 pretagliato 29 × 90 mm caricato; Brother
  QL-810W rilevata via USB e coda pronta. Sagoma approvata 29 × 45 mm,
  ritaglio manuale: il formato fisico resta 29 × 90 mm.
- Implementato sul branch panel il pulsante Stampa etichetta QR nella scheda
  Manager/Admin, con anteprima GET autenticata in finestra separata. Scope
  evento corrente, identità dal DB, ultimo token attivo riletto; esclusi Viewer,
  altri eventi, iscrizioni eliminate/annullate e QR revocati/scaduti/mancanti.
  Cache privata no-store, CSP e nessun token in testo/metadati del documento.
- Template condiviso `lib/qrcode/print-label.ts`: nominativo completo con font
  incluso, minimo 7 pt e blocco se non entra; codice a 8 pt misurato, QR ECC M
  con quattro moduli bianchi e dimensioni del campione già collaudato. Pagina
  fisica 29 × 90 mm e riferimenti di ritaglio a 45 mm. Dialogo volontario;
  nessuna creazione/rotazione QR, presenza, scrittura di coda o conferma fisica.
- Campione sintetico del medesimo renderer generato con
  `tools/brother-browser-test/generate-application-sample.mjs`, aperto in Chrome
  a `http://127.0.0.1:3159/app-label-test.html`. Prova fisica ancora da effettuare.
  Sette test mirati verdi (handler reale, permessi, stati, identità, decodifica,
  nomi e limiti), ESLint e TypeScript; anteprima desktop verificata.
- Solo lavoro locale. Stash originale preservato; nessun commit/push,
  deployment, migration, dato remoto o email. Lotti gruppo e raccordo con
  postazioni/coda restano tranche successive; badge cerimonie esistente conservato.

## Ripresa stampa etichette — 2026-10-12

- L’utente riprende lo sviluppo e il collaudo sul branch panel e conferma
  come formato finale approvato **29 × 45 mm**. Questa scelta supera le
  precedenti indicazioni di formato ancora da scegliere o candidato.
- Ripristinati sul branch `codex/panel-p0-p10` annotazioni e materiali del
  collaudo dallo stash `fa1ec7fa339a2b944045bf67e90cc2a1e9efec85`, conservato.
  Riconciliate le sole aggiunte documentali con il riallineamento del 9 ottobre.
- Punto di ripresa: pulsante per stampare un singolo QR esistente, senza
  rigenerazione e senza registrazione automatica di presenze. Prima prova
  browser riuscita su Mac/QL-810Wc, DK-11201 29 × 90 mm ritagliato a 45 mm;
  quel campione letto dal Pixel 7. Campione P-touch letto anche dall’iPhone;
  lettura iPhone del campione browser e continuo da 29 mm ancora da collaudare.
- La scelta della sagoma non certifica il taglio a 45 mm sul rotolo continuo.
  Riprendere le prove dopo verifica del supporto realmente caricato.

## Priorità rilascio gestionale panel e pausa stampa — 2026-10-09

- L’utente mette in pausa il collaudo browser e dà priorità alla preparazione
  del rilascio gestionale riservato dei panel in production. Nessuna novità
  nella home e nessuna apertura delle iscrizioni pubbliche; verificare anche
  accessi diretti e azioni pubbliche durante la preparazione del rilascio.
- Conservare risultati e file sintetici della prova Brother: prima etichetta
  browser 29 × 90 mm ritagliata a 29 × 45 mm riuscita su Pixel 7, misure e
  taglio confermati, circa 2 secondi. iPhone/browser, ripetibilità e altri
  supporti/sistemi restano aperti. Registro in docs/collaudo-brother-ql.md.
- Alla ripresa, primo passo: implementare il pulsante per stampare un singolo
  QR esistente, senza rigenerazione e senza registrare automaticamente presenze.
  Questo supera il precedente suggerimento di iniziare dal lotto sintetico
  di tre etichette. Il requisito lotto gruppo su etichette separate resta valido.
- La nuova priorità riguarda la preparazione del rilascio; non costituisce
  autorizzazione a commit, push, deployment o migration remote. Conservare
  tutte le modifiche locali. Nessuna implementazione stampa avviata.



### Attivazione Capogruppo rinviata — 2026-10-09

Su indicazione dell’utente, attivare la funzione panel del Capogruppo nella
futura tranche di pubblicazione dei panel sulla home del sito. Il rilascio
Manager attuale non la apre; menu, pagina, action e RPC restano protetti dalla
modalità pubblica esistente. Non attivarla con la sola pubblicazione gestionale
dei singoli panel.

### Tranche di rilascio P0–P10: apertura Manager — 2026-10-09

L’utente autorizza l’integrazione locale delle funzioni Admin già collaudate
nella dashboard Manager dell’evento corrente, conservando le correzioni e
usando gli stessi componenti. Viewer e pubblico restano esclusi. Migration
revisionabile `20261009170000_manager_panel_access.sql` per helper e policy
SQL; test su ruoli cumulativi, scope evento, RPC/RLS, roster/export e campagne.
Nessuna nuova funzione P11–P13 o sviluppo del branch panel in questa tranche.
Pubblicazione e migration production autorizzate dall’utente. Applicata e
registrata `20261009170000` con dati invariati; codice `b0e8355` pubblicato e
deployment production READY verificato sul dominio reale. Capogruppo chiuso
fino alla futura pubblicazione sulla home.
Dettagli e verifiche in `docs/panel-reserved-release.md`.

## Riallineamento gestionale e funzioni future — 2026-10-09

Main a858340 integrato nel branch panel tramite merge, conservando P11–P13,
scanner, QR gruppo/coda badge e cerimonie E1/E2/E3. Correzioni del gestionale
condivise Admin/Manager preservate; Capogruppo panel resta rinviato alla
pubblicazione sulla home, con catalogo e prenotazioni pubbliche ancora chiusi.
Gli stash del collaudo restano intatti. Le cinque migration 20261009 importate
sono da applicare nello staging prima del rilascio della versione integrata;
nessuna migration remota o pubblicazione in questo riallineamento. Dettagli e
verifiche in `docs/panel-main-integration-2026-10-09.md`.

## Rilascio admin autorizzato — aggiornamento 2026-10-09

- Esito: main pubblicato (`eab1293`), deployment Vercel production READY sul
  dominio reale. Home confrontata prima/dopo: testo identico, email presente,
  sezione panel assente. Admin ammesso e manager negato nelle verifiche DB in
  sola lettura; accettazione funzionale dell’utente e apertura manager rinviate.
- Nella verifica finale aggiunta e applicata `20261009160000`: protezione delle
  scritture REST di campagne/destinatari panel e scuola. Totale 17 migration
  registrate (lotto di 16 più una transazione finale), senza nuove email o
  modifiche a persone reali. Dettagli e backup nel documento di rilascio.
- Panel a `42bfcca` e stash preservati. Il merge preventivo segnala 12 conflitti:
  riconciliare prima di riprendere lo sviluppo, conservando scanner e cerimonie.
  Nessuna pubblicazione staging eseguita in questo rilascio production.


- Nuova indicazione esplicita: pubblicare in production e applicare le migration,
  ma rendere le nuove funzioni panel disponibili solo nella dashboard admin.
  Manager e viewer attendono il via libera dell’utente dopo il suo collaudo.
  Questa decisione supera l’accesso manager/viewer descritto nella preparazione.
- La home rimane pubblica e invariata, con le iscrizioni all’evento operative;
  non mostra la nuova sezione panel. Restano chiuse solo catalogo e iscrizioni
  pubbliche dei panel, compreso il flusso scuole pubblico.
- Controlli prima dei loader e delle azioni, RPC/RLS limitate all’admin,
  statistiche e campagne panel/scuole protette anche da richieste dirette.
  Comunicazioni condivisa disponibile direttamente nella dashboard admin.
- Migration aggiuntive `20261009140000_admin_panel_acceptance.sql` e
  `20261009150000_panel_default_audiences.sql`: restrizione ruoli e catalogo
  Iscritti/Scuole/Ospiti; nessuna location o capienza di esempio in production.
- Inventario production: lotto di 16 migration panel; esclusa la correzione dati
  storica non dipendente `20260726120000`, assente nel registro remoto.
  Backup server verificato; procedure ed esiti in `docs/panel-reserved-release.md`.
- Lotto applicato e registrato in production in un’unica transazione; verificati
  conteggi e hash delle 39 tabelle preesistenti. Conservati 3.350 iscrizioni,
  3.457 partecipanti, 125 gruppi e zero check-in. Nessun nuovo destinatario email.
  Verifiche finali: 719 test, lint, TypeScript, build e browser desktop/mobile.
- Preservare branch panel e stash del collaudo. Il riallineamento autorizzato
  deve mantenere le funzioni future e le decisioni più recenti, non sovrascriverle.


## Aggiornamento prioritario — rilascio riservato, 2026-10-09

L'utente richiede di preparare su main il gestionale panel P0–P10 per
production: location, panel, ripartizione quote, scuole interne, destinatari
email e statistiche. Home attuale senza annunci, catalogo e iscrizioni
pubbliche chiusi. Questa decisione supera il rinvio storico del rilascio
P0–P10 fino al completamento delle milestone successive; non autorizza
automaticamente commit/push, deployment o migration remote.

Preparazione locale completata sulla base main `79897d7` integrando `32e7d41`
senza commit. Nuova modalità DB `internal` (default), `catalog`, `open`, con
protezione server/RPC/RLS. La convalida dei panel non cambia tale modalità.
La home production è conservata separatamente, così la home futura resta
disponibile. Catalogo gestionale con posti prenotati/rimanenti per quota,
letture complete oltre 1.000 righe e viewer in sola lettura.

Il branch panel `42bfcca` conserva P11–P13 e le successive decisioni di
accoglienza e cerimonie; il suo piano più recente non viene sostituito con
questa copia per il rilascio P0–P10. L'utente autorizza la sincronizzazione
delle nuove correzioni verso panel, da effettuare con merge dopo il commit
autorizzato, conservando le funzioni future. Il collaudo etichette è sospeso;
prossimo passo: pulsante stampa singolo QR esistente, senza rigenerazione o
registrazione di presenza. Annotazioni e strumenti non tracciati preservati
nello stash `fa1ec7fa339a2b944045bf67e90cc2a1e9efec85`, da ripristinare sul panel.

Nuovo requisito prima dell'apertura pubblica: posti rimanenti nel catalogo e
lista d'attesa quando esauriti, con gestione dei posti liberati dalle disdette.
Superata l'esclusione storica della coda. Una milestone dedicata deve definire
quote, priorità, nuclei familiari, assegnazione e notifiche; nessuna regola di
promozione automatica o scadenza è già concordata. Non blocca il primo rilascio
riservato e non è dichiarata implementata da questa tranche.

Verifiche locali: 711 test, lint, TypeScript, build, SQL PostgreSQL 17 con ruoli
e concorrenza, browser sintetico desktop/mobile e home sette lingue. Mancano
inventario DB/email production, applicazione autorizzata delle migration,
pubblicazione e collaudo autenticato. Stato, conservazione Git, dipendenze e
procedura in `docs/panel-reserved-release.md`.

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
- stampa del QR su etichette per i badge all'accoglienza;
- QR di gruppo, accoglienza collettiva e stampa in sequenza dei badge personali;
- riconoscimento degli accrediti stampa e relativi badge;
- inaugurazione e cerimonia finale con quote, assegnazioni e piantine dei posti.

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

### P13-E1 — cerimonie con sedi indipendenti — 2026-10-06

- Su richiesta dell’utente rinviata P13-S finché saranno noti fonte e formato
  degli accrediti; avviata la prossima milestone suggerita P13-E1. Precisazione
  esplicita: inaugurazione e cerimonia finale possono avere location e strutture
  completamente diverse, ancora sconosciute. Nessuna capienza inventata.
- Tranche software locale: due viste condivise admin/manager/viewer, configurazioni
  admin indipendenti in bozza/validate, settori quantitativi, quote per categoria,
  dotazioni manager ai gruppi e assegnazione di un posto alla persona ammissibile.
  Regola presenza scelta dall’admin (giorno/mattina/pomeriggio), date sconosciute
  distinte dalle assenze. Nessun check-in o prenotazione volontaria creato.
- Migration locale `20261006180000_ceremony_allocations.sql`: quattro tabelle RLS,
  RPC service-only, controllo attore/evento sia server sia DB, revisioni e lock,
  audit minimale, capienze e duplicati protetti. Vecchi editor location/momenti
  bloccati per le configurazioni collegate, anche se usano service_role.
- Cambio gruppo/date o cancellazione segnala posti da rivedere senza liberarli.
  Dotazione gruppo consuma subito capienza; distribuzione nominale, regole posti
  minori/accompagnatori e consultazione personale restano E2; mappe numerate E3.
- Piano e dettaglio in `docs/panel-p13-ceremonies.md`. Nessuna migration remota,
  commit, push o deployment. P13-E1 resta aperta per staging, collaudo autenticato,
  sedi reali e revisione dell’utente; P13-S sospesa, non completata.


### Migration staging applicate — 2026-10-06

Su richiesta esplicita dell'utente applicate e registrate in un'unica transazione
le 20 migration mancanti applicabili: le 18 importate da main, gli accessi panel
`20261006120000` e il QR gruppo/coda badge `20261006150000`. Container verificato:
`supabase-db-jiio6ou5wzmma2xwas53cf1d`. Production invariata; nessun invio email.

Backup PostgreSQL custom prima dell'aggiornamento, conservato sul server in
`/tmp/iscrizioni-pace-staging-before-panel-20261006124116.dump`; indice archivio
verificato con pg_restore. Applicazione con lock e timeout, DDL e registro nella
stessa transazione, notifica finale di ricarica PostgREST. Nessuna migration
versionata riscritta; rimosse soltanto le cornici BEGIN/COMMIT nello stream di
esecuzione per mantenere atomico il lotto completo.

Verifica finale: tutte le 20 versioni presenti; RLS attiva sulle cinque nuove
tabelle panel/gruppi; RPC operative panel/gruppi riservate a service_role,
negate ad anon/authenticated; nuove tabelle raggiungibili via PostgREST (HTTP 200).
Conservati 9 iscrizioni, 9 partecipanti, 85 gruppi e 6 check-in; hash dei check-in
invariato al netto della nuova colonna nullable. Nessun destinatario email in
coda e nessuna identità storica da scollegare nel backfill previsto.

Rimane non applicabile `20260813170000_rename_anziani_and_amici_groups.sql`:
zero gruppi sorgente nello staging, mentre il file richiede esattamente 19.
Non eseguita e non registrata falsamente come applicata. Non è una dipendenza
dei nuovi flussi. Il collaudo autenticato, su dispositivi e stampanti resta
separato; l'aggiornamento DB non certifica il deployment applicativo.


### Pubblicazione del branch panel richiesta il 2026-10-06

L'utente richiede commit di tutte le modifiche locali e push del branch panel,
compresi i 69 commit precedenti non pubblicati e il merge main `296f3e9`.
Verifiche della versione applicativa: 758 test, lint, TypeScript/build staging,
SQL temporaneo e browser sintetico già superati nella tranche P13-G.
Fetch prima del commit: zero commit remoti da incorporare; diff senza errori.
`staging:verify` superato. Inventario DB staging ricontrollato in sola lettura:
restano 21 migration assenti (18 importate da main, la storica rinomina gruppi,
accessi panel e QR gruppo). Il push autorizzato riguarda il codice; nessuna
migration remota applicata, email inviata o modifica a main/production.
Il completamento del push non certifica il deployment né l'operatività dei
nuovi flussi finché il database staging non viene aggiornato separatamente.


### Estensione del 2026-10-06 — gruppi, stampa ed eventi speciali

Richiesta recepita nel piano; P13-G ha ora una tranche software locale, come
documentato nella milestone. Le altre estensioni restano da implementare. Prima nuova priorità:
QR di gruppo e stampa in sequenza; poi accrediti stampa; quindi inaugurazione
e cerimonia finale. P13 conserva lo stato aperto e il collaudo rinviato già
documentati. Questo aggiornamento è di pianificazione e non avvia sviluppo,
migration o rilascio. Le nuove milestone P13-G, P13-S e P13-E1/E2/E3 si inseriscono
prima del collaudo finale P16, senza rinumerare le milestone storiche.

È superata l'esclusione generale di piantine e sedute numerate, limitatamente
ai due eventi speciali. Restano invariati i panel ordinari a prenotazione.
La preparazione software della coda di stampa di gruppo può precedere P14;
la stampa operativa e la sua accettazione dipendono ancora da P14/P15.

### Decisione del 2026-10-06 — attivazione report e prosecuzione P13

L'utente richiede l'attivazione del report in staging senza collaudo e il
completamento dello sviluppo degli accessi panel/sala; il testing completo viene
rinviato al termine. Per questa tranche la richiesta supera il collaudo
intermedio prima della prosecuzione. P13 resta aperta fino al testing e alla
revisione finale, senza avanzamento automatico a P14.

Report: migration `20260930180000_reception_operational_report.sql` applicata e
registrata atomicamente nel solo staging; verificati installazione e privilegi,
non eseguite prove funzionali. Accessi panel/sala implementati localmente con
nuova migration `20261006120000_panel_reception_access.sql`, non applicata in
remoto. TypeScript, lint e build staging superati; regressioni predisposte, non
eseguite. Nessun commit, push o deployment. Dettagli, inventario DB e testing
rinviato in `docs/panel-p13-access.md`.

### Riallineamento del 2026-10-03

Integrato localmente `origin/main` a `0b7e4d1` nella base panel `388d05f`,
conservando P0–P13 e le correzioni dashboard di main. 14 file in conflitto
ricomposti; 18 migration di main importate senza modificarle. Nessuna applicazione
SQL remota o pubblicazione: il registro staging va confrontato prima del rilascio.
Verificati 743 test, lint, TypeScript, build staging e collaudi SQL/browser.
Dettagli in `docs/panel-main-integration-2026-10-03.md`.
P13 resta aperta per accessi panel/sala e collaudo autenticato/hardware.

### Strategia di integrazione P0-P16 — aggiornata il 2026-09-12

- L'utente conferma il buon esito delle novità fino a P10. P0-P10 e le
  successive correzioni costituiscono la base da conservare; P11-P16 proseguono
  sullo stesso branch `codex/panel-p0-p10` e sullo staging esistente, senza
  rinominarlo o ricrearlo. La prossima milestone è P11.
- Questa decisione sostituisce il rilascio previsto dopo P10 e il ciclo
  separato per P11-P16. Nessun merge verso `main` o rilascio production ora:
  il rilascio resta una decisione esplicita futura, non scatta automaticamente
  al completamento di una milestone, neppure P16.
- Ogni milestone mantiene commit, verifiche e pausa di revisione distinti.
  Le note datate nelle sezioni P0-P10 restano storico delle singole tranche,
  non istruzioni per rifare o sovrascrivere il lavoro già accettato. Il buon
  esito riferito dall'utente non sostituisce nuove evidenze dei test di rilascio.
- Le migration nuove restano destinate esclusivamente allo staging durante
  lo sviluppo; applicazioni remote, commit e push richiedono la richiesta
  esplicita già prevista dal piano.
- Le attività ordinarie continuano su `main`. Prima di ogni nuova milestone
  panel e dopo rilasci rilevanti: `git fetch origin`, controllo dello stato e
  `git pull --ff-only` sul proprio upstream `origin/codex/panel-p0-p10`.
  Esaminare poi i commit e il diff da `origin/main` non ancora incorporati.
- Integrare periodicamente `origin/main` **nel branch panel** con un merge,
  preservando la storia condivisa: niente rebase, reset distruttivi o force
  push. Prima del merge mettere al sicuro le modifiche locali con commit
  autorizzati; non trascinare lavoro non proprio o sostituire interi file
  scegliendo indiscriminatamente una delle due versioni.
- Risolvere i conflitti conservando sia le correzioni di `main` sia le funzioni
  panel già accettate. Controllare in particolare action condivise, dashboard,
  QR, campagne, permessi e documentazione. Le migration già applicate non si
  riscrivono: verificare ordine e dipendenze, usando nuove migration correttive
  quando necessario. Un merge Git non applica automaticamente il database.
- Annotare per ogni sincronizzazione commit di `origin/main` incorporato,
  conflitti risolti, migration da applicare allo staging ed esiti dei test.
  Eseguire regressioni delle aree toccate e dei panel prima di proseguire.
- Prima del futuro merge verso `main`: nuovo riallineamento, regressione
  completa iscrizioni/iscritti/gruppi/servizi/campagne/QR e P11-P16 realizzate,
  verifica RLS e concorrenza, inventario migration rispetto alla production,
  backup e piano di rollback. Restano le verifiche hardware P14-P16 e
  la revisione del modello di incarichi P12/P13 descritto sotto.

Verifica iniziale P12 del 2026-09-22: fetch eseguito, panel e upstream
allineati a `e13d95a`. `origin/main` a `9bdd098` ha 25 commit e 11 migration
non incorporati. Cancellazione PPTX e cartella `output/` preesistenti non
modificate. Nessun pull da applicare; il merge di main resta da effettuare
in un’integrazione dedicata prima del rilascio, con inventario migration e
regressioni delle aree condivise. Non mescolare o pubblicare il lavoro locale
estraneo alla milestone. Dettagli in `docs/panel-p12-reception.md`.

Sincronizzazione del 2026-09-12: incorporato `origin/main` a `0bc2997` nella
base panel `39deb81`; esaminati tutti i 10 commit. Conflitti risolti conservando
le evoluzioni di entrambi i branch. Dettagli, adattamento del test campagne e
verifiche in `docs/panel-main-integration-2026-09-12.md`.
La migration `20260910120000_leader_attendance.sql` è stata poi applicata
allo staging il 2026-09-12 su richiesta esplicita: registrazione, privilegi,
PostgREST e salvataggio/rilettura SQL sulla fixture con rollback verificati.
Conteggi/hash invariati su 41 tabelle e policy RLS invariate. Il codice del
merge resta locale, da pubblicare e collaudare nella preview; nessun push o
deploy eseguito. Il prossimo sviluppo resta P11.

Stato integrazione al 2026-08-07: le migration P2-P9 sono applicate e
registrate soltanto nel database staging. Home panel e modulo pubblico scuole
sono stati verificati con la fixture sintetica P1. La Preview stabile del
branch usa le variabili applicative dedicate e la allowlist Auth staging;
production e `main` restano invariati. Restano il collaudo autenticato dei
ruoli, i test SQL/RLS e concorrenza e la verifica decisionale del report P10.

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
- Decisione aggiornata il 2026-10-09: la lista d'attesa è richiesta prima
  dell'apertura pubblica delle iscrizioni, insieme ai posti rimanenti nel
  catalogo. Prevedere una milestone dedicata; il gestionale riservato può
  essere rilasciato prima. Le regole di assegnazione dei posti liberati restano
  da definire esplicitamente.
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

- Requisito precisato nella revisione P11 del 2026-09-12: l'operatore svolge
  un'azione già impostata e poi scansiona in sequenza. Non sceglie cosa fare
  dopo aver identificato ogni persona. Fotocamera del cellulare come percorso
  predefinito; codice manuale come alternativa, con identica azione e scope.
- L'intestazione deve rendere sempre evidente l'incarico attivo, per esempio
  `Registra ingresso evento` oppure `Registra ingresso · Panel X`. Un solo
  incarico disponibile viene impostato automaticamente; più incarichi si
  scelgono prima della scansione e si cambiano con un comando esplicito.
  La scelta resta attiva tra scansioni, errori e fallback manuale.
- Ingresso evento e ingresso panel sono operazioni distinte. L'addetto al
  panel non può registrare implicitamente l'arrivo all'evento: in assenza
  di accoglienza evento, il flusso deve indirizzare alla postazione competente.
  La scansione al panel non genera né stampa automaticamente il badge evento.
- Proposta di modello per P12/P13: incarichi operativi assegnati da admin/manager
  nell'evento, distinti in accoglienza evento, accoglienza di panel assegnati e
  assistenza in sala (maschere). Non moltiplicare automaticamente i ruoli
  globali; definire schema e migrazione degli incarichi esistenti nella relativa
  milestone. La UI propone solo incarichi autorizzati; server e DB verificano
  nuovamente azione, evento e panel a ogni operazione, anche dopo una revoca.
- Le maschere consultano soltanto le indicazioni disponibili per sala/settore
  del panel assegnato, senza scrivere presenze o vedere recapiti/questionari.
  Nessuna assegnazione di sedute numerate o piantina viene introdotta da questa
  richiesta. Il dettaglio di questo incarico resta una proposta da revisionare.
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
  auditata, in un percorso separato dalla scansione ordinaria. Non diventano
  azioni distruttive ripetute automaticamente a ogni QR inquadrato.
- Il QR stampato sull'etichetta e' lo stesso QR attivo della persona, non un
  nuovo identificativo. La stampa non deve revocare o rigenerare il token.
- L'etichetta iniziale contiene QR ad alto contrasto, codice partecipante e il
  minimo testo approvato. Dimensioni, densita' e contenuti finali dipendono
  dalla stampante e vanno verificati con badge reali.

### 3.5 QR di gruppo e stampa collettiva

- Un QR opaco e revocabile identifica un gruppo nell'evento corrente; è distinto
  dal QR personale e dalla prenotazione scuola. Non incorpora l'elenco persone.
- Nell'incarico accoglienza evento, la scansione carica i membri autorizzati
  correnti e un riepilogo nominale: comando unico per confermare tutto il gruppo,
  con possibilità di escludere assenti e gestire arrivi parziali. Scansionare il
  codice non deve dichiarare automaticamente presenti persone non arrivate.
- L'operazione registra presenze individuali, comprese quelle dei minori
  esplicitamente confermati. Non sostituisce i conteggi scuola con nomi fittizi.
  Già presenti riconosciuti senza duplicati; retry con lo stesso identificativo,
  controllo dei cambi di composizione e correzioni auditabili.
- Dallo stesso flusso si prepara un lotto ordinato di badge personali, uno dopo
  l'altro, con anteprima e quantità. Deve essere possibile stampare l'intero
  elenco del gruppo; per arrivi parziali si propone il sottoinsieme confermato.
  Stampare badge non equivale a registrare ingressi.
- Ogni badge riusa il QR personale attivo. Verificare prima dello sviluppo come
  rappresentare i minori privi di QR autonomo, senza inventare token o duplicare
  quello del genitore come se identificasse persone diverse.
- Coda riprendibile, errori per elemento e ristampa esplicita: un'interruzione
  non ripete automaticamente tutto il lotto. Senza conferma dal dispositivo,
  mostrare «inviato alla stampa / da verificare», non «stampato».
- Decisioni P13-G del 6 ottobre: solo gruppo selezionato, senza sottogruppi;
  minori selezionabili per la presenza tramite QR del genitore. Il capogruppo
  recupera/revoca il QR dalla gestione link. Le date dichiarate non impediscono
  all'operatore di confermare un arrivo reale; non vengono riscritte.

### 3.6 Accrediti stampa

- L'accoglienza generale riconosce il QR collegato all'accredito e ne verifica
  lato server identità, evento, validità e revoca, quindi consente di preparare
  il badge stampa. Accredito, consegna/stampa badge e ingresso sono stati distinti.
- Se la persona è anche iscritta, collegare le identità con associazione certa,
  evitando presenze e badge duplicati. La fonte degli accrediti, il formato QR
  esistente e l'eventuale assenza di iscrizione vanno verificati prima di P13-S.
- I diritti di accesso sono configurabili per luogo/momento e separati dalla
  validità dell'accredito. City Panel e posti stampa alle due cerimonie sono
  possibilità indicate dall'utente, non autorizzazioni già definite.
- Un accredito valido non assegna da solo una seduta: eventuali riserve stampa
  consumano le quote dei settori e passano dal flusso manager degli eventi speciali.
- Riutilizzare scanner, incarichi, token sicuri e coda badge; mostrare agli
  operatori soltanto dati e indicazioni necessari all'incarico.

### 3.7 Inaugurazione e cerimonia finale

- Due momenti con vista gestionale dedicata e assegnazione manager.
  Decisione esplicita del 2026-10-06: location, caratteristiche, capienze e
  settori indipendenti per inaugurazione e cerimonia finale; entrambi possono
  restare sconosciuti. Nessuna dipendenza da una sede o piantina condivisa. L'iscrizione
  alla Preghiera per la pace comporta partecipazione prevista quando le presenze
  dichiarate coprono il giorno del momento. Non serve prenotazione del partecipante.
  Date non comunicate restano «da verificare»; la regola per le fasce orarie è
  da precisare. Partecipazione prevista, posto assegnato e ingresso effettivo
  devono essere tre stati distinti, anche nei report.
- Solo admin crea e modifica la piantina: aree/settori, capienze, file, sedute,
  etichette, geometria e posti non utilizzabili. Manager assegna posti e quote;
  capogruppo distribuisce solo la dotazione ricevuta ai membri autorizzati e
  ammissibili del proprio gruppo; partecipante consulta la propria assegnazione.
- Catena di allocazione: capienza del settore → quota categoria → dotazione
  gruppo o assegnazione diretta alla persona → distribuzione nominale del gruppo.
  Le categorie devono essere esplicite; non dedurle da dati sensibili o tag.
  Il catalogo e le eventuali sovrapposizioni fra categorie restano da definire.
- Il manager vede disponibilità e residui per settore/categoria/gruppo e può
  assegnare quantità oppure, quando disponibili, sedute specifiche singole o
  multiple, anche contigue. Il capogruppo non può superare dotazione o settore
  ricevuti né scegliere posti assegnati ad altri gruppi.
- La dotazione di gruppo occupa capienza subito: attribuirla ai membri non la
  consuma una seconda volta. Una persona non può ricevere due posti nello stesso
  momento tramite assegnazione diretta e gruppo; definire il fabbisogno dei minori
  e degli accompagnatori prima dell'assegnazione operativa.
- Prima fase senza sedi definitive: configurazioni in bozza, settori e quote
  quantitative. Capienza sconosciuta diversa da zero e da illimitata; dati demo
  esplicitamente tali. Nessuna assegnazione operativa oltre capienze validate.
- Seconda fase: mappa tipo cinema/stadio con zoom, legenda, selezione singola e
  multipla, filtri e alternativa tabellare accessibile. I posti hanno ID stabili;
  le coordinate servono alla vista, non definiscono l'identità della seduta.
- Piantine versionate: con assegnazioni esistenti, vietato eliminare posti o
  ridurre quote sotto gli impegni senza un flusso esplicito di riallocazione.
  Il passaggio da quantità a sedute conserva le dotazioni e segnala i membri
  ancora senza seduta, senza annullamenti o riassegnazioni silenziosi.
- Quote e sedute protette da transazioni/lock, controlli server e DB, audit e
  gestione dei conflitti fra manager. Revoche, cambio gruppo o cambio date
  segnalano assegnazioni da rivedere; nessuna liberazione automatica non concordata.
- Riusare evento, persone, gruppi, momenti e check-in canonici. Le nuove entità
  logiche sono piantina/versione, settore/seduta, quota, dotazione e assegnazione;
  la scelta tra estensione delle tabelle esistenti e nuove tabelle richiede
  verifica dello schema. Non simulare una prenotazione volontaria del partecipante.
- Accesso alle cerimonie tramite identità QR e assegnazione valida, con incarichi
  dedicati; stampa e consultazione devono mostrare settore ed eventuale posto.
  I diritti stampa seguono le configurazioni approvate, senza bypass di capienza.

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
  accoglienza opera soltanto sui check-in dell'evento in scope. P12/P13 devono
  restringere ulteriormente l'operatività agli incarichi evento/panel assegnati;
  la P11 attuale non implementa ancora questa distinzione.

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

Stato: implementata localmente sul branch `codex/panel-p0-p10` il 2026-08-05,
in attesa di applicazione della migration P5 esclusivamente allo staging e di
revisione funzionale con panel pubblicati. Nessuna modifica P5 e' stata
applicata in production.

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

Stato: implementata localmente sul branch `codex/panel-p0-p10` il 2026-08-05,
in attesa di revisione SQL/RLS, applicazione della migration P6 esclusivamente
allo staging e collaudo funzionale autenticato, inclusa la concorrenza
sull'ultimo posto. Nessuna modifica P6 e' stata applicata in production.

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

Stato: avviata e implementata localmente sul branch `codex/panel-p0-p10` il
2026-08-05. Migration, backoffice e test applicativi sono presenti; migration
e RPC hanno superato un test transazionale con rollback sullo staging, ma non
sono ancora state applicate in modo persistente ne' collaudate nel browser
autenticato. Nessuna modifica P7 e' stata applicata in production.

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

Stato: avviata localmente sul branch `codex/panel-p0-p10` il 2026-08-06.
La prima tranche comprende route pubblica `Scuole`, creazione atomica sulla
quota scuola, consenso versionato, email con QR e magic link, recupero accesso
e pagina docente per consultare, modificare, ridurre o annullare. Il
2026-08-07 i testi di accesso, conferma e dashboard docente sono stati
completati nelle sette lingue supportate; il catalogo pubblico usa ora una RPC
dedicata che restituisce gli identificativi necessari senza esporre le
capienze delle quote scuola o consentire letture anonime dirette delle
sezioni. Restano da completare test SQL transazionale sullo staging e collaudo
browser autenticato mobile/accessibile. Nessuna modifica P8 e' stata applicata
in production.

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

Stato: avviata localmente sul branch `codex/panel-p0-p10` il 2026-08-06.
La prima tranche completa il nucleo applicativo: filtro panel dei partecipanti
basato su `moment_attendance_choices` confermate, audience alternativa
`Professori` deduplicata per docente, filtri scuola/panel, selezione esplicita
isolata tra tab, anteprima/test/invio tramite la coda globale e campi template
`scuola`/`panel`. La migration locale e'
`20260806200000_panel_campaign_audiences.sql`. Il 2026-08-07 sono stati
aggiunti la scorciatoia da panel pubblicato alla console gia' prefiltrata, il
controllo server del perimetro evento per tutte le operazioni campagna, label
panel disambiguate per data/ora e caricamento parallelo dei dati iniziali.
Test (192), lint, typecheck, build e collaudo browser delle route pubbliche
modificate sono verdi. Restano obbligatori prima della chiusura: applicazione
ordinata P2-P9 sullo staging, test SQL/RLS e collaudo end-to-end autenticato
con cancellazione panel, docente multi-classe e invio in modalita' log. Nessuna
modifica P9 e' in production.

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

Stato: avviata localmente sul branch `codex/panel-p0-p10` il 2026-08-07.
La prima tranche aggiunge il report panel condiviso nelle statistiche admin e
manager, senza nuova migration: l'aggregazione server legge le tabelle
canoniche P1-P8 e passa al client soltanto conteggi e metadati dei panel. Il
report separa partecipanti individuali, minori ereditati, prenotazioni scuola
e persone scuola, esclude iscrizioni/prenotazioni annullate, dettaglia ogni
sezione e segnala panel pieni, quasi pieni (occupazione almeno al 90%), non
configurati o incoerenti. Sono disponibili filtri per giorno, location, panel,
tipo pubblico e stato, oltre ai collegamenti verso gestione panel e campagne
prefiltrate; `manager_viewer` conserva la vista read-only e non vede la CTA
campagna. Il confronto previsto/effettivo resta intenzionalmente disattivato:
verra' collegato al modello completo di check-in individuale, minori e scuole
della P11, senza usare i check-in legacy in modo parziale. Prima della chiusura
restano il collaudo sui dati sintetici dello staging dopo l'applicazione
ordinata P2-P9 e la verifica browser autenticata admin/manager/manager_viewer.
Sono verdi 195 test, lint, typecheck, `staging:verify` e build production
locale. Nessuna modifica P10 e' in production.

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

Stato: implementata e verificata localmente il 2026-09-12 sul branch panel.
Comprende console manuale per codice/QR, risposta minima, check-in distinti
adulto/minori/scuole, correzioni e annullamenti espliciti, idempotenza, audit e
RLS. Verifiche: 330 test, lint/typecheck, build staging, PostgreSQL temporaneo
con schema canonico e concorrenza reale, browser desktop/mobile sintetico.
Migration `20260912150000_reception_check_ins.sql` applicata e registrata solo
allo staging il 2026-09-12 su richiesta successiva, insieme all'autorizzazione
al commit/push panel. Cinque funzioni confrontate con il file locale,
privilegi/PostgREST e prova SQL famiglia/scuola con rollback verificati;
conteggi/hash dei dati preesistenti invariati su 41 tabelle. Resta la revisione
funzionale autenticata della preview prima della chiusura. Il 2026-09-22
l’utente ha autorizzato P12 rinviando questa revisione al flusso completo mobile.
Production invariata.
Revisione funzionale del 2026-09-12: la console manuale attuale è uno strumento
di collaudo del backend, non il flusso operativo definitivo. Recepito il
requisito azione prima della scansione, con fotocamera predefinita e incarichi
distinti; implementazione e verifiche previste in P12/P13. Questa annotazione
non dichiara chiusa P11 né già disponibili scanner o nuovi permessi.
Dettagli e limiti: `docs/panel-p11-reception.md`.

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

Stato al 2026-09-22: implementata localmente sul branch panel, con incarico
`event_entry`, scanner mobile, fallback manuale, ingresso automatico del
singolo, selezione famiglie/quantità scuole, correzioni separate e retry della
stessa richiesta. Migration evento applicata e registrata soltanto allo staging
il 2026-09-22, su successiva richiesta di preparazione preview. Corpo funzione,
privilegi/PostgREST, prova SQL con rollback e dati invariati su 42 tabelle verificati. Superati 345 test, lint/typecheck, build staging, SQL/RLS e
concorrenza su PostgreSQL temporaneo, browser desktop/mobile sintetico e
decoder su QR reale generato. Pubblicazione del branch panel autorizzata dalla
richiesta di preparazione preview; nessun rilascio production. Procedura:
`docs/panel-p12-reception.md`.

Su richiesta esplicita del 2026-09-22 si procede a P12 rinviando la revisione
funzionale P11 al flusso completo sul cellulare. P11 non è dichiarata chiusa.
Le prove locali non sostituiscono il collaudo autenticato su Preview e almeno
due dispositivi reali; anche P12 resta da accettare sul campo.

Decisione di implementazione: l’attuale ruolo `accoglienza` autorizza l’evento;
nessuna migrazione automatica in incarichi panel. Il contratto e la nuova RPC
rifiutano duty panel/sala. In P13 gli incarichi panel/sala vanno modellati come
assegnazioni separate, senza concedere il ruolo di ingresso evento. In P12
esiste un solo incarico autorizzato e viene impostato automaticamente.

Scopo: completare il flusso operativo di ingresso evento, principalmente
dal cellulare, con azione e incarico stabiliti prima della scansione.

Deliverable:

- scanner fotocamera nella dashboard accoglienza su HTTPS, percorso predefinito
  con preferenza per la fotocamera posteriore;
- stato chiaro di autorizzazione fotocamera e codice manuale come alternativa;
- incarico evento autorizzato impostato prima della scansione, titolo sempre
  visibile e invariato fra persone successive; selezione iniziale solo quando
  esistono più incarichi, senza selettore di azione dopo ogni codice;
- definizione degli incarichi operativi e dei controlli server/DB per impedire
  che un futuro incarico panel abiliti l'ingresso evento; nessun pannello
  selezionabile deve abilitare operazioni non ancora implementate;
- check-in automatico per persona singola;
- conferma componenti presenti per nuclei con minori;
- conferma quantita' effettive per scuole;
- esito immediato valido, gia' presente, non valido o da verificare;
- prevenzione di scansioni ripetute mentre la richiesta e' in corso e finché
  lo stesso QR rimane nell'inquadratura; ripresa per il codice successivo dopo
  l'esito, conservando azione e incarico;
- esito incerto: scansione sospesa e retry della stessa richiesta senza
  cambiare azione o soggetto; nessuna presenza presentata come confermata
  prima della risposta server;
- ultima operazione visibile e correzione auditata in percorso separato;
- interfaccia ad alto contrasto, grandi target touch e dati minimi.

Verifiche: almeno due modelli reali di smartphone/tablet, fotocamera
anteriore/posteriore, luce scarsa, QR su schermo, QR stampato, rete lenta,
doppia scansione e sessione scaduta.
Aggiungere prove su sequenze di persone singole senza scelta di azione,
azione conservata dopo errore/fallback, famiglie parziali e quantità scuola,
cambio incarico esplicito, revoca e tentativi di alterare lo scope dal client.

Accettazione: un operatore registra rapidamente un ingresso senza poter
accedere alla scheda completa del partecipante.

### Milestone P13 - presenza panel e quadro operativo dell'evento

Aggiornamento 6 ottobre: report attivato nel database staging; accessi panel/sala
implementati localmente. Le note seguenti conservano lo storico. I vincoli di
prenotazione, ingresso evento, incarico e capienza sono implementati nella nuova
tranche; collaudo complessivo rinviato su richiesta dell'utente. Stato e limiti
in `docs/panel-p13-access.md`; P13 non è ancora accettata.

Prima tranche implementata localmente il 2026-09-30 su richiesta dell’utente:
stato/orario di ingresso in elenco e scheda operativa admin/manager/viewer,
minori distinti, conteggi evento per persone e scuole, aggiornamento ogni 10
secondi senza perdita dei form aperti. Usa P11/P12 e RLS esistenti; nessuna
migration. Dettagli in `docs/panel-p13-event-attendance.md`.
Non chiude P13: restano collaudo autenticato tra scanner e seconda postazione,
report operativo avanzato e accessi panel/incarichi sala descritti sotto.


Seconda tranche locale del 2026-09-30: report operativo con previsti e ingressi,
filtri giorno/mattina/pomeriggio Europe/Rome, distribuzione oraria e contatori
aggregati di duplicati nelle richieste, retry, correzioni e annullamenti.
I limiti dell’audit storico e l’assenza del dato postazione sono espliciti.
Nuova RPC aggregata autenticata nella migration locale
`20260930180000_reception_operational_report.sql`, non applicata in remoto.
Contratto e proposta concreta degli incarichi ancora da confermare in
`docs/panel-p13-operational-report.md`. Restano accessi panel/sala e collaudo
funzionale; P13 non è dichiarata conclusa. Il 2 ottobre l’utente ha richiesto
commit/push del codice e aggiornamento AGENTS; la migration staging resta
da applicare su richiesta esplicita prima di attivare il report.

Scopo: collegare le presenze effettive a statistiche e agli accessi dei singoli
panel. Il requisito di separazione degli accessi è stato espresso nella
revisione del 2026-09-12; il dettaglio degli incarichi va revisionato nella
milestone, senza anticiparne qui l'implementazione.

Deliverable minimo:

- conteggio ingressi effettivi evento per persone e scuole;
- report in tempo quasi reale con previsti, presenti, duplicati evitati e
  correzioni;
- filtro per fascia oraria e punto di accoglienza quando disponibile.

Accessi panel, da implementare dopo il test dell'ingresso evento:

- incarico e panel autorizzato stabiliti prima della scansione dello stesso QR;
- azione ripetuta automaticamente a ogni codice, con lo stesso fallback manuale
  e le stesse eccezioni per famiglie/scuole del flusso evento;
- verifica che la persona o la scuola sia prenotata;
- check-in specifico al panel e confronto con capienza/settore pubblico;
- messaggio operativo per non prenotato senza esporre informazioni ulteriori;
- assenza di check-in evento: invio all'accoglienza evento, nessuna registrazione
  implicita dell'arrivo o del panel; l'operatore panel non ottiene privilegi evento;
- proposta assistenza in sala: consultazione minima del settore/sala pertinente
  senza scritture su presenze, prenotazioni o assegnazioni di posti.

Verifiche aggiuntive: operatore panel X rifiutato su panel Y e ingresso evento,
maschera rifiutata su tutte le scritture, tentativi via API oltre la UI, revoca
dell'incarico durante la scansione e nessun cambiamento dei conteggi evento
come effetto collaterale di una scansione panel o di assistenza.

Accettazione: il numero dei presenti effettivi e' disponibile ai manager e
non deriva soltanto dalle intenzioni dichiarate nell'iscrizione.

### Milestone P13-G - QR gruppo, accoglienza e preparazione stampa (prima priorità)

Aggiornamento 6 ottobre 2026: tranche software implementata localmente.
Confermate dall'utente esclusione dei sottogruppi e permanenza dei minori sul QR
del genitore. Credenziale gruppo revocabile dal capogruppo, ingresso collettivo
o parziale, correzioni, coda persistente e anteprima sequenziale disponibili
nel codice. Migration `20261006150000_group_reception.sql` soltanto locale.
Verifiche tecniche e limiti in `docs/panel-p13-groups.md`; collaudo autenticato,
attivazione staging e prova hardware ancora aperti. Non è accettazione finale.

Deliverable: risoluzione sicura del QR gruppo, riepilogo e conferma collettiva o
parziale, presenze nominali idempotenti, lotto badge e anteprima, coda riprendibile.
Prima tranche: modello, accoglienza e preparazione software; completamento stampa
fisica insieme a P14/P15, senza dichiarare il flusso completo prima di tale prova.

Accettazione: gruppo intero e arrivo parziale, minori, membri già presenti,
cambio composizione, due operatori, retry dopo rete interrotta, QR revocato o
altro evento, autorizzazioni e ristampa selettiva. Un errore stampa non annulla
presenze confermate e non crea nuovi ingressi. La composizione confermata deve
essere verificata atomicamente, senza conferme parziali nascoste.

### Milestone P13-S - riconoscimento accrediti stampa e badge

**Rinviata il 2026-10-06 su indicazione dell’utente:** fonte e formato degli
accrediti non ancora noti. Si prosegue con P13-E1; P14/P15 richiedono l’hardware.

Deliverable: verifica della fonte e formato accrediti, riconoscimento scanner,
collegamento certo all'eventuale iscritto, stato accredito e badge dedicato,
struttura configurabile dei diritti di accesso senza abilitarne di presunti.
Dipende dalla coda badge condivisa P13-G/P15 per la stampa; l'assegnazione di
posti riservati dipende da P13-E1/E2.

Accettazione: accredito valido/revocato/altro evento, persona già iscritta,
ristampa, permessi, dati minimi e rifiuto di accesso a luogo non autorizzato.
Il collaudo degli accessi specifici segue la definizione dei luoghi ammessi.

### Milestone P13-E1 - eventi speciali, settori e quote

Tranche software implementata localmente il 2026-10-06. Due configurazioni
indipendenti, una per sede/cerimonia; stato, controlli e limiti in
`docs/panel-p13-ceremonies.md`. Migration remota, collaudo autenticato e
validazione delle sedi reali ancora aperti. Verificati 763 test, lint, TypeScript,
build staging, SQL temporaneo con concorrenza e browser sintetico desktop/mobile.
Nessun avanzamento automatico a E2.

Deliverable: due viste dedicate, ammissibilità dalle date dichiarate, modello
admin delle sedi in bozza, settori e quote categoria, assegnazioni manager a
persone e gruppi. Nessun acquisto o prenotazione a scelta del partecipante.

Accettazione: date ignote/assenti, capienze sconosciute, quote insufficienti,
dotazioni concorrenti e impossibilità di allocare oltre il settore. Schema e
permessi verificati anche per URL/API diretti; piantina modificabile solo admin.

### Milestone P13-E2 - distribuzione nominale ai gruppi

Stato 2026-10-06: tranche software locale implementata su richiesta dell’utente. Manager e
capogruppo possono assegnare alle singole persone; il manager opera dalla vista
evento su tutti i gruppi, oltre al percorso di assegnazione diretta E1. Per i
minori decisione esplicita caso per caso: posto oppure nessun posto, senza
regole automatiche di età o eredità dal genitore. Registro nominale unico,
consultazione personale, revoca/trasferimento, retry e conflitti condivisi.
Dettagli e verifiche in `docs/panel-p13-ceremonies.md`. Migration E2 solo locale;
collaudo autenticato e accettazione ancora aperti. E3 avviata successivamente
su nuova richiesta esplicita dell’utente, come descritto sotto.

Deliverable: vista capogruppo delle dotazioni per cerimonia/settore/categoria,
assegnazione ai propri membri, residui, consultazione personale e flussi espliciti
di revoca/riallocazione. Testi capogruppo e partecipante nelle sette lingue.

Accettazione: nessun doppio conteggio della dotazione, nessuna doppia assegnazione
alla persona, rispetto scope e settore, cambio gruppo/date e conflitti manager–
capogruppo. Posti stampa integrabili solo secondo diritti e quote configurati.

### Milestone P13-E3 - piantina interattiva e posti numerati

Aggiornamento pubblicazione 2026-10-06: su nuova autorizzazione dell’utente,
applicate atomicamente in staging le tre migration E1/E2/E3 con backup e verifica
di conservazione dei dati. Autorizzati commit/push sul branch panel. Questo
supera lo stato «solo locale» del database nelle note di sviluppo sottostanti;
non certifica il collaudo autenticato o la validazione delle sedi.

Stato 2026-10-06: tranche software locale implementata su richiesta dell’utente.
Editor admin a file/sedute con coordinate, bozze e versioni immutabili; mappa con
zoom, selezione multipla/consecutiva, filtri e alternativa tabellare. Manager
riserva sedute alle dotazioni o assegnazioni dirette, manager/capogruppo le
attribuiscono ai nominativi E2. Conversione quantitativa senza doppio conteggio,
revoche esplicite, protezione delle versioni occupate, retry e revisioni comuni.
Consultazione personale sette lingue, elenco stampabile e raccordo informativo
con scanner evento/gruppo e anteprima badge; nessun nuovo diritto d’ingresso.
Migration E3 solo locale; dettagli, verifiche e limiti in
`docs/panel-p13-ceremonies.md`. Staging autenticato, sedi e stampanti reali restano
aperti. P13 non conclusa; P14/P15 non avviate.

Deliverable: editor admin generico, mappe versionate, scelta manager di sedute
singole/multiple, assegnazione a gruppi o persone e distribuzione delle sedute
ricevute dal capogruppo; alternativa tabellare e raccordo a badge/accessi/report.

Accettazione: prototipo su sedi sintetiche, selezione accessibile desktop/mobile,
concorrenza sull'ultimo posto, conversione delle dotazioni quantitative, modifica
piantina con assegnazioni e nessuna perdita silenziosa. La validazione delle
sedi reali resta aperta fino alla consegna di capienze e piantine definitive.

### Milestone P14 - prova tecnica delle stampanti per etichette

Scopo: scegliere una soluzione reale prima di integrare API specifiche.

Deliverable:

- almeno una stampante candidata disponibile fisicamente;
- scheda tecnica di formato, DPI, velocita', collegamento, driver e sistemi
  supportati;
- template etichetta di prova con QR, nome e cognome del partecipante e codice pubblico (requisito confermato il 2026-09-08, comune anche ai futuri pass wallet);
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
  statistiche, QR, accoglienza e stampa, inclusi gruppi, accrediti stampa,
  quote cerimonie, distribuzione nominale e piantine;
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

P11-P16 proseguono sul branch panel e sullo staging esistente dopo il buon
esito di P0-P10. Il primo merge verso `main` e il rilascio production restano
sospesi fino a una futura richiesta esplicita e alle verifiche della sezione
2. Le pause di revisione fra milestone restano obbligatorie.

Ordine raccomandato:

1. P0-P4: catalogo manager affidabile e pubblicazione.
2. P5-P6: programma pubblico e iscrizioni individuali.
3. P7-P8: prenotazioni scuole.
4. P9-P10: campagne e statistiche basate su dati ormai stabili.
5. P11-P13: accesso QR, presenza effettiva e accesso panel con incarichi distinti.
6. P13-G: prima nuova priorità, QR gruppo e preparazione dei lotti badge.
7. P14-P15: prova hardware e stampa integrata, inclusi i lotti gruppo.
8. P13-S: accrediti stampa e badge.
9. P13-E1/E2/E3: quote eventi speciali, distribuzione nominale e piantine.
10. P16: hardening e prova generale estesa a tutti i nuovi flussi.

P9 dipende da P6 per il filtro partecipanti e da P7-P8 per l'audience
professori. P10 puo' iniziare dopo P6, ma il report completo richiede scuole e
check-in. P14 puo' essere anticipata in parallelo come attivita' organizzativa,
ma l’integrazione hardware P15 richiede stampante e postazione scelte e
provate. La preparazione software P13-G non dipende dalla scelta hardware;
se questa tarda, le altre nuove milestone possono proseguire conservando
aperta l’accettazione della stampa fisica.

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

- scelta autonoma di sedute numerate da parte del partecipante;
- estensione delle piantine ai panel ordinari (quelle delle due cerimonie sono
  invece incluse da P13-E3);
- trasferimento automatico di posti inutilizzati da una sezione a un'altra;
- promozione automatica dalla lista d'attesa senza regole concordate (la coda
  è invece richiesta dalla decisione del 2026-10-09);
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
- il QR gruppo consente accoglienza collettiva o parziale e stampa sequenziale
  riprendibile dei badge personali;
- gli accrediti stampa sono riconosciuti e i badge rispettano i diritti definiti;
- inaugurazione e cerimonia finale hanno quote e posti assegnati dai manager,
  distribuzione ai membri da parte dei capigruppo e piantine configurate dagli admin;
- permessi, privacy, audit, test, runbook e prova hardware sono verificati in
  condizioni realistiche.
