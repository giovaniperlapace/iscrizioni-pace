# AGENTS.md

## Inaugurazione: nome sala Maschiella — 2026-10-25

- Nome «Settore F: Sala Maschiella in collegamento» in produzione; nome DB senza
  prefisso Settore, codice F e 500 posti conservati. Piantine usano layoutCode
  per identificare F e nome canonico per i testi. Email storiche conservate.
- Codice `2ea8058` pubblicato e deployment READY verificato prima del backup
  e della migration `20261025100000`, applicata/registrata in produzione.
  74 tabelle, 260.891 righe e 240 funzioni/ACL controllate; revisione 2493.
  1.133 test, TypeScript, lint mirato, build e SQL/concorrenza passati. Dettagli: `docs/inaugurazione-sala-maschiella-2026-10-25.md`.

## Accesso dopo la chiusura delle iscrizioni — 2026-10-25

- Il flusso email iniziale identifica l’evento corrente senza applicare la
  finestra delle nuove iscrizioni. Chi ha già accesso per iscrizione attiva,
  ruolo o membership può richiedere il magic link anche a iscrizioni chiuse.
- Solo le email senza accesso esistente passano dal controllo pubblico di
  pubblicazione/apertura/scadenza, sullo stesso evento corrente. Creazione
  iscrizioni, scope, rate limit, audit e destinazione Forum conservati.
- Nessuna migration o modifica ai dati; prove email simulate. Verifiche e
  stato del rilascio in `docs/accesso-iscrizioni-chiuse-2026-10-25.md`.

## Accoglienza Forum: avvio telefono e ritiro collaudo — 2026-10-25

- Telefono rilevato lato server: direttamente agli incarichi, sola modalità
  telefono, cambio incarico e fallback manuale conservati. Desktop/tablet con
  scelta della postazione; rotazione non azzera l’operazione. Ricerca rimossa.
- Prova con QR fittizi ritirata: niente link o asset pubblici; vecchio percorso
  reindirizza alla dashboard con permessi ordinari. Fixture conservate soltanto
  nei test locali, superando le precedenti istruzioni sulla prova pubblica.
- Sale collegate: sei incarichi distinti dai Forum principali; Domus Letitiae
  per 1/9/19, Serafico per 3/10/18. Lettura produzione conferma tutti e sei a
  tutti i 54 operatori; prenotazioni, ingressi e conteggi separati, fasce uguali
  ai rispettivi Forum. Nessuna modifica dati o migration.
- 1.123 test, TypeScript, lint mirato, build isolata da npm ci, SQL/concorrenza
  e browser desktop/mobile passati. Commit/push autorizzati; dettagli in
  `docs/accoglienza-avvio-telefono-2026-10-25.md`.

## Accoglienza: verifica iscrizione e cornice scanner — 2026-10-24

- «Verifica iscrizione» primo incarico, sempre disponibile agli operatori Forum/
  eventi. Nome del titolare QR; verde presenza generale confermata/badge ritirato,
  giallo iscrizione senza presenza, rosso QR non valido. Errori tecnici distinti.
- Sola lettura in UI, contratto, sessione e nuova RPC service-only STABLE;
  evento/incarichi e ultimo QR validati. Nessuna conferma, revoca o prenotazione.
  Scansioni consecutive, latch, manuale/USB e collaudo F001/F009/F008 conservati.
- Cornice di tutti gli incarichi Forum/cerimonie con gradiente e motivo home;
  incarico/statistiche e bande simmetriche da 80px conservati, testo bianco.
  Su successiva richiesta, fascia superiore senza decorazioni per leggibilità;
  motivo conservato soltanto in basso, anche in manuale/USB titolo pulito.
- Migration `20261024160000` applicata/registrata in produzione nel rilascio
  richiesto, dopo backup verificato: 74 tabelle, 244.199 righe e 239 funzioni/ACL
  preesistenti conservate. Commit/push richiesti. Nessuna scrittura operativa reale.
- 1.123 test, TypeScript, lint mirato, build isolata da npm ci, SQL/concorrenza
  e browser originale desktop/mobile superati. Dettagli:
  `docs/accoglienza-verifica-iscrizione-2026-10-24.md`.

## Inaugurazione: sala collegata F a 500 posti — 2026-10-24

- Migration `20261024140000`: F 400 → 500, totale fisico 3.640 e
  assegnabile 3.350; lock canonico, revisione, audit e guardie configurazione.
  Assegnazioni, bozze, email, mappe e protocollo conservati; UI già dinamica.
- Applicata/registrata in produzione dopo conferma e backup verificato:
  74 tabelle, 237.541 righe originarie e 239 funzioni/ACL controllate.
  Revisione 102, lettura finale confermata; commit/push autorizzati.
  1.119 test e regressioni SQL/concorrenza su PostgreSQL temporaneo passati.
  Dettagli: `docs/inaugurazione-sala-collegata-500-2026-10-24.md`.

## Cerimonie: email italiano e inglese insieme — 2026-10-24

- Ogni notifica di pubblicazione, personale o al capogruppo, contiene italiano
  seguito da inglese nello stesso messaggio; oggetto bilingue, HTML e testo.
  Non dipende dalla lingua del profilo; dashboard nelle sette lingue conservate.
- Dati, link per ruolo, contatti/deleghe, coda, report e metadata Postmark
  invariati. Nessuna migration, riaccodamento o reinvio degli invii precedenti.
- 1.119 test, TypeScript, lint mirato e build isolata da npm ci superati.
  Dettagli nel verbale cerimonie bozze/pubblicazione del 24 ottobre.

## Duplicati: rimozione immediata dalla lista — 2026-10-24

- Dopo la conferma server «Non sono duplicati», entrambe le righe della coppia
  scompaiono subito e i contatori si aggiornano; errore conserva la lista.
  Altre coppie con le stesse persone conservate, ultima coppia con stato vuoto.
- Stato locale alla lista, sostituito al successivo ricalcolo canonico; nessuna
  esclusione persistente nel browser. Rendering server delle righe conservato.
- Nessuna migration. 1.119 test, TypeScript, lint mirato, build isolata e browser
  desktop/mobile con refresh rallentato superati. Commit/push autorizzati;
  dettagli in `docs/duplicati-confronto-rapido-2026-10-24.md`.


## Duplicati: confronto rapido e conferma per coppia — 2026-10-24

- «Non sono duplicati», confronto ed eliminazione aprono subito il dialog via
  URL locale e leggono soltanto le due schede. HTTP privato/no-store, retry,
  scarto risposte tardive, ruolo/evento server; niente polling o cache condivisa.
- Conferma persone distinte controlla la versione della sola coppia: modifiche
  agli altri iscritti non bloccano più. Identità/contatti/figli e contesto della
  coppia cambiati restano bloccanti. Token attore/evento/scadenza, audit atomico
  e retry senza duplicazioni. Merge/import e soft delete canonico conservati.
- Migration `20261024120000` applicata/registrata in produzione dopo backup
  verificato e autorizzazione: 74 tabelle, 232.460 righe e 237 funzioni/ACL
  conservate. Commit/push dei soli duplicati autorizzati; Accoglienza esclusa.
  Copia isolata: 1.113 test, TypeScript e build superati. Nessuna prova operativa
  reale. Verifiche: `docs/duplicati-confronto-rapido-2026-10-24.md`.


## Cerimonie: correzione email Postmark 300 — 2026-10-24

- Metadata `ceremony_email_id` entro il limite Postmark di 20 caratteri;
  vecchia chiave di 26 caratteri riproduceva il rifiuto 300. Verificato con
  token ufficiale di test, senza consegna. Controllo preventivo nel trasporto.
- 1.111 test, lint mirato e build isolata superati; TypeScript generale
  segnala TS2559 nel test preesistente della colonna luogo di nascita.
- Nessuna migration; falliti/incerti non riaccodati automaticamente.
  Dettagli nel verbale cerimonie bozze/pubblicazione del 24 ottobre.

## Cerimonie: bozze condivise e pubblicazione — 2026-10-24

- Nuovi salvataggi Admin/Manager in bozza, condivisa; spostamento fra settori,
  quantità gruppo e rimozione. Niente visibilità personale/capogruppo o email
  fino alla pubblicazione di tutte le bozze della cerimonia selezionata.
- Viola bozze; verde pubblicati nominativi; arancio pubblicati ai gruppi ancora
  da abbinare. Assegnazioni preesistenti restano pubblicate. Famiglie, ricerca,
  risposte tardive, pop-up revoca, minori espliciti e sette lingue conservati.
- Pubblicazione atomica con conferma riepilogo e coda email: una per capogruppo
  coinvolto e una per iscrizione nominale (figli al contatto adulto). Claim unico,
  accettazione API distinta dalla consegna; incerti mai reinviati automaticamente.
- Modale: nomi dei membri del gruppo, tutti gli adulti e minori espliciti;
  selezione completa oltre le pagine da 100, riserve conservate. Pubblicazione
  personale con email per iscrizione; quantità gruppo affidate al capogruppo.
- Pulsante «Conferma posti e invia notifica ai partecipanti». Report per
  pubblicazione con ricerca, esiti, pagine, CSV e testo/indirizzo salvati;
  verifica consegna Postmark esplicita, distinta dall’accettazione, senza reinvio.
- Migration `20261024100000` applicata/registrata in produzione dopo
  autorizzazione e backup verificato: 71 tabelle, 226.514 righe e metadati/ACL
  di 234 funzioni conservati. Nessuna assegnazione o email reale di prova.
  Commit e push autorizzati. Lavori Accoglienza conservati.
  1.106 test, TypeScript, build isolata da npm ci, SQL/concorrenza e browser
  desktop/mobile superati; lint generale con i soli problemi preesistenti.
  Dettagli: `docs/cerimonie-bozze-pubblicazione-2026-10-24.md`.


## Sale collegate Forum — in produzione e invii avviati — 2026-10-23

- Sei panel collegati ai Forum 1/9/19 (Domus Letitiae, 156 posti) e 3/10/18
  (Serafico, 110 posti): 798 disponibilità complessive.
  Domus: Viale Giovanni XXIII 2, ampio parcheggio; Serafico: Viale Guglielmo
  Marconi 6, parcheggio limitato. Entrambe ad Assisi, navetta Linea C/mezzi propri.
- Nome e mail: «SALA COLLEGATA — SOLO IN ITALIANO», senza traduzioni;
  conferma esplicita personale/capogruppo, stessa fascia e sedi separate.
- Snapshot FIFO della sola coda del Forum corrispondente, residenti in Italia
  dal paese abituale del partecipante (non lingua/nazionalità/capogruppo).
  Esclusi esteri/ignoti; ricontrollo prima di promozione/notifica.
  Due ore per tutte le offerte Forum, principali e collegate,
  minori/destinatario conservati; accettazione mantiene la coda principale,
  successivo passaggio libera il posto collegato. Apertura dei residui dopo
  risoluzione delle offerte; guardie database anche sui percorsi operativi.
- Migration applicate `20261023100000`, `20261023101000`, `20261023102000`
  (estende anche offerte ancora valide senza riapertura/reinvio); attivazione service-only
  separata. Dopo la sospensione iniziale, l’utente ha esplicitamente autorizzato
  pubblicazione, migration production e avvio delle email il 23 ottobre.
  Backup verificato; 70 tabelle/211.458 righe e ACL conservati nell’infrastruttura.
- Codice `430ea5b` production READY dopo integrazione degli aggiornamenti main.
  1.085 test, SQL/concorrenza, TypeScript e build isolata passati. 269 inviti
  attivati, 155 email accettate (154 consegnate al server, una in attesa al
  controllo), zero fallimenti/incerti. 114 inviti attendono lo scorrimento FIFO
  per offerte principali ancora valide; cron esistente continua automaticamente.
- Verifiche e verbale: `docs/forum-sale-collegate-2026-10-23.md`.


## Cerimonie: pop-up conferma revoca — 2026-10-23

- Conferma revoca in piccolo dialog sopra la modale del settore. Solo Annulla
  chiude il pop-up senza salvare; Escape disabilitato. Conferma aggiorna i
  conteggi e mantiene il settore aperto. Testi, retry e salvataggi conservati.
- Browser desktop/mobile su dati sintetici verificato. Nessuna migration.
  Commit e push autorizzati; dettagli nel verbale modale del 23 ottobre.


## Cerimonie capogruppo: ordine e scelta dei destinatari — 2026-10-23

- Elenco/ricerca: prima presenza `yes` nel giorno e fascia canonici della
  cerimonia, prima delle pagine da 100; parità nell’ordine cognome/famiglia.
  Stato visibile nella riga; assenti/sconosciuti restano selezionabili.
- «Posti ricevuti» con schede settore/gruppo e conteggi sostituisce «dotazione».
  Riepilogo destinatari nello stile del sito, pulsante Rimuovi e avviso capienza;
  sette lingue, scelta esplicita dei minori e salvataggi/retry conservati.
- Nessuna migration. Inclusa nel rilascio scuole su richiesta esplicita.
  Browser desktop/mobile, SQL e test verificati;
  dettagli e limiti dei controlli generali in
  `docs/cerimonie-capogruppo-selezione-2026-10-23.md`.


## Scuole: QR, conferme e ingresso congiunto — 2026-10-23

- QR stabile per prenotazione, visualizzazione/download nella scheda Scuole
  Admin/Manager e pagina docente conservata. Studenti/accompagnatori separati
  dagli iscritti, nessuna anagrafica individuale o presenza dichiarata generata.
- Solo QR scuole: dal Forum, quantità effettive e «Registra evento e ingresso
  al Forum» atomico. Evento già presente conservato, secondo Forum non duplica
  l’evento; correzioni/revoche Forum indipendenti. Ruolo, prenotazione, capienza,
  audit e retry obbligatori. QR personali e gruppi ordinari esclusi dalla facoltà.
- Coda conferme per nuove prenotazioni pubbliche/gestionali e avviso richiesto
  per le attive esistenti; stesso QR allegato. Claim unico, esito API distinto
  dalla consegna, incerti mai reinviati automaticamente; cron esistente.
- Migration `20261023150000` e `20261023151000` applicate in produzione dopo
  backup verificato: 68 tabelle preesistenti e 225 funzioni/ACL conservate.
  Sei prenotazioni accodate; invio bloccato nel DB fino all’approvazione del testo.
  Nessuna email o presenza reale di prova. Commit/push autorizzati. Verifiche:
  `docs/scuole-qr-ingressi-email-2026-10-23.md`.


## Accoglienza Forum: fasce del selettore — 2026-10-23

- Scelta incarico in ora Roma: tutti i Forum del mattino 07:30–13:30;
  pomeriggio e finale dalle 13:30, inaugurazione dalle 14:00.
- Date dai momenti canonici; finale senza piano sul giorno conclusivo evento,
  senza inventare configurazione o posti. Fine pomeriggio/cerimonie +90 minuti,
  massimo mezzanotte; senza piano, fino a mezzanotte.
- Solo filtro di scelta, senza revoche. Cambio automatico locale e al ritorno
  alla scheda; scanner/operazioni già in corso conservati con avviso.
  Collaudo fittizio sempre disponibile. Nessun polling.
- Migration `20261023140000` applicata/registrata in produzione il 24 ottobre
  dopo backup verificato: 74 tabelle, 233.072 righe e 239 ACL conservati.
  1.119 test, TypeScript, build isolata, SQL e browser desktop/mobile superati.
  Commit/push autorizzati; verifiche e stato rilascio in
  `docs/accoglienza-fasce-orarie-2026-10-23.md`.


## Cerimonie: modale persone, famiglie e gruppi — 2026-10-23

- Due opzioni: persona cercata in tutti gli iscritti (adulto e figli al seguito,
  con avviso 1 + x e nomi prima del salvataggio) oppure quantità a un gruppo.
  «Conferma assegnazione» salva direttamente, senza doppia conferma.
- Assegnazioni nominali espandibili e revocabili nel settore; dotazioni di
  gruppo distinte, senza trasformare l’appartenenza in un posto al gruppo.
  Il nuovo percorso personale non consuma riserve; capogruppo invariato.
- Chiusura azzera ricerca, selezione, modalità e quantità; risposte tardive
  scartate. Revoche confermate, retry idempotenti e controlli canonici conservati.
- Migration `20261023120000` applicata in produzione dopo backup verificato:
  famiglia completa sotto lock; 68 tabelle, 208.469 righe e ACL conservati.
  Rilascio autorizzato con campi email e duplicati. Verifiche e limite lint generale
  in `docs/cerimonie-modale-assegnazioni-2026-10-23.md`.


## Accoglienza Forum: tutti gli incarichi — 2026-10-23

- Tutti gli operatori con il ruolo ricevono l’intero catalogo corrente di Forum,
  inaugurazione e finale. Nessuna assegnazione generalizzata a tutti gli utenti.
- Email di assegnazione disattivata solo per questo ruolo, per utenti nuovi
  ed esistenti anche con `sendInvite=on`; invii degli altri ruoli conservati.
- Rimosse le caselle nella gestione ruolo; scelta dell’incarico operativo
  conservata nella dashboard. RPC completa ogni assegnazione non vuota.
- Migration `20261023130000` applicata/registrata in produzione il 24 ottobre
  dopo backup verificato: 54 operatori completati con 336 incarichi Forum e
  1 cerimonia aggiunti, 52 audit; 232.670 righe preesistenti conservate.
  Permessi, revoca e accoglienza generale conservati. Commit/push autorizzati.
- Verifiche e stato rilascio: `docs/accoglienza-tutti-incarichi-2026-10-23.md`.


## Campagne: settori personali delle cerimonie — 2026-10-23

- Campi `{{settore_inaugurazione}}` e `{{settore_cerimonia_finale}}` inseribili
  in oggetto e messaggio. Anteprima, prova e coda leggono le nomine personali
  attive del destinatario nell’evento, dirette o provenienti da riserve di gruppo.
- Solo settore dell’adulto; per capigruppo la propria iscrizione, mai la dotazione
  della delegazione o i settori dei figli. Nessuna assegnazione: campo vuoto.
  Errori di lettura bloccanti; escaping HTML conservato. Lettura aggiuntiva solo
  per campagne che usano i nuovi campi. Nessuna migration o invio reale di prova.


## Accoglienza Forum: incarico nel riquadro scanner — 2026-10-22

- Nome e statistiche nella banda scura interna superiore dell’anteprima
  fotocamera, compatta e indipendente dalla dissolvenza dell’esito. In manuale/USB
  restano nell’intestazione del riquadro anche quando compare il risultato.
- Testo e statistiche centrati; pulsante «Aggiorna conteggi» con icona e label.
  Bande scure superiore/inferiore compatte (80px), contatori e aggiornamento
  affiancati, testo centrato. Bande simmetriche, quella inferiore sempre presente
  e riservata agli esiti. Rimosso l’avviso sull’occupazione della sala;
  aggiornamento automatico dopo ingresso conservato.
- Cambia modalità/incarico sotto il titolo della dashboard, con pulsanti nello
  stile del sito. Conteggi aggiornati dopo le operazioni; fotocamera invariata.
- Prova con QR fittizi mantenuta in fondo alla pagina: rimozione rinviata
  a ridosso dell’evento, su successiva richiesta. Nessuna migration.

## Accoglienza Forum: terminologia ingressi — 2026-10-22

- Dashboard Forum/cerimonie e collaudo: conferma, rimozione, correzione,
  selezione famiglie e quantità scuola usano «ingresso», mai «presenza»
  per il check-in. Lessico circoscritto agli incarichi Forum/cerimonie;
  accoglienza generale e presenze dichiarate conservano il proprio significato.
- Rimossa su richiesta la spiegazione della legenda; colori degli esiti conservati.
- Solo testi, nessuna migration o modifica a salvataggi/permessi.

## Accoglienza Forum: colori ed eccezione ingresso — 2026-10-22

- Riquadro fotocamera fisso: nessuna riduzione al QR o alla conferma. Scheda
  animata sotto, dissolvenza di due secondi e latch conservati. Legenda: giallo
  Forum sbagliato/accoglienza generale mancante, arancione senza prenotazione
  o biglietto cerimonia, rosso QR invalido/errori bloccanti, verde esito valido.
- «Segna l’ingresso comunque» esplicito solo al Forum per persone selezionate
  o quantità scuola; non registra l’accoglienza generale. Prenotazione,
  incarico, capienza e controlli sui minori restano obbligatori. Retry con
  identica richiesta e motivo `event_entry_override` nello storico.
- Migration `20261022210000` applicata/registrata in production dopo backup
  verificato: 68 tabelle, 204.006 righe e metadati/ACL di 225 funzioni conservati;
  modificato solo il corpo della RPC prevista. Nessuna presenza reale di prova.
- Verifiche e rilascio in `docs/accoglienza-forum-camera-2026-10-22.md`.

## Accoglienza Forum: esiti nella fotocamera — 2026-10-22

- Ultima revisione: fascia breve sul video e scheda completa subito sotto,
  anteprima ridotta al riconoscimento, ingresso animato e scorrimento minimo
  verso la scheda. Movimento ridotto rispettato; niente elenchi sopra il video.
  Stream conservato durante conferma e salvataggio, letture concorrenti bloccate.
- Iscrizione Forum verificata in verde, ingresso separato con «Segna entrata».
  Selezione esplicita dei minori, retry e controlli canonici conservati.
- Contatori per incarico: Iscritti (Assegnatari per cerimonie) ed Entrati,
  riletti dopo salvataggio; nessuna migration o prova operativa remota.
- Successiva richiesta: tolto «Scansiona un altro QR» nella fotocamera;
  dopo ingresso salvato la scheda sfuma in due secondi e la lettura riprende.
  Latch conservato per non riaprire lo stesso QR ancora inquadrato.
- Dettagli: `docs/accoglienza-forum-camera-2026-10-22.md`.

## Cerimonie: menu capogruppo e schede partecipante — 2026-10-22

- Menu «Posti alle cerimonie» accanto ai Forum, sempre raggiungibile; schede
  Inaugurazione/Cerimonia finale con sole dotazioni ricevute e scope corrente.
  Rimosso il filtro Admin di collaudo sul percorso attivo, mantenuti i controlli
  server/DB di appartenenza al gruppo e i retry atomici.
- Dashboard partecipante: due sezioni con icona a sipario, settore personale
  e figli, attesa prima dell’assegnazione, errore distinto da vuoto; sette lingue.
  RPC personale canonica e caricamento indipendente. Nessuna migration.
- 1.056 test, lint, TypeScript, build isolata e browser 390/1440px superati.
  Codice `f697a69` production READY, dominio e percorsi protetti verificati.
  Nessuna assegnazione reale di prova. Dettagli nel verbale cerimonie per settore.

## Cerimonie: assegnazione al settore — 2026-10-22

- Su nuova richiesta, superata l’assegnazione a sedie specifiche: piantine
  principale/F sempre presenti, F con 400 quadratini; nomi A, A1, A2, B, C,
  D, E, F. Pop-up settore con Singoli/Gruppi, nomi o quantità, ricerca e
  presenze dichiarate visibili per tutti gli iscritti attivi.
- Riepilogo completo del gruppo: persone assegnate direttamente o tramite
  riserva, persone da assegnare e residuo delle dotazioni. Le nomine consumano
  prima la riserva nello stesso settore; capogruppo con scelta multipla dei
  nomi per settore, sette lingue, minori espliciti e annullamento conservativo.
- Migration `20261022200000` applicata dopo backup verificato: chiude i claim attivi delle sedie ma
  conserva storico, nomine, quantità, riserve, mappe e quote. RPC service-only,
  ruolo/scope riletto, revisione, idempotenza e lotti atomici. Letture HTTP
  private/no-store senza polling. Manager entra dalle piantine; Viewer invariato.
- 1.053 test, lint, TypeScript, build isolata da npm ci, SQL/concorrenza e browser
  originale desktop/mobile superati, compreso gruppo di 100 ripartito 20/80.
  Rilascio autorizzato: migration production registrata atomicamente, 68 tabelle
  e 202.645 righe confrontate, dati e ACL conservati. Codice `15899be` su main,
  production READY e dominio verificato; percorsi protetti e log senza errori.
  Nessuna assegnazione, presenza o invio reale di prova. Verbale:
  `docs/cerimonie-assegnazioni-settore-2026-10-22.md`.


## Posti cerimonie: selezione senza salto della pagina — 2026-10-22

- Disabilitato il solo ancoraggio automatico del browser nella schermata
  di assegnazione Manager/Admin: la comparsa dei destinatari dopo il primo
  posto non trascina la pagina al fondo dell’elenco. Nessun riposizionamento
  forzato o blocco dello scroll manuale; scroll esplicito sul blocco conservato.
- Regressione browser originale con 100 partecipanti, desktop/mobile,
  diverse altezze, mouse/tastiera e focus: prima/seconda selezione e ultima
  deselezione stabili, scorrimento intenzionale verso i destinatari riuscito.
  Nessuna migration o scrittura operativa reale; verbale posti cerimonie.

## Cerimonie capogruppo: abbinamento biglietti senza piantina — 2026-10-22

- Pagina capogruppo: dotazione ricevuta, elenco dei soli biglietti riservati,
  scelta del membro/figlio e conferma. Vecchia mappa reindirizzata; F per
  quantità e scelta esplicita dei minori senza posto conservata.
- Ricerca globale prima delle pagine da 100; aggiornamenti dopo salvataggio
  o pulsante, nessun polling. Retry con la stessa richiesta dopo esito incerto.
- Migration `20261022190000`: lettura limitata al gruppo e pairing atomico,
  ruoli cumulati senza bypass Manager, revisione/lock/idempotenza. Annullare
  conserva quantità, riserva e collegamento storico persona/sedia.
- 1.047 test, lint, TypeScript, build isolata, SQL/concorrenza e browser
  originale desktop/mobile superati. Migration applicata dopo backup con
  68 tabelle/193.411 righe e 221 funzioni/ACL conservate. Nessuna assegnazione
  o revoca reale di prova. Codice `391d8bf` in produzione READY; dominio e
  protezione dei percorsi verificati. Verbale `docs/posti-cerimonie-2026-10-22.md`.

## Posti cerimonie: fila a sinistra del blocco — 2026-10-22

- Dettaglio inaugurazione: etichetta «Fila N» una sola volta a sinistra di
  ogni fila, anche nella vista dell’intero settore; sedie con «Posto N».
  Riferimento completo conservato in aria-label, tooltip e tabella accessibile.
- Solo presentazione: UUID, numeri, selezione, protocollo e assegnazioni
  invariati; nessuna migration. Collaudo sintetico desktop/mobile e zoom
  75/100/200%, regressione dei flussi originali, 1.043 test, lint, TypeScript
  e build production superati. Dettagli nel verbale posti cerimonie.

## Posti cerimonie: B unico, cronologia esplicita e revoca dalla sedia — 2026-10-22

- B1/B2 riuniti nel solo B: 600 posti, sei blocchi, file 1–10 senza rinumerare.
  UUID/coordinate/sedie e assegnazioni degli altri settori conservati; totali
  3.540 fisici / 3.250 assegnabili. Superata la precedente separazione B1/B2.
- Cronologia tramite HTTP private/no-store, indipendente dai riferimenti delle
  Server Action e dai refresh della pagina. Carica all’apertura, con i pulsanti
  (ricerca/pagine/Aggiorna) e dopo assegnazioni/revoche; nessun polling.
- Clic su una sedia occupata: destinatario e conferma per liberare solo quella
  sedia. Per i gruppi riduce la riserva di uno, revoca l’eventuale nomina e
  conserva gli altri posti. Resta possibile scegliere il posto riservato per
  assegnarlo a un membro. Protocollo bloccato; F tramite cronologia/quantità.
- Migration `20261022180000`: B unificato solo se privo di assegnazioni/claim
  anche storici, altrimenti rollback; nuova versione mappa e storico intatto.
  Revoca singola con ruolo riletto, revisione, retry idempotente, audit e
  aggiornamento atomico; rilasci delle riserve visibili nella cronologia.
- 1.043 test, lint, TypeScript, build production, SQL/concorrenza e browser
  sintetico desktop/mobile; verificati rinnovo cookie e numero finito di letture.
  Migration applicata dopo backup: dati estranei/assegnazioni e ACL conservati;
  live revisione 6, mappa 3, otto settori. Codice `75e20d1` su main, production
  READY e dominio verificato. Nessuna assegnazione, revoca, presenza o invio
  reale di prova. Verbale:
  `docs/posti-cerimonie-2026-10-22.md`.

## Posti cerimonie: navigazione e cronologia con revoche — 2026-10-22

- Clic sul blocco: scroll e focus al dettaglio, margine sotto l’intestazione,
  movimento ridotto rispettato. F conduce al contatore.
- «Tutto il settore» ripristina la piantina completa, azzera ricerca/tabella
  e allinea il blocco della pagina; selezione dei posti conservata. Rimosso
  il selettore interno ambiguo quando il settore è già unico.
- Cronologia attive/revocate con ricerca globale e pagine da 100: riserve
  cumulative per gruppo/settore e nomine distinte. Date, quantità e sedie.
- Revoca confermata atomica: persona diretta libera il posto; nomina di gruppo
  lo restituisce alla riserva; delegazione revoca tutte le sue nomine e libera
  la dotazione del settore, con elenco esplicito delle persone coinvolte.
- Migration `20261022170000`: due RPC service-only; ruolo/sessione/evento,
  revisione, idempotenza, audit e storico conservati. Nessun backfill inventato.
- Rilascio congiunto con la richiesta successiva, come chiesto dall’utente.
  1.042 test, lint, TypeScript, build, SQL/concorrenza e browser sintetici.
  Migration applicata dopo backup: 68 tabelle e 192.898 righe invariate, ACL
  conservati. Codice `75af1b1` su main, production READY e dominio verificato.
  Nessuna assegnazione/revoca/presenza reale di prova. Dettagli nel verbale posti.

## Inaugurazione: blocchi posteriori nel settore E — 2026-10-22

- Su richiesta dell’utente, gli ex H1/H2 diventano E blocchi 7/8, rispettivamente
  a sinistra/destra sul retro. Numerazione 7/8 confermata esplicitamente.
  E passa a 740 posti; file 1–7, sedie 1–10, UUID e coordinate conservati.
- Panoramica unica E con otto blocchi; riferimenti condivisi anche in biglietti
  e QR gruppo. Totali 3.540/3.250 e 290 protocollo invariati.
- Migration `20261022150000`: nuova versione della mappa, storico intatto,
  quote coerenti e revisione incrementata. Si arresta senza effetti se H ha
  assegnazioni anche storiche o la configurazione è cambiata. Nessun trigger
  disabilitato e nessuna assegnazione reale di prova.
- 1.040 test, lint, TypeScript, build pulita e browser desktop/mobile su
  PostgreSQL temporaneo superati. Codice `3722c87` production READY; migration
  applicata/registrata dopo backup verificato. Live: mappa 2, revisione 5,
  9 settori, E 740; zero assegnazioni di collaudo. Dettagli nel verbale
  `docs/posti-cerimonie-2026-10-22.md`.

## Posti prima dei destinatari e QR gruppo — 2026-10-22

- Unico percorso: selezione posti, poi persona/familiari oppure gruppo. Rimossi
  «Parti dai posti» e «Parti dalle persone»; cambiare destinatario conserva i posti.
  F ha quantità esplicita con contatore anche per le assegnazioni nominali.
- QR gruppo in Accoglienza: riepilogo delle riserve attive della delegazione,
  comprese quelle senza nomine, per cerimonia/settore/blocco/fila e intervalli
  di sedie realmente contigue. F mostra la quantità senza inventare numeri.
- Letture server dopo autorizzazione del QR canonico, evento/gruppo derivati
  dalla sessione e dalla RPC; paginazione, esclusione revoche e verifica revisione.
  Errore del riepilogo esplicito, senza perdere l’esito di una presenza salvata.
- Nessuna migration o assegnazione reale di prova. 1.039 test e collaudo browser
  originale con PostgreSQL temporaneo; dettagli nel verbale posti cerimonie.

## Orientamento e nomi sedute — 2026-10-22

- Palco in alto nella panoramica inaugurazione e nei dettagli; blocchi 1–6
  da sinistra a destra guardando il palco, file dall’alto verso il basso.
- B1 e B2 in fasce distinte, con intestazioni, cornici e selezione separata:
  B1 file 1–5, B2 file 6–10. Non rinumerare queste ultime da 1.
- Riferimenti visibili espliciti: «Settore A · Blocco 2 · Fila 9 · Sedia 1»,
  anche nei riepiloghi, biglietti personali e consultazione accoglienza.
  Superata la proposta abbreviata A-B2-F09-P01.
- Trasformazione solo di presentazione: UUID, coordinate archiviate, file,
  numeri, capienze, protocollo e assegnazioni invariati. Nessuna migration.
  Verifiche e rilascio nel verbale `docs/posti-cerimonie-2026-10-22.md`.

## Posti cerimonie: sola assegnazione — 2026-10-22

- Voce laterale autonoma Admin/Manager con icona sedia; rimossa dal menu Forum.
  Vecchie pagine reindirizzate. Configurazione, settori, quote e piantina si
  modificano tramite manutenzione concordata con ChatGPT, non dalla UI web.
- Tutti gli iscritti attivi assegnabili, con precedenza globale alla presenza
  dichiarata nella fascia della cerimonia; per apertura domenica pomeriggio.
  Ricerca/filtri prima delle pagine da 100; figli selezionati nominalmente.
- Percorsi posto → persona e persona → famiglia; più posti a una delegazione,
  poi nomine dei suoi membri. F solo settore. Salvataggio atomico e retry
  idempotente; Viewer esclusi, ruolo evento riletto. Presenze Forum invariate.
- UUID delle sedie conservati: spostamento grafico sicuro, rinumerazione o
  rimozione di posti occupati bloccata. Etichette fisiche ancora da concordare.
- Migration `20261022120000` in produzione dopo backup verificato: 68 tabelle,
  191.862 righe e ACL di 216 funzioni conservati. 1.035 test, lint, TypeScript,
  build pulita, SQL/concorrenza e browser originale con DB temporaneo superati.
  Nessuna assegnazione reale di collaudo. Verbale:
  `docs/posti-cerimonie-2026-10-22.md`.

## Accoglienza: ordine persone del gruppo — 2026-10-21

- Accoglienza e lista stampa QR nel menu Gruppi Manager/Admin: elenco unico,
  prima chi non ha presenza registrata, poi chi è presente; ciascun insieme
  in ordine crescente di stampe richieste. Parità nell'ordine originale.
- Selezione per ID conservata. In Accoglienza telefono senza contatori: sola
  precedenza delle presenze mancanti; famiglie invariate. Contatori sconosciuti
  dopo quelli conosciuti. Nessuna migration o modifica ai permessi.
- Coda QR gruppo: presenze generali attive degli adulti, lette per evento e
  soli ID autorizzati dalla RPC, in lotti di 200; errore di lettura esplicito.
  Rilettura dopo stampa e riapertura, nessuna conferma di presenza implicita.
- 1.027 test, lint, TypeScript e build production in copia isolata delle sole
  modifiche. Browser sul componente originale con dati sintetici: ordine
  assenti 0/1/2 stampe, poi presenti 0/1; selezione inizialmente vuota.
  Nessuna stampa fisica o scrittura operativa remota. Commit/push autorizzati.

## Piantina inaugurazione e accesso Manager — 2026-10-21

- Sala del 25 ottobre, 16:30–19:00 Rome: 3.540 posti fisici, 3.250 assegnabili,
  290 protocollo bloccati. A1/A2 100 ciascuno, A centrale 110 disponibili,
  B1/B2 300 ciascuno, C/D/E 600 ciascuno, F 400 solo settore, H1/H2 70 ciascuno.
- File disponibili definitive: A-b2 9–10; A-b3/A-b4/A-b5 8–10. Blocchi b1–b6
  da sinistra a destra guardando il palco (b1 in basso nella fotografia).
- Admin/Manager corrente: quantità ai gruppi, singole persone e figli scelti
  nominalmente anche senza gruppo. Viewer esclusi dall'apertura; editor Admin.
- Migration `20261021180000` applicata/registrata atomicamente dopo backup
  verificato: 68 tabelle, 182.310 righe canoniche e ACL di 215 funzioni conservati.
  Configurazione validata e piantina pubblicata; nessuna assegnazione reale.
- 1.031 test, lint, TypeScript, build pulita, SQL/concorrenza e browser sintetico
  desktop/mobile superati. Codice `878fd2c` su main, production READY e dominio
  verificato; revisione autenticata reale ancora da svolgere. Verbale:
  `docs/inaugurazione-piantina-manager-2026-10-21.md`.

## QR fittizi per Forum e cerimonie — 2026-10-21

- Nove PNG e foglio stampabile `/collaudo-forum-eventi/qr.html`, con codici
  F001–F009 ed esito atteso. Usarli soltanto nella pagina di prova dedicata.
- Nuova `/dashboard/accoglienza-forum-eventi/collaudo`, collegata dalla
  dashboard: stessi componenti, dati sintetici in memoria per scheda,
  Ricomincia, nessuna scrittura o chiamata alle API operative. Admin, Manager
  corrente e operatori con incarichi; Viewer esclusi. Nessuna migration.
- Proxy: Manager senza incarico ammesso solo al collaudo; ingresso automatico
  degli operatori Forum allineato alla selezione canonica del ruolo.
- 1.013 test, lint, TypeScript, build production pulita, SQL/browser e
  decodifica dei nove PNG superati; zero chiamate operative nella prova.
  Dettagli nel verbale `docs/accoglienza-forum-eventi-2026-10-21.md`.

## Accoglienza forum ed eventi — 2026-10-21

- Ruolo visibile unico con incarichi Forum/apertura/finale, assegnabili e
  modificabili da Manager/Admin in Utenti e ruoli: caselle, Seleziona tutto,
  riepilogo «Tutti gli incarichi». Nessun ruolo generale implicito.
- Dashboard dedicata: postazione e incarico prima della fotocamera, ricerca e
  cambio incarico. Telefono: QR, esiti e conferma semplice; computer: codice/USB
  e prenotazione o biglietto, separati dalla presenza. Nessuna ammissione senza
  prenotazione; capienze, coda, fasce, presenze dichiarate e minori conservati.
- Cerimonie consultabili con incarico, settore/posto e ingressi dedicati. Sedi
  reali ancora assenti; il desk assegna biglietti al titolare, i minori tramite
  distribuzione cerimonia. Statistiche del proprio incarico, ingressi distinti
  dall’occupazione attuale della sala.
- Migration `20261021120000` applicata/registrata atomicamente in production
  dopo backup verificato: 67 tabelle, 173.487 righe e 2.854 voci catalogo
  confrontate. Dati/ACL conservati; Forum già open e scuole attive invariati.
- 1.007 test, lint, TypeScript, build production da npm ci, SQL/concorrenza
  e browser originale desktop/mobile con QR da stream sintetico superati.
  Nessun incarico reale assegnato, prenotazione/presenza remota o email di prova.
  Codice `8b77f1b` su main, production READY e dominio verificato; lettura
  Manager live: 26 incarichi. Revisione autenticata reale ancora da svolgere.
  Verbale: `docs/accoglienza-forum-eventi-2026-10-21.md`.
## Configurazione SSH locale — 2026-10-21

- Chiave verificata: `/Users/stefanolaptop/.ssh/id_ed25519`, utente `root`, server `91.99.81.31:22`.
- Aggiornato `.env.local` e ripristinato `.env.production.local` con il target esplicito production per lo script migration; entrambi ignorati da Git e con permessi `600`.
- Il file production contiene i soli parametri SSH/stack/database; le credenziali applicative restano in `.env.local`. Dettagli in `docs/supabase-workflow.md`.
- Accesso SSH e query READ ONLY verificati; nessuna migration o modifica del database.

## Forum capogruppo: lettura e ruoli cumulati — 2026-10-20

- Corretto errore PostgREST `25006`: catalogo STABLE compatibile con READ ONLY;
  lock invariati nelle prenotazioni. Migration `20261020230000` in produzione.
- Su richiesta dell’utente, un Manager/Viewer che è anche capogruppo mantiene
  la facoltà di prenotare per i propri gruppi. Il solo ruolo operativo non basta.
  Migration `20261020231000` applicata; scope evento/gruppi e revoca conservati.
- Backup verificati, dati e ACL invariati. Browser originale con DB temporaneo:
  iscrizione, annullamento, coda/accettazione, ruoli cumulati, mobile, sette lingue.
  Lettura READ ONLY live: 24 Forum e 120 membri per un Manager + capogruppo.
  Dettagli: `docs/forum-capogruppo-caricamento-2026-10-20.md`.

## Campagne: esiti per destinatario e reinvio selettivo — 2026-10-20

- Email → Campagne inviate → Dettagli: storico paginato, ricerca, filtri,
  conteggi, esito individuale e CSV completo. Distinguere accettazione API,
  consegna al server, rifiuto, blocco/disiscrizione, incerto ed esclusione.
  Il contatto corrente non va presentato come indirizzo storico verificato.
- Webhook Postmark broadcast autenticato, eventi idempotenti e soppressioni
  ordinate; dati di consegna protetti e nessun corpo email acquisito.
  Anteprima con avvisi sui disiscritti; nessuna riattivazione automatica.
- Reinvio esplicito solo dei fallimenti recuperabili, in nuova campagna collegata:
  selezione, conferma nominale, verifica fresca di ruolo/indirizzo/soppressioni,
  atomicità e deduplicazione. Escludere consegnati, incerti, disiscritti, reclami,
  indirizzi invalidi e messaggi troppo grandi; questi ultimi richiedono una nuova
  campagna corretta. Conservare la coda e i controlli precedenti.
- Migration `20261020180000`, `20261020190000`, `20261020200000`,
  `20261020210000` applicate in production con backup e controlli. Riconciliati
  936 messaggi e 6 soppressioni; 78 identificativi storici senza riscontro
  disponibile restano senza conferma. Nessuna email di collaudo o reinvio reale.
  Dettagli e verifiche: `docs/campagne-esiti-e-reinvio-2026-10-20.md`.

## Toggle apertura Forum nelle impostazioni Admin — 2026-10-20

- Admin → Impostazioni → Evento, solo evento corrente
  pubblicato. Attiva `open`; disattiva `internal`, nascondendo i Forum dal sito.
  Su richiesta successiva, la home mostra i Forum solo in `open`, anche se
  incontra il vecchio stato `catalog`. Prenotazioni e visibilità sono collegate.
- Server e RPC verificano Admin globale; lock, stato atteso e audit atomico.
  Prenotazioni e flag scuole conservati. Nessuna apertura implicita.
- Migration `20261020220000_admin_forum_opening` applicata e registrata in
  produzione dopo backup verificato: 67 tabelle, 135.492 righe e 201 funzioni
  preesistenti invariate. Confermati `internal` e accesso scuole attivo.
  Codice `178b18c` su main, production READY e dominio verificato: Forum
  nascosti e impostazioni protette. Nessuna apertura reale di collaudo.
  Verifiche e limiti in `docs/forum-toggle-admin-2026-10-20.md`.

## Forum: presenza dichiarata richiesta — 2026-10-20

- Nuove prenotazioni, coda e accettazioni personali/capogruppo richiedono
  presenza `yes` nel giorno e fascia canonica Rome del Forum. Scuole escluse.
  Nessun check-in richiesto; cancellazioni e prenotazioni preesistenti conservate.
- Messaggio in sette lingue e link alle presenze; aggiornare/salvare e riprovare.
  Controllo RPC e trigger anche sui percorsi precedenti, errore `PFA01`.
- Migration `20261020170000_forum_attendance_required` applicata in production
  dopo backup verificato: 64 tabelle e 134.521 righe invariate, ACL conservati.
  Test applicativi, SQL/concorrenza/scuole, browser desktop/mobile, lint,
  TypeScript e build superati; `internal` conservato. Dettagli in
  `docs/forum-presenze-obbligatorie-2026-10-20.md`.

## Modifiche multiple e filtri Manager — 2026-10-20

- Admin/Manager: selezione esplicita nella pagina (max 100),
  aggiunta conservativa di un tag e assegnazione gruppo/servizio in transazione unica.
  Conferma con riepilogo e nomi; minori nel gruppo d'iscrizione, senza tag/servizi.
- Filtri delle presenze comunicate per mezza giornata (sì/no combinabili) e
  comunicati/da comunicare, prima della paginazione e coerenti con Excel.
  Dati sconosciuti distinti da assenze; nessun uso dei check-in.
- Eliminazione tag con conferma globale per evento, cascata assegnazioni e audit.
  RPC service-only con ruolo evento riletto; Viewer esclusi dalle scritture.
- Migration `20261020160000_manager_bulk_operations` applicata e registrata
  in produzione nel rilascio complessivo del 20 ottobre, dopo backup verificato.
  Verifiche e limiti in `docs/modifiche-multiple-manager-2026-10-20.md`.


## Lista d’attesa Forum: un’ora per confermare — 2026-10-20

- Termine portato a 60 minuti per partecipanti e capigruppo, sia alla
  promozione sia al claim della notifica; testi web/email in sette lingue.
  Questa durata supera i riferimenti storici a 30 minuti.
- Migration `20261020143000_forum_waitlist_one_hour`; dettagli e verifiche
  in `docs/forum-lista-attesa-un-ora-2026-10-20.md`.

## Forum: minori scelti per ogni prenotazione — 2026-10-20

- Area personale e capogruppo scelgono nominalmente i minori per ciascun Forum;
  nessuna selezione automatica nelle nuove richieste. Conteggi, FIFO/offerte,
  statistiche, Excel e ingressi Forum includono solo i minori selezionati.
- Richieste attive conservano la scelta: per modificarla occorre cancellare
  o uscire dalla coda e prenotare nuovamente. Vecchie prenotazioni conservate
  dal backfill. Ingresso evento e apertura Forum indipendenti.
- Migration `20261020140000_explicit_forum_children` applicata e registrata
  in production dopo backup verificato: 63 tabelle, 134.505 righe e ACL delle
  189 funzioni preesistenti invariati. Forum internal, nessuna prenotazione reale
  di collaudo. Dettagli: `docs/forum-minori-scelta-2026-10-20.md`.

## Lingue dei forum — 2026-10-20

- Riga discreta condivisa nel catalogo pubblico/anteprima, scelta personale,
  forum selezionato capogruppo e scuole/docente; sette lingue, ritorno a capo
  mobile. Fonte: programma definitivo ricevuto il 20 ottobre (forum 10 senza
  spagnolo). Configurazione editoriale per UUID in
  `lib/events/assisi-2026-forum-languages.ts`, nessun matching per titolo/numero.
- UUID ignoti non mostrano lingue; nuove revisioni richiedono aggiornamento
  esplicito della configurazione. Nessuna migration o modifica di permessi,
  prenotazioni o apertura catalogo. Dettagli in `docs/forum-languages-2026-10-20.md`.


## QR gruppo: stampa individuale nella modale e accesso Manager — 2026-10-19

- Unico pulsante «QR del gruppo» nelle gestioni Admin/Manager: QR unico con
  download e sezione distinta per selezionare/stampare i QR personali. Rimosso
  il pulsante esterno di stampa; selezione inizialmente vuota e conservata dopo
  stampa. QR ed elenco pronti prima della visualizzazione, letture HTTP senza
  navigazione; stampa e presenze separate, capigruppo invariati.
- L’utente autorizza esplicitamente anche i Manager nell’evento corrente.
  Migration `20261019200000_manager_group_qr_printing` applicata e registrata
  atomicamente in production dopo backup verificato: 63 tabelle pubbliche,
  129.765 righe invariate, 2.574 voci catalogo confrontate, sole due funzioni
  previste modificate. ACL/scanner conservati, Forum internal e scuole attive.
- 965 test, lint, TypeScript, build production da npm ci, SQL e browser
  desktop/mobile con stampa simulata superati. Nessuna stampa fisica o
  scrittura operativa remota. Verbale: `docs/qr-gruppo-stampa-unificata-2026-10-19.md`.

## QR gruppo: caricamento completo e finestra stabile — 2026-10-19

- Su richiesta per la gestione gruppi Manager, il componente condiviso mostra
  un unico caricamento e rivela descrizione, QR decodificato e download insieme.
  Finestra/chiusura ferme; errore e riprova dopo massimo 25 secondi.
- Apertura tramite HTTP POST private/no-store, stesso origin e get canonico:
  il rinnovo sessione non naviga la dashboard. Prima creazione stabile sotto
  lock, scope Manager/Admin/capogruppo e download identico conservati.
- 963 test, lint, TypeScript e browser desktop/mobile: caricamento lento,
  immagine invalida, timeout/risposte tardive, doppio clic, sette lingue,
  rinnovo cookie e scroll invariato. Nessuna migration o prova su dati reali.
  Dettagli in `docs/qr-gruppo-manager-2026-10-19.md`.

## Cerimonie: navigazione e percorso guidato — 2026-10-19

- Su richiesta dell’utente, navigazione comune nelle tre pagine, con selettore
  inaugurazione/finale e schede nello stile Forum: Preparazione e quote,
  Assegnazioni alle persone, Posti numerati. Tutte le voci visibili su telefono.
- Cerimonia conservata nei passaggi e filtro coerente delle dotazioni nominali;
  istruzioni per fase, prossimo passaggio in base allo stato e collegamenti
  di recupero per viste vuote. Chiariti quote, dotazioni e numerazione facoltativa.
- Solo Admin; sedi reali ancora da definire. Nessuna migration, apertura ruoli,
  scrittura operativa remota o modifica alle regole di assegnazione.
- 962 test, lint, TypeScript e build production pulita da npm ci superati.
  Browser sintetico su pagine/componenti originali in copia senza credenziali:
  desktop/mobile, navigazione, filtro cerimonia, viste vuote e dati conservati
  su errore. Verifica autenticata online rimane alla revisione Admin.

## Cerimonie: rinviata solo la definizione delle sedi — 2026-10-19

- Chiarimento dell’utente: saltare soltanto la definizione delle sedi reali e
  della loro disposizione, ancora sconosciute; proseguire con le altre funzioni
  delle cerimonie e renderle disponibili in production per la revisione.
- Non sospendere l’intera tranche e non passare automaticamente agli accessi
  Forum. Nessuna capienza o piantina reale va inventata; configurazioni definitive
  e assegnazioni operative attendono i dati delle sedi.
- L’utente conferma solo Admin per la revisione iniziale. Funzioni E1/E2/E3 già
  nel deployment production READY `a42994a`, migration presenti; nessun nuovo
  deployment necessario per accedere alla sezione da Forum → Cerimonie.
- Rieseguite con successo le suite SQL su PostgreSQL temporaneo, comprese
  cerimonie e concorrenza. Browser production senza sessione: redirect al login;
  revisione autenticata Admin ancora da svolgere. Nessun dato reale modificato.
- Consultazione QR con incarichi cerimonia e ingressi dedicati restano lavoro
  distinto da completare; non considerarli implementati dalla presenza di E1/E2/E3.
  Apertura generale Forum sempre subordinata al via libera.

## Scheda partecipante: movimento residuo — 2026-10-19

- Riprodotto salto dello sfondo dopo rinnovo cookie durante una lettura via
  Server Action: il framework ricostruiva la pagina e rimontava i giorni.
- Letture iniziali tramite endpoint HTTP private/no-store, con funzioni e scope
  canonici; soli inspect/read ammessi. Salvataggi, presenze e stampa conservati.
  Nessuna migration. Test esteso con pagina scorsa e rinnovo cookie; verbale in
  `docs/scheda-partecipante-caricamento-2026-10-19.md`.

## Scheda partecipante: visualizzazione dopo caricamento — 2026-10-19

- Su richiesta dell’utente, scheda Manager/Admin con unico caricamento iniziale:
  QR e immagine decodificata, partecipazione, contatori stampa, giorni comunicati,
  anagrafica aggiuntiva, associazione/accessibilità e indicatori adulto/minori.
- Contenuti nascosti e inert fino al completamento; intestazione/chiusura ferme.
  Nessun caricamento prima dell’apertura e nessun pulsante Mostra QR aggiuntivo.
- Errori conclusivi visibili nella scheda; dopo 25 secondi di attesa incompleta,
  retry esplicito o chiusura. Risposte tardive scartate dopo chiusura/cambio persona.
  Dopo la visualizzazione, nessun rimontaggio globale su salvataggi/aggiornamenti.
- Permessi, azioni presenza/stampa e bozze conservati. Nessuna migration aggiuntiva.
  Pubblicata su main con i QR gruppo (`7251f7d`), production READY; verbale in
  `docs/scheda-partecipante-caricamento-2026-10-19.md`.
- Superati 961 test, lint, TypeScript, build production pulita, browser con
  letture rallentate/errori/timeout e regressione azioni originali su PostgreSQL
  temporaneo, inclusa revoca ruolo. Nessuna scrittura remota o stampa fisica.

## QR gruppo Manager/Admin — implementazione del 2026-10-19

- Pulsante «QR del gruppo» nelle gestioni Manager/Admin, per gruppi attivi
  dell’evento corrente autorizzato; finestra e download condivisi col capogruppo.
- Nuova migration `20261019120000_manager_group_qr_access`: Manager circoscritto
  all’evento, get esclusivo, token stabile e creazione unica sotto lock. Scope
  capogruppo e Admin conservati; nessuna estensione a scanner/stampa gruppo.
- Su richiesta esplicita, applicate e registrate in production le migration
  `20261016160000` e `20261019120000` atomicamente, dopo backup custom verificato.
  65 tabelle e 128.982 righe invariate, 2.474 voci catalogo confrontate; sola RPC
  prevista modificata. 47 QR conservati, ACL invariati, Forum internal e scuole
  attive. Commit `7251f7d` su main, deployment production READY e dominio
  verificato. Browser non autenticato: nuove superfici collaudate sinteticamente,
  online verificati sito pubblico, protezione dashboard e assenza errori nei log.
- Superati 961 test, lint, TypeScript, build pulita con npm ci, SQL/concorrenza
  e browser sintetico desktop/mobile del componente condiviso. Dati e ACL
  invariati; nove prime letture condividono un solo QR/audit. Dettagli in
  `docs/qr-gruppo-manager-2026-10-19.md`. Nessuna scrittura operativa remota.
- L’utente ha poi richiesto di completare prima del rilascio anche il caricamento
  congiunto della scheda partecipante, descritto nella sezione dedicata.

## Ultima settimana prima dell’evento — decisioni del 2026-10-19

- Piano corrente: `docs/piano-ultima-settimana-2026-10-19.md`. Prevale sulle
  precedenti priorità e sulle note storiche superate da queste decisioni.
- Ordine richiesto: **1) QR gruppo subito; 2) inaugurazione e cerimonia finale;
  3) accessi Forum e ruolo dedicato; 4) statistiche**. L’apertura Forum è
  indipendente dalla sequenza: procedere appena arriva il via libera, senza
  aspettare la conclusione degli altri punti. Scuole già aperte da conservare.
- QR gruppo stabile anche lato DB, senza revoca, cambio o annullamento.
  Verificare stato/compatibilità della migration `20261016160000` prima di
  completare il vincolo. Aggiungere il pulsante visualizzazione/download nella
  gestione gruppi Manager, entro il suo scope autorizzato.
- Cerimonie: completare e attivare le funzioni già sviluppate sul branch Panel
  e integrate in main; sedi indipendenti, settori, quote, assegnazioni e posti
  numerati dove necessari. Servono configurazioni reali e revisione dell’utente.
- Accessi: scansione QR, prenotazione ed esito ammissione/rifiuto con ruolo
  esclusivamente dedicato al Forum assegnato, senza gestione generale.
  Consultazione settore/posto per Forum e cerimonie con incarichi pertinenti;
  permessi server/DB e distinzione ingresso evento/Forum da conservare.
  Funzioni pronte e verificate entro l’inizio dell’evento.
- Statistiche: controllare conteggi e leggibilità, distinguendo iscritti,
  prenotati e presenze effettive, con filtri e riepiloghi comprensibili.
- Da ora sviluppo direttamente su **main** e rilascio/test in **production**.
  L’utente specificherà per tranche il pubblico: solo Admin oppure Manager e
  operatori previsti, eventualmente con collaudatori selezionati. Nessuna
  estensione implicita dei permessi o apertura Forum prima del via libera.
  Prove con scritture operative/invii reali da concordare nel caso concreto.
- L’utente conferma riusciti i test stampanti/stampa QR e accetta la dashboard
  Accoglienza: non riprendere automaticamente i collaudi hardware storicamente
  sospesi; correggere problemi concreti se emergeranno.
- Accrediti stampa/P13-S esclusi per questo evento, eventualmente l’anno
  prossimo. Altre voci dell’inventario fuori da questa settimana salvo nuova
  richiesta; confermato il rinvio del controllo revisione sulla conferma
  individuale presenze. Aggiornare piano/verbali al completamento delle tranche.

## Caricamento iscritti e paginazione server — 2026-10-17

- Conservata la paginazione a 100 del collega (`b12455c`), testi e aspetto invariati.
  Indice globale compatto solo sul server; filtri/ordinamento/totali prima della
  pagina, dettagli solo per le righe visibili e l'eventuale scheda tramite URL.
  Letture ordinate a 500, al massimo tre parallele, senza tetto al totale.
- Questionario: una proiezione condivisa per nazionalità/associazione/delega email,
  anche nelle viste complete; ultimi valori vuoti e deleghe storiche conservati.
  Sesso interno solo per colonna visibile e autorizzata, mai nel normale snapshot.
- Menu Admin/Manager, tab ruoli e importazioni non precaricano le altre sezioni:
  il collaudo online aveva rilevato richieste concorrenti non necessarie. Link,
  testi e aspetto invariati, destinazione caricata al clic.
- Export, statistiche/drilldown, figli, duplicati e scuole conservano dati completi
  e scope evento. Nessuna migration, modifica dati reali o email. 960 test,
  lint, TypeScript, build dal lockfile e browser sintetico desktop/mobile;
  5.005 iscrizioni anche nell'Excel riletto. Parità dei dati reali e riduzione
  del tempo del loader misurate in sola lettura. Dettagli e limiti in
  `docs/iscritti-caricamento-server-2026-10-17.md`.
- Commit/push e produzione autorizzati dall'utente dopo test e miglioramento
  verificato; lavorazione isolata da main locale e modifiche parallele.

## Iscritti: paginazione da 100 — 2026-10-17

- Tabella condivisa Admin/Manager/Viewer paginata dopo filtri e ordinamento
  dell'intero risultato autorizzato. Conteggi ed Excel restano completi;
  figli sempre sotto il genitore. Filtri applicati conservati a ogni pagina.
- `participantPage` nell'URL, cronologia locale senza nuove richieste RSC,
  bozze non applicate conservate. Scheda e percorsi di ritorno mantengono
  pagina e filtri; ricerca, reset, ordinamento e cambio vista ripartono da 1.
- Navigazione sopra/sotto la tabella, scelta diretta e intervallo/totalità;
  vuoti, URL non validi e risultati ridotti gestiti senza pagine vuote spurie.
- Ottimizzato il rendering di 100 righe; letture DB e snapshot completi
  conservati. Non equivale a paginazione delle query o a una misura production.
  Presenze dopo azioni e ogni 15 minuti invariate; nessuna migration.
- 950 test, lint, TypeScript, build production con npm ci e browser sintetici
  desktop/mobile Admin/Manager/Viewer superati, incluse ricerca lenta e
  regressioni presenze. Verifiche senza scritture remote, email o stampa.
  Commit/push su main richiesti dall'utente; nessuna migration necessaria.
  Dettagli e limiti in docs/iscritti-paginazione-2026-10-17.md.

## Presenze: comportamento attuale confermato — 2026-10-17

- Dopo il chiarimento sui conflitti fra dispositivi, l’utente considera il
  caso limite molto improbabile e chiede di lasciare per ora tutto invariato.
  Conservare aggiornamento dopo i salvataggi e riconciliazione ogni 15 minuti.
- All’apertura della scheda la presenza viene riletta; correzioni e rimozioni
  controllano la revisione e bloccano modifiche basate su una versione superata.
  Confermare due volte una presenza già attiva non crea duplicati.
- Limite noto della conferma individuale: non verifica la revisione. Una scheda
  rimasta aperta con stato assente può riconfermare una presenza che un’altra
  postazione ha nel frattempo confermato e poi annullato. L’estensione del
  controllo di revisione anche alle conferme è rinviata per scelta esplicita
  dell’utente; non implementarla come seguito automatico di questa discussione.
- Nessuna modifica applicativa o migration aggiuntiva per questo chiarimento.

## Rilascio congiunto presenze, scuole e Forum capogruppo — 2026-10-17

- L’utente richiede commit e push su main delle tre modifiche e le migration
  necessarie. Forum personali/capogruppo restano nascosti e chiusi fino
  all’apertura generale; link scuole indipendente conservato attivo.
- Applicate e registrate in production `20261017120000_group_panel_waitlist`
  e `20261017180000_school_class_slot_constraints`, atomicamente prima del
  codice e dopo backup custom verificato. Confrontate 2.422 voci di catalogo;
  dati canonici di 63 tabelle, 110.587 righe, invariati. Privilegi conservati.
- Confermati `internal`, catalogo pubblico vuoto e flag scuola attivo.
  Nessun cambio di apertura, staging, email reale o prova hardware.
- Superati 948 test, lint, TypeScript, build production con npm ci e browser
  originali sintetici delle tre superfici, SQL e concorrenza. Presenze a
  15 minuti verificate anche nel browser. Verbali hardware paralleli esclusi.
  Dettagli in docs/rilascio-presenze-scuole-forum-2026-10-17.md.
- Commit `26d1ad0` pubblicato su main; deployment Vercel production READY e
  dominio operativo verificati. Browser pubblico: scuole disponibili con
  16 opzioni e noindex/nofollow, nessun link scuole nella home, accesso Forum
  capogruppo protetto. Confermati DB internal e nessun errore runtime rilevato
  nei controlli del rilascio; nessun modulo reale inviato.

## Iscritti: presenze dopo le azioni e rendering selettivo — 2026-10-17

- Eliminato il controllo ogni 10 secondi. Le liste rileggono dopo comandi
  Accoglienza riusciti, anche da un’altra scheda dello stesso browser;
  BroadcastChannel trasporta solo invalidazioni, mai dati personali o QR.
- Per altre postazioni: riconciliazione ogni 15 minuti su richiesta dell’utente, sospesa a tab nascosta;
  ripresa dopo almeno un minuto o avvisi pendenti, recupero connessione e
  pulsante Aggiorna presenze. Statistiche ingressi sempre su richiesta.
- Store per provider e sottoscrizione per persona/scuola: nessun render degli
  indicatori invariati. Richieste accorpate, risposte anteriori a un salvataggio
  scartate; errori/revoca cancellano il dato e non inventano assenze.
- Superati 948 test, lint, TypeScript, build production pulita e browser
  sintetici desktop/mobile: 500 persone, zero render se nulla cambia e uno
  per una persona modificata; salvataggi, altra scheda e campi non salvati.
  Nessuna migration, scrittura remota, email, stampa fisica o pubblicazione.
  Dettagli in docs/iscritti-aggiornamento-presenze-2026-10-17.md.

## Scuole: vincolo per docente e classe — 2026-10-17

- Su richiesta dell’utente, classi diverse dello stesso docente possono
  prenotare Forum contemporanei. Una classe con i suoi accompagnatori occupa
  un solo Forum per fascia/giorno, anche tra prenotazioni separate.
- Identità evento/docente/scuola/città/classe normalizzata; quantità escluse
  dalla chiave. Fasce Rome mattina/pomeriggio e sovrapposizioni effettive;
  sostituzione atomica, annullamento e altre classi indipendenti.
- Migration locale 20261017180000_school_class_slot_constraints: proiezione
  privata con vincoli univoci/esclusione differiti, trigger su riserve,
  classe/stato e orari. Concorrenza protetta anche senza RPC; nessun dato
  canonico modificato. Backfill con conflitti abortisce senza cancellazioni.
- Selettore condiviso pubblico/docente, blocco delle opzioni incompatibili,
  istruzioni/errori in sette lingue e link alla gestione. Home e accesso
  personale invariati; nessuna raccolta di nomi studenti/accompagnatori.
- Superati 913 test nella copia pulita, lint, TypeScript, build production,
  SQL/concorrenza/migrazione e browser originali sintetici desktop/mobile.
  Nessun invio reale, commit/push o migration remota. Applicare la migration
  prima del codice al rilascio autorizzato. Dettagli e limiti dichiarativi in
  docs/scuole-vincolo-classe-2026-10-17.md. Lavori paralleli conservati.

## Scuole tramite link diretto — 2026-10-17

- L’utente richiede l’abilitazione operativa di /scuole, fuori dalla home,
  con tutti i Forum pubblicati che hanno posti scuola disponibili. Apertura
  generale e prenotazioni personali/capogruppo restano internal/chiuse.
- Flag school_link_enabled separato, gate server/DB, noindex/nofollow e nessun
  link scuole nella home. Capacità e lock canonici; docente limitato ai propri
  dati con metadati Forum dedicati. Corretti get service-role e payload docente.
- Quantità Forum seguono i totali classe e restano riducibili. Superati 937 test,
  lint, TypeScript, build pulita e SQL/concorrenza/browser originali sintetici.
- Migration 20261017160000_school_direct_link applicata/registrata in production
  dopo backup verificato: 63 tabelle, 110.398 righe invariate. Attivazione del solo
  flag scuola separata dal deployment; nessuna apertura Forum generale.
  Staging, coda capogruppo e verbali hardware paralleli esclusi; nessuna email
  reale di collaudo. Dettagli in docs/scuole-link-diretto-2026-10-17.md.

## Mail: filtro giorni di presenza da comunicare — 2026-10-17

- Nella selezione destinatari delle campagne, scheda Partecipanti, nuovo filtro
  Giorni di presenza: Tutti / Non ancora comunicati / Comunicati. Si combina
  con ricerca e filtri esistenti; cambio destinatari azzera il filtro.
- Fonte canonica event_attendance_choices delle iscrizioni raggiungibili:
  nessuna scelta o choice unknown = da comunicare; scelte yes/no senza unknown
  = comunicati. Nessun uso dei check-in o delle prenotazioni ai Forum.
- Lettura paginata per ID già autorizzati; errore blocca il caricamento anziché
  inventare presenze mancanti. Selezione esplicita e invii delegati conservati.
- Verificati test caricamento oltre 1.000 destinatari, casi yes/no/unknown,
  errori, browser desktop/mobile, ricerca, selezione e cambio audience.
  Nessuna migration, invio email o modifica di dati remoti.

## Accoglienza: ultime letture con sola apertura — 2026-10-17

- Su nuova indicazione dell’utente, tutte le ultime letture offrono soltanto
  Apri Scheda: nessuna azione diretta di presenza o stampa nella cronologia.
- Gruppi e famiglie restano integrati nella scheda risultato. Per i gruppi,
  pulsante Stampa i QR delle persone selezionate; rimossi titolo Scegli i QR
  code da stampare e relativo testo esplicativo. Selezione e rimozione conservate.

## Accoglienza: scheda gruppo integrata e azioni recenti — 2026-10-17

- Gruppi e famiglie mostrano la selezione direttamente nella scheda risultato,
  senza modale automatica. Ultime letture: azioni presenza/stampa per singolo;
  Gestisci Presenze e Scegli i QR code da stampare per gruppi/famiglie.
- Rilettura prima delle azioni recenti; stato persona coerente fra singolo e
  gruppo. Conteggi distinti di conferma/rimozione e QR; deselezionare non annulla.
  Rimozione nominale esplicita con Conferma rimozione e Annulla, senza Chiudi.
- Telefono senza stampa; selezione, minori, snapshot, revisioni e retry conservati.
  Nessuna migration o scrittura remota. Dettagli e verifiche in
  docs/accoglienza-scheda-inline-2026-10-17.md.

## Forum capogruppo e lista d’attesa — 2026-10-17

- Verificato dopo fetch: branch panel `095af93` interamente integrato in main
  `2c6261b`, tramite merge `384f58a`. Prenotazioni capogruppo già presenti e
  nascoste fino a modalità `open`; solo `catalog` non apre le prenotazioni.
- Completata localmente la coda capogruppo: inserimento/rimozione per persona,
  posizione, offerta e conferma esplicita entro 30 minuti, con avviso del cambio
  del Forum nella stessa fascia. Minori inclusi; partecipanti senza account
  supportati. FIFO, deduplicazione e riserve condivise con il flusso personale.
- Notifica al capogruppo che inserisce la richiesta, nella lingua scelta nella
  sua interfaccia; link alla dashboard senza conferma automatica. Richieste già
  esistenti conservano destinatario e priorità. Revoca o uscita del partecipante
  dallo scope bloccano operazioni e claim e cancellano le richieste non più valide.
- Migration locale `20261017120000_group_panel_waitlist`: helper privati condivisi,
  nuova RPC autenticata, metadati destinatario e catalogo esteso. Scope e RLS
  conservati; nessuna apertura pubblica. Polling della sola vista ogni 5 minuti,
  filtri conservati, errori/recupero e scadenza espliciti; testi in sette lingue.
- Superati 933 test, lint, TypeScript, build production con npm ci in copia
  pulita, SQL/concorrenza e browser desktop/mobile con pagina/azioni originali
  e PostgreSQL temporaneo. Nessun invio reale, migration remota o commit/push.
  Dettagli in docs/group-panel-waitlist-2026-10-17.md. Lavori Accoglienza
  paralleli conservati. Applicare la migration prima del futuro rilascio codice.


## Dashboard Accoglienza: controlli e ultime letture — 2026-10-17

- Rimossi dalla dashboard Strumenti stampante e il link al collaudo: la
  postazione viene preparata e provata prima dell’uso operativo.
- Passaggio al codice manuale e ritorno allo scanner con pulsante secondario
  e icona, coerenti con il sito. Ultime letture in un riquadro aperto di default,
  richiudibile anche da tastiera; apertura scheda con pulsante secondario.
- Verificati browser desktop/mobile su fixture sintetica: stato vuoto,
  inserimento manuale, apertura/chiusura conservata durante le letture,
  riapertura scheda e assenza di scritture delle presenze.

## Partecipazione nella scheda e accesso Manager circoscritto — 2026-10-16

- Rimozione esplicita anche nella scheda aperta dal nome: selezione delle
  persone, Rimuovi presenza e conferma con i nomi; deselezionare non annulla.
  Adulto/minori, selezione comune, stato tabella e stampa separata conservati.
- Chiarimento dell’utente: abilitare anche il solo ruolo Manager, soltanto
  nella scheda del partecipante. Conferma/rimozione e stampa QR ora visibili
  in quella superficie. Viewer esclusi; scanner, gruppi e cerimonie invariati.
- Nuove azioni/RPC legate all’iscrizione e al codice; ruoli riletti a ogni
  operazione. Migration 20261016200000_manager_participant_reception:
  implementazioni canoniche condivise, vecchi gate conservati, nuove RPC
  service-only. Audit, revisioni, retry e contatori conservati; dati invariati.
- Superati 906 test, lint, TypeScript, build pulita, SQL/concorrenza e browser
  sintetici desktop/mobile con tabella e azioni originali su DB temporaneo,
  inclusa revoca. Nessuna email, stampa fisica o modifica di dati applicativi reali.
- Al rilascio richiesto dall’utente, migration applicata e registrata in
  production prima del push, con backup custom verificato: 63 tabelle e 88.248
  righe invariate, 2.501 voci di catalogo confrontate. Staging invariato.
  Commit/push su main autorizzati; verbali hardware paralleli esclusi.
- QR visibile solo dopo un clic ulteriore richiesto come prompt, non ancora
  implementato. Download e stampa conservati. Dettagli in
  docs/partecipazione-scheda-manager-2026-10-16.md.

## Accoglienza: scansione diretta e rimozione esplicita — 2026-10-16

- Stato come unico riscontro della conferma; pulsante invariato e senza
  animazione di successo. Rimuovi presenza / Rimuovi presenze selezionate
  sulla selezione comune, rilettura e conferma con i nomi; mai deselezione
  come comando di annullamento. Revisioni, snapshot, audit e retry conservati.
- Scanner USB apre subito il nuovo QR, anche dall’elenco gruppo; nessun
  passaggio intermedio obbligatorio. Pausa durante scritture, stampa,
  conferme/scuole o esito incerto. Telefono conserva ripresa esplicita.
- Rimosso Badge completo e sedute cerimonie dalla console evento. Ultimo stato
  verificato conservato durante richieste/esiti incerti; ruoli e Forum invariati.
- Superati 903 test, lint, TypeScript, build pulita, SQL/concorrenza e browser
  sintetici, comprese pagina/azioni originali su PostgreSQL temporaneo.
  Nessuna migration, scrittura reale, email o stampa fisica. Commit/push su main
  richiesti dall’utente; verbali hardware paralleli esclusi. Dettagli in
  docs/accoglienza-scansione-diretta-2026-10-16.md.

## Funzioni Accoglienza aperte al ruolo operativo — 2026-10-16

- Su richiesta dell’utente, scanner, partecipazione, etichette QR e badge gruppo
  sono disponibili agli Admin globali e al ruolo Accoglienza dell’evento corrente,
  anche cumulato con Manager. Manager da solo resta escluso. Nuove assegnazioni
  e revoche sono rilette a ogni operazione; nessun elenco statico o accesso anonimo.
- Pagina, azioni server e DB allineati. Forum/sala conservano il requisito del
  proprio incarico. Gate Admin di cerimonie e gestione incarichi invariati;
  conferma e stampa separate, selezione, minori, audit e retry conservati.
- Collaudo sintetico spostato in /dashboard/accoglienza/collaudo; vecchio percorso
  Admin compatibile. Nessuna estensione alle altre funzioni amministrative.
- Migration 20261016180000_reception_role_access applicata e registrata in production
  dopo backup custom verificato: 63 tabelle, 88.029 righe invariate e 2.497 voci di
  catalogo confrontate. Solo gate operativi e due funzioni nuove; privilegi delle
  RPC e RLS conservati. Otto account Accoglienza, cinque anche Manager.
- Superati 900 test, lint, TypeScript, build production pulita, SQL/concorrenza e
  browser con pagina/azioni originali e PostgreSQL sintetico, inclusa revoca.
  Nessuna email, dato reale modificato o stampa fisica; staging invariato.
  Pubblicazione su main richiesta con l’apertura agli operatori; verbali hardware
  paralleli esclusi. Dettagli in docs/accoglienza-accesso-ruolo-2026-10-16.md.

## Partecipazione e stampa: azioni separate sulla selezione comune — 2026-10-16

- Correzione dell’utente: due pulsanti distinti, mai un comando combinato.
  Conferma partecipazione e stampa QR utilizzano la stessa persona/selezione,
  conservata dopo ciascuna azione. Valido in Accoglienza e nei partecipanti.
- Sotto il nome nella tabella resta solo Partecipazione non confermata /
  Partecipazione confermata con data. Rimossa la modifica da quel punto.
  Nella scheda, conferma e stampa stanno insieme all’inizio del riquadro QR;
  il singolo si conferma con un clic e riscontro verde, senza un’altra modale.
- Minori selezionabili separatamente e QR genitore deduplicato; nessuna
  presenza implicita dalla stampa e nessuna stampa dalla conferma. Rilettura,
  identità della registrazione, Admin, esclusioni, correzioni/revisioni, audit,
  contatori e retry idempotente conservati. Chiusura bloccata durante richieste
  e presenza incerta. Le nuove funzioni non estendono i permessi Manager.
- Verificati test applicativi, lint, TypeScript, browser sintetici partecipanti,
  USB e telefono; stampa simulata. Nessuna migration, email o scrittura su dati
  reali. Commit/push production autorizzati; modifiche parallele ai QR gruppo
  e verbali hardware esclusi. Dettagli in
  docs/partecipazione-e-stampa-separate-2026-10-16.md.

## QR del gruppo stabile, visualizzazione e download — 2026-10-16

- Il QR del gruppo resta sempre lo stesso. Rimossi revoca, rinnovo e modifica
  anche per gli Admin; questa richiesta supera le precedenti regole che
  consentivano la gestione Admin del QR di gruppo.
- Il pulsante usa ProgressButton e apre direttamente nome gruppo e immagine;
  visualizzazione e Scarica QR, senza conferme di revoca. Il download conserva
  esattamente il QR mostrato, come precisato dall’utente. Non esiste un
  codice pubblico del gruppo da aggiungere. Focus, Escape, errori e sette
  lingue conservati; nessuna richiesta prima del clic.
- Server Action limitata a get, comprese le validazioni runtime. Migration
  locale 20261016160000_stable_group_qr limita anche la RPC a get: prima
  creazione unica sotto lock, letture successive senza sostituzione, audit di
  creazione conservato. Nessuna modifica ai token esistenti o ai privilegi;
  eventuali revoche storiche non vengono riattivate implicitamente.
- Verifiche sintetiche: 898 test, lint, TypeScript, build production in copia
  isolata, SQL/concorrenza e browser desktop/mobile. Nessun dato remoto, email
  o stampa. Commit/push su main richiesti dall’utente; migration production
  non applicata per questa modifica. Dettagli in
  docs/qr-gruppo-stabile-2026-10-16.md.

## Accoglienza semplificata: presenza diretta e selezione unica — 2026-10-16

- Su richiesta dell’utente, dopo la scansione singola bastano nome, codice,
  stato e Registra presenza: un clic, nessuna modale, risposta verde con spunta
  solo dopo il salvataggio. La scansione resta senza scritture automatiche.
- Gruppi e famiglie con minori: un solo elenco nella finestra, selezione unica
  per presenze e stampa, conteggi per persona e selezione conservata alla
  riapertura. Registra presenze e stampa QR salva prima gli ingressi e poi
  stampa; comandi separati sempre disponibili. Minori sul QR genitore,
  deduplicato, senza registrare persone non selezionate.
- Conflitto o esito incerto delle presenze impediscono la stampa; retry dello
  stesso comando. Dopo una stampa fallita si riprova solo la stampa sulla
  selezione conservata. Nessuna conferma fisica implicita. Correzioni,
  annullamenti, scope Admin, snapshot, revisioni, audit e coda conservati.
- Vista telefono senza stampa; lettori nascosti durante la scheda. Scuole,
  Forum e assistenza mantengono le proprie regole. Strumenti stampante e
  badge completo del gruppo restano in sezioni richiudibili.
- Superati 898 test, lint completo, TypeScript, build production pulita,
  SQL/concorrenza e browser sintetici desktop/mobile, inclusi minori, doppi
  clic, errori e regressioni delle altre superfici. Nessuna migration o prova
  su dati reali, email o stampa fisica. Commit/push production autorizzati.
  Dettagli in docs/accoglienza-semplificata-2026-10-16.md.

## QR del gruppo diretto per il capogruppo — 2026-10-16

- Su richiesta dell’utente, QR del gruppo è accanto a Gestisci link nella
  dashboard capogruppo, per il gruppo della riga. Rimosso dalla modale link;
  apertura diretta con nome gruppo, immagine e download, senza un secondo clic.
- L’utente abilita esplicitamente i capigruppo ai QR dei propri gruppi.
  Lettura/creazione iniziale del QR opaco tramite get, scope attivo e controlli
  server/DB. Revoca/rinnovo, scanner, presenze e stampa restano solo Admin.
  Nessuna richiesta QR prima del clic e nessuna rotazione sulle letture ripetute.
- File scaricato qr-gruppo-Nome-del-gruppo.png; caratteri internazionali
  conservati, separatori del filesystem rimossi. Testi in sette lingue.
- Migration 20261016130000_leader_group_qr_access applicata e registrata in
  production dopo backup custom verificato: valori di 63 tabelle (87.791 righe)
  invariati, catalogo di 2.497 voci confrontato, sola funzione credenziale
  modificata e privilegi conservati. Staging invariato, nessuna email o stampa.
- Superati 898 test, lint, TypeScript, build pulita, browser sintetico con
  download PNG effettivo e SQL/concorrenza; otto get simultanei condividono
  una credenziale e un solo audit di creazione. Dettagli e backup in
  docs/qr-gruppo-capogruppo-2026-10-16.md. Commit/push su main autorizzati.

## Accoglienza distinta per computer e telefono — 2026-10-16

- All’apertura della dashboard si sceglie esplicitamente Computer (scanner
  USB e stampa) oppure Telefono (fotocamera e sole presenze); la scelta resta
  nella pagina e si può cambiare a operazione conclusa. Nessun rilevamento
  hardware implicito e nessuna preferenza persistente del dispositivo.
- In modalità telefono non vengono montati né la coda etichette QR né il
  pannello badge completo; assenti anche preparazione badge e link al collaudo
  stampante. Restano lettura manuale, singoli/gruppi/scuole e conferme presenze.
- All’ingresso evento la fotocamera apre la scheda senza registrare presenze,
  con gli stessi comandi espliciti del computer. Nuovi QR ignorati fino a
  Passa al prossimo codice, senza consumare il codice per la prossima lettura.
  Cambio modalità bloccato durante selezione, stampa, richieste o esiti incerti;
  smontaggio della console rilascia la fotocamera e azzera la cronologia locale.
- Accesso Admin e controlli server/DB conservati. Nessuna migration o modifica
  di dati remoti. Verifiche browser sintetiche, stampa simulata; prove hardware
  ancora sospese. Rilascio su main autorizzato dall’utente; nessuna migration necessaria.
- Superati 895 test, lint, TypeScript, build production in copia isolata e
  browser sintetico telefono/USB/fotocamera. Dettagli e verifiche in
  docs/accoglienza-modalita-dispositivo-2026-10-16.md.


## Modifica ingresso dalla gestione partecipanti — 2026-10-16

- Su richiesta dell’utente, lo stato sotto nome/codice nella tabella iscritti
  è cliccabile per gli Admin e apre direttamente la modifica della presenza,
  senza entrare nella scheda. Manager/Viewer conservano la sola lettura;
  iscrizioni non operative escluse.
- Rilettura dal codice pubblico, selezione adulto/minori e conferma esplicita
  tramite azione/RPC accoglienza esistenti. Revisioni, audit, annullamento e
  retry della stessa richiesta conservati. Aggiornamento immediato dell’elenco
  dopo il salvataggio; nessuna migration, stampa o email.
- Verificati browser sintetico desktop/mobile, tabella Admin/Manager/Viewer,
  selezione minori, Escape/focus, doppio clic, conflitti, esiti incerti e revoca;
  regressioni scanner USB, SQL/concorrenza su PostgreSQL temporaneo, 895 test,
  lint, TypeScript e build production pulita. Nessuna scrittura su dati reali.
- Commit/push su main autorizzati per questa conversazione. Dettagli in
  docs/presenza-gestione-partecipanti-2026-10-16.md.

## Manuale per consegnare postazioni Windows già pronte — 2026-10-16

- L’utente precisa che gli operatori devono stampare con un clic dalle normali
  schede Chrome, nel formato corretto, senza accorgersi del setup. Tutta la
  preparazione e il collaudo competono a chi consegna la postazione.
- Manuale esterno Word/PDF aggiornato in Documents/Iscrizioni Pace/Manuali:
  driver distinti QL-800/QL-810Wc, continuo DK-22210 29 × 45, taglio ogni pagina,
  default Windows e utente/profilo operativo. Aggiunte policy Chrome per pagina
  custom 29000 × 45000 micrometri e intestazioni disattivate, oltre alle due
  policy già previste. Comandi solo documentati, non applicati su dispositivi.
- Formato Windows e disponibilità in Chrome richiedono verifica effettiva:
  tentativo di modulo personalizzato descritto senza garantirne l’accettazione
  da parte del driver; la policy pagina viene ignorata se il formato non è
  disponibile. Non consegnare con carta errata o dialoghi ancora necessari.
- Collaudo richiesto singolo, gruppo, nuova scheda e riavvio del PC; prova
  separata per ciascun modello e per eventuale cambio del predefinito.
  Manuale renderizzato e verificato in tre pagine; Windows fisico resta
  da collaudare. Prove hardware ancora sospese come richiesto dall’utente.

## QL-800 sul Mac con stampa silenziosa nel Chrome normale — 2026-10-16

- QL-800 collegata al Mac attuale: USB rilevata, ma inizialmente presente solo
  la coda QL-810W. L’utente installa il driver ufficiale Brother 4.0.4a per
  macOS 26. Aggiunta coda Brother_QL_800 USB con driver QL-800 CUPS, predefinita
  per l’utente; carta Custom.29x45mm, BrTapeLength=45, taglio automatico ogni
  etichetta, una copia. Rosetta già presente. Coda QL-810W e suo lavoro pendente
  conservati, nessun trasferimento di lavori alla nuova stampante.
- Collaudo dal renderer/pulsante originali nella fixture sintetica NSL5 locale:
  l’utente seleziona QL-800 e DK-22210 29x45 mm nel dialogo Chrome normale;
  controllati una copia, margini nessuno, scala 100%. Job 24 completato e
  utente conferma una sola Ada Mori / NS01 corretta e completamente separata.
  Lettura del QR cartaceo e lotto QL-800 ancora da verificare.
- Sessione Chrome dedicata ancora con kiosk-printing e destinazione QL-810W;
  Chrome normale senza flag, usato per il successivo collaudo del profilo.
  L’utente preferisce qualsiasi scheda Chrome senza collegamento speciale.
  Preparato file locale Documents/Iscrizioni Pace/Manuali/Abilita stampa QR
  Chrome Mac.mobileconfig: ambito utente, solo SilentPrintingEnabled e
  PrintPreviewUseSystemDefaultPrinter, nessun account/certificato/MDM.
  Prima importazione manuale con Apri disabilitato; poi l’utente apre il file
  dal Finder e conferma l’installazione. Verificati entrambi i valori true in
  /Library/Managed Preferences/giovaniperlapace/com.google.Chrome.plist.
  Prova nel Chrome normale, campione NS01 e pulsante originale: utente conferma
  etichette uscite senza dialogo; conferma anche propri clic durante la prova.
  Job QL-800 25 e 26 completati, nessun lavoro QL-800 pendente. Esito positivo
  silenzioso su questa combinazione; non prova isolata di un solo clic, né
  certificazione di altre schede/profili, riavvio browser, gruppi o Windows.
- Manuale esterno Word/PDF aggiornato per Windows 11 x64 e QL-800/QL-810Wc,
  con policy Chrome >=144 per tutte le schede e default Windows. Nessuna
  impostazione Windows applicata dall’agente; stampa fisica Windows aperta.
  Nessun dato remoto, email, rilascio o modifica del codice applicativo qui.

## Rilascio accoglienza Admin in production — 2026-10-16

- L’utente richiede di portare in production tutte le funzioni di accoglienza,
  limitate agli account Admin: scanner USB sul QR mostrato dal telefono e
  stampa etichette QR singole o del gruppo da applicare ai badge. Autorizzato
  il rilascio su main con il normale deployment Git Vercel.
- Conservati lettura senza presenza automatica, conferme separate di presenza
  e stampa, selezione gruppo, contatore richieste e controlli server/DB Admin.
  Avviso della dashboard aggiornato per l’uso operativo autorizzato.
- Tutte le undici migration necessarie risultano già registrate in production;
  nessuna nuova migration necessaria. Controlli senza scritture applicative:
  4 Admin pronti, 12 non Admin esclusi anche dalla stampa; internal e catalogo
  pubblico vuoto. Nessuna email o stampa fisica avviata dall’agente.
- Superati 893 test, lint, TypeScript, SQL/concorrenza, browser sintetico
  USB/fotocamera/stampa e build production pulita. Nessuna stampa fisica
  automatica o prova di scrittura su dati reali.
- Il rilascio software non completa il collaudo della QL-800 su Windows:
  formato, taglio e stampa silenziosa restano da verificare sulla postazione.
  Verbale aggiornato in docs/scanner-usb-accoglienza-2026-10-15.md.

## Lettura Windows riuscita, QL-800 riconosciuta e da configurare — 2026-10-15

- PC Ethernet 10.10.5.151 su rete distinta dal Wi-Fi Mac; l’utente aggiunge la
  connessione Wi-Fi e la pagina LAN poi si apre. Nessun firewall o gateway
  modificato. Il proxy resta limitato alla fixture sintetica.
- Pagina inizialmente visibile ma comandi bloccati, confermati dall’utente;
  errori del canale WebSocket Next dev nella verifica Mac. Sostituita la sola
  copia di collaudo con build production Webpack separata, stesso URL LAN.
  Fallback UUID v4 getRandomValues solo nella fixture HTTP locale; codice
  applicativo e sito pubblicato invariati. Lettura browser → proxy → DB locale
  verificata senza presenza automatica. Nessuna pubblicazione remota.
- Dopo Ctrl+F5 l’utente conferma scansione fisica singola su Windows: Ada Mori
  / NS01 aperta. Richieste Windows HTTP 200 e inspect valid nel registro.
  Confermato DK-22210 nella QL-800. PC Windows 11 Home x64; Editor Lite spento
  confermato dall’utente. Dopo le istruzioni per l’installazione ufficiale Brother,
  l’utente conferma che QL-800 compare nelle stampanti Windows. Formato continuo
  29 × 45 mm e taglio per etichetta ancora da configurare/verificare.
  Nessuna stampa/taglio/silenziosa Windows
  ancora attestati. Richieste applicative non equivalgono a copie fisiche.
  Snapshot sintetico pre-stampa acquisito; prove e limiti nel verbale NSL5.


## Postazione Windows con QL-800, collegamento locale da risolvere — 2026-10-15

- L’utente precisa che il PC Windows accanto è collegato via Ethernet e ha già
  uno scanner e la Brother QL-800 collegati. Non trasferire implicitamente
  driver/calibrazione/risultati della QL-810Wc Mac alla QL-800 Windows.
- Il link LAN alla sola fixture sintetica non si apre sul PC. Mac su Wi-Fi,
  Ethernet Mac inattiva; servizio locale risponde HTTP 200, nessun blocco del
  firewall rilevato. Richiesti IPv4/gateway Windows e messaggio Chrome per
  diagnosticare il percorso. Nessuna configurazione rete/firewall modificata,
  nessun tunnel pubblico o pubblicazione della fixture. Windows resta aperto.


## Primo NSL5 sul Mac, passaggio a Windows — 2026-10-15

- L’utente autorizza il collaudo fisico di un NetumScan NSL5 sul Mac e poi sul
  PC Windows disponibile accanto. Non avendo due adattatori USB-C, scollega
  la Brother per collegare il lettore. Stampa simultanea sul Mac non attestata.
- Lettore enumerato come DM13 USB KBW / Newland Auto-ID; modello commerciale
  riferito dall’utente NSL5. Mac con layout Italiano Pro. Prima lettura fisica
  rifiutata: 43 caratteri, ma underscore diventa punto interrogativo e trattino
  apostrofo. Parser invariato. Dal manuale ufficiale L5/NSL5 mostrato il solo
  comando originale Italy Keyboard 606010D, senza reset o cambio layout OS.
- Dopo configurazione l’utente conferma Lettura esatta: payload sintetico di
  43 caratteri coincidente. Console originale in copia locale isolata, servizi
  e SQL originali, PostgreSQL temporaneo e adattatore Auth/trasporto sintetico;
  non equivale al login production. Nuovi campioni NS01–NS03 e gruppo sintetico.
- Singolo e gruppo G: letti fisicamente da schermo, senza ingressi automatici,
  confermati dall’utente e dalle RPC inspect. L’utente registra poi il singolo
  e le tre persone del gruppo. Agente verifica annullamento singolo e correzione
  selettiva gruppo con la UI: Ada e Bruno presenti, Carla senza ingresso;
  query read-only e UI concordano, audit/cronologia conservati.
- Richiesta stampa singola acquisita durante le prove dell’utente, nessun lavoro
  CUPS in attesa e nessuna etichetta fisica confermata per questa tranche.
  Nessun dato remoto o email. Nessuna nuova configurazione stampante, migration
  remota, pubblicazione, commit/push o nuova funzione scanner realizzata qui.
- Passaggio Windows avviato con URL LAN temporaneo limitato alla sola pagina
  sintetica/asset/azioni, su PC della stessa rete; nessun codice installato nel
  PC e nessun accesso ai dati del sito. Attesa apertura sul PC e disponibilità
  di collegare scanner e Brother insieme. Windows, secondo NSL5 e lettura delle
  etichette cartacee restano da collaudare. Verbale aggiornato in
  docs/scanner-usb-accoglienza-2026-10-15.md.


## Conteggio richieste di stampa QR — 2026-10-15

- Su richiesta dell’utente, accanto al pulsante individuale compare Stampe
  richieste: N; nella modale gruppo il conteggio compare per ogni persona.
  Testi dei pulsanti e selezione tramite check conservati.
- Valore attempts della coda canonica esistente, condiviso fra singolo/gruppo:
  letto all’apertura e aggiornato dalla risposta server dell’esito. Nessun
  polling, contatore locale persistente o migration. Durante la lettura
  iniziale compare un trattino, senza inventare uno zero.
- Il numero conta tentativi richiesti, inclusi quelli con errore dopo la
  preparazione; non certifica uscita fisica o consegna. Una lettura fallita
  non aggiunge tentativi e nessuna verifica fisica viene registrata.
- Browser sintetico desktop/mobile: storico iniziale, ristampe, riapertura,
  stampa gruppo seguita da lettura singola, errori, check, blocco doppio clic
  e pulizia iframe verificati con stampa simulata. Nessuna nuova stampa
  hardware o modifica a dati remoti. L’utente autorizza poi commit e push
  su main del solo conteggio; modifiche scanner USB escluse e conservate.
  Superati 893 test, lint mirato, TypeScript e build production pulita.

## Accoglienza da PC con scanner USB NSL5 — 2026-10-15

- L’utente sostituisce il progetto telefono associato alla postazione con due
  NetumScan NSL5 2D collegati ai PC delle stampanti. Scansione da telefono
  conservata per accessi/presenze a inaugurazione, conclusione e Forum;
  nessuna nuova funzione cerimonie introdotta in questa tranche.
- Ingresso evento nella dashboard Accoglienza parte da Scanner USB, con
  fallback manuale. HID/tastiera più Invio: token personale esatto o G: gruppo,
  senza URL, conversioni di maiuscole o simboli. Configurazione fuori dal
  flusso; priorità Windows conservata. Nessun rilevamento hardware dichiarato.
- La lettura apre la scheda e non registra presenze, anche per il singolo.
  Registra presenze apre la selezione; Modifica presenze rilegge e conserva
  conferma/annullamento, revisioni, snapshot e audit esistenti. Chiudi/Escape
  conservano la scheda senza salvare. Passa al prossimo codice riabilita la
  lettura; scansioni durante scheda, selezione, stampa o esito incerto ignorate.
- Stampa singolo/gruppo disponibile prima della presenza e indipendente da
  essa, tramite coda/renderer originali. Testi Stampa etichetta QR / Stampa i QR
  del gruppo, nomi/codici e selezione gruppo conservati. Minori sul QR genitore.
  Badge completo con sedute separato e conservato. Nessuna presenza o token
  scritto dalla stampa; ritorno browser non certifica l’uscita fisica.
- Pilot solo Admin e controlli server/DB conservati; nessuna nuova migration
  per lo scanner. Motore telefono Forum/sala conservato. Nessun pairing banco,
  trasporto telefono-PC o polling di postazione realizzato.
- Verificati 893 test, lint, TypeScript, build production con npm ci in copia
  pulita, SQL/concorrenza su PostgreSQL temporaneo, browser USB sintetico e
  regressioni fotocamera desktop/mobile. Stampa simulata; nessun NSL5 fisico o
  Windows collaudato. Nessun dato reale, email, configurazione hardware,
  migration remota, commit/push o deployment eseguito per questa tranche.
  Dettagli in docs/scanner-usb-accoglienza-2026-10-15.md.


## Rilascio stampa semplificata autorizzato — 2026-10-15

- L’utente richiede commit e push su main e migration necessaria in produzione.
  Pubblicazione con il normale deployment Git Vercel; scanner USB presenti
  contemporaneamente nel workspace esclusi dal commit e conservati sul disco.
- Applicata/registrata atomicamente 20261015120000_simple_qr_label_printing,
  dopo backup custom completo verificato, permessi 600. Dati delle 63 tabelle
  pubbliche (86.142 righe) invariati; 2.497 voci di catalogo confrontate, con
  modifica esclusiva della funzione QR prevista. Policy, privilegi e vincoli
  conservati. RPC service-only, internal, catalogo pubblico e coda vuoti.
- Codice e migration identici a quelli della build pulita già verificata.
  Dettagli e hash in docs/qr-label-simple-printing-2026-10-15.md. Staging
  escluso, nessuna email o nuova prova fisica automatica per il rilascio.

## Stampa semplificata, selezione gruppo conservata — 2026-10-15

- L’utente richiede un solo pulsante operativo, con testi invariati Stampa
  etichetta QR / Stampa i QR del gruppo. Rimossi scelta rotolo, conferma della
  stampante, Aggiorna elenco, istruzioni e conferma fisica delle etichette.
- Su precisazione dell’utente, la modale gruppo conserva nomi/codici e check
  per scegliere chi stampare, con Seleziona tutte. Il singolo resta diretto.
  Ogni nuovo clic è esplicito, anche per etichette già richieste; nessun cambio
  del testo del pulsante durante l’attesa o nelle ristampe.
- Profilo operativo continuo 29 × 45 mm DK-22210; configurazione fuori dal
  flusso. Storico/tentativi, stato canonico per iscrizione, audit, scope Admin
  ed esclusioni conservati. Ritorno browser non verifica l’uscita fisica.
- Migration locale 20261015120000_simple_qr_label_printing estende la sola RPC
  per un lotto atomico misto fra etichette nuove e precedenti, senza dati o
  privilegi modificati. Nessuna migration remota o pubblicazione eseguita.
- 886 test, lint, TypeScript, build production pulita, SQL/concorrenza e browser sintetico desktop/mobile
  superati: selezione, testo, ristampa, doppio clic fra pulsanti, errori/revoca,
  Escape/focus e pulizia iframe. Dettagli in
  docs/qr-label-simple-printing-2026-10-15.md. Nessuna nuova stampa fisica.

## Collaudo DK-22210 e priorità Windows — 2026-10-15

- L’utente riprende le prove fisiche singolo/gruppo con DK-22210 montato,
  QL-810Wc pronta sul Mac attuale. Windows è una destinazione principale:
  non progettare né attestare il funzionamento delle postazioni solo su Mac.
  Altra stampante e sito da computer mai configurato richiedono prove distinte.
- Prima calibrazione con dialogo visibile, renderer applicativo e campione
  sintetico Ada Mori / TEST-101: l’utente conferma una sola etichetta, taglio
  completo, contenuto integro, dimensione corretta e QR letto dal telefono.
  Nessuna misura numerica, modello telefono o tempo acquisiti separatamente.
- Formato macOS realmente creato/selezionato DK-22210 29x45 mm, margini zero,
  Chrome 100%, nessuna intestazione, una copia e taglio dopo ogni pagina.
  Preflight esteso alle carte macOS senza vendor_id, verificando definizione
  OS e conversione reale dei punti; scala Chrome Personalizzati=4 supportata.
- Prova dei pulsanti in copia locale isolata con PostgreSQL temporaneo,
  pannello/renderer/RPC originali e adattatore Auth/trasporto sintetico.
  Non equivale al login e ai dati del sito production. Primo tentativo dal
  profilo Chrome normale apre il dialogo. Dopo l’avvio tramite LaunchServices
  e conferma della finestra dedicata, l’utente conferma una sola C101 corretta,
  taglio completo e nessun dialogo dal pulsante Ristampa etichetta QR; job 13
  completed, una copia/pagina. L’utente conferma anche tre etichette gruppo
  C102–C104 corrette, separate e con un solo clic, senza duplicare Ada.
  CUPS registra due lavori di gruppo da tre pagine; non estendere il riscontro
  fisico a tutte le copie. Iscrizioni, token e ingressi locali invariati.
- L’utente richiede poi prova da questo Mac direttamente sul sito pubblicato:
  aperto il medesimo profilo silenzioso con finestra normale e barra indirizzi,
  per consentire il login, e sceglie esplicitamente Nicola Mastrorilli e il
  gruppo Anziani - Torrenova come scelta finale, prima della stampa di gruppo.
  Autorizza così le prove di stampa su questi
  record reali; nessun altro uso di dati reali o scanner è implicito.
  Verifica read-only: account scelto Admin globale, QR singolo attivo e
  nove etichette gruppo stampabili/pending. Snapshot mirato immutabile acquisito;
  login Admin e singola reale dal sito confermati dall’utente: una sola
  etichetta corretta, taglio completo e un clic senza dialoghi. Job 16 completed
  una copia/pagina e un solo tentativo production; snapshot mirato di iscrizioni,
  QR e presenze invariato. Poi confermate nove etichette Anziani - Torrenova
  corrette, tutte separate, un clic senza dialoghi dal sito; job 17 completed,
  nove pagine e un solo tentativo per persona. Snapshot mirato dopo il lotto
  invariato. L’utente conferma lettura al telefono del QR reale singolo e
  della prima/ultima etichetta del gruppo: tre QR letti, senza scanner operativo;
  conferme nel pannello esplicite, nessuna verifica automatica dalla chat.
- Procedura Windows in docs/collaudo-dk22210-2026-10-15.md: driver ufficiale
  per PC/modello, continuo 29 × 45 mm, taglio per pagina, calibrazione visibile,
  poi Chrome dedicato silenzioso e prove dal sito. Nessun Windows collaudato.
- Scanner USB e rimozione del flusso telefono+postazione rinviati esplicitamente
  a un’altra conversazione. Nessuna modifica scanner o migration remota;
  nessuna modifica a iscrizioni, token o presenze. Solo richieste/conferme di
  stampa degli ambiti esplicitamente scelti, nessuna email dall’agente,
  commit/push o deployment per queste prove.

## Pulsante QR gruppo uniforme — 2026-10-15

- Su richiesta dell’utente, il pulsante nella riga del gruppo usa le stesse
  dimensioni/stile delle azioni vicine: min-h-9, text-xs e font-semibold,
  senza la classe btn-secondary che imponeva un’altezza maggiore.
- Testo Stampa i QR del gruppo, coerente anche nel comando dentro la modale.
  Correzione di presentazione nel rilascio main, senza dati o migration.

## Forum non pubblicati con iscritti conservati — 2026-10-14

- Richiesta aggiuntiva dell’utente al rilascio Forum su main: pulsante Rendi non
  pubblicato, Admin/Manager, desktop/mobile e conferma esplicita. Home attuale
  e iscrizioni pubbliche chiuse conservate. Nessun Forum reale ritirato per prova.
- RPC autenticata e idempotente, evento corrente e lock Forum; cambia soltanto
  pubblicazione, con audit e visibilità derivati dai trigger esistenti. Iscrizioni
  individuali, minori, scuole e roster conservati; ripubblicazione disponibile.
- FIFO in attesa conservata, offerte temporanee annullate come già previsto dal
  DB. Migration 20261014160000_forum_unpublication mantiene anche gli ID delle
  quote nel salvataggio bozza, per consentire modifiche successive senza perdere
  riferimenti alle prenotazioni. Vincoli di capienza e FK conservati.
- Verificati 884 test, lint, TypeScript, SQL/concorrenza e browser con Server
  Action reale su PostgreSQL sintetico, Admin/Manager/Viewer, mobile, annulla,
  focus/Escape, errore/retry e filtri. Dettagli in docs/forum-unpublication-2026-10-14.md.
- Migration applicata/registrata in production con backup custom verificato e
  confronto atomico di 63 tabelle, 132 policy, funzioni e privilegi preesistenti:
  nessun dato applicativo modificato. Gate internal, catalogo pubblico/coda vuoti,
  timer email sano. Build production in copia pulita superata; staging invariato.

## Rilascio coda Forum autorizzato e migration production — 2026-10-14

- L’utente autorizza migration, commit e push su main, mantenendo home attuale
  e iscrizioni ai Forum chiuse. Superati i limiti della preparazione locale;
  staging escluso, nessuna email o prova su dati reali autorizzata.
- Applicata/registrata atomicamente `20261014150000_forum_waitlist`, con reload
  PostgREST. Backup custom verificato sul server, 600; percorso/hash nel verbale.
  Tutti i valori delle 61 tabelle preesistenti invariati (84.410 righe), 132
  policy conservate, 155 funzioni e 337 grant confrontati; soltanto modifiche
  dichiarate. Revoca anon del catalogo personale prevista, grant service_role
  preesistenti conservati. Primo confronto della revoca concluso in rollback.
- Verificati internal, catalogo pubblico vuoto, coda vuota e worker service-only.
  Il Forum già configurato pubblico resta nascosto dal gate, senza cambiare
  configurazioni. Timer email attivo e funzionante; nessuna variabile modificata.
- Commit funzionale `f11353b` pubblicato su main; deployment production
  `dpl_rYqV6KZQfEQAswbpTt1zpTWVaBRG` READY, alias del dominio assegnato.
  Testo visibile home identico; REST anon conferma internal e cataloghi vuoti,
  scuole chiuse, Forum indisponibili e endpoint personale protetto dal login.
  Worker già eseguito automaticamente con coda vuota; timer concluso con successo,
  nessun error/fatal restituito dai log. Nessun account, iscrizione, token,
  presenza o email di collaudo. Dettagli in `docs/forum-waitlist-2026-10-14.md`.

## Coda FIFO e vincolo di fascia Forum — 2026-10-14

- Richiesta dell’utente implementata localmente su main: un Forum per giorno e
  mattina/pomeriggio Europe/Rome, incluso il Forum delle 17 nella stessa fascia
  di quelli delle 16. Controlli server/DB e capogruppo; testo prima della conferma.
- Forum pieno: Mettiti in coda per questo Forum, FIFO e uscita esplicita. La coda
  permette un’altra iscrizione nella stessa fascia. Accettazione del posto
  offerto sostituisce atomicamente la scelta incompatibile; nessun cambio se
  l’offerta non viene confermata. Minori conservati e posti del nucleo indivisibili.
- Correzioni esplicite dell’utente: controllo ogni cinque minuti; riserva reale
  di 30 minuti, poi passaggio al nuovo primo o restituzione alla disponibilità
  quando la coda è vuota. I posti eccedenti restano prenotabili. Anche il catalogo
  individuale si aggiorna ogni cinque minuti, senza polling negli ingressi.
- Worker sul cron email esistente, cadenza DB persistente, Postmark transazionale
  multilingue e claim senza reinvio cieco degli esiti incerti. Nessun account Auth
  o magic link creato; collegamento al Forum e conferma POST autenticata.
- Migration additive `20261014150000_forum_waitlist`, solo locale. Modalità internal
  e quote separate conservate; sala più grande consente di aumentare la quota
  individuale dal gestionale. Preflight blocca conflitti storici senza correggere dati.
- SQL locale/concorrenza, browser con clock sintetico e azioni reali su PostgreSQL
  temporaneo, sette lingue/mobile, 874 test, lint, TypeScript e build production
  verificati. Nessun dato remoto/email reale, commit/push o deployment eseguito.
  Dettagli e rilascio in `docs/forum-waitlist-2026-10-14.md`.

## Ingressi evento nella categoria Statistiche, senza polling — 2026-10-14

- Su richiesta dell’utente, Ingressi effettivi all’evento è una categoria
  dedicata di Statistiche, con URL report=arrivals. Rimossi riepilogo e report
  permanenti sopra tutte le altre statistiche; ruoli e menu full/mini conservati.
- Totali e report dettagliato letti solo all’apertura o al nuovo clic sulla
  stessa categoria; filtri e Riprova producono letture esplicite. Nessun polling
  ogni 10 secondi, refresh su focus/visibilità o ritorno online in questa vista.
  Le altre statistiche non avviano le letture ingressi; arrivals non carica
  inutilmente le anagrafiche delle statistiche generali. Il contesto presenze
  delle liste operative mantiene il comportamento preesistente.
- Quattordici test mirati e browser con dati sintetici/orologio virtuale:
  assenza di richieste periodiche, nuovo clic, cambio categoria e riapertura,
  filtri, mobile e revoca accesso. Nessuna migration, dato applicativo o email.
  Correzione nel rilascio main già autorizzato.

## Modali stampa semplificate ed eliminati esclusi — 2026-10-14

- L’utente richiede collaudo dai pulsanti operativi reali, senza passaggio
  obbligatorio dalla pagina ausiliaria /stampa-qr/collaudo. Prove con campioni
  applicativi sintetici; nessuna prova hardware dichiarata conclusa.
- Modale individuale/gruppo: testi semplici, stati Da stampare / Controlla
  l’etichetta / Etichetta confermata, Aggiorna elenco e Conferma etichetta.
  Istruzioni stampante espandibili; carta e conferma configurazione conservate.
  Testi Stampa etichetta QR / Ristampa etichetta QR invariati.
- Iscrizioni eliminate escluse lato server dagli elenchi e conteggi etichette
  del gruppo, anche se esiste uno storico di stampa. Una richiesta di ristampa
  col loro ID viene respinta prima di acquisire il tentativo. Annullate e QR
  non validi restano visibili come non stampabili. Snapshot e registro DB
  conservati; nessuna migration o modifica di dati applicativi necessaria.
- Verificati sette test mirati, lint, TypeScript e browser sintetico con
  stampa simulata, conferma esplicita, ristampa selettiva e layout mobile.
  Correzione nel rilascio main già autorizzato, sempre solo Admin.

## Rilascio main e migration Admin autorizzati — 2026-10-14

- L’utente autorizza esplicitamente commit, push e migration necessarie per
  pubblicare su main e consentire il collaudo a distanza. Questa richiesta
  supera i precedenti divieti della tranche, mantenendo nuove funzioni solo
  Admin, iscrizioni pubbliche chiuse e nessuna prova su dati reali o email.
- Applicate e registrate atomicamente in production le otto migration panel
  mancanti e le due del 14 ottobre. Backup custom verificato sul server,
  permessi 600; percorso e riscontri nel documento di integrazione.
  Correzione dati storica `20260726120000` esclusa e non registrata.
- Invariati valori e conteggi delle 45 tabelle preesistenti: 83.960 righe.
  Confrontate 155 funzioni, 132 policy e 155 insiemi di privilegi, preservando
  permessi preesistenti e default service_role del server. Modalità internal,
  zero panel pubblici; controllo dei ruoli senza scritture applicative:
  4 Admin pronti, 12 account non Admin esclusi dal gate.
- Build production e 21 regressioni mirate superate, oltre alle verifiche
  complete della preparazione. Merge `384f58a` pubblicato su main, deployment
  `dpl_3DWzozwyFNcXhc2kZwhEnXxmfyN1` production READY verificato sul dominio.
  Testo visibile della home invariato, scuole pubbliche chiuse e percorsi
  operativi protetti dal login. Sessione Manager esclusa dalla pagina di
  collaudo Admin; nessun errore/fatal restituito dai log del deployment.
  Branch panel e quattro stash conservati.
- Primo collaudo remoto dalla pagina Admin con campioni sintetici, senza
  modificare iscrizioni, token o presenze. Scanner applicativo su staging
  separato; hardware e accettazione fisica restano aperti. Nessun account,
  incarico o sessione creato; nessuna configurazione stampante modificata.

## Integrazione completa in main e collaudo Admin — 2026-10-14

- L’utente supera la sospensione della stampa, sceglie per questa tranche
  Chrome configurato silenzioso e chiede individuale/gruppi con coda canonica.
  Poi sposta lo sviluppo su main e richiede l’integrazione completa del panel:
  nuove funzioni di stampa/scanner nella dashboard Accoglienza solo Admin.
  Manager sarà abilitato in una tranche successiva; P0–P10 già pubblicate
  rimangono disponibili. Nessuna apertura pubblica implicita.
- Merge locale da panel `095af93` a main `fced870`, senza commit: preservati
  cronologie, branch panel e i due stash originari; due nuovi stash nominati
  conservano le bozze prima dei cambi di direzione. Conflitti riconciliati
  mantenendo home/Forum, download PNG autenticato e funzioni panel/cerimonie.
  Artefatti storici conservati sul disco ed esclusi dal diff da pubblicare.
- Nuove superfici protette da Admin lato server; gate DB versionato sulle basi
  scanner/gruppi, senza riscrivere migration storiche. Scanner non disponibile
  finché manca la migration di attivazione. Nuove pagine cerimonie/QR gruppo
  riservate al collaudo Admin, modello futuro conservato.
- Profili distinti continuo 29 × 45 e pretagliato 29 × 90, stesso nome completo,
  QR con quattro moduli liberi e codice. Testi operativi Stampa etichetta QR /
  Ristampa etichetta QR invariati, download PNG conservato. Etichetta piccola
  distinta dal badge completo, che mantiene le sedute delle cerimonie.
- Elenco gruppo con quantità ed esclusioni, senza sottogruppi o QR autonomi
  dei figli. Coda esistente estesa per tipo etichetta: deduplicazione globale
  per iscrizione/evento tra individuo/gruppo, tentativi e manifesti persistenti,
  ristampa selettiva, conferma fisica esplicita. print/afterprint non confermano
  uscita, preparazione o consegna; nessuna presenza o token personale scritto.
- DK-22210 confermato acquistato; specifica Brother 29 mm verificata. Stampante
  non presso lo sviluppatore. Collaudatore con accesso Admin, Mac e forse
  Windows, modello riferito «Brother Wc810»: targhetta, collegamento e rotolo
  montato da confermare prima del setup. Nessuna nuova prova fisica acquisita.
- Due migration locali: `20261014110000_admin_reception_pilot` e
  `20261014120000_qr_label_queue`. Nessuna applicazione remota autorizzata.
  Inventario registro read-only: production 11 versioni locali assenti
  (una pregressa da riconciliare, otto panel e due nuove); staging 12 assenti.
  Backup/confronto schema e autorizzazione necessari prima del rilascio.
- Restano esclusi commit/push, deployment, migration remote, email e modifiche
  a dati reali. Il passaggio a main non revoca questi limiti della richiesta.
  Collaudo tecnico con fixture sintetiche, PostgreSQL temporaneo e stampa
  browser simulata. Nessun account/ruolo creato o stampante configurata.
- Dettagli in `docs/panel-main-integration-2026-10-14.md`; procedura per il
  collaudatore in `docs/collaudo-stampa-remoto-admin.md`. Accettazione fisica
  aperta; Windows, QL-800 e postazioni evento non certificati.


## Download QR personale su Safari iPhone — 2026-10-12

- Segnalazione dell’utente: pulsante Scarica immagine nell’area personale,
  Safari su iPhone. Il precedente link data: funziona nella prova Safari Mac;
  il blocco sul dispositivo iPhone non è stato riprodotto direttamente.
- Preparata localmente una risposta HTTP autenticata PNG attachment in
  `/dashboard/partecipante/qr/download`, collegata al pulsante esistente.
  Identità, nome file e iscrizione corrente derivano dalla sessione e dal DB;
  eventuali ID/nominativi in URL non selezionano altre persone. Anche i ruoli
  operativi scaricano soltanto il proprio QR da questo percorso personale.
- Riutilizzato il token esistente e il renderer nominativo. Rilettura dell’ultimo
  token al download, con revoca/scadenza e cache privata no-store; nessuna
  generazione, rotazione, migration, modifica dati o email. Altre dashboard
  conservate. Test mirati coprono accesso, scope, PNG, nomi internazionali,
  oltre 1.000 righe, stati e errori. Verificati 763 test, lint, TypeScript,
  build e download Safari Mac con pulsante/handler reali e soli dati sintetici.
- L’utente autorizza commit/push su main e il normale rilascio automatico
  Vercel. La prova finale sull’iPhone dell’utente resta da effettuare dopo
  la pubblicazione. Branch panel e stash conservati.

## Prefissi telefonici personalizzati — 2026-10-12

- Richiesta di correzione in production per il prefisso Mongolia +976.
  Riprodotto sul dominio reale: il pattern JSX del campo Altro interpretava
  male il segno + e rifiutava anche prefissi a due cifre. Nessun limite a due
  cifre nel server, che accetta e normalizza già il numero mongolo.
- Pattern HTML condivisi per iscrizione pubblica e inserimento gestionale;
  corretti anche i caratteri del numero nazionale per la validazione moderna
  del browser. Conservati formati ammessi, lunghezze, lingue e telefono opzionale.
- Verificati 757 test, ESLint, TypeScript, build production e browser locale
  con dati sintetici, senza inviare form. Rilascio production richiesto
  dall’utente; nessuna migration, modifica di iscrizioni o email.

## Futura home: destinazione pulsante finale — 2026-10-10

- Correzione esplicita con immagine dell’utente: il richiamo finale deve tornare
  all’inizio dell’intero riquadro blu (`#personal-access`), mostrando titolo,
  istruzioni, messaggio bianco e modulo email. Superate le precedenti destinazioni
  al solo modulo o alle istruzioni. Conservato il margine per la testata.
  I pulsanti dei singoli Forum conservano la destinazione e le istruzioni scelte.
- Aggiornamento sul link di preview esistente nel rilascio autorizzato.

## Futura home: riduzione dei richiami — 2026-10-10

- Su correzione dell’utente, rimosso il grande riquadro promozionale iniziale.
  La frase “Dalla tua area personale potrai scegliere i forum e prenotare
  il tuo posto” compare una sola volta, evidenziata in un riquadro bianco.
- “Prenota questo Forum” conserva il percorso e le istruzioni dopo il click,
  senza freccia né frase ripetuta sotto ogni scheda. Sette lingue aggiornate.
- Aggiornamento del medesimo link di preview nel rilascio già autorizzato;
  home pubblica internal, scadenza e form anteprima disabilitato conservati.
- Superati 23 test mirati, ESLint, TypeScript e build production.

## Aggiornamento link anteprima autorizzato — 2026-10-10

- L’utente richiede di portare le modifiche della futura home sul link della
  preview esistente. Autorizzato il normale rilascio del codice su main/Vercel,
  conservando la home pubblica internal e il singolo link temporaneo con
  scadenza originale. Nessuna apertura prenotazioni, migration remota o email.
- Confermata la sola preparazione del messaggio per la lista d’attesa;
  nessuna funzione di iscrizione in coda richiesta in questa tranche.


## Futura home: invito e destinazione Forum — 2026-10-10

- Disponibilità semplificata in “Posti disponibili”; richiamo evidente nel
  riquadro blu e pulsante “Prenota questo Forum” su ogni scheda disponibile.
  Scelta e istruzioni accanto all’email, scorrimento con margine per la testata,
  sette lingue e rispetto della preferenza di movimento ridotto.
- L’intento Forum (solo UUID) attraversa accesso email, nuova iscrizione,
  conferma e retry. Ingresso `/forum/[id]`: solo Forum pubblicati dell’evento
  corrente in modalità open; sessione già aperta → scheda personale, altrimenti
  email. Dopo il login il Forum è evidenziato con ancora univoca anche con più
  quote; nessuna prenotazione automatica. Il link di conferma iscrizione mantiene
  la scelta. Il token `forum` è riservato rispetto agli slug di gruppo.
- Ordine numerico dei Forum all’interno delle fasce condivise; Forum 9 alle
  17 precede gli altri della fascia dalle 16, conservando il suo orario reale.
- Forum completi: messaggio “Posti esauriti · Lista d’attesa prevista”, con
  indicazione esplicita che la funzione non è ancora attiva. Nessuna regola
  di coda o assegnazione introdotta; realizzazione necessaria prima dell’apertura.
- Home internal e form anteprima disabilitato conservati. Modifica locale
  su main: nessun commit/push, rilascio, migration remota o email.


## Link temporaneo di approvazione — 2026-10-10

- L’utente richiede di rimuovere il sistema di condivisione e lasciare un solo
  link con scadenza a 3 giorni. Rimossi gestione Admin, creazione/revoca,
  tabella e RPC dei link. Questa indicazione supera la soluzione precedente.
- Token casuale, digest e scadenza server in HOME_APPROVAL_LINK, controllo
  prima di leggere il programma. RPC minima service-only senza nominativi.
  Home pubblica invariata e form anteprima disabilitato. Migration additive
  20261010122000/20261010123000; quelle già applicate restano versionate.

## Forum e collegamenti alle fasce — 2026-10-10

- Su richiesta dell’utente, rinominati i testi visibili Panel → Forum nel
  sito, home, dashboard, prenotazioni, export e comunicazioni nelle sette lingue.
  Identificatori, URL e contratti database conservati.
- Rimosso il richiamo generale sotto il programma; ogni richiamo nei momenti
  conduce al gruppo del giorno e della fascia corrispondenti. Il Forum delle
  17 resta nel gruppo dalle 16. Home pubblica internal invariata.

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

## Salvataggio e push stampa individuale autorizzati — 2026-10-14

- L’utente richiede commit e push delle modifiche alla stampa del singolo
  QR sul branch panel. Questa autorizzazione supera il precedente divieto
  di pubblicare questa tranche; non riprende le prove hardware sospese.
- Diff locale pertinente: pulsante Manager/Admin, loader/handler autenticati,
  renderer e client di stampa, test, documentazione e strumenti sintetici.
  Campioni generati e materiali PDF/immagini temporanei conservati localmente
  e ignorati con regole mirate; nessun profilo Chrome o credenziale versionati.
- Il branch a 476c214 contiene inoltre il merge di riallineamento del 9 ottobre
  non ancora pubblicato sul remoto panel: 17 commit di differenza, dei quali
  16 già presenti su origin/main. Il push conserva la cronologia preesistente.
- Solo branch panel/preview, main e production esclusi da questa pubblicazione.
  Nessuna migration remota o email. Tre metodi aperti, stampa gruppi/continuo
  e integrazione accoglienza rinviati alla tranche successiva richiesta.

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

## Testo del pulsante stampa — 2026-10-12

- Su richiesta dell’utente rimosse le dimensioni dal testo del pulsante
  operativo: `Stampa etichetta QR` / `Ristampa etichetta QR`.
  Formato e comportamento di stampa conservati; correzione solo di testo.

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

## Progetto accoglienza e prove stampanti — 2026-10-08

- Linee guida quasi definitive concordate, non implementazione completata:
  riferimento in `docs/accoglienza-postazioni-stampa.md`.
- Unico registro generale delle presenze, modificabile da telefono e PC con
  autorizzazioni coerenti; postazioni come viste operative, non archivi separati.
  QR/link di postazione associa più telefoni autorizzati alla coda del banco;
  QR partecipante identifica la persona. Presenze, scansioni e stampe distinte.
- PC con arrivi recenti, ricerca, scheda, correzione/annullamento presenze e
  stampa/ristampa del QR esistente. Annullare presenza non elimina iscrizione;
  audit, deduplicazione e conflitti da progettare. Nessuna stampa automatica
  implicita a ogni scansione, soprattutto ai panel.
- Stampa anticipata Manager individuale/multipla/per gruppo prima dell'arrivo,
  senza registrare presenze. Stato per persona condiviso con telefono e PC di
  ogni banco: segnalare badge già preparato o stampa anticipata da verificare,
  distinguendo richiesta, invio, conferma fisica ed errori. Ristampa esplicita,
  esiti parziali dei lotti e deduplicazione con le richieste dell'accoglienza.
- Prima collaudo hardware/template su Mac con Brother QL-810Wc, poi QL-800;
  progettare anche per Windows. Disponibili 2 DK-11201 e 2 DK-22251; formato
  finale ancora da scegliere. Prove con dati sintetici prima dell'integrazione.
- Questa attività salva solo decisioni e piano: nessuna modifica applicativa,
  installazione driver, collegamento fisico, migration, commit o push eseguiti.


## Riallineamento panel con main — 2026-10-09

- Richiesta esplicita: merge di main a858340 nel panel 42bfcca, conservando le
  correzioni del gestionale e P11–P13, scanner, QR gruppo, badge e cerimonie.
  Risolti 16 file in conflitto combinando le decisioni compatibili; nessuna
  scelta in blocco di un branch. Gestione Admin/Manager conservata; Viewer
  escluso dai panel e Capogruppo rinviato all’apertura pubblica sulla home.
- Catalogo con client autenticato per disponibilità; statistiche Panel nella
  categoria dedicata con presenze reali P13, separate dagli ingressi evento.
  Conferme SuccessMessage, ordine, Quando, pubblicazione, Iscritti ed Excel
  mantengono le correzioni del collaudo. Flussi futuri conservati e protetti.
- Stash fa1ec7f e 2ad9881 identici e non ripristinati; main, produzione e
  worktree delegato invariati. Merge locale; nessun push o SQL remoto.
- Verificati 807 test, lint, TypeScript, npm ci, build staging e PostgreSQL
  temporaneo con tutti i confini permessi, scanner/gruppi/cerimonie e concorrenza.
  Le cinque migration 20261009 importate da main sono ancora assenti nello
  staging (inventario read-only); applicarle prima del relativo rilascio.
  Dettagli in docs/panel-main-integration-2026-10-09.md. Hardware ancora da collaudare.


## Pubblicazione Manager autorizzata — 2026-10-09

- L’utente richiede migration production, commit e push. Applicata e registrata
  `20261009170000_manager_panel_access` in una sola transazione, con verifica
  delle impronte e dei conteggi di tutte le 45 tabelle pubbliche: 73.760 righe
  invariate nello snapshot, 24 panel conservati, modalità `internal` immutata.
  Nessuna modifica a funzioni o policy estranee, privilegi tabelle invariati.
- Backup custom verificato sul server, permessi 600:
  `/tmp/iscrizioni-pace-production-before-manager-panels-20261009.dump`.
  Verifiche production in sola lettura con identità dei ruoli esistenti:
  Admin/Manager ammessi, Viewer e pubblico esclusi; nessuna nuova sessione,
  iscrizione, prenotazione, destinatario o email di collaudo.
- Commit/push su main e normale rilascio Vercel autorizzati. Verifiche locali
  già superate: 733 test, ESLint, TypeScript, build e SQL/RLS sintetico.
  Codice `b0e8355` pubblicato: deployment `dpl_6KauhRCQCNzsRuf65aXENsPTzKev`
  production READY verificato sul dominio reale. Home con testo identico
  prima/dopo, scuole pubbliche chiuse e percorsi gestionali protetti dal login;
  nessun errore/fatal restituito dalla ricerca nei log del deployment.
  Capogruppo chiuso fino alla futura pubblicazione dei panel sulla home.
  Branch panel e stash preservati.

## Panel Capogruppo rinviati alla pubblicazione sulla home — 2026-10-09

- L’utente rinvia l’attivazione della funzione panel del Capogruppo alla
  futura pubblicazione dei panel sulla home del sito. Questa attivazione farà
  parte di quella tranche esplicita, insieme ai relativi controlli di accesso.
- L’integrazione Manager attuale non abilita menu, pagina, prenotazioni o RPC
  panel del Capogruppo. Restano i controlli esistenti sulla modalità `open`;
  la pubblicazione di un panel nel gestionale non apre questi flussi.

## Integrazione panel nella dashboard Manager — 2026-10-09

- Su via libera dell’utente, le funzioni panel già collaudate nell’Admin sono
  disponibili anche al Manager dell’evento corrente: Panel/Location/Scuole,
  Iscritti ed Excel, statistiche e audience Comunicazioni. Riutilizzati i
  componenti condivisi, conservando tutte le correzioni di “Correggi il
  gestionale panel”: SuccessMessage a 5 secondi, ordine quote/titoli, Quando,
  giorno unico, scheda Iscritti, PendingLink, pubblicazione e filtro cercabile.
- Viewer e manager di altri eventi restano esclusi anche da URL, action,
  export, API e database; ruoli cumulativi verificati sullo scope corrente.
  Il via libera supera la precedente restrizione solo Admin per il Manager,
  senza estenderla al Viewer o aprire catalogo/iscrizioni pubbliche.
- Tranche locale di apertura Manager P0–P10: migration versionata
  `20261009170000_manager_panel_access.sql`, che aggiorna il controllo condiviso
  e le policy di lettura/campagne; nessuna riscrittura delle migration storiche
  o dei dati. Icona SVG microfono da tavolo condivisa nei menu Admin/Manager.
- Lavoro locale su main; nessun commit/push, deployment, migration remota o
  email. Branch panel e stash preservati. Migration da applicare prima del
  rilascio del codice. Verificati 733 test, ESLint, TypeScript, build e
  SQL/RLS PostgreSQL 17 con dati sintetici e rollback. Collaudo visivo all’utente.

## Collaudo panel: conferme sempre temporanee — 2026-10-09

- Regola generale: le semplici conferme di operazione riuscita devono usare
  SuccessMessage, sparire dopo 5 secondi e consentire chiusura con ×. Errori,
  istruzioni e stati operativi persistenti conservano le rispettive regole.
- Applicato anche a Panel, Location e Scuole; chiave nuova per ogni risposta
  e pulizia dei parametri di successo senza perdere filtri, menu o scroll.
  Nessuna modifica dati; commit/push e normale rilascio autorizzati dall’utente.
  Superati 22 test mirati, ESLint e TypeScript.

## Collaudo panel: ordine delle quote — 2026-10-09

- Il catalogo ordina le sezioni con l’ordine configurato dei tipi di pubblico
  (Iscritti, Scuole, Ospiti), anziché con gli UUID delle sezioni. Stesso ordine
  nei riepiloghi desktop/mobile e nel form di modifica di ogni panel.
- Correzione locale del loader; nessuna riscrittura dei panel, quote o
  prenotazioni, nessuna migration. Commit/push e normale rilascio autorizzati
  dall’utente; 12 test mirati, ESLint e TypeScript superati.

## Collaudo panel: colonna Quando — 2026-10-09

- Rinominata Orario in Quando; giorno mostrato una sola volta seguito dalla
  fascia senza zero iniziale, ad esempio 26 ott, 9:30 - 12:30. Stesso formato
  in desktop, mobile e conferma pubblicazione; fuso Europe/Rome conservato.
- Modifica solo di presentazione; commit/push e normale rilascio autorizzati.

## Collaudo panel: ordinamento alfabetico catalogo — 2026-10-09

- Il catalogo gestionale ordina i panel per titolo in italiano, ignorando
  differenze di maiuscole e usando numeri naturali (Forum 2 prima di Forum 10).
  Ordinamento applicato dopo i filtri, condiviso desktop/mobile; array origine,
  selezioni, dati e permessi preservati. Commit/push e normale rilascio
  autorizzati dall’utente; 12 test mirati, ESLint e TypeScript superati.

## Collaudo panel: giorno unico e orari separati — 2026-10-09

- Il form creazione/modifica panel seleziona un solo Giorno e due orari,
  Inizio/Fine. Entrambi i timestamp derivano dal giorno comune in Europe/Rome;
  limiti date evento, controlli quote e sovrapposizioni conservati.
- Fine deve essere successiva a Inizio; controllo browser e action server
  del medesimo giorno, anche per payload diretti. Nessuna migration o modifica
  dei dati storici. Collaudo visivo affidato all’utente. Commit/push e normale
  rilascio autorizzati dall’utente; 17 test mirati, ESLint e TypeScript superati.

## Collaudo panel: stile scheda Iscritti — 2026-10-09

- Uniformata la scheda Iscritti alle modali operative: intestazione e footer
  con fondo soft, titoli blu, superfici condivise per riepiloghi ed elenchi,
  tabelle con intestazioni evidenziate. Corretto il padding dei pulsanti
  Esporta/Chiudi; export primario, a larghezza piena su mobile.
- Larghezza massima ridotta, corpo scorrevole e tabelle con scroll locale;
  dati, conteggi, export e autorizzazioni invariati. Collaudo visivo affidato
  all’utente. Commit/push e normale rilascio autorizzati dall’utente.

## Pubblicazione correzioni collaudo panel — 2026-10-09

- L’utente autorizza commit e push di tutte le modifiche locali: elenco
  Iscritti e relativo Excel, avanzamento del pulsante Modifica, terminologia
  Bozza/Pubblicato/Pubblica panel e rimozione dell’avviso futuro statistiche.
  Questa pubblicazione supera le note locali senza autorizzazione sottostanti.
- Verificati 726 test, ESLint e build production con controllo TypeScript.
  Nessuna migration o apertura del catalogo/iscrizioni; gestione solo admin.
  Branch panel e stash preservati. Deployment verificato separatamente.

## Collaudo panel: terminologia pubblicazione — 2026-10-09

- Su indicazione dell’utente, stati Bozza/Pubblicato e comando Pubblica panel
  (Pubblica selezionati per il batch). Aggiornati filtro, conferme, esiti ed
  editor: questa decisione supera i precedenti testi Convalida/Pronto.
- Nessuna apertura pubblica implicita: il panel pubblicato sarà visibile
  quando verrà aperto il catalogo; le iscrizioni mantengono apertura separata.
  Solo testi locali su main, nessuna modifica a permessi, dati o migration.

## Collaudo panel: avanzamento del pulsante Modifica — 2026-10-09

- La tabella panel usa ora il componente PendingLink condiviso: Modifica,
  Consulta e Iscritti mostrano lo stesso avanzamento degli altri comandi
  della dashboard durante l’apertura. Navigazione e scroll invariati.
- Correzione locale su main; nessun commit/push o deployment. Controlli
  mirati ESLint e TypeScript; collaudo funzionale affidato all’utente.

## Collaudo panel: elenco iscritti ed Excel — 2026-10-09

- Aggiunto localmente su main il pulsante Iscritti nella riga del panel,
  desktop/mobile. Scheda con iscritti e figli accompagnati, scuole/classi con
  studenti/accompagnatori e posti ospiti riservati senza nominativi fittizi.
  Chiusura conserva filtri, menu e scroll; nessuna nuova milestone.
- Export XLSX con Riepilogo, Partecipanti, Scuole e Ospiti riservati. Dati
  riletti al download, conteggi scuola dalla prenotazione del singolo panel,
  cancellazioni escluse. Letture paginate e nessun elenco/export parziale
  in caso di errore. Dettagli in docs/panel-reserved-release.md.
- Solo admin, anche con ruoli cumulativi; endpoint diretto e loader negano
  gli altri ruoli prima delle letture dei partecipanti. Nessuna migration,
  scrittura dati o email; nessun commit/push o deployment per questa modifica.
- Verifiche mirate su dati sintetici: scope, ruoli, minori, scuole, ospiti,
  paginazione oltre 1.000 righe, errori e round-trip Excel; 9 test mirati,
  ESLint, TypeScript e build production superati. Collaudo visivo affidato
  all’utente secondo la modalità concordata.

## Collaudo statistiche panel: rimozione avviso futuro — 2026-10-09

- Rimosso dal report il riquadro Presenze effettive e no-show con riferimenti
  alla Milestone P11 e ai check-in legacy. Conteggi e logica invariati.
  Correzione locale su main; nessun commit/push o deployment richiesto.

## Collaudo gestionale panel: disposizione azioni — 2026-10-09

- Correzione locale: Modifica e Convalida incolonnati nelle viste desktop e
  mobile, con colonna Azioni più ampia per evitare sovrapposizioni con lo stato.
  ESLint e TypeScript superati; collaudo visivo affidato all’utente.
- Gestione ospiti approvata: nel catalogo i posti con canale internal_assignment
  sono riservati e non mostrati come disponibili. Il riepilogo distingue le
  prenotazioni di iscritti/scuole e le disponibilità di ciascuna quota, con
  spiegazione dell’esclusione ospiti dal form pubblico. Capienza fisica e
  ripartizione conservate; nessuna iscrizione o presenza fittizia.
- Commit/push su main e normale rilascio Vercel autorizzati, insieme al filtro
  Panel cercabile. Nessuna migration, email o modifica di dati remoti.

## Collaudo gestionale panel: filtro cercabile Comunicazioni — 2026-10-09

- Correzione locale su main: filtro Panel nelle audience Partecipanti e
  Professori con elenco a discesa cercabile, scelta esplicita e Tutti i panel.
  Ricerca senza distinzione di accenti/maiuscole; filtro e payload usano l’ID
  del panel selezionato, conservando prefiltri e selezioni dei destinatari.
- Controlli mirati ESLint e TypeScript superati; collaudo funzionale affidato
  all’utente. Pubblicazione autorizzata insieme alla gestione posti ospiti.

## Modalità di collaudo gestionale aggiornata — 2026-10-09

- L’utente conferma personalmente la riuscita delle correzioni. Per i piccoli
  bug del collaudo non eseguire automaticamente prove browser o suite complete
  a ogni intervento: usare controlli mirati e proporzionati, riservando le
  verifiche più ampie a modifiche delicate e preparazione della pubblicazione.
  Questa indicazione supera il controllo browser e completo a ogni correzione.

## Collaudo gestionale panel: ritorno a Location — 2026-10-09

- Correzione su main: creazione, modifica ed eliminazione location
  chiudono la modale e mantengono la sottosezione Location e il menu full/mini.
  Il redirect delle action ometteva `panelView=locations`, aprendo i panel.
- Regressione delle action reali con database sintetico, inclusi errori;
  vista risultante verificata nel browser locale desktop/mobile. 720 test,
  lint, TypeScript e build production verificati. Commit/push su main e normale
  rilascio Vercel autorizzati dall’utente; deployment da verificare separatamente.
  Nessuna migration, email o modifica di dati remoti in questa correzione.

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


## Preparazione rilascio gestionale riservato — 2026-10-09

- L'utente richiede di preparare su main le funzioni gestionali panel già
  realizzate fino a P10, mantenendo la home production senza annunci e senza
  aprire catalogo, iscrizioni personali, capigruppo o scuole pubbliche.
  Location, quote, prenotazioni scuola interne, statistiche e destinatari
  campagne restano utilizzabili da admin/manager; viewer in sola lettura.
- Integrata localmente la base panel `32e7d41` in main `79897d7`, con merge
  senza commit e conflitti risolti conservando le correzioni recenti di main.
  P11–P13, cerimonie, scanner e badge restano sul panel `42bfcca`. Nessun
  commit, push, deployment, SQL remoto o email in questa preparazione.
- Nuova migration locale `20261009120000_reserved_panel_release.sql`:
  `events.panel_access_mode` internal/catalog/open, default internal,
  controlli RPC/RLS e azioni server, chiusura serializzata con le prenotazioni,
  audit della modalità e conteggio canonico dei posti. Convalidare un panel
  non apre l'evento al pubblico. Nessun comando UI di apertura aggiunto.
- Home production conservata in `app/registration-home.tsx`; home futura e
  programma panel mantenuti, selezionati solo dalla modalità esplicita.
  Catalogo gestionale con prenotati e rimanenti per quota; letture paginate
  oltre 1.000 righe, errori bloccanti senza risultati parziali o zeri inventati.
- L'utente autorizza a sincronizzare il panel quando necessario, preservando
  le funzioni future. Dopo il commit autorizzato, integrare main nel panel con
  merge e verifica staging, senza sostituzioni di file in blocco. Il branch
  panel non è stato modificato durante questa preparazione senza commit.
- Collaudo etichette sospeso: prossimo passo pulsante per stampare un singolo
  QR esistente senza rigenerazione o presenza. Tutto il lavoro locale del
  collaudo è nello stash `fa1ec7fa339a2b944045bf67e90cc2a1e9efec85` (inclusi
  file non tracciati); ripristinarlo solo sul panel, non su main. Conservato
  anche lo stash precedente sulle migration production.
- La richiesta di posti rimanenti nel catalogo pubblico e lista d'attesa
  supera la precedente esclusione della coda. Pianificare una milestone prima
  dell'apertura delle iscrizioni; nessuna regola FIFO, priorità o scadenza
  decisa implicitamente. Non sono implementate da questa tranche gestionale.
- Verificati 711 test, lint, TypeScript, build, SQL PostgreSQL 17 temporaneo
  con ruoli e concorrenza, browser sintetico desktop/mobile e home sette lingue.
  Registro migration/configurazione email production e collaudo autenticato
  del deployment restano da verificare. Dettagli e procedura di rilascio in
  `docs/panel-reserved-release.md`; niente pubblicazione dichiarata conclusa.

## QR individuale nelle schede Manager/Admin — 2026-10-07

- Chiarimento dell’utente: la segnalazione riguarda la scheda Manager, che non
  mostrava il QR individuale. Aggiunto il riquadro condiviso col Capogruppo
  alla modale operativa Manager/Admin, con stato e download PNG nominativo.
- Lettura solo all’apertura della scheda tramite GET autenticata e no-store:
  Admin globale o Manager dell’evento corrente, iscrizione non eliminata,
  identità dal database. Viewer e altri ruoli esclusi, anche da chiamate dirette.
  Riutilizzato il QR esistente senza creazione, rotazione o scritture.
- Risposta legata alla scheda selezionata; richieste annullate alla chiusura o
  al cambio partecipante. Errori con Riprova, stati revocato/scaduto/non
  disponibile senza immagine utilizzabile. Nessuna migration o email.
- Test loader/handler in tests/operations-qr.test.mts; fixture browser sintetica
  tests/browser/operations-qr.mjs per Manager/Admin, download, mobile, retry,
  cambio rapido di scheda e Viewer. Verificati 639 test, lint, TypeScript e
  build production. Pubblicazione su main/production richiesta.

## Rimozione wallet — 2026-10-07

- Rimossi il pulsante wallet non implementato, la relativa icona e i testi
  nelle sette lingue dalla dashboard personale, anche nella vista QR in overlay.
  Resta Scarica immagine. Google/Apple Wallet non sono previsti per l’evento;
  questa decisione supera i precedenti riferimenti a un’integrazione futura.
- Il QR individuale Capogruppo resta nella scheda aperta cliccando sul nome
  del partecipante, con download nominativo e autorizzazioni esistenti.
  Al controllo iniziale main e produzione coincidono su b1b1405 e non contengono
  una funzione QR di gruppo; richiesta all’utente la pagina della segnalazione.
- Verificati 635 test, lint, TypeScript e build production con Next 16.2.9
  coerente col lockfile. Nessuna migration, modifica dati o email.
  Pubblicazione su main/production richiesta dall’utente.

## Contatori gruppi capogruppo — 2026-10-06

- Su richiesta dell’utente, ogni riquadro gruppo con Inserisci partecipante e
  Gestisci link mostra il numero di persone assegnate direttamente al gruppo,
  inclusi i figli accompagnati ed esclusi i sottogruppi. Questa aggiunta supera
  per questo contatore la precedente esclusione dei riepiloghi numerici.
- Conteggio sulle assegnazioni correnti già caricate nello scope autorizzato,
  prima dei filtri della tabella; iscrizioni eliminate escluse dal loader.
  Etichette nelle sette lingue, zero esplicito per i gruppi vuoti.
- Modifica locale su main; nessuna nuova query, migration o scrittura dati.
## Pubblicazione cerimonie E1/E2/E3 in staging — 2026-10-06

- Nuova autorizzazione esplicita dell’utente: commit/push delle modifiche
  cerimonie e migration necessarie per lo staging. Nessun rilascio production.
- Applicate e registrate insieme, in una transazione, le migration
  `20261006180000`, `20261006200000`, `20261006220000` nel container verificato
  `supabase-db-jiio6ou5wzmma2xwas53cf1d` (PostgreSQL 15.8). Backup custom sul
  server: `/tmp/iscrizioni-pace-staging-before-ceremonies-20261006151320.dump`,
  indice verificato con pg_restore prima dell’applicazione.
- Conteggi e hash delle 51 tabelle pubbliche preesistenti invariati: conservati
  9 iscrizioni, 9 partecipanti, 85 gruppi e 6 check-in. Zero destinatari email;
  nessun invio. Dieci tabelle cerimonie con RLS; RPC solo service_role.
- Resta esclusa la rinomina storica `20260813170000`, non applicabile per
  mancanza dei gruppi sorgente e non dipendenza delle cerimonie.
- Codice verificato: 775 test, lint senza warning, TypeScript, build staging,
  PostgreSQL temporaneo e browser sintetico desktop/mobile sette lingue.
  Pubblicazione del branch distinta dal collaudo autenticato e dalle sedi reali.


## P13-E3 — piantine e sedute numerate locali — 2026-10-06

- Su richiesta dell’utente implementata E3 sul branch panel, conservando E1/E2.
  Fetch/pull: zero divergenze; origin/main già incluso. Sedi indipendenti e
  nessuna capienza reale inventata.
- Editor admin con file, sedute stabili, coordinate, etichette, posti bloccati,
  bozza e pubblicazione esplicita/versioni immutabili. Mappa con zoom, filtri,
  selezione multipla/consecutiva e alternativa tabellare desktop/mobile.
- Manager riserva le sedute entro le dotazioni E1 o le assegnazioni dirette;
  manager/capogruppo attribuiscono quelle ricevute ai nominativi E2. Viewer
  sola lettura. Scelte individuali dei minori conservate; senza posto esclude
  una seduta. Nessun secondo consumo di quota o riempimento automatico.
- Nuove versioni non eliminano/bloccano/rinominano sedute impegnate. Revoche e
  trasferimenti E1/E2 richiedono prima rilascio esplicito delle sedute collegate.
  Cambi gruppo/date/minori continuano a segnalare revisione senza liberare posti.
- Migration E3 aggiuntiva solo locale, RLS e RPC service-only, attore dalla
  sessione, lock/revisioni comuni, UUID retry stabile e audit minimizzato.
- Posto personale nelle sette lingue, elenco stampabile e indicazione dei posti
  nello scanner evento/gruppo e anteprima badge con QR attivo. Raccordo solo
  informativo: nessun incarico/accesso cerimonia o check-in creato. Badge già
  preparati sono snapshot; una riallocazione richiede ristampa esplicita.
- Verificati 775 test, lint senza warning, TypeScript e build staging.
  Verifiche SQL temporanee incluse 1.501 sedute, ruoli, versioni, conversione,
  ultimo posto concorrente e retry; browser sintetico desktop/mobile sette
  lingue. Esiti finali in `docs/panel-p13-ceremonies.md`.
- Nessuna migration remota, commit, push, deployment o email. Collaudo
  autenticato, sedi reali e accettazione aperti; P13 non conclusa, P14/P15 ferme.


## P13-E2 — manager, capigruppo e scelte individuali minori — 2026-10-06

- Richiesta esplicita dell’utente di procedere con E2. Precisazioni vincolanti:
  anche i manager assegnano posti alle singole persone dalla vista dell’evento;
  per i minori si decide caso per caso, senza regole automatiche di età/famiglia.
- Distribuzione nominale gestibile da manager/admin per tutti i gruppi evento,
  da capogruppo per gruppi e discendenti autorizzati. Assegnazione diretta E1
  della persona mantenuta. Viewer sola lettura, ruoli cumulativi.
- Registro comune per dirette e dotazioni, scelta esplicita senza posto per
  ciascun minore, consultazione personale sette lingue, revoca e trasferimento.
  Nessuna doppia occupazione; cambi gruppo/date/minori segnalati, non liberati.
- Migration E2 aggiuntiva solo locale, RPC service-only, attore dalla sessione,
  UUID retry stabile, lock/revisioni comuni e storico minori conservato.
- Verificati 768 test, lint, TypeScript, build staging, SQL temporaneo e browser
  sintetico desktop/mobile sette lingue; ultimo posto nominale concorrente
  manager/capogruppo, retry e snapshot oltre 1.000. Dettagli nel documento
  `docs/panel-p13-ceremonies.md`; collaudo autenticato e sedi reali ancora aperti.
- Nessuna migration remota, commit, push o deployment. P13-E3 non avviata.


## P13-E1 — cerimonie con sedi indipendenti — 2026-10-06

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
- Verificati npm ci, 763 test, lint, TypeScript, build staging, PostgreSQL 17
  temporaneo (permessi, oltre 1.000 iscrizioni, ultimo posto concorrente) e browser
  sintetico desktop/mobile. Accesso diretto senza sessione rimanda al login.
- Piano e dettaglio in `docs/panel-p13-ceremonies.md`. Nessuna migration remota,
  commit, push o deployment. P13-E1 resta aperta per staging, collaudo autenticato,
  sedi reali e revisione dell’utente; P13-S sospesa, non completata.


## Migration staging applicate — 2026-10-06

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


## Pubblicazione del branch panel richiesta il 2026-10-06

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


## P13-G — QR gruppo e coda badge locali — 2026-10-06

- Su richiesta dell'utente implementata P13-G sul panel, preservando tutte le
  modifiche P13 locali. Fetch: branch avanti 69, zero commit da incorporare.
  Nessun commit/push/deploy o migration remota.
- Decisioni esplicite: QR per solo gruppo selezionato, sottogruppi esclusi;
  minori ancora sul QR genitore, selezionabili individualmente per la presenza.
  Accoglienza reale non filtrata dalle date dichiarate; queste restano invariate.
- QR gruppo `G:` + token opaco cifrato/hashato, gestibile dal capogruppo nella
  sezione link nelle sette lingue; revoca e rinnovo espliciti. Scanner unico,
  riconoscimento solo incarico evento, conferma elenco senza ingressi automatici.
- Presenze canoniche atomiche con snapshot di composizione/revisioni, retry UUID
  stabile e correzione esplicita. Audit compatibile col report evento. Nessun
  check-in panel o scuola creato dal QR gruppo; niente QR autonomi ai minori.
- Coda badge persistente e riprendibile: un lotto aperto per gruppo, ordine,
  preparati da verificare, conferma operatore e ristampa singola con controllo
  tentativi. QR personali attivi riusati; niente rigenerazione durante stampa.
  Preparazione/stampa non registra presenze, errore stampa non le annulla.
- Migration locale `20261006150000_group_reception.sql`: tre tabelle RLS e RPC
  service-only con verifica DB di ruolo, evento, gruppo e credenziale ad ogni
  chiamata. Elenco completo oltre 1.000, limite difensivo 10.000, nessun parziale.
  Lock conservativi di tabelle gruppi/assegnazioni/minori da misurare sotto carico.
- Verificati 758 test applicativi, lint, TypeScript/build staging, PostgreSQL 17
  temporaneo e browser sintetico desktop/mobile. Collaudo autenticato completo,
  dispositivi e hardware restano da collaudare; P14/P15 non avviate. Stato, limiti
  e ripresa della coda in `docs/panel-p13-groups.md`. P13-G non accettata sul campo.

## Nuove necessità panel — pianificazione del 2026-10-06

- Aggiornato solo il piano: P13-G (prima priorità, QR gruppo e lotti badge),
  P13-S (accrediti stampa), P13-E1/E2/E3 (cerimonie, quote, assegnazioni e mappe).
  Nessuna di queste funzioni è dichiarata implementata; P13 resta da collaudare.
- Inaugurazione e cerimonia finale: partecipazione prevista dall'iscrizione e
  dai giorni dichiarati, distinta da posto assegnato e ingresso reale. Niente
  prenotazione volontaria. Manager ripartisce settore → categoria → gruppo/persona;
  capogruppo distribuisce soltanto i posti ricevuti ai propri membri.
- Solo admin modella la piantina; partire da settori/quantità in bozza e poi
  sedute stabili/versionate. Superata l'esclusione storica di piantine e posti
  numerati per questi due momenti, non per i panel ordinari. Dotazione gruppo
  e distribuzione nominale non devono consumare due volte la stessa capienza.
- QR gruppo distinto da QR persona/scuola; conferma intero gruppo o sottoinsieme
  realmente arrivato, ingressi nominali idempotenti e stampa in sequenza dei QR
  personali attivi. Coda preparabile prima di P14; stampa fisica accettata solo
  dopo hardware P14/P15. Strategia QR minori e scope sottogruppi da definire.
- Accredito stampa verificato/revocabile e badge dedicato; City Panel e riserve
  alle cerimonie sono diritti possibili ancora da definire, non accessi automatici.
- Dettagli, dipendenze, decisioni aperte e accettazione in
  `PIANO_DI_LAVORO_PANEL.md`, sezioni 3.5–3.7 e nuove milestone. Conservate tutte
  le modifiche locali precedenti; fetch iniziale: 69 commit avanti, zero indietro
  rispetto all'upstream panel, nessun riallineamento necessario.

## Regole non negoziabili di main anche sul branch panel — 2026-10-06

Su richiesta dell'utente, i vincoli di `main` valgono anche per lo sviluppo su
`codex/panel-p0-p10`. Fonte verificata: `main` e `origin/main` a `0b7e4d1`, già
integrati nel merge panel `296f3e9`. Questa sezione rende espliciti i vincoli
trasversali; non sostituisce le specifiche dettagliate e lo storico sottostanti.

### Precedenza delle decisioni e protezione nei merge

- Una nuova funzionalità panel non autorizza a rimuovere comportamenti,
  controlli o correzioni già approvati su main. Restano altrettanto vincolanti
  le decisioni consolidate del branch panel su scuole, prenotazioni e scanner.
- Non risolvere conflitti scegliendo in blocco l'AGENTS o il codice di un solo
  branch (`ours` / `theirs`). Confrontare le decisioni di entrambi e conservare
  quelle compatibili; documentare puntualmente ogni requisito superato.
- Tra note storiche incompatibili vale la decisione esplicita più recente
  dell'utente sul medesimo comportamento, non il branch di provenienza né
  l'ordine dei paragrafi. Se il conflitto non è risolvibile dalle decisioni
  documentate, chiedere chiarimento prima di cambiare quel comportamento.
- Esempi di regole superate da non ripristinare: tag ai capigruppo, ruoli
  esclusivi che nascondono altre dashboard, figli nascosti dietro un pulsante,
  blocco dell'area personale per manager/viewer, avanzamento fermo al 90%.
- A ogni riallineamento confrontare anche `AGENTS.md` di main e panel, riportare
  qui eventuali nuovi vincoli trasversali e conservare le specifiche panel.
  Date, test e autorizzazioni di un rilascio passato sono fatti storici, non
  autorizzazioni permanenti per pubblicare, applicare SQL o inviare email.

### Git, ambienti e dati

- Seguire «Workflow Git e postazioni multiple» e «Strategia Git»: main è il
  default; panel si usa su indicazione esplicita. Conservare il branch panel
  anche dopo un merge, finché l'utente non ne richiede la rimozione.
- Verificare percorso, branch e stato, eseguire fetch e riallineamento
  fast-forward sicuro all'upstream prima di modificare. Preservare lavoro
  locale, commit non integrati e stash; non forzare sincronizzazioni divergenti.
  Usare clone locale fuori dalle cartelle cloud e GitHub per sincronizzarlo.
- Integrare periodicamente `origin/main` nel panel tramite merge, senza rebase
  del branch condiviso. Non creare branch, worktree o PR, né fare commit/push
  senza richiesta esplicita. Nessun reset distruttivo o sovrascrittura di
  lavoro altrui per semplificare un conflitto.
- Merge e pubblicazione del codice non applicano né autorizzano migration
  remote. SQL versionato, milestone dedicata e diff revisionabile; prima di
  una preview/rilascio confrontare il registro DB dell'ambiente interessato
  con le migration richieste e verificare la configurazione email.
- Non alterare dati reali né inviare email di collaudo come effetto collaterale
  delle verifiche. Usare fixture sintetiche e database temporanei per i test.
  Nessun segreto, token, dump o documento con dati personali in Git o nei log.

### Autorizzazioni e dati canonici

- L'evento operativo è quello unico con `events.is_current`; il multievento è
  archivio storico. Admin globale, manager/viewer limitati all'evento corrente,
  capogruppo alla gerarchia autorizzata. Controllare i permessi sul server
  prima dei loader, anche per URL diretti, export e parametri memorizzati.
- I ruoli si sommano e tutte le dashboard assegnate restano accessibili,
  compresa l'area personale. Anche la membership capogruppo secondaria abilita
  l'accesso. Manager e viewer sono alternativi nello stesso evento: cambio
  tramite rimozione esplicita, senza cancellare altri incarichi. Vietata la
  rimozione del proprio account; elenchi ruoli deduplicati per ID Auth.
- Viewer in sola lettura per le sezioni autorizzate, comprese le esportazioni
  presenze; niente azioni di gestione o dati interni esclusi dal suo ruolo.
  Solo admin gestisce il ciclo evento e assegna il ruolo manager.
- Tag: gestione solo admin/manager, lettura viewer; capogruppo escluso da
  catalogo, filtri, colonne, export e accesso DB, anche con vecchie preferenze.
  Servizi modificabili da admin/manager, in sola lettura per capogruppo.
- Service role solo lato server, attore ricavato dalla sessione e scope
  verificato; non sostituire RLS con soli controlli UI. Conservare controlli
  DB, snapshot/conflitti, lock e audit atomico delle operazioni che li usano.
- Letture paginate e per ID autorizzati anche oltre 1.000 record. Errori
  bloccanti: nessun totale/export parziale e nessun dato non caricato mostrato
  come zero, assenza o risposta negativa. Matching per ID o corrispondenze
  esplicite, senza associazioni approssimative tra persone o gruppi.
- Associazione dichiarata: `answers.externalGroupAssociation` del questionario
  più recente, anche quando vuota; non recuperare valori precedenti. Modifica
  admin/manager fino a 200 caratteri, preservando le altre risposte e senza
  testo dell'associazione nell'audit.
- Sesso interno separato e protetto: niente questionario, loader ordinari,
  audit, email, statistiche, QR o preferenze salvate; viewer escluso anche
  dall'export. Accessibilità limitata alle opzioni dichiarate, senza inferenze
  né reintroduzione del testo libero ritirato; colonna/export disabilità
  esclusi al viewer secondo i permessi specifici documentati.
- Non inventare o completare dati storici: nascita reale/non futura e città
  richieste nei nuovi inserimenti previsti, ma schede storiche incomplete e
  relativi figli restano visibili. Residenza mai dedotta dal gruppo.
  Localizzare i paesi riconosciuti preservando valori sconosciuti e dati salvati.

### Comportamenti applicativi da preservare

- Viste operative condivise tra admin/manager, evitando duplicazioni per ruolo.
  Figli sempre visibili; numero e nomi inclusi negli export operativi previsti.
  Statistiche da gerarchia e assegnazioni reali, figli inclusi nei conteggi
  previsti; negli export presenze per gruppo i figli restano nel gruppo
  d'iscrizione anche se il genitore ha servizi o tag.
- Presenze previste «Da comunicare» distinte dalle assenze, calendario completo
  e fasce conservati. Le presenze effettive/check-in individuali restano
  separate dalle dichiarazioni e dalle presenze del genitore.
- Form operativi con `ReliableForm`: valori conservati in caso di errore,
  messaggi accessibili accanto ai campi, focus al primo errore, invio esplicito
  e protezione dai doppi invii. Nessun redirect su errore nei nuovi overlay,
  né bozze operative in localStorage, sessionStorage o URL.
- Modali con scroll interno utilizzabile desktop/mobile, sfondo bloccato,
  chiusura X/Escape e ripristino di focus, filtri e scroll della dashboard.
  Preservare `dashboard-modal` e il pattern `preserve-dashboard-scroll`;
  non introdurre `overflow-hidden` senza un contenitore interno scrollabile.
- `ButtonProgress` condiviso in tutto il sito, overlay al 25%, partenza rapida
  e avanzamento continuo rallentato nelle attese lunghe. Completamento solo
  alla risposta reale, mai al 100% per errore; accessibilità e movimento
  ridotto conservati. Conferma email «in coda» distinta dalla consegna.
- Partecipante e capogruppo nelle sette lingue fin dall'inizio: it, en, fr, de,
  es, nl, uk, inclusi stati, errori, overlay ed export. Niente testi tecnici
  nelle interfacce operative; traduzioni legali definitive con revisione umana.
- Magic link: GET/HEAD non consumano il token; rinnovo dell'inattività solo
  dopo nuova verifica OTP/PKCE e accesso riusciti. Timeout di 24 ore e cookie
  protetto conservati, senza rinnovo per il solo riuso della sessione.
- Email: preservare coda Postmark, destinatari espliciti, anteprima/test e
  conferma previsti prima delle campagne; nessun reinvio cieco con esito
  incerto. Consegna al referente distinta dall'email personale; non copiare
  quella del referente nel contatto del partecipante. Conservare le indicazioni
  multilingue su spam e mittente sicuro, anche cambiando provider.
- QR con token opaco/revocabile, check-in idempotente e auditabile, dati minimi
  all'accoglienza. Conservare il flusso scanner consolidato del panel, i retry
  con lo stesso UUID e la gestione dell'esito incerto. Arrivo all'evento e
  accesso a panel/sala sono operazioni distinte.

### Verifica e avanzamento

- Diff piccoli e controlli proporzionati: test pertinenti, lint, TypeScript e
  build per modifiche applicative; dipendenze riproducibili dal lockfile con
  `npm ci`. UI significativa verificata nel browser desktop/mobile; modifiche
  a permessi e SQL verificate anche per ruoli diversi e casi di conflitto.
- Leggere `PIANO_DI_LAVORO_PANEL.md` prima della milestone; rispettarne i punti
  di revisione. Non dichiarare conclusa una milestone per il solo merge:
  Il report SQL è attivato in staging dal 6 ottobre; P13 resta da collaudare
  integralmente, secondo la nota dedicata a questa tranche.
- Aggiornare piano e documenti quando cambiano decisioni o flussi. Distinguere
  verifiche locali, stato del database e rilascio effettivo: il solo push non
  dimostra che il deployment sia riuscito.

## P13 — report attivato in staging e accessi panel locali — 2026-10-06

- Su richiesta dell'utente attivato il report senza collaudo: migration
  `20260930180000_reception_operational_report.sql` applicata e registrata
  atomicamente nel solo staging; funzione e privilegi verificati. Nessuna
  prova di ingressi, invio email o modifica production. Superate le precedenti
  note «report da attivare»; resta da verificarlo nel collaudo completo.
- L'utente rinvia il testing completo al termine dello sviluppo e autorizza
  a proseguire con gli accessi panel/sala senza il precedente collaudo intermedio.
  Non dichiarare P13 conclusa né avviare automaticamente P14 o un rilascio.
- Incarichi separati per account/evento/panel: `panel_entry` e `room_assistance`,
  senza concedere il ruolo evento accoglienza. Gestione admin/manager dal catalogo
  panel su account esistenti, senza inviti; viewer escluso dalla gestione.
  La capability di navigazione non autorizza alcuna scrittura: server e DB
  rileggono l'incarico esatto a ogni comando, anche durante i retry.
- Scelta incarico prima dello scanner; nessun cambio durante richieste/esito
  incerto. QR, codice personale, famiglie, scuole e feedback riusano la console
  consolidata. Ingresso al panel richiede prenotazione e ingresso evento reale;
  quantità scuola limitate anche agli arrivi evento. Sala in sola consultazione.
- Nuova migration locale `20261006120000_panel_reception_access.sql`, non
  applicata in remoto: check-in con moment_id/settore, revisioni separate,
  capienza serializzata, audit e retry distinti. Le letture scuola della RPC
  evento sono ristrette esplicitamente a moment_id nullo. Statistiche panel
  mostrano gli ingressi validi al caricamento, senza inventare permanenza/no-show.
- TypeScript, lint e build staging superati; predisposte regressioni ma non
  eseguite. SQL, browser, autenticazione e hardware rinviati al testing completo.
  Prima della pubblicazione va risolto l'inventario delle migration main ancora
  assenti nello staging, senza applicazioni indiscriminate. Nessun commit/push.
  Dettagli e verifiche future in `docs/panel-p13-access.md`.

## Riallineamento main nel branch panel — 2026-10-03

- Su richiesta dell’utente integrato `origin/main` a `0b7e4d1` nella base panel
  `388d05f`, con merge sul branch esistente `codex/panel-p0-p10`. Conservati
  scanner consolidato, scuole/panel e tutte le correzioni recenti di main.
- Risolti 14 file in conflitto, mantenendo figli sempre visibili/editor e ingressi
  individuali, ruoli prima dei loader, statistiche, export e Postmark con docenti.
  Lockfile allineato a main con il decoder jsqr; fixture adattate ai flussi riuniti.
- 18 migration importate da main, invariate; nessuna applicazione remota, push o
  deployment. Prima della preview confrontare registro DB e configurazione email.
  P13/report SQL resta da attivare in staging; P13 non è dichiarata conclusa.
- Verificati 743 test, lint, TypeScript, build staging, PostgreSQL 17 temporaneo
  e browser presenze/scanner desktop/mobile con dati sintetici.
- Nota locale main sulle migration production del 3 ottobre preservata in stash
  separato, non inclusa nel merge. Inventario e collaudi nel documento
  `docs/panel-main-integration-2026-10-03.md` e nel piano panel.

## Pubblicazione correzioni dashboard e associazione — 2026-10-02

- L’utente ha richiesto commit e push di tutte le modifiche locali su `main`:
  tag riservati, ruoli, nazionalità, conferme email e associazione dichiarata,
  inclusi test, documentazione e le due migration versionate.
- Verifiche applicative già superate sulla versione pubblicata: 635 test,
  lint, typecheck e build production; verifiche SQL locali e browser sintetico
  descritte sotto. Fetch prima del commit: `main` e `origin/main` a `01e0a82`.
- La pubblicazione del codice non applica le migration
  `20261002120000_operational_tags_managers_only.sql` e
  `20261002140000_operational_association.sql`: restano da eseguire sul database
  dell’ambiente esplicitamente concordato. Fino ad allora il salvataggio
  dell’associazione non è disponibile e la restrizione DB dei tag è incompleta.
  Nessuna modifica a database remoti o invio email in questa pubblicazione.

## Associazione dichiarata modificabile e colonna partecipanti — 2026-10-02

- Admin e manager dell’evento possono correggere o svuotare “Associazione /
  organizzazione” nella scheda dell’iscritto attivo. Si modifica il campo
  canonico `answers.externalGroupAssociation` del questionario più recente;
  le altre risposte, inclusa la partecipazione con Sant’Egidio, e le assegnazioni
  di gruppo restano preservate. Se manca il questionario viene creato un record
  minimo solo quando si aggiunge un valore. Testo libero, massimo 200 caratteri.
- Colonna facoltativa nella tabella Admin/Manager e nell’export delle colonne
  selezionate; Viewer in sola lettura, capogruppo escluso. Letture paginate per
  ID già autorizzati, proiezione del solo campo; un valore vuoto nel questionario
  più recente non riporta in vita dichiarazioni precedenti. Le statistiche
  delle associazioni leggono già lo stesso dato canonico.
- Migration locale `20261002140000_operational_association.sql`: RPC
  `get_operational_association` / `update_operational_association`, invocabili
  solo da service_role con attore derivato dalla sessione. Controllo DB di ruolo,
  evento corrente e iscrizione attiva, lock, confronto snapshot e audit atomico
  senza riportare il testo dell’associazione nei log. Conflitto o errore conserva
  il testo del form. Nessuna migration remota applicata: applicare all’ambiente
  concordato prima del rilascio. Nessun commit/push in questa modifica locale.
- Verifiche: 635 test applicativi, lint/typecheck e build production, PostgreSQL 17 temporaneo
  (scope, autorizzazioni, conflitti, cancellazione, audit/rollback), browser
  sintetico desktop/mobile e export XLSX. Main e origin/main allineati nei
  commit a `01e0a82` al fetch iniziale; conservate le altre modifiche locali.

## Tag riservati, ricerca ruoli, nazionalità e conferme email — 2026-10-02

- Lavoro locale su `main`, riallineato con pull fast-forward a `origin/main`
  `01e0a82` prima delle modifiche; fetch finale: zero commit divergenti.
  Nessun commit/push, rilascio o migration remota richiesti. Diagnosi remota
  in sola lettura; branch panel conservato separatamente.
- I capigruppo non vedono più catalogo, filtro, colonna o modulo dei tag.
  Il loader condiviso con l’export non legge i tag; preferenze/URL storici non
  possono reintrodurre la colonna. L’action verifica il ruolo effettivo:
  solo admin globale o manager dell’evento può assegnarli.
- Migration locale `20261002120000_operational_tags_managers_only.sql`, da
  applicare all’ambiente concordato prima del rilascio: revoca lettura e
  assegnazione ai capigruppo anche via API/RLS. Manager viewer conserva sola
  lettura; admin/manager gestione. Nessuna cancellazione dei tag esistenti.
  Questa scelta supera le precedenti descrizioni della Milestone 14.2.
- Ricerca ruoli: nomi in qualsiasi ordine, accenti, email e codice; include
  iscritti non eliminati dell’evento autorizzato con email anche senza profilo
  Auth. Account collegati deduplicati per ID, con nome del partecipante tra
  gli alias di ricerca. Assegnazione rilegge scope e identità sul server,
  riusa/crea l’account e non rinomina i profili esistenti. Nessuna email in
  fase di ricerca; inviti solo secondo la scelta nel modulo.
- Elenchi ruoli raggruppati per ID Auth, mai per email; apertura conferma
  rimozione porta focus e scroll ai pulsanti e chiude l’aggiunta aperta.
  Rimane il divieto di rimozione del proprio account, esplicitato nel testo
  e nel titolo del pulsante. L’utente segnala “non cliccabile”: resta da
  confermare se riguarda sé stesso o un’altra persona; nelle prove sintetiche
  sugli altri account rimozione, errore, retry e ultimo ruolo funzionano.
- Nazionalità presentate con il nome del paese nella lingua corrente, inclusi
  i valori storici inglesi riconosciuti; valori sconosciuti preservati. Nessuna
  riscrittura dei dati esistenti. In modifica, focus = ricerca vuota con elenco
  completo, valore salvato conservato finché non si scrive o seleziona.
  Localizzate anche tabelle, export e scheda personale.
- Conferma della presa in carico delle campagne email: scroll automatico al
  messaggio, annuncio accessibile e chiusura esplicita. Indica email in coda,
  senza anticipare l’avvenuta consegna. Salvataggi modelli visibili per 12
  secondi; gli altri messaggi mantengono il comportamento precedente.
- Verifiche locali: 632 test applicativi, lint/typecheck e build superati; PostgreSQL 17
  temporaneo per RLS tag e rimozione ruoli; browser desktop/mobile con dati
  sintetici e sette lingue. Nessun invio email o modifica di persone reali.


## Esportazioni presenze per gruppo — 2026-10-01

- Sezione Esportazioni distinta dalle statistiche, condivisa Admin/Manager e
  accessibile in sola lettura al Viewer dell’evento corrente. Quattro XLSX:
  A/A2 per gruppo, B/B2 con precedenza tag operatore > servizio assegnato > gruppo.
  Nomi sempre dal catalogo corrente; esempi storici solo per formato/accorpamenti.
- Figli inclusi nei totali e nelle presenze del genitore, ma per scelta esplicita
  restano nel gruppo d’iscrizione anche quando il genitore ha servizi o tag.
  Raccordo per ID/evento in lib/presence-exports; nessun matching approssimato.
  Nuove radici non mappate e operatori ambigui restano in sezioni esplicite.
- Download autorizzato prima delle letture, paginato e senza risultati parziali;
  nessuna scrittura DB, migration o email. Script amministrativo in
  scripts/export-group-presence.mts. Stampa con fasce complete, subtotali,
  totale generale, Date non indicate e data/ora di Roma. Dettagli, manutenzione
  del raccordo e limiti dello snapshot in docs/group-presence-exports.md.
  Verificati 619 test, lint, TypeScript, build production e browser desktop/mobile.
  Commit/push su main e normale rilascio Vercel autorizzati dall’utente.

## Associazioni dichiarate nelle statistiche — 2026-10-01

- In Gruppi e partecipanti, contatore espandibile con nome, presenze previste
  e associazione dichiarata per Admin/Manager/Viewer dell'evento autorizzato.
  Campo testo externalGroupAssociation, senza Sì/No separato: conteggiare
  solo stringhe non vuote, una volta per iscrizione attiva, senza eredità ai figli.
- Questionario più recente anche quando vuoto; proiezione del solo campo,
  letture paginate/batched e fail-closed. Nomi mancanti e presenze da comunicare
  espliciti; calendario completo incluso pomeriggio precedente l'evento.
- Nessuna migration, scrittura dati o email. 593 test con TZ=Europe/Rome,
  lint, TypeScript e build in copia isolata con npm ci; browser sintetico
  desktop/mobile e tastiera. Due test export preesistenti dipendono dal fuso
  italiano. Dettagli in docs/association-statistics.md. Commit/push su main
  e normale rilascio Vercel autorizzati dall’utente; modifiche parallele escluse.

## Dati assistiti e sesso interno — 2026-09-29

- Modulo condiviso Capogruppo/Manager/Admin: nazionalità, paese/luogo di nascita,
  residenza e sesso facoltativi, sette lingue. Residenza mai dedotta dal gruppo
  nei nuovi inserimenti; nessun riempimento dei record storici.
- Schede operative: editor separato dei tre dati geografici, snapshot/conflitti
  e audit atomici; nascita storica paese/città conservata. Navigazione modali
  invariata. Nazionalità selezionabile nelle tabelle e negli export.
- Sesso solo nell'inserimento assistito e nella colonna interna selezionata:
  relazione separata con RLS senza accesso utente, RPC service_role con scope
  evento/gruppi, nessuna lettura nei normali loader o nella scheda partecipante.
  Viewer escluso anche da chiamate dirette/export. Nessun sesso nel questionario,
  audit, email, statistiche, QR o preferenze salvate. L'export include solo
  le colonne selezionate e autorizzate.
- Migration `20260929120000_assisted_demographics.sql` applicata e registrata
  atomicamente in produzione prima del push autorizzato del 29 settembre.
  Dati e permessi delle 38 tabelle preesistenti, 23 routine pubbliche e 90 policy
  invariati; nuova relazione vuota, RPC solo service_role. Nessun dato reale
  modificato o email di prova. Creazione assistita
  multi-scrittura preesistente conservata; limiti e rilascio documentati in
  `docs/assisted-demographics.md`. Verificati 587 test, lint, TypeScript, build
  con npm ci in copia pulita, SQL temporaneo e browser sette lingue/mobile.
  Commit/push su main e normale rilascio Vercel autorizzati dall’utente.


## Importazione servizi da Excel — 2026-09-25

- Nuovo comando Manager/Admin accanto a Importa iscritti da Excel, modello
  distinto nome/cognome/servizio, modale e report Excel con esiti per riga.
  Mai creare partecipanti, account o servizi. Solo iscrizioni non eliminate
  dell’evento corrente; omonimi esclusi, nessun matching approssimato.
- Un solo servizio assegnato per persona: aggiornamento esplicito del precedente,
  note conservate. Righe identiche applicate una volta; servizi contrastanti
  per lo stesso nominativo esclusi tutti. Viewer escluso anche da URL/API.
- Migration `20260925210000_service_excel_import.sql` applicata e registrata
  atomicamente in produzione prima del push autorizzato del 25 settembre:
  RPC service_role con autorizzazione DB, confronto completo in un passaggio,
  lock contro omonimi/cancellazioni concorrenti, audit e ricevuta retry atomici.
  Impronte delle 37 tabelle pubbliche preesistenti, policy, grant/RLS di 38
  relazioni e 51 routine invariati; ricevute vuote. Nessuna email di collaudo.
- Verificati 559 test, lint, TypeScript e build con npm ci in copia pulita,
  PostgreSQL temporaneo/concorrenza
  e browser desktop/mobile dal file al report reale. Dettagli e procedure in
  `docs/service-excel-import.md`. Commit/push su main e normale rilascio Vercel
  autorizzati dall’utente. Successivamente autorizzata anche la correzione degli
  errori presenze, inclusa in un commit distinto e verificata insieme.

## Figli sempre visibili, disabilità ed Excel — 2026-09-25

- Partecipanti Manager/Admin/Viewer: figli sempre visibili sotto il nome,
  pulsante Mostra figli rimosso. Vista Figli accompagnati: Genitore in colonna
  dopo nascita/età, nome cliccabile per la scheda esistente.
- Colonna facoltativa Informazioni sulla disabilità per Manager/Admin e
  Capogruppo, anche in Excel. Solo risposte dichiarate alle tre opzioni attuali
  del form, senza inferenze; sette lingue Capogruppo, scope gruppi conservato.
  Viewer escluso anche da URL/export; letture paginate e fail-closed.
- Excel operativo e Capogruppo contengono sempre numero figli e Nomi e cognomi
  dei minori accompagnati, separati da punto e virgola in una cella. Tutti i figli
  collegati conservati anche se storicamente maggiorenni. Modello import invariato.
- Nessuna migration, modifica dati o email. Dettagli e regressioni in
  docs/children-overview.md. Commit/push su main autorizzati dall’utente.
  Verificati 549 test, lint, TypeScript, build e browser desktop/mobile.


## Avanzamento nelle attese lunghe — 2026-09-25

- ButtonProgress conserva la partenza rapida e aggiunge una coda che continua
  ad avanzare oltre il 90%, rallentando verso il 100% senza soglia fissa.
  Indicativamente 94% a 10 secondi, 97% a un minuto, circa 99% a cinque minuti.
  Riempimento completo solo al termine reale; errori, retry, opacità al 25%,
  blocchi dei comandi e movimento ridotto conservati in tutto il sito.
- La regressione browser richiede avanzamento strettamente crescente oltre
  il vecchio limite e incrementi più piccoli nelle attese lunghe. 545 test,
  lint, TypeScript e build con npm ci in copia pulita. Nessuna modifica ai
  dati, alle query, alla colonna email o alla gestione dei ruoli.


## Gestione ruoli cumulativi e modale persistente — 2026-09-25

- Modale nativa condivisa Admin/Manager: incarichi attuali, aggiunta separata,
  rimozione puntuale e modifica Principale/Secondario. Esiti nella modale, anche
  dopo l’ultimo incarico; chiusura conserva contesto e scroll. Errori specifici,
  self-removal disabilitata, blocchi invio e avanzamento condiviso.
- La selezione non sostituisce più gli altri ruoli. Superata la vecchia regola
  del select esclusivo: Manager e Manager viewer sono alternativi nello stesso
  evento; il cambio richiede rimozione esplicita. Tutti gli altri ruoli restano.
- Migration 20260925180000 applicata e registrata atomicamente prima del push:
  indice di esclusività e RPC di rimozione service_role con permessi, lock,
  aggiornamento referente e audit atomici. Zero conflitti storici; ruoli,
  membership, gruppi, profili e policy verificati invariati. Nessuna email o
  scrittura di collaudo su persone reali.
- 545 test, lint, TypeScript e build con npm ci in copia pulita; PostgreSQL
  temporaneo, concorrenza e browser desktop/mobile superati. Commit/push su
  main autorizzati. Dettagli in docs/operational-role-management.md.


## Caricamento condiviso in tutto il sito — 2026-09-25

- Esteso l’overlay approvato a tutti i ruoli e al pubblico/link di gruppo.
  Un solo ButtonProgress, condiviso da pulsanti, invii, link, download e
  selettore lingua; rimosso il provider/layout esclusivo del Manager.
  Modali operative condivise, nessuna duplicazione per ruolo.
- Conservati 25% di opacità e tempi rapidi approvati. Avanzamento stimato
  fino al 90%, completamento solo a risposta reale; errori senza 100%.
  Cursore CSS di attesa eliminato, blocchi invio/accessibilità conservati.
- Corretto LinkStatus: anche il contenitore dello stato accessibile esce
  dal flusso. Le statistiche non spostano più i numeri durante la navigazione;
  nessuna modifica a fasce, conteggi o dati.
- 537 test, lint, TypeScript e build con npm ci in copia pulita. Browser:
  operazioni/portali/errori/attese lunghe/reinvii, sette lingue, mobile e
  reduced motion; coordinate delle vere statistiche Manager/Admin stabili.
  Modale personale verificata con azioni sintetiche. Nessuna scrittura reale
  o email. Dettagli in docs/button-progress.md; modifiche parallele escluse.


## Prova caricamento pulsanti solo Manager — 2026-09-25

- Dopo la prova dell'utente, avanzamento iniziale accelerato: circa metà del
  pulsante in 0,4 secondi; transizione ridotta da 350 a 100 ms e conclusione
  visiva da 380 a 130 ms. Cap al 90%, pending reale e perimetro Manager conservati.
- `app/dashboard/manager/layout.tsx` abilita `ButtonProgressProvider`: solo
  questa area usa l'overlay al 25%, anche nei componenti condivisi e nei portal.
  Dashboard Admin, Capogruppo, personale e pubblico mantengono la rotella.
- Avanzamento stimato a passaggio unico, rallentato fino al 90%; completamento
  soltanto quando termina il pending reale di React/Next/download. Errori dei
  moduli e delle azioni esplicite interrompono l'overlay senza riempirlo. Nessuna
  percentuale dichiarata, attesa minima aggiunta o modifica ai blocchi invio.
  Se una navigazione smonta il pulsante, l'animazione termina con esso.
- `ProgressButton` conserva markup interno, colori e stato accessibile;
  movimento ridotto rispettato, timer ripuliti su retry e smontaggio. Nessuna
  modifica dati, permessi, query, migration o email di collaudo.
- Fixture `tests/browser/manager-button-progress.mjs`: moduli, errori, download,
  navigazione, attesa lunga, retry, portal, sette lingue, mobile, movimento
  ridotto e uscita dal perimetro Manager. Eseguire prima dei test unitari:
  le route sintetiche temporanee non fanno parte del catalogo dei link pubblici.
- Commit/push su main e normale rilascio Vercel autorizzati dall'utente per
  provare questa soluzione prima di decidere un'eventuale estensione al sito.
- Verificati 537 test, lint, TypeScript e build production dopo npm ci in
  copia pulita con i soli file di questa modifica; entrambe le fixture browser
  (nuovo overlay e feedback originale) superate. Modifiche parallele sulle
  email dei partecipanti escluse dal commit.

## Rilascio integrato: città obbligatoria e figli accompagnati — 2026-09-24

- Vista Figli accompagnati per Manager/Admin/Viewer: una riga per figlio con
  genitore espandibile e scheda esistente; iscritti principali sotto i 15 anni
  in una tabella separata. Ricerca, filtro gruppo per ID e Senza gruppo,
  indicatori globali e conteggi filtrati. Dati già autorizzati, nessuna query
  aggiuntiva o scrittura. Statistiche chiariscono inclusione dei figli.
- Schede storiche senza nascita/città/email conservate: letture e totali non
  applicano i nuovi requisiti di inserimento. Figli di genitori incompleti
  sempre inclusi; età ignota segnalata, non trasformata in zero o minore.
  Nessuna migration, modifica dei dati, RLS, permessi o email di collaudo.
- Rilettura READ ONLY: tutte le 23 iscrizioni Germania della diagnosi presenti,
  zero eliminate, 7 date e 20 città ancora da completare con informazioni reali.
- Verificati insieme 537 test, lint, TypeScript e build production in copia
  pulita con npm ci. Browser Manager/Admin desktop/mobile: espansione tastiera,
  ricerca, filtri, apertura/chiusura scheda con dati mancanti superati.
- Commit/push su main e normale rilascio Vercel autorizzati dall'utente per
  entrambe le modifiche. output/ riservato escluso dal commit.


## Città obbligatoria negli inserimenti assistiti — 2026-09-24

- Diagnosi READ ONLY Germania: 23 schede tutte da capogruppo manuale, 20 senza
  città e 7 senza nascita. Le 7 sono anteriori alla correzione nascita del 23
  settembre; le 11 del 24 settembre hanno tutte la data. Nessun caso proveniente
  dal pubblico/link di gruppo. Dati realmente mancanti, non un errore tedesco.
- Il modulo manuale condiviso Capogruppo/Manager/Admin richiede città nelle
  sette lingue, con controllo browser/server prima delle scritture. Salva la
  città dichiarata in city_other e nello snapshot; non copia city_id dal gruppo.
  Data obbligatoria/reale/non futura conservata. Excel richiede città anche
  riconfermando anteprime precedenti; pubblico/link hanno già entrambi i vincoli.
- Nessuna modifica storica, migration, RLS o email di collaudo. Regressioni
  parser/azioni/Excel e fixture browser required-registration-fields.mjs.
  Verificati 531 test, lint, TypeScript e build con npm ci in copia isolata;
  browser manuale sette lingue, pubblico/link in tedesco e mobile superati.
  Dettagli in docs/incident-2026-09-24-germany-required-fields.md. Modifica locale,
  inclusa nel rilascio integrato autorizzato del 24 settembre.
## Presenze nella modifica personale su mobile — 2026-09-26

- La scheda personale mostra le presenze in quattro riquadri su due colonne
  quando il contenitore è stretto; da 32rem torna alla tabella per fasce.
  Una sola serie di checkbox conserva selezioni e nomi dei campi durante il
  cambio di layout, senza duplicare valori nel salvataggio. Calendario,
  traduzioni e gestione delle presenze da comunicare invariati.

## Magic Link dopo inattività — 2026-09-24

- Il callback POST deve rinnovare `iscrizioni_last_activity` prima del redirect
  alla dashboard, soltanto dopo una nuova verifica OTP/PKCE riuscita e il
  completamento dell'accesso. Il vecchio cookie può sopravvivere alla sessione
  Auth: senza rinnovo, il proxy disconnette immediatamente il nuovo accesso
  con `error=inactive`, costringendo a richiedere un secondo Magic Link.
- Cookie con le stesse opzioni del proxy (HttpOnly, SameSite=Lax, Secure in
  produzione, path `/`, durata 30 giorni); timeout di inattività sempre 24 ore.
  GET/HEAD di conferma, link falliti e semplice riuso della sessione esistente
  non rinnovano il contatore. Ruoli, scanner protection e UI invariati.
- Regressioni dei veri handler callback/proxy/activity con Auth sintetico in
  `tests/magic-link-session-renewal.test.mts`; note in
  `docs/incident-2026-09-24-magic-link-inactivity.md`. Nessuna migration,
  modifica dati o email di collaudo. Verificati 524 test, lint, TypeScript,
  build production e passaggio HTTP reale con provider sintetico. Commit/push
  su main e rilascio Vercel autorizzati dall'utente il 24 settembre.

## Statistiche con gerarchia espandibile — 2026-09-23

- Riepilogo Manager/Admin dai collegamenti padre–figlio reali, anche per nodi
  superiori non iscrivibili; solo rami con persone. Nodi inizialmente chiusi,
  espansione ricorsiva, totali comprensivi dei discendenti e figli accompagnati.
  Nessuna deduzione dalla residenza. Filtri per ID del sottoalbero o assegnazione
  diretta; omonimi distinti. “Iscritti a … senza sottogruppo” compare solo per
  assegnazioni dirette quando sono presenti anche sottogruppi occupati.
- Nessuna modifica dati/permessi/migration. Test gerarchia, integrità e filtri in
  statistics-hierarchy.test.mts; fixture browser statistics-hierarchy.mjs.
  Verificati 522 test, lint, TypeScript e build in copia pulita con npm ci;
  browser Manager/Admin desktop/mobile, espansione e tastiera superati.
  Commit/push su main e pubblicazione Vercel autorizzati dopo anteprima approvata.

## Riepilogo per assegnazione corrente — 2026-09-23

- Statistiche Manager/Admin: elenco piatto per ID del gruppo corrente, gruppo
  effettivo oppure nodo Nazione/città/area iscrivibile. Nessun raggruppamento
  per residenza o antenati; omonimi distinti anche nei filtri dei conteggi.
  Figli e presenze conservati; senza gruppo e nodi non iscrivibili segnalati
  per mantenere i totali. Loader paginato legge anche is_assignable.
- Nessuna modifica dati, permessi o migration. Commit/push su main e rilascio
  Vercel autorizzati dall’utente. Verificati 518 test, lint, TypeScript e build
  in copia pulita con npm ci dal lockfile. Regressioni in event-statistics,
  statistics-loading e statistics-report-layout.


## Presenze in colonne per momento — 2026-09-23

- Selezionare Giorni di presenza espande la tabella Manager/Admin e Capogruppo
  in una colonna per giorno/fascia, nello stesso punto delle colonne scelte.
  Calendario dell’evento completo, incluso il pomeriggio precedente l’inizio;
  celle Sì/No nelle sette lingue. Per richiesta utente, presenze sconosciute o
  non comunicate restano Da comunicare, senza convertirle in assenze.
- Excel operativo e capogruppo usano le stesse intestazioni ordinate e celle.
  Presenze storiche senza fascia valgono per entrambe; permessi, query e dati
  invariati. Test calendario/celle/Excel e route capogruppo; fixture browser
  `tests/browser/attendance-columns.mjs` per entrambe le tabelle e mobile.
  Modifica locale, non pubblicata.


## Compatibilità build della fixture router — 2026-09-23

- Il deployment `0c632e4` è fallito: dipendenze locali Next 16.3 diverse dal
  lockfile Next 16.2.9 usato da Vercel. `bfcacheId` richiesto dal primo era
  rifiutato come proprietà extra nell’oggetto inline dal secondo.
- Fixture compatibile con entrambe tramite spread della proprietà aggiuntiva;
  mantenuti i controlli TypeScript. Rimossa anche la funzione ActionIcon inutilizzata.
  Prima dei rilasci verificare con `npm ci` dal lockfile e controllare lo stato
  effettivo del deployment: il solo push non conferma la pubblicazione.


## Riepilogo personale e annullamento — 2026-09-23

- Riepilogo allineato alla scheda di modifica con icone Lucide, riquadri e
  spaziature condivisi. Annulla la mia iscrizione in basso a destra nel
  riepilogo, fuori dalla modale di modifica; conferma separata e focus/Esc
  conservati. Rimossa dalle sette lingue la frase su account e incarichi.
- Nessuna modifica alla logica di annullamento o ai dati. Modifica locale,
  non pubblicata. Fixture browser aggiornata per la nuova posizione.

## Colonna giorni di presenza — 2026-09-23

- Colonna facoltativa `attendance` in Gestione iscritti Manager/Admin e nella
  tabella Capogruppo, conservata nelle preferenze e inclusa nell’Excel.
  Date ordinate, mattina/pomeriggio, sette lingue nel formatter; righe storiche
  senza fascia valgono per l’intera giornata. Nessuna riga indica Da comunicare;
  dati non caricati non sono convertiti in presenze assenti.
- Letture correnti per gli ID già autorizzati, paginate e bloccanti su errore;
  riepilogo operativo caricato soltanto nella sezione iscritti. Nessuna
  migration, modifica dei dati o pubblicazione. Test in
  `tests/attendance-summary.test.mts` includono paginazione ed Excel.


## Inserimento singolo in overlay — 2026-09-23

- Inserisci partecipante è accanto a Importa iscritti da Excel nella toolbar
  condivisa Manager/Admin. `manual=1` apre una modale nativa sopra l’elenco;
  catalogo ancora caricato solo all’apertura, Viewer escluso. Il vecchio URL
  `/dashboard/manager/nuovo` reindirizza alla dashboard con la modale aperta.
- X/Esc chiudono localmente e restituiscono il focus; scorrimento interno e
  sfondo bloccato. Form e azione conservano il contesto della dashboard con
  indirizzo di ritorno validato: filtri, colonne, ordine e menu. Dopo il
  salvataggio, conferma e nuovo modulo nella stessa modale. Nessuna variazione
  a scritture, permessi, dati o migration. Verificati 512 test, lint, TypeScript
  e build in copia isolata; browser sintetico sette lingue, desktop/mobile,
  Manager/Admin e Viewer. Modifica locale, non pubblicata.

## Inserimento singolo Manager/Admin — 2026-09-23

- Gestione iscritti offre Inserisci partecipante per Manager dell’evento corrente
  e Admin globali. Nuova pagina `/dashboard/manager/nuovo`, gruppi attivi e
  iscrivibili anche privati, nessuna membership richiesta. Catalogo paginato e
  caricato solo all’apertura; Viewer escluso anche da URL/azione diretti.
- Modulo e traduzioni condivisi col capogruppo, presenze non preselezionate,
  controlli nascita/duplicati/consenso e figli conservati. Errori mantengono i
  campi; successo apre un nuovo modulo. Senza email personale, il Manager usa
  la consegna al referente del gruppo, non una delega esplicita a sé stesso.
- Azione rilegge ruolo/evento/gruppo. Registrazione `source=admin` per il vincolo
  esistente, assegnazione/snapshot/audit distinguono Manager e Admin reali.
  Nessuna migration/RLS o scrittura di collaudo reale; resta il salvataggio
  multi-scrittura del flusso assistito esistente. Dettagli e limiti in
  `docs/manager-manual-registration.md`. Verificati 510 test, lint, TypeScript
  e build in copia pulita con npm ci; browser sintetico sette lingue, desktop/
  mobile e Viewer. Rilascio autorizzato dall’utente tramite commit/push su
  main e normale deployment Vercel.

## Più città nei suggerimenti dei gruppi — 2026-09-23

- Editor Manager/Admin mantiene Paese → Città facoltativa; Aggiungi un’altra
  città aggiunge righe rimovibili. Sette lingue e città fuori catalogo.
  La scelta generale conserva l’eredità o tutto il paese; l’opzione Tutte le
  città del paese può interrompere un vincolo urbano ereditato.
- Matching su qualunque città collegata, eredità dell’insieme più vicino,
  override esplicito e priorità urbana; fallback su paese per città non
  riconosciuta invariato. Relazione caricata con paginazione e fail-closed.
- Migration `20260923210000_group_multiple_cities.sql`: city_scope,
  relazione con FK/RLS subordinata al gruppo, RPC service_role con salvataggio
  e audit atomici, scope/versione/gerarchia e tutte le città validate. Singola
  città conserva city_id; gruppi regionali hanno city_id nullo per non dedurre
  arbitrariamente la residenza negli inserimenti assistiti. Nessuna modifica
  di persone, ruoli o assegnazioni. Migration applicata e registrata atomicamente
  in produzione il 23 settembre prima del push autorizzato. Dati delle 15
  tabelle operative, 89 policy e grant delle 36 tabelle preesistenti invariati;
  nuova relazione vuota e city_scope ereditato per tutti i gruppi.
- SQL temporaneo, parser, caricamenti paginati e matching collaudati; fixture
  browser in sette lingue/mobile. 502 test, lint, TypeScript e build superati.
  Dettagli in docs/operational-group-geography.md.

## Dashboard per tutti i ruoli assegnati — 2026-09-23

- I ruoli operativi si sommano: Manager/Manager Viewer non nascondono né
  impediscono le dashboard Capogruppo e Accoglienza se assegnate allo stesso
  account. Tab e autorizzazione condivisa da sessione/proxy seguono la stessa
  regola; area personale sempre disponibile, deleghe Admin invariate.
- Anche una membership capogruppo secondaria abilita la dashboard del gruppo.
  Verifica produzione READ ONLY del caso segnalato: entrambi gli incarichi
  presenti sullo stesso account e Fiumicino attivo nell'evento corrente.
  Il blocco era nella precedenza esclusiva dei ruoli, non nei dati.
- Viewer conserva Statistiche e Gestione iscritti in sola lettura; i permessi
  capogruppo valgono solo nella propria gerarchia. Nessuna modifica a ruoli,
  membership, dati, RLS o migration. Test di tutte le combinazioni dei ruoli,
  sette lingue, sessione e proxy con capogruppo secondario.
- Correzione del rilascio di produzione: 498 test, lint, TypeScript e build
  con npm ci in copia pulita; browser sintetico sette lingue/desktop/mobile
  superato. Pubblicazione tramite main/Vercel nel rilascio già autorizzato.

## Manager Viewer e iscrizione personale — 2026-09-23

- Manager Viewer vede solo Statistiche e Gestione iscritti nella dashboard
  operativa, in entrambi i formati del menu. Le altre sezioni sono respinte
  lato server prima dei loader, anche tramite URL diretto, vecchio alias
  servizi, parametri impliciti o navigazione memorizzata. Permesso Manager
  verificato sull'evento corrente; Admin globale conserva tutte le sezioni.
- Manager e Manager Viewer possono passare a Iscrizione e QR personale,
  nelle sette lingue. Superata la precedente esclusione dell'area personale:
  si usa lo stesso account email. Chi non è iscritto usa Avvia la mia iscrizione;
  il flusso esistente associa l'iscrizione all'account autenticato quando
  l'email coincide. Non creare iscrizioni vuote né inventare presenze/consensi.
- Verifica produzione in sola lettura: 10 account dell'evento, 6 già collegati,
  4 senza iscrizione, nessuna associazione pendente o ambigua alla stessa email.
  Nessuna modifica dati/RLS, migration o email.
  Verificati 493 test, lint, TypeScript e build con npm ci in copia pulita,
  browser sintetico sette lingue/desktop/mobile per entrambi i ruoli.
  Pubblicazione in produzione autorizzata dall'utente tramite push su main
  e deployment Vercel; superata la precedente richiesta di solo commit locale.
  Dettagli e collaudo in `docs/manager-personal-access.md`.

## Territorio modificabile da Manager/Admin — 2026-09-23

- Editor gruppi condiviso: paese e città facoltativa, catalogo esistente più
  opzioni del modulo pubblico, altra città, territorio ereditato esplicito.
  Cambio paese azzera la città; nessuna deduzione dai nomi. Nuovi testi nelle
  sette lingue; dati conservati in caso di errore. Cataloghi caricati solo
  aprendo l’editor, paginati e senza risultati parziali su errore.
- Migration `20260923180000_operational_group_geography.sql`: nuova RPC
  solo service_role, attore dalla sessione, Admin globale/Manager stesso evento,
  coerenza paese/città/antenati/sottogruppi e versione `updated_at` con PT409.
  Gruppo, eventuali cataloghi mancanti e audit atomici; RLS, iscrizioni e
  assegnazioni invariati. Migration applicata e registrata atomicamente in
  produzione il 23 settembre prima del push autorizzato: hash delle 15 tabelle
  operative e 89 policy invariati, grant solo service_role e conflitto PT409
  verificati senza scritture reali. Backup schema riservato in
  `/root/pace-release-20260923-group-geography/`. Rilascio autorizzato su main
  e Vercel. Dettagli in
  `docs/operational-group-geography.md`; test azione/parser, SQL temporaneo e
  browser sintetico sette lingue/desktop/mobile; 469 test, lint, TypeScript e
  build superati con npm ci in copia pulita.
- Precedente configurazione dati dei 12 paesi richiesta dall’utente già eseguita:
  sei gruppi nuovi (Cuba, Guatemala, Colombia, Nicaragua, Messico, Uganda),
  sei esistenti collegati (Costa d’Avorio, Nigeria, Senegal, Mozambico, Congo/RDC,
  Malawi). Tutti effettivi/pubblici/iscrivibili, nessun limite età/città. Audit e
  snapshot riservati in `output/country-groups-20260923/`; nessuna iscrizione
  o referente modificato. Africa/America Latina non sono paesi nel catalogo.


## Assisi: città territoriale nei suggerimenti pubblici — 2026-09-23

- Il filtro `nodeType=city` non bastava: Assisi ha `communityKind=territorial`.
  Il matching pubblico ora ammette anche le città territoriali pubbliche e
  iscrivibili nel normale selettore; filtri età/geografici e matching interno
  per tipologia invariati. Nessuna modifica al database o ai flag dei gruppi.
- Diagnosi READ ONLY: Assisi è attiva/pubblica/iscrivibile senza fasce età,
  eredita Italia dal padre; country_id/city_id propri vuoti. Non dedurre la
  città dal nome. Test aggiornati con la tipologia reale, prima fallivano in
  tre casi; fixture Assisi con nascita 2025, esclusioni e matching interno.
- 463 test, lint, TypeScript e build superati. Browser sul modulo con catalogo
  reale: Italia → Assisi, 15/06/2025; visibili e distinguibili Assisi e Diocesi
  di Assisi, selezione del corretto ID verificata senza inviare iscrizioni.

## Avviso età sotto un anno senza conferma — 2026-09-23

- Per richiesta dell’utente, l’avviso sotto un anno è solo informativo:
  rimossa la casella e il relativo blocco da moduli, server e import Excel.
  Restano data obbligatoria, valida e non futura, sette lingue e figli invariati.
  Le note precedenti sulla conferma descrivono il comportamento superato.

## Città pubbliche iscrivibili nel modulo — 2026-09-23

- Per richiesta dell’utente, il catalogo pubblico e il matching mostrano anche
  i nodi `city` con entrambi i flag pubblico e iscrivibile, oltre ad aree/gruppi.
  Restano esclusi paesi, città non pubbliche o non iscrivibili. Le precedenti
  note che escludevano tutte le città descrivono il comportamento superato.
- Territorio ereditato, filtri geografici/età e ordinamento invariati; nessuna
  modifica dati, schema, ruoli o assegnazione automatica. Test del loader
  paginato e del matching. Rilascio insieme ai controlli nascita autorizzato
  tramite commit/push su main; 462 test, lint, TypeScript e build superati.

## Data di nascita obbligatoria e controllo età zero — 2026-09-23

- Rilascio autorizzato tramite commit/push su main il 23 settembre:
  data obbligatoria/reale/non futura nel pubblico,
  capogruppo e import manager/admin. Modifiche identità non possono svuotarla;
  update parziali dei contatti la conservano. Nessuna migration o modifica RLS.
- `ParticipantBirthDateField` condiviso nelle sette lingue: sotto un anno alla
  compilazione, avviso e conferma legata alla data; un cambio la azzera. Controlli
  anche sul server e nell’import Excel, comprese anteprime pregresse. Figli
  accompagnati invariati; mai inventare o dedurre date mancanti.
- Diagnosi produzione READ ONLY: inizialmente 33 date mancanti, tutte capogruppo
  e vuote negli snapshot originali; salite a 37 durante l’analisi. 15 iscritti
  principali di 0 anni all’evento e 8 date future, 4 sovrapposti: 19 schede da
  verificare. Elenco nominativo riservato solo in `output/`, non nei documenti
  tecnici. Nessuna scrittura reale o email. Dettagli e collaudo in
  `docs/participant-birth-date-validation.md`. Verificati 462 test, lint,
  TypeScript, build e browser sette lingue/mobile in copia pulita con npm ci.

## Modale personale e annullamento autonomo — 2026-09-22

- Scheda personale con icone Lucide, sezioni espandibili, dialog nativo accessibile
  e conferma separata nelle sette lingue. Esc nella conferma non chiude la scheda;
  focus iniziale su Mantieni iscrizione, errori conservati, invii duplicati bloccati.
- `cancelOwnRegistration` ricava l’attore da Auth. Nuova RPC solo service_role
  `cancel_own_registration`: lock e verifica proprietario/evento corrente anche per
  account operativi; disponibile oltre la chiusura modifiche, reinvio idempotente.
  Soft delete e revoca QR, audit atomico, conservazione storico/figli/account/ruoli,
  scollegamento identità senza altre iscrizioni vive per consentire riuso email.
  Annulla solo destinatari in coda della propria iscrizione, preservando deleghe
  altrui; RPC operativa e RLS invariate.
- Migration `20260922210000` applicata e registrata atomicamente in produzione
  il 22 settembre prima del push autorizzato. Impronte delle 15 tabelle operative,
  RLS e RPC operativa invariate; nuova RPC verificata solo service_role. Backup
  schema riservato in `/root/pace-release-20260922-self-cancellation/`.
  Test azione, PostgreSQL temporaneo e browser sintetico sette lingue/mobile;
  447 test, lint, typecheck e build superati; procedure in
  `docs/self-registration-cancellation.md`. Pubblicazione autorizzata tramite
  commit/push su main e Vercel; nessuna modifica a persone reali o email di collaudo.

## Rilascio integrato delle tre attività — 2026-09-22

- Verificata la compatibilità di gestione/eliminazione gruppi e figli sempre
  visibili, aggiunta figli/accessibilità operativa e riutilizzo email eliminate.
  Test integrato `tests/sql/combined-operational-release.sql`: eliminazione gruppo
  conserva figli/accessibilità e revoca lo scope capogruppo; il Manager mantiene
  accesso, eliminazione iscrizione impedisce modifiche e scollega l’identità.
- Migration `20260922180000`, `20260922190000`, `20260922200000` applicate e
  registrate insieme in una transazione in produzione prima del push autorizzato.
  Hash delle 13 tabelle operative invariati, RLS e grant della RPC ciclo vita
  invariati; nuove RPC solo service_role e DELETE groups revocato come previsto.
  Scollegate soltanto 11 identità con sole iscrizioni eliminate, con audit;
  contenuto storico conservato. Backup riservato sul server in
  `/root/pace-release-20260922-combined/`.
- 439 test, lint, typecheck, build production, tre fixture SQL, test SQL integrato
  e concorrenza gruppi superati. Browser sintetico gruppi, accessibilità/aggiunta
  figli e tabella capogruppo nelle sette lingue e desktop/mobile superato.
  Nessuna eliminazione di collaudo su dati reali né email inviata.
- Pubblicazione autorizzata dall’utente tramite commit/push su main e Vercel.
  La cancellazione locale della presentazione e `output/` sono estranei al rilascio.
  Le note precedenti «non pubblicata/applicata» descrivono lo stato preparatorio.

## Figli sempre visibili nella tabella capogruppo — 2026-09-22

- `toLeaderTableRow` conserva i figli già caricati e ordinati dalla lettura
  scoped delle iscrizioni del capogruppo. `LeaderParticipantsTable` li mostra
  sempre sotto il genitore nella colonna nome, non nascondibile: badge con
  numero, nomi/cognomi e età all’inizio dell’evento. Nessun interruttore.
- `AccompanyingChildrenList` condivide il markup con la tabella Manager/Admin,
  dove resta attivato soltanto da Mostra figli accompagnati. Etichette nelle
  sette lingue, gestione di meno di un anno ed età non disponibile.
- Nessuna modifica a query, permessi, schema, dati o colonne dell’export.
  Regressione del mapper e fixture browser `leader-participants.mjs`: figli
  collegati al genitore, ordinamento/colonne, desktop/mobile e sette lingue.
  Verificati 439 test, lint, typecheck e build production.
  Modifica locale, non pubblicata.


## Riutilizzo email degli eliminati — 2026-09-22

- Il controllo iscrizioni email ignora gli eliminati; il capogruppo può
  ricreare anche la stessa persona senza deroga duplicati, anche da Excel. Email ancora usate
  da iscrizioni attive dell'evento restano bloccate. Letture paginate e fail-closed.
- `lib/registrations/email-identity.ts` esclude identità con sole iscrizioni
  eliminate da sincronizzazione, login, referenti e modifica contatti, evitando
  di riscrivere o ricollegare lo storico quando un indirizzo viene riutilizzato.
  Identità operative senza iscrizione e persone attive in altri eventi conservate.
- Migration `20260922200000_deleted_registration_email_reuse.sql` preparata,
  NON applicata in produzione: scollega Auth dall'ultima iscrizione eliminata
  dopo la cancellazione coda, con audit; include eliminazioni pregresse. Conserva
  account Auth e ruoli. Ripristino rifiutato PT409 se email riutilizzata nell'evento.
- Test `tests/deleted-email-reuse.test.mts`, regressione inserimento in
  `tests/account-access.test.mts`, PostgreSQL temporaneo in
  `tests/sql/deleted-email-reuse.sql`. Dettagli e limiti di rilascio in
  `docs/deleted-registration-email-reuse.md`. Nessun invio o modifica dati reali.

## Accessibilità e aggiunta figli nelle schede operative — 2026-09-22

- Le modali capogruppo e Manager/Admin includono modifica delle tre opzioni
  di accessibilità esistenti e inserimento figli, anche nelle schede senza figli.
  Componenti condivisi, sette lingue, errori conservano i dati, refresh mantiene
  la selezione. Nuovi figli fino a dieci, prima posizione libera senza rinumerare
  i fratelli; UUID di richiesta rende idempotente il reinvio dello stesso inserimento.
- `operational-registration-actions.ts` deriva l’attore dalla sessione. Migration
  `20260922190000_operational_registration_additions.sql`: RPC solo service_role,
  lock iscrizione, Admin globale/Manager evento/capogruppo con gerarchia attiva,
  evento e assegnazione correnti; esclusi eliminati/viewer/gruppi estranei.
  Accessibilità letta solo aprendo una scheda modificabile; errori non diventano
  dati vuoti. Scrittura con snapshot/versione, conflitti PT409, audit atomico.
- Chiavi storiche e richiesta distinta di ricontatto `needs_operational_support`
  conservate. Nessun cambio RLS, consensi, QR, gruppi o presenze. Date dei figli
  coerenti con inserimenti assistiti e correzioni storiche; limite 0–17 solo pubblico.
- Migration e codice non ancora pubblicati/applicati in produzione: migration
  prima del rilascio. Test azioni, SQL su PostgreSQL temporaneo e browser
  sintetico nelle sette lingue/mobile; procedure in
  `docs/operational-registration-additions.md`. Nessuna scrittura di collaudo
  su persone reali o invio email.

## Eliminazione gruppi e guida esterna — 2026-09-22

- `GroupDeleteButton` nell’elenco Gruppi Admin/Manager: anteprima conteggi,
  conferma esplicita, dialog accessibile, sette lingue, filtri conservati e
  messaggio di successo. Il portal blocca la propagazione di onChange per non
  attivare AutoFilterForm del Manager. Nessun comando per viewer/capogruppo.
- Per richiesta esplicita, eliminare il gruppo NON elimina persone, account,
  iscrizioni, figli, presenze o QR. Rimuove solo i collegamenti a quel gruppo:
  gli iscritti correnti restano senza gruppo; i referenti mantengono account e
  altri incarichi. I sottogruppi bloccano la rimozione, senza cascade gerarchico.
- Migration locale `20260922180000_group_deletion.sql`: RPC service_role-only
  `manage_group_deletion`, attore dalla sessione, Admin globale/Manager stesso
  evento verificati nel DB, lock e impronta su gruppo/collegamenti, conflitti
  PT409, audit atomico con snapshot dei collegamenti rimossi. Revoca solo
  DELETE diretto di groups ad anon/authenticated; altre policy/grant invariati.
  Hash dei link dismessi in tabella privata app, riuso impedito anche creando
  un gruppo omonimo. Nessun hash/token/ciphertext nell’audit o nel browser.
- Non ancora applicata in produzione né pubblicata: migration prima del codice.
  Test SQL temporanei (anche 1.205 assegnazioni), concorrenza multi-sessione,
  azione server e browser sintetico nelle sette lingue. Verificati 428 test,
  lint, typecheck e build production. Procedure e limiti in
  `docs/group-deletion.md`. Nessuna cancellazione o email reale di collaudo.
- Tutorial esterno `docs/guida-gruppi.docx` e sorgente `.md`: esempi di gruppo
  effettivo, paese, città e area, distinzione iscrivibilità/visibilità, referenti,
  link ed eliminazione. Il modulo non imposta country_id/city_id dai nomi;
  la guida spiega che la configurazione geografica del catalogo va verificata.


## Saturazione API per conflitti obsoleti — 2026-09-22

- PostgREST 14.6 ritenta indefinitamente SQLSTATE `40001`: non usarlo per
  conflitti applicativi deterministici. Alle 16:54:58 Europe/Rome annullate
  con `pg_cancel_backend` dieci richieste `review_participant_duplicate` in
  ciclo, che occupavano tutte le connessioni e causavano `PGRST003`/HTTP 504
  anche su ruoli, dashboard e modulo pubblico. Nessun riavvio del database.
- Migration `20260922153000_nonretryable_stale_conflicts.sql` applicata e
  registrata atomicamente in produzione: revisioni duplicati, importazioni
  e modifiche figli restituiscono `PT409` per versioni obsolete. Cambiano solo
  i codici, preservando corpo delle funzioni, lock, controlli e grant verificati.
  L'app riconosce PT409 e il precedente 40001 come conflitti da ricaricare.
- Regressione SQL `tests/sql/nonretryable-stale-conflicts.sql`, regressioni
  azione figli e mapper qualità. Prova HTTP reale con ID sintetici e versione
  deliberatamente obsoleta: 409/PT409 in 182 ms prima di qualsiasi scrittura,
  successiva lettura HTTP 200. Diagnosi e limiti in
  `docs/incident-2026-09-22-postgrest-retries.md`.

## Iscrizioni nelle sette lingue — 2026-09-22

- La lingua selezionata viene salvata da `submitPublicRegistration`, ma il
  vincolo storico `participants_preferred_locale_check` ammetteva solo it/en:
  fr/de/es/nl/uk fallivano alla prima INSERT del partecipante (SQLSTATE 23514).
- Migration `20260922120000_participant_supported_locales.sql` applicata e
  registrata atomicamente in produzione il 22 settembre: il solo vincolo dei
  partecipanti ora ammette le sette lingue di `SUPPORTED_LOCALES`. Default,
  dati storici, grant, RLS e altri vincoli invariati. Conteggio e hash dei 1.919
  partecipanti verificati invariati nella transazione protetta da lock.
- Regressione su PostgreSQL temporaneo in
  `tests/sql/participant-supported-locales.mts`: riproduce i cinque errori
  originali, verifica INSERT/UPDATE nelle sette lingue, conservazione dei dati
  e default, rifiuto di valori sconosciuti e null. Dettagli e comando in
  `docs/incident-2026-09-22-registration-locales.md`. Nessuna iscrizione reale
  di collaudo o email inviata; correzione DB immediatamente attiva senza build.

## Modifica figli nelle schede operative — 2026-09-21

- `OperationalChildrenEditor` permette a Manager/Admin e capogruppo di modificare
  nome, cognome e data di nascita o rimuovere singoli figli con conferma. Moduli
  separati per salvataggio/rimozione: dati errati nei campi non impediscono
  l’eliminazione. Sette lingue, errori conservano gli inserimenti; refresh della
  scheda mantiene filtri e selezione. Inserimento nuovi partecipanti invariato.
- `updateOperationalChild` deriva l’attore dalla sessione e chiama la RPC
  service_role-only `update_operational_child`: autorizza Manager dell’evento,
  Admin globale oppure capogruppo nell’evento corrente e gerarchia attiva con
  assegnazione corrente. Esclude iscrizioni eliminate, viewer e gruppi estranei.
- RPC con lock iscrizione/figlio, confronto dei dati originari contro conflitti,
  modifica puntuale e audit prima/dopo atomici. Mantiene ID e posizioni degli
  altri figli; gruppo, presenze, QR e dati del genitore invariati. Nessun limite
  di 17 anni sulle correzioni storiche, nessuna modifica alle policy RLS.
- Migration `20260921120000_operational_children.sql` applicata e registrata
  atomicamente in produzione il 21 settembre, prima del push autorizzato.
  Conteggio/hash dei 73 figli invariati; privilegi solo service_role verificati.
  Nessuna scrittura di collaudo su partecipanti reali. Test SQL su PostgreSQL temporaneo in
  `tests/sql/operational-children.sql`, azione/parser in
  `tests/operational-children.test.mts`, browser con azioni sintetiche in
  `tests/browser/operational-children.mjs`. Verificati 419 test, lint, typecheck,
  build production, SQL e browser nelle sette lingue/mobile senza azioni reali.

## Presenze nuovi partecipanti capogruppo — 2026-09-21

- Il solo modulo di inserimento nuovi partecipanti del capogruppo passa
  `initialUnknown={false}` a `ManualAttendanceFields`: nessuna presenza né
  «Non lo so ancora, lo comunicherò in seguito» preselezionata. L’opzione resta
  disponibile; il validatore esistente richiede fasce oppure la scelta esplicita
  di presenze da comunicare. Modifica delle presenze esistenti e altri utilizzi
  del componente invariati. Nessuna modifica dati o schema.

## Controlli nuove iscrizioni pubbliche — 2026-09-21

- Il modulo pubblico condiviso dai link di gruppo richiede `emailConfirmation`;
  confronto normalizzato nel browser e in `parseRegistrationForm`, prima delle
  scritture. La conferma non entra in `RegistrationInput` né nel database.
- Per scelta dell’utente niente slider: mantenuta la data di nascita dei figli.
  `public-child-age.ts` calcola i limiti inclusivi per 0–17 anni compiuti alla
  data di iscrizione (giorno UTC, coerente con il validatore esistente), usati
  dal campo data e dal solo parser pubblico. Date future e diciottesimo
  compleanno esclusi; gestiti anni bisestili. Validatori condivisi con modifiche
  storiche e inserimenti assistiti invariati.
- Testo nelle sette lingue: funzione per bambini accompagnati, sempre collegati
  all’iscrizione del genitore per panel/altri eventi; se entrambi i genitori si
  iscrivono alla preghiera, inserire i figli con un solo genitore.
- Accesso, modali operative, dati storici, schema e RLS invariati. Modifiche
  autorizzate per il rilascio tramite main/Vercel il 21 settembre.
  Test in `tests/public-email-confirmation.test.mts`,
  `tests/public-child-age.test.mts`; fixture browser separata in
  `tests/browser/public-registration-controls.mjs` (route temporanea, nessun invio).
  Verificati 415 test, lint, typecheck, build e browser nelle sette lingue,
  modulo generale/link di gruppo e layout mobile; nessun errore browser.


## Salvataggio schede personali e operative — 2026-09-18

- `updateParticipantDashboard` normalizza `participants` ed `events` con
  `relatedOne`: PostgREST restituisce oggetti per le relazioni molti-a-uno.
  Non usare solo `[0]`: respinge il proprietario legittimo prima del salvataggio.
  Le letture dei dati da conservare devono riuscire prima di qualsiasi scrittura.
- Il modulo identità/contatti Admin/Manager usa `/dashboard/participants/update`.
  Non spostarlo sotto `/dashboard/admin`: il proxy reindirizza i manager con 307
  prima del handler. Vecchia route admin conservata come alias. Autenticazione,
  origine, validazione e verifica Admin globale/Manager nel handler; scope evento,
  iscrizione/partecipante e transazione restano nella RPC esistente.
- Test completi delle azioni personale e capogruppo, route operativa e proxy;
  SQL temporaneo per operazioni/presenze e scope. Diagnosi e limiti in
  `docs/incident-2026-09-18-participant-save.md`. Nessuna modifica dati/RLS o invio.
  Pubblicazione in produzione autorizzata il 18 settembre; rilascio tramite main/Vercel.


## Lingua delle email pubbliche — 2026-09-18

- `submitPublicRegistration` risolve la lingua lato server con `getRequestLocale`
  (cookie del selettore, poi lingua browser, fallback inglese). La passa alla
  creazione come `preferredLocale`: viene salvata sul partecipante e usata dalla
  conferma, anziché conservare il default inglese del parser.
- `registration-confirmation-copy.ts` contiene oggetto, corpo e testo alternativo
  QR nelle sette lingue. Testo semplice e HTML condividono gli stessi messaggi;
  il titolo ufficiale dell'evento resta quello del catalogo, anche se bilingue.
- Magic Link italiano/inglese nello stesso messaggio, con identico URL in entrambe
  le sezioni. Token, callback e trasporto Postmark invariati.
- Notifiche per inserimenti assistiti e ruoli continuano a usare la lingua del
  paese del gruppo. Nessun aggiornamento delle preferenze storiche o reinvio.
- Regressioni in `tests/registration-email-locales.test.mts` e nel test dell'azione
  pubblica: scelta lingua, sette template, escaping, QR e Magic Link bilingue.


## Audit oltre 1.000 iscritti — 2026-09-18

- Monitoraggio Admin, campagne, identità operative, cataloghi/gerarchie e letture
  di ruoli/link usano pagine da 500 con ordine stabile; filtri estesi suddivisi
  in blocchi da 100. Anche le relazioni uno-a-molti vanno paginate dentro ciascun
  blocco. Non sostituire paginazione con aumento del limite PostgREST.
- `writeRowsForIds` limita i filtri delle scritture e interrompe al primo errore.
  La modifica dei destinatari invalida prima il precedente test della campagna:
  un errore intermedio non può lasciare una selezione parziale pronta all'invio.
- `findAuthUserByEmail` scorre Auth Admin in pagine da 500: niente ricerca solo
  nella prima pagina. Errori non equivalgono ad account assente.
- Conservare le factory lazy dei loader Manager per rispettare `dashboardLoadPlan`.
- Audit, percorsi già protetti e limiti in `docs/row-cap-audit-2026-09-18.md`;
  regressioni in `tests/row-cap-audit.test.mts`. Nessuna modifica dati/RLS/invii.


## Iscrizione personale e limite righe per Admin — 2026-09-18

- La dashboard partecipante filtra `participants.auth_user_id` con l'account
  autenticato direttamente nella query `registrations` con join interno,
  prima del limite. Mantiene evento corrente, esclusione degli eliminati e
  controllo difensivo del proprietario; seleziona l'ultima iscrizione con
  ordine stabile `submitted_at DESC, id DESC` e `limit(1)`.
- Il vecchio filtro solo in memoria perdeva le iscrizioni più vecchie degli
  Admin quando le righe visibili superavano il massimo PostgREST di 1.000.
  Riprodotto su Stefano e Daniela: iscrizioni e QR presenti e attivi. Il
  partecipante ordinario verificato vede una sola riga tramite RLS. Nessuna
  modifica a dati, ruoli, QR o testi/interfaccia ordinaria.
- Gli errori della query interrompono il caricamento usando il boundary già
  condiviso, anziché apparire come assenza di iscrizione.
- Regressioni in `tests/personal-registration-scope.test.mts`: query reale
  del componente con builder Supabase, oltre 1.000 righe, Admin/Manager,
  partecipante, eliminati/altro evento, assenza, proprietà ed errore DB.
  Verificati 345 test, lint, typecheck e build in export pulito con npm ci;
  query aggiornata verificata in sola lettura su entrambi gli account e un
  partecipante ordinario, permessi authenticated verificati via SQL readonly.


## Prestazioni dashboard — 2026-09-18

- Apertura/chiusura schede Admin/Manager (anche Duplicati) tramite dati già
  caricati e `LocalQueryLink`/cronologia nativa; selezione da `useSearchParams`,
  URL diretto, filtri, colonne e cronologia conservati. Testi e grafica invariati.
- Presenze caricate separatamente dal GET privato autenticato
  `/dashboard/participants/attendance`: admin globale o manager dell’evento,
  iscrizione attiva, no-store, annullamento richieste alla chiusura. Salvataggio
  tramite azione esistente; versione del pannello rinnovata a ogni risposta server.
- Scheda capogruppo chiudibile localmente; apertura continua a controllare
  scope/QR/presenze sul server. Link di gruppo caricati solo nello strumento link.
- `dashboardLoadPlan` limita i dati alla sezione visibile. `loadRowsForIds`
  esegue ondate di tre blocchi da 100, mantenendo paginazione, ordine, deduplica
  e interruzione senza risultati parziali. Nessuna cache di dati o autorizzazioni.
- `vercel.json` fissa la regione delle funzioni a `fra1` (Francoforte): il
  database Hetzner è in `fsn1-dc14`, verificato dai metadata della VM. Il
  deployment precedente usava `iad1` (USA). Verificare la regione nel rilascio.
- Attività sessione forzata solo quando cambia il percorso stabile memorizzabile;
  interazioni restano sincronizzate al minuto, con lo stesso timeout di 24 ore.
- Diagnosi, misure e collaudo in `docs/performance-2026-09-18.md`. Nessuna
  migration, modifica RLS o scrittura di collaudo sui partecipanti reali.

## Territorio ereditato nei suggerimenti di gruppo — 2026-09-16

- Il catalogo pubblico carica con paginazione stabile tutti i gruppi attivi
  dell'evento, inclusi gli antenati non pubblici/non assegnabili. Solo dopo
  la risoluzione espone al browser i gruppi e le aree pubblici assegnabili.
- `lib/groups/territory.ts` integra paese e città mancanti dal più vicino
  antenato valorizzato, senza riscrivere i dati. La città esplicita prevale;
  cicli, antenati mancanti/inattivi/di altro evento e paesi contraddittori
  interrompono il caricamento. Non dedurre territori dai nomi dei gruppi.
- Il matching mantiene la precedenza della città sul paese, poi specificità
  del nodo e ordine pubblico; conserva filtri età, tipologia e visibilità.
  Gruppi di altre città sono esclusi se la città personale è riconosciuta;
  senza città riconosciuta resta il fallback del paese. Nessuna assegnazione
  automatica né modifica a link riservati, ruoli, database o RLS.
- Diagnosi in sola lettura: Varsavia e Poznan Chojna hanno territorio diretto
  vuoto e padre Polonia. La nuova risoluzione sui 112 gruppi attivi li propone
  entrambi come gruppi nazionali; una precedenza per città richiede una città
  associata al gruppo o a un suo antenato.
- Regressioni in `tests/group-territory-inheritance.test.mts`: caso Polonia,
  ereditarietà multilivello, ordine città/paese, filtri, gerarchie invalide,
  oltre 1.000 nodi e interruzione su errore nelle pagine successive.
  Verificati 336 test, lint, typecheck e build con dipendenze da `npm ci`.
- Prima della modifica, `main` riallineato con pull fast-forward da `8062b90`
  a `5e6d3ff`; cartella locale `output/` conservata. Modifica non pubblicata.

## Normalizzazione multilingue dei paesi — 2026-09-16

- `country-names.ts` riconduce i nomi nelle sette lingue allo stesso codice ISO,
  con alias espliciti e confronto senza accenti, mai approssimativo. Conserva
  le etichette italiane già usate dal catalogo e dalle città. Valori storici
  sconosciuti restano visibili; corrispondenze multiple non scelgono un ID.
- Il modulo pubblico mostra e cerca le etichette nella lingua dell'interfaccia,
  mantenendo le chiavi canoniche per città e gruppi. Anche `Altro / non in lista`
  passa dalla stessa validazione. Parser e salvataggio normalizzano il paese;
  il resolver cerca l'ID tramite `countries.iso2` e interrompe il salvataggio
  se fallisce la lettura del catalogo, paginata. Paesi validi non presenti nel
  catalogo restano ammessi come testo canonico, senza creare nuove righe.
- `participantGeography` normalizza anche i dati preesistenti per elenchi,
  statistiche ed export. Il paese della scheda capogruppo usa lo stesso helper.
  Testo esplicito mantiene precedenza su collegamenti di catalogo obsoleti;
  gerarchia territoriale del gruppo e assegnazioni restano invariate.
- Verifica in sola lettura della scheda 5H5R: `España` risolve `ES` e si mostra
  come `Spagna`. Nessuna riscrittura dati storici, migration o modifica RLS.
  Rilascio autorizzato tramite push main/Vercel il 16 settembre.
  Test in `tests/country-normalization.test.mts`
  e fixture browser `tests/browser/country-normalization.mjs`. Verificati 330
  test, lint, typecheck e build in copia pulita con `npm ci`; browser nelle
  sette lingue, desktop/mobile, nessun invio. Eseguire la fixture browser
  separatamente dalla suite: monta temporaneamente una route di collaudo.


## Recupero campagne e conferma magic link — rilascio 2026-09-16

- Batch Postmark distingue rifiuti definitivi, `retry`, `blocked` e `unknown`.
  HTTP 429 e manutenzione dichiarata (ErrorCode 100) sono riprogrammabili;
  rete, risposte malformate e HTTP 5xx non confermati restano incerti, senza
  retry. Errori di configurazione/account sospendono fino a ripresa manuale.
  Dopo un errore generale nessun altro sottobatch viene inviato; i messaggi
  non ancora sottoposti tornano scheduled. Successi misti vengono salvati.
- Migration `20260916120000_email_campaign_recovery.sql` applicata e registrata
  atomicamente il 16 settembre prima del nuovo worker: stato destinatario `unknown`, campagna `attention`,
  controllo globale service_role-only con pausa persistente, backoff 60s–1h
  e Retry-After fino a 24h. Claim e pausa condividono il lock; le richieste
  già in volo possono terminare. Nessuna riscrittura dei destinatari storici.
  `resume_email_campaign_delivery()` rimuove la pausa dopo correzione della
  configurazione, ma non riaccoda unknown/sending/failed. Dashboard mostra
  pausa/blocco ed Esiti da verificare. Non riavviare esiti incerti senza
  riconciliazione con Postmark. Dettagli in `docs/postmark.md`.
- GET `/auth/callback` mostra soltanto la conferma, in sette lingue, senza
  client Auth né consumo di token, anche per vecchi link token/code. Solo
  POST dal medesimo origin verifica OTP/PKCE e conclude il flusso esistente;
  redirect 303, no-store e referrer limitato all’origine (mai token/query),
  nessun JS o prefetch automatico. I nuovi
  magic link richiedono hashed_token: niente fallback al link Supabase che
  consumerebbe il token prima della conferma. Scope limitato ai punti 3 e 5
  della revisione: altri rilievi esplicitamente rinviati dall'utente.
- Test trasporto/worker e callback con provider/Auth simulati; SQL su PGlite
  temporaneo, fixture `tests/sql/email-campaign-recovery.sql`. Rilascio
  autorizzato tramite push main/Vercel; timer sospeso e controllo globale
  bloccato durante il passaggio. Conteggio e hash dei 3.324 destinatari
  invariati nella migration; nessun invio di prova o reinvio storico.
- Verifiche finali: 322 test, lint, typecheck e build production; dipendenze
  dal lockfile in copia pulita per evitare directory duplicate preesistenti.
  Browser sintetico desktop/mobile: GET/HEAD ripetuti, sette lingue, nessuna
  chiamata Auth prima del clic, POST unico verso Auth locale simulato e ritorno
  a login per token scaduto. Referrer strict-origin: no-referrer produrrebbe
  Origin:null sul POST nativo Chromium e verrebbe respinto dal controllo CSRF.

## Rilascio Postmark — 2026-09-15

- Rilascio operativo `e74d395`, deployment Vercel READY
  `dpl_8mr9uuYWXvztxnV3yPEm1VxAwXvb`, alias registrationspeace.santegidio.org.
  Migration `20260912180000` applicata e registrata in transazione: hash dei
  destinatari invariato, RPC solo service_role. Timer attivo, prima chiamata
  HTTP riuscita con coda vuota. Magic link richiesto dal browser in produzione
  alla casella di servizio: Postmark Delivered, Google SMTP 250, stream outbound.
  Callback login non eseguita. 310 test e build Vercel superati.
- Pubblicazione autorizzata dall’utente. Scope Vercel reale:
  `giovaniperlapaces-projects`, progetto `iscrizioni-pace`, piano Hobby.
  Lo scope storico stefano-orlandos-projects-de2d57cb non è più accessibile.
- Cron Vercel rimosso: Hobby non permette frequenza al minuto. Richiamo
  autenticato mediante timer systemd sul server DB esistente, definizioni
  in `scripts/postmark-cron/`. Config riservata `/etc/iscrizioni-pace/email-cron.conf`,
  root 0600; token CRON_SECRET condiviso con produzione, mai in Git.
  Timer dopo 60 secondi dal completamento, niente esecuzioni sovrapposte.
- SMTP precedente conservato nelle env per rollback ma ignorato dal nuovo codice.
  Nuove env Postmark in produzione e sviluppo. Backup RPC precedenti locale
  `/tmp/pace-postmark-release/rollback-queue.sql`. Coordinare deployment,
  migration atomica e avvio timer; nessuna riscrittura destinatari.


## Postmark — ripresa 2026-09-15

- Account approvato; pagamento ancora da completare. Integrazione recuperata dallo
  stash `e96c3ee21bdde047fbffb25fb145fcf65a877b61`, conservato. Sostituisce lo standby
  precedente. Note preparatorie sotto; per lo stato attuale vedere Rilascio Postmark sopra.
- Configurazione locale riservata in `.env.postmark.local` (0600, esclusa da Git).
  Caricare l'override per test; normale `.env.local` e Vercel restano invariati.
  Nuova modalità `postmark|log`, `POSTMARK_SERVER_TOKEN`, `EMAIL_REPLY_TO`;
  stream separati outbound/broadcast. Nessun fallback Gmail o Nodemailer.
- Due prove reali a registrationspeace@santegidio.org consegnate con SMTP Google
  250 OK, QR sintetico e allegato. From/Reply-To, CID e tracking verificati.
  Nessuna iscrizione/account modificato; callback login reale non collaudata.
- Quota Gmail 300/giorno rimossa nella migration locale; claim 25 atomico,
  inoltro `/email/batch` e blocchi consecutivi senza pausa per budget 180 secondi.
  Avvio in background con Next after; cron al minuto riprende scheduled residui.
  Nessun tetto 25/minuto. Esiti per destinatario, payload limitati per byte,
  nessun retry incerto; errori DB dopo accettazione lasciano sending da verificare. Migration NON applicata in produzione: coordinare col rilascio e
  verificare piano Vercel/CRON_SECRET. Non eseguire la nuova coda su Gmail.
- Backup locale precedente e copie duplicate nello stash
  `backup-pre-postmark-2026-09-15-local-changes-and-duplicates`; codice già pubblicato
  riallineato a origin/main. Conservata la rimozione locale del dettaglio errore
  in registration-page-content.tsx (estranea a Postmark).
- Lockfile recuperato dalla versione corrente rimuovendo solo Nodemailer e tipi.
  Dettagli e passi di rilascio in `docs/postmark.md`. Nessuna pubblicazione eseguita.
- Verifiche finali dopo ottimizzazione batch: 310 test, lint, typecheck e build superati; SQL PGlite con 1.205
  destinatari. Allineato il test del messaggio gruppo al testo generico già scelto
  localmente, conservando il controllo di assenza del fallback.
- `npm run dev:postmark` carica l'override locale; `npm run email:verify:postmark`
  controlla provider senza invio. Piano Postmark Basic 50.000 rilevato; 4 prove
  consumate, incluse due batch con Delivered/SMTP 250. Ultimo controllo fattura
  insoluta precedente all’ottimizzazione; nessuna modifica al pagamento.


## Segnalazioni di appartenenza al gruppo — 2026-09-15

- Il capogruppo usa il collegamento discreto `Segnala un problema di gruppo`,
  con conferma e testi nelle sette lingue. `updateGroupLeaderAssignment` chiama
  `report_group_assignment`: registra solo l'audit `group_leader.assignment_reported`,
  senza modificare alcun campo dell'assegnazione, note incluse. Invii ripetuti
  dello stesso referente sulla stessa assegnazione sono idempotenti.
- `GroupAssignmentReports` mostra le segnalazioni nelle dashboard Manager/Admin
  dell'evento, con collegamento alla scheda. Controlla i ruoli prima delle
  letture; paginazione completa, blocchi da 100 ID, esclusione delle assegnazioni
  non correnti e delle iscrizioni eliminate. Un errore mostra un avviso.
  Le segnalazioni sono interne alla dashboard, senza invii email.
- Migration `20260915160000_group_assignment_reports.sql`: la vecchia RPC
  `reject_group_assignment` delega alla sola segnalazione, anche per vecchi client.
  La policy UPDATE delle assegnazioni ammette solo Manager/Admin; le note del
  capogruppo continuano tramite l'azione server con scope. RPC solo service_role,
  con nuova verifica di membership, gruppo attivo, evento corrente e iscrizione.
- Verifiche: `tests/sql/group-assignment-reports.sql` su PostgreSQL temporaneo
  (PGlite), test del pannello in `tests/group-assignment-reports.test.mts`.
  Migration applicata e registrata in produzione il 2026-09-15. Conteggio
  e hash delle 396 assegnazioni invariati prima/dopo. Prova reale interamente
  annullata: RPC nuova e storica, idempotenza, assegnazione invariata e blocco
  UPDATE del capogruppo con ruolo SQL authenticated verificati. Nessuna
  segnalazione di prova persistente. Rilascio: 307 test, lint mirato, typecheck
  e build production superati nella copia isolata con npm ci dal lockfile.


## Rilascio correzioni iscrizione e referenti — 2026-09-15

- Pacchetto integrato su `8062b90`: avvio iscrizione personale, conservazione
  del gruppo dopo errori, controllo link prima delle scritture, referenti
  principali/secondari nelle tabelle e rimozione della frase guida sulle
  disabilità in tutte le lingue, anche nella modifica personale.
- Verifica finale in checkout isolato con dipendenze dal lockfile: 304 test,
  lint e build production superati. Nessuna migration o modifica dati richiesta.
- Pubblicazione autorizzata su `main` tramite integrazione Git Vercel; il lavoro
  parallelo sulle segnalazioni di assegnazione resta separato da questo rilascio.
  Le note sotto che descrivono patch non pubblicate si riferiscono ai controlli
  locali precedenti a questo pacchetto. Nessun collaudo autenticato reale.

## Referenti multipli nella gestione gruppi — 2026-09-15

- Le tabelle gruppi admin/manager mostrano gli incarichi capogruppo del gruppo
  e dell'evento correnti: tutti i principali e, sotto, tutti i secondari in
  carattere più piccolo. Componente condiviso `GroupLeadersSummary`, colonna
  Referenti, nomi a capo senza troncamento e ricerca estesa a tutti i referenti.
- `groupLeaderSummaries` usa gli utenti operativi già caricati, deduplica per
  account e conserva gli omonimi. Il campo storico `primary_leader_name` resta
  soltanto come fallback quando non risultano membership; nessuna modifica
  a dati, assegnazioni, ruoli o autorizzazioni.
- Cinque test mirati su scope, principali multipli, secondari, omonimi,
  fallback e markup; lint e typecheck in copia pulita superati.
  Nessuna verifica visuale nel browser reale né deployment per questa patch.

## Link di gruppo conservati dopo errori — 2026-09-15

- `submitPublicRegistration` conserva il token originale del modulo nei ritorni
  per validazione, rate limit ed errore di salvataggio. `buildRegistrationRetryPath`
  torna al percorso personalizzato con email/errore codificati; token malformati
  o riservati restano nel parametro `groupLink` della route registrazione.
- `RegistrationPageContent` non ripiega più sul modulo generico se fallisce il
  caricamento del link: mostra un errore senza form. La route storica con query
  non reindirizza token riservati verso percorsi applicativi.
- `createPublicRegistration` verifica il link prima di creare partecipante,
  contatti o iscrizione; un link già scaduto/revocato non lascia per questo
  motivo un'iscrizione senza assegnazione. Le scritture successive conservano
  il workflow esistente, senza introdurre una transazione complessiva.
- Test in `tests/group-registration-retry.test.mts`: errori e reinvio corretto,
  URL sicuri, gruppo passato al form, nessun fallback generico e rifiuto prima
  delle scritture. Suite completa: 289 test superati; lint mirato e typecheck
  superati, quest'ultimo in copia pulita con `npm ci` dal lockfile.
- Nessuna modifica ai dati storici, invio email o deployment. Non è stato
  eseguito un collaudo autenticato reale; i test usano dati sintetici.

## Avvio iscrizione personale da account operativo — 2026-09-15

- Il pulsante della dashboard partecipante senza iscrizione apre direttamente
  `/registrazione?email=...`, con email autenticata codificata; anche la card
  personale usa `/registrazione`. Non usare la home: il proxy rimanda gli
  utenti autenticati alla dashboard, producendo un ritorno alla stessa pagina.
- Messaggio di iscrizione assente aggiornato nelle sette lingue. Salvataggio,
  collegamento account, ruoli e controlli del modulo restano quelli esistenti.
- Regressioni URL in `tests/personal-registration-navigation.test.mts`:
  email semplice/speciale/assente e card con/senza iscrizione. Dieci test
  mirati e lint superati. Il typecheck del workspace era bloccato da directory
  duplicate preesistenti in `node_modules/@types` (`node 2`, `react 2`, ecc.);
  verificato poi con successo in copia pulita con `npm ci`, insieme alla
  correzione dei link di gruppo descritta sopra.
  Nessun collaudo autenticato reale o deployment effettuato per questa patch.

## Errori iscrizione da link di gruppo — 2026-09-15

- `submitPublicRegistration` conserva il token del gruppo nei ritorni per
  validazione, rate limit ed errore di salvataggio, usando il percorso breve
  del gruppo con email ed errore codificati. Legge il token dal form anche
  quando la validazione non produce un input valido.
- Se il link non è disponibile, `RegistrationPageContent` mostra l'errore
  senza ripiegare sulle opzioni e sul modulo generali. I controlli server
  sul link e sull'assegnazione restano invariati.
- Regressioni in `tests/registration-error-routing.test.mts`: tre percorsi
  di errore, iscrizione generale, token manipolato e link non disponibile.

## Avvio iscrizione personale degli utenti operativi — 2026-09-15

- Il pulsante `Avvia la mia iscrizione` nella dashboard senza iscrizione
  collegata apre direttamente `/registrazione`, con email della sessione
  codificata nella query. Non puntare alla home: il proxy rimanda gli utenti
  autenticati alla dashboard, impedendo di raggiungere il modulo.
- Riusa il flusso pubblico esistente, anche per i capigruppo creati prima
  della propria iscrizione. Nessuna modifica a ruoli, database o invii email.

## Statistiche e geografia complete — 2026-09-14

- `lib/registrations/event-statistics.server.ts` carica le statistiche comuni
  admin/manager, dopo i controlli di ruolo/evento dei chiamanti. Paginazione
  stabile di tutte le fonti, blocchi da 100 UUID anche per assegnazioni e
  presenze. Errori e gerarchie incomplete interrompono il riepilogo; i boundary
  admin/manager offrono Riprova senza conteggi falsi o parziali.
- `geography.ts` condivide il fallback testo personale → catalogo collegato
  fra statistiche, elenchi ed export. La gerarchia del gruppo conserva la
  precedenza territoriale nelle statistiche. Non trattare il solo campo
  `city_other` vuoto come assenza di città: gli inserimenti capogruppo usano ID.
- Paese pubblico validato nel browser e sul server: opzioni esistenti e paesi
  extraeuropei nelle sette lingue; città/province come Roma/RM rifiutate.
- Correzione dati autorizzata: due schede RM/Roma portate a Italia e collegate
  al catalogo IT, con transazione protetta e audit prima/dopo, batch
  `statistics-countries-2026-09-14`. Nessuna riassegnazione delle 12 persone
  realmente senza gruppo e nessuna modifica a presenze, account o consensi.
- Diagnosi, collaudo (267 test, lint, typecheck, build, browser sintetico e
  letture reali) e limiti in `docs/incident-2026-09-14-statistics.md`.

## Richieste dashboard e limite URL — 2026-09-14

- La patch `loadRowsForIds` usa blocchi di
  100 UUID. I precedenti 300 producono URL di circa 12 KiB respinti dal proxy
  Kong con HTTP 414; errore riprodotto sul server reale e osservato nei log
  del 14 settembre, 10:28–10:39 Europe/Rome. Digest della schermata
  `2526072483` correlato esattamente su Vercel alle 10:29:44.
  Conservare paginazione e rifiuto
  dei risultati parziali. Nessuna modifica a database o configurazione server.
- Regressioni in `tests/supabase-id-batches.test.mts`; riscontri e limiti
  dell'indagine, incluso episodio di sabato non correlato, in
  `docs/incident-2026-09-14-manager.md`.


Questo file e' la memoria operativa stabile per Codex e per futuri agenti che lavoreranno su questa app. Deve restare aggiornato quando cambiano architettura, workflow, comandi, schema dati, ruoli, policy RLS o decisioni importanti.

Quando lo sviluppo principale sarà concluso, `PIANO_DI_LAVORO.md` potrà essere cancellato. A quel punto questo file dovra' contenere tutto il contesto necessario per implementare funzioni accessorie, correggere bug e fare manutenzione senza dover ricostruire la storia del progetto.

## Flusso QR consolidato — da preservare, 2026-09-30

Questa sezione è il riferimento funzionale corrente e prevale sulle descrizioni
storiche dello scanner riportate sotto. L’utente ha confermato che il flusso
sembra funzionare, con alcune rifiniture ancora da individuare. Preservare queste
scelte durante bugfix, refactoring, merge da main e sviluppo delle prossime
milestone; non sostituirle con versioni precedenti né riprogettare il flusso senza
una nuova richiesta esplicita dell’utente. Aggiornare questa sezione se l’utente
approva successive variazioni, mantenendo chiaro ciò che viene superato.

- Uso principale da telefono. Fotocamera predefinita con avvio esplicito e
  posteriore preferita; alternativa tramite codice partecipante di quattro
  caratteri. Anteprima verticale 3:4, immagine intera e guida soltanto visiva.
- Incarico ingresso evento stabilito prima della scansione e conservato tra
  letture. Singolo assente: ingresso automatico. Famiglie: confermare i componenti
  realmente presenti; scuole: confermare le quantità effettive. Mai presumere
  presenti tutti i componenti o tutti i prenotati.
- QR già presente: nessuna nuova scrittura automatica. Famiglie parzialmente
  presenti: possibilità di registrare nuovi arrivi senza alterare gli ingressi
  precedenti. Stesso QR riabilitato solo dopo almeno un secondo continuativo
  senza QR; fotogrammi illeggibili isolati e riavvio camera non bastano.
- Attesa sul video senza dialog durante la richiesta; stream mantenuto attivo,
  nuove operazioni bloccate. Esito sul video per 7 secondi, con azzurro per attesa,
  verde per successo/già presente, rosso per errore e ambra per conflitto.
  Riepilogo persistente sotto il video, senza duplicare il messaggio altrove.
- Dialog persistente per selezione, modifica, esito incerto e sessione bloccata.
  Nessuna scadenza automatica delle decisioni. Esiti incerti: stesso comando e
  UUID per retry, nessuna scansione successiva; nessun successo anticipato.
- Unica scheda **Modifica presenze**, dal riepilogo con ingresso presente o dalle
  **Ultime 15 letture**. Non ripristinare il percorso separato Correzioni e
  annullamenti, il selettore di operazione o l’obbligo di nuova scansione/codice.
- Cronologia delle ultime 15 iscrizioni valide distinta per iscrizione, solo
  nella memoria della pagina sul dispositivo: nessuna lista condivisa o
  persistenza dopo reload. Apertura modifica: rilettura server automatica, senza
  ingresso automatico. Non usare i dati storici della lista come stato corrente.
- Modifica famiglia: presenti preselezionati, deselezione annulla i relativi
  ingressi; tutti deselezionati annulla tutti gli ingressi correnti. Scuole:
  quantità precompilate e annullamento totale esplicito. Conferma obbligatoria;
  salvataggio o chiusura riportano agli ingressi conservando la modalità di lettura.
- Preservare controlli server/DB, revisioni concorrenti, idempotenza, revoche,
  scope evento e storia delle presenze dei minori. Gli incarichi panel/sala
  futuri restano separati: una scansione panel non registra l’ingresso evento.

Il riscontro positivo dell’utente non certifica il completamento di P11/P12/P13
né un collaudo hardware formalizzato. Restano da registrare le rifiniture emerse
e verificare il flusso autenticato su dispositivi reali, inclusa la seconda
postazione che osserva presenze e statistiche. Base implementata: commit
`387825a` sul branch `codex/panel-p0-p10`; dettagli e test nella sezione seguente.

## Modifica presenze e ultime letture — 2026-09-30

- Sostituito il percorso separato Correzioni e annullamenti con una scheda
  unica Modifica presenze, disponibile dal riepilogo di un ingresso presente
  (anche appena registrato) e dalle ultime 15 iscrizioni valide lette.
  Le famiglie parzialmente presenti conservano sia l’ingresso dei nuovi arrivati
  sia l’accesso alla modifica dalla selezione.
- Cronologia solo in memoria nella pagina/dispositivo: nominativo o scuola,
  ora della lettura, nessuna persistenza browser. Deduplica famiglie per codice
  pubblico anche tra QR e manuale; scuole per token QR attivo. Riletture spostano
  la voce in cima; modifiche aggiornano la voce senza cambiare l’ora di lettura.
  La revoca della sessione svuota la lista; un riferimento non più valido viene rimosso.
- Apertura modifica = nuova inspect server usando il riferimento conservato,
  mai ingresso automatico. Famiglie precompilate: deselezionare annulla i relativi
  ingressi; selezione vuota usa cancel dei soli presenti riletti. Scuole: quantità
  precompilate e opzione esplicita per annullare tutto. Conferma obbligatoria;
  salvataggio/chiusura riportano al normale ingresso senza cambiare fotocamera.
- Revisioni, UUID di retry, interblocchi e autorizzazioni esistenti invariati;
  nessuna migration. La precedente modalità di sola verifica tramite Correzioni
  non esiste più: scansione normale di singoli assenti registra subito l’ingresso.
- Test sessione e browser coprono cronologia, rilettura aggiornata, annullamento
  totale, scuole, ritorno al flusso normale, retry e cancellazione della lista.
  Verificati 358 test, lint, typecheck, build staging e browser sintetico
  desktop/mobile (inclusi overlay, timer 7 secondi e stream continuo).

## Presenze scuole nelle schede operative — 2026-09-30

- Entrambi gli accessi Scuole (Partecipanti e Panel) mostrano ingresso evento,
  ora e quantità effettive studenti/accompagnatori in tabella e nella scheda.
  Il provider condiviso aggiorna solo le presenze ogni 10 secondi, senza
  perdere modifiche nei form; errori e revoche non diventano assenze.
- `/dashboard/attendance` aggiunge `schoolEntries` per prenotazione operativa;
  `summary=1` restituisce la mappa vuota. Stessi controlli ruolo/evento e RLS,
  nessuna migration. Quantità prenotate e ingressi panel restano distinti.

## Colori dei messaggi scanner — 2026-09-30

- Overlay camera: azzurro per attesa, verde per operazione riuscita/presenza già
  registrata, rosso per codice o richiesta non validi, ambra per conflitto da
  verificare. Testo sempre esplicito, contrasto elevato e sfondo opaco.
- Colore derivato dallo stato e dal codice di errore, mai dal testo tradotto.
  Durata di 7 secondi, riepilogo persistente, stream e interblocchi invariati.

## Messaggio scanner temporaneo e riepilogo persistente — 2026-09-30

- In modalità fotocamera, al termine dell’operazione il messaggio di stato
  (ingresso registrato, già presente, codice non valido o conflitto) sostituisce
  l’attesa nel riquadro video. Scompare dopo 7 secondi; ogni nuova risposta
  avvia il proprio timer e annulla quello precedente.
- Il riepilogo nominativo/scuola rimane direttamente sotto il video e non
  scade. Il messaggio non è duplicato sotto il video o nella testata.
  Il timer non cambia sessione, stream, latch, presenza o dati salvati.
- Selezioni da confermare, esiti incerti con retry e sessione bloccata restano
  nel dialog persistente. In modalità manuale restano i messaggi inline.
- Test browser `tests/browser/reception-feedback.mjs`: posizione attesa/stato,
  scadenza a 7 secondi di conferma ed errore, riepilogo persistente, rilettura,
  selezione successiva e stream continuo.

## Attesa sul video ed esito persistente — 2026-09-30

- Revisione successiva: durante `pending` nessun dialog modale. In modalità
  camera il messaggio “Operazione in corso. Attendi l’esito prima della prossima
  persona…” è sovrapposto soltanto al video; lo stream rimane attivo e
  l’interblocco continua a impedire altri ingressi. Manuale: attesa inline.
- Conferma e riepilogo compaiono subito sotto il riquadro video e restano
  visibili fino alla successiva operazione o al cambio di modalità. Il timer
  di 2,5 secondi è stato rimosso su richiesta successiva dell’utente.
  Restano rimossi l’esito duplicato nella testata/sul video e le istruzioni
  per rileggere lo stesso QR. Nessun cambiamento a sessione, latch o dati.
- Selezione famiglia/scuola, correzioni, esiti incerti e blocco di sessione
  mantengono il dialog e non scadono. Gli errori restano persistenti.
- Verifica dedicata: `tests/browser/reception-feedback.mjs` (video continuo,
  posizione, persistenza oltre 2,5 secondi, rilettura e selezione successiva).

## Conferma QR in overlay — 2026-09-30

- La console accoglienza apre un dialog modale sopra la fotocamera per la
  verifica in corso, la selezione famiglia/scuola, correzioni, esiti incerti
  e sessione bloccata. Dopo la verifica mostra “QR letto correttamente”
  (manuale: “Codice verificato”) e l’azione necessaria, senza anticipare
  il successo della scrittura. I singoli conservano l’ingresso automatico.
- Dialog nativo con focus iniziale, sfondo non interattivo, scroll interno
  entro 90dvh e azioni di conferma in fondo. Escape equivale a chiudere senza
  modifiche soltanto durante la selezione; durante richieste/esiti incerti
  resta bloccato. Retry e interblocchi della sessione restano invariati.
- Al successo il dialog si chiude e il riquadro camera mostra l’esito e
  l’invito al QR successivo. Eliminato “Scansione sospesa · completa
  l’operazione”. Nessuna modifica a salvataggi, permessi o database.
- Verifica browser estesa in `tests/browser/reception.mjs` per focus, overlay
  mobile e impossibilità di chiudere l’esito incerto con Escape.

## Scuole nel menu Partecipanti — 2026-09-30

- Nel branch panel, admin e manager (inclusi viewer in sola lettura) hanno
  la scheda Scuole accanto a Senza gruppo: `section=iscritti&view=schools`.
  Riusa catalogo, filtri, scheda e azioni delle prenotazioni scuola già
  disponibili in Panel; apertura/chiusura, filtri e ritorno dalle azioni
  conservano il menu di provenienza. I due accessi condividono gli stessi dati.
- Permessi e scope evento invariati; nessuna migration o modifica RLS.

## Pubblicazione codice report P13 — 2026-10-02

- L’utente ha richiesto commit/push del lavoro P13 su `codex/panel-p0-p10`
  e aggiornamento di questa memoria. Inclusi report, migration versionata,
  test, piano e nota del flusso QR consolidato; conservati i requisiti scanner.
- La richiesta riguarda il codice: `20260930180000_reception_operational_report.sql`
  resta da applicare al database staging con richiesta esplicita. Il push
  attiva la preview applicativa; fino all’applicazione SQL il nuovo report
  mostra indisponibilità. I totali presenze preesistenti restano indipendenti.
- Nessun merge main, modifica production, invio email o incarico panel/sala
  implementato. La proposta degli incarichi resta da confermare e P13 resta
  aperta per quella tranche e per il collaudo autenticato/hardware.
- Fetch del 2 ottobre: panel/upstream allineati a `387825a`; `origin/main`
  a `01e0a82`, senza integrazione in questa pubblicazione del codice.

## P13 — report operativo accoglienza — 2026-09-30

- Seconda tranche locale sul branch panel: Statistiche mostra previsti/ingressi,
  filtro giorno e mattina/pomeriggio Europe/Rome, ingressi validi per ora e
  contatori audit per richieste duplicate, retry, correzioni e annullamenti.
  Non dedurre permanenza/no-show; le semplici riletture `inspect` e il punto
  fisico di accoglienza non sono misurabili con lo storico attuale.
- Nuova RPC aggregata `reception_operational_report`, SECURITY DEFINER con
  `search_path` vuoto e controllo reale `auth.uid()`/ruolo/evento, invocabile
  da authenticated: solo admin globale e manager/viewer dell’evento. Nessuna
  esposizione di audit grezzo o dati nominali, nessun ampliamento delle RLS.
- Endpoint `/dashboard/attendance/report`, client autenticato senza service
  role, risposta private/no-store e validazione stretta. Polling 10 secondi,
  timeout 15, stop a pagina nascosta/revoca e dati rimossi su errore o cambio
  filtro; nessun refresh dei form. Scanner P11/P12 invariato.
- Migration `20260930180000_reception_operational_report.sql` solo locale,
  da applicare allo staging prima della pubblicazione, su richiesta esplicita.
  Commit/push richiesti successivamente il 2 ottobre; database remoto invariato.
  Piano e proposta
  incarichi da revisionare in `docs/panel-p13-operational-report.md`; gli
  accessi panel/sala e il collaudo hardware restano aperti.
- Verificati 361 test, lint, typecheck, build staging, PostgreSQL 17 temporaneo
  (inclusi revoca, fascia oraria e deduplica scuole fra panel) e browser
  sintetico desktop/mobile; nessun errore runtime.
- Fetch iniziale: panel/upstream a `387825a`, main a `dff2159`; nessun
  fast-forward necessario. Modifica preesistente al flusso QR consolidato
  conservata. Merge main ancora destinato all’integrazione dedicata.

## P13 — visualizzazione ingressi evento — 2026-09-30

- Prima tranche implementata localmente sul branch panel: Gestione iscritti e
  scheda admin/manager/viewer mostrano ingresso e ora per adulto e ciascun
  minore. Le statistiche aggiungono totali evento distinti per adulti, minori,
  studenti, accompagnatori e classi/gruppi scuola. Giorni previsti e accessi
  panel restano separati; nessuna deduzione di uscita o no-show.
- Endpoint `/dashboard/attendance`: sessione autenticata, ruolo reale per utente
  ed evento, client con RLS (mai service role), paginazione da 500 e proiezione
  minima. Solo check-in evento attivi di iscrizioni/scuole operative;
  `summary=1` omette le chiavi nominali. Risposte private/no-store.
- Aggiornamento del solo contesto presenze ogni 10 secondi, sospeso a scheda
  nascosta; timeout 15 secondi, richieste non sovrapposte. Nessun refresh dei
  form. Errore = indisponibilità, non assenza; 401/403 cancella i dati e ferma
  il polling fino a Riprova. Nessuna persistenza client delle presenze.
- Nessuna migration/RLS modificata. Accessi panel/incarichi sala e collaudo
  hardware restano separati. Contratto, limiti e verifiche in
  `docs/panel-p13-event-attendance.md`. Commit/push e verifica della preview
  staging autorizzati dall’utente nella richiesta successiva del 30 settembre.

## Pubblicazione staging panel — 2026-09-30

- La richiesta di pubblicare sullo staging comprende commit e push sul branch
  `codex/panel-p0-p10`, quindi verifica della preview Vercel generata dal push.
  Non implica pubblicazione su main/production né nuove migration.

## Sezioni accoglienza e codice manuale — 2026-09-30

- Revisione successiva al rilascio `1ac8393`, pubblicazione staging autorizzata:
  incarico fuori dalla
  card operativa, sotto il menu dashboard, senza sticky durante lo scroll.
- Revisione successiva richiesta: eliminate le schede superiori Ingressi /
  Correzioni e annullamenti. Ripristinato il pulsante in fondo alla card, separato
  da un bordo; in correzione diventa Torna agli ingressi. Conservati i blocchi
  durante selezioni/richieste/esiti incerti.
- Manuale: solo codice partecipante di quattro caratteri; rimossi Tipo di codice
  e inserimento del token QR. Correzioni conserva la scansione camera anche per
  scuole, come sola verifica; scritture ancora esplicite e confermate.

## Anteprima scanner verticale — 2026-09-30

- Modalità rinominate “Inquadra QR code” e “Inserisci il codice manualmente”,
  con pulsanti a capo su schermi stretti. Eliminato il selettore anteriore:
  avvio/stop soltanto, richiesta camera `environment` a ogni avvio.
- Correzioni e annullamenti sono in fondo alla console. Rimosso il pulsante di
  rilettura: una sequenza di fotogrammi senza QR per almeno un secondo riabilita
  lo stesso codice; singoli frame illeggibili e interruzioni camera non bastano.
  Questo requisito sostituisce il blocco persistente fino a conferma descritto
  nella P12 originaria. Durante selezione, richieste ed esiti incerti non si riabilita.
- La famiglia parzialmente presente torna alla selezione con la nuova scansione;
  membri già presenti indicati e disabilitati. Singoli e famiglie interamente
  presenti terminano dopo inspect senza enter, conservando ora e stato.
- Dashboard Accoglienza: rimosso il vecchio riquadro Area protetta con
  descrizione e il titolo evento duplicato; resta il titolo nella testata globale.
- `ReceptionCamera` usa un riquadro verticale 3:4, centrato e largo al massimo
  24rem, con guida quadrata centrale larga due terzi del riquadro.
- Il video conserva l’intera immagine (`object-contain`); la guida è soltanto
  visiva e non intercetta tocchi. Decoder invariato: analizza tutto il fotogramma,
  anche fuori dal quadrato. Rilascio staging autorizzato il 30 settembre; 347 test, lint e build staging superati.

## Campioni accoglienza staging — 2026-09-30

- Preparati su richiesta account `accoglienza.staging@example.invalid` e
  `accoglienza2.staging@example.invalid`, solo Accoglienza evento corrente;
  `admin.accoglienza.staging@example.invalid`, Admin globale solo nello staging.
- Lotto fittizio A/B/F/S/X: due singoli, famiglia con due minori, scuola 10+2,
  QR revocato. Verifica RPC senza ingressi; zero check-in iniziali.
- Procedura e codici in `docs/collaudi/2026-09-30-preparazione-accoglienza.md`.
  Script `prepare-reception-staging.mjs` conserva le presenze; script
  `reception-staging-access.mjs` genera link monouso senza SMTP. Connessione
  vincolata al container staging noto e modalità log.
- Token, link e QR locali in `.env.collaudo-accoglienza/`, esclusa da Git;
  non pubblicarli nel repository. Preservare il manifest per riusare il lotto.
  Nessuna prova hardware certificata, migration, deployment o modifica production.

## Guida riutilizzabile al collaudo su telefono — 2026-09-24

- Procedura pratica in `docs/guida-collaudo-telefono-qr.md`: preparazione
  accesso/campioni staging, prove T01–T18 con azioni ed esiti attesi, scheda
  verbale e casi futuri ST01–ST08 per stampa P14/P15. Conservare i verbali in
  `docs/collaudi/AAAA-MM-GG-descrizione.md` dalla prima sessione effettiva.
- La guida non attesta prove hardware eseguite. La scansione del singolo
  scrive subito; per verificare senza scrivere usare il percorso Correzioni
  e chiudere senza modifiche. Preparare dati fittizi e registrare stati iniziali
  e finali; preservare la storia dei check-in, inclusa quella dei minori.

## P12 — scanner e ingresso evento — 2026-09-22

- Implementata localmente sul branch panel. Su richiesta dell’utente, revisione
  funzionale P11 rinviata al collaudo del flusso completo su telefono; non è una
  certificazione di chiusura P11/P12. Il 2026-09-22 l’utente ha poi richiesto
  la preparazione della preview, autorizzando migration staging e pubblicazione panel.
- `ReceptionConsole` usa `ReceptionStationSession`: incarico `event_entry`
  impostato prima del QR e titolo persistente durante lo scroll; fotocamera
  predefinita, avvio esplicito, posteriore preferita, cambio camera e codice
  manuale. Il singolo entra automaticamente, famiglie/scuole richiedono solo
  selezione dei presenti/quantità. Correzioni e annullamenti hanno percorso
  manuale separato, nuova verifica e conferma esplicita.
- `jsqr@1.4.0` caricato dinamicamente per decodifica locale, nessun fotogramma
  trasmesso/salvato. Stream chiuso su uscita, cambio modalità/camera, background
  ed errore; permesso tardivo rilasciato. Nessun audio. Un QR già letto resta
  bloccato anche attraverso frame illeggibili e riavvii della camera, fino a
  un codice diverso o nuova lettura esplicita confermata.
- Interblocco sincrono tra verifica e ingresso; timeout 20 secondi/esito incerto
  sospendono la scansione e conservano lo stesso comando/UUID per retry. Nessun
  successo prima della risposta e nessun aggiornamento da risposte tardive.
  La richiesta resta solo in memoria: non promettere recupero dopo chiusura
  della scheda. Sessione scaduta/revoca fermano il flusso; conflitto richiede
  nuova lettura. Uscire durante la verifica non avvia l’ingresso automatico.
- Migration `20260922220000_reception_event_duty.sql`, applicata e registrata
  **solo allo staging il 2026-09-22**: RPC `reception_event_check_in`, SECURITY INVOKER, solo
  service_role, duty esclusivamente evento. Delega alle protezioni atomiche
  P11, che rileggono ruoli e evento a ogni operazione, inclusi retry. Nessuna
  riscrittura delle migration precedenti, ruoli, presenze o policy esistenti.
- Il ruolo attuale `accoglienza` resta esplicitamente un incarico EVENTO.
  P13 deve assegnare panel/sala separatamente senza concedere questo ruolo;
  nessun selettore panel inattivo nella P12. La pagina filtra gli incarichi per
  evento corrente e lega l’action all’evento visualizzato: un cambio di evento
  richiede nuova apertura. Rimane la regola dashboard manager solo manager;
  per collaudo della console usare admin globale o accoglienza.
- Fetch: panel/upstream a `e13d95a`; `origin/main` a `9bdd098`, 25 commit/11
  migration non incorporati. Cancellazione PPTX e `output/` preesistenti lasciati
  intatti. Nessun pull necessario per l’allineamento; merge di main rinviato a
  integrazione dedicata prima del rilascio, preservando la tutela P11 dei minori.
- Verifiche: 345 test, lint/typecheck e build staging; PostgreSQL 17 temporaneo
  con RLS, revoche, scope duty e concorrenza; browser desktop/mobile sintetico,
  decoder QR reale su PNG. Procedura in `docs/panel-p12-reception.md`. Fixture
  browser temporanea rimossa prima della build; nessun accesso di test pubblico
  distribuito. SQL staging verificato: corpo funzione identico, privilegi solo
  service_role, RPC PostgREST risolta e richieste non autorizzate rifiutate;
  prova famiglia/scuola/retry/correzione/audit interamente annullata. Conteggi e
  hash invariati su 42 tabelle. Script `tests/sql/reception-p12-staging-rollback-check.sql`.
  Restano collaudo autenticato e almeno due dispositivi reali con QR a schermo/stampati.

## Revisione accoglienza: azione prima della scansione — 2026-09-12

- Requisito dell'utente: uso principale dal cellulare, QR tramite fotocamera
  predefinito e codice manuale come alternativa. Azione e incarico definiti
  prima della scansione e conservati tra persone, errori e fallback. Nessuna
  scelta dell'operazione dopo ogni QR. Scanner previsto in P12, non ancora
  disponibile nella console manuale P11 della preview.
- Separare ingresso evento e ingresso panel: l'operatore panel non registra
  l'arrivo all'evento, neppure implicitamente. In assenza di accoglienza evento
  indirizzare alla relativa postazione. Il codice identifica il soggetto;
  l'incarico autorizzato determina l'operazione, verificata anche da server/DB.
- Proposta da dettagliare in P12/P13: incarichi per accoglienza evento, panel
  assegnati e assistenza in sala (maschere), gestiti da admin/manager. Le
  maschere consultano indicazioni sala/settore senza scritture sulle presenze;
  nessuna nuova gestione di sedute numerate. Questi incarichi non sono ancora
  ruoli o permessi implementati: la P11 conserva il modello autorizzativo esistente.
- Singoli: scansione esegue l'ingresso. QR condivisi: si confermano soltanto
  componenti realmente presenti o quantità scuola, senza cambiare l'azione.
  Correzioni/annullamenti restano espliciti e separati dalla scansione continua;
  esito incerto sospende lo scanner e conserva la stessa richiesta per il retry.
- Aggiornate sezioni 3.4 e P11-P13 di `PIANO_DI_LAVORO_PANEL.md`. La revisione
  non equivale alla chiusura P11 né al rilascio dello scanner. Nessuna modifica
  a schema, ruoli, dati o deployment per questo aggiornamento dei requisiti.

## P11 — verifica QR e presenze effettive, 2026-09-12

- Implementata localmente sul branch panel, con console manuale nella dashboard
  accoglienza: codice partecipante esatto oppure contenuto opaco del QR,
  selezione dei componenti presenti e quantità esplicite studenti/accompagnatori.
  Fotocamera P12 e collegamento delle statistiche effettive P13 restano separati.
- Migration `20260912150000_reception_check_ins.sql` applicata e registrata
  **solo allo staging il 2026-09-12**, su richiesta esplicita. Estende `check_ins` con minore/FK composta,
  prenotazione scuola, conteggi, annullamento e ultima modifica; unicità per
  persona/evento e scuola/evento. Le righe legacy indicano solo l'adulto.
  Nessuna modifica alle intenzioni giornaliere o alle prenotazioni panel.
- `reception_check_in` è una RPC atomica SECURITY INVOKER, EXECUTE solo
  service_role: attore autenticato dal server, evento corrente e ruoli reali
  ricontrollati nel DB (admin globale, manager o accoglienza dell'evento).
  Token hash SHA-256, ultimo token attivo/non revocato/non scaduto, iscrizione
  operativa; stato invalido uniforme senza dati personali. Codice pubblico come
  fallback autorizzato, senza obbligo di QR. Risposte proiettate esplicitamente:
  solo nomi/codice/presenza o scuola/classe/quantità, nessun recapito/questionario.
- Scritture dirette authenticated su `check_ins` rimosse; accoglienza non legge
  più direttamente QR o check-in, usa la risposta minima. Le letture operative
  manager/viewer e gli scope personali restano distinti. Audit `reception.*`
  con attore/evento/fonte/timestamp e stati tecnici prima/dopo; niente token,
  contatti o motivazioni libere. Fallimento audit = rollback integrale.
- `check_in_revision` e `check_in_requests` proteggono correzioni concorrenti e
  retry tardivi: nessun doppio ingresso e nessuna vecchia richiesta che riattivi
  una presenza annullata. Non eliminare il registro mentre l'evento è operativo.
  La console blocca doppi invii, conserva in memoria lo stesso comando su esito
  incerto e richiede nuova verifica su conflitto. Correzione/annullamento hanno
  conferma esplicita; `correct` sostituisce i presenti della famiglia, `cancel`
  riguarda soltanto i selezionati. Scuole: quantità effettive entro il prenotato.
- Un minore con check-in storico (anche annullato) non può essere eliminato o
  riassegnato. `replace_owned_registration_children` conserva gli ID se il
  nucleo è identico e rifiuta sostituzioni con storia: richiedono revisione
  operativa. Le famiglie senza storia minori conservano il flusso precedente.
- Verifiche locali: 330 test, lint/typecheck, build staging; PostgreSQL 17 con
  schema canonico, RLS per tutti i ruoli, audit/rollback e concorrenza reale
  (8 ingressi, 8 retry identici, 2 correzioni concorrenti); browser desktop/mobile
  con componente reale e backend simulato. Script `tests/sql/run-reception-checks.mjs`
  e `tests/browser/reception.mjs`. Applicazione SQL staging verificata:
  cinque corpi funzione uguali al file locale, EXECUTE solo service_role,
  PostgREST raggiungibile, conteggi/hash dei dati preesistenti invariati su 41
  tabelle. Prova famiglia/scuola/retry/conflitto/audit con rollback completo in
  `tests/sql/reception-staging-rollback-check.sql`; QR e ruolo di accoglienza
  della prova esistono soltanto nella transazione annullata. Applicazione e
  registrazione nella stessa transazione del runner, rimuovendo esclusivamente
  BEGIN/COMMIT esterni da una copia temporanea della migration. Commit/push
  del branch panel autorizzati. Restano revisione funzionale autenticata sulla
  preview prima della chiusura P11; nessuna modifica production o invio email.
  Contratto, limiti e procedura: `docs/panel-p11-reception.md`.

## Sincronizzazione main nel panel — 2026-09-12

- Integrato `origin/main` a `0bc2997` sulla base panel `39deb81`; analisi dei
  10 commit, conflitti e verifiche in `docs/panel-main-integration-2026-09-12.md`.
  Restano P11-P16 sul branch panel e il rinvio del rilascio production.
- Conservate le correzioni applicative di main e le funzioni panel. Il branch
  panel mantiene il proprio lockfile Next 16.3.0/React 19.2.8; usare `npm ci`
  dopo il cambio branch. La nota storica Next 16.2.9 riguarda main: la fixture
  panel richiede ancora `bfcacheId`, come verificato dal typecheck.
- La migration `20260910120000_leader_attendance.sql`, inizialmente assente,
  è stata applicata e registrata sullo staging il 2026-09-12 su richiesta
  successiva al merge. Corpo RPC verificato contro il file locale, EXECUTE
  riservato a service_role e PostgREST verificato. Conteggi/hash invariati su
  41 tabelle pubbliche e policy RLS invariate. Test della fixture sintetica
  con rollback in `tests/sql/leader-attendance-staging-rollback-check.sql`:
  salvataggio/rilettura, scope, validazione, audit e conservazione panel/check-in.
  Queste sono intenzioni dichiarate, distinte dalle presenze effettive P11.
  Nessun push o deployment applicativo in questa applicazione SQL.
- L'assenza della migration dati `20260813170000` è preesistente e legata alla
  fixture; non applicarla automaticamente. Le migration panel risultano
  registrate. Nessun push/deploy incluso in questa sincronizzazione locale.

## Indicatori di attesa condivisi — 2026-09-12

- I collegamenti applicativi usano `components/pending-link.tsx`, wrapper di
  Next Link con `useLinkStatus`: spinner e colore sul collegamento in attesa,
  comprese le sezioni via query string come Statistiche. Stato gestito da Next,
  senza timer di completamento o intercettazioni globali di click/fetch.
- `PendingSubmitButton` mantiene i controlli esistenti contro doppi invii;
  CSS condiviso aggiunge colore e spinner ai pulsanti con `aria-busy=true`
  o `data-pending=true`. Anteprime/modelli/campagne email e importazione Excel
  espongono il proprio stato asincrono. Gli elementi sincroni restano immediati.
  Gli interruttori servizio/catalogo esterni al modulo osservano il suo
  `aria-busy` tramite `useAssociatedFormPending`, con cleanup dedicato: lo
  stato provvisorio termina anche dopo una risposta di errore.
- `WorkStatusProvider` riceve la lingua dal layout; lo stato accessibile e i
  filtri sono tradotti nelle sette lingue. I filtri non bloccanti mostrano anche
  un indicatore visibile senza impedire di scrivere. Animazione disattivata
  con `prefers-reduced-motion` mantenendo simbolo e colore.
- `PendingDownload` segue la risposta completa degli endpoint Excel per export
  admin/manager e modello di importazione; blocca tentativi simultanei, verifica
  il tipo di file e mostra un errore con possibilità di riprovare. Il download
  capogruppo conserva la gestione asincrona esistente e usa il nuovo stile.
- Collaudo sintetico con ritardi reali in `tests/browser/pending-feedback.mjs`:
  navigazione, moduli, filtri, download, errori, lingue e mobile. Nessuna modifica
  a database, autorizzazioni o invii email durante queste verifiche.

## Compatibilità Safari della tabella statistiche — 2026-09-12

- La pivot territori usa `border-separate border-spacing-0`, con bordi sulle
  celle e isolamento dei livelli; solo la prima colonna resta sticky nello
  scorrimento orizzontale. Evitare il precedente `thead` sticky annidato e
  i bordi collassati: su Safari sono stati segnalati nomi e intestazioni invisibili.
- Verifica locale del rendering del componente con dati sintetici su WebKit
  26.5 e Chromium, desktop/mobile e prima colonna dopo scroll orizzontale;
  nove test statistici superati. Il difetto iniziale non si riproduce nel WebKit
  di prova: da confermare sul Safari segnalato dopo il rilascio.
- Verifiche di rilascio: dopo `npm ci` e rigenerazione della build, superati
  lint, typecheck, tutti i 257 test e build production. Nessuna modifica
  a dati o conteggi.

## Accesso admin globale e ruoli della sessione — 2026-09-12

- `Admin globale` è il ruolo `admin` con `event_id = null`, collegato tramite
  `user_id` all'account Auth: abilita la dashboard admin e tutti gli eventi.
  Non esiste un secondo ruolo admin per singolo evento; la registrazione
  personale è facoltativa. Il selettore ruoli ora lo spiega esplicitamente.
- Sessione e proxy filtrano ruoli e membership per l'ID autenticato: RLS può
  rendere visibili gli incarichi altrui agli operatori, ma questi non devono
  diventare parte della loro identità né escludere il ruolo proprio a causa
  del limite delle righe restituite.
- Verifica reale in sola lettura sull'account segnalato: account Auth confermato,
  email del profilo corrispondente, ruolo admin globale collegato e `app.is_admin()`
  vero con ruolo SQL authenticated. Nessuna modifica dati o invio email.
- Regressioni in `tests/auth-session-scope.test.mts` per sessione/proxy, admin,
  manager e partecipante con oltre 1.000 incarichi visibili; assegnazione admin
  all'account esistente in `tests/operational-role-assignment.test.mts`.

## Caricamento campagne email — 2026-09-11

- Risolto localmente il crash di apertura «This page couldn't load»: i filtri
  UUID con blocchi da 400 superavano il limite URI del proxy («URI too long»).
  `campaign-recipients.server.ts` usa blocchi da 100 per le letture dei destinatari.
  Verificato in sola lettura sul database reale: tutti i 268 candidati caricati.
- Regressione in `tests/campaign-recipient-loading.test.mts`: 1.268 destinatari
  senza troncamento e interruzione su errore di un blocco successivo. Nessun
  invio email, modifica dati o migration durante il controllo.

## Lingua delle notifiche dal paese del gruppo — 2026-09-11

- Le notifiche automatiche di accesso usano il paese della gerarchia del
  gruppo, non `participants.preferred_locale` (che l’inserimento manuale
  inizializza in inglese). IT→it, FR→fr, DE→de, ES→es, NL→nl, UA→uk;
  tutti gli altri paesi o assenza di gruppo/paese→en. Non inferire la lingua
  dal nome del gruppo, dal paese personale o dal browser dell’operatore.
- `group-locale.ts` risale tutti gli antenati; il nodo Paese prevale sui campi
  dei discendenti. Se non esiste un nodo Paese usa il primo paese valorizzato
  risalendo il gruppo. `group-locale.server.ts` ricava il gruppo corrente
  dall’iscrizione nell’evento e carica la gerarchia con paginazione.
  Errori DB, cicli, nodi mancanti/inattivi o estranei all’evento interrompono
  l’invio; non vengono mascherati dal fallback inglese.
- Per nuovi capigruppo operativi si usa il gruppo appena assegnato e validato
  dal server; i ruoli senza gruppo usano inglese. Anche il template ruoli è
  ora tradotto nelle sette lingue. L’audit salva lingua, ISO paese, gruppo e
  `locale_source=group-country-v1` oltre agli esiti precedenti.
- Verifica in sola lettura sul DB reale: Esquilino e Anziani - Monti/Esquilino
  risolvono entrambi IT/it. Nessuna modifica a preferenze, iscrizioni, ruoli
  o RLS. Su richiesta esplicita si correggono solo i prossimi invii:
  NON reinviare quelli già spediti nella lingua precedente.
- Test: `tests/email-group-locale.test.mts` e `tests/account-access.test.mts`
  coprono ereditarietà, override del vecchio default inglese, paesi/fallback,
  paginazione oltre 1.000 gruppi, ambiguità e errori prima di SMTP.

## Email di accesso per inserimenti assistiti — 2026-09-11

- `createGroupLeaderManualRegistration` invia le istruzioni dopo tutte le
  scritture riuscite, solo con email personale e senza `useLeaderEmail`.
  La notifica non crea Auth: il primo Magic Link dalla home e la callback
  verificata collegano l’iscrizione esistente, come prima.
- `assignOperationalUserRole` rende l’avviso automatico in modalità Nuovo
  utente; per Utente esistente resta facoltativo. La checkbox vive nel selettore
  utente, visibile solo per gli esistenti. Anche `assignGroupLeader` invia dopo
  la membership in modalità nuova; selezione e modifica di esistenti restano
  separate. Permessi, identità e recapiti continuano a usare i controlli esistenti.
- `account-access.ts` separa template testo/HTML dall’invio SMTP: sette lingue
  per partecipanti e ruoli, scelte dal paese del gruppo come descritto sopra.
  Collegamento stabile alla home,
  istruzioni senza password e completamento della scheda; nessun token nella
  notifica. Gli inviti ruoli sostituiscono il precedente Magic Link generico.
  Il testo per i partecipanti nomina l’Incontro internazionale per la Pace
  «Pace disarmata e disarmante» ad Assisi: introduzione, collegamento, poi
  istruzioni sull’email, in tutte le lingue. Titolo/luogo specifici dell’evento
  corrente nel template; aggiornare per eventi futuri.
- `account-access.server.ts` registra esiti reali `_sent`, `_failed`, `_simulated`
  con prefisso `email.account_access`, iscrizione/profilo e hash email.
  `invite_requested` sostituisce l’inesatto `invite_sent` nell’audit del ruolo.
  Un errore SMTP conserva il salvataggio e mostra un avviso, tradotto per il
  capogruppo; non richiede di ripetere la creazione. Nessun retry automatico o
  garanzia di consegna in casella. Limiti di interruzione/audit documentati.
- `scripts/preview-account-access.mts` verifica solo in lettura gli iscritti
  storici: provenienza capogruppo, email personale originaria, assenza di
  delega, ambiguità, eliminazione/annullamento o notifica già registrata.
  Errori DB interrompono la lettura; paginazione oltre 1.000. Verifica del
  2026-09-11: 19 candidabili, 5 inattivi, 4 delegati, 1 da chiarire.
  Prima del rilascio, su richiesta esplicita, inviate
  due prove a `registrationspeace@santegidio.org` con i template definitivi
  italiani e prefisso `[PROVA]`: partecipante e ruolo Capogruppo. Entrambe
  accettate da SMTP (250), senza creare account/iscrizioni o assegnare ruoli.
- Recupero storico autorizzato ed eseguito il 2026-09-11: 18 notifiche accettate
  da SMTP e registrate in audit (16 en, 2 it), zero errori. Dei 19 candidati,
  escluso un utente operativo per richiesta esplicita; controllati ruoli e
  membership tramite account collegato e corrispondenza email, anche fuori
  dall’evento corrente. Batch `9aabdb88-0ae1-4f7b-b1ce-4085594a3630`.
  Selezione riletta prima di ciascun invio; solo iscrizioni precedenti al
  rilascio (`submitted_at < 2026-09-11T11:55:23.507Z`). Prenotazioni in audit
  `email.account_access_backfill_started` con PK deterministica per iscrizione
  impediscono tentativi duplicati; nessun retry automatico per esiti incerti.
  Nessun invito a utenti operativi né modifica a account/iscrizioni/ruoli.
- Nessuna migration, modifica RLS o nuova dipendenza. Test azioni/SMTP/audit e
  storico in `tests/account-access.test.mts`, ruoli in
  `tests/operational-role-assignment.test.mts`, fixture browser desktop/mobile.
  Dettagli e limiti: `docs/account-access-notifications.md`.

## Messaggi di successo temporanei — 2026-09-10

- `SuccessMessage` chiude le conferme dopo 5 secondi o tramite ×, con
  etichetta accessibile nelle sette lingue e pulsante non submit.
  Usato nelle dashboard admin/manager/capogruppo/partecipante, nella scheda
  presenze, nei salvataggi rapidi, nell’importazione e nel salvataggio modelli email.
- I messaggi server ricevono una chiave per risposta, così salvataggi consecutivi
  con lo stesso testo mostrano di nuovo la conferma. Alla chiusura si rimuovono
  dall’URL solo i parametri di successo, senza navigazione né perdita di filtri,
  scheda aperta, hash o messaggi di errore. I messaggi client si rimontano per
  ciascuna nuova conferma.
- Errori, avvisi, stato di operazioni in corso e istruzioni di accesso/verifica
  email restano visibili; anche i riepiloghi campagne con possibili invii falliti
  o programmati restano persistenti. Nessuna modifica a dati, permessi o RLS.
- Verifica browser: `tests/browser/success-message.mjs`, fixture sintetica,
  timer reale, chiusura manuale, conferme ripetute, URL conservato, sette lingue/mobile.

## Giorni di presenza nella scheda capogruppo — 2026-09-10

- La scheda mostra le presenze correnti e permette di salvarle per giorno e
  fascia mattina/pomeriggio, inclusa la vigilia pomeriggio, oppure come da
  confermare. `LeaderParticipantAttendance` riusa `ManualAttendanceFields`,
  ora inizializzabile e localizzato nelle sette lingue, con scorrimento interno
  della griglia su mobile. Nessun salvataggio automatico; errori nel form
  conservano le scelte. Ritorno alla scheda con filtri/preferenze conservati.
- `loadLeaderAttendance` ricava l’iscrizione dall’assegnazione corrente dopo
  verifica della membership nell’evento corrente e dello scope, inclusi i
  discendenti attivi. Esclude iscrizioni eliminate e interrompe la lettura
  in caso di errore. I vecchi giorni interi vengono mostrati come due fasce.
- `updateGroupLeaderAttendance` autentica il capogruppo e valida le date.
  La RPC `update_group_leader_attendance` ripete i controlli su evento,
  membership e assegnazione; sostituzione delle presenze e audit sono atomici.
  Attore dal server, nessun ID iscrizione/evento dal form. RPC riservata a
  `service_role`; nessun ampliamento delle policy RLS esistenti.
- Migration `20260910120000_leader_attendance.sql` applicata e registrata in
  produzione il 2026-09-10, dopo i test su PostgreSQL temporaneo e prima del
  push. RPC/PostgREST e privilegi verificati; prova sullo schema reale in
  transazione integralmente annullata. Hash/conteggi dei record preesistenti
  invariati su sei tabelle e 89 policy invariate. Una nuova iscrizione arrivata
  durante i controlli è stata distinta tramite `created_at` e audit ordinario.
  Nessuna modifica persistente ai partecipanti durante il collaudo. Snapshot originari, QR e scelte dei singoli
  momenti restano separati; i figli condividono le presenze familiari esistenti.
- Test: `tests/leader-attendance.test.mts`, `tests/sql/leader-attendance.sql`
  e `tests/browser/leader-attendance.mjs` (fixture sintetica desktop/mobile).

## Build riproducibile — 2026-09-09

- Prima delle verifiche di rilascio confrontare le versioni installate con
  `package-lock.json`; se divergono eseguire `npm ci`. Il lockfile resta la
  fonte per le dipendenze usate da Vercel, attualmente Next.js 16.2.9.
- Il deployment di `c0c83dc` è fallito perché la fixture browser includeva
  `AppRouterInstance.bfcacheId`, presente nel Next.js 16.3.0 installato
  localmente ma assente nel 16.2.9 del lockfile. Rimossa la proprietà dalla
  fixture e reinstallate le dipendenze dal lockfile, senza aggiornamenti.

## Prefisso telefono nell’inserimento manuale — 2026-09-09

- `ManualPhoneFields` affianca prefisso e numero nel form capogruppo, con
  default +39 e opzione Altro. Catalogo prefissi condiviso con iscrizione
  pubblica in `lib/registrations/phone-prefixes.ts`; testi e paesi localizzati
  nelle sette lingue. Rimossa la descrizione tecnica sotto il telefono.
- Telefono facoltativo: senza numero invia stringa vuota; altrimenti compone
  il campo `phone` con prefisso e numero senza separatori. Validazioni server
  invariate, nessuna modifica ai contatti esistenti.

## Nomi composti nelle email capigruppo — 2026-09-09

- `loadCampaignDeliveryData`, condiviso da anteprima, prova e invio, usa
  `participants.first_name` e `last_name` quando esiste una scheda collegata,
  senza separare nuovamente il nome completo. Conserva cognomi e nomi composti.
  Il fallback storico resta solo per profili senza scheda partecipante;
  errore di lettura/scheda mancante interrompe il rendering.
- Caso verificato in sola lettura in produzione: Francesco / De Palma sono
  già salvati correttamente. Nessuna correzione dati né invio email effettuato.

## Semplificazione duplicati — 2026-09-09

- La tabella admin/manager offre soltanto `Elimina questa iscrizione`, con
  descrizione `Mantieni l’altra iscrizione`, e `Non sono duplicati`.
  Rimossa l’azione Unisci; anche i vecchi URL `duplicateAction=merge` aprono
  il solo confronto. RPC e dati storici delle unioni restano invariati.
- Sotto entrambi i nomi compare `Data iscrizione`, da `submitted_at`, con
  data e ora nel fuso Europe/Rome, condivisa con il dialog di confronto.
  Non è la data di creazione dell’account Auth. Valori assenti/non validi: `—`.
- Eliminazione ancora singola e reversibile, con motivazione e conferma;
  account e altra iscrizione conservati. Nessuna migration o modifica RLS.

## Azioni duplicati — 2026-09-08

- La pagina istruzioni contiene solo la guida all’importazione Excel, condivisa
  con modale e modello scaricabile. Rimossi i dettagli tecnici sull’unione e
  il link a questa pagina dal confronto duplicati. La guida consiglia di
  lasciare vuoti gli stati, senza elencare i valori tecnici; formato e
  validazioni dell’importazione restano invariati.

- La tabella offre nell’ordine `Elimina`, `Non sono duplicati`, `Unisci iscrizioni`.
  Il nome sottolineato nella colonna Confronta con apre il solo confronto;
  il nome principale apre ancora la scheda. Ogni azione apre un dialog dedicato.
  Elimina riguarda la riga scelta e riusa la route soft delete con motivazione
  e conferma; i viewer non hanno azioni di scrittura.
- Unisci propone l’iscrizione con `submitted_at` più recente, non la data di
  creazione dell’account Auth. Se una sola scheda ha un account collegato,
  quella prevale per conservare l’accesso. Date mancanti/uguali richiedono
  scelta manuale; due account bloccano l’unione. Conferma sempre esplicita;
  nessun cambio a RPC, permessi, RLS o dati esistenti.
- I vincoli SQL restano: le dipendenze non riconciliabili annullano l’unione
  integralmente. UI anticipa i blocchi per due account e minori della scheda
  da archiviare. Test suggerimento: `tests/duplicate-merge-choice.test.mts`;
  dialog desktop/mobile: `tests/browser/participants-navigation.mjs`.

## Assegnazione ruoli a utenti esistenti — 2026-09-08

- Nel selettore utente, la ricerca vuota mostra `Inizia a digitare` senza
  risultati selezionabili; i nomi appaiono dal primo carattere non vuoto.
  Cancellando la ricerca torna l'indicazione iniziale.

- Gestione ruoli admin/manager offre `Utente esistente` (predefinito) e
  `Nuovo utente`. Il selettore condiviso cerca nome/email nei profili con
  email, inclusi account senza alcun incarico; caricamento paginato senza
  taglio a 1.000 utenti. La directory espone soltanto ID, nome ed email e
  viene caricata solo dopo verifica di un ruolo effettivo admin/manager.
- `assignOperationalUserRole` rilegge il profilo selezionato dopo i controlli
  operativi di ruolo/evento/gruppo. In modalità esistente non crea account,
  non aggiorna identità/contatti e non collega o modifica iscrizioni personali;
  ignora i campi nome/email inviati dal client. Restano audit, invito opzionale
  e controllo del ruolo già assegnato. Nessuna migration o modifica RLS.
- La tabella sottostante continua a mostrare soltanto i ruoli assegnati.
  Test server con dati simulati: `tests/operational-role-assignment.test.mts`;
  fixture browser desktop/mobile: `tests/browser/operational-role-assignment.mjs`.
  Nessun ruolo assegnato o invito inviato a utenti reali durante il collaudo.

## Servizio in sola lettura per capogruppo — 2026-09-08

- La scheda capogruppo mostra servizio e stato in sola lettura. Rimossi il
  modulo servizio/stato/nota operativa e il caricamento del catalogo opzioni.
  Note del capogruppo, tag e altri comandi restano separati.
- `updateParticipantEventService` rifiuta richieste dalla dashboard capogruppo
  e verifica sempre ruoli effettivi admin o manager nell'evento; manipolare
  `sourceDashboard` non abilita la scrittura a un semplice capogruppo.
- Blocco dedicato permessi servizio: migration revisionabile
  `20260908180000_leader_service_read_only.sql`, testata localmente e applicata
  in produzione il 2026-09-08 prima del push. Registrazione e policy verificate;
  conteggio/hash di `participant_event_services` invariati (tabella vuota).
  Restringe la policy operativa a manager/admin, conservando lettura in scope,
  preferenza personale, assegnazioni e fonti storiche. Nessuna riscrittura dati.
  L'helper storico `can_manage_participant_event_service` resta usato dalla
  policy di lettura; la policy di scrittura richiede anche `has_event_role`.
- Test: `tests/leader-service-read-only.test.mts` e
  `tests/sql/leader-service-read-only.sql` su PostgreSQL temporaneo: lettura
  capogruppo, divieto insert/update/delete, manager/admin, scope evento, viewer
  e preferenza della propria iscrizione.

## Descrizione domande accessibilità — 2026-09-08

- Iscrizione pubblica (inclusi link di gruppo), inserimento manuale capogruppo
  e modifica iscrizione personale mostrano sotto le opzioni di
  disabilità la descrizione sulle comunicazioni relative ai luoghi e agli
  eventi, quando le opzioni sono visibili. Testo condiviso in sette lingue in
  `lib/i18n/accessibility.ts`.

## QR nominativo scaricabile — 2026-09-08

- Solo i PNG scaricati dall'area personale e dalla scheda capogruppo
  contengono QR, nome/cognome e codice pubblico del partecipante. A schermo
  e nell'immagine inline dell'email si visualizza il solo QR.
  `registrationQrPreview` restituisce `dataUrl` per l'anteprima e
  `downloadDataUrl` per il download nominativo, entrambi con lo stesso token
  e gli stessi controlli di disponibilità.
  `lib/qrcode/participant-card.ts` è il renderer condiviso; identità da dati
  server autorizzati, token opaco invariato, nessun dato personale nel payload.
- I nomi dei file scaricati e degli allegati email usano nome e cognome,
  per esempio `qr-Anna-Bianchi.png`, tramite `participantQrFilename`.
  Lettere internazionali conservate, separatori/percorso rimossi; nessun
  codice pubblico nel nome del file. Il contenuto del PNG resta invariato.

- Codice pubblico utile per ricerca manuale all'accoglienza; non mostrare token
  o UUID tecnici come testo. Nomi lunghi vanno a capo senza troncamento.
  Sharp è dipendenza diretta; Noto Sans con licenza OFL è incluso e tracciato
  nel bundle server per latino/cirillico indipendenti dai font della macchina.
- Wallet e stampa restano futuri: devono mantenere QR, nome completo e codice
  pubblico sul pass/etichetta, con layout calibrato al supporto. Nessuna
  modifica a token, database, RLS o controlli di revoca/scadenza/scope.
- Test renderer: `tests/participant-qr-card.test.mts`; scope e stati in
  `tests/leader-qr.test.mts`; download desktop/mobile nella fixture browser QR.

## Rimozione ruoli operativi — 2026-09-08

- La scheda Modifica utente operativo in Gestione ruoli admin/manager elenca
  tutti gli incarichi in `OperationalRoleRemoval`, con ruolo, evento e gruppo.
  Ogni incarico dispone di Rimuovi ruolo e conferma esplicita, verificata anche
  dalla server action esistente `deleteOperationalUserRole`.
- La rimozione riguarda solo ruolo/evento o membership del gruppo selezionato;
  conserva altri incarichi, account e iscrizione personale. Restano i controlli
  server su scope, admin globale e divieto di rimozione dei propri ruoli,
  audit e sincronizzazione del nome referente principale. Nessuna migration.

## Inserimento capogruppo e email delegata — 2026-09-08

- Il form manuale usa `ManualEmailFields` in sette lingue. Richiede l’email
  personale oppure la scelta `Voglio usare la mia email`, che rimuove il campo
  e consente l’inserimento anche senza telefono. Il server scarta le email
  residue quando `useLeaderEmail=on`; non copia mai l’email del referente
  nei contatti e non crea/collega un account per chi ha scelto la delega.
  Senza recapiti non viene creata una riga vuota in `participant_contacts`.
- Lo snapshot conserva `answers.contact.useLeaderEmail` e
  `communicationDelegateUserId`, ricavato soltanto dall’utente autenticato,
  coerente con `registrations.created_by` e registrato anche nell’audit.
- Le campagne usano quel capogruppo, anche con membership su un antenato
  attivo, verificando evento, assegnazione corrente, scope e raggiungibilità.
  Se perde lo scope o la sua iscrizione è eliminata, niente invio automatico
  ad altri referenti. Per schede storiche senza scelta esplicita resta il
  fallback precedente. L’email personale corrente ha sempre precedenza.
- Aggiungere l’email personale dalla scheda abilita le comunicazioni dirette
  e il normale Magic Link: Auth viene creato al primo Magic Link e la callback
  verificata collega la scheda per email. Nessun invito automatico.
  I contatti impediscono l’email di un altro partecipante o quella del
  capogruppo su una scheda altrui. Gli invii in coda ricalcolano il destinatario
  prima dell’invio e salvano tipo/delegato effettivi nella consegna.
- Nessuna migration, modifica RLS o riscrittura dei dati esistenti.
  Test: `tests/manual-email-delegation.test.mts` e
  `tests/browser/manual-email.mjs`, solo fixture sintetiche, sette lingue/mobile.
  Dettagli e limiti: `docs/manual-email-delegation.md`.

## QR nella scheda capogruppo — 2026-09-07

- La scheda selezionata mostra il QR reale e `Scarica immagine`, con testi in
  sette lingue. Il PNG contiene lo stesso token opaco dell'iscrizione personale,
  valido anche per i figli associati; non è il QR dell'operatore.
- `leader-qr.server.ts` legge il QR solo dopo autenticazione, selezione nella
  lista autorizzata e nuova verifica di membership/scope nell'evento corrente,
  assegnazione corrente e iscrizione non eliminata. La query QR usa l'ID
  iscrizione ricavato dal database, mai un ID di iscrizione inviato dal browser.
- `lib/qrcode/registration-qr.ts` condivide lettura e rendering con l'area
  personale: usa l'ultimo token, senza ripiegare su precedenti token attivi.
  Revoca (anche `revoked_at`), scadenza, token mancante o non decifrabile
  impediscono immagine e download. Nessuna generazione/rotazione/scrittura QR.
  Al browser arriva il PNG, non il token in chiaro o cifrato come dato separato.
- Stato e permessi sono verificati al caricamento della scheda. Il download
  salva il PNG nominativo separato dall’anteprima, come nell’area personale. L'indicatore dell'area
  personale considera anche disponibilità e scadenza effettive.
- Test: `tests/leader-qr.test.mts` su scope negativo, token selezionato, revoche
  e scadenze; `tests/browser/leader-qr.mjs` prova UI e download PNG reale su
  fixture sintetica desktop/mobile. Nessun collaudo modifica partecipanti reali.

## Tabella partecipanti capogruppo — 2026-09-07

- `Partecipanti del gruppo` apre la scheda dal nome, senza colonna Azioni o
  pulsanti Dettagli. `LeaderParticipantsTable` riusa il contratto colonne e
  preferenze manager, con intestazioni ordinabili e selettore sovrapposto.
  Nome sempre visibile; email e telefono sono colonne indipendenti. Paese,
  città, età all'inizio evento e data iscrizione sono facoltative.
- Preferenze browser per operatore in `iscrizioni:leader-participants:v1:<id>`,
  separate dalle preferenze manager; `columns`, `sort`, `direction` nell'URL
  prevalgono. Link scheda, chiusura e salvataggi identità/contatti/note/tag/
  servizio/rifiuto conservano filtri e preferenze con `leaderReturnPath`.
- `/dashboard/capogruppo/export` esporta un solo foglio Excel, tutte le righe
  filtrate, solo le colonne visibili nello stesso ordine e ordinamento.
  UI ed export condividono filtri, ordinamento, formattazione e testi in sette
  lingue; la scrittura di celle stringa riusa il writer manager contro formule.
- `leader-data.server.ts` condivide tra pagina ed export il caricamento
  paginato di membership, gruppi e assegnazioni, sostituendo il limite di 100.
  Il server verifica sessione/ruolo, ricostruisce lo scope dall'utente corrente
  e dalle membership capogruppo nell'evento corrente, includendo i discendenti
  attivi. Nessun parametro del client può scegliere utente o evento. Anche
  admin nell'area capogruppo deve avere membership per esportare dati.
  Esclude iscrizioni eliminate e assegnazioni non correnti; servizi e tag
  sono limitati all'evento/iscrizione pertinente. Errori di lettura interrompono
  il caricamento anziché produrre export parziali. Nessuna nuova capacità
  operativa manager, modifica RLS o migration.
- Regressioni: `tests/leader-participants-table.test.mts` (scope, oltre 1.000
  righe, filtri, export e ritorni) e `tests/browser/leader-participants.mjs`
  (fixture locale, colonne, ordinamento, download, desktop/mobile). Queste
  prove non sostituiscono un collaudo autenticato su Supabase con capogruppo reale.

## Qualità dati, duplicati e scambio Excel — blocco 6, 2026-09-05

- Importazione condivisa dalla tabella iscritti; istruzioni consultabili
  prima dell'upload e modello
  `.xlsx` vuoto con fogli Esempi/Istruzioni/Cataloghi separati. Formato canonico
  `pace-partecipanti-v1` in `lib/data-quality/format.ts`: date testo ISO,
  telefono internazionale, gruppi/servizi/tag per UUID o nome univoco in evento,
  stato servizio separato, consensi originali obbligatori. 2 MiB/500 righe.
- Dal 2026-09-06, il pulsante `Importa iscritti da Excel` apre una modale
  nativa sopra la tabella ed è visibile agli operatori con permessi di
  scrittura. È accanto al titolo `Gestione iscritti`, separato da `Crea tag
  operativo` sulla destra. Include istruzioni espandibili, modello e anteprima; X/Escape
  chiudono conservando filtri, sidebar e scroll. `import=excel` controlla
  l'apertura; la vecchia route `/dashboard/participants/data-quality`
  reindirizza alla modale nella dashboard autorizzata.
  La modale usa i token grafici e i pulsanti condivisi del sito, con tre
  passaggi: prepara, scegli il file, controlla e conferma. `Scegli file Excel`
  mostra il nome selezionato; cambiare file annulla l'anteprima precedente.
  Le istruzioni in linguaggio semplice di `IMPORT_GUIDE` sono condivise tra
  modale, pagina istruzioni e modello scaricabile; il file esportato dalla
  tabella non sostituisce il modello di importazione.
  Il menu condiviso `Sezioni partecipanti`, sopra il contenuto, separa
  `Partecipanti`, `Duplicati` (`view=duplicates`) e `Senza gruppo`
  (`view=without-group`): una sola tabella per volta, senza riquadri impilati.
  Il cambio vista conserva dashboard, sidebar e preferenze colonne, ma azzera
  i filtri della vista precedente per evitare code incomplete senza motivo visibile.
  L'archivio admin rimane accessibile da Partecipanti.
  `OperationsDuplicatesSection` viene caricato solo nella vista Duplicati,
  anche in sola lettura, e controlla tutte le iscrizioni operative dell'evento.
  La tabella mostra le due schede di ogni coppia con email, gruppo, motivo,
  confronto e azioni. Modifica apre la scheda condivisa in dialog; il confronto
  e l'esclusione aprono un dialog nativo, chiudibile con X/Escape senza scroll.
  Escludi marca la coppia come persone distinte dopo motivazione/conferma e non
  elimina iscrizioni. Le coppie escluse restano consultabili in `Esclusi`.
  `duplicatePair`, `duplicateAction=exclude`, `duplicateShow` e `duplicatePage`
  controllano confronto, azione, vista e paginazione; salvataggi e chiusure
  ritornano alla vista Duplicati, conservando pagina e filtro degli esclusi.
  L'export è sotto i filtri: pulsante verde con icona download `Esporta
  iscritti` e descrizione esplicita del file Excel relativo ai filtri applicati.
- Migration `20260906120000_service_role_app_schema_usage.sql` autorizzata e
  applicata in produzione il 2026-09-06: aggiunge il solo USAGE sullo schema
  `app` a `service_role`, necessario per `quality_event_version` e gli helper
  server già autorizzati. Nessuna modifica RLS; hash/conteggi invariati su sei
  tabelle. Corretto anche il join dei gruppi nel loader import/export con la
  FK esplicita `participant_group_assignments_group_id_fkey`. Dettagli in
  `docs/data-quality-excel.md`.
- Motore unico in `lib/data-quality/duplicates.ts`: nomi normalizzati e
  Levenshtein corroborati da nascita, email, telefono, paese/città. Classi
  esatta, molto probabile, possibile, falso positivo verificato. Nessuna
  unione automatica. Usato da console, import e inserimento manuale capogruppo.
- Preview solo in memoria/cifrata, legata a operatore, evento, scopo e scadenza
  20 minuti. Nessuna scrittura prima della conferma esplicita; scarti e
  persone distinte motivati. Commit SQL atomico e idempotente con UUID/hash,
  controllo versione DB e lock brevi. Falsi positivi persistiti con fingerprint
  SHA-256; cambiando i dati il caso si riapre. Archiviate da verificare con admin.
- Merge consapevole: record da conservare scelto esplicitamente, dati presenti
  prevalenti, completamento mancanti, tag/presenze riuniti; source archiviata
  con `registrations.merged_into_id`, storico conservato e QR revocato.
  Ripristino ordinario vietato. Account distinti, identità su altri eventi e
  dipendenze delicate richiedono riconciliazione dedicata, senza merge parziali.
- Export `.xlsx` con tutti i risultati dei filtri e RLS dell'operatore,
  paginazione oltre 200/1000, filtro `stat` e minori tramite iscrizione familiare.
  Dal 2026-09-06 esporta un solo foglio Iscritti con le colonne effettivamente
  visibili, nello stesso ordine, incluse preferenze browser e vista Senza gruppo.
  Nomi leggibili per gruppo/servizio/tag, età all’inizio dell’evento e data
  iscrizione; nessun foglio aggiuntivo o dato nascosto. Il modello canonico
  di importazione resta separato. Celle stringa contro formule;
  preflight ZIP con limite decompresso e rifiuto macro/link/formule/colonne inattese.
- Migration `20260905210000_data_quality_excel.sql` applicata in produzione
  il 2026-09-05, con conteggi/hash invariati su 10 tabelle (68 iscrizioni);
  nessun import/merge su dati reali. Introduce `duplicate_reviews`,
  `participant_imports`, `merged_into_id`, RPC servizio con controlli SQL,
  RLS nuove tabelle e audit transazionale; nessuna policy esistente allargata.
- Test: `tests/data-quality*.test.mts`, `tests/sql/data-quality.sql` su DB
  temporaneo vuoto, `tests/browser/data-quality.mjs` su fixture locale.
  Formato, limitazioni merge, sicurezza e rilascio: `docs/data-quality-excel.md`.

## Gestione iscritti e soft delete — blocco 5, 2026-09-05

Queste regole sostituiscono la precedente tabella fissa con colonna Azioni e
l'eliminazione fisica dell'iscrizione. Migration applicate e registrate in
produzione il 2026-09-05; codice rilasciato tramite PR #8 (`b0485c4`), deployment
`dpl_4P4U8mz6tCf75twJKFHreStCMYHV` Ready sul dominio pubblico. Verificate 68
iscrizioni conservate e nessuna eliminata dalla migration, hash invariati su
18 tabelle, 13 policy restrittive, 5 trigger e RPC/PostgREST con privilegi corretti.

- Admin e manager usano `OperationsParticipantsSection` (confine server per i
  permessi) e `OperationsParticipantsTable` (unico client per tabella e scheda).
  Il nome apre la scheda anche per `manager_viewer`, in sola lettura.
- Colonne facoltative e ordinamento sono salvati nel browser per ID operatore,
  condivisi tra area admin e manager. L'URL può prevalere sulle preferenze
  salvate. Il nome resta sempre visibile. Età calcolata all'inizio dell'evento.
  Lo stato iscrizione non è una colonna selezionabile: le vecchie preferenze
  e gli URL che lo includono lo ignorano, con ordinamento di ripiego sul nome.
- Dal 2026-09-06, lo stato tecnico dell'iscrizione non compare neppure tra
  i filtri admin/manager. Il parser condiviso ignora i vecchi parametri
  `status` anche nell'export, evitando filtri attivi invisibili; lo stato
  rimane nei dati interni. Gruppo, servizio, tag e archivio restano distinti.
- Il filtro Tag occupa una sola colonna della griglia, larga quanto Servizio,
  e lo affianca nei layout a due e tre colonne, anche in Senza gruppo.
  Servizio inizia sempre una nuova riga; su mobile i campi sono impilati.
  `Azzera filtri` resta accanto al filtro Tag; `Colonne visibili` e
  `Mostra figli accompagnati` precedono `Esporta iscritti`,
  fuori dal form dei filtri. Su schermi stretti i comandi vanno a capo.
  Il selettore colonne si apre in un pannello sovrapposto; le sue checkbox
  non avviano il filtraggio automatico. La descrizione Excel è a destra del pulsante di export.
- Dal 2026-09-06, `Mostra figli accompagnati`
  mostra/nasconde sotto il genitore il badge con il numero di figli e il
  riepilogo di nomi ed età all'inizio dell'evento. Parte spento nella vista
  ordinaria e si attiva entrando nel filtro statistico `kind=child`; la
  scelta è temporanea e si reimposta al cambio di statistica.
  Le righe senza figli restano compatte;
  la scheda continua ad aprirsi dal nome del genitore. Il riepilogo usa i figli
  già presenti nello snapshot e gli stessi permessi della tabella condivisa.
  Il filtro statistico `kind=child` distingue iscrizioni familiari e figli
  nelle righe mostrate. Eventuali fratelli fuori dal filtro restano nel
  riepilogo della propria famiglia. Non mostrare spiegazioni testuali sui figli.
  Tutti i filtri statistici, incluso `Minori accompagnati`, restano indicati
  con `Filtro dalle statistiche: …` accanto ad `Azzera filtri`, unico comando
  di azzeramento anche per `stat`; non esiste un secondo `Rimuovi filtro`.
- Gruppo, servizio e tag si salvano direttamente dalla tabella e dalla scheda,
  tramite la stessa RPC `update_registration_operation`; le modifiche sono
  serializzate per iscrizione e auditabili nella stessa transazione. Un
  selettore vuoto rimuove il gruppo/servizio; un servizio scelto è assegnato.
- Le intestazioni Gruppo e Servizio hanno ciascuna un interruttore a matita
  sulla stessa riga del titolo, con tooltip `Modifica rapida` e sfondo blu
  quando attivo. Parte spento e abilita i selettori per l'intera colonna.
  Le due scelte sono indipendenti e temporanee, senza salvataggio nel browser;
  valgono anche per la coda Senza gruppo. A interruttore spento si leggono i
  valori correnti; la scheda resta modificabile secondo i permessi. Nessun
  interruttore per `manager_viewer` o nell'archivio delle iscrizioni eliminate.
- `view=without-group` è la coda dedicata con nome, paese, città, età e gruppo.
  L'assegnazione riuscita rimuove subito la riga; un errore mantiene i dati.
  I caricamenti sono paginati e le relazioni lette a blocchi: nessun taglio
  silenzioso alle prime 200 iscrizioni o al limite PostgREST.
- La scheda usa un dialog nativo con focus, Escape e scroll interno. Il campo
  `returnTo`, validato dal server, conserva la sezione iscritti, filtri inclusi
  `stat`, vista, ordinamento, colonne, sidebar e scheda aperta. I form marcati
  `data-preserve-dashboard-scroll` navigano senza azzerare lo scroll.
- `20260905190000_registration_soft_delete.sql`: `registrations.deleted_at`,
  `deleted_by`, `deletion_reason`, `restored_at`, `restored_by`; RPC server
  `set_registration_deleted`. Motivazione 3–500 caratteri e conferma nella UI.
  Manager solo in evento assegnato; ripristino solo admin da `view=deleted`.
  Account, partecipante, figli, consensi, questionari e storico restano.
- RLS restrittiva esclude le iscrizioni eliminate e i relativi dati operativi;
  admin può leggere l'archivio. Trigger impediscono hard delete applicativo,
  nuovi QR/check-in e modifiche operative per iscrizioni eliminate. SQL di
  manutenzione intenzionale come database owner resta distinto dal flusso app.
- I QR attivi vengono revocati e marcati come sospesi dall'eliminazione. Il
  ripristino riattiva solo questi QR ancora validi; non quelli già revocati.
  Le campagne in attesa sono escluse senza toccare invii storici; il ripristino
  non riavvia invii. Controllo di ammissibilità ripetuto prima dell'invio,
  anche per recapiti delegati/capigruppo con iscrizione personale eliminata.
- I lookup pubblici dell'email riconoscono le identità conservate per evitare
  che una nuova registrazione aggiri l'eliminazione. Le liste operative,
  statistiche, area personale e audience campagne filtrano `deleted_at`.
- `20260905191000_participant_quick_operations.sql` include gruppo, servizio,
  tag, identità e contatti; verifica permessi, evento, opzioni assegnabili e
  iscrizione non eliminata. Le RPC che accettano l'attore sono riservate a
  `service_role`, mai a `anon` o `authenticated`.
- Procedura di rilascio e verifiche: `docs/participant-operations.md`.

## Gruppi, Impostazioni e link automatici — 2026-09-05

Queste regole sostituiscono le precedenti istruzioni sulla generazione manuale
dei link e sul menu Servizi.

- Il form condiviso admin/manager distingue tipo e posizione. Default:
  `Gruppo effettivo`, assegnabile. Paese/città/area nascono strutturali e
  diventano iscrivibili soltanto con la scelta esplicita. Validazioni server
  su evento, parent coerente e assenza di cicli. Il campo HTML si chiama
  `groupNodeType`, evitando il conflitto con la proprietà DOM `nodeType`.
- Dal 2026-09-06, la gestione evento admin vive in
  `/dashboard/admin?section=impostazioni`, accanto al collegamento al catalogo
  servizi condiviso. Rimossa la voce autonoma Gestione evento dalla sidebar.
  `section=evento` reindirizza conservando i parametri; link, overlay nuovo
  evento e ritorni delle action usano Impostazioni. L'ingresso admin senza
  sezione apre Statistiche. Il collegamento alla gestione evento dalle
  impostazioni servizi è visibile solo agli admin; accesso e action restano
  riservati al ruolo admin, senza modifiche a permessi manager o RLS.
- Dal 2026-09-06, `Impostazioni` è sempre l’ultima voce delle sidebar admin
  e manager, sia nel menu esteso sia in quello compatto.
- `Impostazioni` contiene il catalogo servizi nella route condivisa
  `/dashboard/manager?section=impostazioni`, anche per admin. I vecchi URL
  `section=servizi` vengono reindirizzati conservando gli altri parametri.
- Migration `20260905170000_automatic_group_links.sql`: trigger transazionale
  di creazione link canonico e audit per ogni gruppo assegnabile, backfill
  dei mancanti e colonna `slug` per gli URL amministrativi pubblici. I vecchi
  token cifrati restano validi. Nessuna modifica RLS.
- Il canonico non può essere revocato, cancellato, spostato, scadere o esaurirsi.
  `Gestisci link` modifica nome pubblico/slug e mostra URL e copia. Non esiste
  più `Genera link`. Collisioni gestite senza invalidare il link corrente;
  cambiare slug rende inutilizzabile il vecchio URL, come spiegato nella UI.
- Migration applicata in produzione: 93 link/audit creati; 107 gruppi
  assegnabili con 107 canonici, zero mancanti e zero nuovi link strutturali.
  I 14 record canonici preesistenti sono verificati invariati.
- Migration complementare `20260905171000_reserve_email_preview_group_slug.sql`:
  riservata anche la route `dev-email-preview`, con test di copertura di tutte
  le route statiche alla radice.
- Dettagli, verifiche e rilascio: `docs/automatic-group-links.md`.

## Assegnazioni operative e questionario — 2026-09-05

Queste regole sostituiscono le precedenti indicazioni su conferma ordinaria,
notifica capogruppo e coda territoriale, incluse le tranche 9, 14.1 e 24 agosto.

- Ogni assegnazione corrente è operativa; `confirmed` resta il valore tecnico,
  senza richiedere una conferma successiva. UI e conteggi usano gruppo assegnato.
- Il capogruppo vede tutte le persone correnti in scope e gestisce soltanto
  l'eccezione `Non appartiene al mio gruppo`, oltre alle note e ai dati già
  modificabili. Non esistono più Da confermare, conferma/non conferma,
  smistamento ai discendenti o lettura della notifica.
- Il rifiuto disattiva l'assegnazione e porta sempre in `Senza gruppo`, senza
  risalita al padre. La RPC server `reject_group_assignment` verifica evento,
  membership e scope; rimozione e audit sono transazionali. Solo admin/manager
  possono assegnare nuovamente una persona senza gruppo.
- Eliminati invio e template delle email per nuove assegnazioni ai capigruppo.
  Le colonne storiche di conferma/lettura restano, ma la lettura non è più usata.
- Dal 2026-09-08, nei link di gruppo validi il modulo condiviso nasconde
  entrambe le domande e invia le due risposte come Sì; mostra subito il nome
  del gruppo in sola lettura. I valori effettivi prevalgono anche su bozze
  recuperate dopo errore. Il flusso ordinario resta condizionale come sotto;
  la validazione server continua a verificare il link e il gruppo.
- Questionario corrente: `2026-09-06-conditional-groups` (flusso aggiornato il
  2026-09-06). La prima domanda sugli eventi precedenti è obbligatoria: Sì
  mostra `Parteciperai alla Preghiera per la Pace con un gruppo della Comunità?`,
  anch'essa obbligatoria quando visibile; No mostra direttamente l'associazione
  facoltativa. Nella seconda domanda Sì mostra il gruppo, No l'associazione.
  Cambiare il primo valore in No azzera risposta e selezioni del ramo gruppo;
  i campi non pertinenti non vengono inviati. Il server normalizza il primo
  No come partecipazione senza gruppo anche con campi residui o link riservato.
  Nei link le due risposte Sì sono implicite dal 2026-09-08.
  Associazione in `answers.externalGroupAssociation`, sette lingue aggiornate;
  nuova versione snapshot senza riscritture storiche o migration.
- No prevale anche su link riservato/membership. Senza scelta esplicita, o con
  `Non trovo il mio referente`, non creare assegnazioni territoriali automatiche.
  Nel flusso ordinario non assumere una precedente partecipazione.
- Migration testata su PostgreSQL temporaneo e applicata in produzione il 2026-09-05:
  `20260905150000_operative_group_assignments.sql`. Conserva audit/snapshot
  storici, rimuove code automatiche ancora probabili e assegnazioni incompatibili
  con No (salvo override admin/manager), converte le restanti probabili senza
  inventare una conferma umana. Trigger/default normalizzano i nuovi stati;
  nessuna modifica alle policy RLS. Rilascio SQL/codice completato: 36 probabili
  rese operative, 23 assegnazioni rimosse, 44 correnti finali; 59 audit nuovi,
  506 audit precedenti e 68 snapshot verificati invariati. RPC/PostgREST verificati
  e iscrizioni riaperte con la finestra originale.
- Procedura e dettagli: `docs/operative-group-assignments.md`. Regressioni in
  `tests/group-questionnaire.test.mts`, `tests/browser/group-questionnaire.mjs`
  e `tests/sql/operative-group-assignments.sql`.

## Stato del progetto

- Nome progetto/repository: `iscrizioni-pace`.
- Repository GitHub: `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Cartelle locali note per le postazioni di sviluppo:
  - Giovani per la Pace: `/Users/giovaniperlapace/Developer/iscrizioni-pace`.
  - Stefano: `/Users/stefanolaptop/Documents/codex_new/iscrizioni-pace`.
  - Altre postazioni: verificare sempre con `pwd`; non assumere che il path
    locale sia uguale.
- La fonte condivisa da riallineare prima di ogni milestone e' sempre
  `origin/main` su GitHub.

## Workflow Git e postazioni multiple

- Non lavorare dentro cartelle sincronizzate da servizi cloud: la
  sincronizzazione della directory `.git` puo' creare lock, ref duplicati e
  repository corrotti. Ogni postazione deve avere un clone locale indipendente
  fuori dalle cartelle cloud.
- GitHub e' l'unico canale di sincronizzazione del codice tra computer e
  persone. Non usare servizi di sincronizzazione file per condividere una
  working copy Git attiva.
- Dal 2026-09-05, salvo indicazione esplicita dell'utente, tutte le modifiche
  si effettuano direttamente su `main` nel checkout locale ordinario. Questa
  regola sostituisce le precedenti eccezioni per lavoro lungo, rischioso o
  parallelo, migration e permessi/RLS.
- L'unica eccezione stabile e' il branch `codex/panel-p0-p10`, che DEVE
  continuare a esistere per lo staging dei panel. Non eliminarlo, neppure
  dopo un'integrazione in `main`, senza richiesta esplicita. Usarlo per le
  modifiche quando l'utente indica espressamente lo staging/branch dei panel;
  in assenza di indicazioni lavorare su `main`, anche se il tema sono i panel.
- Non creare autonomamente branch, worktree o pull request. Solo una nuova
  richiesta esplicita dell'utente puo' cambiare questa scelta; complessita',
  rischio o comodita' di anteprima non sono motivi per derogare.
- Riallineare prima `main`, eseguire i controlli proporzionati e, quando
  richiesto, fare commit e push direttamente su `main`. Il push su `main`
  avvia il normale deployment production.
- All'inizio di ogni nuova attivita' verificare `pwd`, il branch corrente e lo
  stato con `git status --short --branch`, quindi eseguire automaticamente
  `git fetch origin`. Prima di modificare file assicurarsi di essere su `main`
  ed eseguire `git pull --ff-only` con upstream `origin/main`. Quando l'utente
  indica esplicitamente il branch panel, riallineare invece quel branch al
  proprio upstream.
- Se il checkout e' su un altro branch, verificare prima modifiche locali e
  commit non integrati; passare a `main` soltanto quando e' sicuro, senza
  perdere, trascinare o integrare automaticamente lavoro preesistente. Se non
  e' possibile, segnalare l'impedimento prima di iniziare nuove modifiche.
- Il pull automatico deve fermarsi e segnalare la situazione, senza forzare
  modifiche, se la working tree non e' pulita, il branch non ha un upstream, i
  commit locali e remoti sono divergenti oppure emergono conflitti. In questi
  casi risolvere consapevolmente la sincronizzazione prima di iniziare il nuovo
  lavoro.
- Durante il lavoro esplicitamente destinato allo staging panel, integrare
  periodicamente `origin/main` in `codex/panel-p0-p10` con un merge, anche prima
  delle verifiche finali e dell'integrazione in `main`. Non fare rebase del
  branch condiviso; ripubblicarlo dopo il merge quando il push e' richiesto.
- Prima di terminare una sessione: eseguire i controlli proporzionati alla
  modifica e verificare il diff. Quando l'utente richiede commit/push,
  pubblicare su `main` (o sul branch panel se espressamente indicato),
  verificarne l'allineamento con il rispettivo remoto e lasciare
  pulite le modifiche della sessione. Non includere lavoro estraneo al task.
- Per cambiare computer: concludere e fare push dalla prima postazione; sulla
  seconda eseguire il pull automatico iniziale e continuare su `main`, oppure
  sul branch panel quando espressamente indicato per l'attivita'.
  Non modificare contemporaneamente lo stesso branch da due dispositivi
  senza prima coordinare, fare push e sincronizzare.
- Gli altri branch o worktree preesistenti non autorizzano nuove modifiche
  fuori da `main`; non eliminarli o integrarli automaticamente.
- L'automazione multi-postazione deve limitarsi a verificare lo stato Git ed
  eseguire un fetch e un fast-forward sicuro di `main` (o del branch panel
  espressamente indicato) all'avvio della nuova attivita', nel checkout locale
  ordinario e senza creare branch o worktree.
- Milestone 1 ha inizializzato questa cartella come repository Git locale.
- Milestone 2 ha aggiunto guardrail di qualità e documentazione operativa.
- Milestone 4 ha aggiunto autenticazione base Supabase, callback auth,
  helper ruoli e protezione dashboard con Next `proxy.ts`.
- Milestone 5 ha aggiunto il flusso pubblico email-prima, iscrizione iniziale,
  invio applicativo di magic link/conferme via Gmail SMTP e QR token opaco.
- Milestone 5.5 ha aggiunto questionario iscrizione versionato, seed evento
  test e bootstrap utenti test per admin/manager/partecipante.
- Milestone 6 ha completato una prima dashboard partecipante self-service con
  riepilogo iscrizione, area panel/gruppo, modifica controllata di contatti,
  lingua, presenze e supporto, piu' audit delle modifiche. Il QR era inizialmente
  placeholder ed e' stato poi sostituito dal QR reale anticipato il 2026-06-15.
- Milestone 6.1 ha affinato la dashboard partecipante: gruppo come informazione
  secondaria sotto il nome, schermata rapida focalizzata sui panel e due
  pulsanti con icone per aprire QR code o iscrizione modificabile in overlay.
- Milestone 6.3 ha aggiunto albero gruppi, nodi territoriali per nuovi
  partecipanti, matching referente/gruppo per paese, città ed età, e opzione
  pubblica "Non trovo il mio referente"; durante il test locale sono stati
  aggiunti anche conservazione dati form dopo errore e CTA di primo accesso
  dalla conferma iscrizione.
- Milestone 7 ha iniziato la preparazione all'apertura pubblica: checklist
  operativa, guardrail Vercel/env, comando `opening:verify`, riconoscimento del
  ruolo capogruppo da `group_memberships` e primo accesso all'area personale
  dalle dashboard operative. Dal 2026-06-16 questo accesso e' diventato la tab
  condivisa `Iscrizione e QR personale`.
- Milestone 8 ha aggiunto apertura controllata e monitoraggio iniziale dalla
  dashboard admin: comandi auditati per aprire/pausare/nascondere evento,
  conteggi minimi iscrizioni/anomalie, logging audit degli errori email e log
  operativo in `docs/opening-monitoring-log.md`.
- Milestone 9 ha aggiunto dashboard capogruppo minima: elenco assegnazioni in
  scope albero gruppi, filtri operativi, conferma/rifiuto con risalita al padre,
  note interne, lettura notifica e audit delle decisioni senza email al
  partecipante.
- Milestone 9.1 ha aggiunto link riservati per gruppi nascosti ma iscrivibili:
  `groups.public_label`, tabella `group_registration_links`, generazione/revoca
  da dashboard manager e capogruppo in scope e form pubblico precompilato
  tramite `?groupLink=...`. I token sono slug amministrativi leggibili e
  univoci, derivati dal nome pubblico del link e composti da lettere, numeri,
  trattini e underscore, per esempio `pentecoste`, `sant_andrea` o
  `resurrezione_68`; in caso di omonimia l'app aggiunge un suffisso numerico.
  Dal 2026-07-30 i link pubblici usano lo slug direttamente alla radice del
  dominio, per esempio
  `https://registrationspeace.santegidio.org/sant_andrea`; la route legacy
  `/registrazione?groupLink=sant_andrea` resta compatibile e reindirizza in
  modo permanente al formato breve. Le dashboard manager, admin e capogruppo
  mostrano il formato breve anche per tutti i link già generati. Gli slug non
  possono coincidere con le route applicative riservate.
  Il 2026-07-30 sono stati ruotati anche gli ultimi quattro token opachi
  preesistenti: `Assemblea di Trastevere`, `Castelli`, `Guidonia - Tivoli` e
  `W gli anziani - Monti/Esquilino` usano rispettivamente gli slug
  `assemblea_di_trastevere`, `castelli`, `guidonia_tivoli` e
  `w_gli_anziani_monti_esquilino`. La rotazione e' registrata in audit con
  action `group_registration_link.token_rotated`; tutti i 13 link canonici
  dell'evento hanno ora uno slug leggibile.
- Milestone 10 ha aggiunto gestione partecipanti da dashboard capogruppo:
  tabella operativa dei partecipanti del gruppo, inserimento manuale in overlay,
  link riservati in overlay, source `capogruppo`, QR reale, consenso dichiarato
  dal referente, assegnazione gruppo confermata e audit dedicato.
- Milestone 11 ha consolidato le dashboard manager/admin essenziali: tabella
  iscritti filtrabile per ricerca, evento, stato gruppo e stato iscrizione,
  conteggi sul risultato filtrato, consultazione dettagli e modifica controllata
  del gruppo corrente in overlay, con consultazione read-only coerente per
  `manager_viewer`. La gestione dei ruoli non appartiene alla tabella iscritti:
  per i capigruppo vive nella tabella gruppi tramite azione `Capogruppo`, dove
  si può promuovere un partecipante esistente o creare una scheda minima
  nome/cognome/email collegata a un utente auth e a `group_memberships`.
  Le tabelle operative caricano fino a 200 iscrizioni recenti e includono anche
  le iscrizioni annullate quando filtrate.
- Dal 2026-08-01 la sezione `Gestione iscritti` di admin e manager usa lo
  stesso componente condiviso per tabella, filtri e scheda partecipante. Le due
  dashboard devono mantenere le stesse funzioni di consultazione e modifica di
  identità, contatti, gruppo e tag, oltre alle stesse colonne per servizio e
  tag. Anche l'eliminazione dell'iscrizione è disponibile a entrambi: l'admin
  può operare globalmente, mentre il manager soltanto sugli eventi assegnati.
  Le modifiche future alla gestione iscritti non vanno duplicate nelle due
  pagine, ma applicate al componente condiviso.
- Dopo revisione della Milestone 11, la gestione gruppi admin/manager e' stata
  spostata su una tabella gruppi filtrabile con azioni per riga. La creazione e
  modifica gruppi si apre in overlay; la generazione/revoca dei link riservati
  si apre dall'azione `Gestisci link` del singolo gruppo. Non mostrare in
  dashboard un form di generazione link per ogni gruppo contemporaneamente.
- Le statistiche generiche sopra la tabella iscritti admin/manager sono state
  rimosse per ridurre rumore visivo. Inventario delle statistiche disponibili:
  `docs/statistiche-disponibili.md`.
- Dal 2026-09-03 la pagina statistiche condivisa da admin e manager usa tre
  report sintetici: riepilogo territori/gruppi, pivot geografica espandibile
  paese > città > gruppo con colonne mattina/pomeriggio, riepilogo presenze e
  fasce di età. La pivot mostra il livello gruppo soltanto per città con più
  gruppi. Non esistono più le tabelle nominali per territorio, presenza o età,
  né la vista completa finale. Tutti i conteggi sono link a `Gestione iscritti`
  tramite il filtro compatto `stat`; il filtro deve continuare a includere i
  minori accompagnati collegandoli alla relativa iscrizione familiare. Le
  statistiche di presenza espongono solo mattina e pomeriggio dei giorni
  dell'evento: eventuali scelte legacy `day` valgono per entrambe le fasce e
  l'eventuale fascia di arrivo precedente all'inizio non compare nel report.
- Il 2026-06-17 la roadmap futura e' stata rinumerata dalla prossima milestone
  in poi: Milestone 12 e' revisione guidata UX, navigazione e dati dashboard;
  Milestone 13 e' multilingua minima e testi localizzati; Milestone 14 e'
  rifinitura estetica. Motivo: le funzioni essenziali sono
  sufficienti per preparare l'apertura pubblica, quindi prima di aggiungere
  moduli avanzati bisogna verificare UX/flussi, localizzare testi stabili e
  solo dopo rifinire UI e grafica.
- Milestone 12 e' stata avviata il 2026-06-17 con una prima revisione UX su
  home, registrazione, conferma/magic link e dashboard partecipante. Prime
  patch consolidate nel commit `3d4d00d`: messaggi rossi del form solo dopo
  interazione o submit tentato, consenso dati sensibili di accessibilità
  mostrato/richiesto solo quando l'utente segnala bisogni di accessibilità,
  login non autenticato senza path tecnico, riduzione temporanea delle domande
  accessibilità.
- Nella seconda tranche della Milestone 12 sono state riviste in localhost la
  dashboard partecipante con utente test non personale, dashboard capogruppo,
  manager, admin e accoglienza. Patch approvate: i dati accessibilità della
  dashboard partecipante non vengono più duplicati in input hidden nei form non
  dedicati e sono preservati lato server; i controlli `Gestisci` della tabella
  capogruppo hanno etichette accessibili contestuali; il proxy reindirizza gli
  accessi a dashboard non consentite verso la prima dashboard consentita invece
  che sempre verso l'area partecipante.
- Il 2026-06-17 la dashboard partecipante e' stata rifinita dopo revisione UX:
  il QR personale deve essere visibile subito nella prima schermata, non dietro
  un pulsante; sotto al QR compare `Il tuo codice: <codice>`; le azioni QR
  (`Scarica immagine`, futuro `Aggiungi al tuo wallet`) restano accanto al QR
  quando lo spazio lo consente; lo stato QR e' un indicatore verde/rosso in alto
  a destra con tooltip descrittivo, non una riga informativa nella card.
- Milestone 13 e' stata completata il 2026-06-17 con multilingua minima:
  selettore lingua globale nell'header con bandierine, cookie
  `iscrizioni_locale`, detection iniziale da `Accept-Language`, fallback
  inglese quando la lingua non e' supportata, e localizzazione di home, login,
  conferma iscrizione, form pubblico, tab dashboard condivise, testi comuni
  header, dashboard partecipante e dashboard capogruppo. Lingue supportate:
  italiano, inglese, francese, tedesco, spagnolo, neerlandese e ucraino.
  Dal 2026-07-02 la lingua preferita non viene piu' raccolta come dato del
  partecipante nei flussi pubblico, dashboard partecipante o inserimento
  manuale capogruppo; resta solo la lingua dell'interfaccia tramite cookie.
- Milestone 14 e' stata avviata il 2026-06-17 con un restyling esclusivamente
  grafico ispirato alla locandina ufficiale
  `UNARMED AND DISARMING PEACE / PACE DISARMATA E DISARMANTE`: token CSS
  centralizzati in blu istituzionale, azzurro luminoso, bianco e grigi freddi;
  titolo ufficiale evidente in home, registrazione, conferma e login; header
  con logo Sant'Egidio originale valorizzato; motivo SVG astratto a linea
  continua ispirato alla colomba senza copiare la locandina. Non sono state
  modificate logica applicativa, route, validazioni, API, schema dati o policy.
- Dal 2026-08-22 la traduzione inglese ufficiale del titolo e'
  `UNARMED AND DISARMING PEACE`. La precedente forma inglese era errata e non
  deve ricomparire in UI, metadata, documentazione o dati evento. La
  migration `20260822100000_correct_assisi_2026_english_title.sql` corregge gli
  ambienti in cui l'identita' evento era gia' stata applicata. Il 2026-08-22
  la migration e' stata applicata e registrata sul database production; il
  titolo del record `assisi-2026-test` e' stato verificato dopo l'aggiornamento.
- Sempre nella Milestone 14, le dashboard manager e admin sono state divise in
  tre sezioni accessibili da sidebar: `Evento`, `Gestione iscritti`, `Gruppi`.
  Le route restano `/dashboard/manager` e `/dashboard/admin` con query
  `section=evento|iscritti|gruppi` per evitare duplicazione di query/action; le
  sidebar supportano `nav=mini` per comprimersi e lasciare più spazio alle
  tabelle. I filtri e i link interni devono preservare la sezione e, dove
  possibile, la modalità `nav`. In modalità mini non usare lettere iniziali:
  usare icone minimal da `lucide-react`.
- La Milestone 14 ha sostituito la favicon placeholder con `app/favicon.ico`:
  colomba bianca stilizzata su sfondo blu istituzionale, coerente con la
  locandina e leggibile nelle tab browser.
- Dal 2026-08-13 la prima schermata della home include in fondo un richiamo
  localizzato e accessibile al programma dei panel sottostante. Il richiamo
  riusa il motivo grafico `PeaceLineMark` e una freccia animata con fallback
  `prefers-reduced-motion`; il click scorre in modo fluido fino all'ancora
  `#panel-program`, mentre con movimento ridotto torna allo spostamento
  immediato. Il richiamo deve restare visibile come ponte tra accesso e
  programma. La CTA inversa per registrarsi o accedere compare soltanto dopo
  l'intero elenco dei panel e punta a `#personal-access` sulla sezione hero,
  non direttamente all'input: in questo modo il ritorno animato ripristina la
  prima schermata con il modulo email centrato nel layout. La CTA inversa
  riprende la stessa pillola grafica, il `PeaceLineMark` e una freccia verso
  l'alto; non mostrare sotto una descrizione dell'accesso, già presente nella
  hero di destinazione.
- Il 2026-06-22, dopo chiusura della Milestone 14, la roadmap e' stata
  aggiornata: prima della vecchia Milestone 15 sulle email personalizzate
  bisogna completare Milestone 14.1 e 14.2. Milestone 14.1 consolida il flusso
  capogruppo: notifica email al capogruppo quando un partecipante viene
  attribuito al suo gruppo/scope, tabella persone attribuite, check rapido di
  conferma appartenenza, scheda su click riga, reindirizzamento dei non
  appartenenti al parent precedente o alla coda esterni/nuovi partecipanti,
  note interne e audit. Milestone 14.2 introduce tag operativi: il manager crea
  tag liberi dell'evento, il capogruppo li assegna ai partecipanti del proprio
  gruppo dalla scheda partecipante e il manager li usa come filtri nella
  tabella iscritti. Email personalizzate, programma, check-in e settori
  slittano dopo questi blocchi.
- Il 2026-07-03 e' stata inserita prima della Milestone 20 la Milestone 19.1,
  dedicata alle iscrizioni scolastiche: un docente referente gestisce
  l'iscrizione di una classe o di un gruppo a specifici momenti dell'evento,
  con controllo transazionale delle capienze, registrazioni e QR individuali
  per studenti e accompagnatori, permessi dedicati e particolare attenzione
  alla minimizzazione e protezione dei dati dei minori. I gruppi scolastici
  devono restare distinti dai gruppi territoriali esistenti.
- Il 2026-06-25 e' stata implementata la prima tranche della Milestone 14.1:
  notifica email applicativa ai capigruppo quando nasce una nuova assegnazione
  probabile da verificare, sia da iscrizione pubblica sia da rifiuto con
  risalita al parent; audit degli invii riusciti/falliti; tabella capogruppo
  con azioni rapide conferma/rifiuto; scheda partecipante in overlay da riga
  con identita', contatti, gruppo, stato assegnazione e note interne. Se un
  rifiuto non ha parent, l'assegnazione viene marcata non corrente/rifiutata e
  l'audit registra `moved_to_external_queue`.
- Il 2026-07-02 la tabella partecipanti della dashboard capogruppo e' stata
  semplificata: mostra solo partecipante, telefono, email e un interruttore di
  conferma. La colonna gruppo compare solo quando nella vista filtrata ci sono
  partecipanti di piu' gruppi. Non mostrare piu' colonne ridondanti come
  provenienza, stato iscrizione, date o pulsanti `Gestisci` nella tabella. Il
  click sui dati della riga apre la scheda iscrizione in overlay; la scheda ha
  modalita' modifica per identita' minima e contatti, piu' note/tag/decisione.
  La conferma usa `updateGroupLeaderAssignment` con intent `confirm` e
  `unconfirm`, visualizzato come switch accessibile.
- Il 2026-06-26 e' stata implementata la Milestone 14.2 sui tag operativi:
  migration `20260626100000_operational_tags.sql` con tabelle
  `operational_tags` e `participant_operational_tags`, RLS per lettura
  operativa e assegnazione da manager o capogruppo in scope, helper
  `app.can_assign_participant_tag`, audit `operational_tag.created` e
  `participant.operational_tags_updated`. Il manager crea tag liberi
  dell'evento corrente dalla sezione `Gestione iscritti`, li vede come badge e
  li usa come filtro; il capogruppo assegna/rimuove i tag dalla scheda del
  partecipante attribuito al proprio scope. I tag sono operativi interni e non
  sono mostrati al partecipante nel flusso pubblico o nella dashboard personale.
- Il 2026-07-11 e' stata aggiunta la gestione dei servizi evento:
  migration `20260711100000_event_services.sql` con catalogo
  `event_services` e assegnazione corrente `participant_event_services`.
  La lista servizi e' modificabile solo da admin/manager nella nuova sezione
  `Servizi` della dashboard operativa; il partecipante non puo' auto-assegnarsi
  un servizio, ma lo schema consente una futura preferenza con stato
  `preference_pending` da flussi notificati via email. Manager/admin e
  capogruppo in scope possono impostare `assigned`, registrare una preferenza
  da approvare o creare una `proposal_pending` alternativa. La tabella iscritti
  manager/admin e la tabella capogruppo mostrano il servizio come colonna
  separata dai tag; i tag restano marcatori operativi liberi, mentre i servizi
  sono un catalogo evento strutturato. Regola stabile: tag operativi e servizi
  non vanno confusi nella UX, nei nomi dei campi o nella comunicazione. I tag
  sono marcatori interni per casi particolari, filtri e note operative, non
  devono mai arrivare direttamente al partecipante e i campi di creazione tag
  devono evitare autocomplete/suggerimenti del browser che possano mescolare
  dati non pertinenti. I servizi sono invece assegnazioni operative strutturate:
  quando un servizio risulta assegnato/approvato deve essere visibile al
  partecipante, oltre che come colonna separata nelle tabelle manager/admin e
  capogruppo. Una futura dashboard/area servizio partecipante dovra' partire da
  `participant_event_services`, non dai tag.
  Dal 2026-07-22 il nome e la descrizione del catalogo servizi sono limitati
  rispettivamente a 40 e 160 caratteri, sia in creazione sia in modifica. I
  limiti devono essere mostrati nei form e validati anche lato server; non
  troncare silenziosamente input piu' lunghi. Questa regola non riduce il limite
  delle note operative sulle assegnazioni partecipante-servizio.
- Il 2026-07-12 e' stata completata la Milestone 15 per email personalizzate e
  template operativi. La migration
  `20260712100000_email_campaigns.sql` introduce `email_templates`, versioni
  immutabili in `email_template_versions`, campagne in `email_campaigns` e
  log per destinatario in `email_campaign_recipients`, con RLS per admin,
  manager e lettura `manager_viewer`. La composizione vive in
  `/dashboard/manager/email` ed e' raggiungibile dalle sidebar manager/admin.
  I segmenti usano evento corrente, gruppo, tag operativo e stato iscrizione;
  per chi non ha email viene usato, quando disponibile, il contatto del
  capogruppo primario come consegna delegata. Il flusso obbligatorio e'
  anteprima congelata, invio test all'operatore e pulsante di invio finale con
  dialogo di conferma che riepiloga oggetto e numero di destinatari. Nel dialogo
  finale il pulsante di conferma deve mostrare soltanto l'etichetta `Conferma`,
  senza ripetere il numero dei destinatari. Il pulsante di apertura del dialogo
  resta disabilitato fino all'invio riuscito del test e, al passaggio del
  mouse o al focus, spiega che prima e' necessario effettuare il test. Il
  controllo del test resta obbligatorio anche lato server. Durante l'invio del
  test la modale deve mostrare uno stato di avanzamento; dopo il successo deve
  mostrare al suo interno una conferma evidente con indirizzo di consegna,
  istruzioni per controllare contenuto e allegati e due percorsi espliciti:
  procedere all'invio definitivo oppure tornare alla composizione per
  correggere. Eventuali errori del test devono essere visibili nella modale,
  non soltanto nella pagina sottostante. Nell'anteprima deve
  essere sempre mostrato esplicitamente sia l'indirizzo dell'account manager a
  cui verra' inviata la prova, sia il nome del primo destinatario i cui dati
  vengono usati soltanto per compilare i campi personalizzati; chiarire che
  quest'ultimo non ricevera' la prova. Prima di oggetto e messaggio deve
  comparire una breve introduzione che chiarisce che il contenuto sottostante e'
  l'email di prova gia' compilata con i dati del partecipante campione; non
  limitarsi all'etichetta generica "Dati usati nella prova". Questa indicazione
  non deve stare nella sezione dei pulsanti di invio. Il limite iniziale era
  100 destinatari; dal 2026-07-29 e' stato rimosso e sostituito dalla coda
  globale di 300 tentativi al giorno. Ogni tranche usa concorrenza 3. Gli
  indirizzi email e i corpi personalizzati non vengono copiati nei log
  campagna; il message id del provider viene salvato solo come hash.
  L'ambiente locale puo' usare `EMAIL_DELIVERY_MODE=log` per simulare gli
  invii. Dal 2026-07-12 la console campagne riprende il pattern
  maturo dell'app modello: editor ricco TipTap con formattazione e link,
  template riutilizzabili, campi personalizzati inseribili al cursore,
  destinatari separati, cronologia delle campagne inviate e anteprima in modale.
  La cronologia deve mostrare solo campagne con invio definitivo concluso,
  riconosciute da `email_campaigns.sent_at` valorizzato: non mostrare bozze,
  anteprime congelate o campagne per cui e' stata inviata soltanto la prova.
  Gli invii definitivi parziali o non riusciti restano visibili per tracciabilita'.
  L'HTML viene
  sanificato lato server con `sanitize-html`, i valori partecipante vengono
  escapati prima dell'inserimento e viene sempre generato il fallback testo.
  Prima dell'anteprima congelata il manager puo' consultare nella pagina la
  lista nominale dei destinatari, l'indirizzo di consegna e il tipo di recapito,
  quindi includere o escludere singole persone. Le esclusioni usano lo stato
  `skipped` di `email_campaign_recipients`; ogni modifica aggiorna
  `recipient_count` mostrato nel dialogo finale e invalida l'eventuale test
  gia' inviato, che deve essere ripetuto prima dell'invio definitivo.
  Dal 2026-07-22 l'elenco dei partecipanti raggiungibili e' gia' disponibile al
  primo rendering della console campagne. I filtri cercabili per gruppo, tag
  operativo e servizio, insieme alla ricerca per nome/email, modificano solo la
  vista dell'elenco e non la selezione corrente. Dal 2026-07-29 la precedente
  sottosezione separata dei destinatari scelti e' stata sostituita dalla
  tabella unica con checkbox; l'anteprima usa sempre la selezione esplicita
  delle chiavi destinatario, indipendentemente dai filtri visivi attivi.
  Sempre dal 2026-07-22 i modelli riutilizzabili si scelgono da una modale
  aperta nel passaggio 1; la selezione chiude la modale e carica oggetto e
  messaggio nell'editor, dove restano modificabili. L'azione `Salva come
  modello` vive in fondo al passaggio 1 e apre una seconda modale che richiede
  il titolo interno del modello. Il titolo interno non e' un campo della
  campagna: nell'attivita' recente la campagna usa l'oggetto email come nome
  operativo. Quando il messaggio parte da un modello salvato, il manager puo'
  scegliere se aggiornare quel modello creando una nuova versione oppure
  salvare il contenuto come nuovo modello con un titolo interno diverso; in
  questo secondo caso il modello di partenza deve restare invariato.
  La selezione parte sempre vuota. Dal 2026-07-29 le checkbox di riga
  aggiungono o rimuovono destinatari senza azzerare ricerca o filtri; la
  checkbox di intestazione trasforma tutte le righe filtrate in una lista
  esplicita di chiavi selezionate. Il server non deve mai interpretare
  l'assenza della selezione come "seleziona tutti" e non applica un limite
  numerico alla lista esplicita.
  Dal 2026-07-23 il riquadro `Campi personalizzati` del passaggio di
  composizione non segue piu' lo scroll della pagina: su schermi ampi resta
  centrato verticalmente rispetto al form di oggetto e messaggio.
  Dal 2026-07-26 il tipo di recapito nella scelta destinatari non e'
  presentato come opzione modificabile: per l'invio normale all'indirizzo del
  partecipante non compare alcun badge; solo il recapito delegato mostra
  `Invio al referente`. I riepiloghi distinguono esplicitamente le email ai
  partecipanti da quelle ai referenti.
- Dal 2026-07-29 la scelta destinatari delle campagne usa una tabella con
  checkbox per riga e checkbox di intestazione che seleziona o deseleziona
  tutte le righe corrispondenti ai filtri correnti. Le tab `Partecipanti` e
  `Capigruppo` sono audience alternative e non vanno mescolate nella stessa
  campagna; passando da una tab all'altra la selezione viene azzerata. La tab
  partecipanti comprende anche chi non ha gruppo e offre il filtro
  `Solo senza gruppo`; la tab capigruppo deduplica la persona anche quando ha
  membership su piu' gruppi.
- Dal 2026-07-29 non esiste piu' il limite applicativo o database di 100
  destinatari scelti. L'invio definitivo riserva una coda globale, condivisa
  tra campagne, di massimo 300 tentativi al giorno nel fuso `Europe/Rome`.
  La prima tranche compatibile con la quota parte subito; le altre righe hanno
  `email_campaign_recipients.scheduled_for` e vengono elaborate dalla route
  autenticata `/api/cron/email-campaigns`, configurata ogni giorno in
  `vercel.json`. La migration
  `20260729120000_email_campaign_audiences_and_daily_queue.sql` aggiunge
  `recipient_key`, audience partecipante/capogruppo, stati di coda e indici.
  `CRON_SECRET` e' obbligatorio in produzione e non deve essere stampato o
  committato. Dal 2026-08-13 la migration risulta applicata e registrata sul
  Supabase remoto di produzione; colonne, funzioni di coda e cache PostgREST
  sono state verificate. `CRON_SECRET` non risultava ancora configurato su
  Vercel al termine dell'implementazione locale del 2026-07-29 e va verificato
  separatamente prima di affidare gli invii differiti al cron.
  Dal 2026-08-13 le API di campagne e modelli email non mostrano piu' agli
  operatori i dettagli grezzi di Supabase, PostgreSQL o SMTP. Gli errori
  infrastrutturali vengono registrati nei log server e restituiti con un testo
  comprensibile e specifico per destinatari, anteprima, prova o invio finale;
  i messaggi di validazione utili all'operatore restano invece espliciti.
- Quando saranno implementati programma e iscrizioni ai panel, la tabella
  destinatari delle campagne dovra' aggiungere un filtro per uno specifico
  panel. Usare le tabelle canoniche delle iscrizioni ai momenti/panel; non
  modellare i panel come tag operativi e non duplicarli nello snapshot della
  campagna.
- Dal 2026-09-23 `manager` e `manager_viewer` possono passare tra dashboard
  manager e Iscrizione e QR personale con lo stesso account. La precedente
  esclusione dell'area personale del 23 luglio è superata. Le altre dashboard
  sono disponibili quando corrispondono a un ulteriore ruolo assegnato;
  Admin conserva tutte le aree delegate.
  Manager Viewer ha soltanto Statistiche e Gestione iscritti nel menu operativo.
- Dal 2026-07-26 la sessione autenticata viene ripristinata anche entrando da
  home o login: l'utente viene riportato all'ultima dashboard e, per
  admin/manager, all'ultima sezione stabile del menu consultata. Parametri
  transitori di modali, filtri e schede non vengono memorizzati. L'attivita'
  viene aggiornata durante l'uso delle dashboard e, dopo 24 ore complete senza
  interazioni, la sessione viene chiusa automaticamente; il logout manuale
  cancella anche lo stato di ripristino.
- Il 2026-07-27 e' stato completato un audit prestazionale conservativo,
  documentato in `docs/performance-optimization-2026-07-27.md`. Il client
  Supabase service-role e il transporter SMTP sono lazy singleton per singola
  istanza; il rate limiter in memoria elimina periodicamente soltanto i bucket
  scaduti; le richieste indipendenti di dashboard capogruppo e campagne email
  partono in parallelo; admin e manager non caricano piu' snapshot e
  statistiche non usati dalla sezione attiva. Queste ottimizzazioni non
  cambiano UI, route, API, RLS o schema dati. Il pool SMTP e' configurabile con
  `SMTP_POOL`, `SMTP_MAX_CONNECTIONS` (1-10, default 5) e
  `SMTP_MAX_MESSAGES` (1-1000, default 100). Il comando
  `npm run performance:http` esegue un benchmark GET locale configurabile con
  env `PERF_*`; non puntarlo alla produzione con concorrenza elevata senza
  autorizzazione. Il rate limiter resta locale all'istanza e non va considerato
  una protezione globale in ambiente serverless multiistanza.
  Nodemailer e' stato aggiornato alla serie 9 per correggere la vulnerabilità
  segnalata dall'audit. Dal 2026-07-20 le campagne supportano fino a 5 file,
  massimo 5 MB ciascuno e 10 MB complessivi, conservati nel bucket Supabase
  Storage privato `email-campaign-attachments` e descritti dalla tabella RLS
  `email_campaign_attachments`. Sono ammessi documenti comuni e immagini
  JPEG/PNG/GIF/WebP; le immagini possono essere allegate normalmente oppure
  mostrate nel corpo dell'email tramite CID, senza URL pubblici. Migration:
  `20260720190000_email_campaign_attachments.sql`.
- Il 2026-06-17, dopo una verifica completa seguita al cambio titolo evento,
  non sono emersi conflitti sui flussi di iscrizione, attribuzione gruppo e
  gestione manager. La migration di identità evento mantiene lo slug tecnico
  `assisi-2026-test` e aggiorna solo titolo/città/paese visibili. La tabella
  iscritti admin/manager e' stata ulteriormente ripulita: niente filtro ruolo,
  niente colonna ruolo, niente calcolo ruoli non usato; i dettagli iscrizione si
  aprono al primo click e la modifica resta limitata al gruppo corrente con
  secondo click esplicito. La gestione capigruppo resta nella sezione `Gruppi`,
  azione `Capogruppo`, tramite `group_memberships`.
- Il 2026-06-16 e' stata rifinita la navigazione delle dashboard operative:
  tab condivise fra dashboard admin/manager/accoglienza/capogruppo e area
  personale, logout globale, rimozione della card "La mia iscrizione" dalle
  dashboard operative e gestione admin/capogruppo dal modale admin.
- Il 2026-06-17 e' stato popolato l'albero gruppi operativo per l'evento
  Assisi 2026
  a partire dai paesi/città dell'app modello: nodi paese/città, 26 aree Roma,
  città italiane aggiunte Monterotondo/Tivoli/Sezze, regole matching e
  referenti principali iniziali per Universitari, Giovani per la pace scuole
  superiori e Giovani per la pace scuole medie.
- Il 2026-06-15 e' stata anticipata la generazione QR reale: le nuove
  iscrizioni generano un QR code reale, inviato nella email di conferma e
  visualizzato nella dashboard partecipante.
- Il 2026-07-02 la presenza prevista e' stata portata da giorni interi a fasce
  mattina/pomeriggio: la tabella `event_attendance_choices` ha `day_part`
  (`morning`/`afternoon`), il form pubblico e l'inserimento manuale capogruppo
  mostrano una griglia con colonne 24, 25, 26 e 27 ottobre e righe mattina/
  pomeriggio, senza scelta per la mattina del 24. Il 24 ottobre serve solo per
  segnalare chi arriva il pomeriggio precedente ed e' gia' in localita'.
  Migration applicata: `20260702100000_attendance_half_day_slots.sql`.
- Dal 2026-07-02, se nel form pubblico la persona risponde "No" alla domanda
  sulla partecipazione precedente ad attivita' Sant'Egidio, compare un campo
  libero opzionale "Fai parte di qualche gruppo o associazione?". Il dato non
  blocca l'iscrizione e viene salvato solo nello snapshot questionario come
  `externalGroupAssociation`.
- Dal 2026-07-20 il selettore gruppo/referente del form pubblico mostra solo i
  suggerimenti coerenti con citta' ed eta' che appartengono a nodi operativi di
  tipo `area` o `group`. I nodi `country` e `city` non devono comparire nella
  lista: restano disponibili solo al matching interno per ricondurre la persona
  al gruppo piu' probabile. Un link riservato continua a preselezionare il gruppo
  specifico collegato al token anche quando non appartiene al catalogo pubblico.
- Dal 2026-07-27 il filtro anagrafico dei gruppi usa
  `groups.age_brackets`, array composto da zero o piu' valori tra `giovani`,
  `adulti` e `anziani`. Le modali admin/manager di creazione e modifica gruppo
  mostrano tre checkbox indipendenti; array vuoto significa nessun filtro di
  eta'. Il matching calcola l'eta' alla data iniziale dell'evento: giovani fino
  ai 30 anni, adulti dai 23 ai 65 anni (con la sovrapposizione giovani/adulti
  gia' prevista tra 23 e 30), anziani oltre i 65 anni. La migration
  `20260727120000_group_age_bands.sql` conserva la copertura dei dati
  precedenti trasformando `adulti` in `adulti + anziani`, `both` in tutte e tre
  le fasce, `giovani` in solo giovani e `none` in array vuoto. Il precedente
  `groups.age_bracket` resta solo come dato legacy e non deve essere usato dalle
  nuove funzioni.
- Il 2026-07-27 il catalogo gruppi dell'evento corrente e' stato sostituito
  integralmente a partire dal materiale operativo
  `materiali-dati/Gruppi_iscrizioni.xlsx` (cartella ignorata da Git). Il
  database contiene 105 gruppi assegnabili piu' i tre nodi territoriali di
  supporto `Italia`, `Roma` e `Spagna`: 55 gruppi sono figli di Roma, 33 sono
  figli diretti dell'Italia, Madrid e Barcellona sono figli della Spagna e gli
  altri 15 gruppi esteri sono al livello radice. Nove gruppi sono attivi e
  assegnabili ma nascosti dal catalogo pubblico; restano utilizzabili tramite
  link riservato. Le fasce eta' dell'Excel sono state trasferite senza
  approssimazioni in `groups.age_brackets`; le righe senza fascia hanno array
  vuoto e quindi sono valide per ogni eta'.
- Lo stesso import del 2026-07-27 ha creato o riutilizzato 98 identita'
  referente e 118 associazioni in `group_memberships`. Tutti i referenti
  elencati per uno stesso gruppo sono primari: la migration
  `20260727195000_multiple_primary_group_leaders.sql` rimuove il precedente
  indice univoco per gruppo e le azioni operative non retrocedono piu'
  automaticamente gli altri primari quando ne viene aggiunto uno. Il campo
  singolare `groups.primary_leader_name` resta un'etichetta rappresentativa e
  contiene il primo referente indicato nel file; accessi e notifiche usano
  invece tutte le membership. Il secondo foglio del file ha fornito 24 righe
  telefoniche, consolidate in 21 contatti unici per email.
- Durante la sostituzione del catalogo sono stati rimossi gli 85 gruppi
  precedenti e, per cascata, 43 assegnazioni partecipante-gruppo, i vecchi link
  riservati e le regole di matching collegate. Le 40 iscrizioni e i relativi
  partecipanti sono stati conservati senza assegnazione di gruppo. Il backup
  completo precedente all'operazione e' in
  `materiali-dati/backups/iscrizioni-pace-pre-gruppi-20260727-1945.dump`
  (ignorato da Git).
- Dal 2026-08-13 i 17 gruppi anziani di Roma seguono il formato stabile
  `Anziani - Quartiere`, senza il precedente prefisso `W gli anziani`.
  `Movimento "Gli amici" - San Bartolomeo` e `Movimento "Gli amici" -
  Sant'Egidio` sono stati rinominati rispettivamente `Amici San Bartolomeo` e
  `Amici Sant'Egidio`. Il rinomino aggiorna anche `groups.public_label` e le
  etichette dei link riservati attivi, ma non ruota gli slug gia' distribuiti;
  ogni modifica e' registrata con audit action `group.renamed`.
- La regola introdotta il 2026-07-26 per lasciare senza assegnazione chi non
  selezionava esplicitamente un gruppo e' stata superata il 2026-08-24 dopo le
  prime iscrizioni operative. Una scelta esplicita resta `probable` soltanto
  nel gruppo scelto e non deve comparire nella coda da confermare dei nodi
  superiori. Chi non seleziona un gruppo viene invece assegnato `probable` al
  nodo territoriale `city` o `country` piu' vicino, con reason
  `territorial_review_queue`; per Roma la coda e' il nodo `Roma`. Un rifiuto da
  un gruppo continua a risalire al padre. Il referente del nodo territoriale
  puo' riassegnare la persona a un gruppo attivo e assegnabile del proprio
  sottoalbero, dove apparira' nuovamente come da confermare. I nodi territoriali
  non assegnabili non possono confermare una persona come appartenente al nodo:
  devono smistarla a un discendente oppure rifiutarla verso il livello superiore.
  Nella sezione `Da confermare`, l'azione apre una scheda esplicitamente
  orientata allo smistamento: mostra il motivo dell'assegnazione al livello
  corrente, colloca subito accanto il selettore dei gruppi discendenti e indica
  dinamicamente il nodo padre reale a cui la persona risalira' scegliendo
  `Non riconosciuto`. I testi non devono codificare esempi come Roma/Italia:
  devono usare i nomi dei nodi effettivi dell'albero. Nella tabella pending non
  mostrare `Non riconosciuto`: la riga usa l'azione non spezzabile
  `Vedi dettagli e assegna`. Dentro la scheda, assegnazione a un discendente e
  `Non riconosciuto` devono stare nello stesso blocco decisionale, contigui e
  separati visivamente da `Oppure`, per risultare alternative reciproche.
  La migration `20260824193000_territorial_group_review_queue.sql` riallinea le
  iscrizioni esistenti che non hanno mai avuto alcuna assegnazione; la migration
  storica `20260726120000_stop_unselected_group_auto_assignment.sql` resta
  versionata ma non descrive piu' il comportamento corrente.
- Dal 2026-07-28 gruppo attribuito e referente sono informazioni esclusivamente
  operative e non devono essere mostrati nella dashboard partecipante, ne'
  sotto il nome ne' nel riepilogo dell'iscrizione. Nel riepilogo personale il
  servizio compare soltanto quando esiste un'assegnazione con stato `assigned`;
  in assenza di assegnazione non mostrare il campo. I panel scelti non vanno
  duplicati nel riepilogo: devono comparire soltanto nella sezione dedicata
  `Panel a cui sei iscritto`.
- Dal 2026-08-04 la sezione `Statistiche` delle dashboard admin e manager usa
  tabelle condivise, cercabili, filtrabili e rigorosamente read-only al posto
  dei soli riepiloghi aggregati. Le tre viste separano territorio/gruppo,
  presenze per fascia mattina-pomeriggio ed eta'; ogni riga rappresenta una
  persona e i minori accompagnati sono righe distinte che ereditano i dati
  dell'iscrizione familiare. L'eta' e' calcolata all'inizio dell'evento e usa
  le fasce operative `0-14`, `15-30`, `30-65`, `65+`; per evitare duplicati ai
  confini, 30 anni appartiene a `15-30` e 65 anni a `65+`. Sopra le tabelle
  resta disponibile anche una vista riassuntiva con persone complessive,
  partecipanti, minori accompagnati, fasce d'eta', presenze e territori/gruppi
  piu' rappresentati. I valori aggregati selezionabili applicano il filtro alla
  tabella corrispondente, cosi' il manager puo' verificare subito le persone che
  compongono ogni conteggio senza introdurre azioni sui dati. Dal 2026-08-05
  riepiloghi e tabelle sono organizzati in coppie consecutive: riepilogo
  territorio/gruppo seguito dalla relativa tabella, riepilogo presenze seguito
  dalla tabella presenze e riepilogo eta' seguito dalla tabella eta'. Ogni nuovo
  report futuro deve mantenere lo stesso blocco autonomo `riepilogo + tabella`;
  non raggruppare prima tutti i riepiloghi e poi tutte le tabelle. Ogni coppia
  usa il componente condiviso `ReportBlock`, con intestazione `Report`, bordo
  rinforzato, barra laterale blu, fondo azzurro e spazio esterno maggiore, per
  separare graficamente un report dal successivo senza allontanare riepilogo e
  tabella che appartengono allo stesso insieme.
- Dal 2026-08-04 la dashboard partecipante espone l'azione per contattare gli
  organizzatori in una card di assistenza autonoma sotto il QR, separata dal
  riepilogo dell'iscrizione e introdotta da un breve testo di supporto. Il form
  invia al server soltanto il
  testo scritto dal partecipante; destinatario, oggetto e riepilogo vengono
  costruiti esclusivamente lato server dopo la verifica della sessione. Il
  destinatario fisso e' `registrationspeace@santegidio.org`, l'oggetto e'
  `Participant Message - Nome Cognome` e il corpo aggiunge nome, cognome,
  gruppo operativo corrente, codice partecipante e mail. Il messaggio e'
  limitato a 4.000 caratteri e protetto dal rate limiter. Gli audit
  `email.participant_message_sent` e `email.participant_message_failed`
  registrano solo metadati operativi e lunghezza, mai il testo del messaggio.
  Nell'email ricevuta dall'organizzazione i cinque dati identificativi usano
  righe compatte `etichetta: valore`, senza il rientro predefinito di `dl/dd`;
  le etichette principali restano in grassetto e l'indirizzo email e'
  cliccabile.
  Dopo un invio riuscito, la modale conferma che gli organizzatori hanno
  ricevuto il messaggio e che risponderanno al piu' presto; resta leggibile per
  3,5 secondi, poi scompare con una breve animazione e torna automaticamente
  alla dashboard partecipante. La preferenza di riduzione del movimento deve
  essere rispettata.
- Dal 2026-07-28 la sidebar della dashboard manager parte sempre in modalita'
  compatta: soltanto `nav=full` la espande esplicitamente. Il pulsante della
  sidebar puo' espanderla nella sezione corrente, ma ogni voce di navigazione
  verso una sezione manager deve impostare `nav=mini`, cosi' il nuovo menu si
  apre con la barra nuovamente chiusa. Filtri, modali e azioni interne alla
  stessa sezione continuano invece a preservare la modalita' corrente.
- Dal 2026-07-29 gli aggiornamenti dei filtri nella tabella gruppi di admin e
  manager non disabilitano il form e non sovrappongono un overlay bloccante:
  durante la navigazione la ricerca resta digitabile e puo' raccogliere subito
  il filtro successivo. Resta il debounce generale di 450 ms per i campi
  testuali; i filtri a scelta continuano ad applicarsi immediatamente.
- Dal 2026-08-01 anche la tabella condivisa `Gestione iscritti` di admin e
  manager mantiene campi e tabella interattivi durante l'aggiornamento dei
  risultati, senza overlay opaco o fieldset disabilitato. Per i campi testuali
  usa un debounce dedicato di 900 ms, così la ricerca parte soltanto dopo una
  pausa reale nella digitazione; i menu a scelta restano immediati.
- Dal 2026-07-28 ogni gruppo puo' avere un solo link riservato complessivo, non
  un solo link attivo alla volta. Dopo la prima creazione il comando di
  generazione non deve piu' comparire e il server deve rifiutare ulteriori
  creazioni. Il link non e' revocabile dalle dashboard o dalle Server Action,
  per evitare che un errore operativo lasci il gruppo senza un link
  utilizzabile e senza possibilita' di sostituzione. La
  migration `20260728120000_single_group_registration_link.sql` conserva come
  canonico un solo link per gruppo, revoca eventuali duplicati preesistenti
  mantenendoli come storico non canonico e impone l'unicita' per le nuove
  creazioni.
- Dal 2026-07-28, dopo la creazione, la modale link deve caricare e mostrare
  sempre il link canonico anche se revocato: URL copiabile quando disponibile,
  stato operativo e conteggio utilizzi. Il nome pubblico del link viene
  proposto inizialmente dal nome o dalla label pubblica del gruppo, ma resta
  modificabile senza cambiare token o URL. Nella scheda del link il campo URL e
  `Copia link` devono stare sulla stessa riga quando lo spazio lo consente; non
  mostrare `Revoca`. Le query manager, admin e capogruppo filtrano
  `is_canonical = true` ma non
  `revoked_at is null`; gli errori di caricamento devono essere registrati lato
  server e non scambiati silenziosamente per una lista vuota. La migration
  `20260728120000_single_group_registration_link.sql` e' stata applicata al
  database remoto il 2026-07-28. Dal 2026-07-29 i nuovi token generati
  dall'app sono slug leggibili derivati dal nome pubblico del link, allineati
  a quelli creati durante l'importazione gruppi; eventuali omonimie ricevono
  un suffisso numerico. La migration
  `20260728150000_prevent_canonical_group_link_revocation.sql` impone anche nel
  database che il link canonico non possa essere revocato.
- Dal 2026-07-28 il form pubblico, l'inserimento manuale del capogruppo e la
  dashboard personale supportano la partecipazione con un massimo di 10 figli.
  Nel modulo capogruppo la domanda e' proposta prima dell'accessibilita', parte
  da `No` e usa la stessa validazione server del form pubblico. I figli sono salvati in
  `registration_children` con nome, cognome, data di nascita e posizione,
  collegati alla singola iscrizione del genitore. Non hanno account, contatto,
  consenso, assegnazione gruppo o QR autonomi: ereditano evento, stato,
  gruppo, fasce di presenza, panel e check-in dall'iscrizione collegata. Il QR
  del genitore vale quindi per tutto il nucleo registrato. Nei conteggi di
  persone per evento, paese, citta', gruppo e presenza ogni iscrizione vale
  `1 + numero figli`; gli indicatori di anomalia operativa come QR mancante,
  email mancante o assegnazione da verificare restano invece riferiti alla
  singola iscrizione. Admin, manager e capogruppo vedono i figli nella scheda
  dell'iscrizione; il partecipante puo' aggiungerli, modificarli o rimuoverli
  finche' la finestra di modifica e' aperta. Migration:
  `20260728180000_registration_children.sql`. La privacy version corrente e'
  `2026-07-28-accompanying-children` e il consenso dichiara anche l'autorita' a
  comunicare i dati dei figli.
- Dal 2026-07-20 la sezione privacy del form pubblico include un consenso
  facoltativo, separato e non preselezionato per ricevere comunicazioni su
  eventi e iniziative future della Comunita' di Sant'Egidio. L'iscrizione deve
  restare completabile senza tale consenso. `participant_consents` registra
  l'esito e, solo in caso positivo, data e versione del testo; gli inserimenti
  manuali del capogruppo non possono attribuire questo consenso alla persona.
- Il 2026-06-18 la production pubblica e' stata spostata sul dominio definitivo
  `https://registrationspeace.santegidio.org`: le env Vercel production
  `NEXT_PUBLIC_APP_URL`, `APP_URL` e `PUBLIC_SITE_URL` puntano a quel dominio,
  `GOTRUE_URI_ALLOW_LIST` del Supabase Auth self-hosted lo include, e i magic
  link generati per l'ambiente online devono usare quel dominio.
- Il 2026-06-18 la maschera admin/manager per creare o modificare gruppi e'
  stata semplificata: niente selezione evento visibile, niente distinzione tra
  nome operativo e label pubblica, niente ordine pubblico modificabile
  dall'utente. La posizione nell'albero si sceglie con un flusso guidato:
  nuovo paese, nuova citta' sotto un paese esistente, nuova area sotto una
  citta' esistente. Il referente principale si sceglie tra i capigruppo gia'
  presenti oppure si crea nella stessa maschera con nome, cognome ed email; il
  salvataggio aggiorna anche `group_memberships` come capogruppo primario.
- Regola UX stabile: quando un selettore ha piu' di 15 opzioni non usare una
  tendina nativa semplice; usare un controllo cercabile con filtro testuale e
  selezione esplicita. Questa regola vale in particolare per paesi, citta',
  gruppi, partecipanti, referenti e altri elenchi operativi lunghi.
- Regola UX stabile: nei testi rivolti a manager, admin e operatori evitare
  etichette tecniche come "albero gruppi". Quando si descrive la struttura
  paese -> citta' -> gruppo, usare formulazioni comprensibili come
  "territori e gruppi", "paesi, citta' e gruppi" o "Partecipanti per
  territorio e gruppi", mantenendo "albero gruppi" solo in documentazione
  tecnica o commenti interni quando necessario.
- Regola UX stabile: le modali aperte da dashboard operative tramite link o
  query string devono preservare il contesto di scroll della pagina sottostante.
  In Next `Link` usare `scroll={false}` per apertura e chiusura delle modali
  quando l'utente sta lavorando su liste/tabelle. Anche i submit riusciti da
  modale che chiudono via redirect server action devono ripristinare lo scroll
  precedente. Pattern corrente: montare
  `app/dashboard/preserve-dashboard-scroll.tsx` nella dashboard interessata e
  aggiungere `data-preserve-dashboard-scroll` alle form modali che salvano,
  generano, revocano o assegnano dati. Ogni nuova form modale nelle dashboard
  operative deve seguire questo pattern, cosi' l'utente non viene riportato in
  cima pagina mentre modifica piu' righe consecutive.
- Regola UX stabile: quando una modale dashboard e' aperta, la pagina
  sottostante non deve scorrere né ricevere lo scroll quando l'utente arriva a
  inizio/fine dello scroll interno. Ogni overlay modale dashboard deve avere la
  classe `dashboard-modal`, che attiva il blocco scroll globale in
  `app/globals.css`; lo scroll deve restare confinato al contenuto della
  modale finché l'utente chiude o salva. Dal 2026-07-26 lo stesso guardrail
  assegna al pannello diretto una `max-height` basata su `100dvh` e
  `overflow-y: auto`: tutte le modali che superano lo spazio disponibile
  devono quindi essere interamente percorribili sia da desktop sia da mobile.
  Il pannello diretto e' il confine principale dello scroll e usa
  `touch-action: pan-y` con inerzia WebKit; eventuali aree interne
  `overflow-y-auto` devono lasciare `overscroll-behavior: auto`, cosi' il gesto
  di trackpad o touch passa al pannello principale quando l'area interna non
  puo' scorrere. Solo il pannello principale contiene l'overscroll per evitare
  che raggiunga la pagina sottostante.
  Non sovrascrivere questa regola con `overflow-hidden` su un pannello privo di
  un contenitore interno realmente ridimensionabile e scrollabile.
- Dal 2026-06-24 il multievento e' trattato come archivio storico, non come
  gestione di eventi contemporanei. La tabella `events` ha il flag
  `is_current`, unico tramite indice parziale, che identifica l'evento corrente
  operativo. Admin puo' cambiarlo dalla sezione `Evento`; manager, capogruppi e
  partecipanti non scelgono l'evento e vedono/creano solo dati legati
  all'evento corrente. La stessa sezione admin permette di creare eventi futuri
  in bozza, non correnti, con dati minimi di identita' e finestre iscrizioni.
  Nelle tabelle operative non mostrare colonne evento ridondanti. Migration:
  `20260624100000_current_operational_event.sql`.
- Branch predefinito per tutte le modifiche: `main`, sempre riallineato a
  `origin/main`. Il branch `codex/panel-p0-p10` deve restare disponibile per lo
  staging e si usa solo su indicazione esplicita dell'utente. Non creare
  autonomamente altri branch o worktree.
- Remote `origin` configurato:
  `https://github.com/giovaniperlapace/iscrizioni-pace`.
- Per verificare l'ultimo commit/push noto su `main`, usare
  `git log -1 --oneline origin/main` dopo `git fetch` o dopo un push riuscito.

Prima di ogni feature verificare:

- `pwd`.
- `git status --short`.
- `git branch --show-current`.
- `git remote -v`, quando serve verificare GitHub.
- Quando l'utente chiede di scrivere codice, prima di modificare file eseguire
  sempre `git fetch origin` e verificare l'allineamento con
  `git status --short --branch` o comando equivalente. Se il branch locale e'
  indietro rispetto a `origin/main`, riallineare prima con GitHub oppure
  avvisare esplicitamente l'utente se ci sono modifiche locali/conflitti da
  gestire. Non iniziare nuove modifiche codice su una base non allineata senza
  averlo segnalato.


## Form e minimizzazione accessibilità — 2026-09-05

- I form operativi usano `components/reliable-form.tsx`: invio esplicito senza
  reset React in caso di errore, valori mantenuti in memoria nella modale,
  messaggi accanto ai campi con `aria-invalid`/`aria-describedby`, focus al
  primo campo non valido nell'ordine del form e blocco del doppio invio.
- Le azioni dashboard restituiscono `FormFailure` per errori di validazione o
  salvataggio; i redirect restano per successo e autenticazione. L'adattatore
  `lib/forms/result.ts` converte i codici storici in errori localizzati e non
  espone dettagli infrastrutturali. Le route POST delle schede operative
  supportano la stessa risposta quando il client richiede JSON.
- Non introdurre nuovi form in overlay che reindirizzino in caso di errore.
  Usare `ReliableForm` e restituire problemi con campo/codice; non salvare
  bozze operative in localStorage, sessionStorage o URL.
- Telefono facoltativo ma internazionale quando presente: `+` seguito da
  7–15 cifre, con spazi e separatori normalizzati. L'inserimento capogruppo
  richiede almeno email o telefono. Email, nomi e date sono verificati anche
  sul server; le fasce dell'evento sono verificate prima di creare la persona.
- Il capogruppo raccoglie solo le tre opzioni strutturate di accessibilità,
  con follow-up condizionale. La richiesta separata di ricontatto non viene
  più raccolta. Il partecipante conserva la propria richiesta di supporto.
- Il testo libero relativo all'accessibilità non viene più raccolto,
  visualizzato, inviato o salvato in alcun flusso. Le bozze pubbliche del
  formato precedente vengono migrate nel browser eliminando soltanto il
  valore ritirato e conservando gli altri campi.
- Versione della tranche accessibilità: `2026-09-05-accessibility-minimization`; le versioni
  storiche conservano il loro identificativo e sono state ripulite.
- Migration verificata su PostgreSQL locale e applicata in produzione il
  2026-09-05 dopo il deployment del codice compatibile:
  `20260905120000_minimize_accessibility_data.sql`. Rimuove la colonna ritirata,
  pulisce ricorsivamente snapshot e audit, azzera il vecchio flag manuale e
  impedisce nuovi snapshot con proprietà di accessibilità fuori contratto.
  Non modifica RLS o le note interne di gruppi/servizi. Verifica remota:
  colonna ritirata assente, 68 snapshot ripuliti, nessuna proprietà ritirata
  negli audit, richiesta personale di supporto conservata, PostgREST HTTP 200.
- Stato remoto e procedura di rilascio: `docs/form-reliability-accessibility.md`.
  La migration va applicata dopo il deploy del codice compatibile, su ambiente
  concordato; la pulizia è irreversibile e non va sostituita da un backup di
  dati sensibili nel repository.
- Regressioni: `tests/forms-reliability.test.mts`,
  `tests/browser/forms-reliability.mjs`, `tests/sql/accessibility-minimization.sql`.

## Milestone 0 - discovery

Discovery repository e app modello completata in:

- `docs/model-app-discovery.md`.

Risultati:

- La cartella iniziale non era una working copy Git.
- Anche la cartella locale `modello_app` non risulta una working copy Git, quindi va usata solo come riferimento read-only.
- Non importare automaticamente codice o migration dall'app modello: riusare solo pattern dopo review.

## Milestone 1 - setup progetto

Setup tecnico iniziale completato in questa cartella.

Stack installato:

- Next.js 16 App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS 4.
- ESLint.
- Supabase: `@supabase/ssr` e `@supabase/supabase-js`.

Comandi disponibili:

- `npm run dev`.
- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- `npm run performance:http`.
- `npm run opening:verify`.
- `npm run opening:verify:production`.

File di setup rilevanti:

- `app/layout.tsx`.
- `app/page.tsx`.
- `app/globals.css`.
- `lib/supabase/client.ts`.
- `lib/supabase/server.ts`.
- `lib/supabase/service.ts`.
- `.env.example`.
- `docs/setup.md`.
- `docs/workflow.md`.

Note:

- `.env.local` resta non tracciato.
- `.env.example` contiene solo placeholder e URL pubblico previsto, senza segreti.
- Non sono state create migration e non e' stato collegato alcun database reale.

## Milestone 2 - qualità e documentazione operativa

Guardrail iniziali completati in questa cartella.

Deliverable:

- Script `test` aggiunto in `package.json`.
- Test runner minimo basato sul runner nativo di Node.
- Smoke test in `tests/smoke.test.mts`.
- Workflow operativo documentato in `docs/workflow.md`.
- README e documentazione setup aggiornati con il comando `npm test`.

Comandi standard da usare prima di chiudere milestone future:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

Note:

- `npm test` esegue `node --test tests/*.test.mts`.
- `npm run opening:verify` controlla la presenza delle env richieste per
  l'apertura pubblica usando `.env.local`, senza stampare valori segreti.
- `npm run opening:verify:production` usa `.env.production.local` e verifica
  anche che gli URL app puntino a `https://registrationspeace.santegidio.org`.
- Il runner e' volutamente leggero: per ora serve per test di funzioni pure e smoke test.
- Non sono state introdotte dipendenze test esterne.
- Non sono state create migration e non e' stato collegato alcun database reale.

## Milestone 3 - schema database iniziale e RLS

Schema iniziale e RLS completati come migration versionata e applicati al Supabase self-hosted Hetzner/Coolify.

Deliverable:

- Migration `supabase/migrations/20260613120000_initial_schema_and_rls.sql`.
- Guida operativa `docs/supabase-workflow.md`.

Schema iniziale creato:

- Eventi e programma: `events`, `event_locations`, `event_moments`.
- Profili e ruoli: `profiles`, `event_user_roles`.
- Liste territoriali: `countries`, `cities`.
- Gruppi e capigruppo: `groups`, `group_memberships`.
- Persone e iscrizioni: `participants`, `registrations`, `participant_contacts`, `participant_consents`.
- Dati sensibili di accessibilità: `accessibility_needs`.
- Assegnazioni e presenze: `participant_group_assignments`, `event_attendance_choices`, `moment_attendance_choices`.
- QR e accoglienza: `qr_tokens`, `check_ins`.
- Audit: `audit_logs`.

Decisioni RLS iniziali:

- I cataloghi necessari al form pubblico (`events` pubblicati, luoghi/momenti pubblici, paesi/città attivi, gruppi attivi) sono leggibili senza esporre dati personali.
- I dati personali sono leggibili solo da proprietario, manager/admin in scope evento o capogruppo in scope gruppo.
- I dati di accessibilità restano più stretti: proprietario e manager/admin, non accoglienza diretta.
- Accoglienza può operare su QR/check-in in scope evento, ma non leggere contatti o dati sensibili completi.
- `manager_viewer` legge dati operativi in scope ma non gestisce registrazioni.
- `admin` e' ruolo globale con `event_id` nullo in `event_user_roles`; gli altri ruoli hanno sempre scope evento.
- Intenzione prodotto aggiornata: `admin` e `manager` condividono la gestione
  dei dati operativi dell'evento corrente, ma il governo del ciclo evento e'
  riservato all'admin. Solo l'admin puo' creare eventi futuri, rendere corrente
  un evento, aprire, sospendere o nascondere le iscrizioni e
  assegnare/promuovere il ruolo `manager` a persone gia' iscritte.
- Le funzioni helper RLS vivono nello schema `app` e sono `security definer`.

Applicazione su Hetzner/Coolify:

- Server: `91.99.81.31`, accesso SSH verificato il 2026-10-21 come `root` con chiave locale `~/.ssh/id_ed25519` (il precedente percorso `~/.ssh/id_ed25519_hetzner_20260613` non esiste su questo Mac).
- Progetto Coolify: `iscrizioni_pace_cool`.
- Servizio Coolify: `supabase-ammnuajlmd83t94cfy3us6cw`.
- Network Docker Supabase: `ammnuajlmd83t94cfy3us6cw`.
- Container database: `supabase-db-ammnuajlmd83t94cfy3us6cw`.
- La Supabase CLI `2.106.0` e' stata installata sul server in `/usr/local/bin/supabase`.
- La CLI raggiunge il DB interno ma fallisce con TLS verso Postgres self-hosted; la migration e' stata applicata con `psql` dentro il container database.
- La versione e' registrata in `supabase_migrations.schema_migrations` come `20260613120000:initial_schema_and_rls`.

Procedura storica per migration su questo Supabase self-hosted:

- Creare una nuova migration versionata in `supabase/migrations/<timestamp>_<nome>.sql`.
- Verificare staticamente il diff SQL e non inserire segreti o dati personali.
- Applicare la migration con:

Dal 2026-08-05 lo script non accetta piu' un target implicito e non contiene
fallback verso production:

```bash
npm run db:migrate:staging -- supabase/migrations/<timestamp>_<nome>.sql
npm run db:migrate:production -- supabase/migrations/<timestamp>_<nome>.sql \
  --confirm-production <timestamp>
```

- Staging legge soltanto `.env.staging.local`; production legge soltanto
  `.env.production.local`.
- Entrambi richiedono `DEPLOYMENT_ENVIRONMENT` coerente, host SSH, path chiave
  assoluto, stack e container espliciti. Staging rifiuta il container
  production noto.
- Il comando production richiede inoltre la conferma con la versione esatta
  della migration. Per il ciclo panel P0-P16 richiede il collaudo complessivo
  e una richiesta esplicita di rilascio; il rilascio è attualmente rinviato.
- Lo script copia il file SQL sul server, lo applica con `psql` nel container
  selezionato, registra la versione e invia `notify pgrst, 'reload schema'`.
- Non usare `supabase db push` su questo ambiente finché la connessione CLI verso il Postgres interno continua a fallire con TLS.

Verifiche eseguite dopo applicazione:

- 20 tabelle pubbliche attese create.
- 20 tabelle pubbliche con RLS attivo.
- 45 policy RLS presenti.
- 13 funzioni nello schema `app`.
- `notify pgrst, 'reload schema'` eseguito.
- REST API verificata con anon key su `events` e `countries`, risposta `200` con array vuoto.

Note:

- `lib/database.types.ts` non e' stato ancora generato; farlo in una milestone dedicata con accesso DB stabilizzato.
- La verifica RLS con utenti reali per ruolo resta da fare: partecipante, capogruppo, manager, manager_viewer, admin e accoglienza.
- `.env.local` e' stato creato localmente in questo progetto con URL/chiavi Supabase e dettagli SSH, resta non tracciato.

## Milestone 4 - Supabase client/server e autenticazione base

Autenticazione base completata in app, senza ancora implementare il form pubblico email-prima o l'invio applicativo dei magic link.

Deliverable:

- Client Supabase browser/server/service confermati in `lib/supabase/*`.
- Callback auth server-side in `app/auth/callback/route.ts`.
- Helper ruoli e redirect in `lib/auth/roles.ts` e `lib/auth/session.ts`.
- Protezione dashboard in `proxy.ts`.
- Pagina `app/login/page.tsx` per errori/redirect di sessione.
- Prime dashboard protette in `app/dashboard/*`; i placeholder iniziali sono
  stati progressivamente sostituiti dalle dashboard operative e dalla
  navigazione condivisa a tab.
- Test di funzioni pure in `tests/auth-roles.test.mts`.

Decisioni:

- In Next.js 16.2.9 usare `proxy.ts` per la protezione route; `middleware.ts` e' deprecato.
- `manager_viewer` condivide la route `/dashboard/manager`; la UI deve restare
  read-only per questo ruolo e nascondere/disabilitare le azioni modificative.
- `partecipante` non e' nell'enum database `app_role`: e' una destinazione applicativa di default per utenti autenticati/proprietari di iscrizioni.
- Il callback supporta `code`, `token_hash` e `token` con tipi OTP Supabase noti.
- Al callback viene fatto `upsert` del profilo applicativo in `profiles` usando la sessione utente e RLS ordinaria, non service role.
- Il cookie `iscrizioni_requested_role` può ricordare una dashboard richiesta per utenti con più ruoli.
- La protezione dashboard legge `event_user_roles` via client server con anon key e RLS; non usa service role nei flussi utente ordinari.
- Dal lavoro di Milestone 7, il ruolo applicativo `capogruppo` viene scoperto
  anche da `group_memberships` collegate ai nodi dell'albero gruppi, non solo da
  `event_user_roles`. Questo permette referenti paese/città/area/gruppo senza
  creare ruoli separati per ogni livello.

Note operative:

- I callback URL Supabase devono includere `/auth/callback` sugli ambienti autorizzati, per esempio `http://localhost:3000/auth/callback` in locale.
- La login page e' ora una pagina di errore/redirect sessione; il flusso
  email-prima, preflight email esistente, magic link e form iscrizione e'
  implementato nella home e nelle route di registrazione.
- `npm test` importa helper TypeScript reali dai test `.mts`; `tsconfig.json` abilita `allowImportingTsExtensions` per questo uso con `noEmit`.

## Milestone 5 - flusso pubblico email-prima e iscrizione iniziale

Flusso pubblico iniziale completato in app.

Deliverable:

- Home `app/page.tsx` con email-prima.
- Pagina `app/registrazione/page.tsx` per nuova iscrizione iniziale.
- Conferma `app/registrazione/conferma/page.tsx`.
- Server actions in `app/actions.ts`.
- Use case pubblico in `lib/registrations/public-flow.ts`.
- Validazione form in `lib/registrations/validation.ts`.
- Invio email SMTP in `lib/email/*`.
- QR token opaco e hash in `lib/qrcode/token.ts`, rendering QR in
  `lib/qrcode/render.ts` e cifratura server-side del token recuperabile in
  `lib/qrcode/secure-token.ts`.
- Rate limit base in memoria in `lib/security/rate-limit.ts`.
- Test di funzioni pure in `tests/registration-flow.test.mts`.

Decisioni:

- I magic link sono generati con `supabase.auth.admin.generateLink` e inviati
  dall'app via SMTP Gmail, non dal mailer interno Supabase.
- Dal 2026-06-17 i magic link applicativi costruiti con
  `data.properties.hashed_token` devono puntare a
  `/auth/callback?...&token_hash=<hash>&type=email`. Usare `type=magiclink`
  con `verifyOtp` faceva fallire il login con errore link scaduto; il callback
  mantiene un fallback da `magiclink` a `email` per eventuali link già inviati.
- L'account mittente configurato e' `registrationspeace@santegidio.org`.
- La password app resta solo in `.env.local` o nelle env del runtime; non
  deve essere stampata o committata.
- Variabili email supportate:
  `EMAIL_FROM`, `EMAIL_USER`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_POOL`, `SMTP_MAX_CONNECTIONS`, `SMTP_MAX_MESSAGES`;
  `GMAIL_APP_PASSWORD` resta alias locale supportato.
- Dopo callback magic link, i partecipanti con contatto email corrispondente
  vengono collegati a `auth.users.id` tramite service role server-side.
- Il QR code non contiene dati personali: contiene solo un token opaco.
- Dal 2026-06-15 `qr_tokens` conserva `token_hash` per verifica futura e
  `token_encrypted` per rigenerare server-side lo stesso QR in dashboard. Il
  token non va salvato in chiaro.
- Il rate limit e' volutamente basico e in memoria; per produzione serverless
  andrà sostituito o affiancato da storage condiviso.

Note operative:

- `.env.local` contiene gli alias email necessari per lo sviluppo locale.
- Il repository e' collegato a Vercel tramite `.vercel/project.json`. Se il
  link viene perso o ricreato, sincronizzare almeno `EMAIL_FROM`, `EMAIL_USER`,
  `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `APP_URL` e
  `NEXT_PUBLIC_APP_URL`.
- Supabase non necessita della password Gmail per questo flusso finché i
  magic link sono inviati dall'app.
- Il form usa liste pubbliche da `countries`, `cities`, `groups` e l'evento
  pubblicato corrente; se il database non contiene un evento `published`, la
  home mostra iscrizioni non aperte.
- I giorni di presenza mostrati nel form di iscrizione derivano da
  `events.starts_on` e `events.ends_on`, non da valori hardcoded nel componente.

## Milestone 5.5 - questionario iscrizione e utenti test

Questionario reale iniziale e bootstrap end-to-end completati in app.

Deliverable:

- Inventario versionato in `lib/questionnaire/registration.ts`.
- Documentazione in `docs/registration-questionnaire.md`.
- Migration `supabase/migrations/20260614100000_registration_questionnaire_and_test_seed.sql`.
- Tabella `registration_questionnaire_answers` per snapshot versionato di
  risposte/configurazione questionario.
- Form pubblico aggiornato con primo questionario essenziale e condizionale:
  nome, cognome, data nascita, luogo di nascita libero (paese e città),
  nazionalità cercabile da elenco mondiale, paese europeo geografico e città
  di residenza abituale, telefono opzionale, accessibilità, partecipazione
  precedente Sant'Egidio, eventuale gruppo, giorni di presenza previsti e privacy.
- Codice partecipante breve automatico in `participants.public_code`, formato
  alfanumerico maiuscolo a 4 caratteri, univoco e generato dal database.
- Salvataggio scelte momento in `moment_attendance_choices`.
- Dashboard iniziali admin, manager e partecipante con dati minimi per
  verificare login, ruolo, evento assegnato e visibilità RLS.
- Script `scripts/bootstrap-test-users.mjs`.

Decisioni:

- Non e' stato introdotto un builder questionario general-purpose.
- I dati stabili restano nello schema relazionale esistente: `participants`,
  `participant_contacts`, `participant_consents`, `accessibility_needs`,
  `event_attendance_choices`, `moment_attendance_choices` e
  `participant_group_assignments`.
- Lingua preferita non viene raccolta nei flussi partecipante. Il campo
  database `participants.preferred_locale` resta valorizzato con default
  tecnico per compatibilita' schema; non reintrodurre select o campi hidden
  utente salvo nuova decisione esplicita. Momenti del programma e
  partecipazione prevista restano supportati per passaggi successivi.
- La lista paesi del primo form usa nazioni dell'Europa geografica, non solo
  politica, includendo paesi transcontinentali come Russia e Turchia.
- `registration_questionnaire_answers` conserva solo uno snapshot versionato
  delle risposte/configurazione per audit e manutenzione futura.
- Le risposte strutturate alle domande di accessibilità restano dati sensibili:
  visibili a partecipante, manager e admin, non all'accoglienza diretta.
- Nel testo visibile all'utente non va citato il Washington Group o la
  classificazione tecnica delle aree funzionali; la documentazione può restare
  tecnica, ma la UI deve usare formulazioni semplici e inclusive.
- Dopo la prima revisione UX della Milestone 12, il form pubblico mostra per
  ora solo tre opzioni accessibilità: sentire, camminare/salire gradini, uso di
  sedia a rotelle o altro ausilio per la mobilità. Sono state rimosse
  temporaneamente le opzioni vedere, cura di sé, ricordare/concentrarsi,
  comunicare e bisogno di assistenza durante l'evento.
- Assisi 2026 e' l'evento operativo prossimo in preparazione. Il titolo
  visibile deve essere quello della locandina:
  `UNARMED AND DISARMING PEACE - PACE DISARMATA E DISARMANTE`.
  Lo slug tecnico storico `assisi-2026-test` resta per compatibilita' con
  migration, seed e script gia' applicati; non deve comparire nella UI o nei
  testi rivolti agli operatori come se l'evento fosse di prova.
- `participants.public_code` e' un identificativo secondario semplice per email
  e funzioni operative. Non sostituisce `participants.id` UUID come chiave
  tecnica e non deve essere usato come segreto, token di accesso o prova di
  identità.

Comandi aggiunti:

- `npm run bootstrap:test-users`.

Uso bootstrap utenti test:

```bash
TEST_ADMIN_EMAIL=admin-test@example.org \
TEST_MANAGER_EMAIL=manager-test@example.org \
TEST_PARTICIPANT_EMAIL=partecipante-test@example.org \
npm run bootstrap:test-users
```

Lo script richiede `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` nell'ambiente. Non stampare mai la service role.

## Vercel production e magic link

Configurazione verificata e aggiornata il 2026-06-18:

- Progetto Vercel: `iscrizioni-pace`.
- Project ID: `prj_4n4oKj3S4sg5RUg5H6AsJLBAK7w6`.
- Team/org ID: `team_ZzsE0ydPpm1T9muAU1xi2uCN`.
- Production branch: `main`.
- Dominio production stabile: `https://registrationspeace.santegidio.org`.
- Alias production aggiuntivi:
  `https://iscrizioni-pace.vercel.app`,
  `https://iscrizioni-pace-giovaniperlapaces-projects.vercel.app` e
  `https://iscrizioni-pace-giovaniperlapace-giovaniperlapaces-projects.vercel.app`.
- Deployment production verificato il 2026-06-18 dopo aggiornamento dominio/env;
  per verificare l'ultimo ID usare
  `vercel inspect https://registrationspeace.santegidio.org`.

Variabili Vercel production richieste:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_URL`.
- `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `QR_TOKEN_ENCRYPTION_SECRET` per cifratura QR stabile.
- `NEXT_PUBLIC_APP_URL=https://registrationspeace.santegidio.org`.
- `APP_URL=https://registrationspeace.santegidio.org`.
- `PUBLIC_SITE_URL=https://registrationspeace.santegidio.org`.
- `EMAIL_FROM`.
- `EMAIL_USER`.
- `EMAIL_PASSWORD`.
- `SMTP_HOST`.
- `SMTP_PORT`.
- `SMTP_SECURE`.
- `EMAIL_DELIVERY_MODE=smtp`.
- `CRON_SECRET` per autenticare l'elaborazione giornaliera della coda campagne.

Note operative Vercel:

- Le variabili pubbliche e non segrete (`NEXT_PUBLIC_*`, URL app, host/porta
  SMTP e flag booleani) possono essere create con `--no-sensitive` per essere
  verificabili con `vercel env pull`.
- Le variabili segrete (`SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PASSWORD` e simili)
  devono restare sensitive/encrypted; Vercel le mostra vuote quando vengono
  lette via CLI/API, ed e' normale.
- Se configurato, `QR_TOKEN_ENCRYPTION_SECRET` deve restare stabile tra deploy:
  se cambia, i QR già salvati in `token_encrypted` non saranno più
  rigenerabili in dashboard. Dal 2026-06-18 la decifratura prova anche i
  fallback storici `SUPABASE_SERVICE_ROLE_KEY` ed `EMAIL_PASSWORD`, così i QR
  creati prima del segreto dedicato restano leggibili.
- Dopo la modifica di qualunque `NEXT_PUBLIC_*` serve un nuovo deploy
  production, perché Next le incorpora nel build.
- I push su `main` devono produrre deployment production; se tornano preview,
  controllare che non ci siano env `Preview (main)` e che la production branch
  sia ancora `main`.

Supabase Auth e redirect:

- `API_EXTERNAL_URL` di GoTrue deve essere
  `https://iscrizioni-supabase.stefano-orlando.it`.
- `GOTRUE_URI_ALLOW_LIST` deve includere almeno:
  `http://localhost:3000/**`, `https://registrationspeace.santegidio.org/**`
  e gli alias production Vercel/legacy.
- La verifica del 2026-06-15 ha generato un magic link di prova senza stampare
  token: l'action host era `iscrizioni-supabase.stefano-orlando.it`, il
  `redirect_to` puntava a `https://registrationspeace.santegidio.org/auth/callback`
  e il redirect applicativo era `/dashboard/partecipante`.
- Il 2026-06-17 e' stato corretto un bug reale di login: i link applicativi
  costruiti da `data.properties.hashed_token` devono usare
  `token_hash=<hash>&type=email`. Prima usavano `type=magiclink` e Supabase
  restituiva errore OTP/link scaduto. La produzione e' stata verificata con
  redirect a `/dashboard/partecipante` per `type=email` e fallback
  `type=magiclink` su token non ancora consumati.
- Il 2026-06-18 e' stato verificato un login reale con magic link per
  `nicolamastrorilli33@gmail.com`: email inviata da
  `registrationspeace@santegidio.org`, link su
  `https://registrationspeace.santegidio.org/auth/callback`, redirect finale a
  `/dashboard/partecipante`.
- L'invio reale delle email dipende da una password app Gmail valida nelle
  variabili SMTP; il dominio del link e' stato verificato separatamente
  dall'arrivo effettivo in inbox.

## Milestone 7 - preparazione apertura pubblica

Checklist operativa:

- `docs/opening-checklist.md`.

Guardrail aggiunti:

- `.vercelignore` esclude `.env`, `.env.*`, `.next`, `node_modules`, log e
  artefatti locali, lasciando tracciabile `.env.example`.
- `.env.example` usa URL locali per sviluppo e documenta il dominio production
  stabile `https://registrationspeace.santegidio.org`.
- Script `npm run opening:verify` e `npm run opening:verify:production`
  controllano env richieste: Supabase public/private, SMTP,
  `QR_TOKEN_ENCRYPTION_SECRET` e, in modalità production, URL app stabili. Non
  stampano valori segreti.
- Le dashboard operative usano tab condivise fra area admin, manager,
  accoglienza, capogruppo e `Iscrizione e QR personale`. La vecchia card
  "La mia iscrizione" e' stata rimossa dalle dashboard operative perché la
  stessa funzione e' raggiungibile dalla tab personale.
- `app/dashboard/capogruppo/page.tsx` ora valida la sessione lato server e usa
  `group_memberships` come fonte reale dei nodi/gruppi assegnati.

## Milestone 8 - apertura controllata e monitoraggio iniziale

Deliverable:

- Dashboard admin aggiornata in `app/dashboard/admin/page.tsx` con vista
  operativa per evento: stato apertura, finestre `registration_opens_at` /
  `registration_closes_at`, conteggi iscrizioni e segnali da controllare.
- Server action `updateEventOpeningState` in `app/actions.ts` con comandi:
  `Apri ora`, `Pausa`, `Nascondi`.
- Ogni comando apertura scrive audit in `audit_logs` con action
  `event.opening_open`, `event.opening_pause` o `event.opening_draft`.
- Gli errori di invio magic link e conferma iscrizione vengono registrati in
  `audit_logs` con action `email.magic_link_failed` e
  `email.registration_confirmation_failed`, senza salvare segreti, token o
  indirizzi email completi nel metadata.
- Helper testabili in `lib/registrations/opening-monitoring.ts`.
- Test `tests/opening-monitoring.test.mts`.
- Log/procedura operativa `docs/opening-monitoring-log.md`, collegato alla
  checklist apertura.

Decisioni:

- `Apri ora` imposta l'evento `published`, apre subito la finestra iscrizioni e
  rimuove una chiusura passata; se la chiusura futura esiste, viene mantenuta.
- `Pausa` lascia l'evento `published` ma porta `registration_closes_at` al
  momento corrente, così il form pubblico non accetta nuove iscrizioni.
- `Nascondi` imposta l'evento `draft` e porta `registration_closes_at` al
  momento corrente.
- La dashboard admin mostra solo conteggi e anomalie aggregate, non elenchi di
  email o dati personali.
- I conteggi da guardare nei primi giorni sono: iscrizioni totali, ultime 24
  ore, senza gruppo corrente, gruppo probabile, QR mancante, errori email 24h,
  email duplicate e richieste di supporto operativo.

Verifiche previste:

- Prima dell'apertura reale eseguire `npm run opening:verify`,
  `npm run opening:verify:production`, `npm run email:verify`,
  `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Dopo ogni comando admin verificare home pubblica e form in una nuova sessione
  browser.

## Milestone 6 - dashboard partecipante

Dashboard partecipante iniziale completata in app.

Deliverable:

- Pagina `app/dashboard/partecipante/page.tsx` sostituita con dashboard
  utilizzabile.
- Server action `updateParticipantDashboard` in `app/actions.ts`.
- Helper testabili in `lib/registrations/participant-dashboard.ts`.
- Test di parsing, finestra modifica e audit diff in
  `tests/registration-flow.test.mts`.

Funzioni disponibili:

- Riepilogo iscrizione con frase introduttiva su evento/date, area panel,
  overlay QR e accessibilita' sintetica.
- Codice partecipante `participants.public_code` visibile in dashboard come
  identificativo operativo semplice dentro l'area QR con etichetta "Il tuo
  codice"; non va duplicato nell'header.
- Modifica controllata di telefono, giorni di presenza e richiesta di supporto. La lingua preferita non e' modificabile/richiesta.
- Le modifiche sono consentite solo se la registrazione non e' `cancelled` e
  se `events.registration_closes_at` non e' superato.
- La dashboard filtra sempre le iscrizioni sul `participants.auth_user_id`
  della sessione corrente, oltre alle RLS del database.
- Le modifiche vengono registrate in `audit_logs` con action
  `participant.dashboard_updated` e solo elenco dei campi cambiati, senza
  duplicare contenuti sensibili.

Decisioni:

- Il QR token resta opaco e non contiene dati personali. In dashboard viene
  rigenerata l'immagine QR server-side decifrando `qr_tokens.token_encrypted`;
  se il record e' precedente alla migration e non ha token cifrato, resta il
  placeholder.
- La dashboard mostra stato QR/accesso evento, codice partecipante e QR reale
  quando il token cifrato e' disponibile.
- Per leggere lo stato QR e scrivere audit server-side si usa service role solo
  dopo aver verificato la proprieta' della registrazione con sessione utente.
- L'accessibilita' viene riepilogata senza mostrare tassonomie tecniche nella
  UI; il partecipante può vedere/modificare le proprie scelte strutturate.
- I momenti del programma/panel non vanno raccolti nel form pubblico di
  iscrizione e non sono un campo del riepilogo modificabile. Vanno trattati
  come esperienza separata della dashboard: al momento si mostra "Panel a cui
  sei iscritto"; quando i panel saranno disponibili, usare le tabelle esistenti
  `event_moments` e `moment_attendance_choices` per iscrizione/tracciamento,
  introducendo una migration solo se serviranno nuovi attributi specifici dei
  panel.
- Il blocco privacy/dati sensibili non viene mostrato nella dashboard
  partecipante ordinaria: consenso e bisogni di accessibilita' restano salvati
  e auditabili, ma non duplicati in una card separata se gia' riepilogati.
- L'area iniziale non deve usare metriche ridondanti come stato iscrizione o
  accesso evento: quei dati sono impliciti o gia' presenti altrove. In alto
  vanno privilegiati panel e gruppo, cioe' informazioni operative future.

## Milestone 6.1 - affinamento dashboard partecipante

Affinamento completato il 2026-06-15.

Deliverable:

- Header dashboard aggiornato con il gruppo come informazione secondaria sotto
  il nome del partecipante. Il gruppo e il referente sono mostrati come due
  informazioni separate; lo stato interno dell'assegnazione gruppo non viene
  mostrato al partecipante.
- La riga evento sotto il nome include titolo, città, paese e date in forma
  naturale, per esempio `dal 25 ottobre 2026 al 27 ottobre 2026`.
- Prima schermata alleggerita: mostra azioni principali e area "Panel a cui sei
  iscritto", senza riepilogo iscrizione o QR code gia' aperti.
- Due pulsanti/link principali, centrati e simmetrici, aprono overlay dedicati:
  `/dashboard/partecipante?overlay=qr` e
  `/dashboard/partecipante?overlay=iscrizione`.
- I pulsanti hanno icone stilizzate: QR code per l'accesso e pagina/form per
  iscrizione e modifica dati.
- L'overlay QR mostrava inizialmente un placeholder; dopo l'anticipo QR reale
  mostra il QR quando `token_encrypted` e' disponibile, con stato QR e codice
  partecipante.
- L'overlay iscrizione mostra riepilogo e modifiche controllate gia' previste da
  Milestone 6.

Decisioni:

- Non sono stati introdotti tab; la separazione usa overlay URL-based con query
  `overlay`, cosi' il server component resta semplice e condivisibile.
- Le sezioni QR e iscrizione non sono piu' visibili nella schermata rapida, ma
  si aprono sopra la dashboard e si chiudono con il simbolo in alto a destra.
- Gli overlay sono centrati nel viewport, con scroll interno se il contenuto e'
  piu' lungo dello spazio disponibile.
- Il gruppo non vive piu' in una card autonoma nella dashboard iniziale:
  rimane un dato operativo secondario accanto all'identita' del partecipante.
- La UI partecipante non mostra lo stato `probable/confirmed/rejected`
  dell'assegnazione gruppo nella riga iniziale, perché e' soprattutto
  informazione operativa interna.
- L'helper del range date contiene un TODO i18n per tradurre in futuro
  `dal/al` in `from/to` o equivalenti.
- I panel restano il contenuto principale della schermata rapida in attesa di
  funzioni future di iscrizione/scelta momenti.
- La dashboard partecipante deve sempre offrire un rientro alle aree operative
  disponibili per lo stesso utente quando esistono ruoli aggiuntivi oltre a
  partecipante. Questo evita che admin, manager, capogruppo o accoglienza che
  aprono "La mia iscrizione" restino senza navigazione per tornare al proprio
  profilo operativo. La prima implementazione mostra "Vai all'area admin" e
  usa la stessa logica role-aware per futuri ruoli.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Dev server locale avviato e dashboard verificata nel browser integrato su
  `http://localhost:3000/dashboard/partecipante` con utente test autenticato.
- Verificato che non compaiano piu' card privacy, check-in, metriche
  ridondanti e duplicazione del codice partecipante in header.
- Verificati nel browser integrato gli overlay `?overlay=qr` e
  `?overlay=iscrizione`.
- Verificati pulsanti simmetrici con icone su desktop e viewport mobile 390px.
- Verificato che gli overlay siano centrati su desktop e mobile.
- Verificate righe evento e gruppo su desktop/mobile senza overflow
  orizzontale.

## Milestone 6.3 - albero gruppi, matching referente e nuovi partecipanti

Albero gruppi e matching iniziale completati localmente il 2026-06-16.

Deliverable:

- Migration `supabase/migrations/20260616103000_group_tree_matching.sql`.
- Migration `supabase/migrations/20260616110000_backfill_group_tree_test_seed.sql`
  aggiunta dopo applicazione remota per riallineare il seed dei nodi test già
  registrato.
- Migration `supabase/migrations/20260617100000_seed_group_tree_from_model_app.sql`
  aggiunta per popolare il catalogo operativo da app modello e per distinguere
  il referente principale in `group_memberships.is_primary`.
- `groups` estesa con `parent_group_id`, `node_type`, `community_kind`,
  `age_bracket`, `is_assignable`, `is_public_catalog`, `public_order` e
  `matching_notes`.
- Nuova tabella `group_assignment_rules` per regole di evento su paese, città,
  fascia età e priorità.
- `participant_group_assignments` estesa con `is_current`,
  `assignment_reason`, `escalated_from_group_id`, `escalation_depth` e
  `matcher_version`, più indice unico parziale per l'assegnazione corrente.
- Helper testabili in `lib/groups/matching.ts` per calcolare età alla data
  evento, fasce giovani/adulti con sovrapposizione 23-30 anni, candidati
  territoriali e fallback.
- Form pubblico aggiornato con campo unico autocomplete per gruppi/referenti,
  filtrato sui candidati affini e ricercabile sia per nome gruppo sia per nome
  referente. Le label usano `nome gruppo - referente ...`.
- Opzione "Non trovo il mio referente" mantenuta: azzera l'eventuale scelta e
  consente l'assegnazione probabile da regola.
- Dopo un errore di validazione nel form pubblico, i dati già inseriti vengono
  conservati in `sessionStorage` per la sessione browser e la UI porta il focus
  sul campo più probabile da correggere.
- La pagina di conferma iscrizione contiene una CTA per tornare alla home e
  fare il primo accesso; se presente, l'email viene passata alla home e
  precompilata nel form email-prima.
- Le nuove iscrizioni vengono agganciate a un gruppo scelto, a un gruppo
  probabile calcolato o a un nodo territoriale dei nuovi partecipanti quando
  esiste un candidato coerente.
- La dashboard manager mostra l'albero gruppi completo, inclusi nodi interni,
  gruppi senza referente e referente principale quando presente.

Decisioni:

- Il referente principale di un gruppo e' modellato con
  `group_memberships.is_primary = true` e duplicato come testo leggibile in
  `groups.primary_leader_name` per il form pubblico. Un gruppo può avere più
  membership capogruppo, ma al massimo una primaria.
- Per ora la distinzione `age_bracket = giovani/adulti` e' significativa solo
  per le aree Roma; le città/gruppi fuori Roma sono seedati come `both`.
- `community_kind = 'newcomers'` e i nodi territoriali dei nuovi partecipanti
  sono classificazioni interne: non vanno esposte nella UI partecipante o nelle
  email ordinarie.
- I gruppi visibili nel form pubblico devono avere `is_public_catalog = true`,
  essere attivi e assegnabili. I nodi interni possono essere usati dal server
  per il matching ma non mostrati come scelta pubblica.
- Il matching usa `participants.country_id` e `participants.city_id` quando il
  paese/città digitato coincide con i cataloghi. I campi testuali restano
  comunque conservati come fallback e nello snapshot questionario.
- Se la persona non seleziona un gruppo, il sistema assegna prima il nodo
  territoriale interno `city` o `country` piu' vicino con `source = 'rule'`,
  `status = 'probable'` e reason `territorial_review_queue`. Solo negli eventi
  o territori privi di questi nodi, chi non ha partecipazione precedente puo'
  ancora usare come fallback il nodo `newcomers` piu' vicino.
- Se il partecipante seleziona un gruppo, l'assegnazione resta `probable` con
  `source = 'participant_selected'`; la conferma esplicita del referente resta
  demandata alla dashboard capogruppo futura.

Verifiche previste:

- Test unitari in `tests/group-matching.test.mts` coprono Austria senza città,
  Italia/Roma, aree, sovrapposizione 23-30 anni, nuovi partecipanti e "Non
  trovo il mio referente".
- Migration 6.3 e backfill applicati al Supabase remoto il 2026-06-16. Dopo il
  backfill remoto verificati: 10 nodi seed 6.3, 5 nodi pubblici assegnabili, 3
  nodi `newcomers`, 6 regole di matching.
- Browser locale verificato per autocomplete gruppo/referente e CTA conferma
  iscrizione. Il browser integrato non ha permesso test automatico completo di
  digitazione per un problema del clipboard virtuale, ma lint/typecheck/test e
  build sono passati.
- Prima di chiudere una modifica collegata alla 6.3 usare ancora
  `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Dati di prova operativi

- Il 2026-07-02 e' stato usato `capogruppo-test@example.org` come account test
  capogruppo per `Roma - Giovani per la Pace`.
- Per testare la tabella capogruppo sono stati creati direttamente nel database
  15 partecipanti fittizi nel gruppo `Roma - Giovani per la Pace`, riconoscibili
  dai cognomi `fittizio1` ... `fittizio15` e dalle email
  `fittizio1@example.test` ... `fittizio15@example.test`. Sono record di test,
  con assegnazione gruppo corrente `confirmed`, source `capogruppo`, contatti,
  consensi, presenze, QR token e audit coerenti. Non usarli come dati reali.

## Milestone 9 - dashboard capogruppo minima

Dashboard capogruppo minima completata e consolidata su `main`.

Deliverable:

- Migration
  `supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql`.
- `participant_group_assignments` estesa con metadati di gestione referente:
  `leader_internal_note`, `leader_note_updated_by`,
  `leader_note_updated_at`, `leader_decision_by`, `leader_decision_at` e
  `leader_notification_read_at`.
- Helper testabili in `lib/groups/capogruppo-dashboard.ts` per scope
  discendenti dell'albero gruppi, filtri, conteggi, normalizzazione note e
  target di escalation al padre.
- Pagina `app/dashboard/capogruppo/page.tsx` sostituita con vista operativa:
  metriche, accesso "La mia iscrizione", filtri `Da verificare`, `Probabili`,
  `Confermati`, `Rifiutati` e schede assegnazione.
- Server action `updateGroupLeaderAssignment` in `app/actions.ts` con intent
  `note`, `read`, `confirm`, `unconfirm`, `reject`, `reassign`.
- Server action `updateGroupLeaderParticipantContact` in `app/actions.ts` per
  modificare dalla scheda capogruppo identita' minima e contatti primari, dopo
  verifica dello scope del capogruppo.

Decisioni:

- La dashboard capogruppo usa il service role lato server solo dopo aver
  verificato sessione e membership del referente. Le persone confermate dei
  discendenti restano consultabili nello scope gerarchico, mentre le assegnazioni
  `probable` sono caricate soltanto per i gruppi collegati direttamente al
  referente: un capogruppo di Roma non vede e non puo' decidere i pending di
  Sant'Andrea. Il service role non arriva mai al browser.
- La UI della tabella mostra dati personali minimi utili al lavoro del
  capogruppo: nome/cognome, telefono, email e conferma appartenenza. Il gruppo
  e' mostrato solo se nella vista corrente compaiono piu' gruppi. Accessibilità
  e altri dati sensibili non devono comparire nella tabella.
- `confirm` imposta l'assegnazione corrente a `confirmed`, registra
  `confirmed_by/confirmed_at`, decisione referente e lettura.
- `unconfirm` riporta un'assegnazione corrente a `probable`, svuota
  `confirmed_by/confirmed_at` e registra decisione/lettura del referente.
- `reject` porta l'assegnazione rifiutata a `status = 'rejected'` e
  `is_current = false`; se il gruppo ha un padre crea o riattiva una nuova
  assegnazione corrente `probable` sul padre con `source = 'capogruppo'`.
  Se non c'e' padre, la registrazione resta senza assegnazione corrente e
  finisce nella coda manager già monitorata come "senza gruppo corrente".
- `reassign` e' disponibile su un'assegnazione `probable` del gruppo diretto:
  rende non corrente l'assegnazione al nodo superiore e crea o riattiva una
  nuova assegnazione `probable` su un gruppo attivo e assegnabile del
  sottoalbero, con reason `group_leader_reassigned_to_descendant`. Il referente
  del gruppo destinazione riceve la normale notifica operativa e deve ancora
  confermare l'appartenenza.
- Rifiuto, conferma, nota e lettura sono decisioni interne: non inviano email
  o notifiche al partecipante.
- L'audit log salva action e metadati tecnici (`group_id`, stato precedente,
  eventuale gruppo di escalation, flag nota cambiata), non il testo della nota
  interna.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

## Milestone 9.1 - link riservati per gruppi nascosti

Link riservati per gruppi iscrivibili ma non visibili nel catalogo pubblico
completati localmente il 2026-06-17.

Deliverable:

- Migration `supabase/migrations/20260617130000_group_registration_links.sql`.
- `groups` estesa con `public_label`, label opzionale mostrabile al
  partecipante quando il nome operativo interno e' troppo delicato o ambiguo.
- Nuova tabella `group_registration_links` con `token_hash`, `public_label`,
  `internal_label`, `use_count`, `max_uses`, `expires_at`, `revoked_at`,
  `created_by` e `revoked_by`.
- Helper server-side in `lib/groups/registration-links.ts` per generare slug
  leggibili univoci, hash SHA-256, URL pubblici, label partecipante e stato
  link.
- Form pubblico `/<token>`: il token valido aggiunge un contesto "Gruppo
  indicato dal referente", usa la label pubblica e assegna il gruppo anche se
  `is_public_catalog = false`. Il precedente formato
  `/registrazione?groupLink=<token>` reindirizza permanentemente alla route
  breve.
- `createPublicRegistration` valida server-side il gruppo selezionato: senza
  token link valido accetta solo gruppi attivi, assegnabili e pubblici nel
  catalogo. Questo chiude la possibilità di forzare manualmente UUID di gruppi
  nascosti nel submit.
- Dashboard manager: sezione "Link riservati di iscrizione" per generare e
  revocare link su tutti i gruppi iscrivibili degli eventi gestibili.
- Dashboard capogruppo: sezione "Link iscrizione gruppo" per generare e
  revocare link solo sui gruppi nel proprio scope discendente.
- Audit log per `group_registration_link.created`,
  `group_registration_link.revoked` e `registration.group_link_used`, senza
  salvare token in chiaro.
- Test aggiornati in `tests/group-matching.test.mts` e
  `tests/database-schema.test.mts`.

Decisioni:

- `is_assignable = true` indica che un gruppo può ricevere iscrizioni;
  `is_public_catalog = true` indica che compare nel suggerimento pubblico;
  `is_assignable = true` e `is_public_catalog = false` indica gruppo nascosto
  ma iscrivibile solo tramite link riservato o gestione operativa.
- Il token del link e' uno slug leggibile derivato dal nome pubblico scelto
  dall'operatore; non contiene ID gruppo o dati personali. In database resta
  disponibile sia l'hash per la risoluzione pubblica sia la copia cifrata
  necessaria a mostrare e copiare il link canonico dalle dashboard.
- La label pubblica del link prevale su `groups.public_label`; se entrambe sono
  assenti, il form mostra "Gruppo indicato dal tuo referente".
- Il link riservato non forza le risposte personali del questionario: la persona
  può rispondere sinceramente su partecipazione precedente e gruppo; il token
  determina comunque l'assegnazione operativa al gruppo invitante.
- Le iscrizioni arrivate da link riservato usano
  `assignment_reason = 'group_registration_link'`, `status = 'probable'` e
  `source = 'participant_selected'` per restare compatibili con il vincolo
  attuale della tabella.
- Manager/admin possono generare link per tutti i gruppi iscrivibili in scope
  evento; capogruppo solo per il proprio gruppo/nodo e discendenti.
- I link esistenti non sono ricostruibili dalla dashboard perché il token in
  chiaro non viene conservato. Se serve reinviare un link, se ne genera uno
  nuovo e si può revocare quello vecchio.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Migration remota applicata con
  `./scripts/apply-remote-migration.sh supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql`.

## Milestone 10 - inserimento manuale partecipanti da capogruppo

Inserimento manuale completato localmente il 2026-06-17.

Deliverable:

- Helper testabile `lib/registrations/manual-registration.ts` per parsing,
  normalizzazione e snapshot questionario minimale.
- Server action `createGroupLeaderManualRegistration` in `app/actions.ts`.
- Dashboard capogruppo aggiornata in `app/dashboard/capogruppo/page.tsx`:
  tabella partecipanti del gruppo, filtri/ordinamento, azioni per rivedere
  assegnazioni, overlay per inserimento manuale e overlay per link iscrizione.
- Componenti client `manual-attendance-fields.tsx` e
  `manual-accessibility-fields.tsx`.
- Test in `tests/registration-flow.test.mts`.

Funzioni disponibili:

- Il capogruppo può inserire nome, cognome, email o telefono, eventuale data di
  nascita, presenza prevista e nota interna. La lingua preferita non viene
  raccolta nell'inserimento manuale.
- La presenza manuale usa le date reali dell'evento, non etichette riassuntive;
  può restare "da confermare". Dal 2026-07-02 usa fasce mattina/pomeriggio
  tramite `event_attendance_choices.day_part`.
- Le domande accessibilità nell'inserimento manuale mostrano i follow-up solo
  se viene selezionato "Sì".
- Il gruppo selezionabile è limitato ai gruppi iscrivibili nello scope
  discendente del capogruppo.
- L'iscrizione viene creata con `registrations.source = 'capogruppo'` e
  `registrations.created_by` valorizzato.
- L'assegnazione gruppo viene creata subito `confirmed`, con source
  `capogruppo`, confidence `1`, reason `group_leader_manual_entry`,
  `matcher_version = 'group-leader-manual-v1'` e metadati decisione referente.
- Vengono creati contatto primario, consenso privacy/trattamento dichiarato dal
  capogruppo, snapshot questionario minimale, record accessibilità vuoto,
  QR token opaco cifrato e audit `registration.created_by_group_leader`.

Decisioni:

- La vista predefinita della dashboard capogruppo è la tabella
  "Partecipanti del gruppo"; i riepiloghi tecnici e i conteggi ridondanti non
  vanno mostrati al capogruppo.
- "Genera link" e "Inserisci partecipante" sono strumenti contestuali aperti in
  overlay dal gruppo selezionato, non sezioni permanenti della pagina.
- I link riservati generati dal capogruppo mantengono il gruppo nascosto dal
  catalogo pubblico ma precompilano il form pubblico tramite `?groupLink=...`.
- Nel form pubblico aperto da link riservato, la UI non chiede più se la persona
  ha già partecipato o se parteciperà con un gruppo: i valori sono impliciti e
  inviati come hidden (`hasPreviousSantegidioParticipation=yes`,
  `participatesWithGroup=yes`, `groupId=<gruppo>`).
- Il riquadro del form pubblico da link riservato deve indicare chiaramente il
  gruppo vincolato nel formato italiano `Questo link iscrive al gruppo di
  “Nome gruppo”`. Non deve offrire link o inviti verso `/registrazione` o verso
  l'iscrizione generica, per evitare che la persona abbandoni per errore il
  flusso specifico del gruppo.
- Email e telefono sono alternativi: serve almeno un recapito.
- Se l'email è presente, l'action blocca doppie iscrizioni allo stesso evento.
- Dal 2026-09-11 l’inserimento manuale invia le istruzioni di accesso solo con
  email personale e senza delega; vedere la sezione Email di accesso sopra.
- I dati di paese/città del partecipante sono ereditati dal gruppo scelto
  quando presenti; eventuali dettagli più completi restano modificabili in
  passaggi successivi.
- La checkbox consenso registra che il capogruppo dichiara di avere il consenso
  della persona iscritta; non sostituisce eventuali verifiche organizzative
  successive.
- La modifica completa dell'iscrizione, l'assegnazione a servizi e l'eventuale
  assegnazione a sottogruppi restano da progettare in milestone successive
  insieme alla rifinitura coerente di tutta l'app.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- Browser integrato su localhost: login capogruppo reale, link riservato
  generato e aperto, form pubblico con `groupLink`, inserimento manuale,
  tabella partecipanti e overlay link/manuale verificati.

## Rifinitura dashboard operative - 2026-06-16

Rifinitura realizzata dopo review nel browser integrato e consolidata su
`main`. Il diario della sessione e' in
`docs/diario-2026-06-16-dashboard-layout.md`; il commit di documentazione e
riallineamento e' `f2baa4a`.

Deliverable:

- Nuovo componente condiviso `app/dashboard/role-tabs.tsx`.
- Logica testabile per le tab in `lib/auth/dashboard-tabs.ts`.
- Navigazione a tab fra aree:
  `Dashboard admin`, `Dashboard manager`, `Dashboard accoglienza`,
  `Dashboard capogruppo`, `Iscrizione e QR personale`.
- Logout globale nell'header tramite server action `logout()` in
  `app/actions.ts` e bottone `Esci` con icona in `components/app-headbar.tsx`.
- Rimozione della card `Iscrizione personale collegata` dalle dashboard
  operative: l'area personale si raggiunge dalla tab
  `Iscrizione e QR personale`.
- Rimozione del vecchio placeholder dashboard accoglienza e riallineamento al
  layout delle altre dashboard operative.
- Modale admin `Modifica iscritto` aggiornato:
  - rimossa la X di chiusura;
  - `Annulla` e' l'unica uscita senza salvare;
  - `Conferma modifiche` e' l'unico salvataggio;
  - il select ruolo permette `Admin`, `Manager`, `Manager viewer`,
    `Accoglienza`, `Capogruppo` e `Nessun ruolo operativo`.

Decisioni:

- La tab attiva e' l'indicatore principale dell'area corrente; i titoli visibili
  ridondanti `Area protetta` / `Pannello operativo` sono stati rimossi dalle
  dashboard operative.
- Restano titoli `sr-only` per accessibilita' e struttura semantica.
- L'informazione `Area protetta` resta come badge grafico nella descrizione
  sotto le tab, non come titolo principale.
- Le descrizioni sotto le tab devono iniziare con tono operativo tipo
  "In questa area puoi..." e non devono ripetere l'email dell'utente, gia'
  mostrata nell'header globale.
- `manager` e `manager_viewer` condividono la tab `Dashboard manager`.
- Gli admin vedono tutte le dashboard operative, anche senza ruoli evento
  separati.
- Il ruolo `Admin` assegnato dal modale admin viene scritto in
  `event_user_roles` come ruolo globale con `event_id = null`.
- Il ruolo `Capogruppo` assegnato dal modale admin viene scritto in
  `group_memberships` sul gruppo selezionato.
- Cambiare ruolo dal select admin rimuove gli altri ruoli operativi assegnabili
  nello stesso contesto; `Nessun ruolo operativo` li rimuove.

Note operative:

- Durante il test un utente operativo reale ha perso temporaneamente il ruolo
  admin per effetto della nuova gestione ruolo; e' stato ripristinato
  manualmente via Supabase service role. Dopo il ripristino risultavano
  `admin` globale e `manager` sull'evento Assisi 2026. Per modifiche future al
  select ruolo, verificare sempre anche l'utente admin che sta eseguendo la
  modifica.

Verifiche eseguite durante la sessione:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Verifiche browser su admin, manager, capogruppo, accoglienza e partecipante.

## Anticipo QR code reale

Funzionalità anticipata il 2026-06-15 rispetto alla roadmap originaria.

Deliverable:

- Dipendenza `qrcode` aggiunta per generare QR PNG/data URL reali.
- Migration `supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql`
  aggiunta e applicata al Supabase self-hosted remoto.
- `qr_tokens.token_encrypted` conserva il token QR opaco cifrato lato server;
  `qr_tokens.token_hash` resta la base per la verifica futura.
- Alla nuova iscrizione l'app genera il QR dal token opaco, lo allega/mostra
  inline nella email di conferma e conserva il token cifrato.
- La dashboard partecipante mostra il QR reale quando `token_encrypted` e'
  disponibile; per iscrizioni precedenti senza token cifrato mostra ancora il
  placeholder.
- Nella dashboard partecipante il QR reale deve restare immediatamente visibile
  all'apertura dell'area personale. Evitare overlay o pulsanti primari per
  "vedere il QR"; l'overlay resta solo come compatibilita' URL/possibile vista
  estesa futura.
- Il codice partecipante va mostrato una sola volta sotto il QR con label breve
  `Il tuo codice:`, non duplicato in una card informativa separata.
- Le azioni QR attuali sono download PNG/data URL e placeholder disabilitato per
  wallet. La futura integrazione wallet richiedera' una vera funzione pass, non
  un link fittizio.

Decisioni:

- Il QR code contiene solo token opaco, non dati personali, nome, email o
  codice partecipante.
- `QR_TOKEN_ENCRYPTION_SECRET` e' il segreto usato per cifrare i nuovi token
  recuperabili. Deve restare stabile tra deploy; la decifratura mantiene
  fallback sui segreti storici per non perdere i QR gia' salvati.
- Lo scanner accoglienza e la verifica token restano da completare in una
  milestone successiva dedicata a QR/check-in.

Verifiche eseguite:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.
- Migration remota applicata con
  `./scripts/apply-remote-migration.sh supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql`.
- Browser integrato verificato su `?overlay=qr`: le iscrizioni precedenti alla
  migration mostrano fallback placeholder, le nuove potranno mostrare QR reale.

## Stack previsto

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Supabase.
- Database Supabase self-hosted su VM Hetzner gestita con Coolify.
- Supabase URL previsto: `https://iscrizioni-supabase.stefano-orlando.it`.
- Coolify previsto: `https://supabase-iscrizioni.stefano-orlando.it`.

Non assumere che chiavi, token, project ref o credenziali siano disponibili. Se servono, chiederli esplicitamente.

## Prodotto

L'app gestisce iscrizioni a eventi internazionali annuali della Comunità di Sant'Egidio in città diverse. Deve essere multi-evento e multi-anno, per esempio Assisi 2026 o Roma 2025.

Il prodotto deve coprire:

- Iscrizione pubblica tramite email.
- Accesso a iscrizione esistente tramite magic link Supabase.
- Dashboard partecipante.
- Gruppi e capigruppo.
- Inserimento di partecipanti senza email tramite referente/capogruppo.
- Dashboard manager/admin con tabelle, filtri, statistiche ed export.
- Programma evento e scelta dei momenti.
- Email transazionali e campagne personalizzate.
- QR code e check-in accoglienza.
- Settori/sedute e informazioni operative.
- Multilingua almeno italiano e inglese.
- Audit log, privacy, minimizzazione dati e retention post-evento.

Questa app non deve partire dall'assunto che l'evento sia residenziale.

## Ruoli applicativi

Ruoli minimi da supportare:

- `partecipante`: accede alla propria dashboard, modifica la propria iscrizione quando consentito, consulta QR code, programma e scelte.
- `capogruppo`: utente reale dell'app; vede solo i partecipanti dei propri gruppi o nodi territoriali; conferma appartenenza/esternalita'; inserisce persone senza email; riceve notifiche.
- `admin`: governa il ciclo evento, crea eventi futuri, rende corrente un
  evento, apre/sospende/nasconde le iscrizioni e assegna il ruolo `manager` a
  persone gia' iscritte; gestisce anche dati operativi, gruppi e ruoli.
- `manager`: collegato a uno specifico evento; vede tutti i partecipanti e
  gruppi dell'evento corrente e puo' modificare dati operativi, gruppi e
  funzioni organizzative consentite. Non puo' creare eventi, cambiare evento
  corrente, aprire, sospendere o nascondere le iscrizioni, né nominare altri
  manager.
- `manager_viewer`: consulta Statistiche e Gestione iscritti senza modifiche
  operative; accede e modifica la propria iscrizione nell’area personale.
- `accoglienza`: scansiona QR code e verifica iscrizioni/check-in vedendo solo dati minimi necessari.

I ruoli devono vivere in profili o membership applicative, non solo nei metadata Supabase Auth. Dove serve, il ruolo deve essere scoperto da uno scope: evento, gruppo, funzione di accoglienza.

Le dashboard admin e manager devono condividere le viste operative su iscritti,
gruppi, link riservati e capigruppo, ma la configurazione dello stato evento
resta esclusiva dell'admin. La tabella iscritti serve a vedere e filtrare persone iscritte,
aprire i dettagli della loro iscrizione e, con un secondo click esplicito,
modificare il gruppo corrente; non va usata come tabella di assegnazione ruoli.
La gestione dei capigruppo vive nella sezione gruppi tramite azione
`Capogruppo`: si puo' promuovere un partecipante esistente oppure creare una
scheda minima nome/cognome/email per una persona non ancora iscritta,
collegandola a `profiles`/auth e a `group_memberships`. Admin e manager devono
poter creare/modificare gruppi e nodi paese/città/area/gruppo finale e
collegare capigruppo ai nodi tramite `group_memberships`. Solo l'admin puo'
creare/avviare nuovi eventi e assegnare o promuovere il ruolo `manager` a
persone gia' iscritte.

Decisione stabile su ruoli operativi e partecipazione personale:

- I ruoli operativi non sostituiscono l'identità da partecipante. Manager,
  manager_viewer, capogruppo paese, capogruppo città, capogruppo area e
  capogruppo del singolo gruppo devono poter avere una propria registrazione
  personale allo stesso evento.
- La registrazione personale resta modellata in `participants` e
  `registrations`, collegata allo stesso utente Supabase tramite
  `participants.auth_user_id`. Giorni di presenza, QR personale, dati propri,
  accessibilità e futura scelta dei panel devono vivere su questa registrazione,
  non sul ruolo operativo.
- La gerarchia dei referenti/capigruppo va modellata con membership su nodi
  dell'albero `groups`: paese, città, eventuale area/sottogruppo, gruppo finale.
  Non creare identità separate o ruoli database distinti solo per
  `capogruppo_paese` o `capogruppo_citta` se basta lo scope del nodo.
- Le dashboard operative devono offrire un accesso chiaro a "La mia iscrizione"
  e segnalare se l'utente con ruolo operativo non ha ancora completato la
  propria registrazione personale per l'evento.
- Un capogruppo creato prima della propria iscrizione avrà inizialmente solo
  nome, cognome ed email nella scheda minima. Quando farà login potrà gestire il
  gruppo assegnato e completare/modificare la propria scheda personale dai
  flussi partecipante, senza duplicare l'identità.
- Nelle tabelle ruoli operative mostrare una sola riga per persona/email. Se un
  capogruppo segue più gruppi, elencarli tutti nella colonna
  `Responsabilità`; non duplicare la riga per ogni gruppo. La UI rivolta a
  manager/admin non deve usare la label tecnica `Scope`.
- La modifica di un capogruppo deve permettere l'assegnazione a più gruppi
  nella stessa modale. L'email identifica una sola utenza operativa: quando si
  crea o modifica un ruolo, non creare una nuova utenza se esiste già un utente
  con quella email.

## Workflow pubblico

La home parte dall'email:

- Se l'email corrisponde a una persona già iscritta, l'app invia un magic link Supabase.
- Se l'email non e' ancora registrata, viene avviato il form di iscrizione.
- Alla creazione della registrazione vengono salvati dati essenziali, consensi, gruppo certo/probabile, QR token e log.
- Viene inviata una email di conferma con dati inseriti e link di accesso.

Il form iniziale deve raccogliere almeno:

- Nome, cognome, data di nascita.
- Paese da lista preimpostata con opzione altro.
- Città filtrata per paese con opzione altro.
- Disabilità o bisogni di accessibilità con lista ridotta e temporanea:
  sentire, camminare/salire gradini, sedia a rotelle o altro ausilio per la
  mobilita'.
- Partecipazione precedente a eventi/iniziative Sant'Egidio.
- Partecipazione con gruppo Sant'Egidio o come singolo.
- Se gruppo: selezione da elenco gruppi cercabile per nome gruppo e capogruppo.
- Giorni/momenti previsti di partecipazione, con opzione "non lo so ancora".
- Accettazione privacy e consenso al trattamento dati.
- Versione consenso, data/ora, e quanto serve per tracciabilità legale.

## Gruppi, referenti e nuovi partecipanti

Decisione aggiornata il 2026-06-15:

- L'aggancio a un referente o a un gruppo probabile e' funzione centrale: ogni
  iscrizione deve essere collegata a un gruppo Sant'Egidio, a un referente
  probabile o a un nodo territoriale dei nuovi partecipanti.
- "Esterni" e' una categoria interna da evitare nella UI partecipante. Nome
  provvisorio per documentazione e viste operative: `nuovi partecipanti` o
  `non ancora membri Sant'Egidio`.
- I nuovi partecipanti non sanno e non devono ricevere notifiche sul fatto di
  essere stati classificati come non membri; la distinzione serve a
  comunicazioni, statistiche e informazioni riservate.
- I nuovi partecipanti devono comunque vivere nello stesso modello territoriale
  ad albero dei gruppi: paese, città e, solo dove ha senso, livelli ulteriori
  non esposti come appartenenza Sant'Egidio. Non si scende alle aree cittadine
  se le informazioni disponibili non permettono di farlo con affidabilità.
- L'albero gruppi previsto e' paese -> città -> eventuale area/sottogruppo. In
  paesi con un solo referente nazionale, il nodo paese può essere direttamente
  assegnabile.
- L'assegnazione del referente Sant'Egidio si ferma al terzo livello: esempi
  validi sono Torino, Regno Unito, Roma Torrevecchia.
- Collaboratori nominati da un referente non sono un quarto livello
  dell'albero: sono utenti con permessi sullo stesso gruppo o su sottoinsiemi
  operativi assegnati.
- Il form deve filtrare i gruppi affini usando paese, città di residenza ed età
  alla data dell'evento. Fasce iniziali: fino a 25 anni gruppi giovani; dai 30
  anni gruppi adulti; da 23 a 30 anni proporre sia giovani sia adulti.
- Ogni gruppo può essere taggato come giovani, adulti, entrambi o non
  dipendente dall'età.
- Le opzioni gruppo nel form devono essere ricercabili sia per nome gruppo sia
  per referente principale, per esempio `Giovani per la Pace - referente
  Stefano Orlando`.
- Deve esistere l'opzione "Non trovo il mio referente". In quel caso la
  persona resta Senza gruppo, come chi dichiara di partecipare senza gruppo.
- Una selezione esplicita è subito operativa. Il referente segnala soltanto
  chi non appartiene al gruppo; il rifiuto porta direttamente a Senza gruppo,
  disponibile per riassegnazione manuale di admin/manager.
- Il partecipante non riceve notifiche di rifiuto, risalita o
  riclassificazione interna.
- I referenti di qualunque livello dell'albero e i manager possono essere anche
  partecipanti dell'evento con la stessa email/account. Le funzioni operative
  servono a gestire altri partecipanti; la loro presenza personale, il QR e i
  panel passano sempre dalla dashboard partecipante.

## Dati sensibili e privacy

Privacy e sicurezza sono architettura, non dettagli finali.

Trattare con attenzione:

- Dati di disabilità e accessibilità.
- Data di nascita ed età.
- Email, telefono e contatti referenti.
- Appartenenza a gruppi o coinvolgimento nella Comunità di Sant'Egidio.
- Presenza a eventi/momenti.
- Check-in e luoghi.
- Minori o giovani partecipanti, se presenti.

Principi:

- Raccogliere solo dati necessari.
- Separare o proteggere fortemente i dati sensibili.
- Mostrare all'accoglienza solo dati minimi operativi.
- Non inserire dati personali nel QR code: usare token opaco, revocabile e non indovinabile.
- Loggare azioni sensibili senza duplicare contenuti sensibili non necessari.
- Prevedere retention, anonimizzazione o cancellazione post-evento.

## Guardrail operativi

Prima di ogni blocco:

- Verificare `pwd`.
- Verificare `git status --short`.
- Verificare branch corrente con `git branch --show-current` quando la repo Git esiste.
- Se la working tree e' sporca, capire se le modifiche sono pertinenti. Non sovrascrivere lavoro non compreso.
- Leggere i file rilevanti prima di modificare.

Durante il lavoro:

- Fare diff piccoli e verificabili.
- Seguire pattern esistenti del repository.
- Non introdurre astrazioni non necessarie.
- Non installare dipendenze senza motivo chiaro e senza verificare lo stack esistente.
- Non fare commit o push senza richiesta esplicita.
- Non usare comandi distruttivi come `git reset --hard` o checkout di file modificati senza richiesta esplicita.
- Non committare segreti, chiavi, password, token o dump con dati personali.

Prima di concludere:

- Eseguire i comandi disponibili e pertinenti: lint, typecheck, test, build.
- Verificare `git diff`.
- Dire cosa e' stato cambiato, cosa e' stato verificato, cosa non e' stato possibile verificare.

## Strategia Git

- Salvo indicazione esplicita dell'utente, effettuare tutte le modifiche e le
  verifiche direttamente su `main`, seguendo il riallineamento iniziale.
- Conservare `codex/panel-p0-p10` per lo staging dei panel; lavorarci solo
  quando espressamente indicato dall'utente, secondo il workflow sopra.
- Quando tutto funziona e l'utente chiede commit/push, committare e pubblicare
  direttamente su `main`, oppure sul branch panel espressamente indicato.
- Non creare branch, worktree o pull request senza una nuova richiesta
  esplicita dell'utente, anche per interventi lunghi, rischiosi o paralleli.
- Preparare diff leggibili per review umana.
- Non fare commit/push senza richiesta.
- Se compaiono modifiche non fatte da Codex, trattarle come lavoro dell'utente.

Remote configurato:

```bash
git remote -v
```

## Supabase e Coolify

Supabase sarà usato nelle milestone implementative, non durante la sola pianificazione.

Accessi da chiedere se mancanti:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_URL`.
- `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase project ref o dettagli self-hosted equivalenti.
- Token Supabase CLI/Management API, se necessario.
- Credenziali/API token Coolify.
- Provider email e relative credenziali/API key.
- URL pubblici e callback URL autorizzati.

Regole:

- Usare anon key nel browser.
- Usare server client con cookie per sessione utente.
- Usare service role solo lato server o strumenti operativi.
- Non bypassare RLS nei flussi utente ordinari.
- Le migration devono essere versionate in repository.
- Evitare drift tra database reale e migration.
- Testare RLS con ruoli diversi, non solo con service role.

## Architettura attesa

Struttura probabile:

- `app/[locale]/page.tsx` o equivalente per UI pubblica multilingua.
- `app/[locale]/registrazione/*` per nuova iscrizione.
- `app/[locale]/dashboard/partecipante/*`.
- `app/[locale]/dashboard/capogruppo/*`.
- `app/[locale]/dashboard/manager/*`.
- `app/[locale]/dashboard/admin/*`.
- `app/[locale]/dashboard/accoglienza/*`.
- `app/auth/callback` per magic link.
- `proxy.ts` per protezione route dashboard e aggiornamento sessione Supabase.
- `app/api/*` solo per endpoint necessari.
- `components/*` per componenti riusabili.
- `lib/supabase/*` per client browser/server/service.
- `lib/auth/*` per ruoli, access checks e redirect.
- `lib/events/*` per eventi, configurazioni e programma.
- `lib/registrations/*` per iscrizioni, validazione e normalizzazione.
- `lib/groups/*` per gruppi e assegnazioni.
- `lib/email/*` per template, provider, invio e log.
- `lib/qrcode/*` per QR token e verifica.
- `lib/check-in/*` per scansione e check-in.
- `lib/i18n/*` per traduzioni.
- `lib/audit/*` per log applicativi.

Usare API routes o server actions secondo il pattern che emergera' dal progetto. Per operazioni con service role, preferire codice server chiaro, testabile e con controlli di autorizzazione espliciti.

## Modello dati iniziale atteso

Entità probabili:

- `events`.
- `event_locations`.
- `event_moments`.
- `profiles`.
- `event_user_roles` o equivalente.
- `groups`.
- `group_memberships`.
- `registrations`.
- `participants` o anagrafica separata da iscrizione.
- `participant_contacts`.
- `participant_consents`.
- `accessibility_needs`.
- `group_assignment_rules`.
- `participant_group_assignments`.
- `event_attendance_choices`.
- `moment_attendance_choices`.
- `qr_tokens`.
- `check_ins`.
- `communications`.
- `communication_recipients`.
- `email_templates`.
- `email_send_logs`.
- `email_send_log_recipients`.
- `seating_sectors`.
- `seat_assignments`.
- `audit_logs`.
- `countries`.
- `cities`.

Non creare migration senza una milestone dedicata e un diff SQL revisionabile.

## App modello

L'eventuale app modello deve trovarsi in un clone o in una cartella locale non
sincronizzata da servizi cloud. Verificarne il percorso sulla postazione in uso
prima di consultarla.

Usarla come riferimento, non come sorgente da copiare automaticamente.

Pattern utili osservati:

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4.
- Dashboard separate per `admin`, `manager`, `capogruppo`, `partecipante`, `alloggi`.
- Magic link Supabase gestito dall'app con preflight, callback e invio email applicativo.
- Separazione Supabase browser/server/service client.
- Ruoli applicativi in tabella profili.
- Componenti tabellari con filtri, sort, edit modal e colonne opzionali.
- i18n via provider e file locale TypeScript.
- Email templates, campagne, log invii e log destinatari.
- Soft delete partecipanti.
- Documentazione operativa in `AGENTS.md`.
- Guida operativa Supabase in `docs/supabase-workflow.md`.

Codice eventualmente adattabile dopo review:

- Login magic-link e callback.
- Helper ruoli e access check.
- Pattern tabella partecipanti.
- Pattern dashboard manager/admin/capogruppo.
- Pattern email templates/log.
- Pattern i18n.
- Test di funzioni pure.

Non importare automaticamente:

- Logiche alloggi/residenziali: alberghi, stanze, quote, room assignment.
- Tally webhook.
- Finanza evento.
- Date, domini, nomi, email sender e configurazioni specifiche della app modello.
- Migration SQL della app modello senza riprogettazione per questa app.

## Multilingua

Lingue minime:

- Italiano.
- Inglese.
- Francese.
- Tedesco.
- Spagnolo.
- Neerlandese.
- Ucraino.

Regole:

- La lista canonica lingue sta in `lib/i18n/config.ts`.
- La localizzazione server usa `getRequestLocale()` in `lib/i18n/server.ts`:
  prima cookie `iscrizioni_locale`, poi `Accept-Language`, infine fallback
  inglese.
- Il selettore lingua globale vive in `components/language-selector.tsx` ed e'
  mostrato da `components/app-headbar.tsx`; nell'header mostra solo le
  bandierine, mentre i nomi lingua restano disponibili nei dati per form e
  accessibilità.
- Evitare testi UI hardcoded quando la struttura i18n esiste.
- Aggiornare tutte le lingue supportate per ogni nuova UI pubblica; se una
  traduzione non e' ancora affidabile, usare inglese come fallback esplicito.
- D'ora in poi ogni nuova pagina o funzione che interessa partecipante o
  capogruppo deve essere implementata nelle lingue supportate fin dall'inizio:
  italiano, inglese, francese, tedesco, spagnolo, neerlandese e ucraino.
  Questo vale per testi visibili, etichette, pulsanti, stati, errori, overlay,
  fallback di dati mancanti e campi form. Manager/admin possono restare
  prioritariamente italiani, con inglese o fallback sulle parti condivise.
- Non tradurre automaticamente testi legali definitivi senza revisione umana.
- Salvare preferenza lingua dove serve, per profilo o iscrizione.

## Email

- Dal 2026-09-06, le email applicative di conferma iscrizione e accesso
  (testo e HTML) e gli avvisi del sito dopo l'invio ricordano di controllare
  lo spam e salvare `registrationspeace@santegidio.org` tra gli indirizzi sicuri.
  Testo comune in `lib/i18n/email-delivery.ts`, sette lingue per il sito;
  comprende conferma iscrizione, magic link, risposta attesa dagli organizzatori
  e invii di prova/campagna (rivolgendosi ai destinatari per le campagne).
  Queste indicazioni restano valide anche cambiando provider di distribuzione.

Email previste:

- Conferma iscrizione.
- Magic link.
- Nessuna notifica automatica al capogruppo per nuova associazione.
- Comunicazioni per persone senza email inviate al referente.
- Campagne manager/admin filtrate.

Regole:

- Separare template, rendering e invio.
- Loggare invii e destinatari.
- Evitare invii reali massivi in sviluppo.
- Prevedere modalità test/preview.
- Non salvare password/API key in repository.

## QR code e check-in

Regole:

- QR code = token opaco, non dati personali.
- Token revocabile e rigenerabile.
- Check-in idempotente.
- Check-in associabile a evento generale e/o momento specifico.
- Accoglienza vede solo: identità minima, stato iscrizione, eventuale settore/seduta/percorso, alert operativi strettamente necessari.
- Ogni scansione/check-in deve essere auditabile.

## Test e verifica

Quando gli script sono configurati, usare:

- `npm run lint`.
- `npm run typecheck`.
- `npm test`.
- `npm run build`.

Per funzioni critiche aggiungere test su:

- Normalizzazione email, paesi/città e gruppi.
- Assegnazione gruppo certa/probabile.
- Ruoli e scope evento/gruppo.
- Validazione form iscrizione.
- Rendering template email.
- QR token e check-in.
- RLS, dove testabile.

Per frontend significativo:

- Avviare dev server.
- Verificare nel browser locale.
- Controllare responsive desktop/mobile.
- Verificare che testi non si sovrappongano e che flussi principali siano usabili.

## Documentazione da mantenere

Aggiornare questo file quando:

- Cambiano comandi di setup/test/build.
- Cambiano variabili ambiente richieste.
- Cambia struttura cartelle.
- Cambiano ruoli o permessi.
- Cambia schema database o policy RLS.
- Cambiano flussi auth, registrazione, email, QR/check-in.
- Si prendono decisioni architetturali rilevanti.

Usare documenti aggiuntivi quando il dettaglio diventa troppo lungo:

- `docs/supabase-workflow.md`.
- `docs/decisioni.md`.
- `docs/privacy-retention.md`.
- `docs/deploy.md`.
- `docs/model-app-discovery.md`.
- `docs/setup.md`.

## Uso di PIANO_DI_LAVORO.md

Finché esiste, `PIANO_DI_LAVORO.md` guida le milestone principali. Prima di iniziare una milestone, leggere la sezione corrispondente.

Quando il piano verrà cancellato:

- Non ricrearlo automaticamente.
- Usare questo `AGENTS.md` come fonte primaria.
- Per bugfix e funzioni accessorie, leggere il codice reale e aggiornare questo file se emerge una nuova regola operativa.

## Piano panel, scuole e accoglienza QR

- Il 2026-08-04 e' stato creato `PIANO_DI_LAVORO_PANEL.md`, nuovo piano
  operativo per sviluppare in milestone piccole location, panel, sezioni di
  capienza per tipo di pubblico, pubblicazione singola/multipla, iscrizioni
  individuali, prenotazioni scuole, audience campagne per panel/professori,
  statistiche panel, check-in QR e stampa di etichette per badge.
- Per questo ambito il nuovo piano sostituisce le precedenti indicazioni
  generiche delle Milestone 16-18 di `PIANO_DI_LAVORO.md`. Prima di ogni
  milestone leggere il nuovo piano e fermarsi per verifica/revisione prima di
  proseguire alla successiva.
- Le decisioni contenute nel piano sono proposte progettuali finche' la
  Milestone P0 non le conferma. Non creare o applicare migration panel/scuole
  prima di quella verifica.


## Presenza comunicata nelle schede admin e manager — 2026-09-14

- La scheda condivisa include `OperationsAttendance`: lettura delle presenze
  correnti della singola iscrizione, griglia mattina/pomeriggio e stato da
  confermare, riusando `ManualAttendanceFields` del capogruppo. Caricamento
  indipendente con stato visibile; un errore non viene mostrato come assenza
  di presenze. Solo admin globale e manager dell'evento possono modificare;
  iscritti senza gruppo inclusi, eliminati esclusi. Filtri e scheda conservati.
- `updateOperationsAttendance` controlla i ruoli della sessione e rilegge le
  date dell'evento. La RPC `update_operations_attendance` ripete i controlli,
  blocca l'iscrizione e sostituisce le presenze insieme all'audit in transazione.
  Attore ricavato dal server, RPC riservata a service_role. Presenze capogruppo,
  snapshot originali, scelte dei momenti e RLS rimangono separati.
- Migration `20260914140000_operations_attendance.sql` applicata e registrata
  in produzione il 2026-09-14 su richiesta esplicita. Privilegi verificati:
  solo service_role può eseguire la RPC. Prova reale in transazione annullata:
  hash e conteggio delle 1.376 presenze invariati; 89 policy RLS invariate.
  Pubblicazione del codice tramite push su main e deployment Git Vercel.
- Regressioni: `tests/operations-attendance.test.mts` e
  `tests/sql/operations-attendance.sql`: scope evento, iscrizioni eliminate,
  errori lettura, date, audit atomico e privilegi RPC. Verificati anche i test
  SQL preesistenti del capogruppo. In copia pulita dal lockfile: 270 test,
  typecheck, lint e build superati.


## Andamento settimanale iscrizioni — 2026-09-21

- Le statistiche condivise Admin/Manager terminano con un grafico a barre delle
  schede non eliminate per `registrations.submitted_at`, senza sommare i minori.
  Il loader esistente conserva scope evento, paginazione ed errori bloccanti.
- `weekly-registrations.ts` raggruppa lunedì–domenica in Europe/Rome, include
  settimane a zero fino a quella corrente e segnala date mancanti/non valide.
  Dal 31 agosto 2026 le colonne sono settimanali; tutte le iscrizioni precedenti
  sono aggregate in una colonna storica esclusa dal confronto. Barre adiacenti
  con etichette giorno/mese inclinate di 45 gradi.
  Settimana corrente distinta e incompleta; confronto assoluto/percentuale
  limitato alle ultime due settimane concluse, senza percentuale su base zero.
- Test su confini temporali, ora legale, cambio anno, settimane vuote e loader
  oltre 1.000 schede. Nessuna migration o modifica dei dati richiesta.

- Decisione aggiornata il 2026-09-12: l'utente conferma il buon esito fino a
  P10 e mantiene P11-P16 sullo stesso branch `codex/panel-p0-p10` e staging.
  Conservare P0-P10 e le correzioni successive; non rinominare o ricreare il
  branch. Sostituita la precedente previsione di rilascio dopo P10 e ciclo
  separato P11-P16. Merge verso `main` e production restano rinviati fino a
  richiesta esplicita futura, anche dopo P16; prossima milestone P11.
- Il lavoro ordinario continua su `main`. Incorporare periodicamente
  `origin/main` nel branch panel con merge, mai rebase/reset/force push,
  dopo verifica e tutela del lavoro locale. Risolvere i conflitti conservando
  entrambe le evoluzioni, senza sostituzioni indiscriminate di file. Annotare
  SHA incorporato, conflitti, migration e regressioni nel piano panel.
  Non riscrivere migration già applicate; verificare ordine e dipendenze sullo
  staging. Il merge Git non autorizza né esegue applicazioni SQL remote.
- `PIANO_DI_LAVORO_PANEL.md`, sezione 2, definisce sincronizzazione e rilascio:
  test delle funzioni esistenti e nuove, RLS/concorrenza, inventario migration,
  backup e rollback. Le vecchie note datate P0-P10 sono storico delle tranche,
  non richieste di rifare quanto accettato; mantenere le evidenze di collaudo.
- Durante il bootstrap staging del 2026-08-05 e' stato rimosso il file
  ridondante `20260728120000_single_active_group_registration_link.sql`: aveva
  lo stesso timestamp di `20260728120000_single_group_registration_link.sql`
  ma ne conteneva soltanto un sottoinsieme. Production registra correttamente
  la versione `20260728120000` col nome `single_group_registration_link`; il
  file canonico e' quindi quello completo ancora presente nel repository.
- Il 2026-08-05 e' stato creato in Coolify l'ambiente `staging` del progetto
  `iscrizioni_pace_cool`, con stack Supabase indipendente
  `jiio6ou5wzmma2xwas53cf1d` e API HTTPS
  `https://supabase-staging-jiio6ou5wzmma2xwas53cf1d.91.99.81.31.sslip.io`.
  Lo stack ha database, Auth, Storage e chiavi distinti dalla production; tutte
  le migration canoniche fino alla P1 risultano applicate. Sono
  presenti soltanto utenti sintetici con domini `.example.invalid` per i ruoli
  admin, manager e partecipante. Non copiare dati personali dalla production.
- Su Vercel sono state configurate per l'ambiente `Preview`, senza modificare
  lo scope `Production`, le variabili Supabase staging, i segreti QR/cron e la
  consegna email in modalita' `log`. Le tre URL applicative
  `NEXT_PUBLIC_APP_URL`, `APP_URL` e `PUBLIC_SITE_URL` non vanno impostate con
  localhost: verranno aggiunte dopo il primo deploy del branch usando il suo
  URL Preview stabile. Nello stesso momento bisogna aggiungere quell'URL alla
  site URL/allowlist redirect di Supabase Auth staging. Fino ad allora login e
  callback Auth del deploy Preview non sono considerati collaudabili.
- `npm run dev:staging` e `npm run build:staging` eseguono prima il readiness
  check e poi avviano Next tramite `scripts/run-next-staging.mjs`. Non
  sostituirli con `node --env-file=.env.staging.local ...`: Next crea worker
  Node che rifiutano `--env-file` quando viene ereditato in `NODE_OPTIONS`.
- La Milestone panel P0 e' stata approvata il 2026-08-05. I pubblici iniziali
  sono `Iscritti`/`individual`, `Scuole`/`school_booking` e
  `Ospiti`/`internal_assignment`; partecipante e minori collegati consumano
  `1 + minori attivi` e condividono la scelta panel nella prima versione;
  `Ospiti` e' assegnabile soltanto internamente. Un panel pubblicato richiede
  location, intervallo valido e almeno una sezione; la somma delle sezioni puo'
  essere inferiore alla capienza fisica ma non puo' superarla. Le traduzioni
  restano applicative. Un pubblico disattivato
  resta nello storico e non e' aggiungibile a nuovi panel; questa possibilita'
  e' una tutela tecnica, non un caso d'uso che richiede enfasi nella UI.
- La Milestone P1 usa la migration
  `20260805160000_panel_foundation.sql` e il seed esclusivamente sintetico
  `supabase/seeds/panel-p1-staging.sql`. Estende le tabelle canoniche
  `event_locations` ed `event_moments`, mantiene compatibilita' con
  `is_public`, aggiunge `panel_audience_types` e `panel_seat_sections`, blocca
  sovrapposizioni di location e valida le capienze con constraint trigger
  differibili. Le bozze sono leggibili solo da admin/manager/manager_viewer;
  il pubblico legge soltanto panel pubblicati. Pubblicazione e ritiro sono
  auditati.
- Il 2026-08-05 migration, vincoli e seed P1 sono stati prima eseguiti sul
  database staging dentro transazioni terminate deliberatamente in rollback.
  I test reali hanno accettato configurazione e fixture valide e rifiutato
  totale errato, location sovrapposta e nuovo uso di un pubblico inattivo.
  Dopo questa revisione la versione `20260805160000` e' stata applicata e
  registrata soltanto nello staging, seguita dalla fixture sintetica: 2
  location, 3 pubblici, 3 panel pubblicati e 9 sezioni, senza errori di
  capienza. Un test RLS con rollback ha confermato che anon vede i tre panel
  pubblicati ma non le bozze e che `manager_viewer` legge le bozze. Bozza e
  ruolo temporanei non sono rimasti nel database. La REST API anon restituisce
  esattamente i tre panel sintetici. Production non contiene la migration P1.
- Il 2026-08-05 la Milestone panel P2 e' stata implementata localmente sul
  branch `codex/panel-p0-p10`, senza commit, push, deploy o migration remota.
  Admin, manager e manager viewer condividono la stessa sezione dashboard
  `Panel`, inizialmente composta dalla sottovista `Location`. La sottovista
  usa `event_locations` come fonte canonica, mostra nome, indirizzo, capienza
  e tutti i panel `event_moments` di tipo `panel` associati, con stato bozza o
  pubblicato; la ricerca copre anche i titoli dei panel. Su mobile le location
  sono card, da `md` in poi tabella.
- Creazione e modifica location usano le Server Actions
  `saveEventLocation`/`deleteEventLocation` e il componente condiviso
  `app/dashboard/panel-locations-section.tsx`. Nome e indirizzo sono limitati
  rispettivamente a 100 e 240 caratteri; la capienza deve essere un intero
  positivo. Le location legacy con `max_capacity` nullo restano visibili come
  `Capienza da definire` e possono essere completate dall'overlay. Una
  location e' eliminabile soltanto se nessun momento la usa. Il ruolo
  `manager_viewer` vede location e associazioni ma non riceve controlli di
  scrittura; le Server Actions verificano comunque admin globale o manager
  dello stesso evento.
- La capienza di una location collegata a panel pubblicati puo' essere cambiata
  soltanto se resta almeno pari alla somma dei posti delle sezioni di ogni panel
  collegato; la Server Action mostra un messaggio esplicito e il constraint
  trigger resta l'ultima protezione transazionale. Creazione, modifica ed
  eliminazione location producono audit `event_location.created`,
  `event_location.updated` ed `event_location.deleted` senza registrare
  l'indirizzo nei metadata.
- La migration P2 locale e'
  `20260805200000_panel_location_management.sql`: aggiunge i constraint di
  lunghezza/non-vuoto e la policy RLS di scrittura location per il solo ruolo
  `manager`; `manager_viewer` conserva la sola lettura. Al termine del lavoro
  locale del 2026-08-05 la migration non e' applicata ne' allo staging ne'
  alla production. Prima della revisione remota applicarla esclusivamente allo
  staging secondo `PIANO_DI_LAVORO_PANEL.md`.
- Il 2026-08-05 la Milestone P3 e' stata implementata localmente sul branch
  `codex/panel-p0-p10`, senza commit, push, deploy o migration remota. La
  sezione `Panel` usa ora due sottoviste condivise da admin e manager:
  `Panel`, predefinita, e `Location`. La tabella panel e' filtrabile per testo,
  stato, data e location; usa card su mobile e tabella da `md` in poi. Il ruolo
  `manager_viewer` consulta panel e quote in sola lettura.
- Le bozze panel si creano e modificano in overlay con titolo, descrizione,
  orari nel fuso `Europe/Rome`, location e righe dinamiche di sezioni. Titolo e
  descrizione sono limitati a 160 e 2000 caratteri; sono ammesse al massimo 20
  sezioni, ciascun tipo pubblico puo' comparire una sola volta e la capienza di
  sezione e' un intero non negativo. La bozza puo' essere salvata senza sezioni
  o con somma inferiore alla capienza, ma mai con una somma superiore; la UI
  mostra in tempo reale assegnati, capienza e differenza e disabilita il
  salvataggio in caso di eccedenza. Location e intervallo sono invece obbligatori e devono
  rientrare nelle date evento. La UI segnala subito le sovrapposizioni note e
  disabilita il salvataggio finche' orario o location non vengono corretti; il
  vincolo exclusion P1 resta la protezione definitiva.
- La migration P3 locale e'
  `20260805220000_panel_draft_management.sql`. Aggiunge i constraint di
  lunghezza per i panel e la RPC autenticata `public.save_panel_draft`, che in
  una sola transazione crea o aggiorna esclusivamente una bozza, sostituisce le
  sue `panel_seat_sections`, verifica scope evento/pubblici/location e registra
  audit `panel.draft_created` o `panel.draft_updated`. La funzione autorizza
  admin globale e manager dell'evento tramite `app.has_event_role`; non
  autorizza `manager_viewer`. Al termine del lavoro locale la migration non e'
  applicata ne' allo staging ne' alla production.
- Il 2026-08-05 la Milestone panel P4 e' stata implementata localmente sul
  branch `codex/panel-p0-p10`, senza commit, push, deploy o migration remota.
  La tabella panel permette al manager/admin di pubblicare una singola bozza o
  una selezione esplicita delle bozze filtrate; checkbox di riga e intestazione
  ignorano i panel gia' pubblicati. Il dialogo riepiloga numero e titoli e
  chiarisce che il batch e' atomico. Stato e data di pubblicazione sono
  visibili sia nelle card mobile sia nella tabella desktop. Il
  `manager_viewer` conserva la consultazione senza controlli di scrittura.
- La migration P4 locale e'
  `20260805230000_panel_publication_management.sql`. La RPC autenticata
  `public.publish_panels` blocca panel e sezioni, verifica scope, intervallo,
  location attiva, presenza delle sezioni e totale non superiore alla capienza
  per ogni elemento, quindi pubblica tutto nella stessa transazione. I retry sono idempotenti;
  oltre agli audit individuali `panel.published` gia' prodotti dalla P1, i
  batch con piu' elementi registrano `panel.batch_published`.
- I panel pubblicati sono modificabili con la RPC transazionale
  `public.save_published_panel`, che sostituisce contenuti e sezioni soltanto
  se la configurazione resta pubblicabile, impedisce che la capienza
  individuale scenda sotto le scelte `moment_attendance_choices` confermate di
  iscrizioni non annullate e registra `panel.published_updated`. L'audit
  contiene solo indicatori di modifica, orari/location e numero aggregato
  delle iscrizioni coinvolte, non dati personali. Prima della P6 le scelte
  canoniche non identificano ancora la sezione: il controllo usa quindi la
  somma delle sezioni col canale `individual`; la P6 dovra' rendere il vincolo
  puntuale sulla sezione quando estendera' le prenotazioni atomiche.
- L'overlay di modifica pubblicata mostra sempre quante iscrizioni confermate
  risultano coinvolte e segnala che il collegamento a campagne filtrate per
  panel verra' attivato dalla P9. Il salvataggio revalida anche la home per
  rendere immediatamente visibile il catalogo pubblico alle future UI P5.
  Test applicativi, lint, typecheck e build sono verdi; migration, RLS,
  concorrenza e UI autenticata restano da collaudare esclusivamente sullo
  staging prima di considerare conclusa P4. Il test transazionale predisposto
  e' `tests/sql/panel-publication-rollback-check.sql`: verifica rollback totale
  del batch invalido, batch valido, retry idempotente, modifica pubblicata,
  audit e rifiuto del `manager_viewer`, terminando con errore deliberato per
  annullare tutte le fixture. Production resta invariata.
- Dal 2026-08-07 la migration
  `20260807120000_allow_underfilled_panel_sections.sql` sostituisce la regola
  iniziale di uguaglianza esatta: i posti non distribuiti sono ammessi sia in
  bozza sia per panel pubblicati, mentre ogni eccedenza e' bloccata nella UI,
  nella Server Action e dai vincoli/RPC database. Le statistiche considerano
  incoerente soltanto il superamento della capienza, non una distribuzione
  inferiore. La migration e' stata applicata e registrata sullo staging il
  2026-08-07; il deploy Preview e' stato verificato con eccedenza bloccante e
  distribuzione inferiore consentita, senza salvare modifiche ai panel
  sintetici. Production resta invariata.
- Il 2026-08-05 la Milestone panel P5 e' stata implementata localmente sul
  branch `codex/panel-p0-p10`, senza commit, push, deploy o migration remota.
  La home anonima contiene ora una sezione programma accessibile e responsive,
  raggruppata per giorno nel fuso `Europe/Rome`, con titolo, descrizione,
  orario, location, indirizzo, stato disponibilita' e CTA verso il form email
  di accesso personale. La sezione e i metadata sono tradotti in italiano,
  inglese, francese, tedesco, spagnolo, neerlandese e ucraino; lo stato vuoto
  resta esplicito quando non esistono panel pubblicati.
- La migration P5 locale e'
  `20260806090000_public_panel_program.sql`. La funzione security-definer
  `public.get_public_panel_program()` restituisce soltanto i panel pubblicati
  dell'evento corrente e uno stato aggregato `available`, `full` o
  `unavailable` riferito al solo canale individuale. Non espone capienze,
  occupazione o quote scuola/ospiti. Nel calcolo provvisorio P5 ogni scelta
  confermata vale `1 + minori collegati`; la P6 dovra' aggiornare la funzione
  insieme alla nuova identificazione canonica della sezione. Se la RPC non e'
  ancora installata durante un rollout migration-first, la home mostra il solo
  stato programma in aggiornamento; errori diversi da `PGRST202` non vengono
  nascosti.
- Test applicativi, lint, typecheck, build e revisione browser dello stato
  vuoto sono verdi, inclusi responsive mobile e cambio italiano/inglese. Il
  test SQL staging predisposto e'
  `tests/sql/public-panel-program-rollback-check.sql`. Prima di considerare P5
  conclusa bisogna applicare la migration esclusivamente allo staging e
  collaudare card reali, bozze invisibili, stato completo e tutte le lingue.
  Production resta invariata.
- Il 2026-08-05 la Milestone panel P6 e' stata implementata localmente sul
  branch `codex/panel-p0-p10`, senza commit, push, deploy o migration remota.
  La migration locale e'
  `20260806120000_individual_panel_bookings.sql`: estende la tabella canonica
  `moment_attendance_choices` con `seat_section_id`, senza creare una seconda
  tabella prenotazioni, e aggiunge le RPC autenticate
  `get_participant_panel_catalog` e `set_individual_panel_booking`. La scelta
  self-service e la cancellazione sono idempotenti; la prenotazione blocca in
  ordine registrazione, panel e sezioni, ricontrolla evento/panel/pubblico,
  sezione `individual`, capienza e sovrapposizioni nella stessa transazione e
  registra audit senza dati personali.
- Ogni scelta individuale confermata occupa dinamicamente `1 + minori
  collegati`. I constraint trigger P6 impediscono sia di ridurre una sezione
  pubblicata sotto l'occupazione reale sia di aggiungere minori oltre la
  capienza gia' prenotata. La dashboard partecipante sostituisce i minori con
  la RPC transazionale `replace_owned_registration_children`, così una
  modifica del nucleo non puo' lasciare una sostituzione parziale. Le scelte
  dei panel non vengono piu' reinviate nei campi hidden dei form anagrafici:
  quei form preservano soltanto le scelte dei momenti generali, mentre i panel
  passano sempre dalla RPC atomica dedicata.
- L'area partecipante mostra panel pubblicati e sezioni individuali, scelte
  correnti, data/ora/location, numero di posti richiesti dal nucleo e stato
  `Disponibile`, `Completo` o conflitto; i testi sono presenti in tutte le
  sette lingue supportate. Il conteggio pubblico P5 e' stato sostituito con un
  calcolo puntuale per sezione senza esporre capienza o occupazione. Test
  applicativi, lint, typecheck e build sono verdi. Il test SQL con rollback
  predisposto e' `tests/sql/individual-panel-bookings-rollback-check.sql`;
  migration, RLS, ultimo posto concorrente, doppio click e UI autenticata
  desktop/mobile devono essere collaudati esclusivamente sullo staging prima
  di considerare P6 conclusa. Production resta invariata.
- Il 2026-08-05 e' stata avviata la Milestone panel P7 sul branch
  `codex/panel-p0-p10`, senza applicazione remota, commit o push. La migration
  locale `20260806160000_school_panel_bookings.sql` introduce entita' separate
  per docenti (`school_booking_teachers`), prenotazioni di classe
  (`school_bookings`), righe panel (`school_panel_reservations`) e QR opachi di
  gruppo (`school_booking_qr_tokens`): non crea partecipanti o iscrizioni
  individuali fittizie e non raccoglie identita' degli studenti. Il docente e'
  deduplicato per evento ed email normalizzata; una sessione autenticata
  possiede le prenotazioni che corrispondono all'email verificata del JWT,
  mentre manager/admin gestiscono e `manager_viewer` legge soltanto.
- Le RPC P7 `save_school_booking` e `cancel_school_booking` bloccano panel e
  sezioni in ordine stabile, accettano esclusivamente sezioni col canale
  `school_booking`, sostituiscono atomicamente le righe prenotate, bloccano
  sovrapposizioni e overbooking, liberano i posti all'annullamento e revocano
  il QR attivo. La capienza canonica di una sezione ora somma anche le
  prenotazioni scuola, mantenendo compatibilita' con i controlli P6. Le azioni
  producono audit aggregato senza email, telefono, nome scuola o nomi studenti.
- Il backoffice condiviso admin/manager aggiunge la sottovista `Scuole` nella
  sezione `Panel`, con ricerca, filtri per stato/panel, tabella scuola-docente-
  panel-quantita', overlay di creazione/modifica/annullamento e vista read-only
  per `manager_viewer`. La creazione manuale richiede che l'operatore dichiari
  il consenso privacy del docente e genera un QR gruppo opaco. Prima di
  considerare P7 conclusa restano obbligatori verifica RLS tramite API,
  concorrenza reale sullo staging e collaudo browser desktop/mobile.
- Il test SQL P7 e' `tests/sql/school-panel-bookings-rollback-check.sql`. Il
  2026-08-05 e' stato eseguito sul database staging dopo aver caricato P2-P7
  nella stessa transazione non persistente: ha confermato sovrapposizione
  rifiutata, quota scuola piena, riuso dello stesso docente per piu' classi,
  annullamento con rilascio posti, proprieta' tramite email verificata e rifiuto
  dell'utente estraneo. La transazione e' terminata in rollback e nello staging
  resta applicata soltanto P1; per il collaudo browser bisogna applicare
  ordinatamente P2-P7 allo staging, mai alla production in questa fase.
- Il 2026-08-06 e' stata avviata localmente la Milestone panel P8 sul branch
  `codex/panel-p0-p10`. La migration
  `20260806190000_public_school_booking_flow.sql` aggiunge la creazione
  pubblica atomica delle prenotazioni sulla sola quota `school_booking` e il
  collegamento dell'identita' docente dopo verifica email. La route `/scuole`
  raccoglie una classe/gruppo per prenotazione senza dati degli studenti;
  conferma, QR e magic link sono inviati come email transazionale. La route
  `/dashboard/docente` consente alla stessa email verificata di consultare piu'
  classi, correggere/ridurre posti, annullare e scaricare il QR. La prima
  tranche non e' ancora stata applicata allo staging: prima della revisione
  completare testi docente multilingua, test SQL con rollback e collaudo
  browser mobile/accessibile. Nessuna modifica P8 e' in production.
- Il 2026-08-06 e' stata avviata localmente la Milestone panel P9 sul branch
  `codex/panel-p0-p10`. La console campagne ha ora il filtro cercabile `Panel`
  nella tab partecipanti, derivato dalle sole scelte canoniche correnti
  `moment_attendance_choices.choice = 'yes'` con sezione panel, senza usare tag
  o snapshot. La nuova audience alternativa `Professori` deduplica per
  `school_booking_teachers`, include soltanto docenti con prenotazioni
  submitted/confirmed e riserve panel attive, mostra scuole e panel e offre i
  relativi filtri. Cambiare audience azzera sempre la selezione; cambiare
  filtri non la azzera e la checkbox di intestazione continua ad agire sulle
  sole righe filtrate.
- La migration P9 locale e'
  `20260806200000_panel_campaign_audiences.sql`: aggiunge a
  `email_campaign_recipients` il target tipizzato `teacher`, il riferimento
  `school_teacher_id` e il delivery kind dedicato, preservando coda globale,
  recipient key esplicite e log senza indirizzi/corpi in chiaro. I template
  campagne supportano anche `{{scuola}}` e `{{panel}}`; per audience diverse i
  valori non pertinenti restano vuoti. Test (192), lint, typecheck, build e
  collaudo browser della console demo sono verdi. Prima di chiudere P9 restano
  applicazione ordinata P2-P9 sullo staging, verifica SQL/RLS e collaudo
  end-to-end autenticato in delivery mode `log`; production resta invariata.
- Il 2026-08-07 e' stato eseguito un audit locale complessivo delle Milestone
  panel P0-P9 rispetto a `PIANO_DI_LAVORO_PANEL.md`. La sostituzione dei minori
  in P6 ora blocca prima la registrazione proprietaria, nello stesso ordine
  della prenotazione individuale, così aggiornamento del nucleo e ultimo posto
  non possono calcolare contemporaneamente dimensioni diverse. In P8 il form
  pubblico riceve le opzioni scuola dalla RPC security-definer
  `get_public_school_booking_options`, che non restituisce capienza o
  occupazione; la lettura anonima diretta di `panel_seat_sections` e' revocata
  e la policy SELECT resta soltanto operativa. Accesso, conferma e dashboard
  docente usano testi completi per tutte le sette lingue supportate.
- Nello stesso audit P9, tutte le operazioni della route campagne verificano
  lato server che il manager sia assegnato all'evento della campagna; l'admin
  conserva il perimetro globale. La console carica in parallelo cataloghi e
  audience, propone soltanto panel pubblicati con label data/ora univoca e usa
  mappe indicizzate per renderizzare i nomi. La modifica di un panel pubblico
  con iscritti offre la scorciatoia alla console campagne con quel panel gia'
  prefiltrato, mantenendo comunque vuota la selezione esplicita dei
  destinatari.
- L'audit dipendenze del 2026-08-07 ha aggiornato in modo coordinato Next.js ed
  `eslint-config-next` a 16.3.0, React/React DOM a 19.2.8 e il plugin PostCSS di
  Tailwind a 4.3.3. `npm audit` non segnala vulnerabilita'. Sono verdi 192 test,
  lint, typecheck, `staging:verify`, build production e verifica browser locale
  di home, accesso scuola italiano/inglese e conferma email fallita, senza
  overlay o errori console. Le migration P2-P9 non sono state applicate
  persistentemente allo staging o alla production durante questo audit.
- Il 2026-08-07 e' stata avviata localmente la Milestone panel P10 sul branch
  `codex/panel-p0-p10`, senza migration remota, commit, push o deploy. La
  sezione `Statistiche` condivisa da admin e manager contiene ora per prima la
  vista decisionale panel: capienza, prenotati e residui per panel, dettaglio
  per sezione/pubblico e conteggi distinti di partecipanti individuali,
  minori che ereditano la scelta, prenotazioni scuola e persone scuola. La
  fonte resta canonica: `moment_attendance_choices` confermate con
  `seat_section_id`, minori correnti di `registration_children` e riserve
  `school_panel_reservations` attive; iscrizioni e prenotazioni annullate non
  occupano posti. La lettura server e' paginata e il payload del report non
  contiene identita' o contatti.
- Gli stati P10 sono `Disponibile`, `Quasi pieno`, `Pieno`, `Non configurato`
  e `Incoerente`; `Quasi pieno` parte dal 90% di occupazione e viene calcolato
  soltanto con capienza positiva. Capienza zero non produce percentuali. I
  filtri coprono giorno, location, panel, tipo pubblico e stato. Ogni riga
  collega alla gestione panel; la campagna prefiltrata compare solo per panel
  pubblicati e utenti con gestione evento. `manager_viewer` consulta lo stesso
  report e il dettaglio panel in sola lettura, senza CTA campagna.
- Il confronto P10 tra previsto, effettivo e no-show e' predisposto nel tipo
  dati ma resta nullo finche' P11 non introduce il modello completo di
  check-in per adulto, minori e scuole. Non usare i `check_ins` legacy per
  mostrare un confronto parziale. Prima di chiudere P10 restano applicazione
  ordinata P2-P9 esclusivamente allo staging, collaudo dei conteggi su fixture
  sintetiche e verifica browser autenticata per admin, manager e
  `manager_viewer`. Sono verdi 195 test, lint, typecheck, `staging:verify` e
  build production locale. Production resta invariata.
- Il 2026-08-07 le migration panel P2-P9 sono state applicate e registrate in
  ordine esclusivamente sul database staging. La migration P8 usa ora `drop
  policy if exists` sia per la policy pubblica precedente sia per quella
  operativa, cosi' il passaggio resta idempotente anche se la policy RLS e'
  gia' stata aggiornata durante un tentativo precedente. Home e `/scuole`
  mostrano i tre panel sintetici P1 senza errori console. Il branch
  `codex/panel-p0-p10` usa l'alias Preview stabile
  `https://iscrizioni-pace-git-codex-pan-f98a13-giovaniperlapaces-projects.vercel.app`:
  `NEXT_PUBLIC_APP_URL`, `APP_URL` e `PUBLIC_SITE_URL` sono limitate a quel
  branch nello scope Vercel Preview; GoTrue staging usa lo stesso site URL e
  accetta callback dall'alias e da localhost. Production e `main` non sono
  stati modificati. Restano da completare collaudo autenticato dei ruoli,
  test SQL/RLS e concorrenza e verifica dei conteggi P10.



## Andamento settimanale iscrizioni — 2026-09-21

- Le statistiche condivise Admin/Manager terminano con un grafico a barre delle
  schede non eliminate per `registrations.submitted_at`, senza sommare i minori.
  Il loader esistente conserva scope evento, paginazione ed errori bloccanti.
- `weekly-registrations.ts` raggruppa lunedì–domenica in Europe/Rome, include
  settimane a zero fino a quella corrente e segnala date mancanti/non valide.
  Dal 31 agosto 2026 le colonne sono settimanali; tutte le iscrizioni precedenti
  sono aggregate in una colonna storica esclusa dal confronto. Barre adiacenti
  con etichette giorno/mese inclinate di 45 gradi.
  Settimana corrente distinta e incompleta; confronto assoluto/percentuale
  limitato alle ultime due settimane concluse, senza percentuale su base zero.
- Test su confini temporali, ora legale, cambio anno, settimane vuote e loader
  oltre 1.000 schede. Nessuna migration o modifica dei dati richiesta.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Indicatore email delegata — 2026-09-25

- Colonna Email Capogruppo e Manager/Admin/Viewer: badge nelle sette lingue
  soltanto per la scelta documentata nello snapshot manuale. Email personale
  attuale prioritaria; email assente senza scelta resta «—».
- Loader paginato limitato agli ID già autorizzati, sole proiezioni origine/flag;
  errori bloccanti. Nessuna modifica dati, schema, permessi, invio o export.
- Test e fixture browser in `tests/email-delegation-indicator.test.mts` e
  `tests/browser/email-delegation.mjs`; dettagli in `docs/email-delegation-indicator.md`.
  Verificati 541 test, lint, TypeScript e build production con npm ci in copia
  pulita. Browser: tre tabelle, sette lingue e mobile; provata insieme alla
  nuova animazione dell’export capogruppo. Overlay e correzione conteggi del
  commit a25fba9 conservati. Commit/push su main autorizzati dall’utente;
  correzione separata degli errori presenze esclusa dal rilascio.

## Errore presenze fuori dalla griglia — 2026-09-25

- Il fieldset condiviso delle presenze assistite identifica un contenitore per
  gli errori: ReliableForm appende il messaggio sotto griglia e opzione di
  conferma successiva, preservando stile comune e dimensioni delle caselle.
  aria-describedby collega il messaggio sia alle fasce sia all’opzione futura.
- Nessuna modifica a validazione, dati o invii. Fixture sintetica
  `tests/browser/attendance-error-placement.mjs` verifica posizione, dimensioni,
  accessibilità e accettazione di entrambe le scelte per capogruppo/manager,
  nelle sette lingue e su mobile. Commit/push su main autorizzati dall’utente
  il 25 settembre insieme all’import servizi. Verificati insieme 559 test,
  lint, TypeScript e build con npm ci in copia pulita.

## Iscrizione multipla capogruppo ai panel — 2026-09-09

- La dashboard capogruppo offre `Iscrizioni ai panel`, pagina dedicata
  `/dashboard/capogruppo/panel`: prima si sceglie un panel/sezione individuale,
  poi si selezionano iscrizioni correnti dei propri gruppi e discendenti attivi.
  Nome/codice e gruppo filtrano solo la vista; la checkbox generale agisce sui
  partecipanti disponibili filtrati e preserva le selezioni nascoste. Cambiare
  panel azzera la selezione. Un riepilogo nominale precede la conferma.
- Le RPC autenticate `get_group_panel_booking_view` e `book_group_panel`, nella
  migration `20260909120000_group_panel_bookings.sql`, verificano autonomamente
  evento corrente, membership capogruppo e scope ricorsivo. Nessun actor id o
  service role viene passato dal client. Manager/manager_viewer con membership
  restano esclusi (salvo admin); gli admin usano comunque lo scope delle proprie
  membership in questa vista. Nessuna nuova policy amplia l'accesso alle tabelle.
- Le prenotazioni riusano `moment_attendance_choices` e le sezioni individuali.
  Un lotto e' atomico: gruppi non autorizzati, iscrizioni annullate/eliminate,
  panel indisponibile, sovrapposizioni o capienza insufficiente annullano tutto.
  Il lock segue registrazioni ordinate, assegnazioni, panel e sezione; i minori
  collegati consumano posti tramite `app.registration_panel_party_size`.
  Duplicati e persone gia' prenotate sono idempotenti. Audit per iscrizione:
  `panel.group_booking_confirmed`. Nessun invio email automatico.
- Test funzionali SQL reversibili:
  `tests/sql/group-panel-bookings-rollback-check.sql`. Fixture sintetica per
  collaudo UI esclusivamente staging:
  `supabase/seeds/group-panel-dashboard-staging.sql` (4 adulti, 1 minore,
  gruppo `Test iscrizioni panel`). L'account staging dedicato e'
  `capogruppo.panel.staging@example.invalid`, con membership sul nodo Italia.
- Il 2026-09-09 e' stato integrato `origin/main` nel branch panel, preservando
  panel/scuole e aggiornando le dashboard con le modifiche recenti di main.
  Le migration mancanti da `20260822100000` a `20260908180000` e le nuove RPC
  sono state applicate solo allo staging. La migration dati
  `20260813170000_rename_anziani_and_amici_groups.sql` non e' applicabile alla
  fixture staging (mancano i gruppi sorgente); il tentativo e' stato annullato
  e non e' stato registrato come riuscito. La route `scuole` e' stata aggiunta
  agli slug riservati nell'app e nella migration `20260909121000`.
- Diagnosi accesso: il certificato staging e' valido sul server `91.99.81.31`.
  Il resolver locale della postazione restituiva invece `151.5.216.190` per
  l'hostname sslip.io. Per le operazioni di diagnosi e preparazione account e'
  stato usato l'IP verificato mantenendo SNI e verifica HTTPS; nessuna modifica
  al DNS globale e nessuna disattivazione della verifica certificati.

### Navigazione e stile panel capogruppo — 2026-09-09

- `LeaderSectionNavigation` condivide tra elenco partecipanti e pagina panel
  il menu a due schede con icone, stato attivo e `aria-current`, coerente con
  le sezioni della gestione iscritti. Sostituisce pulsante isolato e link indietro.
- La vista panel usa pulsanti `btn-primary`/`btn-secondary`, token bordo
  `--peace-border`, icone per luogo/orario e aggiornamento, evidenziazione delle
  righe selezionate e badge della disponibilita'.
- `Aggiorna disponibilità` ha una descrizione in sette lingue, alla sua destra
  e sotto su mobile, collegata con `aria-describedby`. Spiega il ricaricamento
  dei posti/iscrizioni e l'azzeramento della selezione. Comportamento e RPC
  invariati; nessuna migration.

- Il selettore panel riunisce titolo, data, inizio/fine, sala e pubblico. Non
  ripetere questi dettagli sotto il selettore: la riga sottostante contiene
  soltanto i posti disponibili, allineati a sinistra anche su mobile.

### Azioni per partecipante nei panel — 2026-09-09

- Sostituiscono la selezione multipla e il riepilogo: ogni riga mostra lo stato
  `Iscritto`/`Non iscritto` separato dal pulsante `Disiscrivi`/`Iscrivi`.
  Sovrapposizione e posti insufficienti sono motivi espliciti di disabilitazione.
  Feedback nella riga, blocco delle azioni durante il salvataggio, refresh anche
  dopo errori per aggiornare disponibilità e stato; filtri conservati.
- `setGroupPanelBooking` passa una sola iscrizione e uno stato desiderato
  booleano alla RPC autenticata `set_group_panel_booking`, mai un toggle.
  La prenotazione riusa i controlli atomici di `book_group_panel`; la rimozione
  ricontrolla evento, membership, scope e iscrizione attiva sotto lock,
  aggiorna la scelta a `no` e libera la sezione effettivamente prenotata.
  I figli seguono il genitore in entrambe le operazioni. Retry idempotenti;
  audit `panel.group_booking_cancelled` solo quando la scelta cambia.
- Migration `20260909210000_group_panel_row_actions.sql`: nessun ampliamento
  RLS, nessun invio email. Test SQL con rollback in
  `tests/sql/group-panel-bookings-rollback-check.sql`: rimozione, figli,
  nuova iscrizione, capienza, sovrapposizioni, scope, viewer e anon.
- La descrizione di Aggiorna disponibilità riguarda solo posti e iscrizioni:
  non esiste più una selezione da azzerare. Testi e azioni in sette lingue.

- Su richiesta dell’utente, niente messaggi di successo dopo iscrizione o
  rimozione: stato, pulsante e posti aggiornati confermano l’esito. Restano
  gli errori nella riga interessata.

## Scuole: posti disponibili per Forum — 2026-10-20

- `/scuole`: badge in sette lingue con il residuo della sola quota scolastica,
  studenti e accompagnatori inclusi nell'occupazione; disponibilità al caricamento
  e ricontrollo atomico all'invio conservato. Forum esauriti esclusi come prima.
- RPC aggiuntiva che riusa il catalogo/gate canonici; migration `20261020234000`
  applicata in production dopo backup verificato. Nessuna modifica ai dati operativi.
- 986 test, lint, TypeScript, build isolata, SQL e browser desktop/mobile superati.
  Dettagli: `docs/scuole-posti-disponibili-2026-10-20.md`.

## Forum: ordine numerico condiviso — 2026-10-20

- Tutti gli elenchi/selettori Forum usano `lib/panels/forum-order.ts`: numero
  prima dell'orario, titoli non numerati dopo, ordine quote stabile. Conservati
  raggruppamenti per sessione e prenotati/disponibili e cronologia eventi generali.
- Inclusi scuole/docente, partecipante/capogruppo, pubblico/anteprima,
  gestione/pubblicazione, statistiche, sedi, filtro email e incarichi.
- 991 test, lint, TypeScript, build isolata, browser originali desktop/mobile
  e regressioni scuole su DB temporaneo superati; nessuna migration necessaria.
  Dettagli: `docs/forum-ordine-numerico-2026-10-20.md`.

## Forum: lista d’attesa e stato pieno nelle statistiche — 2026-10-20

- Gestione Forum e statistiche Admin/Manager: conteggi persone, minori selezionati
  inclusi; coda e offerte valide distinte, totale esplicitamente per Forum.
- Stato e percentuale sulle quote prenotabili iscritti/scuole, escluse quote
  ospiti; offerte valide occupano posti. Soli posti ospiti liberi = Pieno.
- Letture paginate dopo gate evento/ruolo, soli aggregati serializzati; nessuna
  migration o estensione permessi. Verificati test, browser desktop/mobile e
  avanzamento automatico reale FIFO con due offerte da 60 minuti al Forum 4.
  Dettagli: `docs/forum-attesa-statistiche-2026-10-20.md`.

## Forum: Iscritti include lista d’attesa — 2026-10-21

- Modale Iscritti Admin/Manager: confermati e lista d’attesa nominale distinti;
  FIFO, soli minori selezionati e offerte valide con scadenza Rome.
- Excel con foglio Lista attesa e contatori separati; prenotati non includono
  persone in coda/offerte. Scope evento/ruoli conservato, nessuna migration.
- 997 test, lint, TypeScript, build, browser Admin/Manager desktop/mobile e
  riconciliazione in sola lettura con dati reali. Verbale:
  `docs/forum-iscritti-lista-attesa-2026-10-21.md`.

## Statistiche Forum: attesa senza prenotazione — 2026-10-21

- Riquadro Minori prenotati sostituito dal totale evento di persone uniche in
  almeno una coda attiva senza posto confermato nella stessa fascia/giorno Rome.
- Minori selezionati valutati individualmente, offerte valide incluse; deduplica
  anche fra più Forum/fasce, prenotazioni alternative cercate nell’intero evento.
- Solo Admin/Manager e aggregato; nessuna migration. 999 test, build e browser,
  riconciliazione SQL live in sola lettura. Dettagli in
  `docs/forum-attesa-senza-prenotazione-2026-10-21.md`.

## Statistiche Forum: destinatari email dai contatori — 2026-10-21

- «Iscritti senza alcun Forum» sostituisce il contatore scuole; persone uniche,
  minori verificati nominalmente. Icona mail su questo e «In attesa senza Forum
  nella stessa fascia», solo Admin/Manager, destinatari raggiungibili preselezionati.
- Contatti adulti per minori e deleghe conservati; filtri server e controllo fresco
  prima dell'invio. Nessun invio automatico o migration. Verifiche in
  `docs/forum-contatori-email-2026-10-21.md`.
