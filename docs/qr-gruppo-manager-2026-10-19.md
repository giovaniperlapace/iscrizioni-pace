# QR di gruppo stabile e gestione Manager — 19 ottobre 2026

## Implementazione pronta

Nella gestione gruppi Manager e Admin compare «QR del gruppo» per i gruppi
attivi dell’evento corrente autorizzato. Il pulsante riusa la finestra del
capogruppo: nome gruppo, immagine e download del PNG già mostrato. Nessuna
richiesta prima del clic, nessun rinnovo, revoca o annullamento.

La Server Action riconosce anche il Manager assegnato all’evento corrente.
La nuova migration `20261019120000_manager_group_qr_access` ricontrolla e blocca
in lettura il ruolo nel DB; il gruppo deve appartenere all’evento corrente ed
essere attivo. Conservati Admin globale e scope capogruppo diretto/discendente.
Viewer e Accoglienza senza membership pertinente non acquisiscono accesso.
La nuova autorizzazione non abilita scanner gruppo, presenze o stampa di gruppo.

La RPC accetta esclusivamente `get`. La prima lettura crea una sola credenziale
sotto lock e registra un solo audit; le successive riusano la stessa riga.
Firma, security invoker e ACL service-only restano invariati. Le revoche storiche
rimangono tali, senza riattivazione o sostituzione implicita. Nessuna migration
riscrive i QR esistenti.

## Verifica production in sola lettura

Il 19 ottobre è stata confermata l’assenza della migration
`20261016160000_stable_group_qr` nel registro production. La funzione installata
è ancora quella di `20261016130000`, con percorsi renew/revoke. La sua impronta
`md5(prosrc)` è `31128479927e8793aa6a706b7acfb97d`, uguale alla funzione ricostruita
nel database temporaneo prima del vincolo di stabilità.

Presenti **47 credenziali di gruppo, zero revocate**. Le sole funzioni che
referenziano la tabella sono la RPC credenziale e la base dello scanner gruppo;
quest’ultima legge il token. Confermati `internal` e accesso scuole attivo.
Nessuna scrittura o creazione QR eseguita in produzione durante questi controlli.

## Verifiche completate

- 961 test applicativi; lint e TypeScript superati.
- Build production Webpack in copia temporanea senza ambienti reali, dopo
  `npm ci` dal lockfile.
- PostgreSQL temporaneo: ruoli, evento corrente, gruppi inattivi/estranei,
  revoca ruolo e membership, scope discendente, credenziali storicamente revocate,
  rifiuto di gestione anche per Admin, ACL e dati applicativi invariati.
- Nove prime letture simultanee Manager/Admin/capogruppo: stesso QR e un solo
  audit di creazione. Conservate le regressioni accoglienza e stampa.
- Applicazione della migration stabile anche dopo le successive migration di
  accesso, seguita dalla nuova migration Manager: dati, ACL e security invoker
  invariati. Nessuna dipendenza successiva sovrascritta.
- Browser Chrome desktop/mobile sul componente originale condiviso con dati
  sintetici: assenza richieste iniziali, gruppo corretto, riapertura stabile,
  download PNG identico byte per byte senza altre richieste, errori/riprova,
  doppi clic, focus/Escape, sette lingue e assenza errori JavaScript.
  Screenshot mobile ispezionato. Le pagine autenticate production non sono
  ancora state collaudate con il nuovo codice.

Il runner SQL è stato aggiornato a rinviare soltanto le due migration di
accoglienza del 14 ottobre: il vecchio rinvio dell’intera data saltava anche la
base delle liste d’attesa, causando errore con le migration del 17 ottobre.

## Rilascio congiunto autorizzato — 19 ottobre

Su richiesta esplicita dell’utente, applicate e registrate in production in
un’unica transazione `20261016160000_stable_group_qr` e
`20261019120000_manager_group_qr_access`, prima del codice. Verificata la
compatibilità con le migration successive; prova iniziale con rollback e
applicazione definitiva entrambe riuscite.

Backup custom sul server:
`/root/backups/iscrizioni-pace/production-before-qr-sheet-20261019-140752.dump`
(12.467.221 byte, permessi 0600). Indice letto e archivio interamente decodificato
con `pg_restore`; SHA-256
`1c3470a3a483f2c49cd90220ce916f36ad9945f4780d25a95c3b73ddcea36069`.

Confronto nella stessa snapshot transazionale: **65 tabelle public/app e
128.982 righe invariate**, 2.474 voci di catalogo confrontate; unica variazione
la definizione della RPC prevista. ACL e security invoker conservati. Impronta
finale `md5(prosrc)`: `57d1d0dbc61ee99c98fde2c7b459a418`.
Lettura dopo commit: entrambe le versioni registrate, 47 QR e zero revocati,
Forum `internal`, scuole attive. Nessun QR creato o ruotato durante il rilascio.

Codice incluso nella tranche con il
[caricamento congiunto della scheda partecipante](scheda-partecipante-caricamento-2026-10-19.md),
con commit/push su main e deployment Git production autorizzati dall’utente.
Pubblico: Admin e Manager dell’evento assegnato; capigruppo nel proprio scope.
Nessun invio reale, presenza, stampa fisica o apertura Forum di collaudo.
Evidenze tecniche locali in `/tmp/pace-qr-sheet-release-proof/`.
