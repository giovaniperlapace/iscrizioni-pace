# Inserimento singolo Manager/Admin

Da **Gestione iscritti → Inserisci partecipante** si apre
`/dashboard/manager/nuovo`. La funzione è disponibile ai Manager dell’evento
corrente e agli Admin globali. Il Manager Viewer non vede il comando e viene
respinto sia dall’URL diretto sia dall’azione server, anche con un incarico
capogruppo aggiuntivo.

Il catalogo comprende tutti i gruppi attivi e iscrivibili dell’evento corrente,
compresi quelli privati, senza richiedere membership dell’operatore. Si carica
solo aprendo il modulo, in pagine da 500 con ordinamento nome/ID. Un errore
interrompe il caricamento anziché esporre una lista incompleta. L’azione rilegge
evento corrente, ruolo e gruppo prima delle scritture.

Il modulo e i testi nelle sette lingue sono condivisi con il capogruppo:
anagrafica, nascita obbligatoria/reale/non futura, contatti, presenze esplicite,
figli, accessibilità, nota e conferma del consenso. Nessuna presenza è
preselezionata. Il partecipante viene confermato nel gruppo scelto. Gli errori
lasciano compilato il modulo; un inserimento riuscito mostra la conferma e un
nuovo modulo vuoto. Il controllo duplicati e la motivazione di deroga restano
quelli esistenti.

Per chi non ha email personale, il Manager sceglie l’apposita opzione: le
comunicazioni seguono il referente del gruppo disponibile, come nei normali
flussi operativi. Non si registra l’email del Manager come email del partecipante
né si crea una delega esplicita a suo favore. Il flusso capogruppo mantiene la
precedente opzione di delega a sé stesso. L’email personale riceve le istruzioni
di accesso tramite il trasporto esistente; un errore di invio dopo il salvataggio
viene distinto dal fallimento dell’inserimento.

## Provenienza e database

Non occorre una migration. `registrations.source` usa il valore operativo
`admin` già ammesso dal vincolo storico, che non ammette `manager`.
L’assegnazione conserva invece il ruolo effettivo `manager`/`admin`, attore
ricavato dalla sessione e motivo `operations_manual_entry`. Snapshot e audit
indicano `manager_manual`/`admin_manual` e `registration.created_by_manager`/
`registration.created_by_admin`; non attribuiscono la decisione al capogruppo.
I figli, i consensi e il QR seguono il flusso assistito esistente.

La funzione riutilizza l’azione di inserimento esistente: le scritture sono
multiple e non diventano una nuova transazione atomica. Nessuna modifica a RLS,
ruoli, dati storici o regole di consegna delle campagne. Nessuna scrittura su
persone reali o invio email di collaudo.

## Verifica

- `tests/operations-manual-registration.test.mts`: permessi, evento corrente,
  gruppi privati/inattivi/non iscrivibili, attore non falsificabile, provenienza,
  figli, consenso, presenze, duplicati, delega e invii, paginazione oltre 1.000
  gruppi e interruzione su errore nelle pagine successive.
- `tests/browser/operations-manual-registration.mjs`: pagina e componenti reali
  con sessione/catalogo/azione sintetici in una route temporanea locale; accesso
  da Gestione iscritti, desktop/mobile, sette lingue, errori conservano campi,
  successo e rifiuto Viewer. Nessuna chiamata al database reale.
- Dipendenze dalla versione di `package-lock.json` (`npm ci` in copia pulita).

Esito: 510 test, lint senza avvisi, TypeScript e build di produzione superati
in copia pulita con `npm ci`; browser sintetico nelle sette lingue,
desktop/mobile e controlli Viewer superati.

Rilascio autorizzato dall’utente il 23 settembre 2026 tramite commit/push su
`main` e normale deployment Vercel. Nessuna migration da applicare.
