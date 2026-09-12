# AGENTS.md

Questo file e' la memoria operativa stabile per Codex e per futuri agenti che lavoreranno su questa app. Deve restare aggiornato quando cambiano architettura, workflow, comandi, schema dati, ruoli, policy RLS o decisioni importanti.

Quando lo sviluppo principale sarà concluso, `PIANO_DI_LAVORO.md` potrà essere cancellato. A quel punto questo file dovra' contenere tutto il contesto necessario per implementare funzioni accessorie, correggere bug e fare manutenzione senza dover ricostruire la storia del progetto.

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
- Dal 2026-07-23 l'accesso alle dashboard per `manager` e `manager_viewer` e'
  esclusivo: dopo il login questi ruoli entrano sempre nella dashboard manager
  e non vedono né possono aprire la dashboard capogruppo o l'area personale,
  anche quando l'account possiede una membership capogruppo o una scheda
  partecipante. Un eventuale ruolo `admin` mantiene invece l'accesso completo
  alle aree delegate. Dal 2026-07-26 questa distinzione vale anche dentro la
  dashboard manager: il navigatore tra dashboard viene mostrato quando
  l'utente e' admin, cosi' puo' tornare ad admin, accoglienza, capogruppo o area
  personale durante test e assistenza; per `manager` e `manager_viewer` resta
  nascosto e la dashboard manager continua a essere l'unica area accessibile.
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
- L'inserimento manuale non invia email automatiche al partecipante.
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
- `manager_viewer`: vede ciò che vede il manager ma non modifica iscrizioni.
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
