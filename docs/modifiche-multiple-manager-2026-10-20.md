# Modifiche multiple e filtri Manager — 20 ottobre 2026

## Valutazione e comportamento

Le tre richieste sono coerenti con la gestione attuale. Implementate nella tabella condivisa Admin/Manager, entro l'evento autorizzato; Viewer può usare i filtri ma non modificare dati.

- Selezione esplicita di singoli iscritti o dei soli iscritti nella pagina (massimo 100). Cambio pagina, filtri o composizione della pagina azzera la selezione. Riepilogo dell'operazione e nomi prima della conferma.
- **Aggiungi tag** conserva gli altri tag, anche se aggiunti nel frattempo da un'altra postazione. **Assegna gruppo/servizio** sostituisce il valore precedente con un'opzione valida dell'evento. La selezione riguarda le iscrizioni degli adulti: i minori seguono il gruppo d'iscrizione ma non ricevono tag/servizi autonomi.
- Ogni lotto è una sola transazione. ID duplicati, mancanti, eliminati, di un altro evento, opzioni non valide o errori intermedi annullano tutto. Riutilizzo della RPC canonica per cronologia gruppi, stato servizio, scope e audit per iscrizione; lock delle iscrizioni ordinati.
- Filtri combinabili: **Giorni di presenza comunicati** (tutti/comunicati/da comunicare), **Presente nella mezza giornata**, **Non presente nella mezza giornata**. Si riferiscono alle scelte comunicate, non ai check-in. Una scelta storica per l'intera giornata vale per entrambe le metà; assenza di scelte o `unknown` non diventa assenza. Seguono le stesse regole della tabella attuale.
- Filtri applicati all'insieme autorizzato prima della paginazione, e anche agli export Excel. Le letture presenze sono paginate per ID; un errore non produce assenze inventate. URL e percorsi di ritorno conservano i nuovi filtri.
- **Elimina un tag** richiede una conferma distinta che esplicita la rimozione da tutti i partecipanti dell'evento, anche fuori da pagina, selezione e filtri. Cancellazione del catalogo e delle assegnazioni atomica tramite FK esistente; audit con etichetta, colore e numero di assegnazioni rimosse. Il tag eliminato non è più assegnabile.

## Sicurezza e migrazione

Nuovo endpoint HTTP same-origin `participants/bulk-update`, attore ricavato dalla sessione; RPC esclusivamente service-role. Autorizzazione Admin globale o Manager dell'evento riletta nel DB. Nessuna nuova autorizzazione RLS né ampliamento di ruoli.

Migration: `20261020160000_manager_bulk_operations.sql`. Aggiunge soltanto due funzioni, `bulk_update_registration_operation` e `delete_operational_tag`, con i relativi grant service-only. Nessuna trasformazione dei dati esistenti. Applicare la migration prima del codice al rilascio, seguendo la procedura di backup e verifica production del progetto.

## Verifiche

- 972 test applicativi superati, inclusi nuovi casi di filtro, 5.005 iscrizioni prima della paginazione, errori di lettura, parità export, origine HTTP, attore non falsificabile e validazione dei lotti.
- Lint, TypeScript e build production da `npm ci` in copia senza credenziali superati.
- `node tests/sql/run-manager-bulk.mjs`: PostgreSQL locale temporaneo, fixture canoniche e RPC reali. Verificati aggiunta conservativa, gruppo, servizio, Admin/Manager, esclusione Viewer/capogruppo/altri eventi, revoca Manager, iscrizioni eliminate, limiti del lotto, errore dopo una prima scrittura con rollback anche dell'audit, cascata di eliminazione e riassegnazione vietata.
- Connessioni concorrenti: due aggiunte conservano entrambi i tag; cancellazione in competizione con assegnazione lascia il tag eliminato e conserva gli altri.
- `tests/browser/manager-bulk-operations.mjs`: componenti originali su fixture sintetica e trasporto di scrittura simulato, desktop 1440×1000 e mobile 390×844. Selezione, annullamento senza richieste, payload dei lotti, errore con selezione conservata, cambio pagina, filtri globali, eliminazione e Viewer; nessun errore browser né overflow della pagina. Screenshot verificati in `/tmp/pace-manager-browser/`.

## Stato

Migration applicata e registrata in produzione nel rilascio complessivo del 20 ottobre; codice incluso nel commit di rilascio. Nessuna modifica operativa a iscritti reali né invio email di prova. Dettagli in `docs/rilascio-modifiche-residue-2026-10-20.md`.

## Verifica del rilascio richiesta dall'utente

Durante la preparazione del rilascio circoscritto, un processo parallelo ha
pubblicato `e742941452ebf6d4fce75301b03372391b6fd0da`, comprendendo queste
funzioni e i report email. I 14 file applicativi, test e migration di questa
tranche sono stati confrontati con la copia isolata verificata: contenuto
identico. La migration risultava già registrata, quindi non è stata riapplicata.
Non è stato riscritto il commit condiviso né annullato il lavoro parallelo.
Questo aggiornamento aggiunge soltanto il verbale delle verifiche.

- Ripetuti nella copia isolata allineata al rilascio `e742941`:
  `npm ci`, **981 test**, lint e build production con
  TypeScript, tutti superati. Ripetuta anche la suite SQL su PostgreSQL
  temporaneo, inclusi rollback, autorizzazioni e concorrenza. Le verifiche
  browser sintetiche desktop/mobile descritte sopra riguardano lo stesso
  contenuto applicativo.
- Verificati direttamente nel database production la registrazione di
  `20261020160000` e i corpi esatti delle due funzioni, firme, risultato
  `integer`, security invoker, proprietario `postgres` e search path vuoto.
  Esecuzione negata ad `anon` e `authenticated`, consentita a `service_role`.
  Chiamate con attore nullo respinte correttamente in una transazione conclusa
  con rollback, senza scritture operative.
- Ricontrollato il backup precedente alla migration:
  `/root/backups/iscrizioni-pace/production-before-bulk-email-reports-20261020.dump`,
  12.985.395 byte, SHA-256
  `39546e62814eef05c3200c6e12dc0deaa4dd90aefa25032ebcaca2865494bce7`.
  Lettura integrale con `pg_restore --file=/dev/null` riuscita; la funzione
  bulk non era presente nello schema del backup.
- Deployment di `e742941` confermato `READY`, target production. Successivamente
  verificato anche il dominio `registrationspeace.santegidio.org` associato al
  deployment production `READY` di `cb28817`, discendente del rilascio; i
  successivi commit paralleli riguardano i report email.
- HTTP pubblico: home 200, dashboard e POST bulk senza sessione reindirizzati
  al login. Il redirect del proxy non costituisce un test del controllo
  same-origin interno alla route, già coperto dalla suite locale.
- Safari, sessione **Admin autenticata nella dashboard Manager**: visibili i
  tre nuovi filtri, selezione della pagina, modifica multipla ed eliminazione
  tag. Applicato “Da comunicare”: 354 iscrizioni su 4.172; applicati insieme
  “Presente 26 ottobre mattina” e “Non presente 25 ottobre mattina”: 404
  iscrizioni. URL e totale paginato aggiornati. Conteggi osservati al momento
  del controllo, non valori permanenti. Filtri ripristinati e scheda di prova
  chiusa. Il browser live non ha eseguito assegnazioni o eliminazioni, né
  simulato un account con il solo ruolo Manager.
- Log runtime production: zero errori nella finestra
  `2026-10-20T10:06:07Z`–`2026-10-20T10:26:07Z`, senza intervalli esclusi.
  Configurazione Forum `internal` e link scuole attivo conservati.

Nessuna modifica a iscritti reali, stampa o invio email eseguiti per questo
collaudo. Le operazioni di scrittura restano verificate sulle fixture locali,
mentre in produzione sono stati controllati codice DB, permessi, letture e UI.
