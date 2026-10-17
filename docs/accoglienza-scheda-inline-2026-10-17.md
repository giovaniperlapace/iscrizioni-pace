# Accoglienza: scheda gruppo integrata e azioni nelle ultime letture

## Comportamento

- La lettura di gruppi e famiglie mostra direttamente l’elenco nella scheda
  risultato, senza aprire una modale. La scansione non registra presenze.
- Nelle ultime letture, un singolo offre Conferma partecipazione oppure Rimuovi
  presenza, secondo l’ultimo stato verificato, e Stampa QR in modalità computer.
  Ogni comando rilegge il codice prima di agire; un cambiamento di stato non
  trasforma una conferma richiesta in una rimozione o viceversa.
- Gruppi e famiglie offrono Gestisci Presenze e, su computer, Scegli i QR code
  da stampare. I comandi rileggono il gruppo e portano alla sezione della scheda,
  senza scrivere presenze o avviare una stampa.
- Selezione comune conservata durante le azioni. Conteggi distinti delle persone
  da confermare, già presenti e QR selezionati; minori sul QR genitore deduplicato.
  Deselezionare non rimuove presenze. Rimuovi presenze selezionate indica il numero
  delle sole presenze interessate e apre la conferma nominale dopo rilettura.
- La conferma di rimozione contiene Conferma rimozione e Annulla, senza il secondo
  comando Chiudi. Escape e ripristino del focus conservati.
- Lo stato delle persone nelle ultime letture viene aggiornato anche quando la
  modifica proviene dalla scheda del gruppo. Revisioni/snapshot degli altri
  elementi non vengono riutilizzati per scrivere: i comandi rileggono sempre.
- Stampa dalle ultime letture tramite coda e renderer originali. Il contatore
  della scheda corrente viene riletto dopo il tentativo. Telefono senza stampa;
  blocchi durante richieste, conferme ed esiti incerti e retry idempotente conservati.

## Verifiche

- 907 test applicativi, lint completo e build production Webpack in copia
  isolata del commit di partenza più le sole modifiche di questa attività.
- Test aggiunto sulla coerenza dello stato fra cronologia individuale e gruppo,
  conservando revisioni distinte.
- Fixture browser con componenti originali, dati sintetici e stampa simulata:
  selezione, rimozione nominale, doppio clic, ripresa USB, errore/conflitto,
  retry della stessa richiesta, minori e indipendenza fra presenza e stampa.
  Desktop/mobile: azioni recenti dirette, revoca, lettura incerta senza stampa
  implicita dopo retry, scorciatoie gruppo con focus e assenza di stampa telefono.
- Nessuna migration, modifica di dati remoti, email o stampa fisica.
