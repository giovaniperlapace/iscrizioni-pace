# Accoglienza da PC con NetumScan NSL5 — 15 ottobre 2026

## Decisione e ambito

Due NSL5 2D collegati ai computer delle stampanti sostituiscono il progetto
telefono associato alla postazione per l’accoglienza all’evento. Il flusso
non richiede accoppiamento, servizio di collegamento locale, trasmissione del
QR da un telefono o aggiornamento periodico di una coda remota.

Il telefono resta previsto per gli ingressi e il conteggio a inaugurazione,
cerimonia finale e Forum. In questa tranche il motore degli accessi Forum/sala
resta quello esistente; non viene realizzata una nuova scansione delle cerimonie
né si attestano collaudi precedentemente aperti. Il pilot rimane solo Admin,
con gli stessi controlli della Server Action e del DB. Home/internal, iscrizioni
pubbliche chiuse e ruoli restano invariati.

## Flusso implementato

1. Aprire Accoglienza → Ingresso evento sul PC della stampante.
2. Lo scanner USB legge il token personale oppure il QR gruppo `G:` e termina
   con Invio. La scheda verificata mostra le persone e le presenze correnti.
   **La lettura non registra alcun ingresso**, neppure per il singolo.
3. **Registra presenze** apre la selezione esplicita: nessuno è preselezionato
   come nuovo presente. Gli ingressi già registrati restano validi. Scuole:
   quantità esplicite di studenti/accompagnatori, come nel flusso precedente.
4. **Modifica presenze** rilegge i dati e permette correzione e annullamento,
   con la conferma esplicita già prevista. Deselezionare un ingresso esistente
   in correzione lo annulla; un ingresso non registrato non è un’assenza dichiarata.
   Escape/Chiudi prima del salvataggio conservano la scheda senza scritture.
5. **Stampa etichetta QR** oppure **Stampa i QR del gruppo** usa la coda canonica
   e il renderer già esistenti. Nel gruppo nomi/codici, selezione e Seleziona tutte
   sono disponibili. La selezione di stampa è indipendente dalle presenze; i
   minori mantengono il QR del genitore. La stampa non scrive ingressi o token.
6. **Passa al prossimo codice** chiude la scheda e riabilita la lettura. Le altre
   scansioni sono ignorate durante la scheda, il salvataggio, la selezione o la
   stampa. Il terminatore HID non può azionare il pulsante che ha il focus.

Inserimento manuale conservato per codice personale a quattro caratteri o token
QR esatto. Nessun URL ammesso; mai correzioni automatiche di maiuscole o simboli
nel token QR. Il codice pubblico manuale viene normalizzato dal parser esistente.

Le informazioni restano solo nella memoria della pagina. Nessun QR in URL,
log o storage del browser; ultime 15 letture svuotate ricaricando. Errori/revoca
rimuovono la scheda; esito incerto blocca altre operazioni e consente soltanto
il retry della stessa richiesta, con lo stesso UUID per le scritture.

## Configurazione per ciascun computer

Il produttore documenta il modello L5/NSL5 con interfaccia USB-HID e USB COM.
Per questo flusso scegliere **USB-HID/tastiera**, non seriale, e terminatore
**Enter/CR**. Il ricevitore accetta anche il secondo Invio ravvicinato di CRLF.
Layout della tastiera del lettore coerente con quello del sistema operativo:
verificare soprattutto `G:`, lettere maiuscole/minuscole, `_` e `-` con soli QR
sintetici. Non applicare conversioni di maiuscole o prefissi aggiuntivi.
La dicitura “Scanner USB pronto” indica che la pagina accetta letture: il browser
non identifica il dispositivo fisico e non certifica che il lettore sia collegato.

Procedura, codici di configurazione e revisione del manuale da verificare sul
lettore effettivo, senza ripristino di fabbrica implicito:

- [NETUM L5, scheda ufficiale e manuali](https://www.netum.net/es/products/nsl5-2d-barcode-scanner-handheld-qr-bar-code-reader-imager-pdf417-qr-data-matrix).
- [Manuale NSL5/L5 indicizzato dal produttore](https://netumtech.com/user-manual/).
- [Manuale L5 del produttore](https://cdn.shopify.com/s/files/1/2144/8019/files/L5_User_Mnaual-2022.8.pdf?v=1660983587).

Configurare la stampante su ciascun PC secondo
[collaudo DK-22210](collaudo-dk22210-2026-10-15.md): continuo 29 × 45 mm,
taglio per pagina, calibrazione visibile e poi Chrome dedicato per la stampa
silenziosa. Lo scanner non configura la stampante e il sito non abilita da solo
la stampa silenziosa. Windows è una destinazione principale da collaudare.
La pagina deve essere attiva; i tasti HID non raggiungono il sito se il focus è
nella barra indirizzi, in un’altra app o in un dialogo nativo di stampa.

## Collaudo fisico Mac — 15 ottobre 2026

L’utente autorizza il collaudo di un NSL5 sul Mac attuale, poi sul PC Windows
che ha accanto. Mancano due adattatori USB-C: la Brother viene scollegata per
collegare il lettore. Non attestare in questa condizione il percorso simultaneo
scanner + stampante sul Mac, né inviare lavori a una stampante scollegata.

La copia locale isolata ospita `/collaudo-scanner`, con console, sessione,
servizi di reception/stampa e RPC originali. Adattatore Auth/trasporto locale
con Admin sintetico e PostgreSQL temporaneo, senza credenziali o dati remoti.
Tre nuove identità sintetiche NS01–NS03; QR individuali e QR gruppo esatti,
contenenti maiuscole/minuscole, `_` e `-`. Il singolo è Ada Mori / NS01.
La prova non equivale al login del sito pubblicato. Nessuna presenza preesistente
per questi campioni; il controllo read-only iniziale conferma zero ingressi.

Dopo lo scambio delle periferiche, IOUSB elenca `DM13 USB KBW`, vendor
`Newland Auto-ID`, idVendor 7851 e idProduct 7427. Il modello commerciale NSL5
è quello indicato dall’utente; la stringa USB da sola non prova marca/revisione.
Il Mac usa `com.apple.keylayout.Italian-Pro`.

Prima scansione fisica: l’app mostra “Codice non valido o iscrizione non
disponibile per questo evento”, confermato dall’utente. Nessuna RPC di ingresso
eseguita. Il controllo diagnostico successivo, sempre con il medesimo campione
sintetico, riceve 43 caratteri ma `_` diventa `?` e `-` diventa apostrofo; le
lettere coincidono. L’utente conferma “Caratteri diversi dal QR”.

Il manuale ufficiale L5/NSL5 V18.7.12 indica tastiera americana di default e,
a pagina 3 del PDF, il comando **Italy Keyboard `606010D`**. Mostrato soltanto
il ritaglio originale di quel codice, senza ripristino di fabbrica e senza
cambiare il layout del Mac o indebolire il parser dei token. Dopo la lettura
del comando, l’utente conferma “Lettura esatta”; la pagina mostra 43 caratteri
coincidenti senza differenze, compresi `_` e `-`.

La successiva scansione fisica singola apre Ada Mori / NS01 senza ingresso,
confermato dall’utente e dalla sola RPC inspect. L’utente registra poi la
presenza del singolo; la RPC enter risponde saved. Una richiesta di stampa
locale risulta acquisita nel registro, ma non ha prodotto un lavoro CUPS in
attesa: nessuna etichetta fisica attestata in questa prova. L’agente verifica
l’annullamento con la UI originale: RPC cancel saved, zero presenze attive.

La scansione fisica del QR gruppo, incluso G:, apre le tre persone senza
registrare ingressi, confermato dall’utente. L’utente apre la selezione e registra
tutte e tre; RPC group enter saved. L’agente corregge tramite la UI con
conferma, lasciando Ada e Bruno presenti e Carla deselezionata: RPC correct saved,
UI e query read-only concordano su NS01=1, NS02=1, NS03=0. La selezione di stampa
rimane indipendente dalle presenze. Nessun dato di production/staging coinvolto.

Lettura e operazioni di presenza sul Mac verificate con un NSL5 su schermo;
stampa fisica simultanea e lettura di etichette cartacee ancora aperte. Avviata
la preparazione Windows tramite proxy temporaneo LAN limitato alla pagina
sintetica e ai suoi asset/azioni, con URL casuale e cookie; percorsi estranei
rifiutati (es. dashboard/admin: 404). Il database resta sul Mac e il test non
è una prova del sito pubblicato o dell’accesso Admin Windows. Nessun progetto
o software installato sul PC da questa preparazione.

Aggiornamento dell’utente: la pagina sul PC Windows non si apre; il PC è
collegato via Ethernet. Sul PC sono collegati uno scanner e una **Brother
QL-800**, distinta dalla QL-810Wc provata sul Mac. Non assumere driver,
calibrazione, consumabile o capacità Windows sulla base dei risultati Mac.
La rete attiva del Mac è Wi-Fi; Ethernet Mac inattiva. Servizio di collaudo
in ascolto sull’indirizzo Wi-Fi, risposta locale HTTP 200; nessun blocco del
firewall Mac rilevato. Richiesti IPv4/gateway Ethernet Windows e messaggio di
Chrome prima di modificare configurazioni di rete. Nessuna impostazione di
rete o firewall modificata.

Fonte per la futura configurazione Windows:
[Brother QL-800, supporto italiano](https://support.brother.com/g/b/producttop.aspx?c=it&lang=it&prod=lpql800euk).
Versione Windows, driver installato e rotolo caricato ancora da acquisire.

Il PC Ethernet riferito dall’utente ha IPv4 10.10.5.151, distinto dalla rete
Wi-Fi del Mac 192.168.30.x; il tentativo ICMP dal Mac non ha ricevuto risposta.
L’utente collega il PC anche al Wi-Fi e conferma poi l’apertura della pagina.
Nessun gateway o firewall modificato. Connessione LAN effettiva successiva
osservata da 192.168.30.186 e richieste con user agent Windows.

Primo accesso LAN: il contenuto si vede ma il pulsante non reagisce, confermato
dall’utente. Anche nel browser di verifica Mac: errori WebSocket del canale di
sviluppo Next, comandi non attivi. Preparata nella sola copia temporanea una
build production Webpack con directory separata e server solo loopback; proxy
sullo stesso URL limitato come prima. Nessuna pubblicazione Vercel o modifica
all’app in produzione. La fixture LAN include un fallback UUID v4 con
crypto.getRandomValues per il solo HTTP locale, senza cambiare il codice
applicativo da pubblicare. Verificati pulsante manuale e lettura originale
fino al DB attraverso il proxy, senza scritture alle presenze.

Dopo Ctrl+F5 l’utente conferma la lettura fisica del QR Ada Mori / NS01 sul
PC Windows. Il log registra richieste Windows HTTP 200 e RPC inspect valid;
nessun nuovo ingresso automatico. L’utente conferma **DK-22210 continuo 29 mm**
montato sulla QL-800. Inizialmente QL-800 assente nell’elenco stampanti Windows.
L’utente riporta da msinfo32 Windows 11 Home e PC basato su x64, poi conferma
Editor Lite spento. Fornite le istruzioni e il collegamento ufficiale Brother
per installazione USB su Windows 11; l’utente conferma successivamente che
Brother QL-800 compare nelle stampanti Windows. Restano da configurare/verificare
continuo 29 × 45 mm e taglio dopo ogni etichetta; nessuna stampa fisica, taglio
o stampa silenziosa Windows ancora attestati.
Richieste di stampa applicative osservate durante le prove dell’utente non
sono una conferma dell’uscita fisica; snapshot sintetico di registrazioni,
token e ingressi acquisito prima del successivo collaudo stampa.

Windows: lettura singola confermata, stampa e prova completa ancora aperte.
Il manuale
è reperito dalla fonte ufficiale già collegata sopra; il PDF e i ritagli sono
materiale temporaneo locale, non inclusi nel codice da pubblicare.

## QL-800 sul Mac e stampa silenziosa del 16 ottobre

L’utente sposta la QL-800 sul Mac attuale. La periferica è rilevata via USB,
ma inizialmente esiste solo la coda della QL-810W. Dopo l’installazione del
driver ufficiale Brother 4.0.4a da parte dell’utente, aggiunta Brother_QL_800
con driver QL-800 CUPS, formato Custom.29x45mm, BrTapeLength=45, una copia,
BrAutoTapeCut=ON e BrCutLabel=1. Impostata come destinazione predefinita
dell’utente. Coda QL-810W e suo precedente lavoro pendente conservati.

Prova dal campione sintetico Ada Mori / NS01, console e renderer originali:
l’utente seleziona QL-800 e carta DK-22210 29x45 mm nel dialogo Chrome normale.
Controllati una copia, scala 100% e margini nessuno. Job 24 completato;
l’utente conferma una sola etichetta corretta e completamente separata.

Su richiesta di usare le normali schede Chrome senza collegamento speciale,
preparato un profilo locale per l’utente, contenente soltanto
SilentPrintingEnabled e PrintPreviewUseSystemDefaultPrinter, entrambi true.
L’utente lo installa; valori verificati nella preferenza gestita dell’utente.
Un nuovo clic sul pulsante originale nella scheda sintetica del Chrome normale
raggiunge la QL-800. L’utente conferma uscita senza dialogo e precisa di avere
premuto anch’egli il pulsante durante la prova. Job 25 e 26 completati, nessun
lavoro QL-800 pendente al controllo. Non attribuire quindi tutta la sequenza a
un unico clic isolato. Nessun’altra stampa avviata dopo la conferma.

Esito silenzioso positivo per questo Mac/Chrome/QL-800/DK-22210. Restano da
verificare lettura del QR cartaceo, lotto QL-800, riapertura del browser e
altre schede/profili. Questo esito non completa il collaudo Windows. Nessun
comando su dati production, email o modifica del codice applicativo.

## Verifiche e limiti

- Test di sessione: nessuna scrittura alla lettura per singolo, famiglia, gruppo,
  scuola o persona già presente; scheda conservata fino al prossimo codice,
  annulla selezione senza scrittura, conferma esplicita e retry di sola lettura.
- Input HID: payload esatto, Invio, CRLF, scansioni incomplete/oversize, pausa,
  buffer cancellato su perdita focus/visibilità; tasti ordinari di navigazione.
- Browser Chrome con fixture sintetica e componenti originali: stampa prima
  della presenza, singolo, gruppo con selezioni diverse di stampa/presenza,
  doppio clic, ingresso e annullamento, Escape, blocco scansioni a scheda aperta,
  quantità scuola, QR estranei, revoca, retry con stesso UUID, fallback manuale,
  desktop/mobile, nessun errore runtime o iframe residuo. Stampa simulata.
- Regressioni browser della fotocamera preesistente e 893 test applicativi,
  lint/TypeScript e build in copia pulita. SQL e concorrenza su PostgreSQL temporaneo
  verificano le RPC canoniche e la conservazione di iscrizioni, QR e presenze
  durante la stampa; non è un test browser con login production.

Comandi: `node --test tests/usb-reception.test.mts`, `TZ=Europe/Rome npm test`,
`npm run lint`, `npm run typecheck`, `node tests/sql/run-reception-checks.mjs`;
con server locale sintetico, `node tests/browser/usb-reception.mjs` e
`node tests/browser/reception-playwright.mjs http://127.0.0.1:3172`.
Il modulo Playwright può essere fornito con `PLAYWRIGHT_MODULE`.
Le fixture temporanee di route vanno usate senza eseguire contemporaneamente
la suite che controlla gli slug riservati, quindi eliminate prima della build.

Un NSL5 fisico sul Mac è ora verificato per lettura su schermo e operazioni
di presenza, con i limiti del verbale sopra. La lettura singola sul PC Windows è confermata, ma identificazione dei due
lettori distinti, lettura su etichetta, stampa e prova completa della
postazione Windows restano da verificare. Nessun dato reale,
email, configurazione hardware, migration remota, commit/push o deployment
eseguito per questa tranche. Le modifiche stampa del 15 ottobre già presenti
nella working tree restano conservate; la relativa migration locale di stampa
non viene applicata da questo lavoro. Nessuna nuova migration per lo scanner.


## Rilascio production riservato agli Admin — 16 ottobre 2026

L’utente richiede la pubblicazione delle funzioni di accoglienza: lettura con
scanner USB del QR mostrato sul telefono e stampa dell’etichetta sul badge.
Il rilascio su main include la preparazione USB precedentemente conservata
in locale e mantiene stampa individuale/gruppo, selezioni e conteggio richieste
già pubblicati. Aggiornato l’avviso della dashboard per l’uso operativo Admin.

Controllo production senza scritture applicative, concluso in rollback:
undici migration necessarie già registrate, 4 Admin abilitati, 12 account
non Admin esclusi dai controlli di accoglienza e dalla RPC di stampa.
La coda di stampa resta service-only; modalità internal e catalogo pubblico
vuoto conservati. Nessuna nuova migration, email, richiesta di stampa reale
o modifica a iscrizioni, QR e presenze eseguita dall’agente.

Una prima asserzione diagnostica cercava erroneamente nella funzione stampa
la chiamata al gate condiviso: la funzione applica invece direttamente il
controllo Admin e dell’evento corrente. Ispezionata la definizione reale e
verificato il rifiuto dei non Admin chiamando la RPC prima di qualunque
lettura di iscrizioni. Nessuna modifica al codice DB necessaria.

I test browser USB usano ora il nome accessibile del checkbox, indipendente
dal conteggio stampe aggiunto successivamente. L’assenza di selettori di
formato è verificata nei pannelli stampa, senza includere il selettore della
lingua nella testata del sito. Le route sintetiche vengono create soltanto
nella copia locale isolata e rimosse prima della build da pubblicare.

Il rilascio non certifica la stampa QL-800 Windows: formato continuo
29 × 45 mm, taglio per etichetta e stampa silenziosa restano da collaudare.

Verifiche del rilascio: 893 test superati, lint completo, TypeScript,
SQL/concorrenza su PostgreSQL temporaneo e build production con `npm ci`
in copia pulita. Browser Chrome sintetico: flusso USB desktop/mobile,
regressioni fotocamera, stampa individuale/gruppo e conteggi condivisi;
nessun errore runtime nei test conclusi. Stampa simulata. Il confronto di
826 file applicativi/test/configurazione conferma che la build locale usa
gli stessi sorgenti destinati al commit. Le suite browser che creano route
temporanee sono eseguite separatamente, evitando reload reciproci di Next.

Target verificato: progetto Vercel `iscrizioni-pace`, branch `main`, ambiente
`production`, dominio `https://registrationspeace.santegidio.org`. Il push
avvia il normale deployment Git; la verifica del relativo stato e del dominio
conclude il rilascio.
