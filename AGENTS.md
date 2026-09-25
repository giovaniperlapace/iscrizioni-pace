# AGENTS.md

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
  autorizzati dall’utente. Correzione locale separata degli errori presenze esclusa.

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

- Server: `91.99.81.31`, accesso SSH riuscito come `root` con chiave locale `~/.ssh/id_ed25519_hetzner_20260613`.
- Progetto Coolify: `iscrizioni_pace_cool`.
- Servizio Coolify: `supabase-ammnuajlmd83t94cfy3us6cw`.
- Network Docker Supabase: `ammnuajlmd83t94cfy3us6cw`.
- Container database: `supabase-db-ammnuajlmd83t94cfy3us6cw`.
- La Supabase CLI `2.106.0` e' stata installata sul server in `/usr/local/bin/supabase`.
- La CLI raggiunge il DB interno ma fallisce con TLS verso Postgres self-hosted; la migration e' stata applicata con `psql` dentro il container database.
- La versione e' registrata in `supabase_migrations.schema_migrations` come `20260613120000:initial_schema_and_rls`.

Procedura rapida per migration future su questo Supabase self-hosted:

- Creare una nuova migration versionata in `supabase/migrations/<timestamp>_<nome>.sql`.
- Verificare staticamente il diff SQL e non inserire segreti o dati personali.
- Applicare la migration con:

```bash
./scripts/apply-remote-migration.sh supabase/migrations/<timestamp>_<nome>.sql
```

- Lo script usa `.env.local` se presente, altrimenti i default operativi già noti: SSH `root@91.99.81.31`, chiave `~/.ssh/id_ed25519_hetzner_20260613`, container `supabase-db-ammnuajlmd83t94cfy3us6cw`.
- Lo script copia il file SQL sul server, lo applica con `psql` dentro il container DB, registra la versione in `supabase_migrations.schema_migrations` e invia `notify pgrst, 'reload schema'`.
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
