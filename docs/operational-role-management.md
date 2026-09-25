# Gestione ruoli: incarichi cumulativi e modale persistente

Il 25 settembre 2026 l’utente ha approvato l’anteprima e autorizzato commit/push.
Manager e Manager viewer sono alternativi **nello stesso evento**; Capogruppo,
Accoglienza e gli altri incarichi autorizzati si sommano.

## Comportamento

- Una sola modale nativa condivisa Admin/Manager, con persona e incarichi attuali
  prima dell’aggiunta. Rimozione esplicita del singolo incarico e modifica
  Principale/Secondario del singolo gruppo. Le responsabilità usano gli ID reali.
- Aggiunta e rimozione restituiscono un esito alla modale e aggiornano l’elenco
  senza redirect. Anche dopo l’ultimo ruolo, il profilo rimane apribile dalla
  selezione corrente. Chiusura conserva i parametri e lo scroll sottostante;
  Esc annulla prima la conferma o il modulo aperto. Focus, blocco dello sfondo,
  invii duplicati e avanzamento condiviso conservati.
- La riga rimossa resta come riscontro locale, nella sua posizione. Alla
  riapertura compare l’elenco corrente. Gli errori dell’operazione non sono
  presentati come errori di campi né attribuiti automaticamente alla connessione.
- Rimozione dei propri ruoli disabilitata e respinta sul server. Il conflitto
  Manager/Viewer richiede prima la rimozione esplicita del ruolo attuale: non
  viene scelto automaticamente quale conservare. Per il cambio del proprio
  ruolo occorre un altro operatore autorizzato.
- Creazione dell’accesso e selezione di persone esistenti conservano i flussi
  precedenti, indipendenti dall’iscrizione personale. La modale usa l’identità
  server e non riscrive nome/email durante l’assegnazione.
- Il vecchio aggiornamento sostitutivo è stato eliminato. Il relativo handler
  rimane come adattatore additivo per vecchie form aperte; le selezioni multiple
  pregresse richiedono di riaprire la scheda, senza rimuovere alcun incarico.

## Diagnosi e database

Il vecchio update rimuoveva l’incarico corrente prima di inserire quello scelto;
la rimozione terminava con un redirect all’elenco. Il messaggio dello screenshot
è il fallback condiviso: da solo non permette di stabilire l’errore originario.
La rimozione del capogruppo e la sincronizzazione del nome del referente erano
scritture separate; ora sono atomiche con l’audit.

Migration `20260925180000_operational_role_management.sql`:

- indice univoco parziale `(event_id,user_id)` per Manager/Viewer, valido anche
  per INSERT/UPDATE concorrenti da altri percorsi;
- RPC `remove_operational_role`, solo service_role, con attore derivato da Auth,
  controllo e lock dei permessi, gruppo/evento verificati, divieto self-removal,
  rimozione puntuale, sincronizzazione del referente e audit nella transazione;
- nessun aggiornamento di ruoli storici o scelta automatica tra ruoli esistenti.

Preflight produzione READ ONLY: zero coppie Manager/Viewer nello stesso evento.
Migration applicata e registrata atomicamente prima del push. Impronte di
ruoli, membership, gruppi e profili e di tutte le policy verificate invariate;
grants della nuova RPC verificati. Backup schema riservato sul server in
`/root/pace-release-20260925-roles/`. Richiesta HTTP con soli UUID sintetici
respinta con 42501 prima di scritture. Nessuna email o modifica di collaudo a
persone reali.

## Verifica

- 545 test, lint, TypeScript e build production Next 16.2.9 in copia pulita con
  `npm ci` dal lockfile; modifiche parallele del modulo presenze escluse.
- Test dei veri handler estratti in `tests/operational-role-assignment.test.mts`
  e `tests/operational-role-removal.test.mts`: preservazione, permessi, conflitto,
  errori e risposta senza navigazione.
- PostgreSQL temporaneo: `tests/sql/operational-role-management.sql`, con
  permessi, esclusività in entrambe le direzioni, rollback forzato della
  sincronizzazione referente, reinvio idempotente e conservazione degli altri
  incarichi. Due connessioni concorrenti confermano il vincolo univoco.
- Browser sintetico: `tests/browser/operational-role-dialog.mjs`, da eseguire
  contro un dev server locale della stessa copia **prima** dei test/build, poiché
  crea ed elimina una route temporanea. Test Admin/Manager, aggiunta cumulativa,
  errore e retry, ultimo ruolo, persona senza ruoli, proprio account, modifica
  incarico, desktop/mobile e scroll dopo chiusura. Screenshot controllati.
