# Collaudo Brother QL — registro operativo

## Ripresa e collaudo remoto Admin — 14 ottobre 2026

Sospensione superata dalla nuova richiesta: per questa tranche Chrome
configurato per stampa silenziosa, individuale e gruppi. Le alternative
restano documentate nello storico. Formato finale 29 × 45 mm, profilo
continuo distinto dal pretagliato 29 × 90 mm.

Su successiva indicazione dell’utente tutto il codice panel viene integrato
localmente in main; nuove funzioni di stampa e scanner solo Admin, anche
nella dashboard Accoglienza. Nessuna pubblicazione o migration remota.

Acquistato DK-22210, specifica Brother 29 mm verificata. Stampante al momento
non presso lo sviluppatore; collaudatore remoto con accesso Admin e Mac/forse
Windows. Modello riferito «Wc810», targhetta/collegamento/rotolo montato ancora
da confermare prima del setup. **Nessuna nuova prova fisica conclusa.**

Procedura e verbale: [collaudo remoto Admin](collaudo-stampa-remoto-admin.md).
Codice, migration, inventario DB e limiti: [integrazione main](panel-main-integration-2026-10-14.md).
Le evidenze del 12 ottobre restano valide per quella specifica configurazione;
non estenderle al continuo o all’altro computer.


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

## 12 ottobre 2026 — ripresa e formato definitivo

L’utente conferma **29 × 45 mm come formato finale approvato** e riprende
lo sviluppo sul branch panel. Questa scelta supera lo stato precedente di
formato candidato; non equivale al collaudo del continuo da 29 mm.
Materiali ripristinati dallo stash conservato. Primo passo concordato:
pulsante per la stampa individuale del QR esistente. Verificare il rotolo
caricato prima della prossima prova fisica; il primo campione browser usava
DK-11201 29 × 90 mm e ritaglio manuale a 45 mm.

## 9 ottobre 2026 — correzione misure e campione 29 × 45 mm

Questo aggiornamento supera le misure precedenti del QR lungo riferite come
19 mm e i calcoli derivati da quella misura; non corregge automaticamente
le misure dei campioni iniziali con payload corto.

- L'utente corregge il lato nero del QR versione 4, cella Medio-piccola,
  del campione da 40 mm: circa **13–14 mm**, non 19 mm.
- Nuova prova su DK-11201 reale 29 × 90 mm, sagoma prevista 29 × 45 mm:
  José María / García / López, payload sintetico lungo invariato, versione
  Auto (4), ECC 15%, cella Media; codice TEST-001 sotto, Y=40 mm secondo
  istruzioni del modello. Nome e QR conservano le posizioni della copia.
- Lato nero del QR stampato attuale misurato dall'utente: **16–17 mm**.
  Non sono stati raggiunti i 21–22 mm ipotizzati in precedenza.
  Con 33 moduli, quiet zone minima teorica circa 1,94–2,06 mm per lato;
  margini effettivi di questo nuovo campione da verificare separatamente.
- Dal bordo superiore al fondo del codice: **circa 43 mm**. Un ritaglio a
  45 mm lascerebbe circa 2 mm sotto il testo.
- L'utente conferma lettura su Pixel 7 e iPhone; sull'iPhone il riconoscimento
  come QR è ora più rapido rispetto al campione precedente. Valutazione
  qualitativa, non cronometrata; modello iPhone e iOS non acquisiti.
- Dopo ritaglio a 45 mm, l'utente conferma codice scritto integro e lettura
  corretta del QR sia con Pixel 7 sia con iPhone. Prova fisica del singolo
  campione 29 × 45 mm riuscita anche dopo il ritaglio.
  Formato candidato promettente, non ancora scelta finale né collaudo del
  DK-22210 continuo o della stampa dal browser. Nessuna modifica applicativa.

## 8 ottobre 2026 — ricognizione iniziale

Riferimento: [decisioni accoglienza](accoglienza-postazioni-stampa.md).
Solo hardware e campioni sintetici; nessuna integrazione applicativa.

- Mac rilevato: macOS 26.6.2, build 25G83, arm64 (Apple Silicon).
- CUPS 2.3.4; nessuna stampante o destinazione predefinita configurata.
- Nessuna applicazione Brother/P-touch nell'inventario system_profiler;
  nessuna ricevuta Brother/P-touch trovata con pkgutil.
- Inizialmente senza adattatore USB; successivamente l'utente lo ha trovato:
  prima prova via USB confermata. Wi-Fi rinviato, nessun abbinamento eseguito.
- Utente conferma stampante accesa: spia accensione verde e spia Editor Lite
  verde. Rotolo caricato e collegamento USB ancora da verificare.
- Prossimo passo indicato: tenere premuto solo Editor Lite finché la relativa
  spia verde si spegne; esecuzione ancora da confermare. Per P-touch Editor
  completo la modalità Lite deve essere disattivata prima del collegamento USB.
  [Istruzione Brother](https://www.brother.com.au/en/contents/top-faqs/faq-ql-label-printer-not-printing).
- Aggiornamento: utente conferma Editor Lite spento e collegamento USB.
  ioreg rileva dispositivo Brother QL-810W attraverso hub USB; il nome USB
  non distingue necessariamente il suffisso commerciale Wc.
  Coda Brother_QL_810W presente, abilitata, inattiva e predefinita; trasporto
  ippusb. Nessuna installazione manuale effettuata in questa sessione.
  Opzioni esposte: 29x90mm disponibile, qualità Normal/High, taglio
  None/EndOfPage/EndOfJob. Formato attualmente predefinito 12x12mm: da correggere
  prima della prova DK-11201. Rilevamento USB non equivale a stampa riuscita.
- Nessun software installato, lavoro inviato o stampa fisica verificata.
- Main allineato a origin/main dopo fetch. Modifiche preesistenti a AGENTS.md,
  documento decisionale, output/ e tmp/ preservate; nessun pull necessario.

## Fonti ufficiali e verifiche aperte

- [Download Brother QL-810W/810Wc Italia](https://support.brother.com/g/b/downloadtop.aspx?c=it&lang=it&prod=lpql810weuk):
  macOS 26 elencato; strumenti indicati: driver, P-touch Editor, Printer Setting
  Tool. Versioni dei pacchetti e requisiti Apple Silicon/Rosetta ancora da
  verificare prima dell'installazione. Non confondere supporto macOS dichiarato
  con collaudo effettivo su questa macchina.
- [Collegamento wireless Brother](https://support.brother.com/g/b/faqend.aspx?c=us&faqid=faqp00100326_000&lang=en&prod=lpql810weus):
  rete tramite router, WPS e Wireless Direct sono percorsi distinti.
  La configurazione assistita ordinaria può richiedere USB: non presumere che
  l'installazione del software risolva da sola l'assenza del cavo utilizzabile.
- [Scheda QL-810Wc Brother](https://www.brother.eu/-/media/Product-Downloads/Devices/Label-Printers/QL/QL810Wc/QL-810Wc-Datasheet.ashx):
  dotazione starter nominale DK-11201 da 100 etichette e DK-22251 da 5 metri.
  Quantità effettive e residui dei quattro rotoli dell'utente da controllare;
  non assumere che siano tutti starter nuovi.

## Dotazione software delle postazioni — checklist da validare nel collaudo

Preparare ogni PC per il modello realmente collegato, QL-810Wc o QL-800.
Scaricare i pacchetti esclusivamente dalle pagine Brother selezionando sistema
operativo e versione; non copiare un driver Mac su Windows o tra modelli.

| Componente | Utilizzo previsto |
| --- | --- |
| Supporto di stampa del modello | Verificare la coda di sistema e i formati; installare il driver ufficiale Brother dove necessario. Su questo Mac è comparsa una coda IPP-over-USB senza installazione manuale: verificarne prima le capacità, senza presumere necessario un driver aggiuntivo |
| P-touch Editor | Preparazione, apertura e prova dei template Brother; includere nel setup di collaudo e come strumento operativo di diagnosi. Non è il motore della futura stampa dal browser |
| Printer Setting Tool | Configurazione/manutenzione della stampante; includere dove disponibile per il sistema selezionato. Non deve necessariamente restare aperto durante la stampa |
| Browser aggiornato | Successiva prova del dialogo di stampa e futuro accesso al sito; versione e impostazioni da registrare dopo il collaudo |
| Template e campioni approvati | Copia locale identificata per versione e supporto, con misure e istruzioni ripetibili; ancora da preparare e validare |

Non installare al momento bridge di stampa, SDK, estensioni o servizi locali:
il percorso iniziale usa il dialogo di stampa. Un eventuale invio automatico
senza dialogo richiederà una scelta e un collaudo separati su Mac e Windows.
Rosetta su Apple Silicon solo se richiesta dai pacchetti ufficiali verificati.
Nessun aggiornamento firmware incluso implicitamente nella prima prova.

Fonti: [QL-810Wc](https://support.brother.com/g/b/downloadtop.aspx?c=it&lang=it&prod=lpql810weuk)
e [QL-800](https://support.brother.com/g/b/downloadtop.aspx?c=it&lang=it&prod=lpql800euk).
Brother indica driver, P-touch Editor e Printer Setting Tool. Entrambe le
pagine elencano macOS 26 e Windows 11; segnalano inoltre assenza di driver
per Windows su ARM. Verificare quindi architettura dei PC Windows prima di
assegnarli alle postazioni; questo limite non riguarda il Mac arm64.

Per ogni PC registrare: OS/architettura, versioni dei pacchetti installati,
modello e nome coda, collegamento, supporto caricato, formato/orientamento,
scala, qualità, taglio e risultato della prova fisica. USB e alimentazione
sono collegamenti distinti. Procedere al collegamento dati quando indicato
dal percorso d'installazione, senza presumere che il rotolo sia già caricato.

Stato attuale: checklist documentata; nessuna installazione effettuata.

## Campioni da preparare e ordine delle prove

1. Software Brother, DK-11201 reale 29 × 90 mm: due sagome 29 × 40 mm
   da ritagliare a mano. Confronto stesso nome/QR con e senza codice leggibile.
   Nome e cognome sopra, QR nero sotto. Nessun taglio automatico a 40 mm.
2. Nomi interamente sintetici: Ada Mori; Alessandra Francesca Monteverdi;
   José María García López. Identificativi TEST-001, TEST-002, TEST-003.
   QR esplicitamente di prova, senza URL o token di persone reali.
3. Rispettare area stampabile Brother e quiet zone di almeno quattro moduli;
   controllare densità del payload, corpo testo e dimensione dei moduli prima
   di inviare. I circa 24 mm del QR sono un obiettivo da verificare, non un
   risultato acquisito. Non troncare nomi né ridurli automaticamente senza limite.
4. Successivamente DK-22251: singola 62 × 35 mm e doppia 62 × 45 mm come
   proposte da collaudare, supporto nero/rosso selezionato, QR sempre nero.
5. Browser separato, solo dopo il campione Brother: scala 100%, formato reale,
   orientamento, margini e intestazioni/piè di pagina da registrare.
6. QL-800 e Windows in sessioni successive; compatibilità Windows non ancora
   collaudata. Conservare misure in mm, payload, sorgenti e impostazioni per
   riprodurre i campioni con driver/software ufficiali del sistema destinatario.

## Scheda da compilare per ogni stampa

| Campo | Risultato iniziale |
| --- | --- |
| ID campione e versione sorgente | Da preparare |
| Stampante, collegamento, software/driver e versioni | Da configurare |
| Rotolo, formato, orientamento, scala, qualità e taglio | Da verificare |
| Dimensioni fisiche etichetta e QR con righello | Non misurate |
| Nome leggibile e assenza di elementi tagliati | Non verificati |
| Payload decodificato, telefoni usati, tentativi riusciti/totali | Non verificati |
| Tempo comando–uscita e tempo complessivo con taglio/consegna | Non misurati |
| Scarti e materiale consumato | Nessun lavoro inviato in questa sessione |
| Esito fisico confermato dall'utente | In attesa |

Una coda vuota o un dialogo completato non certificano la stampa fisica.

## Prime stampe fisiche da P-touch Editor — 8 ottobre 2026

- P-touch Editor installato dall'utente e aperto, stampante QL-810W(USB).
  Versione applicazione ancora da rilevare.
- Controlla supporto ha impostato 29 × 90 mm. Orientamento Retrato,
  campo Margini 3 mm. Nome sintetico Ada / Mori su due righe;
  corpo 11 pt richiesto durante la guida, centratura orizzontale.
  Grassetto richiesto ma non confermato con certezza nelle schermate successive.
- QR TEST-001, Modello 2 standard, ECC 15%, versione Auto (1 nella schermata),
  dimensione cella Grande; posizione X=4 mm, Y=16 mm. Dimensioni fisiche del
  simbolo e quiet zone ancora da misurare, non certificate dallo screenshot.
- Dialogo Brother: 1 copia, taglio automatico attivo, speculare disattivato.
  Nome di salvataggio suggerito Prova-DK11201-Ada-Mori-senza-codice;
  percorso e salvataggio effettivo da verificare.
- L'utente conferma due stampe fisiche: nome e QR interi e nitidi;
  prima etichetta uscita storta, seconda ben allineata. La spiegazione
  "perché era la prima" è un'ipotesi dell'utente, non una causa verificata.
- Due etichette stampate secondo il riscontro; taglio completo, tempi,
  misure, decodifica da telefono e ripetibilità su ulteriori campioni ancora
  da verificare. Non dichiarare completato il collaudo.
- Prossimo controllo: decodificare la seconda etichetta e verificare il testo
  esatto TEST-001, annotando telefono e applicazione usati. Un lettore generico
  deve supportare QR testuali; nessuna apertura di sito o registrazione presenza.

### Esito successivo confermato dall'utente

- L'utente identifica il rotolo inizialmente storto come causa della prima
  etichetta inclinata. Seconda stampa allineata; ripetibilità sulle successive
  ancora da verificare.
- Seconda etichetta letta con la fotocamera di Google Pixel 7: testo restituito
  esattamente TEST-001. Primo controllo di decodifica riuscito; distanza, tempo
  di aggancio e numero di tentativi non misurati. Altri telefoni non provati.
- Prossima verifica: misurare il quadrato nero del QR (escluso bordo bianco)
  e la distanza dal bordo superiore dell'etichetta al punto nero più basso;
  verificare la quiet zone prima di ritagliare a 40 mm.

### Misure e ritaglio del primo campione

- Misure con righello riferite dall'utente: quadrato nero QR tra 17 e 18 mm;
  distanza dal bordo superiore dell'etichetta al nero più basso tra 35 e 36 mm.
- Per il QR versione 1 (21 moduli), quattro moduli corrispondono a circa
  3,2–3,4 mm; ingombro teorico con quiet zone circa 23,5–24,9 mm.
  Tagliando a 40 mm restano circa 4–5 mm sotto il simbolo. Stime da misure
  manuali, non misurazioni metrologiche dei margini su tutti i lati.
- Dopo l'istruzione di ritagliare manualmente a 40 mm, l'utente conferma
  nuova lettura riuscita con il Pixel 7. Primo campione Ada Mori / TEST-001
  leggibile prima e dopo il ritaglio. Non estendere questo esito a nomi lunghi,
  QR più densi, altri telefoni o avanzamento/taglio del continuo da 29 mm.
- Prossimo confronto: variante con codice TEST-001 leggibile, preservando il
  campione senza codice e senza invadere quiet zone o aumentare la sagoma.

### Variante con codice sotto il QR

- L'utente ha duplicato e rinominato il modello; nome e cognome su due righe.
  Il codice leggibile va sotto il QR, come chiarito dall'utente; non tra nome
  e QR. La proposta intermedia con nome su una riga è stata abbandonata.
- Scelta effettiva dell'utente: cella QR Medio-grande, Y=14 mm, TEST-001
  leggibile sotto. Per il testo erano stati indicati 8 pt e Y=32 mm;
  valori numerici effettivi del testo da confermare. Screenshot del layout
  ricevuto; nessuna certificazione delle misure derivata dai soli pixel.
- L'utente conferma lettura del QR stampato (nel contesto della prova con
  Pixel 7) e circa 3 mm tra il nero del QR e l'inizio del codice leggibile.
- Lato nero e posizione del bordo inferiore del testo ancora da misurare
  prima del ritaglio a 40 mm. Per versione 1, quiet zone minima = lato nero
  × 4/21: 3 mm bastano se lato nero non supera 15,75 mm; considerare
  l'approssimazione del righello. La sola decodifica non certifica tutti i margini.

### Variante con codice — misure ed esito dopo ritaglio

- L'utente misura lato nero QR circa 19 mm e fondo della scritta a circa
  36 mm dal bordo superiore nella versione iniziale. Questo lato riferito
  non è ancora riconciliato con la precedente misura 17–18 mm del QR Grande:
  ricontrollare criterio nero–nero e impostazioni prima di fissare il template.
- Distanza tra Mori e nero QR riferita tra 3,5 e 4 mm; per lato 19 mm e
  versione 1 servono circa 3,62 mm. Margine superiore al limite della misura,
  non certificato dalla sola scansione riuscita.
- L'utente conferma codice TEST-001 spostato di 1 mm verso il basso:
  distacco sotto QR stimato circa 4 mm, fondo testo stimato a 37 mm.
  Lo spostamento proposto di 0,5 mm del nome non è stato applicato perché
  l'editor non lo consente nel controllo usato. Non registrarlo come eseguito.
- Dopo l'istruzione di ritagliare a 29 × 40 mm l'utente giudica il codice
  abbastanza comodo e conferma che il Pixel 7 legge ancora TEST-001.
  Esito positivo di leggibilità/decodifica del campione breve con codice;
  margine superiore da rifinire e misure da riconciliare prima dell'approvazione
  definitiva. Conteggio totale delle copie successive non acquisito.
- Prossimo campione: nome lungo Alessandra Francesca / Monteverdi, in una
  nuova copia del modello con codice, senza alterare i riferimenti brevi.

## Preparazione rotolo — riscontro fisico

## Secondo telefono — iPhone

### Direzione scelta dopo il confronto

L'utente preferisce larghezza 29 mm su futuro continuo, lunghezza regolabile;
29 × 40 mm è il riferimento gradito, con possibile aumento del QR denso.
Approfondire questa opzione prima delle prove larghe/doppie DK-22251.
Proposta ancora non eseguita: confrontare il nero del QR attuale (circa 19 mm)
con circa 21–22 mm, mantenendo quiet zone di quattro moduli. Con versione 4
(33 moduli), ingombro totale teorico circa 26,1–27,3 mm, compatibile con 29 mm
di carta se centrato ma da verificare nell'area stampabile per le parti nere.
Il nome lungo su tre righe e il codice sotto occupano già quasi 40 mm:
valutare 29 × 45 mm per il confronto più grande, senza approvarlo come finale.
Stampare ancora su 29 × 90 mm e ritagliare; mantenere il modello da 40 mm.

- L'utente prova l'iPhone della madre, modello e versione iOS non ancora
  acquisiti. Conferma lettura corretta di due campioni: nome lungo con payload
  TEST-001 e nome con accenti/doppio cognome con nuovo payload sintetico lungo.
- Aggancio percepito meno immediato rispetto al Pixel 7: inizialmente la
  fotocamera evidenzia nome/cognome; inclinando leggermente il telefono verso
  il QR, questo viene riconosciuto correttamente. Osservazione dell'utente,
  non diagnosi della causa né misura cronometrata.
- Esito: decodifica riuscita su Pixel 7 e un iPhone per questi campioni;
  rapidità operativa ancora da migliorare/verificare, soprattutto per QR denso.
  Nessun tempo numerico o numero di tentativi dedotto. L'eventuale interfaccia
  scanner futura del sito non è stata provata con queste fotocamere native.

## QR sintetico da 43 caratteri — prova fisica completata su Pixel 7

- Payload del campione: `test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC`.
  Nome José María / García / López e codice leggibile TEST-001 sotto il QR.
- P-touch Editor con versione Auto sceglie 4; una prova di impostazione
  manuale a 5 è stata abbandonata. Versione 4 e cella Medio-piccola sono
  le impostazioni confermate per il campione effettivamente stampato.
  Variante cella Media con codice Y=38 mm conservabile come confronto,
  ma non dichiarata collaudata fisicamente.
- Misure riferite dall'utente: lato nero circa 19 mm; fondo del codice poco
  sotto i 40 mm dal bordo superiore; circa 4 mm di bianco sia tra nome e QR
  sia tra QR e codice. Versione 4 = 33 moduli: quiet zone minima teorica
  4 × 19/33 = circa 2,3 mm. Margini laterali non misurati esplicitamente.
- Pixel 7 riconosce il QR prima del ritaglio. Dopo ritaglio a 40 mm, l'utente
  conferma codice scritto integro e QR ancora letto. La corrispondenza integrale
  dei 43 caratteri decodificati non è stata riportata esplicitamente.
- Esito: formato 29 × 40 mm promettente anche con densità rappresentativa,
  su questo telefono e questo campione. Margine inferiore del testo ridotto;
  non ancora approvazione universale. Da completare: secondo telefono, tempi,
  ripetibilità, confronto senza codice con payload lungo, DK-22251 largo/doppio,
  browser, QL-800 e Windows. Nessuna modifica applicativa o di dati reali.

## Nome lungo e finalità del testo — aggiornamento del collaudo

### Doppio cognome e accenti

Campione José María / García / López su tre righe a 9 pt, derivato dalla
variante nome lungo con codice sotto, QR sintetico TEST-001. Dopo stampa e
ritaglio a 40 mm l'utente conferma accenti e codice nitidi e integri, e lettura
di TEST-001 con Pixel 7. Tre tipi di nome verificati con payload corto;
nessuna conclusione ancora sui QR più densi rappresentativi dell'applicazione.

Prossima prova di densità: ispezione in sola lettura di lib/qrcode/token.ts e
render.ts, senza DB. Il token applicativo è base64url di 32 byte (43 caratteri),
ECC M. Usare payload fisso sintetico di 43 caratteri
`test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC`, non registrato nel sistema.
Conservare TEST-001 come codice leggibile del campione. Duplicare il template;
con versione Auto il simbolo aumenta di moduli, quindi dimensioni e quiet zone
vanno ricontrollate prima di stampare. Nessuna modifica ai renderer applicativi.

- Alessandra Francesca / Monteverdi a 11 pt su due righe eccedeva la larghezza;
  adattato a tre righe Alessandra / Francesca / Monteverdi a 9 pt.
- Layout proposto: nome Y=3 mm, codice Y=35 mm. L'utente ha scelto QR Y=17 mm
  invece di 18 mm per conservare più spazio rispetto al codice sottostante.
- Dopo la richiesta di prova l'utente giudica il testo leggibile. Decodifica,
  misure dei margini e ritaglio di questo specifico campione lungo non ancora
  confermati; non trasferire gli esiti dei campioni Ada Mori a questo modello.
- Riscontro successivo: l'utente conferma che il Pixel 7 legge anche il QR
  stampato del campione Alessandra / Francesca / Monteverdi. Testo giudicato
  leggibile a distanza operativa ravvicinata. Restano da acquisire misure dei
  margini, distanza dal bordo superiore al fondo del codice e lettura dopo
  ritaglio per questo specifico campione lungo.
- Verifica completata dell'ingombro: fondo del codice a 38–39 mm dal bordo
  superiore, secondo righello dell'utente. Dopo ritaglio a 40 mm, codice
  leggibile integro e QR nuovamente letto dal Pixel 7. Residuo inferiore solo
  1–2 mm: variante compatta, non ancora template universale approvato.
  Quiet zone superiore/inferiore non misurata per questo specifico campione;
  la lettura riuscita non ne certifica autonomamente la conformità.
- Chiarimento: il testo è destinato alla lettura ravvicinata degli operatori
  per abbinare e consegnare i QR alle persone giuste senza scansioni o nomi
  scritti a mano. Il badge ricevente contiene già il nome della persona.
  Non occorre renderlo un secondo nome principale leggibile a distanza.
  Questo orienta il giudizio sul corpo 9 pt, senza autorizzare nomi troncati
  o riduzioni illimitate e senza sacrificare quiet zone e scansione.

### Cronologia del caricamento iniziale

Aggiornamento: l'utente ha seguito la rimozione della protezione, l'inserimento
del DK-11201 e del nastro, poi chiuso il coperchio e acceso. Conferma una sola
spia accesa, verde fissa. Avanzamento automatico e corretto posizionamento
effettivo da validare con la prima stampa; nessun esito di stampa acquisito.
La coda Mac resta abilitata e inattiva. P-touch Editor non risulta installato:
prossimo passo installazione dell'app gratuita ufficiale
[Brother P-touch Editor dal Mac App Store](https://apps.apple.com/it/app/brother-p-touch-editor/id1453365242?mt=12).

L'utente conferma vano rotolo vuoto. Caricamento non ancora eseguito.
Prossimo passaggio: spegnere la stampante prima del caricamento, come indicato
nella [procedura Brother](https://support.brother.com/g/b/faqend.aspx?c=vn&faqid=faqp00000397_005&lang=en&prod=lpql810weas).
Usare per la prima prova DK-11201; verificare eventuale foglio protettivo nella
fessura di uscita prima di inserire il supporto. Quantità starter ancora da
confermare sulla confezione effettiva.

## 9 ottobre 2026 — preparazione prova browser BROWSER-29x45-v1

- Utente conferma nuovamente stampante accesa/spia verde fissa, Editor Lite
  spento, USB collegata e DK-11201 29 × 90 mm caricato.
- Coda `Brother_QL_810W` abilitata, inattiva, nessun lavoro pendente; IPP-over-USB.
  PPD: formato predefinito 12x12mm, da non usare. 29x90mm disponibile;
  qualità Normal e taglio EndOfPage predefiniti, ancora da verificare nel dialogo.
  Area stampabile del PPD 29x90: margini laterali circa 1,54 mm,
  superiore/inferiore circa 3,03 mm. Il campione colloca tutti i segni neri
  all'interno di questi limiti; la scala fisica resta da misurare.
- Modello salvato realmente trovato tramite finestra P-touch e archivio LBX:
  `/Users/giovaniperlapace/Prova-DK11201--QR43-Validata.lbx`, 2129 byte.
  Non si chiama Prova-29x45-QR43-validata. XML verificato: nome completo a tre
  righe, Helsinki 9 pt, codice TEST-001 a 8 pt circa Y=40 mm, payload sintetico
  atteso, ECC 15%, versione auto. File originale non modificato.
- Checkout passato da main a `codex/panel-p0-p10`; fetch: branch e upstream
  allineati. Conservata aggiunta locale AGENTS e documenti/output/tmp esistenti.
  Backup AGENTS originario e patch in
  `/var/folders/lh/_4hh74l13fs5r1prsvtgbx9r0000gn/T/brother-branch-preserve-j37sen0b`.
  Nessun merge di main: prova isolata, nessuna modifica applicativa o commit.

### File e riproduzione

- `tools/brother-browser-test/index.html`: pagina autonoma, CSS/SVG incorporati,
  nessuna dipendenza di rete, chiamata app o DB. Apribile anche come file locale
  su Mac/Windows. Nessuna stampa automatica all'apertura.
- `tools/brother-browser-test/generate.mjs`: sorgente, usa qrcode già installato;
  rigenerazione dalla root: `node tools/brother-browser-test/generate.mjs`.
- `tools/brother-browser-test/sample.json`: geometria e payload del campione.
- Anteprima servita solo su loopback con
  `python3 -m http.server 8769 --bind 127.0.0.1 --directory tools/brother-browser-test`;
  indirizzo `http://127.0.0.1:8769/`. Non avviare il server dalla root del repo.
- Nome Arial 9 pt, interlinea 11 pt, tre righe, X=2 mm/Y=3,5 mm/larghezza 25 mm.
  Codice Arial 8 pt, Y=40 mm. Font diverso da Helsinki: verificare su carta.
- Payload esatto `test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC`, 43 byte ASCII;
  qrcode sceglie versione 4, Byte, ECC M, 33 × 33 moduli, senza versione forzata.
  Modulo 0,508 mm (6 punti nominali a 300 dpi), nero 16,764 mm; quiet zone
  incorporata 4 moduli = 2,032 mm per lato; totale SVG 20,828 mm.
  SVG centrato X=4,086 mm, Y=16 mm; nero tra Y=18,032 e 34,796 mm.
  Dimensioni nominali CSS, non ancora misure fisiche. Nessun renderer app cambiato.
- Pagina fisica 29 × 90 mm, @page margin 0. Piccoli riferimenti laterali a
  Y=45 mm per ritaglio manuale; nella parte da scartare linea lunga 20 mm a
  Y=60 mm per verificare scala. Una sola etichetta/campione.

### Stato e prossimi controlli, un passaggio fisico alla volta

Anteprima Chrome aperta: Brother QL-810W selezionata, una copia, una pagina.
Dialogo successivamente chiuso; nessun invio eseguito dall'agente.
Formato effettivo, scala e margini del dialogo non ancora acquisiti.
Non considerare riuscita la stampa; nessuna conferma fisica browser ricevuta.

1. Aprire Altre impostazioni: verificare 29 × 90 mm, verticale, scala 100%,
   margini Nessuno, intestazioni/piè di pagina disattivati, una pagina/copia.
   Se necessario usare dialogo di sistema per qualità e taglio EndOfPage
   sulla pagina da 90 mm. Non configurare taglio automatico a 45 mm.
2. Solo dopo verifica impostazioni, stampare una copia e cronometrare
   comando–uscita completa/taglio; chiedere conferma dell'uscita all'utente.
3. Misurare linea da 20 mm, nero QR atteso 16,764 mm, posizione riferimenti
   a 45 mm, margini e integrità testo; annotare eventuale rotazione/spostamento.
4. Decodificare con Pixel 7 e iPhone e confrontare tutti i 43 caratteri;
   annotare tentativi e tempi, senza scambiare TEST-001 col payload QR.
5. Solo dopo controllo margini, ritagliare manualmente a 45 mm e riprovare
   entrambi i telefoni. Annotare copie/scarti e conferma fisica finale.
6. Ripetibilità, Windows e QL-800 restano da collaudare separatamente.

Proposta d'integrazione applicativa rinviata al risultato fisico, come richiesto.

### Anteprima al 100% — correzione ingombro pagina

Screenshot utente: carta 29 × 90 mm, margini Nessuno, scala personalizzata
100%, intestazioni non più presenti tra le opzioni; Chrome mostra 2 fogli.
Nessuna stampa confermata. Possibile arrotondamento tra altezza CSS 90 mm e
formato carta del driver: causa non ancora certificata.
Correzione solo in stampa: contenitore alto 89 mm con overflow nascosto,
lasciando 1 mm vuoto di tolleranza in fondo. @page resta 29 × 90 mm;
coordinate e misure di tutti i contenuti (entro 65 mm) invariate, nessuna
riduzione di scala. Rigenerato index.html. Richiesta nuova anteprima dopo
Annulla, ricaricamento pagina e riapertura dialogo; una pagina da verificare.

### Prima uscita fisica dal browser — 9 ottobre 2026

- Dopo la correzione del contenitore, utente conferma anteprima su un foglio.
  Impostazioni Chrome documentate dagli screenshot: 29 × 90 mm, margini
  Nessuno, scala personalizzata 100%; intestazioni disattivate nel percorso.
- Passaggio al dialogo macOS: inizialmente mostrava Altra 210 × 297 mm;
  utente ha selezionato nuovamente 29x90mm. Screenshot successivo conferma
  29 × 90 mm, Verticale, ridimensionamento 100%, qualità Normale.
- Opzioni finitura → Applica finiture → Opzioni stampante → Ritaglia:
  Taglia dopo ogni pagina, visibile selezionato. Pagina fisica da 90 mm;
  nessun taglio automatico impostato a 45 mm.
- Utente conferma uscita di una sola etichetta, stampa percepita immediata,
  circa 2 secondi o meno. Stima riferita, non misura cronometrata certificata.
- Confermata l'uscita fisica del primo campione browser. Separazione completa
  del taglio, scala misurata, margini, integrità e scansioni ancora da verificare;
  il collaudo complessivo non è concluso. Non ancora ritagliata a 45 mm nel
  percorso guidato; nessuna modifica applicativa o al database.

### Esito fisico confermato — campione browser ritagliato

Riscontri successivi dell'utente sul primo campione BROWSER-29x45-v1:

- Taglio automatico completo: etichetta separata dal rotolo.
- Linea di controllo misurata 20 mm; trattini laterali a 45 mm dal bordo
  superiore. Scala e posizione coerenti con il progetto, entro precisione
  del righello; nessuna certificazione metrologica.
- Lato nero QR confermato circa 16,8 mm (tra 16 e 17 mm).
- Nome e TEST-001 interi e nitidi; bianco libero attorno al QR confermato
  almeno circa 2 mm sui quattro lati. Quiet zone sorgente esatta 2,032 mm.
- Pixel 7: prima del ritaglio lettura al primo tentativo e payload completo
  corretto, secondo conferma alla verifica dei 43 caratteri.
- Dopo ritaglio manuale lungo i trattini a 45 mm: QR ancora leggibile e
  tutto integro, confermato dall'utente. Numero di tentativi dopo il ritaglio
  non riportato separatamente; non attribuire automaticamente un tempo.
- iPhone non disponibile: prova browser su iPhone rinviata. Il successo
  precedente del campione P-touch su iPhone non vale come collaudo browser.

Prima prova singola browser su Mac/QL-810Wc/DK-11201 riuscita. Restano aperti
ripetibilità su altre copie/nomi, iPhone, Windows, QL-800 e continuo DK-22210.
Una copia browser confermata; nessuno scarto di stampa riferito, metà inferiore
rimossa per simulare il 29 × 45 mm. Tempo circa 2 secondi o meno, stimato.
Chrome rilevato 154.0.8037.99. Nessuna modifica a flussi app/DB o pubblicazione.

### Primo intervento applicativo proposto, non implementato

Prima tranche da concordare: stampa individuale manuale del QR esistente,
con anteprima separata e template condiviso nome/QR/codice basato sul campione.
Apertura autorizzata dal server, QR attivo riletto senza creazione o rotazione;
nessuna presenza registrata o modificata. Usare inizialmente profilo fisico
DK-11201 29 × 90 mm e sagoma 29 × 45 mm. Profilo continuo distinto da attivare
solo dopo collaudo reale; preservare quattro moduli bianchi nel renderer stampa.
Nomi lunghi vanno verificati senza troncamento o riduzione illimitata del font.

Sul branch panel esiste già `app/dashboard/accoglienza/group-badge-panel.tsx`:
anteprima generica con QR da 40 mm e margini da 10 mm, non adatta alla Brother
collaudata. Conservare coda, conferma operatore e ristampa esplicita esistenti;
estrarre il template stampabile condiviso, iniziando da una persona alla volta.
Il vecchio badge include anche informazioni sulle sedute cerimonie: non
rimuoverle o comprimerle implicitamente nel nuovo formato; tenere distinta
l'etichetta QR dal badge completo e concordare il raccordo in implementazione.

Stampa = apertura volontaria del dialogo; chiusura/afterprint non dimostrano
invio o uscita. Conferma fisica separata; ristampa esplicita riusa lo stesso QR
e conserva lo storico dove previsto. Riutilizzare lo stato canonico della coda,
verificando il raccordo individuale e lo scope prima di qualsiasi scrittura;
non inventare stato condiviso con localStorage o sola memoria del browser.
Lotti, richieste da telefono e deduplicazione tra postazioni restano tranche
successive. Nessuna implementazione applicativa autorizzata da questa proposta.

### Requisito successivo: lotto gruppo con etichette separate

L'utente conferma la necessità di stampare insieme i QR di tutti i membri
 di un gruppo, ciascuno su un'etichetta separata. Previsti un solo avvio,
una pagina per QR e taglio dopo ogni pagina, nel formato fisico del rotolo.
Dettaglio in docs/accoglienza-postazioni-stampa.md, aggiornamento 9 ottobre.
Nessuna implementazione avviata; necessaria prova sintetica multipagina prima
di dichiarare funzionante la stampa in lotto. Conferme fisiche ed eventuali
ristampe restano per singola etichetta, indipendenti dalle presenze.

## Pausa richiesta e punto di ripresa — 9 ottobre 2026

Collaudo browser in pausa su richiesta dell’utente. Risultati, impostazioni,
modello Brother e sorgenti sintetiche conservati. Nessuna prova ulteriore
necessaria durante la preparazione del rilascio gestionale riservato panel.

Alla ripresa il primo passo concordato è implementare il pulsante di stampa
individuale del QR esistente, senza rigenerarlo e senza registrare
 automaticamente una presenza. Il suggerimento di eseguire prima un lotto
sintetico di tre etichette è superato come ordine di lavoro, non come necessità
futura di collaudo multipagina. Lotto gruppo su etichette separate confermato.

Priorità corrente: preparazione rilascio gestionale panel in production,
senza novità nella home né apertura iscrizioni pubbliche. Nessuna pubblicazione
o migration remota eseguita o implicitamente autorizzata in questo passaggio.

### Prima uscita fisica del template applicativo — 12 ottobre 2026

- Campione sintetico `app-label-test.html`, generato dal renderer applicativo:
  José María García López, TEST-001, stesso payload sintetico di 43 caratteri.
- Supporto caricato confermato dall’utente: pretagliato 29 × 90 mm.
- L’utente conferma una sola etichetta uscita, separazione completa e nome,
  QR e TEST-001 integri. Impostazioni finali del dialogo non acquisite
  separatamente; non dedurle dal solo esito fisico.
- Ancora da verificare: misure fisiche, margini, decodifica dai telefoni,
  esito dopo ritaglio a 45 mm, tempi e ripetibilità. Nessuna presenza o
  modifica di dati applicativi deriva da questa stampa sintetica.

### Misure e letture del template applicativo — 12 ottobre 2026

- L’utente conferma lato nero del QR tra 16 e 17 mm, coerente con i
  16,764 mm previsti dal renderer; precisione da righello, non metrologica.
- Confermata distanza di 45 mm dal bordo superiore ai riferimenti laterali.
- Pixel 7: lettura al primo tentativo e restituzione del payload completo
  `test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC`, confermate dall’utente.
- iPhone: riconoscimento QR e restituzione dello stesso testo confermati;
  modello, iOS, tempo e numero di tentativi non rilevati separatamente.
- Tutte queste letture precedono il ritaglio. Controllo del bordo bianco
  e lettura dopo ritaglio ancora da effettuare.

### Esito dopo ritaglio del template applicativo — 12 ottobre 2026

- L’utente conferma circa 2 mm di bianco libero sui quattro lati del QR.
- Dopo il ritaglio manuale ai riferimenti di 45 mm, conferma nome e codice
  integri e decodifica del testo corretto sia con Pixel 7 sia con iPhone.
- Prima prova singola fisica del renderer applicativo 29 × 45 mm riuscita
  su QL-810Wc via USB, simulata sul pretagliato 29 × 90 mm. Nessun tempo
  rilevato in questa sessione; non riattribuire i 2 secondi della vecchia prova.
- Restano aperti ripetibilità, nomi diversi, lotto multipagina, continuo da
  29 mm, QL-800 e Windows. Raccordo con coda badge ancora da implementare.

### Stampa con nome lungo — 12 ottobre 2026

- Secondo campione sintetico del renderer applicativo:
  `app-label-long-name-test.html`, Alessandra Francesca Monteverdi, TEST-002.
  Payload QR di 43 caratteri invariato rispetto al primo campione, per
  confrontare l’impaginazione del nome a parità di dimensioni del simbolo.
- L’utente conferma nome completo integro e leggibile ed etichetta ben
  allineata. Decodifica e verifica dopo ritaglio di questa copia ancora aperte.
- Nessun tempo, misura aggiuntiva o esito di taglio acquisito separatamente
  per questa seconda stampa; non dedurli dal riscontro sull’allineamento.

### Esito del campione con nome lungo dopo ritaglio — 12 ottobre 2026

- L’utente conferma decodifica del payload corretto su Pixel 7 e iPhone
  anche prima del ritaglio della copia Alessandra Francesca Monteverdi / TEST-002.
- Dopo ritaglio manuale a 45 mm, entrambi i telefoni leggono il QR;
  nominativo completo e TEST-002 restano integri, confermati dall’utente.
- Due campioni diversi del renderer applicativo ora verificati fisicamente,
  con nome accentato/doppio cognome e nome lungo. Non risultano tempi o
  numero di tentativi separati per il secondo campione.
- Prossima prova hardware: tre copie consecutive del campione TEST-002,
  per verificare ripetibilità, allineamento e separazione dopo ciascuna pagina
  fisica da 90 mm. Questa prova non certifica un lotto applicativo con QR
  distinti né lo stato della coda badge.

### Tre copie consecutive — uscita fisica confermata, 12 ottobre 2026

- Campione nome lungo Alessandra Francesca Monteverdi / TEST-002, tre copie
  richieste nella prova di ripetibilità sul pretagliato 29 × 90 mm.
- L’utente conferma esattamente tre etichette uscite, tutte separate,
  ben allineate e con nome, QR e codice integri.
- Decodifica di ciascuna delle tre nuove copie ancora da verificare;
  non estendere automaticamente l’esito della copia precedente.
- Sono cinque le etichette fisiche confermate in questa sessione (due
  campioni singoli e tre copie); nessuno scarto riferito. Tempi non rilevati.
  Non è una prova di lotto applicativo con persone/QR distinti.

### Prima uscita corretta dopo calibrazione silenziosa — 12 ottobre 2026

- L’utente conferma una sola etichetta TEST-003 uscita, stampa allineata,
  taglio corretto e nome, QR e codice integri.
- Esito riferito dopo selezione e salvataggio nel profilo Chrome del formato
  reale 29 × 90 mm esposto dal driver. La prima uscita errata a 12 × 12 mm
  resta documentata come prova fallita, con quattro scarti riferiti.
- Ancora da acquisire esplicitamente: assenza di dialoghi/conferme oltre
  al singolo clic, decodifica della nuova copia e risultato dopo ritaglio.
  Non dichiarare concluso il collaudo della stampa silenziosa sulla sola
  integrità visiva dell’etichetta. Nessuna conferma di presenza o coda badge.

### Comportamento dell’interfaccia nella stampa silenziosa — 12 ottobre 2026

- Alla domanda sul singolo clic senza altre conferme, l’utente risponde sì.
  Riferisce una finestra che appare molto brevemente in alto a Chrome e
  scompare automaticamente; durata percepita inferiore a 2 ms, non misurata.
- Acquisito il funzionamento senza ulteriori interventi dell’operatore;
  non descriverlo come assenza assoluta di una finestra visibile. Il breve
  passaggio è coerente con l’anteprima chiusa automaticamente dalla modalità
  Chrome configurata. Lettura e ritaglio della copia TEST-003 ancora aperti.

Verifica finale in sola lettura della coda: ultimo lavoro Brother 9,
media=29x90mm, copies=1, stato completed, una pagina e un foglio completati.
Questa evidenza è coerente con l’uscita fisica corretta confermata dall’utente;
non sostituisce il controllo di leggibilità svolto con i telefoni.

### Seconda identità dalla dashboard Manager — Bruno, 12 ottobre 2026

- L’utente riferisce stampa corretta dell’etichetta di Bruno Test Accoglienza
  e decodifica di un payload diverso da quello di Alba.
- Confronto in sola lettura: il testo fornito coincide esattamente con
  l’ultimo QR attivo preesistente di Bruno Test Accoglienza / LPO2, nell’evento
  staging corrente. Payload non copiato nel verbale.
- Acquisito il corretto abbinamento della seconda identità stampata dalla
  dashboard Manager. Non dedurre telefono, tempi, ritaglio o numero di copie
  dal solo riscontro di stampa corretta. Nessuna modifica al QR o alle presenze.
