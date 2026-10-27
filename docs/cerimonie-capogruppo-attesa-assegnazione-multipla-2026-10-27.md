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
