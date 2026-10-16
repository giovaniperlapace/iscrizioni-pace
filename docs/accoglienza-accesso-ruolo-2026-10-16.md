# Accesso operativo per il ruolo Accoglienza — 16 ottobre 2026

## Richiesta e comportamento

L’utente chiede di rendere disponibili le funzioni di accoglienza anche agli
account con ruolo Accoglienza, presenti e futuri, compresi gli account con ruolo
Manager cumulativo. La pubblicazione riguarda gli operatori autenticati: non
introduce accesso anonimo o basato su tag/servizi della scheda partecipante.

La dashboard `/dashboard/accoglienza`, le azioni server e il database consentono
scanner, partecipazione, etichette QR e badge del gruppo agli Admin globali e agli
account con `accoglienza` nell’evento corrente. Manager senza Accoglienza resta
escluso. La presenza di altri ruoli non cancella il permesso Accoglienza; le schede
di navigazione già esistenti mostrano entrambe le dashboard.

Il ruolo viene riletto a ogni operazione, senza elenchi statici di utenti: nuove
assegnazioni sono immediatamente valide e revoche bloccano anche retry e operazioni
su pagine già aperte. Ruoli di altri eventi non concedono accesso. Le operazioni
Forum/sala richiedono anche il loro incarico specifico. Gli altri controlli Admin,
inclusi cerimonie e gestione degli incarichi, restano invariati.

Conferma e stampa restano azioni separate sulla selezione conservata, senza
registrazione automatica alla scansione. Computer/telefono, minori, QR genitore,
deduplicazione, audit, revisioni, conflitti e retry conservano il comportamento
esistente. Il collaudo con campioni sintetici è ora raggiungibile da
`/dashboard/accoglienza/collaudo`; il vecchio percorso Admin riusa la stessa pagina.

## Migration e produzione

`20261016180000_reception_role_access` aggiunge un controllo operativo dedicato e
la RPC autenticata `reception_ready`, quindi sostituisce il gate Admin solo nelle
funzioni di check-in singolo/Forum, nell’operatore gruppo e nella coda etichette.
Il gate Admin originale non viene modificato. Le RPC operative restano service-only;
nessun nuovo accesso diretto alle tabelle e nessuna modifica RLS.

Applicata e registrata atomicamente in production, dopo backup custom verificato
con `pg_restore --list` e permessi 600:

- Backup server: `/tmp/iscrizioni-pace-production-before-reception-roles-20261016-1792157361450.dump`.
- SHA-256 backup: `d37ca6f407a579195f41592f1db06738d755d7389481a0a961bb98a5d67928fd`.
- SHA-256 migration: `ebcbef62d78c070e8d616b4251369c0b7382e06bc3b153c3cbc660577c5693ee`.
- Confrontate tutte le 63 tabelle pubbliche, 88.029 righe: contenuti invariati.
- Confrontate 2.497 voci preesistenti di catalogo: solo quattro gate sostituiti e
  due funzioni aggiunte; altri corpi funzione, privilegi, policy e vincoli invariati.
- Otto account con Accoglienza nell’evento corrente, cinque anche Manager;
  quattro Admin globali. Nessun ruolo/account creato o modificato.
- Modalità internal, catalogo Forum pubblico e coda vuoti conservati.
- Staging invariato. Nessuna email, stampa fisica o prova su iscrizioni reali.

Il rilascio applicativo segue il normale deployment Git Vercel da `main`.
Le modifiche hardware preesistenti ad AGENTS.md e al verbale scanner sono escluse.
La migration del QR gruppo stabile, già presente nel repository, non viene
applicata da questa tranche: non è una dipendenza dell’estensione Accoglienza.

## Verifiche

- 900 test applicativi, lint completo e TypeScript superati.
- Build production Webpack in copia pulita con `npm ci`, senza file ambiente
  reali; credenziali sintetiche e backend limitato a localhost.
- Matrice server: Admin globale, Accoglienza, Manager + Accoglienza, Manager,
  Viewer, capogruppo, partecipante, anonimo, ruolo di altro evento, Admin non globale;
  assegnazione futura, revoca, errore di lettura e assenza evento corrente.
- PostgreSQL temporaneo: scanner singolo/gruppo, badge, coda etichette,
  assegnazioni future e cumulative, revoche, retry, audit e privilegi diretti.
  Superate anche le regressioni SQL e di concorrenza preesistenti.
- Browser sulla pagina originale e build production: autenticazione/trasporto
  sintetici, azioni server originali e RPC sul PostgreSQL temporaneo. Accoglienza,
  Manager + Accoglienza e Admin; desktop/mobile, stampa prima della partecipazione,
  conferma senza ristampa, revoca durante la sessione e collaudo accessibile.
  Stampa simulata, nessun errore JavaScript. Non equivale a un login production.

Comando SQL: `node tests/sql/run-reception-checks.mjs`.
Il flag `--browser-reception-access` aggiunge la verifica browser: richiede una
build/server locale su `127.0.0.1:3194` configurato con backend sintetico
`127.0.0.1:55486`, chiave QR sintetica condivisa e Playwright tramite
`PLAYWRIGHT_MODULE`. Non usare credenziali o URL di ambienti reali.
