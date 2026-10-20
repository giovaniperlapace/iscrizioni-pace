# Forum: scelta esplicita dei minori — 20 ottobre 2026

## Comportamento

In area personale e nella gestione capogruppo ogni Forum mostra i nomi dei minori
collegati. Le nuove richieste partono senza minori selezionati: l'adulto prenota
per sé e spunta soltanto i minori che partecipano. Ogni Forum conserva la propria
scelta. Il totale e il pulsante prenotazione/lista d'attesa seguono i posti necessari.
La lista d'attesa, l'offerta di 30 minuti e la conferma mantengono la selezione.
Per cambiare i minori di una richiesta attiva occorre cancellare la prenotazione
oppure uscire dalla coda e prenotare di nuovo, come indicato nell'interfaccia.
La coda non garantisce la conservazione della precedente posizione dopo l'uscita.

La migration `20261020140000_explicit_forum_children` conserva tutti i minori
precedentemente inclusi in prenotazioni confermate e richieste in attesa.
Le nuove prenotazioni effettuate dalle precedenti RPC non includono automaticamente
minori. Una RPC autenticata salva scelta e prenotazione/coda nella stessa transazione;
verifica proprietario o scope capogruppo, evento, identità dei minori, capacità,
conflitti e stato di apertura. Nessun nuovo permesso operativo.

Conteggi, cataloghi, statistiche, elenchi/Excel e scanner Forum leggono soltanto
i minori selezionati. L'ingresso evento mantiene la famiglia completa. I nuovi
minori aggiunti all'anagrafica non vengono iscritti automaticamente ai Forum.
Testi aggiornati nelle sette lingue. Apertura generale Forum e scuole indipendenti.

## Verifiche

- Suite applicativa completa: 967 test superati.
- TypeScript, lint e build production in copia isolata con `npm ci`.
- PostgreSQL temporaneo: migrazioni canoniche, backfill con dati preesistenti e
  confronto esatto di prenotazioni/coda/occupazione; adulto solo, un minore su due,
  Forum differenti, selezioni estranee, rollback capacità, FIFO e offerte,
  accettazione ripetuta, sei richieste concorrenti e ultimo posto concorrente.
- Scanner originale con ruolo assegnato: restituisce adulto e solo minore scelto;
  tentativo di ingresso del minore escluso rifiutato.
- Browser sui componenti originali con dati sintetici: 390 e 1440 px, scelta vuota,
  conteggio, cambio pulsante secondo disponibilità, selezione confermata bloccata,
  entrambe le superfici, sette lingue e nessun overflow orizzontale della pagina.
- Nessun invio email, stampa o prenotazione reale di collaudo.

## Rilascio

Preflight production: Forum `internal`, nessuna prenotazione o richiesta in coda.
Backup custom verificato tramite indice e decodifica completa:
`/root/backups/iscrizioni-pace/production-before-explicit-forum-children-20261020.dump`,
12.961.260 byte; SHA-256
`c9dcaab0284bdde68e67e1bb29cd15d1ed84310b9d273913c5556430d0dc5394`.

Migration applicata e registrata atomicamente in production dopo il backup:
63 tabelle esistenti e 134.505 righe identiche prima/dopo; ACL e proprietari delle
189 funzioni preesistenti conservati. Nuova tabella di selezione vuota, coerente
con l'assenza di prenotazioni. Forum ancora `internal`.
La pubblicazione frontend segue il commit su main; la revisione autenticata di
prenotazioni reali è distinta dai collaudi sintetici descritti sopra.
