# Riallineamento panel con main — 9 ottobre 2026

Richiesta dell’utente: integrare main nel branch `codex/panel-p0-p10`, conservando
le correzioni del gestionale, le funzioni future, scanner, cerimonie e gli stash
del collaudo. Merge locale di `origin/main` `a8583404e4453bf6d250e28e3c9498e006d40ff9`
nel panel `42bfccad28f04ccfe5b9b4f40a0b5c5f206e6558`. Nessun rebase, reset, nuovo
branch o ripristino degli stash; main e produzione restano invariati.

## Riconciliazione

Risolti 16 file in conflitto confrontando entrambi i branch. AGENTS e piano
conservano le decisioni main più recenti e lo storico P11–P13, QR gruppo e
cerimonie E1/E2/E3. Le esclusioni storiche della lista d’attesa sono superate
dalla richiesta del 9 ottobre; la relativa milestone resta da realizzare.

- Gestionale condiviso Admin/Manager: icona microfono da tavolo, Iscritti ed
  Excel, ordinamento alfabetico e quote, giorno unico e orari, Quando,
  Bozza/Pubblicato/Pubblica panel, avanzamento link e conferme temporanee.
- Catalogo e disponibilità usano il client autenticato: la RPC di occupazione
  mantiene l’identità per i controlli DB. Verifica di regressione per entrambi
  i dashboard; letture solo per la sezione visualizzata.
- Statistiche con categoria Panel dedicata, visibile ad Admin/Manager, conservando
  le presenze evento e i conteggi reali P13 separati dalle prenotazioni. Nessun
  vecchio avviso su una futura P11: gli stati di errore dei dati reali restano.
- Scuole nella vista Partecipanti, presenze effettive e ritorno alla sezione
  originaria conservati; conferme di salvataggio con SuccessMessage.
- Permessi main su loader, action, export e campagne conservati. Panel pubblici,
  scuole pubbliche e prenotazioni Capogruppo restano chiusi in modalità internal;
  i flussi futuri restano nel codice, abilitabili mediante apertura esplicita.
- QR gruppo, scanner, coda badge, incarichi panel/sala e cerimonie E1/E2/E3
  conservati. I file dedicati in lib/reception, lib/ceremonies e nelle rispettive
  route sono identici al panel precedente. Le migration storiche non sono riscritte.

## Conservazione Git

I due stash mantengono gli stessi oggetti e descrizioni, senza pop/apply/drop:

- `fa1ec7fa339a2b944045bf67e90cc2a1e9efec85`: collaudo etichette e annotazioni,
  da ripristinare soltanto sul panel quando si riprende il collaudo.
- `2ad9881b78efd0798221c4bf118dffc207d14acf`: nota migration produzione.

Il merge preserva tutta la storia di entrambi i branch. Nessuna modifica al
worktree delegato; nessun push, deployment o SQL remoto in questo riallineamento.

## Verifica e staging

Verificati dipendenze dal lockfile con npm ci, 807 test applicativi in
Europe/Rome, ESLint, TypeScript e build:staging con readiness superata.
Verifiche delle viste tramite rendering sintetico e test dei loader; nessun
nuovo collaudo browser o hardware dichiarato.

Il runner SQL temporaneo applica tutte le migration canoniche, esclusa solo la
rinomina storica priva di prerequisiti nella fixture. Superati i controlli
Admin/Manager/Viewer, manager di altro evento, ruoli cumulativi, confini
internal/catalog/open, scuole e occupazione dei minori. Conservati check-in
legacy; superati scanner evento, report, QR gruppo, coda badge, cerimonie,
ultimo posto concorrente, correzioni concorrenti e retry identici. Il cluster
PostgreSQL temporaneo viene arrestato e rimosso dal runner. Nessun dato reale,
email o sessione autenticata remota usata nei test.

Inventario staging ricontrollato in sola lettura: assenti le cinque migration
importate dal rilascio main del 9 ottobre:

- `20261009120000_reserved_panel_release.sql`
- `20261009140000_admin_panel_acceptance.sql`
- `20261009150000_panel_default_audiences.sql`
- `20261009160000_admin_panel_campaign_writes.sql`
- `20261009170000_manager_panel_access.sql`

Rimane inoltre assente `20260813170000_rename_anziani_and_amici_groups.sql`,
non applicabile e non dipendenza delle funzioni panel. Questo riallineamento
non applica migration remote: aggiornare lo staging con il lotto appropriato
prima di pubblicare e collaudare la versione integrata. Le migration scanner,
QR gruppo e cerimonie precedenti risultano già registrate. La precedente
accettazione hardware rimane aperta.
