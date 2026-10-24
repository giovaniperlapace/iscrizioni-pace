# Accoglienza Forum ed eventi: tutti gli incarichi — 23 ottobre 2026

Richiesta: tutti gli operatori con il ruolo ricevono tutti gli incarichi. Non si
assegna il ruolo a tutti gli utenti. La scelta operativa dell’incarico rimane
nell’elenco della dashboard.

- Il modulo di assegnazione non presenta più caselle né «Seleziona tutto»:
  carica il catalogo e invia tutti gli incarichi automaticamente.
- La RPC `set_reception_duties` completa ogni richiesta non vuota con tutti
  i Forum attuali e le due cerimonie, anche da client precedenti.
- Migration `20261023130000`: completa gli operatori già assegnati nell’evento
  corrente. Conserva assegnazioni precedenti e attribuzione, aggiunge audit
  specifico, non assegna ruoli generali o incarichi ad assistenti di sala senza
  ruolo Forum/cerimonie. Il catalogo è quello esistente al momento della migration
  o dell’assegnazione; eventuali nuovi Forum richiedono aggiornamento degli incarichi.
- Revoca completa, controllo Admin/Manager, evento corrente, concorrenza e
  rilettura degli incarichi conservati. Nessuna prenotazione o ingresso modificati.

Verifiche locali: lint del componente, TypeScript e build superati; 1.070 test
applicativi superati. Suite PostgreSQL temporanea superata, con backfill
Forum/cerimonie, esclusione assistenti, idempotenza, permessi, revoca, minori,
retry e concorrenza sull’ultimo posto.
Browser originale desktop/mobile superato: assegnazione senza caselle, scelta
dell’incarico, prenotazione, ingresso, QR da stream sintetico, cambio incarico,
revoca e collaudo senza chiamate operative.

Stato iniziale del 23 ottobre: migration e codice ancora locali.
Rilascio production del 24 ottobre descritto sotto.

## Email di assegnazione

Su richiesta successiva, `assignOperationalUserRole` disabilita l’invio della
mail esclusivamente per `accoglienza_forum_eventi`, per utenti nuovi ed esistenti,
anche se un vecchio modulo invia `sendInvite=on`. Audit coerente con invio non
richiesto; assegnazione e notifiche degli altri ruoli conservate. Nessuna nuova
migration. Test mirati assegnazione/accesso: 20 superati; lint superato.


## Rilascio autorizzato — 24 ottobre 2026

Su richiesta esplicita dell’utente di pubblicare anche i lavori Accoglienza,
applicate e registrate atomicamente in produzione le migration `20261023130000`
e `20261023140000`, prima del commit/push del codice. Backup completo conservato
sul server: `/root/backups/iscrizioni-pace/production-before-reception-1792842943.dump`, 23.135.145 byte,
SHA-256 `d1d6822dd7daca81896eff58ba17eb945ad42dc4ab544adcf4d6fa15c2af6607`.
Verificati indice del dump e decodifica completa con pg_restore; permessi 600.

Confronto nella stessa transazione su 74 tabelle: 232.670 righe originarie
conservate nella prima migration; sole aggiunte attese di 336 incarichi Forum,
1 incarico cerimonia e 52 voci audit per completare 54 operatori. La seconda
conserva tutte le 233.072 righe rilevate al suo avvio. Ruoli, prenotazioni,
ingressi, tabelle estranee, policy, trigger e ACL/proprietari di 239 funzioni
conservati; cambiano soltanto le tre definizioni previste. Controllo preventivo
delle definizioni originali e rollback automatico per differenze inattese.

Verifica della versione completa: 1.119 test applicativi, TypeScript, lint mirato
e build production in copia isolata da npm ci superati. Lint generale: restano
i problemi preesistenti in `tests/ceremony-navigation.test.mts` documentati nel
rilascio duplicati. Suite SQL/concorrenza e wrapper di rilascio verificati su
PostgreSQL temporaneo con dati sintetici; browser originale desktop/mobile,
assegnazione e secondo salvataggio, scanner, QR scuole, revoca e cambio fascia
superati. Il test attende il caricamento del catalogo prima del salvataggio
e l’esito effettivo prima di riaprire il modulo. Nessuna email o presenza reale
di collaudo. Commit e push su main autorizzati insieme al rilascio.

Lettura finale READ ONLY: entrambe le versioni registrate, 54 operatori senza
incarichi mancanti, 32 voci del catalogo con finestre valide e 52 audit del
completamento. Nessuna scrittura operativa per la verifica finale.
