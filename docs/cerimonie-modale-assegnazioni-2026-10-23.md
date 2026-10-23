# Cerimonie: modale assegnazioni — 23 ottobre 2026

## Comportamento

La modale Manager/Admin offre due modalità:

- **A una persona**: ricerca in tutti gli iscritti attivi, indipendente dal gruppo.
  Scegliendo un adulto, vengono mostrati i figli al seguito e l’avviso
  «1 + x posti», con il totale. «Conferma assegnazione» salva direttamente
  adulto e figli, in un’unica transazione. Un minore può essere selezionato
  anche singolarmente. Nessuna seconda conferma per l’assegnazione.
- **A un gruppo**: scelta dalla lista e quantità esplicita. Aggiunge una
  dotazione al gruppo, che il capogruppo potrà abbinare ai propri membri.

La sezione delle assegnazioni del settore mostra il conteggio nominale
espandibile, con nomi e revoca individuale, e una riga per ciascuna dotazione
di gruppo con quantità, posti abbinati e residuo. I nomi abbinati a una riserva
restano nella riga del gruppo: non vengono contati due volte. L’appartenenza
anagrafica a un gruppo non trasforma un’assegnazione personale in una dotazione.
Le revoche conservano conferma, storico e ripetizione idempotente.

Chiudere la modale azzera ricerca, filtri, selezione, quantità e modalità.
Ogni apertura riparte dai dati aggiornati. Le risposte delle ricerche già
chiuse vengono scartate anche se nel frattempo si apre un altro settore.
L’intestazione con il pulsante di chiusura resta visibile durante lo scroll.

## Database

Migration `20261023120000_ceremony_direct_families.sql`, applicata in produzione nel rilascio sotto:

- estende la RPC esistente con `assign_direct`, distinto dal vecchio percorso
  che riutilizza le riserve; conserva i chiamanti precedenti e il capogruppo;
- legge i figli completi insieme al genitore, prima di ricerca/paginazione;
- controlla nuovamente l’intera famiglia sotto lock: se è cambiata restituisce
  `family_changed` e richiede una nuova selezione/conferma;
- controlla capienza, duplicati, iscrizione attiva, ruolo/evento, revisione e
  identità della richiesta; rollback integrale in caso di errore;
- nessun aggiornamento dei dati preesistenti, nessuna riclassificazione delle
  vecchie nomine nelle riserve, nessuna modifica a tabelle, ACL o ruoli.

Se un componente ha già un’assegnazione, il nuovo lotto familiare viene
bloccato e il messaggio invita a verificare le assegnazioni esistenti.
Una revoca individuale conserva gli altri componenti della famiglia.

La migration va applicata prima del codice. In sua assenza la UI impedisce
l’assegnazione dell’adulto quando non può verificare la lista completa dei figli.

## Verifiche

- `npm test`: 1.065 test superati nella working copy al momento del controllo.
- `npm run typecheck`: superato.
- ESLint sui file modificati: superato. `npm run lint` generale segnala tre
  `no-explicit-any` e un `no-unused-vars` preesistenti in
  `tests/ceremony-navigation.test.mts`, non modificato da questo intervento.
- Build production Webpack riuscita in copia temporanea senza credenziali
  operative, con soli valori sintetici per Supabase.
- Tutte le migration e regressioni cerimonie su PostgreSQL temporaneo:
  famiglia completa anche cercando il solo genitore, separazione dalle riserve,
  replay, revoca individuale, famiglia modificata, duplicati, capienza con
  rollback, ruoli/ACL e concorrenza preesistente.
- Browser sui componenti originali, con HTTP e azioni verso PostgreSQL
  temporaneo: desktop 1440px/telefono 390px; famiglia 1+2; conferma singola;
  revoca nella modale e retry dopo risposta persa; ricerca pendente chiusa e
  risposta tardiva scartata; modale riaperta vuota; gruppi 20/80; nomina diretta
  separata dalla dotazione; regressione capogruppo in sette lingue; nessun
  overflow orizzontale, errore JavaScript o polling.

Nessun commit, push, deploy o migration remota. Nessuna assegnazione, revoca,
presenza, stampa o email reale di prova. Conservate le modifiche contemporanee
estranee a questo intervento.


## Rilascio autorizzato — 23 ottobre 2026

Rilascio congiunto con i campi email dei settori e il controllo duplicati Forum.
Copia isolata dei soli file destinati al commit, installazione da lockfile:
1.070 test, TypeScript, build production Webpack e lint dei file coinvolti superati.
Il lint generale conserva i tre errori e un avviso nel test di navigazione
preesistente sopra indicato. SQL completo e concorrenza, anche con guardie di
rilascio; browser originale desktop/mobile su DB temporaneo superato.

Backup completo verificato (elenco e decodifica integrale), permessi 600:
`/root/backups/iscrizioni-pace/production-before-direct-families-1792769673.dump`,
20.676.172 byte, SHA-256
`893f5634c6bb4c69092ce222909317424dc30bf6102c87881b74fbffd657e124`.

Migration applicata e registrata atomicamente tramite lo script del repository
con controlli prima/dopo nella stessa transazione repeatable read: 68 tabelle,
208.469 righe e metadati/ACL delle 225 funzioni conservati. Cambiano soltanto
i corpi delle due RPC previste; execute negato ad anon/authenticated e consentito
al service role. La prima prova è stata annullata dalla guardia a causa della
sola posizione testuale interna del default `false`: confronto normalizzato
con `pg_get_expr`, verificato nuovamente in locale prima dell’applicazione.
Nessuna assegnazione, revoca, presenza, stampa o email reale di prova.
Le modifiche separate agli incarichi Accoglienza non fanno parte del rilascio.
