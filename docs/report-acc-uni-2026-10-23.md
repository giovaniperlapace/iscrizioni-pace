# REPORT_B e REPORT_B/2: accompagnatori Universitari

Richiesta di Francesco Bosio trasmessa dall'utente il 23 ottobre 2026.
L'allegato `Gruppi_ZRT.xlsx`, Foglio1, A54:D54 conferma il raccordo
Universitari / Roma / nessun raggruppamento / `acc_uni`.

Aggiunto `acc_uni` alla configurazione del gruppo Universitari esistente
(`4bc26583-124a-488a-a0cd-1b9cf4d94d36`). I report B/B2 applicano così la
regola già prevista per gli accompagnatori: adulto conteggiato nel gruppo
destinatario, con precedenza sul servizio, senza duplicazioni. Il gruppo
anagrafico, A/A2, i minori e le regole sui tag conflittuali restano invariati.
Nessuna migration, modifica ai tag assegnati o scrittura sui dati operativi.

Verifica con la configurazione effettiva dell'evento, adulto con tag e servizio,
figlio e presenza dichiarata: spostamento solo in B/B2, minore nel gruppo
originario, conservazione di tutte le colonne dei totali. Generati e riletti
in memoria i quattro Excel attraverso il writer applicativo originale.
Suite mirata: 6 test superati. Lint e build production superati.
