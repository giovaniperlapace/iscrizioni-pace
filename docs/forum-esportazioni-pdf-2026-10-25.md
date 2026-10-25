# Esportazioni Forum PDF per sessione — 25 ottobre 2026

In Esportazioni, «Scarica PDF Forum» apre un dialog accessibile con lunedì mattina, lunedì pomeriggio e martedì mattina. Ciascuna scelta scarica uno ZIP con un PDF per ogni Forum, incluse le sale collegate. Sessioni derivate da starts_at in Europe/Rome, evento corrente e ordinamento numerico condiviso.

PDF A4 con font incorporato, intestazioni ripetute, pagine numerate, data di estrazione, confermati e coda distinti. La lettura canonica conserva minori selezionati, famiglie, ordine FIFO, sole offerte valide e riepilogo scuole. Nessun cambiamento operativo e nessuna migration.

Endpoint autenticato con controllo evento e ruolo (stessi permessi di lettura Forum, Viewer incluso), dati paginati e risposta private/no-store; errori interrompono l’intero export. Download con indicatore di caricamento e retry manuale.

Verifiche: build production, TypeScript e lint mirato; suite generale aggiornata dopo integrazione di origin/main: 1.140 test superati, inclusi i test del nuovo endpoint. PDF sintetico di sei pagine renderizzato e controllato, ZIP con Forum vuoto e titolo duplicato verificato. Non eseguito download autenticato con dati reali né collaudo interattivo nel browser.
