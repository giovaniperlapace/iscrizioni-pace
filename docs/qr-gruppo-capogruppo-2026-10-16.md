# QR del gruppo dalla dashboard capogruppo — 16 ottobre 2026

## Comportamento

Il pulsante «QR del gruppo» compare accanto a «Gestisci link» per ogni gruppo
assegnato attivo. Apre direttamente una finestra con nome e QR del gruppo della
riga, più «Scarica QR». Il comando è stato rimosso dalla modale dei link.
Il QR non viene richiesto prima del clic. Il contenuto comprende esclusivamente
il gruppo indicato, senza aggregare i sottogruppi. Focus, Escape, doppio clic,
errori e QR revocati sono gestiti; testi disponibili nelle sette lingue.

Su conferma esplicita dell’utente, anche i capigruppo possono visualizzare e
scaricare i QR dei gruppi nel proprio ambito attivo. L’azione autenticata e il DB
ricontrollano evento e appartenenza. Manager/Viewer senza membership capogruppo
non ottengono nuovi accessi. Revoca e rinnovo della credenziale restano Admin,
come scanner, presenza e stampa operativa. Nessun ruolo/account viene creato.

Il download si chiama `qr-gruppo-Anziani-Torrenova.png`, usando il nome effettivo
del gruppo. Il sanitizzatore condiviso conserva lettere internazionali e accenti,
rimuove separatori e caratteri non adatti al filesystem e limita la lunghezza.
I nomi dei QR personali mantengono il formato precedente.

## Database e rilascio

Migration `20261016130000_leader_group_qr_access`: sostituisce soltanto il gate
iniziale di `group_reception_credential`. `get` consente la membership attiva
nel gruppo o nella gerarchia autorizzata; le altre azioni conservano il gate
Admin. Validazione dell’evento corrente, lock, audit e implementazione token
preesistenti restano efficaci. La funzione resta service-only, senza nuovi
privilegi o policy. Letture ripetute riusano il token; solo la prima apertura
esplicita, se manca la credenziale, la crea tramite il percorso originale.

Applicata e registrata atomicamente in production dopo backup custom verificato
con `pg_restore --list`, permessi 600:

- Percorso server: `/tmp/iscrizioni-pace-production-before-leader-group-qr-20261016-1792153975366.dump`
- SHA-256 backup: `b913847d12b64f20697abdd9f1aef9a2453c00794dac0ca740765cb710ad56db`
- SHA-256 migration: `38cd241544d95171873f28468a4cde39002732f06c21f940f37ac36bbccfee38`
- 63 tabelle pubbliche, 87.791 righe confrontate per conteggio e contenuto:
  nessuna modifica applicativa nella migration.
- 2.497 voci di catalogo confrontate: esclusivamente la modifica attesa alla
  funzione, con RLS, privilegi, vincoli e altre funzioni conservati.
- Modalità internal e catalogo pubblico vuoto conservati. Nessuna prova su
  QR/presenze reali, email o stampa; staging invariato.

Il rilascio software usa commit/push su main e il normale deployment Git Vercel,
come richiesto dall’utente. Le altre modifiche simultanee alla schermata scanner
sono escluse da questa tranche.

## Verifiche

- 898 test, ESLint, TypeScript, build production con `npm ci` in copia pulita
  senza file ambiente reali.
- `tests/leader-group-qr-access.test.mts`: Server Action effettiva con dipendenze
  sintetiche, scope, autenticazione, errori, privilegi Admin e nomi dei file.
- `tests/sql/leader-group-qr-access.sql`, nel runner accoglienza: scope diretto e
  discendente, gruppi estranei/inattivi, altro evento, membership rimossa, token
  revocato, management Admin-only e immutabilità di iscrizioni/QR personali/presenze.
- PostgreSQL temporaneo: otto richieste concorrenti condividono una credenziale
  e un solo audit di creazione; regressioni scanner/coda etichette conservate.
- `tests/browser/leader-group-qr.mjs`: due gruppi con QR distinti, un solo clic,
  download effettivo e confronto byte PNG, nomi Unicode, sette lingue, mobile,
  focus/Escape, errori, revoca, doppio clic e conferme Admin. Solo dati sintetici.
