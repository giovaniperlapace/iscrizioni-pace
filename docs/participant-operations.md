# Blocco 5 — Gestione iscritti e operazioni rapide

Stato: rilasciato in produzione il 2026-09-05. Le due migration sono applicate
e registrate; PR #8 integrata in `main` con commit `b0485c4`.

## Riferimento e interfaccia

Esaminati `app/dashboard/_components/participants-table.tsx` e
`supabase/participants_soft_delete_migration.sql` del riferimento Portal Global
Friendship, attraverso una copia locale temporanea fuori da OneDrive.
Riutilizzati i pattern compatibili: selezione delle colonne, ordinamento in
intestazione, scheda in modale. Nessun dominio alloggi o SQL dell'app modello
è stato importato.

Il confine server `operations-participants-section.tsx` trasforma lo scope in
un elenco serializzabile di eventi modificabili. `operations-participants-table.tsx`
è l'unica implementazione per admin/manager: nome cliccabile, selettori rapidi,
tag multipli, filtri e scheda con gli stessi controlli. `manager_viewer` consulta
anche i dettagli ma non riceve controlli di modifica. I permessi sono comunque
ricontrollati nelle RPC sul server.

Le intestazioni Gruppo e Servizio offrono due interruttori indipendenti
a matita sulla stessa riga dei titoli, inizialmente disattivati, con tooltip
che indica attivazione/disattivazione della modifica rapida e sfondo blu
quando attivi. Ogni interruttore abilita o
disabilita i selettori di tutte le righe modificabili della propria colonna;
quando è spento restano visibili il valore e l'eventuale stato del servizio.
La scelta è temporanea nella tabella, non viene salvata tra sessioni e non
condiziona i controlli nella scheda. Gli interruttori non compaiono per chi
ha accesso in sola lettura o nell'archivio delle iscrizioni eliminate.

Le preferenze di colonne e ordinamento sono versionate in localStorage per
ID dell'operatore: durano tra sessioni sullo stesso browser e sono comuni alle
aree admin e manager; l'URL può imporre uno stato specifico. Nessun dato
anagrafico è salvato nelle preferenze. Il nome resta sempre visibile; gli altri
campi significativi sono ordinabili, con `aria-sort`, ordinamento numerico per
età e date cronologiche. Età riferita alla data di inizio evento.

`view=without-group` mostra solo nome, paese, città, età e gruppo, con lo stesso
interruttore di colonna per attivare il selettore.
Una risposta riuscita aggiorna la riga e la toglie dalla coda; gli errori sono
annunciati sulla riga, conservando il valore precedente. Il caricamento primario
usa pagine da 500 e le relazioni blocchi da 300 ID, superando sia il vecchio
limite di 200 sia i limiti di risposta PostgREST. I tag sono filtrati per evento.

I filtri sono indipendenti dalle colonne visibili. Il parametro `stat` continua
a risolvere i minori tramite l'iscrizione familiare. La scheda usa `dialog`
nativo, focus contenuto, chiusura Escape e scroll interno. L'URL di ritorno è
limitato alla sezione iscritti della dashboard di provenienza e ai parametri
ammessi; nessun redirect esterno o ritorno implicito alle statistiche. I
salvataggi conservano filtri, `stat`, vista, ordinamento, colonne, sidebar,
posizione di scorrimento e scheda aperta. Eliminazione/ripristino chiudono la
scheda perché la riga esce dalla vista corrente.

## Dati e transazioni

Migration, nell'ordine:

1. `20260905190000_registration_soft_delete.sql`.
2. `20260905191000_participant_quick_operations.sql`.

L'iscrizione ha `deleted_at`, `deleted_by`, `deletion_reason`, `restored_at` e
`restored_by`. Lo stato precedente dell'iscrizione resta invariato: un'annullata
ripristinata resta annullata. Motivazione richiesta (3–500 caratteri), conferma
esplicita in scheda. L'admin consulta le eliminate tramite `view=deleted` e
ripristina con una nuova motivazione. Account e ruoli operativi sono conservati.

`set_registration_deleted` blocca la riga e verifica l'attore in
`event_user_roles`: manager solo nel proprio evento, ripristino solo admin
globale. Lifecycle, QR, destinatari in coda e audit sono atomici. Audit
`registration.soft_deleted` / `registration.restored` conserva anche il motivo
e l'autore della cancellazione precedente. Nessuna registrazione viene marcata
eliminata dal solo rilascio della migration.

Le policy restrittive si sommano ai permessi esistenti. L'admin può leggere le
registrazioni eliminate; i dati operativi collegati vengono esclusi per i client
autenticati. Trigger impediscono hard delete applicativo anche via service role,
nuovi QR/check-in e aggiornamenti operativi sulle iscrizioni eliminate. Le
query service role dell'app applicano esplicitamente il filtro `deleted_at`.
La manutenzione intenzionale eseguita come database owner non è il flusso
ordinario di cancellazione.

I QR attivi vengono revocati con `suspended_by_registration_deletion=true`.
Il ripristino riattiva solo i QR sospesi dalla cancellazione e non scaduti,
lasciando revocati i token già revocati prima. I check-in storici restano intatti;
non possono essere aggiunti check-in per una registrazione eliminata. La
pagina accoglienza di questo branch è ancora il placeholder esistente: la
protezione è già applicata al database anche per i futuri scanner.

Le campagne in attesa passano a `skipped` con motivo `registration_deleted`,
senza modificare invii conclusi. Le anteprime aggiornano il totale e richiedono
una nuova prova; le code svuotate dalla cancellazione passano allo stato finale,
conservando i totali storici degli invii già avviati. L'audience e il controllo immediatamente prima
dell'invio escludono le iscrizioni eliminate, i destinatari capogruppo eliminati
per quell'evento e i recapiti delegati a queste persone. Un'email già consegnata
al provider prima dell'eliminazione non può essere richiamata. Il ripristino non
riattiva invii precedentemente esclusi.

`update_registration_operation` serializza le operazioni sulla stessa
iscrizione e verifica gruppo/servizio/tag nello stesso evento. Gruppi strutturali
o inattivi e servizi inattivi non sono assegnabili. Audit
`participant.operation_updated` conserva valori operativi prima/dopo; per
identità e contatti registra solo i nomi dei campi, senza copiare dati personali
nel log. Le RPC accettano l'attore soltanto dal backend autenticato e non sono
eseguibili dai ruoli `anon` / `authenticated`.

## Verifiche riproducibili

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack

# Istanza PostgreSQL TEMPORANEA e database VUOTO; mai un database condiviso.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/participant-operations.sql

# Dev server locale; fixture sintetica rimossa dal test alla fine.
npm run dev -- --port 3115
node tests/browser/participant-operations.mjs http://localhost:3115
```

Il test browser accetta `AGENT_BROWSER_BIN` per usare un eseguibile
agent-browser già installato evitando di avviare `npx` a ogni comando.

La suite SQL usa lo schema e le migration reali: assegnazione operativa,
selezione multipla, identità parziale, vincoli evento e assegnabilità, viewer,
manager fuori scope, motivazione, hard delete impedito, rollback per errore
nell'audit, conservazione byte per byte di figli/assegnazioni/questionario/check-in,
RLS autenticata per owner/viewer/capogruppo/admin, sospensione/ripristino QR,
modifiche ordinarie dopo il ripristino con metadati protetti, esclusione campagne
in coda, riallineamento delle anteprime e conservazione di quelle inviate.

La suite browser monta il componente reale con trasporto e dati sintetici;
non modifica iscrizioni o invia email in produzione. Verifica colonne/sort,
preferenze separate, gruppo/servizio/tag, errore sulla riga, rimozione dalla
coda, scheda dal nome, contesto dopo salvataggio, Escape, eliminazione e
ripristino, sola lettura e viewport 390 px. Le transazioni/permessi sono
verificati separatamente dalla suite SQL. Screenshot ispezionati su desktop e
mobile. Verificata anche la protezione HTTP senza sessione (redirect al login).

## Rilascio coordinato

Le query nuove richiedono le colonne SQL e i salvataggi richiedono le RPC.
Applicare le migration prima di promuovere il deployment compatibile. Nel breve
intervallo il vecchio endpoint di cancellazione fisica viene già respinto dal
trigger, preservando lo storico. Non promuovere un'anteprima collegata al DB
production prima di applicare entrambe le migration.

```sh
npm run db:migrate:remote -- supabase/migrations/20260905190000_registration_soft_delete.sql
npm run db:migrate:remote -- supabase/migrations/20260905191000_participant_quick_operations.sql
```

Dopo il rilascio controllare schema PostgREST, conteggi delle registrazioni e
storico invariati, accesso admin/manager, coda Senza gruppo, filtri e salvataggi.
Se necessario ritirare il codice, mantenere le colonne additive e il blocco del
hard delete; non cancellare marcature o audit già creati. Una versione precedente
non gestisce l'archivio e non deve restare in servizio dopo l'uso del soft delete.

## Verifiche database in produzione — 2026-09-05

- Migration `20260905190000` e `20260905191000` applicate nell'ordine e registrate;
  cache dello schema PostgREST ricaricata.
- Tutte le 68 iscrizioni conservate, zero iscrizioni marcate eliminate.
- Conteggi e hash delle righe invariati su 18 tabelle: iscrizioni, partecipanti,
  account, contatti, gruppi assegnati, tag, servizi, figli, questionari, consensi,
  accessibilità, presenze evento/momenti, QR, check-in, audit, campagne e destinatari.
- Presenti 13 policy restrittive e 5 trigger abilitati. RPC eseguibili da
  `service_role`, non da client anonimi/autenticati.
- PostgREST restituisce HTTP 200 sulle nuove colonne; entrambe le RPC rifiutano
  un identificativo inesistente con `P0002`, senza scrivere dati.
- Deployment production `dpl_4P4U8mz6tCf75twJKFHreStCMYHV`, stato `Ready`,
  associato a `https://registrationspeace.santegidio.org`.
- Home e login HTTP 200; dashboard admin/manager e quick-update senza sessione
  reindirizzano al login. Nessun errore runtime nel controllo dopo il rilascio.
