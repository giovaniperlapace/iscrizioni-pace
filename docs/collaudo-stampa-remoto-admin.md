# Collaudo remoto Admin: scanner ed etichette

## Stato del 14 ottobre 2026

Sviluppo richiesto su `main`, integrando il panel senza eliminarlo. Nuove
funzioni di stampa e scanner riservate all’Admin, anche da chiamate dirette.
L’Admin usa la dashboard Accoglienza già prevista tra le sue dashboard.
Manager e altri ruoli non ricevono il nuovo flusso in questa tranche.
Il modello di autorizzazione futuro del panel rimane nel codice e nei test.
Le nuove pagine cerimonie/QR gruppo importate sono ugualmente riservate al
collaudo Admin; nessuna apertura pubblica implicita.

Rilascio su main e migration successivamente autorizzati dall’utente il
14 ottobre. Le dieci migration necessarie sono applicate in production;
merge `384f58a` pubblicato, deployment production READY verificato sul dominio
`https://registrationspeace.santegidio.org`, senza apertura pubblica. Nessuna
email, account o ruolo creati. Il collaudatore disporrà di un account Admin;
macOS e probabilmente Windows disponibili. Stampante indicata dall’utente
come «Brother Wc810»: controllare la targhetta QL-810Wc prima del setup.
Collegamento e rotolo caricato non ancora confermati. La stampante non è
presso chi sviluppa. Non attestare alcuna prova fisica di questa tranche.

Consumabile acquistato confermato: **DK-22210**. La scheda ufficiale Brother
lo identifica come carta continua bianca, larghezza 29 mm, compatibile con
QL-810W/810Wc: [scheda del consumabile](https://store.brother.it/supplies/label-printers/labels/dk/dk22210).
Questo verifica le specifiche del codice, non il contenuto della stampante.
Pagina candidata 29 × 45 mm: formato del driver, margini, avanzamento e taglio
richiedono ancora la prova reale.

## Prima attivazione su un altro computer

1. Verificare che il deployment main della tranche sia READY sul dominio
   `https://registrationspeace.santegidio.org`. La pubblicazione è autorizzata;
   modalità internal e limitazione Admin devono restare attive.
2. Registro/schema e backup verificati prima delle dieci migration production;
   vedere il verbale di integrazione. Lo staging non è stato riallineato da
   questa pubblicazione: prima del collaudo dello scanner verificare anche
   le sue migration e la versione applicativa, senza usare dati reali.
3. Confermare accesso Admin, computer, sistema, versione Chrome, modello
   esatto, driver, USB/rete, codice/larghezza del consumabile e rotolo montato.
   Per oggi iniziare preferibilmente dal Mac; Windows rimane prova distinta.
4. Il collaudo operativo passa dai pulsanti reali: Stampa etichetta QR nella
   scheda Admin e Stampa i QR del gruppo nella gestione gruppi. Usare iscrizioni
   sintetiche/staging con QR già esistenti. La pagina
   `/dashboard/admin/stampa-qr/collaudo` rimane uno strumento ausiliario per
   la sola calibrazione della carta, senza passaggio obbligatorio.
5. Lo scanner operativo è disponibile solo con migration di attivazione
   presente. Registra realmente ingressi: provarlo solo su dati sintetici e
   staging. Non scansionare partecipanti reali o i campioni di calibrazione
   per una semplice verifica della leggibilità dell’etichetta.

Il ruolo Admin è necessario per l’applicazione; configurare un browser
silenzioso non attribuisce permessi e il sito non può impostare tale modalità.
Nessuna credenziale o profilo Chrome deve entrare nel repository.

## Profili separati e calibrazione

- `continuous-29x45`: continuo 29 mm, pagina fisica 29 × 45 mm, senza riferimenti
  di ritaglio; codice a Y=39 mm, QR e nominativo completi.
- `die-cut-29x90`: pretagliato DK-11201 29 × 90 mm, contenuto approvato 29 × 45 mm
  e riferimenti di ritaglio manuale. Geometria preesistente conservata.
- Il vecchio launcher e il profilo del 12 ottobre non vengono riconfigurati.
  Il nuovo `tools/brother-browser-test/launch-label-workstation.mjs` usa cartelle
  distinte per i due profili e non modifica i default della stampante.

Prima calibrare senza `--kiosk-printing`. Quando si apre il dialogo,
comunicare insieme **tutte** le impostazioni:

| Impostazione | Continuo | Pretagliato |
| --- | --- | --- |
| Destinazione | Brother confermata | Brother confermata |
| Formato reale del driver | 29 × 45 mm | 29 × 90 mm |
| Orientamento | Verticale | Verticale |
| Copie / pagine | 1 / tutte | 1 / tutte |
| Scala | Personalizzata 100% | Personalizzata 100% |
| Margini | Nessuno | Nessuno |
| Intestazioni / piè di pagina | Disattivati | Disattivati |
| Pagine per foglio / fronte retro | 1 / disattivato | 1 / disattivato |
| Brother: taglio | Dopo ogni pagina | Dopo ogni pagina da 90 mm |

Se il formato da 45 mm non è realmente esposto dal driver, fermarsi e definire
il formato personalizzato supportato dopo aver verificato driver e supporto.
Non inventare il vendor_id né limitarsi a inserire larghezza/altezza nelle
preferenze Chrome: il primo collaudo precedente aveva usato 12 × 12 mm e
prodotto quattro scarti. Verificare l’opzione realmente selezionata, annullare
senza stampare, riaprire e controllare persistenza e paginazione.

Il launcher Mac accetta dati espliciti, da raccogliere prima di usarlo:
`--profile=continuous-29x45`, `--printer=<nome_coda>`,
`--driver-paper=<opzione_reale>`, `--loaded-roll=DK-22210`,
`--hardware-confirmed`, `--url=<URL_app_senza_parametri>` e `--calibrate`.
Dopo aver chiuso il browser dedicato, togliere `--calibrate` e aggiungere
`--chrome-paper-id=<vendor_id_verificato>` per l’avvio silenzioso. Controlla
carta reale/destinazione/copie/scala/margini/orientamento/intestazioni e taglio
prima dell’avvio. Non prova la presenza fisica della stampante o il risultato.
Il launcher è per macOS: non dichiararlo compatibile o collaudato Windows.

## Ordine delle prove fisiche, una alla volta

1. Aprire la scheda Admin di un partecipante sintetico con QR attivo esistente.
   Scegliere la carta effettivamente caricata e confermare le impostazioni.
   Una sola pressione di **Stampa etichetta QR**. Attendere il riscontro
   dell’operatore su quantità uscita, separazione, allineamento, nome/QR/codice.
2. Misurare larghezza e lunghezza dell’etichetta, margini e nero QR atteso
   circa 16,8 mm; sorgente con quiet zone esatta di quattro moduli. Nessun
   ritaglio manuale sul continuo. Leggere con Pixel e iPhone e verificare il
   testo completo, senza utilizzare lo scanner operativo dell’app.
3. Ripetere dalle schede di prova con nome lungo, internazionale e cirillico,
   ciascuna con il proprio QR esistente. Non troncare i nominativi né
   creare/ruotare token per ottenere un’etichetta.
4. Solo dopo conferma della singola, usare **Stampa i QR del gruppo** su un
   gruppo sintetico: leggere elenco e quantità prima dell’avvio. Iscrizioni
   eliminate assenti anche dai conteggi; annullate o con QR non valido
   indicate come non stampabili. Sottogruppi esclusi, figli sul QR genitore.
   Con quattro persone stampabili verificare un avvio, quattro etichette,
   quattro tagli e ciascun abbinamento/QR su entrambi i telefoni.
5. Premere **Conferma etichetta** solo per le copie realmente uscite corrette.
   Il messaggio dopo la stampa chiede il controllo e non conferma l’uscita.
6. Interrompere un lotto, riaprire su un’altra sessione/postazione e premere
   **Aggiorna elenco**: le etichette incerte restano da controllare.
   Ristampare esplicitamente soltanto le copie mancanti o rovinate.
7. Prima dell’accettazione P14, provare almeno 30 etichette consecutive;
   il lotto iniziale da quattro non conclude la milestone.
8. Provare due richieste concorrenti, perdita di risposta, stampante
   scollegata/coda bloccata e successiva ripresa, senza dichiarare “Stampata”
   al ritorno del browser. I test automatici non inviano lavori fisici.

I campioni della pagina non sono QR validi di persone nel database: uno
scanner operativo deve respingerli. Il successo del caso valido nello scanner
si verifica separatamente sulle fixture staging già predisposte; nessun
campione viene creato in production da questa tranche.

Le modali operative mostrano scelta della carta, elenco e comandi con testi
semplici. Le impostazioni complete sono raccolte nella sezione espandibile
**Come configurare la stampante**. Il registro condiviso conserva tentativi
e dettagli tecnici; questi non vengono mostrati come istruzioni all’operatore.

## Coda e badge completo

Le tabelle canoniche `group_badge_batches` / `group_badge_items` conservano il
badge completo e aggiungono un tipo distinto `qr_label`. Un solo elemento
etichetta per iscrizione/evento; gruppo e stampa individuale usano lo stesso
elemento. I lotti di invio hanno un manifesto persistente senza token.

- `pending`: etichetta mai richiesta.
- `prepared` + `requested`: tentativo acquisito; esito fisico da verificare.
- `browser_returned`: il comando browser è terminato; nessuna prova di invio
  al dispositivo o uscita fisica.
- `error`: errore tecnico/esito incerto; controllare la carta prima di ripetere.
- `verified`: conferma esplicita dell’operatore per la singola etichetta.

Ristampa esplicita incrementa il tentativo e torna da verificare. Snapshot
controllati in transazione proteggono QR/identità, composizione e revisioni;
richieste concorrenti e retry non restituiscono un secondo documento implicito.
Se cambia QR o nominativo, il precedente badge è segnalato da aggiornare e non
può essere confermato come quello corrente. Conferma fisica e consegna restano
distinte; nessuna di queste azioni registra o annulla presenze.

Il badge completo mantiene le sedute delle cerimonie. Nel percorso etichette
è raccolto in un pannello distinto; il suo vecchio formato non è calibrato
sul rotolo da 29 mm e non viene compresso nell’etichetta piccola.

## Verbale da compilare con l’operatore

Per ogni prova raccogliere computer/sistema/Chrome, stampante/driver,
collegamento e consumabile caricato; formato/vendor_id, scala, margini, pagine,
copie, taglio; campione, copie richieste/uscite/scarti, misure e allineamento;
Pixel/iPhone, lettura completa e tentativi; stato della coda prima/dopo,
interruzioni e ristampe. Non copiare payload di persone nel verbale.

Al 14 ottobre: **nessuna prova fisica nuova conclusa**. Windows, QL-800 e
postazioni dell’evento restano aperti. La precedente prova Mac/Chrome 154 sul
pretagliato è storica; il browser headless usato nei nuovi controlli automatici
è Chrome 155 e non certifica la stampante.
