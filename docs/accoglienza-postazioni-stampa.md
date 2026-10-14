# Accoglienza con postazioni e stampa QR

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

## Decisione definitiva sul formato — 12 ottobre 2026

Formato approvato dall’utente: **29 × 45 mm**. Questa decisione supera tutte
le precedenti alternative e indicazioni di formato ancora da scegliere.
Resta da collaudare il supporto continuo da 29 mm e il suo taglio a 45 mm;
le prime prove riuscite simulavano la sagoma ritagliando DK-11201 29 × 90 mm.
Ripresa dello sviluppo e delle prove sul branch panel, iniziando dal pulsante
per la stampa individuale del QR esistente.

Linee guida concordate l'8 ottobre 2026. Direzione quasi definitiva approvata
dall'utente; dettagli tecnici, formato e interazioni da collaudare. Questo
documento descrive il progetto futuro, non certifica funzionalità già presenti.

## Registro generale e operazioni

La presenza registrata dal telefono appartiene al sistema generale dell'evento,
anche quando il telefono è associato a una postazione. La postazione è una vista
operativa dello stesso dato. Modifiche dal telefono e dal PC devono propagarsi
alle altre viste e ai conteggi pertinenti.

- Il QR del partecipante identifica la persona usando il QR esistente, senza
  creazione o rotazione per la stampa. Non confonderlo col QR della postazione.
- Conservare distinti scansione, presenza confermata e richiesta di stampa.
  Definire in implementazione se la scansione valida conferma direttamente
  l'arrivo o richiede un gesto esplicito, mostrando sempre l'esito del salvataggio.
- Dal PC gli operatori autorizzati possono registrare, modificare e annullare
  presenze, oltre ad aprire la scheda e apportare le modifiche consentite dal ruolo.
  La matrice esatta dei permessi va verificata nel sistema esistente: questa
  decisione non concede automaticamente ai volontari tutti i permessi Manager.
- Annullare una presenza non elimina l'iscrizione. Distinguere presenze effettive
  da presenze previste/dichiarate, e ingresso generale da accesso a un panel.
- Conservare storico di attore, momento e operazione. Scansioni ripetute non
  duplicano presenze; modifiche concorrenti non devono sovrascriversi in silenzio.
- Una ristampa non registra un nuovo ingresso. Nessuna ristampa implicita a ogni
  scansione ai panel. Presenza salvata resta tale se la stampa fallisce.

## Collegamento agile dei telefoni

Ogni PC apre una postazione nominata (esempio: Ingresso A), associata a una
stampante. Mostra un QR di collegamento e un link equivalente. Più telefoni
possono aprire quel link, autenticarsi se necessario e confermare l'associazione.

Il link seleziona la postazione, non attribuisce il ruolo di accoglienza.
Sul telefono mantenere visibili nome del banco, Cambia postazione e Scollegati.
Il PC vede i telefoni associati e può revocare i collegamenti e rigenerare il QR.
Durata e revoca dei token di associazione restano da definire.

L'associazione è applicativa, non un abbinamento Bluetooth o Wi-Fi alla Brother.
Nel flusso online telefono e PC possono usare connessioni Internet diverse;
la stampante può essere collegata al PC via USB. Non presumere funzionamento
offline: indisponibilità e richieste pendenti devono essere esplicite.

## Vista della postazione fissa

- Arrivi/scansioni recenti in ordine cronologico, più recenti in alto,
  aggiornati automaticamente senza ricercare la persona già scansionata.
- Ora, nominativo, gruppo, stato presenza e stato stampa; origine utile per
  distinguere i telefoni e contesto evento/panel sempre esplicito.
- Ricerca manuale e apertura scheda; gestione presenze e modifiche autorizzate.
- Pulsanti Stampa QR code e Ristampa con template predefinito e dati aggiornati.
- Per impostazione operativa, elenco della propria postazione; una vista
  complessiva per il coordinamento è un'estensione da valutare con i permessi.

La coda di stampa deve evitare duplicati da doppio tocco, retry o concorrenza.
Mostrare Inviata alla stampante solo quando giustificato dal canale di stampa;
non dichiarare Stampata senza riscontro affidabile. La finestra del browser,
da sola, non certifica l'uscita fisica. Cancellazioni della presenza richiedono
gestione esplicita degli eventuali lavori ancora in attesa; i badge già prodotti
restano separati dal dato di presenza.

## Stampa anticipata dall’interfaccia Manager

Requisito aggiunto dall'utente l'8 ottobre 2026: il Manager deve poter stampare
i QR prima dell'arrivo dei partecipanti, anche in lotti per gruppi numerosi.
La stampa anticipata non richiede una scansione di accoglienza né una presenza
registrata e non modifica presenze effettive o previste.

Prevedere selezione individuale o multipla e per gruppo, con anteprima delle
persone incluse, quantità e formato. Rendere esplicita l'inclusione di eventuali
sottogruppi e figli accompagnati; non dedurla silenziosamente dal filtro.
Riutilizzare QR esistenti validi e autorizzati nell'evento corrente; persone
eliminate e QR revocati/scaduti non devono produrre badge utilizzabili.

Lo stato della preparazione è condiviso nel sistema generale e legato alla
singola iscrizione/evento e al QR utilizzato, non soltanto al gruppo o al PC:
all'accoglienza deve essere visibile anche se la persona arriva a un altro banco.
Mostrare l'indicazione nella scheda dopo la scansione sia sul telefono sia sul
PC e nell'elenco della postazione. Proposta di etichette UI:

- Stampa anticipata richiesta/in attesa, quando esiste solo un lavoro in coda.
- Stampa anticipata inviata - verifica etichetta disponibile, quando l'invio
  è confermato ma non l'uscita fisica.
- Etichetta già preparata, dopo riscontro affidabile o conferma esplicita
  dell'operatore che il badge è stato prodotto.
- Stampa fallita/annullata o da verificare, senza indicazione ingannevole di
  badge già disponibile.

Il messaggio operativo deve segnalare che l'etichetta dovrebbe essere già
stampata e invitare a recuperarla, senza impedire l'accoglienza o una ristampa
esplicita in caso di smarrimento o errore. Evitare una nuova stampa automatica.
Etichetta preparata, etichetta consegnata e presenza sono fatti distinti;
un'eventuale gestione della consegna non va dedotta dall'avvenuta stampa.

Per i lotti conservare esiti per persona, attore e data/ora: un successo parziale
non marca l'intero gruppo come preparato. Retry e richieste simultanee dal
Manager e dall'accoglienza usano la stessa deduplicazione/coda. Una conferma
manuale di preparazione deve poter riguardare solo le etichette realmente
prodotte. Se cambia il QR o un dato stampato, rendere evidente che il badge
precedente potrebbe non essere più valido o aggiornato, senza cancellare lo
storico. I dettagli tecnici di questi stati restano da progettare.

## Stampa e compatibilità Mac e Windows

Prima prova hardware e template, poi integrazione nel sito. Si parte dalla
Brother QL-810Wc su questo Mac, preferibilmente via USB; Wi-Fi come prova
successiva se utile. Successivamente QL-800. Conservare una procedura ripetibile
su Windows e separare template, logica di coda e adattatore di stampa locale.

Prima integrazione possibile: pulsante sul PC, etichetta precompilata e dialogo
di stampa. L'eventuale invio automatico senza dialogo richiede un componente
locale da scegliere e collaudare su entrambi i sistemi. Non equiparare stampa
da P-touch Editor/iPrint&Label a integrazione già funzionante dal browser.

Il telefono potrà chiedere una stampa alla postazione: il PC la esegue, senza
imporre collegamento diretto del telefono alla stampante. La prima versione può
lasciare la conferma al PC. Due volontari possono dividersi scansione e consegna,
ma non devono ripetere la ricerca del partecipante.

## Hardware e consumabili disponibili

- Brother QL-810Wc: USB e Wi-Fi. Prima stampante da collegare e collaudare.
- Brother QL-800: USB. Entrambe sono termiche dirette, senza toner o inchiostro.
- Due rotoli DK-11201: etichette pretagliate 29 × 90 mm.
- Due rotoli DK-22251: continuo da 62 mm, nero/rosso su bianco.
- Verificare quantità effettiva dei rotoli starter: non dedurla dal consumabile
  venduto separatamente. Per i QR usare nero su bianco e selezionare il supporto
  realmente caricato nel driver.

## Formati ancora in valutazione

Aggiornamento dopo le prove fisiche dell'8 ottobre: l'utente preferisce
orientarsi su rotolo continuo largo 29 mm, con lunghezza regolabile. Aspetto,
proporzioni e ingombro dei campioni ritagliati a 29 × 40 mm sono graditi come
compromesso tra leggibilità e consumo. Il formato finale resta da scegliere;
per payload simile ai 43 caratteri sintetici provati, valutare un QR più grande.
Prove sul DK-22251 largo/doppio rinviate rispetto a questo approfondimento.
Nessun acquisto autorizzato o consumabile continuo da 29 mm già collaudato:
la simulazione su DK-11201 non certifica avanzamento e taglio del continuo.

Chiarimento dell'utente durante il collaudo: nome e cognome sull'etichetta QR
servono agli operatori per riconoscere a chi consegnarla, senza scansionarla
o annotare nomi a mano. Il badge d'accoglienza su cui viene applicata riporta
già il nome della persona. Valutare quindi il testo per lettura ravvicinata
durante stampa, smistamento e consegna, non come nome principale leggibile
a distanza sul badge. Conservare il nominativo completo e dare priorità a
leggibilità del QR e quiet zone; formato e corpo minimo restano da collaudare.

Lo studio precedente propone singole 62 × 35 mm all'arrivo e doppie 62 × 45 mm
per gruppi anticipati, separate a mano in due etichette 31 × 45 mm; QR circa
27,8 mm incluso bordo bianco. È una proposta, non il formato finale approvato.

L'alternativa più recente è un formato unico verticale sul continuo DK-22210
da 29 mm: provare 29 × 40 mm con nome, cognome e QR circa 24 mm incluso bordo
bianco, con o senza codice leggibile. Verificare nomi lunghi senza riduzioni
automatiche illeggibili. La lunghezza può cambiare dopo il collaudo.

Esplorati anche DK-11221 quadrato 23 × 23 mm e DK-11218 tondo diametro 24 mm,
con QR più piccolo e nome; non approvati. Considerare aree stampabili effettive,
bordo bianco di quattro moduli e limiti dei nomi lunghi. Il testo curvo sul tondo
non può invadere il margine del QR.

Base quantitativa dello studio: circa 4.000 etichette, non conteggio DB verificato,
con 15% aggiuntivo per prove/scarti/ristampe. La quantità finale dipende da
formato, materiale residuo, badge dei figli e quota stampata in anticipo.

## Piano delle prime prove

1. Rilevare versione macOS e architettura, collegamenti e software già presenti.
   Verificare driver e strumenti Brother ufficiali per QL-810Wc e questo sistema.
2. Guidare l'utente nei passaggi fisici, alimentazione, caricamento e USB;
   installare/configurare solo ciò che è necessario. Rilevare la stampante.
3. Stampare un primo campione sintetico, senza dati o QR di partecipanti reali.
4. Sul DK-11201 impostare 29 × 90 mm: simulare due campioni da 29 × 40 mm lungo
   la lunghezza, rispettando i margini e ritagliandoli a mano. Non fingere che
   il pretagliato permetta taglio automatico a 40 mm. In alternativa un solo
   campione delimitato. Questa prova valida larghezza, testo e QR, non il feed
   del futuro rotolo continuo.
5. Sul DK-22251 provare singola larga e doppia, impostando il supporto nero/rosso
   corretto. Eventuali sagome piccole ritagliate simulano l'ingombro, non
   certificano compatibilità con i consumabili pretagliati reali.
6. Provare nome breve, doppio cognome e caratteri delle lingue utilizzate;
   verificare dimensioni con righello, stampa senza adattamento, scansione coi
   telefoni previsti, badge applicato e tempi complessivi. Un lettore generico
   può verificare la decodifica di un token sintetico, non l'accoglienza reale.
7. Provare una stampa dal browser separatamente dal software Brother. Annotare
   dialoghi, formato, orientamento, scaling e impostazioni persistenti.
8. Registrare risultati e impostazioni ripetibili in questo documento o in un
   runbook collegato. Poi scegliere consumabile e progettare l'integrazione.

Nessuna installazione, stampa fisica o modifica applicativa è stata eseguita
nell'attività di salvataggio di queste linee guida. Non modificare produzione,
presenze reali o QR reali per le prove; non serve acquistare rotoli prima del
primo collaudo. Il setup Windows sarà verificato quando disponibile, senza
dichiararlo testato sulla base del solo Mac.

## Riferimenti

- [Brother DK-11201](https://store.brother.it/supplies/label-printers/labels/dk/dk11201)
- [Brother DK-22251](https://www.brother.com.au/en/supplies/supplies-detail/dk-22251)
- [Specifiche QL-810W e QL-810Wc](https://support.brother.com/g/b/spec.aspx?c=gb&lang=en&prod=lpql810weuk)
- [Brother riferimento raster e aree stampabili](https://download.brother.com/welcome/docp100278/cv_ql800_eng_raster_101.pdf)
- [DENSO dimensionamento e margini QR](https://www.qrcode.com/en/howto/code.html)

Il PDF `output/pdf/proposta-stampa-etichette-qr.pdf` è lo studio del 6 ottobre
con le prime opzioni; queste linee guida includono anche gli sviluppi discussi
successivamente. Output e campioni non sono documentazione versionata.

## Stampa collettiva su etichette separate — 9 ottobre 2026

Chiarimento esplicito dell'utente dopo la prima prova browser riuscita:
deve essere possibile stampare insieme i QR di tutti i membri di un gruppo,
con un'etichetta separata per ciascun QR personale. Un solo avvio del lotto,
pagine/etichette distinte in sequenza e taglio tra le etichette secondo il
supporto fisico collaudato. Non impaginare tutti i QR su una sola etichetta.

Conservare anteprima, numero di etichette, esiti per persona, conferma fisica
separata e ristampa puntuale delle sole etichette necessarie. Il dialogo chiuso
non conferma tutto il lotto; nessuna presenza registrata dalla stampa.
Per lo scope valgono le decisioni panel correnti: gruppo selezionato senza
sottogruppi; minori collegati al QR del genitore, senza creare QR autonomi.
La dicitura operativa deve esplicitare persone incluse e numero dei QR stampabili,
segnalando QR mancanti/revocati/scaduti senza omissioni silenziose.

Requisito confermato, implementazione e prova fisica multipagina ancora da
concordare. La singola etichetta browser collaudata non certifica il lotto.
