# QR del gruppo stabile — 16 ottobre 2026

Il pulsante «QR del gruppo» apre direttamente la finestra con il nome del gruppo
e il suo QR. Usa il componente ProgressButton condiviso, con stato di attesa e
blocco dei doppi clic. Restano chiusura, Escape, ritorno del focus e riprova dopo
un errore. Non vengono richiesti QR prima del clic.

Rimossi revoca, rinnovo e relativa conferma per tutti i ruoli. Su precisazione
dell’utente si conserva «Scarica QR»: salva il PNG già mostrato, senza richieste
aggiuntive o rigenerazione, con nome `qr-gruppo-Nome-del-gruppo.png`.
Il modello attuale non prevede un codice pubblico di gruppo;
non vengono esposti UUID o token come codici leggibili. Testi in sette lingue.

## Stabilità e autorizzazioni

La Server Action accetta soltanto `get`, sia nel tipo TypeScript sia a runtime.
Richieste `revoke`, `renew`, sconosciute o nulle sono respinte prima di creare il
client privilegiato, anche se il chiamante è Admin.

La migration `20261016160000_stable_group_qr` sostituisce esclusivamente la RPC
`group_reception_credential`, conservando firma, ACL e security invoker. Sono
rimossi i percorsi UPDATE/upsert che sostituivano o revocavano il token. L'unica
scrittura possibile tramite questa RPC è la prima creazione quando manca il QR,
con lock sulla riga del gruppo e un solo audit `group_qr.create`. Le letture
successive restituiscono il token già salvato, anche se ricevono nuovi candidati.

Restano i controlli sull'evento corrente e sul gruppo attivo, l'accesso Admin e
lo scope capogruppo diretto/discendente. Manager e Viewer senza membership non
acquisiscono accessi. Scanner, presenze e stampa mantengono i propri controlli.

La migration non riscrive alcun dato. Eventuali QR già revocati nella storia
rimangono indisponibili: non vengono rigenerati o riattivati durante una lettura.

## Verifiche e rilascio

- 898 test superati; ESLint e TypeScript senza errori.
- Build production Webpack completata in copia isolata senza file ambiente
  reali, con le dipendenze locali già installate.
- Server Action reale con dipendenze sintetiche: autenticazione, scope e rifiuto
  delle operazioni di gestione anche per Admin, senza chiamate privilegiate.
- PostgreSQL temporaneo: scope, ruoli, evento, revoche storiche, rifiuto di
  rinnovo/revoca, immutabilità dei dati partecipanti, otto letture concorrenti
  con un solo token e un solo audit di creazione. Regressioni accoglienza/coda
  incluse nel runner `tests/sql/run-reception-checks.mjs`.
- Browser Chrome con fixture sintetica: nessuna richiesta iniziale, apertura
  diretta del gruppo scelto, immagini distinte fra gruppi e invarianti alla
  riapertura, visualizzazione e download PNG verificato byte per byte senza
  richieste aggiuntive, errori/retry, doppio clic,
  indicatore standard, focus/Escape, sette lingue e viewport telefono.
  Screenshot mobile ispezionato; nessun errore JavaScript.
- Prove nella copia isolata senza file ambiente reali. Nessuna modifica a dati
  remoti, email o stampa. Commit/push su main richiesti dall’utente; migration
  remota non applicata per questa tranche.

Il rilascio deve includere codice e migration: il solo aggiornamento dell'UI
non elimina i vecchi comandi dalla RPC del database production.
