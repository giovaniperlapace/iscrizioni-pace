# Capogruppo: completamento assegnazione multipla — 27 ottobre 2026

La conferma di assegnazione al settore chiudeva la modale appena terminata
la scrittura, prima della rilettura di nominativi, disponibilità e conteggi.
Il salvataggio multiplo usa già la RPC atomica `assign_ceremony_group_members`:
non è stato sostituito con assegnazioni separate nel browser.

## Correzione

- Modale aperta e indicatore «Operazione in corso…» fino alla conclusione
  del salvataggio e della rilettura canonica. Testi esistenti nelle sette lingue,
  stato accessibile e animazione rispettosa della preferenza di movimento ridotto.
- Conferma e annullamento disabilitati durante il lavoro; latch contro doppio
  invio, Esc ripetuto e richieste native di chiusura bloccati durante l'attesa.
- Vista, conteggi e cronologia aggiornati nello stesso render che chiude
  la modale; selezione svuotata solo dopo il completamento e cronologia
  riportata alla prima pagina.
- Scrittura riuscita e lettura fallita: modale conservata con errore e azione
  di solo aggiornamento. Il lotto salvato non viene inviato nuovamente.
- Risposta incerta: nuovo tentativo con identico comando e request ID;
  errore operativo definitivo mantiene la selezione e aggiorna la vista.

## Verifiche

- 1.225 test applicativi passati nell'esecuzione di questa attività.
- TypeScript, lint mirato e build production isolata con configurazione
  sintetica verificati.
- Regressioni SQL e concorrenza su PostgreSQL temporaneo: atomicità del lotto,
  retry, famiglie, scope, capienza e vincitore unico sull'ultimo posto.
- Nuovo test `tests/browser/ceremony-leader-batch-completion.mjs`, componente
  originale con risposte di rete controllate: 102 adulti e un minore esplicito,
  selezionati su due pagine. Desktop 1440px e telefono 390px; attesa scrittura
  e lettura, doppio clic, Esc ripetuto, cronologia di 103 nominativi e conteggi
  coerenti alla chiusura; lettura fallita recuperata senza riscrittura, risposta
  persa recuperata con lo stesso ID, capienza insufficiente senza falso successo.
- Le risposte browser sono sintetiche; le RPC sono verificate separatamente
  dai test SQL. Nessuna assegnazione o email reale usata per il collaudo.

Preparazione iniziale locale, senza migration o operazioni reali.
Commit e push su main richiesti successivamente dall’utente; rilascio tramite
la normale integrazione Git di produzione, limitato a questa correzione.
Modifiche preesistenti e concorrenti in altri file conservate.


## Conferma necessaria due volte: revisione globale — 27 ottobre 2026

Successiva segnalazione: aprire e confermare la modale non assegna al primo
tentativo; ripetere l'intera sequenza funziona. Riprodotto nel browser:
una modifica della revisione della cerimonia, anche causata da un altro
settore/gruppo, produce `conflict`. Il precedente flusso aggiornava la vista
ma terminava la conferma lasciando zero posti assegnati.

Ora, soltanto dopo un `conflict` definitivo del lotto multiplo:

1. Rilegge lo snapshot canonico senza chiudere la modale.
2. Verifica che dotazione, settore, gruppo, quantità e occupazione siano
   invariati; tutte le persone selezionate devono essere ancora presenti,
   ammesse, riconoscibili e senza assegnazioni o scelte già registrate.
3. Se è cambiata soltanto la revisione rilevante per il comando, ripete una
   sola volta il lotto completo con la nuova revisione e un nuovo request ID.
4. Un eventuale esito incerto conserva esattamente questo nuovo comando per
   il retry idempotente. Un secondo conflitto non avvia ulteriori tentativi.
5. Cambiamenti effettivi, lettura fallita o persone non più disponibili non
   generano assegnazioni automatiche né eliminazioni silenziose dalla selezione.

La RPC continua a verificare autonomamente autorizzazione, disponibilità,
revisioni e atomicità sotto lock. Nessuna modifica al server o migration.
Il test browser falliva prima della correzione sul conteggio `Assegnati: 0`,
poi verifica `Assegnati: 103` con una sola conferma dell'utente, anche nel
caso di risposta incerta del tentativo aggiornato. Provati conflitti ripetuti,
dotazione modificata e errore nella rilettura. Cinque test funzionali coprono
le guardie su dotazione, nomi, famiglia, scope, ammissibilità e duplicati.
La regressione SQL riproduce inoltre il conflitto dopo un'assegnazione in
un altro settore e verifica assenza di scritture/ricevuta prima del retry.

Verifica di rilascio della correzione successiva: copia pulita dei soli file
staged tramite `git archive`, `npm ci`, 1.229 test, TypeScript, lint mirato
e build production passati. Dieci scenari browser e suite SQL/concorrenza
passati; rilascio tramite commit/push su main nell'ambito dell'autorizzazione
già ricevuta per questa correzione. Altre modifiche locali escluse.
