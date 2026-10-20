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
